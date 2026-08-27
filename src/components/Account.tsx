/* eslint-disable react/prop-types */
import { App, Avatar, Dropdown, MenuProps } from 'antd';
import {
  PlusOutlined,
  LogoutOutlined,
  SettingOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import React from 'react';
import { useAccountStore, useActiveAccount } from '../stores/accounts';
import { useAccountModalStore } from '../stores/account-modal';
import { useRouteStore } from '../stores/route';
import { ROUTES } from '../constants/routes';
import { useTheme } from '../App';

export const Account: React.FC = () => {
  const { accounts, activeId, setActive, removeAccount } = useAccountStore();
  const active = useActiveAccount();
  const setRoute = useRouteStore((s) => s.setRoute);
  const openAddCookieModal = useAccountModalStore((s) => s.openAddCookieModal);
  const { message } = App.useApp();
  const { isDark } = useTheme();

  const subColor = isDark ? '#98989d' : '#86868b';

  const menuItems: MenuProps['items'] = [
    {
      key: 'account-group',
      type: 'group',
      label: '已保存账户',
      children: accounts.length
        ? accounts.map((acc) => ({
            key: `account:${acc.id}`,
            label: (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 16,
                }}
              >
                <span>{acc.alias}</span>
                {acc.id === activeId && (
                  <CheckOutlined
                    style={{ color: 'var(--ant-color-primary)' }}
                  />
                )}
              </div>
            ),
          }))
        : [{ key: 'empty', disabled: true, label: '暂无账户' }],
    },
    { key: 'divider-1', type: 'divider' },
    {
      key: 'add',
      icon: <PlusOutlined />,
      label: '添加新 Cookie / 账户',
    },
    {
      key: 'rotation',
      icon: <SettingOutlined />,
      label: 'Cookie 轮换设置',
    },
    { key: 'divider-2', type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '登出当前账号',
      danger: true,
    },
  ];

  const handleClick: MenuProps['onClick'] = ({ key }) => {
    if (key.startsWith('account:')) {
      setActive(key.slice('account:'.length));
    } else if (key === 'add') {
      openAddCookieModal();
    } else if (key === 'rotation') {
      const route = ROUTES.find((r) => r.id === 'settings');
      if (route) setRoute(route);
    } else if (key === 'logout') {
      if (active) {
        removeAccount(active.id);
        message.success('已登出当前账号');
      }
    }
  };

  const displayName = active?.alias || active?.info?.screenName || '未命名账号';

  return (
    <>
      <div className="px-4">
        <section
          aria-label="个人信息"
          className="flex flex-col justify-center items-center py-5"
          style={{
            borderBottom: isDark
              ? '1px solid rgba(255,255,255,0.08)'
              : '1px solid rgba(0,0,0,0.06)',
          }}
        >
          {active ? (
            <Dropdown
              menu={{ items: menuItems, onClick: handleClick }}
              trigger={['click']}
              placement="bottom"
            >
              <button
                type="button"
                aria-label="切换账户 / Cookie 池管理"
                className="w-full flex flex-col items-center focus:outline-none"
              >
                <Avatar size={50} src={active.info?.avatar || undefined}>
                  {active.info?.avatar ? undefined : displayName.slice(0, 1)}
                </Avatar>
                <span
                  className="mt-1 font-bold text-sm cursor-pointer"
                  style={{ color: isDark ? '#f5f5f7' : '#1d1d1f' }}
                >
                  {displayName}
                </span>
                {active.info?.screenName &&
                  active.info.screenName !== displayName && (
                    <span className="text-xs" style={{ color: subColor }}>
                      @{active.info.screenName}
                    </span>
                  )}
              </button>
            </Dropdown>
          ) : (
            <button
              type="button"
              className="flex flex-col items-center cursor-pointer"
              onClick={openAddCookieModal}
              aria-label="添加 Cookie / 账户"
            >
              <Avatar size={50} icon={<PlusOutlined />} />
              <span className="mt-1 text-sm" style={{ color: subColor }}>
                添加 Cookie / 账户
              </span>
            </button>
          )}
        </section>
      </div>
    </>
  );
};
