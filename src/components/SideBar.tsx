import React from 'react';
import { notification } from 'antd';
import {
  DownloadOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { ROUTES } from '../constants/routes';
import { Route } from '../interfaces/Route';
import { useRouteStore } from '../stores/route';
import { Account } from './Account';
import { useSettingsStore } from '../stores/settings';
import { CurrentTaskWidget } from './CurrentTaskWidget';
import { useBatchListStore } from '../stores/batch-list';
import {
  downloadAllControl,
  downloadAllBatchLists,
} from '../utils/batch-download-all';
import { getSyncStatus, subscribeSyncStatus } from '../stores/download';

interface SideBarItemProps {
  route: Route;
  active: boolean;
  isDark: boolean;
}

const Item: React.FC<SideBarItemProps> = ({ route, active, isDark }) => {
  const setRoute = useRouteStore((state) => state.setRoute);
  const [hovered, setHovered] = React.useState(false);

  const baseStyle = {
    display: 'block',
    width: '100%',
    padding: '10px 16px',
    borderRadius: 10,
    transition: 'all 0.2s',
    position: 'relative' as const,
    overflow: 'hidden',
    textAlign: 'left' as const,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
  };

  const normalStyle = isDark
    ? {
        ...baseStyle,
        color: '#ffffff',
        background: 'transparent',
        border: '1px solid transparent',
      }
    : {
        ...baseStyle,
        color: '#1d1d1f',
        background: '#f5f5f7',
        border: '1px solid rgba(0, 0, 0, 0.25)',
      };

  const hoverStyle = isDark
    ? { background: 'rgba(255, 255, 255, 0.1)' }
    : { background: '#ebebeb' };

  const activeStyle = {
    ...baseStyle,
    background: 'linear-gradient(135deg, #1d9bf0 0%, #0d8ecf 100%)',
    color: '#ffffff',
    boxShadow: '0 2px 8px rgba(29, 155, 240, 0.3)',
    border: '1px solid transparent',
  };

  const currentStyle = active ? activeStyle : normalStyle;

  return (
    <li>
      <button
        aria-label={`切换到${route.name}${active ? '（当前）' : ''}`}
        style={
          hovered && !active ? { ...currentStyle, ...hoverStyle } : currentStyle
        }
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => {
          setRoute(route);
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18 }}>{route.icon}</span>
          <span>{route.name}</span>
        </div>
      </button>
    </li>
  );
};

/** 格式化阶段耗时：X 秒 / X 分 Y 秒 / X 小时 Y 分 */
function formatElapsed(startedAt: number): string {
  if (!startedAt) return '';
  const s = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  if (s < 60) return `${s} 秒`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} 分 ${s % 60} 秒`;
  return `${Math.floor(m / 60)} 小时 ${m % 60} 分`;
}

export const SideBar: React.FC = () => {
  const current = useRouteStore((state) => state.route);
  const themeMode = useSettingsStore((state) => state.app.themeMode);
  const [systemDark, setSystemDark] = React.useState(() => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const isDark = themeMode === 'dark' || (themeMode === 'auto' && systemDark);

  // ===== 一键下载全部列表（红框区）=====
  const syncRange = useBatchListStore((s) => s.syncRange);
  const setSyncRange = useBatchListStore((s) => s.setSyncRange);
  const batchLists = useBatchListStore((s) => s.batchLists);
  const [downloading, setDownloading] = React.useState(false);
  const [downloadState, setDownloadState] = React.useState<{
    done: number;
    total: number;
  } | null>(null);
  const [downloadResult, setDownloadResult] = React.useState<{
    success: number;
    failed: number;
  } | null>(null);

  // ===== 运行状态（当前在解析/下载哪个博主、已耗时）=====
  const [, setStatusTick] = React.useState(0);
  React.useEffect(() => {
    // 状态变化或每秒 tick 时刷新（用于展示「已耗时」，帮助识别长期卡住的博主）
    const unsub = subscribeSyncStatus(() => setStatusTick((t) => t + 1));
    const timer = window.setInterval(() => setStatusTick((t) => t + 1), 1000);
    return () => {
      unsub();
      window.clearInterval(timer);
    };
  }, []);
  const status = getSyncStatus();

  const hasAccounts = batchLists.some((l) => l.accounts.length > 0);

  const rangeOptions = [
    { value: 1 as const, label: '1天', tip: '同步 1 天内的内容' },
    { value: 2 as const, label: '3天', tip: '同步 3 天内的内容' },
    { value: 3 as const, label: '7天', tip: '同步 7 天内的内容' },
    { value: 4 as const, label: '全部', tip: '同步全部内容' },
  ];

  const handleDownloadAll = async () => {
    if (downloadAllControl.isRunning) return;
    downloadAllControl.isRunning = true;
    setDownloading(true);
    setDownloadState({ done: 0, total: 0 });
    setDownloadResult(null);
    try {
      const result = await downloadAllBatchLists(
        (done, total) => setDownloadState({ done, total }),
        () => {
          // 不显示详细日志，仅用于内部提示
        },
      );
      setDownloadResult({ success: result.success, failed: result.failed });
      notification.success({
        message: '一键下载全部完成',
        description:
          result.failed > 0
            ? `成功 ${result.success} 个，失败 ${result.failed} 个`
            : `成功创建 ${result.success} 个账户的下载任务`,
      });
    } catch (err: any) {
      notification.error({
        message: '一键下载全部失败',
        description: err?.message || '未知错误',
      });
    } finally {
      downloadAllControl.isRunning = false;
      setDownloading(false);
      setDownloadState(null);
    }
  };

  if (!current) return null;

  return (
    <aside
      aria-label="侧边栏"
      className="fixed top-0 left-0 h-full w-64 z-40 flex flex-col"
      style={{
        backgroundColor: isDark ? '#000000' : '#ffffff',
        borderRight: isDark
          ? '1px solid rgba(255,255,255,0.08)'
          : '1px solid rgba(0,0,0,0.1)',
        overflowY: 'auto',
      }}
    >
      <div className="min-h-full flex flex-col">
        <Account />
        <div className="px-5 py-3">
          <div
            style={{
              height: 1,
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.15)'
                : 'rgba(0,0,0,0.15)',
            }}
          />
        </div>
        <nav aria-label="页面导航">
          <ul className="space-y-1 px-3">
            {ROUTES.map((route) => (
              <Item
                key={route.id}
                route={route}
                active={current.id === route.id}
                isDark={isDark}
              />
            ))}
          </ul>
        </nav>
        {/* ===== 红框区：同步时间选择 + 一键下载全部列表（紧贴「关于」下方） ===== */}
        <div className="px-4 pt-2">
          <div
            style={{
              marginBottom: 12,
              padding: '10px 12px',
              borderRadius: 12,
              backgroundColor: isDark ? '#1c1c1e' : '#f5f5f7',
              border: `1px solid ${
                isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'
              }`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: isDark ? '#98989d' : '#86868b',
                }}
              >
                同步时间
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                gap: 6,
                marginBottom: 10,
              }}
            >
              {rangeOptions.map((opt) => {
                const selected = syncRange === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    title={opt.tip}
                    aria-pressed={selected}
                    onClick={() => setSyncRange(opt.value)}
                    style={{
                      flex: 1,
                      height: 28,
                      borderRadius: 8,
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      color: selected
                        ? '#ffffff'
                        : isDark
                          ? '#98989d'
                          : '#86868b',
                      background: selected
                        ? 'linear-gradient(135deg, #1d9bf0 0%, #0d8ecf 100%)'
                        : isDark
                          ? 'rgba(255,255,255,0.06)'
                          : 'rgba(0,0,0,0.05)',
                      transition: 'all 0.2s',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={handleDownloadAll}
              disabled={downloading || !hasAccounts}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                width: '100%',
                height: 34,
                borderRadius: 8,
                border: 'none',
                cursor: downloading || !hasAccounts ? 'not-allowed' : 'pointer',
                fontSize: 13,
                fontWeight: 600,
                color: downloading
                  ? isDark
                    ? '#0d8ecf'
                    : '#1d9bf0'
                  : '#ffffff',
                background: downloading
                  ? isDark
                    ? 'rgba(29,155,240,0.15)'
                    : 'rgba(29,155,240,0.1)'
                  : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                opacity: !hasAccounts ? 0.5 : 1,
                transition: 'all 0.2s',
              }}
            >
              {downloading ? <LoadingOutlined spin /> : <DownloadOutlined />}
              {downloading
                ? downloadState && downloadState.total > 0
                  ? `${downloadState.done}/${downloadState.total}`
                  : '同步中…'
                : '一键下载全部列表'}
            </button>
            {downloadResult && !downloading && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  marginTop: 8,
                  fontSize: 11,
                }}
              >
                <span style={{ color: '#4ade80' }}>
                  <CheckCircleOutlined /> {downloadResult.success}
                </span>
                {downloadResult.failed > 0 && (
                  <span style={{ color: '#ef4444' }}>
                    <CloseCircleOutlined /> {downloadResult.failed}
                  </span>
                )}
              </div>
            )}

            {/* ===== 运行状态：让用户知道当前在解析/下载哪个博主、持续了多久 ===== */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 10,
                padding: '6px 8px',
                borderRadius: 8,
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.05)'
                  : 'rgba(0,0,0,0.04)',
              }}
            >
              {status.phase === 'parsing' && (
                <LoadingOutlined
                  spin
                  style={{ color: '#1d9bf0', fontSize: 12 }}
                />
              )}
              {status.phase === 'downloading' && (
                <DownloadOutlined style={{ color: '#22c55e', fontSize: 12 }} />
              )}
              {status.phase === 'paused' && (
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: '#eab308',
                  }}
                />
              )}
              {status.phase === 'idle' && (
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: isDark ? '#3a3a3c' : '#d2d2d7',
                  }}
                />
              )}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: isDark ? '#d1d1d6' : '#3a3a3c',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minWidth: 0,
                }}
              >
                {status.phase === 'idle' && '空闲 · 暂无同步任务'}
                {status.phase === 'parsing' && `正在解析 @${status.handle}`}
                {status.phase === 'downloading' && `正在下载 @${status.handle}`}
                {status.phase === 'paused' && `已暂停 · ${status.label}`}
              </span>
              {status.startedAt > 0 && (
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: 11,
                    color: isDark ? '#98989d' : '#86868b',
                    flexShrink: 0,
                  }}
                >
                  已 {formatElapsed(status.startedAt)}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="p-4 mt-auto">
          <CurrentTaskWidget isDark={isDark} />
          <div
            style={{
              height: 1,
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.15)'
                : 'rgba(0,0,0,0.15)',
              marginTop: 12,
              marginBottom: 12,
            }}
          />
          <p
            style={{
              fontSize: 11,
              textAlign: 'center',
              letterSpacing: 0.3,
              color: isDark ? 'rgba(255,255,255,0.3)' : '#555555',
            }}
          >
            X-Spider v{PACKAGE_JSON_VERSION}
          </p>
        </div>
      </div>
    </aside>
  );
};
