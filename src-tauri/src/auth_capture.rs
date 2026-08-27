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

  // 跟随软件代理设置：与网络请求层保持一致。
  // 关闭代理 → 强制无代理；开启且为自定义代理 → 显式指定 --proxy-server；
  // 开启且使用系统代理 → 不额外传参（WebView2 默认走系统代理）。
  if !enable_proxy {
    builder = builder.additional_browser_args("--no-proxy-server");
  } else if !proxy_url.trim().is_empty() {
    // WebView2 的 --proxy-server 仅接受 host:port，去掉可能带上的 http:// 前缀
    let trimmed = proxy_url
      .trim()
      .trim_start_matches("http://")
      .trim_start_matches("https://");
    builder = builder.additional_browser_args(&format!("--proxy-server={trimmed}"));
  }

  builder
    .build()
    .map_err(|e| format!("打开登录窗口失败: {e}"))?;

  // 后台轮询 Cookie 存储，直到抓到 auth_token + ct0
  let poller_app = app.clone();
  std::thread::spawn(move || poller_loop(poller_app));

  Ok(())
}

/// 应用数据目录（登录 WebView 独立数据目录的基路径）。
fn login_data_dir(app: &tauri::AppHandle) -> Option<PathBuf> {
  app.path_resolver().app_data_dir()
}

/// 轮询 Cookie 存储；成功即上报并关窗。
fn poller_loop(app: tauri::AppHandle) {
  let window_label = "login-window";
  // 最多轮询约 10 分钟，避免异常时永久占用线程
  for _ in 0..750 {
    if app.get_window(window_label).is_none() {
      return; // 用户手动关闭则停止
    }
    if let Some(map) = read_webview_cookies(&app) {
      let auth_token = map.get("auth_token");
      let ct0 = map.get("ct0");
      if let (Some(auth_token), Some(ct0)) = (auth_token, ct0) {
        if !auth_token.is_empty() && !ct0.is_empty() {
          let cookie = format!("auth_token={auth_token}; ct0={ct0}");
          let _ = app.emit_all(
            "auth-login-success",
            serde_json::json!({
              "cookie": cookie,
              "auth_token": auth_token,
              "ct0": ct0,
            }),
          );
          // 提取完成，自动关闭内置窗口
          if let Some(w) = app.get_window(window_label) {
            let _ = w.close();
          }
          return;
        }
      }
    }
    std::thread::sleep(Duration::from_millis(800));
  }
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

/// 尽量定位到登录窗口的 WebView2 用户数据目录下的 `Network/Cookies`。
/// 登录窗口使用独立的 `login-webview` 数据目录，路径可预测，优先级最高；
/// 再退化为扫描 LOCALAPPDATA 下最近被改写的候选。
fn discover_cookie_files(app: &tauri::AppHandle) -> Vec<PathBuf> {
  let mut out: Vec<PathBuf> = Vec::new();

  // 1) 登录窗口独立数据目录（WebView2 单 profile 结构）
  if let Some(base) = login_data_dir(app).map(|d| d.join("login-webview")) {
    for p in [
      base.join("Default").join("Network").join("Cookies"),
      base.join("Network").join("Cookies"),
    ] {
      if path_maybe_cookie_db(&p) {
        out.push(p);
      }
    }
  }

  let Some(base) = local_app_data() else {
    return out;
  };

  for name in [
    "x-spider",
    "X-Spider-二黑修改版",
    "com.tauri.dev",
  ] {
    for p in [
      base.join(name).join("Network").join("Cookies"),
      base.join(name).join("EBWebView").join("Network").join("Cookies"),
    ] {
      if path_maybe_cookie_db(&p) {
        out.push(p);
      }
    }
  }

  // 兜底扫描：一级子目录可能容纳多个 WebView2 配置
  if let Ok(read) = std::fs::read_dir(&base) {
    for entry in read.flatten() {
      if !entry.path().is_dir() {
        continue;
      }
      for p in [
        entry.path().join("Network").join("Cookies"),
        entry.path().join("EBWebView").join("Network").join("Cookies"),
      ] {
        // 仅保留比已有候补更近被改写的，减少错误偏好
        let newer = out.iter().all(|o| {
          !o.exists()
            || modified(o).map(|t| t > modified(&p).unwrap_or(0)).unwrap_or(false)
        });
        if path_maybe_cookie_db(&p) && newer {
          out.push(p);
        }
      }
    }
  }

  // 去重并依最近改写时间优先
  out.sort_by_key(|p| std::cmp::Reverse(modified(p).unwrap_or(0)));
  out.dedup();
  out
}

fn path_maybe_cookie_db(p: &Path) -> bool {
  p.exists() && p.is_file()
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
fn read_cookies_from(db_path: &Path) -> Option<HashMap<String, String>> {
  use rusqlite::OpenFlags;

  let conn =
    rusqlite::Connection::open_with_flags(db_path, OpenFlags::SQLITE_OPEN_READ_ONLY)
      .ok()?;
  let key = os_crypt_key(Path::new(db_path))?;

  let mut stmt = conn
    .prepare(
      "SELECT name, value FROM cookies \
       WHERE host_key LIKE '%x.com' AND name IN ('auth_token', 'ct0')",
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
        map.insert(name, s);
      }
    }
  }
  Some(map)
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