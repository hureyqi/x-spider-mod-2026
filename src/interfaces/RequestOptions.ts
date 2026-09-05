export interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';
  url: string;
  query?: Record<string, any>;
  headers?: Record<string, string>;
  body?: any;
  responseType: 'json' | 'text' | 'binary';
  /** 显式固定使用的 Cookie（用于验证某条 Cookie 是否有效），不参与自动轮换 */
  cookie?: string;
  /**
   * 命中这些状态码时立即抛错、不进入指数退避重试。
   * 用于 GraphQL queryId 候选探测：400/404 通常意味着该 queryId 已失效，
   * 应尽快换下一个候选而不是原地重试。
   */
  skipRetryStatuses?: number[];
}
