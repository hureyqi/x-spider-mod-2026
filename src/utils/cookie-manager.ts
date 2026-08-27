/**
 * CookieManager —— 多 Cookie 池管理与轮换引擎。
 *
 * 职责：
 *  - 导入多条 Cookie，维护每个账号的健康度（受限冷却、失败/请求计数）。
 *  - 采用轮询（round-robin）策略挑选下一条可用 Cookie，自动跳过受限/冷却中的账号。
 *  - 当请求遇到 401/429 时调用 markLimited 标记当前账号受限，下一次取号自动切换到下一条。
 */
export interface CookieAccount {
  /** 原始 Cookie 字符串（如 `auth_token=...; ct0=...`） */
  cookie: string;
  /** 最近一次被标记受限的时间戳，0 表示从未受限 */
  limitedAt: number;
  /** 受限冷却截止时间戳，超过该时间自动恢复可用 */
  limitedUntil: number;
  /** 累计受限次数 */
  failCount: number;
  /** 累计请求次数 */
  requestCount: number;
  /** 最近一次使用时间戳 */
  lastUsedAt: number;
}

/** 账号受限后的冷却时长：10 分钟 */
export const ACCOUNT_COOL_DOWN_MS = 10 * 60 * 1000;

class CookieManager {
  private accounts: CookieAccount[] = [];
  /** 轮询游标，上一次取出的是哪个下标的下一个 */
  private cursor = 0;

  /**
   * 导入（或替换）整个 Cookie 池。
   * 已存在的 Cookie 会保留其健康度状态，避免导入动作重置冷却。
   */
  setCookies(cookies: string[]) {
    const deduped = Array.from(
      new Set(cookies.map((c) => c.trim()).filter(Boolean)),
    );
    const next: CookieAccount[] = deduped.map((cookie) => {
      const existing = this.accounts.find((a) => a.cookie === cookie);
      return (
        existing || {
          cookie,
          limitedAt: 0,
          limitedUntil: 0,
          failCount: 0,
          requestCount: 0,
          lastUsedAt: 0,
        }
      );
    });
    this.accounts = next;
    // 修正游标越界
    if (this.cursor >= this.accounts.length) {
      this.cursor = 0;
    }
  }

  get count(): number {
    return this.accounts.length;
  }

  /** 暴露只读健康度快照，便于 UI / 日志展示 */
  getHealth(): Omit<CookieAccount, 'cookie'>[] {
    return this.accounts.map((a) => ({
      limitedAt: a.limitedAt,
      limitedUntil: a.limitedUntil,
      failCount: a.failCount,
      requestCount: a.requestCount,
      lastUsedAt: a.lastUsedAt,
      limited: this.isLimited(a),
    }));
  }

  private isLimited(acc: CookieAccount): boolean {
    return acc.limitedUntil > Date.now();
  }

  /** 是否存在至少一条可用（未受限）的 Cookie */
  hasAvailable(): boolean {
    return this.accounts.some((a) => !this.isLimited(a));
  }

  /** 查看下一条可用 Cookie 但不取出（不推进游标、不计数） */
  peekCookie(): string | null {
    return this.pick(false);
  }

  /**
   * 取出下一条可用 Cookie，并推进轮询游标。
   * 受限/冷却中的账号会被跳过；池为空或全部受限时返回 null。
   */
  nextCookie(): string | null {
    return this.pick(true);
  }

  private pick(advance: boolean): string | null {
    if (this.accounts.length === 0) return null;
    const now = Date.now();
    const n = this.accounts.length;
    for (let i = 0; i < n; i++) {
      const idx = (this.cursor + i) % n;
      const acc = this.accounts[idx];
      if (!this.isLimited(acc)) {
        if (advance) {
          this.cursor = (idx + 1) % n;
          acc.lastUsedAt = now;
          acc.requestCount += 1;
        }
        return acc.cookie;
      }
    }
    return null;
  }

  /** 标记某个 Cookie 受限（触发冷却），通常在遇到 401/429 后调用 */
  markLimited(cookie: string) {
    const acc = this.accounts.find((a) => a.cookie === cookie);
    if (!acc) return;
    const now = Date.now();
    acc.limitedAt = now;
    acc.limitedUntil = now + ACCOUNT_COOL_DOWN_MS;
    acc.failCount += 1;
  }

  /** 标记某个 Cookie 已恢复正常（请求成功、非受限错误） */
  markSuccess(cookie: string) {
    const acc = this.accounts.find((a) => a.cookie === cookie);
    if (!acc) return;
    acc.limitedAt = 0;
    acc.limitedUntil = 0;
    acc.failCount = 0;
  }

  /** 重置所有受限状态，通常在用户手动导入 Cookie 后调用 */
  reset() {
    this.cursor = 0;
    this.accounts.forEach((acc) => {
      acc.limitedAt = 0;
      acc.limitedUntil = 0;
      acc.failCount = 0;
    });
  }
}

/** 全局唯一的 Cookie 管理器单例 */
export const cookieManager = new CookieManager();
