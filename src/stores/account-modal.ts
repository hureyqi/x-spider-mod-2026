import { create } from 'zustand';
import { AccountEntry } from './accounts';

/**
 * 全局「添加 / 编辑 Cookie / 账户」弹窗控制单一来源。
 * 左侧栏 Account、设置页 AccountPoolManager 统一调用 openAddCookieModal() /
 * openEditAccount()，避免各自维护独立弹窗状态、或重复渲染多份 Modal。
 */
interface AccountModalState {
  addModalOpen: boolean;
  /** 编辑目标账户；非空表示当前处于「编辑」模式 */
  editingAccount: AccountEntry | null;
  openAddCookieModal: () => void;
  openEditAccount: (entry: AccountEntry) => void;
  closeAddCookieModal: () => void;
}

export const useAccountModalStore = create<AccountModalState>((set) => ({
  addModalOpen: false,
  editingAccount: null,
  openAddCookieModal: () => set({ addModalOpen: true, editingAccount: null }),
  openEditAccount: (entry) =>
    set({ addModalOpen: true, editingAccount: entry }),
  closeAddCookieModal: () => set({ addModalOpen: false, editingAccount: null }),
}));