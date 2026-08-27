import { invoke } from '@tauri-apps/api';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { useSettingsStore } from '../stores/settings';

/**
 * 内置浏览器自动登录的 IPC 封装。
 *
 * - `openAuthLoginWindow()`：调用 Rust 主进程打开 X 登录窗口（幂等，已存在则聚焦），
 *   并跟随软件设置里的代理配置（与网络请求保持一致）。
 * - `onAuthLoginSuccess(cb)`：订阅「登录成功、Cookie 已提取」事件，返回取消监听函数。
 */

export interface AuthLoginSuccessData {
  /** 拼装好的标准 Cookie 字符串，如 `auth_token=xxx; ct0=yyy` */
  cookie: string;
  auth_token: string;
  ct0: string;
}

/** 打开内置浏览器登录窗口（跟随软件代理设置）。 */
export async function openAuthLoginWindow(): Promise<void> {
  const proxy = useSettingsStore.getState().proxy;
  await invoke('auth_login_open_window', {
    enableProxy: proxy.enable !== false,
    proxyUrl: proxy.useSystem ? '' : proxy.url,
  });
}

/**
 * 监听登录成功事件。返回的解绑函数用于组件卸载时移除监听，避免重复回调。
 */
export function onAuthLoginSuccess(
  cb: (data: AuthLoginSuccessData) => void,
): () => void {
  let unlisten: UnlistenFn | undefined;
  void listen<AuthLoginSuccessData>('auth-login-success', (e) => {
    cb(e.payload);
  }).then((fn) => {
    unlisten = fn;
  });
  return () => unlisten?.();
}

/**
 * 手动触发 Rust 端立即读取当前 WebView 的 Cookie 并返回。
 * 用于用户已完成登录但轮询未自动触发的兜底场景。
 * 成功时同时触发 `auth-login-success` 事件（Rust 侧在返回前已 emit）。
 */
export async function fetchCurrentCookies(): Promise<AuthLoginSuccessData> {
  return await invoke<AuthLoginSuccessData>('fetch_current_cookies');
}
