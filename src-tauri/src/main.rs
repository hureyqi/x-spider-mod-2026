// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod auth_capture;
mod network;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
          network::network_fetch,
          network::network_get_system_proxy_url,
          auth_capture::auth_login_open_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
