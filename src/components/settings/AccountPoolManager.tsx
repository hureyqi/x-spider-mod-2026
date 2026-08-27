/* eslint-disable react/prop-types */
import {
  App,
  Button,
  Empty,
  List,
  Popconfirm,
  Space,
  Tag,
  Typography,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  UserSwitchOutlined,
  EditOutlined,
} from '@ant-design/icons';
import React, { useState } from 'react';
import { useAccountStore } from '../../stores/accounts';
import { useAccountModalStore } from '../../stores/account-modal';
import { getAccountInfo } from '../../twitter/api';
import { useTheme } from '../../App';

const { Text } = Typography;

/** 掩码展示单条 Cookie 首段 token，避免明文平铺 */
function maskToken(cookie: string): string {
  const first = cookie.split(';')[0].trim() || cookie;
  const idx = first.indexOf('=');
  if (idx < 0) return first.length > 12 ? `${first.slice(0, 12)}…` : first;
  const key = first.slice(0, idx).trim();
  const value = first.slice(idx + 1);
  const masked =
    value.length > 8 ? `${value.slice(0, 4)}…${value.slice(-4)}` : '••••';
  return `${key}=${masked}`;
}

/**
 * 设置页「账号与 Cookie 池」管理区：
 * 多 Cookie 列表（查看/测试有效性/删除/设为当前）+ 添加入口。
 */
export const AccountPoolManager: React.FC = () => {
  const { accounts, activeId, setActive, removeAccount, updateAccount } =
    useAccountStore();
  const { message } = App.useApp();
  const { isDark } = useTheme();
  const openAddCookieModal = useAccountModalStore((s) => s.openAddCookieModal);
  const openEditAccount = useAccountModalStore((s) => s.openEditAccount);
  const [testingId, setTestingId] = useState<string | null>(null);

  const textColor = isDark ? '#f5f5f7' : '#1d1d1f';
  const subColor = isDark ? '#98989d' : '#86868b';
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  const handleTest = async (id: string) => {
    const entry = accounts.find((a) => a.id === id);
    if (!entry) return;
    setTestingId(id);
    try {
      const info = await getAccountInfo(entry.cookie);
      updateAccount(id, { info, alias: entry.alias || info.screenName });
      message.success(
        `校验通过：${info.screenName || entry.alias}（${entry.cookie.split(';')[0].slice(0, 6)}…）`,
      );
    } catch (err: any) {
      log.error('Test account failed', err);
      message.error(`Cookie 无效或失效：${maskToken(entry.cookie)}`);
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="mb-1 flex justify-between items-center">
        <Text style={{ color: subColor, fontSize: 13 }}>
          已保存 {accounts.length} 个 Cookie / 账户，点击可设为当前使用账号
        </Text>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          size="small"
          onClick={openAddCookieModal}
        >
          添加新 Cookie / 账户
        </Button>
      </div>

      {accounts.length === 0 ? (
        <div
          className="rounded-lg py-8 text-center"
          style={{ border: `1px dashed ${borderColor}` }}
        >
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无 Cookie，点击上方「添加新 Cookie / 账户」导入"
          />
        </div>
      ) : (
        <List
          bordered
          size="small"
          dataSource={accounts}
          style={{
            borderColor,
            borderRadius: 10,
            overflow: 'hidden',
            maxHeight: 320,
            overflowY: 'auto',
          }}
          renderItem={(acc) => {
            const isActive = acc.id === activeId;
            return (
              <List.Item
                actions={[
                  isActive ? (
                    <Tag color="processing" key="active">
                      <CheckCircleOutlined /> 当前
                    </Tag>
                  ) : (
                    <Button
                      key="set"
                      type="link"
                      size="small"
                      icon={<UserSwitchOutlined />}
                      onClick={() => setActive(acc.id)}
                    >
                      设为当前
                    </Button>
                  ),
                  <Button
                    key="edit"
                    type="link"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => openEditAccount(acc)}
                  >
                    编辑
                  </Button>,
                  <Button
                    key="test"
                    type="link"
                    size="small"
                    icon={<ThunderboltOutlined />}
                    loading={testingId === acc.id}
                    onClick={() => handleTest(acc.id)}
                  >
                    测试
                  </Button>,
                  <Popconfirm
                    key="del"
                    title="确定删除该 Cookie / 账户？"
                    okText="确定"
                    cancelText="取消"
                    onConfirm={() => removeAccount(acc.id)}
                  >
                    <Button
                      danger
                      type="link"
                      size="small"
                      icon={<DeleteOutlined />}
                    />
                  </Popconfirm>,
                ]}
              >
                <div style={{ minWidth: 0 }}>
                  <Space
                    size={6}
                    style={{ display: 'flex', alignItems: 'center' }}
                  >
                    <Text strong style={{ color: textColor }}>
                      {acc.alias}
                    </Text>
                    {acc.info?.screenName &&
                      acc.info.screenName !== acc.alias && (
                        <Text style={{ color: subColor, fontSize: 12 }}>
                          @{acc.info.screenName}
                        </Text>
                      )}
                  </Space>
                  <div>
                    <Text
                      style={{ color: subColor, fontSize: 12 }}
                      className="break-all font-mono"
                    >
                      {maskToken(acc.cookie)}
                    </Text>
                  </div>
                </div>
              </List.Item>
            );
          }}
        />
      )}
    </div>
  );
};
