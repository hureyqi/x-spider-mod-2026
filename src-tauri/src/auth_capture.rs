//! 内置浏览器自动登录与 Cookie 自动提取。
//!
//! 思路：打开一个独立的 Tauri WebviewWindow 加载 `https://x.com/login`，
//! 用户在窗口内完成登录后，X 的会话 Cookie（`auth_token` / `ct0`）会被写入
//! 应用所共享的 WebView2 用户数据目录。这里在 Rust 层轮询读取该 Cookie 存储并解密，
//! 从而获得 JS 层面读不到的 **HttpOnly** `auth_token`。
//!
//! 通信约定（渲染进程 <-> 主进程）：
//! - 渲染进程 `invoke('auth_login_open_window')` 打开登录窗口（幂等，已存在则聚焦）。
//! - 主进程检测到登录成功后会 `emit('auth-login-success', { cookie, ct0, auth_token })`，
//!   然后自动关闭登录窗口。渲染进程监听该事件完成入库与刷新。

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use base64::Engine;
use tauri::{Manager, WindowBuilder, WindowUrl};

// ---------------------------------------------------------------------------
// 事件与命令
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn auth_login_open_window(
  app: tauri::AppHandle,
  enable_proxy: bool,
  proxy_url: String,
) -> Result<(), String> {
  // 幂等：窗口已存在则直接聚焦，不重复创建
  if let Some(w) = app.get_window("login-window") {
    let _ = w.show();
    let _ = w.set_focus();
    return Ok(());
  }

  let url = "https://x.com/login"
    .parse::<url::Url>()
    .map_err(|e| format!("URL 解析失败: {e}"))?;

  let mut builder = WindowBuilder::new(&app, "login-window", WindowUrl::External(url))
    .title("X 自动登录")
    .inner_size(960.0, 720.0)
    .min_inner_size(720.0, 560.0)
    .resizable(true)
    .center();

  // 为登录窗口使用独立的 WebView2 用户数据目录：
  // 1) 使其拥有独立环境，可安全应用代理参数（不与主窗口环境冲突）；
  // 2) 让登录 Cookie 落在可预测的路径，便于自动提取。
  if let Some(data_dir) = login_data_dir(&app).map(|d| d.join("login-webview")) {
    let _ = std::fs::create_dir_all(&data_dir);
    builder = builder.data_directory(data_dir);
  }

  // 跟随软件代理设置：与网络请求层保持一致，并始终附加 `--remote-debugging-port=0`
  // 使 WebView2 开启 CDP 调试（动态分配端口，端口号记录在 DevToolsActivePort 文件中）。
  // WebView2 会把同类 UserData 环境内的 browser args 合并，因此该 flag 对共享环境生效，
  // Rust 侧即可通过 CDP 的 Network.getCookies 直接读取 HttpOnly 的 auth_token/ct0，
  // 从而绕开"主环境 Cookie 库被 WebView2 独占锁定"导致文件 IO 无法读取的问题。
  const DEBUG_FLAG: &str = "--remote-debugging-port=0";
  // 关闭代理 → 强制无代理；开启且为自定义代理 → 显式指定 --proxy-server；
  // 开启且使用系统代理 → 不额外传参（WebView2 默认走系统代理）。
  if !enable_proxy {
    builder = builder.additional_browser_args(&format!("{DEBUG_FLAG} --no-proxy-server"));
  } else if !proxy_url.trim().is_empty() {
    // WebView2 的 --proxy-server 仅接受 host:port，去掉可能带上的 http:// 前缀
    let trimmed = proxy_url
      .trim()
      .trim_start_matches("http://")
      .trim_start_matches("https://");
    builder = builder.additional_browser_args(&format!("{DEBUG_FLAG} --proxy-server={trimmed}"));
  } else {
    builder = builder.additional_browser_args(DEBUG_FLAG);
  }

  // 监听导航：到达 x.com/twitter.com 首页（/home）即置位提速信号
  let home_flag = Arc::new(AtomicBool::new(false));
  let nav_flag = home_flag.clone();
  builder = builder.on_navigation(move |url| {
    let host = url.host_str().unwrap_or("");
    if (host == "x.com" || host == "twitter.com") && url.path().starts_with("/home") {
      nav_flag.store(true, Ordering::Relaxed);
    }
    true
  });

  builder
    .build()
    .map_err(|e| format!("打开登录窗口失败: {e}"))?;

  // 后台轮询 Cookie 存储，直到抓到 auth_token + ct0
  let poller_app = app.clone();
  std::thread::spawn(move || poller_loop(poller_app, home_flag));

  Ok(())
}

#[tauri::command]
pub async fn fetch_current_cookies(
  app: tauri::AppHandle,
) -> Result<serde_json::Value, String> {
  // 快速通道：环境未被锁定时直接从文件读取（作为兜底，通常甩给 CDP 主通道）。
  if let Some(cred) = try_extract_cookies(&app) {
    finalize_login(&app, &cred);
    return Ok(cred);
  }

  // 主通道：通过 CDP（远端调试）读取 HttpOnly Cookie，绕开文件锁。
  // fetch_cookies_via_cdp 内部使用阻塞式 reqwest/tungstenite，且会创建自己的阻塞 runtime，
  // 必须放到阻塞线程池（spawn_blocking）中执行，避免在 async 上下文中 drop runtime 而 panic。
  // 登录 Cookie 刚写入时 WebView2 可能尚未完成会话建立，做延时重试给足缓冲。
  for _attempt in 1..=10 {
    let app2 = app.clone();
    let found = tauri::async_runtime::spawn_blocking(move || fetch_cookies_via_cdp(&app2))
      .await
      .ok()
      .flatten();
    if let Some(cred) = found {
      finalize_login(&app, &cred);
      return Ok(cred);
    }
    std::thread::sleep(Duration::from_millis(800));
  }

  eprintln!("[auth_capture] fetch_current_cookies via CDP failed after retries");
  Err("尚未读到 Cookie，请确认已在登录窗口完整登录后重试".to_string())
}

/// 提取成功后的收尾：广播事件给前端更新 Cookie 池，并关闭登录窗口。
fn finalize_login(app: &tauri::AppHandle, cred: &serde_json::Value) {
  let _ = app.emit_all("auth-login-success", cred.clone());
  if let Some(w) = app.get_window("login-window") {
    let _ = w.close();
  }
}

/// 通过 CDP 读取登录会话 Cookie（auth_token / ct0）。
///
/// WebView2 在共享 UserData 环境上开启 `--remote-debugging-port=0` 后，会在该环境的
/// user-data 目录下写入 `DevToolsActivePort` 记录动态端口。这里：
/// 1) 读取端口；
/// 2) 通过 `/json/list` 找到 x.com 页面目标的 WebSocket 调试地址；
/// 3) 用 WebSocket 发送 `Network.getAllCookies`，从返回中筛出 auth_token / ct0。
fn fetch_cookies_via_cdp(app: &tauri::AppHandle) -> Option<serde_json::Value> {
  use tungstenite::{connect, Message};

  let port = read_devtools_port(app)?;
  let list_url = format!("http://127.0.0.1:{port}/json/list");
  let pages: Vec<serde_json::Value> = reqwest::blocking::get(&list_url).ok()?.json().ok()?;

  let ws_url = pages
    .iter()
    .find(|p| {
      p["url"]
        .as_str()
        .map(|u| {
          let low = u.to_ascii_lowercase();
          low.contains("x.com") || low.contains("twitter.com")
        })
        .unwrap_or(false)
    })
    .and_then(|p| p["webSocketDebuggerUrl"].as_str().map(|s| s.to_string()))?;

  let (mut sock, _) = connect(&ws_url).ok()?;
  sock.send(Message::Text(
    r#"{"id":1,"method":"Network.getAllCookies","params":{}}"#.into(),
  ))
  .ok()?;

  let mut auth_token: Option<String> = None;
  let mut ct0: Option<String> = None;
  loop {
    let msg = sock.read().ok()?;
    if let Message::Text(text) = msg {
      let v: serde_json::Value = serde_json::from_str(&text).ok()?;
      if v["id"] == 1 {
        if let Some(cookies) = v["result"]["cookies"].as_array() {
          for c in cookies {
            let name = c["name"].as_str().unwrap_or("");
            let domain = c["domain"].as_str().unwrap_or("");
            let value = c["value"].as_str().unwrap_or("");
            let is_x = domain.contains("x.com") || domain.contains("twitter.com");
            if !is_x || value.is_empty() {
              continue;
            }
            match name {
              "auth_token" => auth_token = Some(value.to_string()),
              "ct0" => ct0 = Some(value.to_string()),
              _ => {}
            }
          }
        }
        break;
      }
    }
  }

  let auth_token = auth_token?;
  let ct0 = ct0?;
  if auth_token.is_empty() || ct0.is_empty() {
    return None;
  }
  let cookie = format!("auth_token={auth_token}; ct0={ct0}");
  eprintln!("[auth_capture] CDP got auth_token len={}", auth_token.len());
  Some(serde_json::json!({
    "cookie": cookie,
    "auth_token": auth_token,
    "ct0": ct0,
  }))
}

/// 读取 WebView2 的 `DevToolsActivePort`，返回动态分配的 CDP 调试端口。
/// 遍历所有可能的 UserData 环境根（共享主环境 + 独立 login-webview 环境）。
fn read_devtools_port(app: &tauri::AppHandle) -> Option<u16> {
  let mut roots: Vec<PathBuf> = Vec::new();
  if let Some(base) = login_data_dir(app) {
    roots.push(base.join("login-webview").join("EBWebView"));
  }
  if let Some(base) = local_app_data() {
    for name in ["x-spider", "com.tauri.dev", "X-Spider-二黑修改版"] {
      roots.push(base.join(name).join("EBWebView"));
    }
  }
  for root in roots {
    for f in [root.join("DevToolsActivePort"), root.join("Default").join("DevToolsActivePort")] {
      if let Ok(s) = std::fs::read_to_string(&f) {
        if let Some(line) = s.lines().next() {
          if let Ok(p) = line.trim().parse::<u16>() {
            eprintln!("[auth_capture] DevToolsActivePort={p} @ {}", f.display());
            return Some(p);
          }
        }
      }
    }
  }
  None
}

/// 应用数据目录（登录 WebView 独立数据目录的基路径）。
fn login_data_dir(app: &tauri::AppHandle) -> Option<PathBuf> {
  app.path_resolver().app_data_dir()
}

/// 轮询 Cookie 存储；成功即上报并关窗。
fn poller_loop(app: tauri::AppHandle, home_flag: Arc<AtomicBool>) {
  let window_label = "login-window";
  // 最多轮询约 8 分钟，避免异常时永久占用线程
  for _ in 0..960 {
    if app.get_window(window_label).is_none() {
      return; // 用户手动关闭则停止
    }
    if let Some(cred) = try_extract_cookies(&app) {
      finalize_login(&app, &cred);
      return;
    }
    if let Some(cred) = fetch_cookies_via_cdp(&app) {
      finalize_login(&app, &cred);
      return;
    }
    // 已进入首页后加快轮询，尽快捕获刚写入磁盘的 Cookie
    let delay = if home_flag.load(Ordering::Relaxed) {
      300
    } else {
      800
    };
    std::thread::sleep(Duration::from_millis(delay));
  }
}

/// 尝试从 Cookie 存储中提取 `auth_token` + `ct0`，成功则返回拼装好的凭据载荷。
fn try_extract_cookies(app: &tauri::AppHandle) -> Option<serde_json::Value> {
  let map = read_webview_cookies(app)?;
  let auth_token = map.get("auth_token")?;
  let ct0 = map.get("ct0")?;
  if auth_token.is_empty() || ct0.is_empty() {
    return None;
  }
  let cookie = format!("auth_token={auth_token}; ct0={ct0}");
  Some(serde_json::json!({
    "cookie": cookie,
    "auth_token": auth_token,
    "ct0": ct0,
  }))
}

// ---------------------------------------------------------------------------
// 读取并解密 WebView2 Cookie
// ---------------------------------------------------------------------------

/// 读取 x.com 域下已解密的 Cookie（至少包含 auth_token / ct0）。
fn read_webview_cookies(app: &tauri::AppHandle) -> Option<HashMap<String, String>> {
  for db in discover_cookie_files(app) {
    if let Some(map) = read_cookies_from(&db) {
      if map.contains_key("auth_token") {
        return Some(map);
      }
    }
  }
  None
}

/// 尽量定位到 WebView2 登录窗口的 `Network/Cookies` 文件。
///
/// 登录窗口使用独立数据目录（`login-webview`），但为兼容“共享环境忽略单窗口
/// data_directory”，并覆盖 WebView2 新旧布局（`EBWebView/`、`Default/`、`Profile N/`
/// 等任意嵌套），这里对整个应用数据目录递归收集 `**/Network/Cookies`，再额外递归
/// `LOCALAPPDATA\<identifier>`（主环境常见的落点），最后按最近改写时间排序、去重。
fn discover_cookie_files(app: &tauri::AppHandle) -> Vec<PathBuf> {
  let mut out: Vec<PathBuf> = Vec::new();

  // 1) 应用数据目录（Roaming\x-spider，内含 login-webview）：整棵递归
  if let Some(base) = login_data_dir(app) {
    collect_cookie_dbs(&base, &mut out, 0);
  }

  // 2) LOCALAPPDATA 应用/标识目录：整棵递归（主 WebView 环境常见落点）
  if let Some(base) = local_app_data() {
    for name in ["x-spider", "X-Spider-二黑修改版", "com.tauri.dev"] {
      let dir = base.join(name);
      if dir.is_dir() {
        collect_cookie_dbs(&dir, &mut out, 0);
      }
    }
  }

  // 去重，并按最近改写时间优先（优先取刚写入登录 Cookie 的那一份）
  out.sort_by_key(|p| std::cmp::Reverse(modified(p).unwrap_or(0)));
  out.dedup();
  out
}

/// 递归收集 `<root>/**/Network/Cookies`（深度受限），兼容不同版本的 WebView2 数据目录布局。
fn collect_cookie_dbs(root: &Path, out: &mut Vec<PathBuf>, depth: usize) {
  if depth > 6 || !root.is_dir() {
    return;
  }
  if let Ok(read) = std::fs::read_dir(root) {
    for entry in read.flatten() {
      let p = entry.path();
      if p.is_dir() {
        collect_cookie_dbs(&p, out, depth + 1);
      } else if p.file_name().map(|n| n == "Cookies").unwrap_or(false)
        && p
          .parent()
          .and_then(|par| par.file_name())
          .map(|n| n == "Network")
          .unwrap_or(false)
      {
        out.push(p);
      }
    }
  }
}

fn modified(p: &Path) -> Option<u64> {
  std::fs::metadata(p).ok().and_then(|m| {
    m.modified()
      .ok()
      .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
      .map(|d| d.as_secs())
  })
}

fn local_app_data() -> Option<PathBuf> {
  #[cfg(target_os = "windows")]
  {
    std::env::var_os("LOCALAPPDATA").map(PathBuf::from)
  }
  #[cfg(not(target_os = "windows"))]
  {
    None
  }
}

/// 读取并解密指定 `Cookies` 数据库中的 x.com 关键字段。
///
/// 注意：登录窗口的 WebView2 持有着该库的锁，且采用 WAL 模式——新写入的 Cookie
/// 通常还留在 `Cookies-wal` 侧车文件里、尚未合并进主库。直接只读打开主库读不到数据，
/// 因此这里先把主库与 `-wal` 文件一并复制到临时目录，再在副本上读取并解密。
fn read_cookies_from(db_path: &Path) -> Option<HashMap<String, String>> {
  use rusqlite::OpenFlags;

  // 解密钥从原始位置向上查找 `Local State`（不易被锁定）
  let key = os_crypt_key(Path::new(db_path))?;

  // 复制 Cookie 库（含 WAL）到临时目录后读取
  let workdir = copy_cookie_store(db_path)?;
  let db_copy = workdir.join("Cookies");

  let conn = rusqlite::Connection::open_with_flags(
    &db_copy,
    OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_NO_MUTEX,
  )
  .ok()?;
  let _ = conn.busy_timeout(Duration::from_secs(5));

  // 放宽匹配：同时覆盖 `x.com` / `twitter.com` 及其所有子域名（host_key 形态如
  // `.x.com`、`.twitter.com`），SQLite 的 LIKE 对 ASCII 不区分大小写，天然兼容大小写混合。
  let mut stmt = conn
    .prepare(
      "SELECT name, value FROM cookies \
       WHERE host_key LIKE '%x.com' OR host_key LIKE '%twitter.com'",
    )
    .ok()?;

  let rows = stmt
    .query_map([], |row| {
      Ok((row.get::<_, String>(0)?, row.get::<_, Vec<u8>>(1)?))
    })
    .ok()?;

  let mut map = HashMap::new();
  for row in rows.flatten() {
    let (name, raw) = row;
    if let Some(plain) = decrypt_chrome(&key, &raw) {
      if let Ok(s) = String::from_utf8(plain) {
        // 键名统一小写，便于后续不区分大小写地定位 auth_token / ct0
        map.insert(name.to_ascii_lowercase(), s);
      }
    }
  }

  // 调试日志：打印实际读到/解密的 Cookie 名列表，方便区分「没读到」还是「漏了 auth_token」
  let mut names: Vec<&String> = map.keys().collect();
  names.sort();
  eprintln!(
    "[auth_capture] db={} discovered cookies: {:?}",
    db_path.display(),
    names
  );

  let _ = std::fs::remove_dir_all(&workdir);
  Some(map)
}

/// 把 `Cookies` 及同目录的 `Cookies-wal` 复制到唯一临时目录，返回该目录。
/// 复制了 WAL 侧车文件后，SQLite 打开副本即可读到最新已提交数据，规避：
/// 1) WebView2 持有原库锁导致读失败；2) WAL 未 checkpoint 导致主库读不到新数据。
///
/// WebView2 会以独占方式短暂锁定 Cookies 文件，单次 `std::fs::copy` 在 Windows 上可能因
/// 共享冲突直接失败。这里对主库拷贝做「短间隔 + 多次」重试，并在复制 WAL 前先对 WAL 做
/// checkpoint-friendly 的预读，尽可能读到刚提交的 Cookie。
fn copy_cookie_store(orig: &Path) -> Option<PathBuf> {
  use std::time::{SystemTime, UNIX_EPOCH};

  let stamp = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .ok()?
    .as_millis();
  let workdir = std::env::temp_dir().join(format!(
    "x-spider-cookies-{}-{stamp}",
    std::process::id()
  ));
  std::fs::create_dir_all(&workdir).ok()?;

  let fname = orig.file_name()?;
  let dest_main = workdir.join(fname);

  // 主库拷贝：捕获锁定异常后进行重试（WebView2 偶发独占锁，稍等即可释放）
  let mut last_err = String::new();
  let mut copied = false;
  for attempt in 1..=6 {
    match std::fs::copy(orig, &dest_main) {
      Ok(_) => {
        copied = true;
        break;
      }
      Err(e) => {
        last_err = e.to_string();
        std::thread::sleep(Duration::from_millis(300));
        eprintln!(
          "[auth_capture][copy_cookie_store] attempt {attempt} failed copying {}: {e}",
          orig.display()
        );
      }
    }
  }
  if !copied {
    eprintln!(
      "[auth_capture][copy_cookie_store] all retries failed for {}: {last_err}",
      orig.display()
    );
    let _ = std::fs::remove_dir_all(&workdir);
    return None;
  }

  // WAL 侧车文件：存在则一并复制，便于读到尚未 checkpoint 的新 Cookie。同样带少量重试。
  let wal_src = PathBuf::from(format!("{}-wal", orig.display()));
  if wal_src.is_file() {
    let wal_dest = PathBuf::from(format!("{}-wal", dest_main.display()));
    for _ in 0..6 {
      if std::fs::copy(&wal_src, &wal_dest).is_ok() {
        break;
      }
      std::thread::sleep(Duration::from_millis(300));
    }
  }

  Some(workdir)
}

/// 从 `Local State` 读取并 DPAPI 解密出 32 字节主密钥。
/// 从 Cookie 文件位置向上（最多 5 层）查找 `Local State`，兼容 WebView2 独立数据目录结构。
fn os_crypt_key(db_path: &Path) -> Option<Vec<u8>> {
  let mut dir = db_path.parent();
  for _ in 0..5 {
    let d = dir?;
    let local_state = d.join("Local State");
    if local_state.is_file() {
      let text = std::fs::read_to_string(local_state).ok()?;
      let v: serde_json::Value = serde_json::from_str(&text).ok()?;
      let b64 = v
        .pointer("/os_crypt/encrypted_key")
        .and_then(|k| k.as_str())?;
      let bytes = base64::engine::general_purpose::STANDARD
        .decode(b64)
        .ok()?;
      // Chrome 系格式：`DPAPI`(5B) + DPAPI 密文
      let payload = bytes.strip_prefix(b"DPAPI")?;
      return dpapi_unprotect(payload);
    }
    dir = d.parent();
  }
  None
}

/// Windows DPAPI 解密（当前目标平台）。
#[cfg(target_os = "windows")]
fn dpapi_unprotect(input: &[u8]) -> Option<Vec<u8>> {
  use windows::Win32::Security::Cryptography::{
    CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
  };

  let in_blob = CRYPT_INTEGER_BLOB {
    cbData: input.len() as u32,
    pbData: input.as_ptr() as *mut u8,
  };
  let mut out_blob = CRYPT_INTEGER_BLOB::default();

  let ok = unsafe {
    CryptUnprotectData(
      &in_blob,
      Some(std::ptr::null_mut()),
      Some(std::ptr::null()),
      Some(std::ptr::null()),
      Some(std::ptr::null()),
      CRYPTPROTECT_UI_FORBIDDEN,
      &mut out_blob,
    )
  };
  if ok.is_err() || out_blob.pbData.is_null() {
    return None;
  }
  let data =
    unsafe { std::slice::from_raw_parts(out_blob.pbData, out_blob.cbData as usize).to_vec() };
  Some(data)
}

#[cfg(not(target_os = "windows"))]
fn dpapi_unprotect(_input: &[u8]) -> Option<Vec<u8>> {
  None
}

/// 解密单条 Cookie 值（支持 Chrome v10-CBC / v11-v20 GCM）。
fn decrypt_chrome(key_master: &[u8], value: &[u8]) -> Option<Vec<u8>> {
  if value.len() < 4 {
    return None;
  }
  let body = &value[3..]; // 去掉 "v10" / "v11" / "v20" 前缀
  match &value[..3] {
    b"v10" => decrypt_aes_cbc(key_master, body),
    b"v11" | b"v20" => decrypt_aes_gcm(key_master, body),
    _ => None,
  }
}

/// AES-256-GCM / AES-128-GCM 解密。GCM 自带校验，密钥或 nonce 不对会直接失败。
fn decrypt_aes_gcm(key_master: &[u8], body: &[u8]) -> Option<Vec<u8>> {
  use aes_gcm::{aead::Aead, Aes128Gcm, Aes256Gcm, KeyInit, Nonce};
  if body.len() < 12 + 16 {
    return None;
  }
  let nonce = Nonce::from_slice(&body[..12]);
  let ct = &body[12..];

  // 优先 AES-256-GCM（v20），失败再试 AES-128-GCM（v11）
  if key_master.len() >= 32 {
    if let Ok(cipher) = Aes256Gcm::new_from_slice(&key_master[..32]) {
      if let Ok(pt) = cipher.decrypt(nonce, ct) {
        return Some(pt);
      }
    }
  }
  if key_master.len() >= 16 {
    if let Ok(cipher) = Aes128Gcm::new_from_slice(&key_master[..16]) {
      if let Ok(pt) = cipher.decrypt(nonce, ct) {
        return Some(pt);
      }
    }
  }
  None
}

/// AES-128-CBC（Chrome v10）解密 + PKCS7 去填充。
fn decrypt_aes_cbc(key_master: &[u8], body: &[u8]) -> Option<Vec<u8>> {
  use cbc::cipher::block_padding::Pkcs7;
  use cbc::cipher::{BlockDecryptMut, KeyIvInit};
  use cbc::Decryptor;
  if body.len() < 16 || key_master.len() < 16 {
    return None;
  }
  let iv = &body[..16];
  let ct = &body[16..];
  let cipher = Decryptor::<aes::Aes128>::new_from_slices(&key_master[..16], iv).ok()?;
  let mut buf = ct.to_vec();
  let pt = cipher.decrypt_padded_mut::<Pkcs7>(&mut buf).ok()?;
  Some(pt.to_vec())
}