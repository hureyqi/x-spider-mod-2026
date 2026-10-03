import dayjs, { Dayjs } from 'dayjs';
import { useBatchListStore, syncFlowControl } from '../stores/batch-list';
import { useDownloadStore } from '../stores/download';
import { getUser } from '../twitter/api';
import MediaType from '../enums/MediaType';
import { BatchList } from '../interfaces/BatchList';

/** 一键下载全部列表的共享运行态：防止重复触发 */
export const downloadAllControl = {
  isRunning: false,
};

export interface DownloadAllResult {
  total: number;
  success: number;
  failed: number;
  failedAccounts: string[];
}

/** 侧边栏 1/2/3/4 → 日期范围：1=1天 2=3天 3=7天 4=全部(undefined) */
export function buildRangeFromSyncRange(
  range: 1 | 2 | 3 | 4,
): [Dayjs, Dayjs] | undefined {
  if (range === 4) return undefined;
  const days = range === 1 ? 1 : range === 2 ? 3 : 7;
  return [dayjs().subtract(days, 'day'), dayjs()];
}

const buildMediaTypes = (filter: BatchList['filter']): MediaType[] => {
  return filter.mediaTypes.map((type) => {
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
};

/** 并发控制暂停期间挂起，直到恢复 */
async function waitForResume() {
  while (syncFlowControl.paused) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

/**
 * 一键下载全部列表：
 * 遍历所有批量列表的全部账户，逐个 getUser → createCreationTask，
 * 日期范围取侧边栏选定的 1/2/3/4，媒体类型取各列表自身配置。
 */
export async function downloadAllBatchLists(
  onProgress?: (done: number, total: number, current: string) => void,
  onLog?: (msg: string) => void,
): Promise<DownloadAllResult> {
  const { batchLists, updateLastUsedTime } = useBatchListStore.getState();
  const { createCreationTask } = useDownloadStore.getState();
  const syncRange = useBatchListStore.getState().syncRange;
  const dr = buildRangeFromSyncRange(syncRange);

  const targets = batchLists.flatMap((list) =>
    list.accounts.map((account) => ({
      account,
      mediaTypes: buildMediaTypes(list.filter),
      source: list.filter.source,
      listId: list.id,
    })),
  );

  const result: DownloadAllResult = {
    total: targets.length,
    success: 0,
    failed: 0,
    failedAccounts: [],
  };

  const now = dayjs;
  for (let i = 0; i < targets.length; i++) {
    if (!downloadAllControl.isRunning) break;

    await waitForResume();

    const { account, mediaTypes, source, listId } = targets[i];
    onProgress?.(i, targets.length, account);
    onLog?.(
      `[${now().format('HH:mm:ss')}] 正在处理 @${account} (${i + 1}/${targets.length})`,
    );

    try {
      const user = await getUser(account);
      createCreationTask(user, {
        mediaTypes,
        source,
        dateRange: dr,
      });
      updateLastUsedTime(listId);
      result.success++;
      onLog?.(`[${now().format('HH:mm:ss')}] ✓ @${account} 任务已创建`);
    } catch (err: any) {
      result.failed++;
      result.failedAccounts.push(account);
      onLog?.(
        `[${now().format('HH:mm:ss')}] ✗ @${account} 失败: ${err?.message || err}`,
      );
    }
  }

  return result;
}
