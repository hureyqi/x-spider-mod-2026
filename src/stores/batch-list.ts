import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import { createTauriFileStorage } from './persist/tauri-file-storage';
import { BatchList, BatchDownloadTask } from '../interfaces/BatchList';

export interface BatchDownloadProgress {
  isRunning: boolean;
  isPaused: boolean;
  currentIndex: number;
  currentAccount: string;
  totalAccounts: number;
  completedAccounts: string[];
  failedAccounts: string[];
  successCount: number;
  failCount: number;
  logs: string[];
}

export interface BatchListStore {
  batchLists: BatchList[];
  currentBatchListId: string | null;
  batchDownloadTask: BatchDownloadTask | null;
  batchDownloadProgress: BatchDownloadProgress | null;
  
  createBatchList: (name: string, description?: string) => BatchList;
  updateBatchList: (id: string, updates: Partial<BatchList>) => void;
  deleteBatchList: (id: string) => void;
  duplicateBatchList: (id: string) => BatchList;
  
  addAccountsToList: (listId: string, accounts: string[]) => void;
  removeAccountFromList: (listId: string, account: string) => void;
  updateAccountInList: (listId: string, oldAccount: string, newAccount: string) => void;
  clearAccountsFromList: (listId: string) => void;
  importAccountsToList: (listId: string, accounts: string[]) => void;
  
  setCurrentBatchList: (listId: string | null) => void;
  getCurrentBatchList: () => BatchList | null;
  
  setBatchDownloadTask: (task: BatchDownloadTask | null) => void;
  updateBatchDownloadTask: (updates: Partial<BatchDownloadTask>) => void;
  
  setBatchDownloadProgress: (progress: BatchDownloadProgress | null) => void;
  updateBatchDownloadProgress: (updates: Partial<BatchDownloadProgress>) => void;
  
  updateLastUsedTime: (listId: string) => void;
  getLastUsedTime: (listId: string) => number | undefined;
}

export const useBatchListStore = create<BatchListStore>()(
  persist(
    (set, get) => ({
      batchLists: [],
      currentBatchListId: null,
      batchDownloadTask: null,
      batchDownloadProgress: null,

      createBatchList: (name, description) => {
        const newList: BatchList = {
          id: nanoid(),
          name,
          description,
          accounts: [],
          filter: {
            mediaTypes: ['photo', 'video', 'gif'],
            source: 'medias',
          },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        set((state) => ({
          batchLists: [...state.batchLists, newList],
        }));

        return newList;
      },

      updateBatchList: (id, updates) => {
        set((state) => ({
          batchLists: state.batchLists.map((list) =>
            list.id === id
              ? { ...list, ...updates, updatedAt: Date.now() }
              : list
          ),
        }));
      },

      deleteBatchList: (id) => {
        set((state) => ({
          batchLists: state.batchLists.filter((list) => list.id !== id),
          currentBatchListId:
            state.currentBatchListId === id ? null : state.currentBatchListId,
        }));
      },

      duplicateBatchList: (id) => {
        const original = get().batchLists.find((list) => list.id === id);
        if (!original) throw new Error('列表不存在');

        const duplicate: BatchList = {
          ...original,
          id: nanoid(),
          name: `${original.name} (副本)`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastUsedAt: undefined,
        };

        set((state) => ({
          batchLists: [...state.batchLists, duplicate],
        }));

        return duplicate;
      },

      addAccountsToList: (listId, accounts) => {
        set((state) => ({
          batchLists: state.batchLists.map((list) =>
            list.id === listId
              ? {
                  ...list,
                  accounts: [...new Set([...list.accounts, ...accounts])],
                  updatedAt: Date.now(),
                }
              : list
          ),
        }));
      },

      removeAccountFromList: (listId, account) => {
        set((state) => ({
          batchLists: state.batchLists.map((list) =>
            list.id === listId
              ? {
                  ...list,
                  accounts: list.accounts.filter((a) => a !== account),
                  updatedAt: Date.now(),
                }
              : list
          ),
        }));
      },

      updateAccountInList: (listId, oldAccount, newAccount) => {
        set((state) => ({
          batchLists: state.batchLists.map((list) =>
            list.id === listId
              ? {
                  ...list,
                  accounts: list.accounts.map((a) =>
                    a === oldAccount ? newAccount : a
                  ),
                  updatedAt: Date.now(),
                }
              : list
          ),
        }));
      },

      clearAccountsFromList: (listId) => {
        set((state) => ({
          batchLists: state.batchLists.map((list) =>
            list.id === listId
              ? { ...list, accounts: [], updatedAt: Date.now() }
              : list
          ),
        }));
      },

      importAccountsToList: (listId, accounts) => {
        const cleanedAccounts = accounts
          .map((a) => a.trim().toLowerCase())
          .filter((a) => a.length > 0);

        set((state) => ({
          batchLists: state.batchLists.map((list) =>
            list.id === listId
              ? {
                  ...list,
                  accounts: [...new Set([...list.accounts, ...cleanedAccounts])],
                  updatedAt: Date.now(),
                }
              : list
          ),
        }));
      },

      setCurrentBatchList: (listId) => {
        set({ currentBatchListId: listId });
      },

      getCurrentBatchList: () => {
        const state = get();
        return (
          state.batchLists.find((list) => list.id === state.currentBatchListId) ||
          null
        );
      },

      setBatchDownloadTask: (task) => {
        set({ batchDownloadTask: task });
      },

      updateBatchDownloadTask: (updates) => {
        set((state) => ({
          batchDownloadTask: state.batchDownloadTask
            ? { ...state.batchDownloadTask, ...updates }
            : null,
        }));
      },

      setBatchDownloadProgress: (progress) => {
        set({ batchDownloadProgress: progress });
      },

      updateBatchDownloadProgress: (updates) => {
        set((state) => ({
          batchDownloadProgress: state.batchDownloadProgress
            ? { ...state.batchDownloadProgress, ...updates }
            : null,
        }));
      },

      updateLastUsedTime: (listId) => {
        set((state) => ({
          batchLists: state.batchLists.map((list) =>
            list.id === listId
              ? { ...list, lastUsedAt: Date.now() }
              : list
          ),
        }));
      },

      getLastUsedTime: (listId) => {
        const list = get().batchLists.find((l) => l.id === listId);
        return list?.lastUsedAt;
      },
    }),
    {
      name: 'batch-lists',
      storage: createTauriFileStorage(),
      version: 1,
    }
  )
);
