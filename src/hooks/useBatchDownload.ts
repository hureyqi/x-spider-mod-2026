import { useCallback, useState } from 'react';
import { useBatchListStore } from '../stores/batch-list';
import { useDownloadStore } from '../stores/download';
import { TwitterUser } from '../interfaces/TwitterUser';
import MediaType from '../enums/MediaType';
import { notification } from 'antd';
import { notification as tauriNotification } from '@tauri-apps/api';
import dayjs from 'dayjs';

export interface BatchProgress {
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

export function useBatchDownload() {
  const [progress, setProgress] = useState<BatchProgress | null>(null);

  const { createCreationTask } = useDownloadStore();

  const handleBatchDownload = useCallback(
    async (listId: string, dateRangeOverride?: [number, number]) => {
      const { batchLists, updateLastUsedTime } = useBatchListStore.getState();

      const list = batchLists.find((l) => l.id === listId);
      if (!list) {
        notification.error({ message: '列表不存在' });
        return;
      }

      if (list.accounts.length === 0) {
        notification.warning({ message: '列表为空，请先添加账户' });
        return;
      }

      updateLastUsedTime(listId);

      const timestamp = new Date().toLocaleTimeString();
      setProgress({
        isRunning: true,
        isPaused: false,
        currentIndex: 0,
        currentAccount: '',
        totalAccounts: list.accounts.length,
        completedAccounts: [],
        failedAccounts: [],
        successCount: 0,
        failCount: 0,
        logs: [
          `[${timestamp}] 开始批量下载: ${list.name}`,
          `[${timestamp}] 总计 ${list.accounts.length} 个账户`,
        ],
      });

      const { getUser } = await import('../twitter/api');

      for (let i = 0; i < list.accounts.length; i++) {
        setProgress((prev) => {
          if (!prev || !prev.isRunning) return prev;
          const ts = new Date().toLocaleTimeString();
          return {
            ...prev,
            currentAccount: list.accounts[i],
            currentIndex: i,
            logs: [
              ...prev.logs,
              `[${ts}] 正在处理 @${list.accounts[i]} (${i + 1}/${list.accounts.length})`,
            ],
          };
        });

        try {
          const user: TwitterUser = await getUser(list.accounts[i]);

          const mediaTypes = list.filter.mediaTypes.map((type) => {
            switch (type) {
              case 'photo':
                return MediaType.Photo;
              case 'video':
                return MediaType.Video;
              case 'gif':
                return MediaType.Gif;
              default:
                return MediaType.Photo;
            }
          });

          const effectiveDateRange = dateRangeOverride
            ? dateRangeOverride
            : list.filter.dateRange;

          const dateRange = effectiveDateRange
            ? ([
                dayjs(effectiveDateRange[0] * 1000),
                dayjs(effectiveDateRange[1] * 1000),
              ] as [dayjs.Dayjs, dayjs.Dayjs])
            : undefined;

          createCreationTask(user, {
            mediaTypes,
            source: list.filter.source,
            dateRange,
          });

          setProgress((prev) => {
            if (!prev) return null;
            const ts = new Date().toLocaleTimeString();
            return {
              ...prev,
              completedAccounts: [...prev.completedAccounts, list.accounts[i]],
              successCount: prev.successCount + 1,
              logs: [
                ...prev.logs,
                `[${ts}] ✅ @${list.accounts[i]} 任务已创建`,
              ],
            };
          });

          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (err: any) {
          setProgress((prev) => {
            if (!prev) return null;
            const ts = new Date().toLocaleTimeString();
            return {
              ...prev,
              failedAccounts: [...prev.failedAccounts, list.accounts[i]],
              failCount: prev.failCount + 1,
              logs: [
                ...prev.logs,
                `[${ts}] ❌ @${list.accounts[i]} 失败: ${err.message}`,
              ],
            };
          });

          notification.warning({
            message: `账户 ${list.accounts[i]} 下载失败`,
            description: err.message,
          });

          tauriNotification.sendNotification({
            title: '批量下载提醒',
            body: `@${list.accounts[i]} 下载失败: ${err.message}`,
          });
        }
      }

      setProgress((prev) => {
        if (!prev) return null;
        const ts = new Date().toLocaleTimeString();
        return {
          ...prev,
          isRunning: false,
          isPaused: false,
          logs: [...prev.logs, `[${ts}] 批量下载完成！`],
        };
      });
    },
    [createCreationTask],
  );

  const pauseBatchDownload = useCallback(() => {
    setProgress((prev) => {
      if (!prev || prev.isPaused) return prev;
      const ts = new Date().toLocaleTimeString();
      return {
        ...prev,
        isPaused: true,
        logs: [...prev.logs, `[${ts}] 已暂停`],
      };
    });
  }, []);

  const resumeBatchDownload = useCallback(() => {
    setProgress((prev) => {
      if (!prev || !prev.isPaused) return prev;
      const ts = new Date().toLocaleTimeString();
      return {
        ...prev,
        isPaused: false,
        logs: [...prev.logs, `[${ts}] 继续下载`],
      };
    });
  }, []);

  const stopBatchDownload = useCallback(() => {
    const { creationTasks, removeCreationTask } = useDownloadStore.getState();
    for (const task of creationTasks) {
      removeCreationTask(task.id);
    }
    setProgress((prev) => {
      if (!prev) return null;
      const ts = new Date().toLocaleTimeString();
      return {
        ...prev,
        isRunning: false,
        isPaused: false,
        logs: [...prev.logs, `[${ts}] 已停止`],
      };
    });
  }, []);

  const clearLogs = useCallback(() => {
    setProgress((prev) => {
      if (!prev) return null;
      return { ...prev, logs: [] };
    });
  }, []);

  const resetProgress = useCallback(() => {
    setProgress(null);
  }, []);

  return {
    progress,
    handleBatchDownload,
    pauseBatchDownload,
    resumeBatchDownload,
    stopBatchDownload,
    clearLogs,
    resetProgress,
  };
}
