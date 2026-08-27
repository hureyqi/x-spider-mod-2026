export interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';
  url: string;
  query?: Record<string, any>;
  headers?: Record<string, string>;
  body?: any;
  responseType: 'json' | 'text' | 'binary';
  /** 显式固定使用的 Cookie（用于验证某条 Cookie 是否有效），不参与自动轮换 */
  cookie?: string;
}
