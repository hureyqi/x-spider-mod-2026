import * as R from 'ramda';

export function parseCookie(cookieString: string): Record<string, string> {
  return R.pipe(
    R.split(';'),
    R.map(R.pipe(R.trim, R.split('='))),
    // @ts-ignore
    R.fromPairs,
  )(cookieString) as Record<string, string>;
}

export function stringifyCookie(cookie: Record<string, string>): string {
  return R.pipe(R.toPairs, R.map(R.join('=')), R.join(';'))(cookie);
}

/**
 * 健壮解析任意 Cookie 文本：自动过滤多余空格、换行符与空项/非法项，
 * 提取形如 `auth_token=xxx; ct0=yyy` 的键值对（支持粘贴整段 Header Cookie）。
 */
export function parseCookieString(rawString: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const segment of String(rawString ?? '').split(';')) {
    const pair = segment.trim();
    if (!pair) continue;
    const idx = pair.indexOf('=');
    if (idx <= 0) continue; // 无键或键为空，跳过
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    // 过滤明显非 ASCII 打印字符前缀（如 BOM / 装饰字符）
    const safeKey = key.replace(/[^\x20-\x7E]/g, '');
    if (!safeKey) continue;
    out[safeKey] = value;
  }
  return out;
}

/** 手填快捷字段 → 拼装为标准 Cookie 字符串。 */
export function assembleCookie(
  fields: { alias?: string; auth_token?: string; ct0?: string },
): string {
  const parts: string[] = [];
  if (fields.auth_token?.trim()) parts.push(`auth_token=${fields.auth_token.trim()}`);
  if (fields.ct0?.trim()) parts.push(`ct0=${fields.ct0.trim()}`);
  return parts.join('; ');
}

/**
 * 规范化 Cookie 文本并校验合规性。
 * 返回 `{ ok, cookie?, error? }`：缺少必需字段或格式非法时给出明确错误信息。
 */
export function validateCookie(rawString: string): {
  ok: boolean;
  cookie?: string;
  error?: string;
} {
  const parsed = parseCookieString(rawString);
  if (Object.keys(parsed).length === 0) {
    return { ok: false, error: '请输入有效的 Cookie 字符串' };
  }
  const authToken = parsed.auth_token;
  const ct0 = parsed.ct0;
  if (!authToken?.trim()) {
    return {
      ok: false,
      error: '缺少必需的 auth_token 字段',
    };
  }
  if (!ct0?.trim()) {
    return {
      ok: false,
      error: '缺少必需的 ct0 字段（X-CSRF Token）',
    };
  }
  if ((ct0 as string).trim().length > 100) {
    return { ok: false, error: 'ct0 字段异常过长，请检查是否为完整的 Cookie 字符串' };
  }
  // 按标准顺序重建，保证请求头稳定
  const cookie = `auth_token=${(authToken as string).trim()}; ct0=${(ct0 as string).trim()}`;
  return { ok: true, cookie };
}
