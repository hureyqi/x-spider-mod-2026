import { nanoid } from 'nanoid';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TwitterAccountInfo } from '../interfaces/TwitterAccountInfo';
import { createTauriFileStorage } from './persist/tauri-file-storage';
import { useAppStateStore } from './app-state';

export interface AccountEntry {
  id: string;
  /** 用户自定义别名，兜底为账号 screenName */
  alias: string;
  /** 完整 Cookie 字符串 */
  cookie: string;
  /** 缓存的账号展示信息（头像/昵称），未验证时为空 */
  info?: TwitterAccountInfo | null;
  createdAt: number;
}

export interface AccountStore {
  accounts: AccountEntry[];
  activeId: string | null;
  addAccount: (
    cookie: string,
    opts?: { alias?: string; info?: TwitterAccountInfo | null },
  ) => string;
  removeAccount: (id: string) => void;
  updateAccount: (id: string, patch: Partial<AccountEntry>) => void;
  setActive: (id: string) => void;
  /** 将账号池与当前账号同步到 app-state，供请求层轮换消费 */
  syncToAppState: () => void;
}

/** 将账号池投影到 app-state：cookieStrings = 全部 cookie，cookieString = 当前账号 */
function projectToAppState(state: AccountStore) {
  const pool = state.accounts.map((a) => a.cookie);
  const active = state.accounts.find((a) => a.id === state.activeId);
  const activeCookie = active ? active.cookie : pool[0] || '';
  useAppStateStore.getState().setCookieStrings(pool);
  useAppStateStore.getState().setCookieString(activeCookie);
}

export const useAccountStore = create(
  persist<AccountStore>(
    (set, get) => {
      const mutate = (next: AccountStore) => {
        set(next);
        projectToAppState(next);
      };

      return {
        accounts: [],
        activeId: null,
        addAccount: (cookie, opts) => {
          const id = nanoid();
          const info = opts?.info ?? null;
          const alias =
            opts?.alias?.trim() ||
            info?.screenName?.trim() ||
            `账号${get().accounts.length + 1}`;
          const next: AccountStore = {
            ...get(),
            accounts: get().accounts.concat({
              id,
              alias,
              cookie,
              info,
              createdAt: Date.now(),
            }),
            activeId: get().activeId || id,
          };
          mutate(next);
          return id;
        },
        removeAccount: (id) => {
          const current = get();
          const rest = current.accounts.filter((a) => a.id !== id);
          mutate({
            ...current,
            accounts: rest,
            activeId:
              current.activeId === id
                ? (rest[0]?.id ?? null)
                : current.activeId,
          });
        },
        updateAccount: (id, patch) => {
          mutate({
            ...get(),
            accounts: get().accounts.map((a) =>
              a.id === id ? { ...a, ...patch } : a,
            ),
          });
        },
        setActive: (id) => {
          if (!get().accounts.some((a) => a.id === id)) return;
          mutate({ ...get(), activeId: id });
        },
        syncToAppState: () => {
          projectToAppState(get());
        },
      };
    },
    {
      name: 'accounts',
      storage: createTauriFileStorage(),
      version: 1,
      onRehydrateStorage: () => (state) => {
        // 首次启用：把旧版单 Cookie（app-state.cookieString）导入为默认账户
        if (state && state.accounts.length === 0) {
          const legacy = useAppStateStore.getState().cookieString;
          if (legacy) {
            queueMicrotask(() => {
              useAccountStore.getState().addAccount(legacy, { alias: '账号1' });
            });
          }
        }
      },
    },
  ),
);

/** 当前激活账户的 hook 便捷读取 */
export function useActiveAccount() {
  return useAccountStore((s) => {
    const active = s.accounts.find((a) => a.id === s.activeId);
    return active ?? null;
  });
}
