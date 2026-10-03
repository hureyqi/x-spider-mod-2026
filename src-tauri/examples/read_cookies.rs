//! 临时诊断工具：直接验证 WebView2 Cookie 库能否被本项目的读取逻辑解密出 auth_token。
//! 运行：cargo run --example read_cookies

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::Duration;

use base64::Engine;

fn main() {
    // 全盘扫描：登录 Cookie 可能写入主环境（Local）或独立 login-webview（Roaming/Local）
    let mut dbs: Vec<PathBuf> = Vec::new();
    for base in [
        r"C:\Users\admin\AppData\Roaming\x-spider",
        r"C:\Users\admin\AppData\Local\x-spider",
        r"C:\Users\admin\AppData\Local\com.tauri.dev",
        r"C:\Users\admin\AppData\Local\X-Spider-二黑修改版",
    ] {
        collect_dbs(Path::new(base), &mut dbs, 0);
    }
    // 按最近改写优先
    dbs.sort_by_key(|p| std::cmp::Reverse(modified(p).unwrap_or(0)));

    println!("=== scan found {} Cookie DBs ===", dbs.len());
    for db in &dbs {
        let size = std::fs::metadata(db)
            .map(|m| m.len())
            .unwrap_or(0);
        println!("--- candidate: {} ({} bytes) ---", db.display(), size);
        print_size(Path::new(&format!("{}-wal", db.display())), "wal");
        // 方式C：原生带全共享标志打开整个文件读入内存
        match read_file_with_share(db) {
            Some(bytes) => {
                println!(
                    "[native-share] OK read {} bytes; dump to temp & try sqlite",
                    bytes.len()
                );
            }
            None => println!("[native-share] FAILED (cannot open even with share flags)"),
        }
        match read_via_copy(db) {
            Some(map) => {
                let mut v: Vec<_> = map.keys().cloned().collect();
                v.sort();
                println!(
                    "[copy] OK has_auth={} has_ct0={} keys={:?}",
                    map.contains_key("auth_token"),
                    map.contains_key("ct0"),
                    v
                );
            }
            None => println!("[copy] FAILED (returned None)"),
        }
    }

    // remote debugging 探测：WebView2 共享环境(user-data) / Default 下的 DevToolsActivePort
    for p in [
        r"C:\Users\admin\AppData\Local\x-spider\EBWebView\Default\DevToolsActivePort",
        r"C:\Users\admin\AppData\Local\x-spider\EBWebView\DevToolsActivePort",
    ] {
        let fp = Path::new(p);
        match std::fs::read_to_string(fp) {
            Ok(t) => println!("[devtools] {p} -> {:#?}", t.trim().lines().into_iter().collect::<Vec<_>>()),
            Err(e) => println!("[devtools] {p} MISSING ({e})"),
        }
    }
}

/// 方式C：用 Windows CreateFileW 以 FILE_SHARE_READ|WRITE|DELETE 打开，把整个 Cookie 库读入内存，
/// 以验证"源文件被独占锁定"是否真的无法绕过（若成功则说明 std::fs::copy 的共享标志不足）。
#[cfg(target_os = "windows")]
fn read_file_with_share(p: &Path) -> Option<Vec<u8>> {
    use std::os::windows::ffi::OsStrExt;
    use windows::Win32::Storage::FileSystem::{
        CreateFileW, GetFileSizeEx, ReadFile, CloseHandle, GENERIC_READ, OPEN_EXISTING, FILE_SHARE_READ,
        FILE_SHARE_WRITE, FILE_SHARE_DELETE,
    };
    use windows::Win32::Foundation::INVALID_HANDLE_VALUE;

    let wide: Vec<u16> = p.as_os_str().encode_wide().chain(Some(0)).collect();
    let handle = unsafe {
        CreateFileW(
            wide.as_ptr(),
            GENERIC_READ,
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            None,
            OPEN_EXISTING,
            std::mem::zeroed(),
            None,
        )
    };
    if handle == INVALID_HANDLE_VALUE || handle.is_null() {
        return None;
    }
    let mut size: i64 = 0;
    let mut buf = Vec::new();
    unsafe {
        if GetFileSizeEx(handle, &mut size).is_err() {
            CloseHandle(handle);
            return None;
        }
        let mut inbuf = vec![0u8; size as usize];
        let mut read = 0u32;
        if ReadFile(handle, inbuf.as_mut_ptr() as _, inbuf.len() as u32, &mut read, None).is_err() {
            CloseHandle(handle);
            return None;
        }
        buf.resize(read as usize, 0);
        buf.copy_from_slice(&inbuf[..read as usize]);
        CloseHandle(handle);
    }
    Some(buf)
}

fn print_size(p: &Path, tag: &str) {
    let s = std::fs::metadata(p)
        .map(|m| m.len())
        .unwrap_or(0);
    if s > 0 {
        println!("  {tag}: {} bytes", s);
    }
}

fn modified(p: &Path) -> Option<u64> {
    std::fs::metadata(p)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
}

fn collect_dbs(root: &Path, out: &mut Vec<PathBuf>, depth: usize) {
    if depth > 6 || !root.is_dir() {
        return;
    }
    if let Ok(read) = std::fs::read_dir(root) {
        for entry in read.flatten() {
            let p = entry.path();
            if p.is_dir() {
                collect_dbs(&p, out, depth + 1);
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

fn read_direct(db_path: &Path) -> Option<HashMap<String, String>> {
    let key = os_crypt_key(db_path)?;
    let conn = rusqlite::Connection::open_with_flags(
        db_path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
    )
    .ok()?;
    query(&conn, &key)
}

fn read_via_copy(orig: &Path) -> Option<HashMap<String, String>> {
    let key = match os_crypt_key(orig) {
        Some(k) => { println!("[copy] os_crypt_key OK len={}", k.len()); k }
        None => { println!("[copy] os_crypt_key FAILED"); return None; }
    };
    let workdir = match copy_cookie_store(orig) {
        Some(d) => { println!("[copy] copy_cookie_store OK dir={}", d.display()); d }
        None => { println!("[copy] copy_cookie_store FAILED"); return None; }
    };
    let db_copy = workdir.join("Cookies");
    let conn = match rusqlite::Connection::open_with_flags(
        &db_copy,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
    ) {
        Ok(c) => { println!("[copy] open ok"); let _ = c.busy_timeout(Duration::from_secs(5)); c }
        Err(e) => { println!("[copy] open FAILED: {e}"); return None; }
    };
    let map = query(&conn, &key);
    let _ = std::fs::remove_dir_all(&workdir);
    map
}

fn query(
    conn: &rusqlite::Connection,
    key: &[u8],
) -> Option<HashMap<String, String>> {
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
        if let Some(plain) = decrypt_chrome(key, &raw) {
            if let Ok(s) = String::from_utf8(plain) {
                map.insert(name.to_ascii_lowercase(), s);
            }
        }
    }
    Some(map)
}

fn copy_cookie_store(orig: &Path) -> Option<PathBuf> {
    use std::time::{SystemTime, UNIX_EPOCH};
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .ok()?
        .as_millis();
    let workdir = std::env::temp_dir().join(format!("x-spider-dbg-{stamp}"));
    std::fs::create_dir_all(&workdir).ok()?;
    let fname = orig.file_name()?;
    let dest_main = workdir.join(fname);
    // 主库拷贝带重试：WebView2 偶发独占锁导致复制失败
    let mut copied = false;
    for attempt in 1..=6 {
        match std::fs::copy(orig, &dest_main) {
            Ok(_) => {
                copied = true;
                break;
            }
            Err(e) => {
                println!("[copy] attempt {attempt} copy FAILED: {e}");
                std::thread::sleep(Duration::from_millis(300));
            }
        }
    }
    if !copied {
        println!("[copy] all retries failed for {}", orig.display());
        let _ = std::fs::remove_dir_all(&workdir);
        return None;
    }
    println!("[copy] main DB copied to {}", dest_main.display());
    let wal_src = PathBuf::from(format!("{}-wal", orig.display()));
    if wal_src.is_file() {
        let _ = std::fs::copy(
            &wal_src,
            PathBuf::from(format!("{}-wal", dest_main.display())),
        );
    }
    Some(workdir)
}

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
            let payload = bytes.strip_prefix(b"DPAPI")?;
            return dpapi_unprotect(payload);
        }
        dir = d.parent();
    }
    None
}

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
    Some(
        unsafe { std::slice::from_raw_parts(out_blob.pbData, out_blob.cbData as usize).to_vec() },
    )
}

fn decrypt_chrome(key_master: &[u8], value: &[u8]) -> Option<Vec<u8>> {
    if value.len() < 4 {
        return None;
    }
    let body = &value[3..];
    match &value[..3] {
        b"v10" => {
            use cbc::cipher::block_padding::Pkcs7;
            use cbc::cipher::{BlockDecryptMut, KeyIvInit};
            use cbc::Decryptor;
            if body.len() < 16 || key_master.len() < 16 {
                return None;
            }
            let iv = &body[..16];
            let ct = &body[16..];
            let cipher =
                Decryptor::<aes::Aes128>::new_from_slices(&key_master[..16], iv).ok()?;
            let mut buf = ct.to_vec();
            Some(cipher.decrypt_padded_mut::<Pkcs7>(&mut buf).ok()?.to_vec())
        }
        b"v11" | b"v20" => {
            use aes_gcm::{aead::Aead, Aes128Gcm, Aes256Gcm, KeyInit, Nonce};
            if body.len() < 12 + 16 {
                return None;
            }
            let nonce = Nonce::from_slice(&body[..12]);
            let ct = &body[12..];
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
        _ => None,
    }
}