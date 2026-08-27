/* eslint-disable react/prop-types */
import { App, Form, Input, Modal } from 'antd';
import React, { useState } from 'react';
import { getAccountInfo } from '../twitter/api';
import { useAccountStore } from '../stores/accounts';
import { parseCookie, stringifyCookie } from '../utils/cookie';
import { useTheme } from '../App';

export interface AddAccountModalProps {
  open: boolean;
  onClose: () => void;
}

interface FormValues {
  alias?: string;
  /** 一行或分号分隔的一条完整 Cookie */
  cookie: string;
}

/**
 * 添加账户/多 Cookie 导入弹窗。
 * 支持粘贴多条完整 Cookie（每行一条），逐条验证有效性后加入账户池。
 */
export const AddAccountModal: React.FC<AddAccountModalProps> = ({
  open,
  onClose,
}) => {
  const addAccount = useAccountStore((s) => s.addAccount);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm<FormValues>();
  const { message } = App.useApp();
  const { isDark } = useTheme();

  const onOk = async () => {
    const values = await form.validateFields();
    setLoading(true);
    const lines = values.cookie
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      message.error('请至少填写一条 Cookie');
      setLoading(false);
      return;
    }

    let okCount = 0;
    for (const line of lines) {
      try {
        const normalized = stringifyCookie(parseCookie(line));
        if (normalized.split(';')[0].startsWith('auth_token')) {
          message.error(
            'Cookie 结构不正确，请粘贴完整的 Cookie（包含 auth_token 与 ct0）',
          );
          continue;
        }
        const info = await getAccountInfo(normalized);
        addAccount(normalized, {
          alias:
            values.alias?.trim() ||
            (lines.length === 1 ? info.screenName : undefined),
          info,
        });
        okCount++;
      } catch (err) {
        log.error('Add account failed', err);
        message.error(
          `验证失败：${line.slice(0, 24)}… Cookie 或代理配置可能不正确`,
        );
      }
    }

    setLoading(false);
    if (okCount > 0) {
      message.success(`已成功添加 ${okCount} 个账户`);
      form.resetFields();
      onClose();
    }
  };

  return (
    <Modal
      title="添加新 Cookie / 账户"
      open={open}
      onOk={onOk}
      onCancel={onClose}
      confirmLoading={loading}
      okText="验证并添加"
      cancelText="取消"
    >
      <Form
        form={form}
        layout="vertical"
        className="mt-2"
        style={{ color: isDark ? '#f5f5f7' : '#1d1d1f' }}
      >
        <Form.Item
          name="alias"
          label="名称（可选）"
          tooltip="默认自动使用账号昵称"
        >
          <Input placeholder="例如：主号 / 备用号 A" autoComplete="off" />
        </Form.Item>
        <Form.Item
          name="cookie"
          label="Cookie 字符串"
          required
          rules={[{ required: true, message: '请填写 Cookie' }]}
        >
          <Input.TextArea
            rows={5}
            placeholder={
              '粘贴一条或多条完整 Cookie（每行一条），例如：\nauth_token=xxx; ct0=yyy'
            }
            className="break-all font-mono text-xs"
          />
        </Form.Item>
      </Form>
      <p
        className="text-xs mt-1"
        style={{ color: isDark ? '#98989d' : '#86868b' }}
      >
        支持一次粘贴多条 Cookie（每行一条，通常形如
        <code className="mx-1">auth_token=…; ct0=…</code>
        ），会逐条验证有效性后加入轮换池。
      </p>
    </Modal>
  );
};
