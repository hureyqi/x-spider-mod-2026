import { invoke } from '@tauri-apps/api';
import { Response } from '../interfaces/Response';
import { RequestOptions } from '../interfaces/RequestOptions';
import * as R from 'ramda';
import { useSettingsStore } from '../stores/settings';
import { useAppStateStore } from '../stores/app-state';
import { delay } from '../utils';
import { cookieManager } from '../utils/cookie-manager';
import { parseCookie } from '../utils/cookie';

/** 指数退避延迟序列：2s、4s、8s（即重试 3 次后抛错） */
const RETRY_DELAYS = [2000, 4000, 8000];

let log: ICategoriedLogger;

/** 将 app-state 中的 Cookie 池同步到 CookieManager（含单条兼容） */
function syncCookiesFromStore() {
  const { cookieStrings, cookieString } = useAppStateStore.getState();
  const rotationEnabled =
    useSettingsStore.getState().app.enableCookieRotation !== false;
  const allPool =
    Array.isArray(cookieStrings) && cookieStrings.length > 0
      ? cookieStrings
      : cookieString
        ? [cookieString]
        : [];
  // 关闭自动轮换时，仅使用当前激活 Cookie 构成单账号池
  const cookies = rotationEnabled
    ? allPool
    : cookieString
      ? [cookieString]
      : [];
  cookieManager.setCookies(cookies);
}

export async function request(options: RequestOptions) {
  if (!log) {
    log = window.log.category('NET');
  }
  const url = new URL(options.url);

  if (options.query) {
    Object.entries(options.query).forEach(([k, v]) => {
      url.searchParams.append(k, v);
    });
  }

  syncCookiesFromStore();

  const settings = useSettingsStore.getState();
  // 显式固定使用的 Cookie（用于验证某条 Cookie），不参与自动轮换
  const fixedCookie = options.cookie || undefined;
  const authCookie = options.cookie != null;

  // 依据当前选中的 Cookie 组装请求头（Cookie + X-Csrf-Token）
  const buildHeaders = (cookie?: string): Record<string, string> => {
    const headers: Record<string, string> = { ...(options.headers || {}) };
    if (cookie) {
      headers.Cookie = cookie;
      const ct0 = parseCookie(cookie).ct0;
      if (ct0) {
        headers['X-Csrf-Token'] = ct0;
      }
    } else {
      delete headers.Cookie;
      delete headers['X-Csrf-Token'];
    }
    return headers;
  };

  const method = R.defaultTo('GET', options.method);
  const body = R.defaultTo('', options.body);
  const proxyUrl = settings.proxy.useSystem ? '' : settings.proxy.url;
  let lastErr: any;
  let attempt = 0;
  // 初始 1 次 + 重试 3 次
  const maxAttempts = 1 + RETRY_DELAYS.length;

  while (attempt < maxAttempts) {
    // 选择本轮 Cookie：固定，或从池中轮换取号
    const cookie = fixedCookie || cookieManager.nextCookie() || undefined;

    try {
      const res = await requestInternal(
        method,
        url.href,
        body,
        settings.proxy.enable,
        proxyUrl,
        buildHeaders(cookie),
        options.responseType,
      );

      // 请求成功（2xx）
      if (res.status < 400) {
        if (cookie && !authCookie) cookieManager.markSuccess(cookie);
        return res;
      }

      const limited = !authCookie && (res.status === 401 || res.status === 429);
      lastErr = new Error(`HTTP ${res.status}`);

      if (limited && cookie) {
        // 标记当前账号受限，下一次取号自动轮换到下一条
        cookieManager.markLimited(cookie);
        // 池内已无可用账号，继续重试无意义
        if (!cookieManager.hasAvailable()) break;
      }

      log.warn(
        `Request failed (HTTP ${res.status}), attempt=${attempt + 1}/${maxAttempts}, retry in ${RETRY_DELAYS[attempt] ?? 0}ms`,
        { cookie: cookie ? '******' : undefined },
      );
    } catch (err: any) {
      lastErr = err;
      log.warn(
        `Request error, attempt=${attempt + 1}/${maxAttempts}, retry in ${RETRY_DELAYS[attempt] ?? 0}ms`,
        err,
      );
    }

    // 指数退避，最后一次重试失败后不再等待，直接抛出
    const wait = RETRY_DELAYS[attempt];
    if (wait != null) {
      await delay(wait);
    }
    attempt++;
  }

  log.error('Max retry count reached, last error:', lastErr);
  throw lastErr;
}

let reqIdGlobal = 0;

async function requestInternal(
  method: string,
  url: string,
  body: string,
  enableProxy: boolean,
  proxyUrl: string,
  headers: Record<string, string>,
  responseType: string,
): Promise<Response> {
  const startTs = Date.now();
  const reqId = reqIdGlobal++;
  log.info(`REQ_${reqId}`, method, url, {
    body,
    enableProxy,
    proxyUrl,
    headers: {
      ...headers,
      Cookie: headers.Cookie ? '******' : undefined,
    },
    responseType,
  });

  const res = await invoke<Response>('network_fetch', {
    method,
    url,
    body,
    enableProxy,
    proxyUrl,
    headers,
    responseType,
  });

  const endTs = Date.now() - startTs;
  log.info(`RES_${reqId}(+${endTs}ms)`, res.status, url, res);

  return res;
}

export async function getSystemProxy(): Promise<string> {
  const map: Record<string, string> = await invoke(
    'network_get_system_proxy_url',
  );
  const value = map.https || map.http;
  if (value) {
    return `http://${value}`;
  }
  return '';
}
