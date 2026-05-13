import {
  Button,
  Card,
  Typography,
  Tag,
  Progress,
  Badge,
  DatePicker,
} from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import React, { useState } from 'react';
import { BatchList } from '../../interfaces/BatchList';
import dayjs, { Dayjs } from 'dayjs';
import { useBatchDownload } from '../../hooks/useBatchDownload';

const { Text } = Typography;

interface BatchDownloadPanelProps {
  list: BatchList;
}

export const BatchDownloadPanel: React.FC<BatchDownloadPanelProps> = ({
  list,
}) => {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(
    list.filter.dateRange
      ? [
          dayjs(list.filter.dateRange[0] * 1000),
          dayjs(list.filter.dateRange[1] * 1000),
        ]
      : null,
  );
  const {
    progress,
    handleBatchDownload,
    pauseBatchDownload,
    stopBatchDownload,
    clearLogs,
    resetProgress,
  } = useBatchDownload();

  const hasProgress = progress !== null;
  const isRunning = progress?.isRunning || false;
  const isPaused = progress?.isPaused || false;
  const completedAccounts = progress?.completedAccounts || [];
  const failedAccounts = progress?.failedAccounts || [];
  const logs = progress?.logs || [];
  const currentAccount = progress?.currentAccount || '';
  const currentIndex = progress?.currentIndex || 0;

  const overallProgress =
    list.accounts.length > 0
      ? Math.round(
          ((completedAccounts.length + failedAccounts.length) /
            list.accounts.length) *
            100,
        )
      : 0;

  const handleStart = () => {
    const dr = dateRange
      ? ([dateRange[0].unix(), dateRange[1].unix()] as [number, number])
      : undefined;
    handleBatchDownload(list.id, dr);
  };

  const handleReset = () => {
    resetProgress();
  };

  return (
    <Card
      className="shadow-2xl border-0 overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
      bodyStyle={{ padding: 0 }}
    >
      <div className="bg-black/20 backdrop-blur-sm px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <span className="text-2xl">🎯</span>
            </div>
            <div>
              <Text className="text-xl font-bold text-white block">
                {list.name}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.8)' }}>
                {list.accounts.length} 个账户 · {list.filter.mediaTypes.length}{' '}
                种媒体
              </Text>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {list.lastUsedAt && (
              <Tag
                icon={<ClockCircleOutlined />}
                className="bg-white/10 border-white/20 text-white"
              >
                {dayjs(list.lastUsedAt).fromNow()}
              </Tag>
            )}
            <Badge
              status={
                isRunning ? 'processing' : isPaused ? 'warning' : 'default'
              }
              text={
                <span className="text-white text-sm font-medium">
                  {isRunning ? '下载中' : isPaused ? '已暂停' : '就绪'}
                </span>
              }
            />
          </div>
        </div>
      </div>

      <div className="px-6 py-5 bg-white/10 backdrop-blur-sm">
        <div className="mb-4">
          <label className="block text-sm font-medium text-white/90 mb-2">
            日期范围
          </label>
          <DatePicker.RangePicker
            presets={[
              { label: '至今', value: [dayjs.unix(0), dayjs()] },
              {
                label: '最近 7 天',
                value: [dayjs().subtract(7, 'day'), dayjs()],
              },
              {
                label: '最近 15 天',
                value: [dayjs().subtract(15, 'day'), dayjs()],
              },
              {
                label: '最近 1 个月',
                value: [dayjs().subtract(1, 'month'), dayjs()],
              },
              {
                label: '最近 6 个月',
                value: [dayjs().subtract(6, 'month'), dayjs()],
              },
              {
                label: '最近 1 年',
                value: [dayjs().subtract(1, 'year'), dayjs()],
              },
            ]}
            value={dateRange}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setDateRange([dates[0], dates[1]]);
              } else {
                setDateRange(null);
              }
            }}
            disabledDate={(cur) => cur && cur > dayjs().endOf('day')}
            style={{ width: '100%' }}
            size="large"
            className="bg-white/20 border-white/30"
          />
        </div>

        <div className="mb-4">
          <div className="flex justify-between items-end mb-2">
            <Text className="text-white/90 font-medium">总体进度</Text>
            <Text className="text-white/70">{overallProgress}%</Text>
          </div>
          <Progress
            percent={overallProgress}
            showInfo={false}
            strokeColor={{
              '0%': '#10b981',
              '100%': '#3b82f6',
            }}
            trailColor="rgba(255,255,255,0.2)"
          />
        </div>

        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-white">
              {list.accounts.length}
            </div>
            <div className="text-xs text-white/70">总账户</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-400">
              <CheckCircleOutlined /> {completedAccounts.length}
            </div>
            <div className="text-xs text-white/70">已完成</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-red-400">
              <CloseCircleOutlined /> {failedAccounts.length}
            </div>
            <div className="text-xs text-white/70">失败</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-400">
              {list.accounts.length -
                completedAccounts.length -
                failedAccounts.length}
            </div>
            <div className="text-xs text-white/70">剩余</div>
          </div>
        </div>

        <div className="mb-3">
          {currentAccount && (
            <div className="flex items-center gap-2 text-white/80">
              <span className="text-sm">当前:</span>
              <Tag color="yellow" className="text-sm">
                @{currentAccount}
              </Tag>
              <span className="text-sm">
                ({currentIndex + 1}/{list.accounts.length})
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          {!isRunning ? (
            <>
              <Button
                type="primary"
                size="large"
                icon={<PlayCircleOutlined />}
                onClick={handleStart}
                className="flex-1 bg-green-500 hover:bg-green-600 border-0 h-12 text-lg font-medium shadow-lg"
              >
                {isPaused ? '继续下载' : '开始下载'}
              </Button>
              {hasProgress && (
                <Button
                  size="large"
                  icon={<ReloadOutlined />}
                  onClick={handleReset}
                  className="h-12 text-lg font-medium"
                >
                  重置
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                size="large"
                icon={<PauseCircleOutlined />}
                onClick={pauseBatchDownload}
                className="flex-1 bg-yellow-500 hover:bg-yellow-600 border-0 h-12 text-lg font-medium text-white shadow-lg"
              >
                暂停
              </Button>
              <Button
                size="large"
                danger
                icon={<StopOutlined />}
                onClick={stopBatchDownload}
                className="h-12 text-lg font-medium shadow-lg"
              >
                停止
              </Button>
            </>
          )}
        </div>
      </div>

      {logs.length > 0 && (
        <div className="px-6 py-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="flex justify-between items-center mb-3">
            <Text strong className="text-white">
              📋 下载日志 ({logs.length})
            </Text>
            <Button
              size="small"
              type="text"
              icon={<ReloadOutlined />}
              onClick={clearLogs}
              className="text-white/60"
            >
              清空
            </Button>
          </div>
          <div className="bg-black/30 rounded-lg p-4 h-48 overflow-y-auto font-mono text-sm space-y-1">
            {logs.map((log, index) => (
              <div
                key={index}
                className={`${
                  log.includes('✅')
                    ? 'text-green-400'
                    : log.includes('❌')
                      ? 'text-red-400'
                      : log.includes('⏸')
                        ? 'text-yellow-400'
                        : log.includes('⏹')
                          ? 'text-gray-400'
                          : 'text-white/80'
                }`}
              >
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-6 py-4 bg-black/20">
        <div className="flex gap-4">
          {completedAccounts.length > 0 && (
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircleOutlined className="text-green-400" />
                <Text strong className="text-white text-sm">
                  已完成
                </Text>
                <Tag className="ml-auto bg-green-500/20 border-green-500/30 text-green-300">
                  {completedAccounts.length}
                </Tag>
              </div>
              <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                {completedAccounts.map((account) => (
                  <Tag key={account} color="success" className="text-xs">
                    @{account}
                  </Tag>
                ))}
              </div>
            </div>
          )}

          {failedAccounts.length > 0 && (
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <CloseCircleOutlined className="text-red-400" />
                <Text strong className="text-white text-sm">
                  失败
                </Text>
                <Tag className="ml-auto bg-red-500/20 border-red-500/30 text-red-300">
                  {failedAccounts.length}
                </Tag>
              </div>
              <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                {failedAccounts.map((account) => (
                  <Tag key={account} color="error" className="text-xs">
                    @{account}
                  </Tag>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
