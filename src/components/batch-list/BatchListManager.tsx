import {
  Button,
  Card,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
  Empty,
  Popconfirm,
  App,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  CopyOutlined,
  DownloadOutlined,
  ClockCircleOutlined,
  ExportOutlined,
  ImportOutlined,
} from '@ant-design/icons';
import React, { useState, useRef } from 'react';
import { useBatchListStore } from '../../stores/batch-list';
import { BatchList } from '../../interfaces/BatchList';
import { BatchListEditor } from './BatchListEditor';
import { BatchListProgress } from './BatchListProgress';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useSettingsStore } from '../../stores/settings';
import { save } from '@tauri-apps/api/dialog';
import { writeTextFile } from '@tauri-apps/api/fs';
import { dataDir, join } from '@tauri-apps/api/path';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

/** 媒体类型语义胶囊样式（深/浅色自适应） */
const mediaTypeMeta = (
  type: string,
  isDark: boolean,
): { label: string; bg: string; color: string } => {
  const map: Record<
    string,
    { label: string; light: [string, string]; dark: [string, string] }
  > = {
    photo: {
      label: '图片',
      light: ['#e6f6ec', '#1a7f37'],
      dark: ['rgba(63,185,80,0.16)', '#57d787'],
    },
    video: {
      label: '视频',
      light: ['#f3ecfe', '#7c3aed'],
      dark: ['rgba(147,95,255,0.18)', '#b690ff'],
    },
    gif: {
      label: 'GIF',
      light: ['#fff4e5', '#b45309'],
      dark: ['rgba(255,159,67,0.18)', '#ffb45e'],
    },
  };
  const meta = map[type] || {
    label: type,
    light: ['#eef2f5', '#57606a'],
    dark: ['rgba(255,255,255,0.12)', '#c8c8cc'],
  };
  const [bg, color] = isDark ? meta.dark : meta.light;
  return { label: meta.label, bg, color };
};

export const BatchListManager: React.FC = () => {
  const {
    batchLists,
    deleteBatchList,
    duplicateBatchList,
    updateLastUsedTime,
    createBatchList,
    updateBatchList,
  } = useBatchListStore();

  const { message } = App.useApp();
  const importInputRef = useRef<HTMLInputElement>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingList, setEditingList] = useState<BatchList | null>(null);
  const [selectedList, setSelectedList] = useState<BatchList | null>(null);
  const themeMode = useSettingsStore((state) => state.app.themeMode);
  const [systemDark, setSystemDark] = React.useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const isDark = themeMode === 'dark' || (themeMode === 'auto' && systemDark);

  const handleCreate = () => {
    setEditingList(null);
    setIsModalOpen(true);
  };

  const handleEdit = (list: BatchList) => {
    setEditingList(list);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteBatchList(id);
  };

  const handleDuplicate = (id: string) => {
    duplicateBatchList(id);
  };

  const handleDownload = (list: BatchList) => {
    if (list.accounts.length === 0) {
      return;
    }
    setSelectedList(list);
    updateLastUsedTime(list.id);
  };

  const sanitizeFilename = (name: string) =>
    name.replace(/[\\/:*?"<>|\r\n]/g, '_').trim() || 'batch-list';

  const handleExport = async (list: BatchList) => {
    const safeName = sanitizeFilename(list.name);
    const payload = {
      app: 'x-spider',
      type: 'batch-list',
      version: 1,
      list: {
        name: list.name,
        description: list.description,
        accounts: list.accounts,
        filter: list.filter,
      },
    };
    const content = JSON.stringify(payload, undefined, 2);

    try {
      const defaultPath = await join(await dataDir(), `${safeName}.json`);
      const filePath = await save({
        defaultPath,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (filePath) {
        await writeTextFile(filePath, content);
        message.success(`已导出「${list.name}」`);
        return;
      }
    } catch {
      // 非 Tauri 环境（如浏览器预览）回退到浏览器下载
    }

    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}.json`;
    a.click();
    URL.revokeObjectURL(url);
    message.success(`已导出「${list.name}」`);
  };

  const normAccounts = (raw: unknown): string[] =>
    Array.isArray(raw)
      ? (raw as string[])
          .map((a) => String(a).trim().toLowerCase())
          .filter(Boolean)
      : [];

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }

      const imported: {
        name?: string;
        description?: string;
        accounts: string[];
        filter?: Partial<BatchList['filter']>;
      }[] = [];

      if (json) {
        const rawList = Array.isArray(json)
          ? json
          : Array.isArray(json.list)
            ? json.list
            : [json];
        for (const item of rawList) {
          imported.push({
            name: String(item?.name || '').trim(),
            description: item?.description
              ? String(item.description)
              : undefined,
            accounts: normAccounts(item?.accounts),
            filter: item?.filter,
          });
        }
      } else {
        // TXT：每行为一个账户，整个文件导入为一个新列表
        imported.push({
          name:
            file.name.replace(/\.[^.]+$/, '') ||
            `导入 ${dayjs().format('MM-DD HH:mm')}`,
          accounts: normAccounts(text.split(/[\n,;]/)),
        });
      }

      let created = 0;
      for (const cfg of imported) {
        const baseName = cfg.name || `导入 ${dayjs().format('MM-DD HH:mm:ss')}`;
        const list = createBatchList(baseName, cfg.description);
        updateBatchList(list.id, {
          accounts: cfg.accounts || [],
          filter: {
            mediaTypes:
              cfg.filter?.mediaTypes && cfg.filter.mediaTypes.length > 0
                ? cfg.filter.mediaTypes
                : ['photo', 'video', 'gif'],
            source: cfg.filter?.source || 'medias',
          },
        });
        created++;
      }

      if (created > 0) {
        message.success(`成功导入 ${created} 个列表`);
      } else {
        message.info('未解析到可导入的列表');
      }
    } catch (err: any) {
      log.error('Import list failed', err);
      message.error('导入失败，文件格式不正确');
    }
  };

  const columns = [
    {
      title: '列表名称',
      dataIndex: 'name',
      key: 'name',
      width: '22%',
      render: (name: string, record: BatchList) => (
        <Space
          direction="vertical"
          size={0}
          style={{ width: '100%', minWidth: 0 }}
        >
          <Text
            strong
            style={{
              color: isDark ? '#f5f5f7' : '#1d1d1f',
              whiteSpace: 'nowrap',
            }}
            ellipsis={{ tooltip: name }}
          >
            {name}
          </Text>
          {record.description && (
            <Text
              style={{
                fontSize: 12,
                color: isDark ? '#98989d' : '#86868b',
                whiteSpace: 'nowrap',
              }}
              ellipsis={{ tooltip: record.description }}
            >
              {record.description}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '账户数量',
      dataIndex: 'accounts',
      key: 'accounts',
      width: 120,
      render: (accounts: string[], record: BatchList) => (
        <Space>
          <Tag color="blue">{accounts.length}</Tag>
          {record.lastUsedAt && (
            <ClockCircleOutlined
              style={{ color: isDark ? '#6e6e73' : '#999' }}
            />
          )}
        </Space>
      ),
    },
    {
      title: '媒体类型',
      dataIndex: 'filter',
      key: 'filter',
      width: 210,
      minWidth: 180,
      render: (filter: BatchList['filter']) => (
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'nowrap',
          }}
        >
          {filter.mediaTypes.map((type) => {
            const meta = mediaTypeMeta(type, isDark);
            return (
              <span
                key={type}
                className="px-2.5 py-0.5 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: meta.bg,
                  color: meta.color,
                  whiteSpace: 'nowrap',
                  lineHeight: 'normal',
                }}
              >
                {meta.label}
              </span>
            );
          })}
        </div>
      ),
    },
    {
      title: '下载源',
      dataIndex: 'source',
      key: 'source',
      width: 100,
      render: (source: 'medias' | 'tweets') => (
        <Tag color={source === 'medias' ? 'cyan' : 'geekblue'}>
          {source === 'medias' ? '媒体' : '帖子'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (time: number) => (
        <span style={{ color: isDark ? '#98989d' : '#86868b' }}>
          {dayjs(time).format('YYYY-MM-DD HH:mm')}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 250,
      render: (_: any, record: BatchList) => (
        <Space size="small">
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            size="small"
            onClick={() => handleDownload(record)}
          >
            下载
          </Button>
          <Button
            icon={<EditOutlined />}
            size="small"
            title="重命名 / 编辑"
            onClick={() => handleEdit(record)}
          />
          <Button
            icon={<ExportOutlined />}
            size="small"
            title="导出为 JSON"
            onClick={() => handleExport(record)}
          />
          <Button
            icon={<CopyOutlined />}
            size="small"
            title="复制"
            onClick={() => handleDuplicate(record.id)}
          />
          <Popconfirm
            title="确定删除此列表？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              danger
              icon={<DeleteOutlined />}
              size="small"
              title="删除"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div
      className="p-6"
      style={{ backgroundColor: isDark ? '#0a0a0a' : 'transparent' }}
    >
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <Title
            level={4}
            className="!mb-0"
            style={{ color: isDark ? '#f5f5f7' : '#1d1d1f' }}
          >
            批量列表管理
          </Title>
          <Space>
            <Button
              icon={<ImportOutlined />}
              onClick={() => importInputRef.current?.click()}
            >
              导入列表
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept=".json,.txt,application/json,text/plain"
              style={{ display: 'none' }}
              onChange={handleImportFile}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
            >
              创建新列表
            </Button>
          </Space>
        </div>
        <Text style={{ color: isDark ? '#98989d' : '#86868b' }}>
          管理您的批量下载列表，支持账户的增删改查，以及一键批量下载功能。
        </Text>
      </div>

      {batchLists.length === 0 ? (
        <Card
          style={{
            backgroundColor: isDark ? '#1c1c1e' : '#ffffff',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e5e5e7',
          }}
        >
          <Empty
            description="暂无批量列表"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
            >
              创建第一个列表
            </Button>
          </Empty>
        </Card>
      ) : (
        <>
          <Card
            className="mb-4"
            style={{
              backgroundColor: isDark ? '#1c1c1e' : '#ffffff',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e5e5e7',
            }}
          >
            <Table
              columns={columns}
              dataSource={batchLists}
              rowKey="id"
              pagination={false}
              size="middle"
            />
          </Card>

          {selectedList && (
            <BatchListProgress
              list={selectedList}
              onClose={() => setSelectedList(null)}
            />
          )}
        </>
      )}

      <Modal
        title={editingList ? '编辑批量列表' : '创建新列表'}
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          setEditingList(null);
        }}
        footer={null}
        width={800}
        destroyOnClose
      >
        <BatchListEditor
          list={editingList}
          onSuccess={() => {
            setIsModalOpen(false);
            setEditingList(null);
          }}
          onCancel={() => {
            setIsModalOpen(false);
            setEditingList(null);
          }}
        />
      </Modal>
    </div>
  );
};
