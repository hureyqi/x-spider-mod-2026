import {
  Progress,
  Row,
  Col,
  Typography,
  Tag,
  Button,
  notification,
  DatePicker,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
  DownloadOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import React, { useRef, useState } from 'react';
import { useBatchListStore } from '../../stores/batch-list';
import { BatchList } from '../../interfaces/BatchList';
import { useDownloadStore } from '../../stores/download';
import { getUser } from '../../twitter/api';
import { TwitterUser } from '../../interfaces/TwitterUser';
import MediaType from '../../enums/MediaType';
import { notification as tauriNotification } from '@tauri-apps/api';
import dayjs, { Dayjs } from 'dayjs';

const { Title, Text } = Typography;

interface BatchListProgressProps {
  list: BatchList;
  onClose: () => void;
}

export const BatchListProgress: React.FC<BatchListProgressProps> = ({
  list,
}) => {
  const { createCreationTask } = useDownloadStore();
  const { updateLastUsedTime } = useBatchListStore();

  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedAccounts, setCompletedAccounts] = useState<string[]>([]);
  const [failedAccounts, setFailedAccounts] = useState<string[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(
    list.filter.dateRange
      ? [
          dayjs(list.filter.dateRange[0] * 1000),
          dayjs(list.filter.dateRange[1] * 1000),
        ]
      : null,
  );

  const isRunningRef = useRef(false);
  const isPausedRef = useRef(false);

  const addLog = (log: string) => {
    setLogs((prev) => [...prev, `[${dayjs().format('HH:mm:ss')}] ${log}`]);
  };

  const handleStartDownload = async () => {
    if (list.accounts.length === 0) {
      return;
    }

    updateLastUsedTime(list.id);

    isRunningRef.current = true;
    isPausedRef.current = false;
    setIsRunning(true);
    setIsPaused(false);

    const effectiveDateRange = dateRange
      ? ([dateRange[0].unix(), dateRange[1].unix()] as [number, number])
      : list.filter.dateRange;

    addLog(`开始批量下载，共 ${list.accounts.length} 个账户`);

    for (let i = 0; i < list.accounts.length; i++) {
      if (!isRunningRef.current) {
        addLog('下载已停止');
        break;
      }

      while (isPausedRef.current && isRunningRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      if (!isRunningRef.current) {
        addLog('下载已停止');
        break;
      }

      const account = list.accounts[i];
      setCurrentIndex(i);

      addLog(`正在处理 @${account} (${i + 1}/${list.accounts.length})`);

      try {
        const user: TwitterUser = await getUser(account);

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

        const dr = effectiveDateRange
          ? ([
              dayjs(effectiveDateRange[0] * 1000),
              dayjs(effectiveDateRange[1] * 1000),
            ] as [dayjs.Dayjs, dayjs.Dayjs])
          : undefined;

        createCreationTask(user, {
          mediaTypes,
          source: list.filter.source,
          dateRange: dr,
        });

        setCompletedAccounts((prev) => [...prev, account]);
        addLog(`✓ @${account} 任务已创建`);

        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (err: any) {
        setFailedAccounts((prev) => [...prev, account]);
        addLog(`✗ @${account} 失败: ${err.message}`);

        notification.warning({
          message: `账户 ${account} 下载失败`,
          description: err.message,
        });

        tauriNotification.sendNotification({
          title: '批量下载提醒',
          body: `@${account} 下载失败: ${err.message}`,
        });
      }
    }

    isRunningRef.current = false;
    setIsRunning(false);
    setIsPaused(false);

    addLog('批量下载完成！');
  };

  const handlePause = () => {
    if (isRunningRef.current && !isPausedRef.current) {
      isPausedRef.current = true;
      setIsPaused(true);
      addLog('暂停下载');
    }
  };

  const handleResume = () => {
    if (isRunningRef.current && isPausedRef.current) {
      isPausedRef.current = false;
      setIsPaused(false);
      addLog('继续下载');
    }
  };

  const handleStop = () => {
    if (isRunningRef.current) {
      isRunningRef.current = false;
      isPausedRef.current = false;
      setIsRunning(false);
      setIsPaused(false);
      const { creationTasks, removeCreationTask } = useDownloadStore.getState();
      for (const task of creationTasks) {
        removeCreationTask(task.id);
      }
      addLog('已停止');
    }
  };

  const handleReset = () => {
    isRunningRef.current = false;
    isPausedRef.current = false;
    setIsRunning(false);
    setIsPaused(false);
    setCurrentIndex(0);
    setCompletedAccounts([]);
    setFailedAccounts([]);
    setLogs([]);
    addLog('已重置');
  };

  const overallProgress =
    list.accounts.length > 0
      ? Math.round(
          ((completedAccounts.length + failedAccounts.length) /
            list.accounts.length) *
            100,
        )
      : 0;

  const remaining =
    list.accounts.length - completedAccounts.length - failedAccounts.length;

  return (
    <div
      style={{
        background: '#0d1117',
        borderRadius: 16,
        padding: 24,
        border: '1px solid #2d333b',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 背景装饰 */}
      <div
        style={{
          position: 'absolute',
          top: -100,
          right: -100,
          width: 300,
          height: 300,
          background:
            'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -80,
          left: -80,
          width: 200,
          height: 200,
          background:
            'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* 头部 */}
      <div style={{ position: 'relative', zIndex: 1, marginBottom: 24 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <DownloadOutlined style={{ color: '#fff', fontSize: 20 }} />
            </div>
            <div>
              <Title
                level={5}
                style={{ color: '#e6edf3', margin: 0, fontSize: 16 }}
              >
                {list.name}
              </Title>
              <Text style={{ color: '#8b949e', fontSize: 12 }}>
                共 {list.accounts.length} 个账户
              </Text>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {isRunning && !isPaused && (
              <Tag
                color="processing"
                style={{ padding: '4px 12px', borderRadius: 20 }}
              >
                <ThunderboltOutlined /> 下载中
              </Tag>
            )}
            {isPaused && (
              <Tag
                color="warning"
                style={{ padding: '4px 12px', borderRadius: 20 }}
              >
                <PauseCircleOutlined /> 已暂停
              </Tag>
            )}
            {!isRunning && !isPaused && completedAccounts.length > 0 && (
              <Tag
                color="success"
                style={{ padding: '4px 12px', borderRadius: 20 }}
              >
                <CheckCircleOutlined /> 已完成
              </Tag>
            )}
          </div>
        </div>

        {/* 媒体类型标签 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {list.filter.mediaTypes.map((type) => (
            <Tag
              key={type}
              style={{
                background:
                  type === 'photo'
                    ? 'rgba(34,197,94,0.15)'
                    : type === 'video'
                      ? 'rgba(168,85,247,0.15)'
                      : 'rgba(251,146,60,0.15)',
                color:
                  type === 'photo'
                    ? '#4ade80'
                    : type === 'video'
                      ? '#c084fc'
                      : '#fb923c',
                border: 'none',
                borderRadius: 6,
                padding: '2px 10px',
                fontSize: 12,
              }}
            >
              {type === 'photo' ? '图片' : type === 'video' ? '视频' : 'GIF'}
            </Tag>
          ))}
          <Tag
            style={{
              background: 'rgba(59,130,246,0.15)',
              color: '#60a5fa',
              border: 'none',
              borderRadius: 6,
              padding: '2px 10px',
              fontSize: 12,
            }}
          >
            {list.filter.source === 'medias' ? '媒体' : '帖子'}
          </Tag>
        </div>
      </div>

      {/* 日期范围选择器 */}
      <div style={{ position: 'relative', zIndex: 1, marginBottom: 16 }}>
        <Text
          style={{
            color: '#8b949e',
            fontSize: 12,
            display: 'block',
            marginBottom: 6,
          }}
        >
          日期范围
        </Text>
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
          popupStyle={{ zIndex: 10000 }}
        />
      </div>

      {/* 统计卡片 */}
      <Row
        gutter={[12, 12]}
        style={{ marginBottom: 20, position: 'relative', zIndex: 1 }}
      >
        <Col span={6}>
          <div
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              borderRadius: 12,
              padding: '16px 12px',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                color: 'rgba(255,255,255,0.7)',
                fontSize: 11,
                marginBottom: 4,
              }}
            >
              总进度
            </div>
            <div style={{ color: '#fff', fontSize: 28, fontWeight: 700 }}>
              {overallProgress}%
            </div>
          </div>
        </Col>
        <Col span={6}>
          <div
            style={{
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.2)',
              borderRadius: 12,
              padding: '16px 12px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                color: 'rgba(255,255,255,0.5)',
                fontSize: 11,
                marginBottom: 4,
              }}
            >
              已完成
            </div>
            <div style={{ color: '#4ade80', fontSize: 28, fontWeight: 700 }}>
              <CheckCircleOutlined style={{ marginRight: 4 }} />
              {completedAccounts.length}
            </div>
          </div>
        </Col>
        <Col span={6}>
          <div
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 12,
              padding: '16px 12px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                color: 'rgba(255,255,255,0.5)',
                fontSize: 11,
                marginBottom: 4,
              }}
            >
              失败
            </div>
            <div style={{ color: '#ef4444', fontSize: 28, fontWeight: 700 }}>
              <CloseCircleOutlined style={{ marginRight: 4 }} />
              {failedAccounts.length}
            </div>
          </div>
        </Col>
        <Col span={6}>
          <div
            style={{
              background: 'rgba(59,130,246,0.1)',
              border: '1px solid rgba(59,130,246,0.2)',
              borderRadius: 12,
              padding: '16px 12px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                color: 'rgba(255,255,255,0.5)',
                fontSize: 11,
                marginBottom: 4,
              }}
            >
              剩余
            </div>
            <div style={{ color: '#3b82f6', fontSize: 28, fontWeight: 700 }}>
              <LoadingOutlined spin={isRunning} style={{ marginRight: 4 }} />
              {remaining}
            </div>
          </div>
        </Col>
      </Row>

      {/* 进度条 */}
      <div style={{ marginBottom: 20, position: 'relative', zIndex: 1 }}>
        <Progress
          percent={overallProgress}
          strokeColor={{
            '0%': '#6366f1',
            '50%': '#8b5cf6',
            '100%': '#22d3ee',
          }}
          trailColor="#1e293b"
          strokeWidth={8}
          showInfo={false}
          style={{ marginBottom: 8 }}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#8b949e', fontSize: 12 }}>
            {isRunning && currentIndex < list.accounts.length
              ? `正在下载: @${list.accounts[currentIndex]}`
              : completedAccounts.length > 0
                ? `已完成 ${completedAccounts.length} 个账户`
                : '准备开始'}
          </Text>
          <Text style={{ color: '#8b949e', fontSize: 12 }}>
            {currentIndex + 1} / {list.accounts.length}
          </Text>
        </div>
      </div>

      {/* 控制按钮 */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          marginBottom: 20,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {!isRunning && !isPaused ? (
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={handleStartDownload}
            disabled={currentIndex >= list.accounts.length}
            style={{
              background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
              border: 'none',
              borderRadius: 8,
              padding: '6px 20px',
              height: 36,
              fontSize: 14,
            }}
          >
            {currentIndex > 0 ? '继续下载' : '开始下载'}
          </Button>
        ) : isPaused ? (
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={handleResume}
            style={{
              background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
              border: 'none',
              borderRadius: 8,
              padding: '6px 20px',
              height: 36,
              fontSize: 14,
            }}
          >
            继续下载
          </Button>
        ) : (
          <Button
            icon={<PauseCircleOutlined />}
            onClick={handlePause}
            style={{
              background: 'rgba(234,179,8,0.15)',
              borderColor: 'rgba(234,179,8,0.3)',
              color: '#eab308',
              borderRadius: 8,
              padding: '6px 20px',
              height: 36,
              fontSize: 14,
            }}
          >
            暂停
          </Button>
        )}

        <Button
          danger
          icon={<StopOutlined />}
          onClick={handleStop}
          disabled={!isRunning && !isPaused}
          style={{
            borderRadius: 8,
            padding: '6px 20px',
            height: 36,
            fontSize: 14,
          }}
        >
          停止
        </Button>

        <Button
          icon={<DownloadOutlined />}
          onClick={handleReset}
          style={{
            background: 'rgba(255,255,255,0.05)',
            borderColor: 'rgba(255,255,255,0.1)',
            color: '#8b949e',
            borderRadius: 8,
            padding: '6px 20px',
            height: 36,
            fontSize: 14,
          }}
        >
          重置
        </Button>
      </div>

      {/* 账户列表 */}
      {(completedAccounts.length > 0 || failedAccounts.length > 0) && (
        <Row
          gutter={12}
          style={{ marginBottom: 16, position: 'relative', zIndex: 1 }}
        >
          {completedAccounts.length > 0 && (
            <Col span={12}>
              <div
                style={{
                  background: 'rgba(34,197,94,0.05)',
                  border: '1px solid rgba(34,197,94,0.15)',
                  borderRadius: 10,
                  padding: 12,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 8,
                  }}
                >
                  <CheckCircleOutlined style={{ color: '#4ade80' }} />
                  <Text
                    style={{ color: '#4ade80', fontSize: 12, fontWeight: 600 }}
                  >
                    已完成 ({completedAccounts.length})
                  </Text>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {completedAccounts.map((account) => (
                    <Tag
                      key={account}
                      style={{
                        background: 'rgba(34,197,94,0.1)',
                        color: '#4ade80',
                        border: '1px solid rgba(34,197,94,0.2)',
                        borderRadius: 6,
                        padding: '2px 8px',
                        fontSize: 11,
                        margin: 0,
                      }}
                    >
                      @{account}
                    </Tag>
                  ))}
                </div>
              </div>
            </Col>
          )}
          {failedAccounts.length > 0 && (
            <Col span={12}>
              <div
                style={{
                  background: 'rgba(239,68,68,0.05)',
                  border: '1px solid rgba(239,68,68,0.15)',
                  borderRadius: 10,
                  padding: 12,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 8,
                  }}
                >
                  <CloseCircleOutlined style={{ color: '#ef4444' }} />
                  <Text
                    style={{ color: '#ef4444', fontSize: 12, fontWeight: 600 }}
                  >
                    失败 ({failedAccounts.length})
                  </Text>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {failedAccounts.map((account) => (
                    <Tag
                      key={account}
                      style={{
                        background: 'rgba(239,68,68,0.1)',
                        color: '#ef4444',
                        border: '1px solid rgba(239,68,68,0.2)',
                        borderRadius: 6,
                        padding: '2px 8px',
                        fontSize: 11,
                        margin: 0,
                      }}
                    >
                      @{account}
                    </Tag>
                  ))}
                </div>
              </div>
            </Col>
          )}
        </Row>
      )}

      {/* 日志面板 */}
      <div
        style={{
          background: '#0a0f1a',
          border: '1px solid #1e293b',
          borderRadius: 10,
          overflow: 'hidden',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div
          style={{
            padding: '10px 14px',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#22c55e',
              }}
            />
            <Text style={{ color: '#e6edf3', fontSize: 12, fontWeight: 600 }}>
              下载日志
            </Text>
          </div>
          <Button
            size="small"
            type="text"
            onClick={() => setLogs([])}
            style={{
              color: '#6b7280',
              fontSize: 11,
              height: 24,
              padding: '0 8px',
            }}
          >
            清空
          </Button>
        </div>
        <div
          style={{
            height: 140,
            overflowY: 'auto',
            padding: '10px 14px',
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: 12,
            lineHeight: '1.6',
          }}
        >
          {logs.length === 0 ? (
            <div
              style={{ color: '#4b5563', textAlign: 'center', paddingTop: 40 }}
            >
              <ClockCircleOutlined
                style={{
                  fontSize: 20,
                  marginBottom: 8,
                  display: 'block',
                  opacity: 0.5,
                }}
              />
              暂无日志记录
            </div>
          ) : (
            logs.map((log, index) => {
              const isSuccess = log.includes('✓') || log.includes('完成');
              const isError =
                log.includes('✗') ||
                log.includes('失败') ||
                log.includes('停止');
              const color = isSuccess
                ? '#4ade80'
                : isError
                  ? '#ef4444'
                  : '#8b949e';
              return (
                <div key={index} style={{ color, marginBottom: 2 }}>
                  {log}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
