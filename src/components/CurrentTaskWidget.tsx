import React from 'react';
import {
  PauseOutlined,
  CaretRightOutlined,
  CloseOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { useBatchListStore } from '../stores/batch-list';
import { useRouteStore } from '../stores/route';
import { ROUTES } from '../constants/routes';
import { useDownloadStore } from '../stores/download';

interface CurrentTaskWidgetProps {
  isDark: boolean;
}

/**
 * 侧边栏「当前任务」小工具：
 * - 无任务运行时完全隐藏，不占视觉注意力。
 * - 有任务进行中时，展示迷你进度卡片，支持暂停/取消，点击跳转下载管理。
 */
export const CurrentTaskWidget: React.FC<CurrentTaskWidgetProps> = ({
  isDark,
}) => {
  const progress = useBatchListStore((s) => s.batchDownloadProgress);
  const batchLists = useBatchListStore((s) => s.batchLists);
  const controlBatchRun = useBatchListStore((s) => s.controlBatchRun);
  const setBatchDownloadProgress = useBatchListStore(
    (s) => s.setBatchDownloadProgress,
  );
  const updateBatchDownloadProgress = useBatchListStore(
    (s) => s.updateBatchDownloadProgress,
  );
  const setRoute = useRouteStore((s) => s.setRoute);

  if (!progress) return null;
  if (!progress.isRunning && !progress.isPaused) return null;

  const list = batchLists.find((l) => l.id === progress.listId);
  const total = progress.totalAccounts || 1;
  const done =
    progress.completedAccounts.length + progress.failedAccounts.length;
  const percent = Math.min(100, Math.round((done / total) * 100));
  const paused = progress.isPaused;
  const name = list?.name || '批量下载';

  const cardBg = isDark ? '#1c1c1e' : '#f5f5f7';
  const cardBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
  const textColor = isDark ? '#f5f5f7' : '#1d1d1f';
  const subColor = isDark ? '#98989d' : '#86868b';
  const railColor = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)';
  const fillColor = paused
    ? isDark
      ? '#eab308'
      : '#d97706'
    : isDark
      ? '#4da3f7'
      : '#1d9bf0';

  const goToDownloads = () => {
    const route = ROUTES.find((r) => r.id === 'download-management');
    if (route) setRoute(route);
  };

  const handlePauseResume = (e: React.MouseEvent) => {
    e.stopPropagation();
    controlBatchRun({ paused: !paused });
    updateBatchDownloadProgress({ isPaused: !paused });
  };

  const handleStop = (e: React.MouseEvent) => {
    e.stopPropagation();
    controlBatchRun({ running: false, paused: false });
    const { creationTasks, removeCreationTask } = useDownloadStore.getState();
    for (const task of creationTasks) {
      removeCreationTask(task.id);
    }
    setBatchDownloadProgress(null);
  };

  const iconBtnStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  };

  return (
    <button
      type="button"
      onClick={goToDownloads}
      title="查看下载管理"
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        borderRadius: 12,
        padding: '10px 12px',
        backgroundColor: cardBg,
        border: `1px solid ${cardBorder}`,
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            minWidth: 0,
          }}
        >
          {paused ? (
            <PauseOutlined style={{ color: subColor, fontSize: 12 }} />
          ) : (
            <LoadingOutlined spin style={{ color: fillColor, fontSize: 12 }} />
          )}
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: textColor,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {name}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button
            type="button"
            onClick={handlePauseResume}
            title={paused ? '继续' : '暂停'}
            style={iconBtnStyle}
          >
            {paused ? (
              <CaretRightOutlined style={{ color: subColor, fontSize: 12 }} />
            ) : (
              <PauseOutlined style={{ color: subColor, fontSize: 12 }} />
            )}
          </button>
          <button
            type="button"
            onClick={handleStop}
            title="取消并停止"
            style={iconBtnStyle}
          >
            <CloseOutlined style={{ color: subColor, fontSize: 12 }} />
          </button>
        </div>
      </div>

      <div
        style={{
          marginTop: 8,
          height: 6,
          borderRadius: 3,
          backgroundColor: railColor,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${percent}%`,
            borderRadius: 3,
            background: fillColor,
            transition: 'width 0.25s ease',
          }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 6,
        }}
      >
        <span style={{ fontSize: 11, color: subColor }}>
          {paused ? '已暂停' : `${done}/${total} 个账户`}
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: textColor }}>
          {percent}%
        </span>
      </div>
    </button>
  );
};
