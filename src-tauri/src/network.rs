use std::collections::HashMap;
use reqwest::Method;
use serde_json::Value;

#[derive(Default, serde::Serialize)]
pub struct Response {
  status: u16,
  headers: HashMap<String, Vec<String>>,
  body: Value,
}

#[tauri::command]
pub async fn network_fetch(
  method: String,
  url: String,
  body: String,
  enable_proxy: bool,
  proxy_url: String,
  response_type: String,
  headers: HashMap<String, String>,
) -> Result<Response, String> {
  let map_reqwest_err = |err: reqwest::Error| err.to_string();
  // Convert method string into Method
  let method: Method = match method.to_uppercase().as_str() {
    "GET" => Ok(Method::GET),
    "POST" => Ok(Method::POST),
    "PATCH" => Ok(Method::PATCH),
    "PUT" => Ok(Method::PUT),
    "DELETE" => Ok(Method::DELETE),
    "HEAD" => Ok(Method::HEAD),
    _ => Err("Invalid method".to_string()),
  }?;

  // Build client
  let client = {
    let mut b = reqwest::Client::builder();

    // Auto set proxy settings
    if enable_proxy {
      if proxy_url.len() == 0 {
        // Use system proxy, do nothing
      } else {
        // Use custom proxy url
        let proxy_http = reqwest::Proxy::http(proxy_url.clone()).or(Err("Failed to set proxy url".to_string()))?;
        let proxy_https = reqwest::Proxy::https(proxy_url.clone()).or(Err("Failed to set proxy url".to_string()))?;
        b = b.proxy(proxy_http).proxy(proxy_https);
      }
    } else {
      // No proxy
      b = b.no_proxy();
    }

    b.build().or(Err("Failed to build reqwest client".to_string()))
  }?;

  // Build request
  let request = {
    let mut req = client.request(method.clone(), url);
    for (k, v) in headers {
      req = req.header(k, v);
    }

    if !matches!(method.clone(), Method::GET) {
      req = req.body(body);
    }

    req
  };

  // Send request
  let response = request.send().await.map_err(map_reqwest_err)?;

  // Extract some info
  let status = response.status().as_u16();
  let resp_headers = {
    let reqwest_headers = response.headers();
    let mut h: HashMap<String, Vec<String>> = HashMap::with_capacity(reqwest_headers.len());

    for (k, v) in reqwest_headers {
      let v = v.to_str();
      if let Err(_) = v {
        continue;
      }

      let v = v.unwrap().to_string();
      h.entry(k.to_string()).and_modify(|arr: &mut Vec<String>| arr.push(v.clone()))
        .or_insert_with(|| vec![v]);
    }

    h
  };

  // Load response body
  let body: Value = {
    match response_type.as_str() {
      "json" => response.json().await.map_err(map_reqwest_err).map(|res| Value::Object(res)),
      "text" => response.text().await.map_err(map_reqwest_err).map(|res| Value::String(res)),
      "binary" => {
        let bytes = response.bytes().await.map_err(map_reqwest_err)?;
        serde_json::to_value(bytes.to_vec()).map_err(|err| err.to_string())
      },
      _ => Err("Unsupported response type".to_string())
    }
  }?;

  return Ok(Response {
    status,
    body,
    headers: resp_headers })
}

#[tauri::command]
pub async fn network_get_system_proxy_url() -> Result<HashMap<String, String>, ()> {
    // 读取系统代理设置
    let mut map = HashMap::new();
    
    // 尝试读取系统代理 (HTTP/HTTPS)
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        
        // 通过 reg 命令读取 Windows 注册表中的代理设置
        let output = Command::new("reg")
            .args(&[
                "query",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings",
                "/v", "ProxyServer",
            ])
            .output();
        
        if let Ok(output) = output {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                
                // 解析类似 "ProxyServer    REG_SZ    127.0.0.1:1080" 的输出
                for line in stdout.lines() {
                    if line.contains("ProxyServer") {
                        let parts: Vec<&str> = line.split_whitespace().collect();
                        if parts.len() >= 3 {
                            let proxy = parts[2];
                            if !proxy.is_empty() && proxy != "(null)" {
                                map.insert("http".to_string(), format!("http://{}", proxy));
                                map.insert("https".to_string(), format!("http://{}", proxy));
                            }
                        }
                    }
                }
                
                // 检查代理是否启用
                let enable_output = Command::new("reg")
                    .args(&[
                        "query",
                        r"HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings",
                        "/v", "ProxyEnable",
                    ])
                    .output();
                
                if let Ok(enable_out) = enable_output {
                    let enable_stdout = String::from_utf8_lossy(&enable_out.stdout);
                    // 如果 ProxyEnable 为 0，则清除代理
                    if enable_stdout.contains("0x0") {
                        return Ok(HashMap::new());
                    }
                }
            }
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        if let Ok(proxy) = std::env::var("http_proxy") {
            if !proxy.is_empty() {
                map.insert("http".to_string(), proxy.clone());
            }
        }
        if let Ok(proxy) = std::env::var("https_proxy") {
            if !proxy.is_empty() {
                map.insert("https".to_string(), proxy.clone());
            }
        }
    }
    
    #[cfg(target_os = "macos")]
    {
        // macOS 可以通过 scutil --proxy 获取，但这里简化处理
        // 主要依赖环境变量
        if let Ok(proxy) = std::env::var("http_proxy") {
            if !proxy.is_empty() {
                map.insert("http".to_string(), proxy.clone());
            }
        }
        if let Ok(proxy) = std::env::var("https_proxy") {
            if !proxy.is_empty() {
                map.insert("https".to_string(), proxy.clone());
            }
        }
    }
    
    Ok(map)
}

