/* eslint-disable react/prop-types */
import {
  App,
  Button,
  Form,
  Input,
  Modal,
  Result,
  Space,
  Tabs,
  Typography,
} from 'antd';
import {
  ChromeOutlined,
  CheckCircleOutlined,
  KeyOutlined,
  LoadingOutlined,
  SafetyCertificateOutlined,
  EditOutlined,
} from '@ant-design/icons';
import React, { useEffect, useState } from 'react';
import { getAccountInfo } from '../twitter/api';
import { useAccountStore } from '../stores/accounts';
import { useAccountModalStore } from '../stores/account-modal';
import { assembleCookie, parseCookieString, validateCookie } from '../utils/cookie';
import { onAuthLoginSuccess, openAuthLoginWindow } from '../ipc/auth-login';
import { useTheme } from '../App';

export interface AddAccountModalProps {
  open: boolean;
  onClose: () => void;
}

interface ManualFormValues {
  alias?: string;
  cookie?: string;
}

type ActiveTab = 'auto' | 'manual';

/**
 * 添加 / 编辑账户弹窗，支持双模式：
 * - 「自动登录」Tab：内置浏览器打开 X 登录页，完成后自动提取凭据入库。
 * - 「手动输入」Tab：粘贴整段 Cookie，或快捷填写 auth_token / ct0 拼装校验。
 */
export const AddAccountModal: React.FC<AddAccountModalProps> = ({
  open,
  onClose,
}) => {
  const addAccount = useAccountStore((s) => s.addAccount);
  const updateAccount = useAccountStore((s) => s.updateAccount);
  const editingAccount = useAccountModalStore((s) => s.editingAccount);
  const editing = Boolean(editingAccount);

  const [form] = Form.useForm<ManualFormValues>();
  const { message } = App.useApp();
  const { isDark } = useTheme();

  const [activeTab, setActiveTab] = useState<ActiveTab>('auto');
  const [quick, setQuick] = useState<{ auth_token: string; ct0: string }>({
    auth_token: '',
    ct0: '',
  });
  const [saving, setSaving] = useState(false);
  const [loginState, setLoginState] = useState<
    'idle' | 'opening' | 'listening'
  >('idle');

  const textColor = isDark ? '#f5f5f7' : '#1d1d1f';
  const subColor = isDark ? '#98989d' : '#86868b';

  // 打开时初始化：编辑模式 → 手动 Tab 并回填；新增模式 → 默认自动 Tab
  useEffect(() => {
    if (!open) return;
    setLoginState('idle');
    if (editingAccount) {
      setActiveTab('manual');
      const parsed = parseCookieString(editingAccount.cookie);
      form.setFieldsValue({
        alias: editingAccount.alias,
        cookie: editingAccount.cookie,
      });
      setQuick({
        auth_token: parsed.auth_token ?? '',
        ct0: parsed.ct0 ?? '',
      });
    } else {
      setActiveTab('auto');
      form.resetFields();
      setQuick({ auth_token: '', ct0: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingAccount]);

  // 内置浏览器登录成功事件：校验 → 入库 → 刷新并关闭
  useEffect(() => {
    if (!open) return;
    const unlisten = onAuthLoginSuccess(async (data) => {
      message.success('登录成功，正在自动添加账户…');
      try {
        const id = addAccount(data.cookie);
        try {
          const info = await getAccountInfo(data.cookie);
          updateAccount(id, { alias: info.screenName, info });
        } catch (e) {
          log.error('Fetch login account info failed', e);
        }
        message.success('已自动添加账户并写入 Cookie 池');
        onClose();
      } catch (e: any) {
        log.error('Auto add account failed', e);
        message.error('自动添加账户失败，请手动填写 Cookie');
      }
    });
    return () => unlisten();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, addAccount, updateAccount, onClose]);

  const handleQuickChange = (key: 'auth_token' | 'ct0', value: string) => {
    const next = { ...quick, [key]: value };
    setQuick(next);
    form.setFieldValue('cookie', assembleCookie(next));
  };

  const openLogin = async () => {
    setLoginState('opening');
    try {
      await openAuthLoginWindow();
      setLoginState('listening');
      message.info('登录窗口已打开，完成登录后将自动提取并关闭窗口');
    } catch (e: any) {
      log.error('Open login window failed', e);
      message.error('打开登录窗口失败，请改用「手动输入」');
      setLoginState('idle');
    }
  };

  /** 手动模式：内部校验 cookie 并执行新增/更新 */
  const runManualSave = async (cookieRaw: string, alias?: string) => {
    const check = validateCookie(cookieRaw);
    if (!check.ok || !check.cookie) {
      message.error(check.error);
      return;
    }
    setSaving(true);
    try {
      let info;
      try {
        info = await getAccountInfo(check.cookie);
      } catch (e: any) {
        log.warn('Fetch account info failed for manual save', e);
        // 编辑模式：允许保存过期 Cookie / 仅修改备注；新增模式则视为校验失败
        if (!editingAccount) throw e;
      }
      const finalAlias =
        alias?.trim() || info?.screenName || editingAccount?.alias || '账号';
      if (editingAccount) {
        updateAccount(editingAccount.id, {
          cookie: check.cookie,
          alias: finalAlias,
          info: info ?? editingAccount.info,
        });
        message.success('已保存修改');
      } else {
        addAccount(check.cookie, { alias: finalAlias, info });
        message.success(`已校验通过并添加账户：${finalAlias}`);
      }
      form.resetFields();
      onClose();
    } catch (e: any) {
      log.error('Validate cookie failed', e);
      message.error('Cookie 校验失败：无法获取账号信息，请确认 Cookie 有效');
    } finally {
      setSaving(false);
    }
  };

  const handleManualOk = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    await runManualSave(values.cookie ?? '', values.alias);
  };

  const footer = (
    <Space>
      <Button onClick={onClose}>取消</Button>
      {activeTab === 'manual' && (
        <Button
          type="primary"
          icon={<CheckCircleOutlined />}
          loading={saving}
          onClick={handleManualOk}
        >
          {editing ? '保存修改' : '校验并保存'}
        </Button>
      )}
    </Space>
  );

  return (
    <Modal
      title={
        editing
          ? '编辑 Cookie / 账户'
          : '添加新 Cookie / 账户'
      }
      open={open}
      onCancel={onClose}
      footer={footer}
      width={560}
      destroyOnClose={false}
      maskClosable={false}
    >
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as ActiveTab)}
        items={[
          {
            key: 'auto',
            disabled: editing,
            label: (
              <span>
                <ChromeOutlined /> 自动登录（推荐）
              </span>
            ),
            children: (
              <div style={{ color: textColor }} className="pt-1">
                <div
                  className="rounded-xl mb-4 flex flex-col items-center justify-center text-center"
                  style={{
                    padding: '28px 20px',
                    border: `1px dashed ${
                      isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'
                    }`,
                  }}
                >
                  {loginState === 'idle' && (
                    <>
                      <ChromeOutlined
                        style={{ fontSize: 34, color: '#4285F4', marginBottom: 12 }}
                      />
                      <Typography.Text style={{ color: subColor }}>
                        将在内置窗口中打开 X 登录页，
                        <br />
                        完成登录后软件将自动提取凭据并关闭窗口。
                      </Typography.Text>
                      <Button
                        type="primary"
                        size="large"
                        icon={<ChromeOutlined />}
                        style={{ marginTop: 16 }}
                        onClick={openLogin}
                      >
                        打开内置浏览器登录
                      </Button>
                    </>
                  )}
                  {loginState === 'listening' && (
                    <Result
                      status="info"
                      icon={<LoadingOutlined style={{ color: '#1677ff' }} />}
                      title="等待完成登录…"
                      subTitle="请在打开的窗口中登录 X，软件会自动提取凭据并入库。"
                    />
                  )}
                </div>
                <Typography.Text style={{ color: subColor, fontSize: 12 }}>
                  <SafetyCertificateOutlined /> 凭据仅保存在本机，用于账号登录验证与
                  Cookie 轮换，不会上传到第三方。
                </Typography.Text>
              </div>
            ),
          },
          {
            key: 'manual',
            label: (
              <span>
                {editing ? <EditOutlined /> : <KeyOutlined />} 手动输入
                {editing ? '' : '（高级）'}
              </span>
            ),
            children: (
              <Form
                form={form}
                layout="vertical"
                className="mt-1"
                style={{ color: textColor }}
              >
                <Form.Item name="alias" label="账户备注 / 昵称（选填）">
                  <Input
                    placeholder="例如：账号_01 / 主号"
                    autoComplete="off"
                    disabled={saving}
                  />
                </Form.Item>

                <Form.Item
                  name="cookie"
                  label="整段 Cookie 字符串"
                  rules={[{ required: true, message: '请填写或粘贴 Cookie' }]}
                >
                  <Input.TextArea
                    rows={4}
                    placeholder={'粘贴整段 Header Cookie，例如：\nauth_token=xxx; ct0=yyy; ...'}
                    className="break-all font-mono text-xs"
                    disabled={saving}
                  />
                </Form.Item>

                <Typography.Paragraph
                  style={{ color: subColor, fontSize: 12, marginBottom: 8 }}
                >
                  或快捷填写单个字段（自动拼装为标准格式）：
                </Typography.Paragraph>
                <Space
                  direction="vertical"
                  style={{ width: '100%' }}
                  size={8}
                >
                  <Input
                    prefix={<SecurityTokenTag label="auth_token" color="#f5222d" />}
                    value={quick.auth_token}
                    onChange={(e) =>
                      handleQuickChange('auth_token', e.target.value)
                    }
                    placeholder="你的 auth_token 值"
                    className="font-mono text-xs"
                    disabled={saving}
                  />
                  <Input
                    prefix={<SecurityTokenTag label="ct0" color="#1677ff" />}
                    value={quick.ct0}
                    onChange={(e) => handleQuickChange('ct0', e.target.value)}
                    placeholder="你的 ct0 值"
                    className="font-mono text-xs"
                    disabled={saving}
                  />
                </Space>

                <Typography.Paragraph
                  style={{ color: subColor, fontSize: 12, marginTop: 12 }}
                >
                  保存前会校验是否包含必需的
                  <code className="mx-1">auth_token</code>与
                  <code className="mx-1">ct0</code>字段，并请求 X 获取账号信息。
                </Typography.Paragraph>
              </Form>
            ),
          },
        ]}
      />
    </Modal>
  );
};

/** 输入框前缀小标签 */
const SecurityTokenTag: React.FC<{ label: string; color: string }> = ({
  label,
  color,
}) => (
  <span
    style={{
      fontSize: 11,
      fontWeight: 600,
      color: '#fff',
      background: color,
      borderRadius: 4,
      padding: '1px 6px',
      marginRight: 6,
      whiteSpace: 'nowrap',
    }}
  >
    {label}
  </span>
);