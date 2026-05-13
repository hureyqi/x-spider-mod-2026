import {
  Button,
  Space,
  Input,
  Checkbox,
  Select,
  Divider,
  Tag,
  Popconfirm,
  Card,
  Typography,
  DatePicker,
} from 'antd';
import {
  DeleteOutlined,
  PlusOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import React, { useState, useEffect } from 'react';
import { useBatchListStore } from '../../stores/batch-list';
import { BatchList } from '../../interfaces/BatchList';
import MediaType from '../../enums/MediaType';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Text } = Typography;

interface BatchListEditorProps {
  list: BatchList | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export const BatchListEditor: React.FC<BatchListEditorProps> = ({
  list,
  onSuccess,
  onCancel,
}) => {
  const { createBatchList, updateBatchList } = useBatchListStore();

  const isEditing = !!list;

  // 基础信息
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // 媒体类型
  const [mediaTypes, setMediaTypes] = useState<MediaType[]>([
    MediaType.Photo,
    MediaType.Video,
    MediaType.Gif,
  ]);

  // 下载源
  const [source, setSource] = useState<'medias' | 'tweets'>('medias');

  // 时间范围
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(
    [dayjs.unix(0), dayjs()],
  );

  const handleDateRangeChange = (dates: any) => {
    if (dates && dates[0] && dates[1]) {
      setDateRange([dates[0], dates[1]]);
    }
  };

  // 账户管理
  const [accounts, setAccounts] = useState<string[]>([]);
  const [newAccountInput, setNewAccountInput] = useState('');
  const [batchImportInput, setBatchImportInput] = useState('');

  // 初始化数据
  useEffect(() => {
    if (list) {
      setName(list.name);
      setDescription(list.description || '');
      setMediaTypes(
        list.filter.mediaTypes.map((t) => {
          switch (t) {
            case 'photo':
              return MediaType.Photo;
            case 'video':
              return MediaType.Video;
            case 'gif':
              return MediaType.Gif;
            default:
              return MediaType.Photo;
          }
        }),
      );
      setSource(list.filter.source);
      if (list.filter.dateRange) {
        setDateRange([
          dayjs(list.filter.dateRange[0] * 1000),
          dayjs(list.filter.dateRange[1] * 1000),
        ]);
      } else {
        setDateRange([dayjs.unix(0), dayjs()]);
      }
      setAccounts([...list.accounts]);
    }
  }, [list]);

  // 添加单个账户
  const handleAddSingleAccount = () => {
    const trimmed = newAccountInput.trim().toLowerCase();
    if (trimmed && !accounts.includes(trimmed)) {
      const newAccounts = [...accounts, trimmed];
      setAccounts(newAccounts);
      setNewAccountInput('');
    }
  };

  // 批量导入账户
  const handleBatchImport = () => {
    const parsedAccounts = batchImportInput
      .split(/[\n,;]/)
      .map((a) => a.trim().toLowerCase())
      .filter((a) => a && !a.startsWith('@'));

    const uniqueNewAccounts = parsedAccounts.filter(
      (a) => !accounts.includes(a),
    );
    if (uniqueNewAccounts.length > 0) {
      setAccounts([...accounts, ...uniqueNewAccounts]);
      setBatchImportInput('');
    }
  };

  // 删除单个账户
  const handleRemoveAccount = (account: string) => {
    setAccounts(accounts.filter((a) => a !== account));
  };

  // 清空所有账户
  const handleClearAccounts = () => {
    setAccounts([]);
  };

  // 保存操作
  const handleSubmit = () => {
    if (!name.trim()) {
      return;
    }

    try {
      const mediaTypeStrings = mediaTypes.map((t) => {
        switch (t) {
          case MediaType.Photo:
            return 'photo';
          case MediaType.Video:
            return 'video';
          case MediaType.Gif:
            return 'gif';
          default:
            return 'photo';
        }
      });

      if (isEditing) {
        updateBatchList(list.id, {
          name,
          description,
          filter: {
            mediaTypes: mediaTypeStrings as any,
            source,
            dateRange: dateRange
              ? [dateRange[0].unix(), dateRange[1].unix()]
              : undefined,
          },
          accounts,
        });
      } else {
        const newList = createBatchList(name, description);
        // 修复类型不匹配问题
        const store = useBatchListStore.getState();
        store.updateBatchList(newList.id, {
          filter: {
            mediaTypes: mediaTypeStrings as any,
            source,
            dateRange: dateRange
              ? [dateRange[0].unix(), dateRange[1].unix()]
              : undefined,
          },
          accounts,
        });
      }
      onSuccess();
    } catch (err) {
      // save error silently
    }
  };

  return (
    <div className="py-4 space-y-6">
      {/* 基本信息 */}
      <Card size="small" title="基本信息">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              列表名称 *
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：我的收藏"
              size="large"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              描述（可选）
            </label>
            <TextArea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="可选的列表描述..."
              rows={2}
            />
          </div>
        </div>
      </Card>

      {/* 媒体类型和下载源 */}
      <Card size="small" title="下载设置">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              媒体类型
            </label>
            <Checkbox.Group value={mediaTypes} onChange={setMediaTypes}>
              <Space direction="vertical">
                <Checkbox value={MediaType.Photo}>
                  <Tag color="green">📷 图片</Tag>
                </Checkbox>
                <Checkbox value={MediaType.Video}>
                  <Tag color="purple">🎬 视频</Tag>
                </Checkbox>
                <Checkbox value={MediaType.Gif}>
                  <Tag color="orange">🎞️ GIF</Tag>
                </Checkbox>
              </Space>
            </Checkbox.Group>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              下载源
              <Text type="secondary" className="ml-1 text-xs">
                （帖子能下载到更早的推文，但爬取速度较慢；媒体速度快但可能漏内容）
              </Text>
            </label>
            <Select
              value={source}
              onChange={setSource}
              options={[
                { label: '📱 媒体（快速）', value: 'medias' },
                { label: '📝 帖子（完整）', value: 'tweets' },
              ]}
              style={{ width: '100%' }}
              size="large"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              下载时间范围
            </label>
            <DatePicker.RangePicker
              presets={[
                {
                  label: '至今',
                  value: [dayjs.unix(0), dayjs()],
                },
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
              onChange={handleDateRangeChange}
              disabledDate={(cur) => cur && cur > dayjs().endOf('day')}
              style={{ width: '100%' }}
              size="large"
            />
          </div>
        </div>
      </Card>

      {/* 账户管理 */}
      <Card
        size="small"
        title={
          <div className="flex justify-between items-center">
            <span>账户管理 ({accounts.length} 个)</span>
            {accounts.length > 0 && (
              <Popconfirm
                title="确定清空所有账户？"
                onConfirm={handleClearAccounts}
                okText="确定"
                cancelText="取消"
              >
                <Button danger size="small" icon={<DeleteOutlined />}>
                  清空
                </Button>
              </Popconfirm>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          {/* 单个添加 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              添加单个账户
            </label>
            <Space.Compact className="w-full">
              <Input
                value={newAccountInput}
                onChange={(e) => setNewAccountInput(e.target.value)}
                placeholder="输入用户名（不含 @）"
                onPressEnter={handleAddSingleAccount}
              />
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAddSingleAccount}
              >
                添加
              </Button>
            </Space.Compact>
          </div>

          <Divider className="my-3">批量导入</Divider>

          {/* 批量导入 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              批量导入
            </label>
            <TextArea
              value={batchImportInput}
              onChange={(e) => setBatchImportInput(e.target.value)}
              placeholder="粘贴账户列表（换行、逗号、分号分隔）"
              rows={4}
              className="mb-2"
            />
            <Button
              type="default"
              icon={<UploadOutlined />}
              onClick={handleBatchImport}
              disabled={!batchImportInput.trim()}
            >
              解析并添加
            </Button>
          </div>

          <Divider className="my-3">已添加的账户</Divider>

          {/* 账户列表 */}
          <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto">
            {accounts.length === 0 ? (
              <div className="w-full text-center text-gray-400 py-8">
                暂无账户，请先添加
              </div>
            ) : (
              accounts.map((account) => (
                <Tag
                  key={account}
                  color="blue"
                  closable
                  onClose={() => handleRemoveAccount(account)}
                  className="text-sm px-3 py-1"
                >
                  @{account}
                </Tag>
              ))
            )}
          </div>
        </div>
      </Card>

      {/* 操作按钮 */}
      <div className="pt-2">
        <Space className="w-full justify-end">
          <Button onClick={onCancel} size="large">
            取消
          </Button>
          <Button
            type="primary"
            onClick={handleSubmit}
            size="large"
            disabled={!name.trim()}
          >
            {isEditing ? '保存' : '创建'}
          </Button>
        </Space>
      </div>
    </div>
  );
};
