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
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  CopyOutlined,
  DownloadOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import React, { useState } from 'react';
import { useBatchListStore } from '../../stores/batch-list';
import { BatchList } from '../../interfaces/BatchList';
import { BatchListEditor } from './BatchListEditor';
import { BatchListProgress } from './BatchListProgress';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useSettingsStore } from '../../stores/settings';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

export const BatchListManager: React.FC = () => {
  const {
    batchLists,
    deleteBatchList,
    duplicateBatchList,
    updateLastUsedTime,
  } = useBatchListStore();

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

  const columns = [
    {
      title: '列表名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: BatchList) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ color: isDark ? '#f5f5f7' : '#1d1d1f' }}>
            {name}
          </Text>
          {record.description && (
            <Text
              style={{ fontSize: 12, color: isDark ? '#98989d' : '#86868b' }}
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
      width: 200,
      render: (filter: BatchList['filter']) => (
        <Space>
          {filter.mediaTypes.map((type) => (
            <Tag
              key={type}
              color={
                type === 'photo'
                  ? 'green'
                  : type === 'video'
                    ? 'purple'
                    : 'orange'
              }
            >
              {type === 'photo' ? '图片' : type === 'video' ? '视频' : 'GIF'}
            </Tag>
          ))}
        </Space>
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
      width: 200,
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
            onClick={() => handleEdit(record)}
          />
          <Button
            icon={<CopyOutlined />}
            size="small"
            onClick={() => handleDuplicate(record.id)}
          />
          <Popconfirm
            title="确定删除此列表？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button danger icon={<DeleteOutlined />} size="small" />
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
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            创建新列表
          </Button>
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
