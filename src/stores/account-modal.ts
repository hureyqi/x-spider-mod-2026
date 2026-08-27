import { create } from 'zustand';

/**
 * 全局「添加 Cookie / 账户」弹窗控制单一来源。
 * 左侧栏 Account 与 设置页 AccountPoolManager 统一调用 openAddCookieModal()，
 * 避免各自维护独立弹窗状态、或重复渲染多份 Modal。
 */
interface AccountModalState {
  addModalOpen: boolean;
  openAddCookieModal: () => void;
  closeAddCookieModal: () => void;
}

export const useAccountModalStore = create<AccountModalState>((set) => ({
  addModalOpen: false,
  openAddCookieModal: () => set({ addModalOpen: true }),
  closeAddCookieModal: () => set({ addModalOpen: false }),
}));
