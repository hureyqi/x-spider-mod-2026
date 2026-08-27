实时更新：v26.0.10，修复内置浏览器自动登录时「点击“我已完成登录，立即获取 Cookie”后无法读取凭据」的问题。

## 主要更新
- 彻底修复自动登录凭据提取失效：
  - 根因：WebView2 在同一进程内只能维护一个浏览器环境，登录窗口被静默并入主窗口共享环境，登录 Cookie 落在被 WebView2 长期独占锁定的主环境 Cookie 库中，原有“复制 + 解密”文件读取方式在实际运行中必然失败。
  - 方案：改用 CDP（DevTools Protocol，远端调试）读取 HttpOnly Cookie。Rust 端为登录环境启用 remote debugging，动态读取调试端口，通过 WebSocket 发送 `Network.getAllCookies`，直接筛出 x.com 域的 `auth_token` / `ct0`，彻底绕开文件锁。
- 提升提取稳定性与反馈：
  - 登录完成后支持自动提取，也可手动点击「我已完成登录，立即获取 Cookie」触发（多次延时重试兜底）。
  - 手动提取按钮增加加载态，显示「正在检索 Cookie 刷盘凭据，请稍候…」，等待 Rust 重试轮询完成后再给出最终结果。

## 说明
- 便携版 `x-spider.exe` 已随本 Release 提供，下载后可直接运行（请确保 `aria2c` 就绪）。
- 安装包：`X-Spider-二黑修改版_26.0.10_x64-setup.exe`。