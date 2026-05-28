/* eslint-disable react/prop-types */
import { CloseCircleFilled, LoadingOutlined } from '@ant-design/icons';
import { useMount } from 'ahooks';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import React, { useEffect, useState } from 'react';
import { SideBar } from './components/SideBar';
import { ANTD_THEME_DARK, ANTD_THEME_LIGHT } from './constants/themes';
import { useBootstrap } from './hooks/useBootstrap';
import { useRunBackgroundTasks } from './hooks/useRunBackgroundTasks';
import { useAppStateStore } from './stores/app-state';
import { useRouteStore } from './stores/route';
import { useSettingsStore } from './stores/settings';

const AppInternal: React.FC = () => {
  const currentRoute = useRouteStore((state) => state.route);

  useMount(() => {
    log.info('Settings', useSettingsStore.getState());
    const appState = useAppStateStore.getState();
    log.info('AppStates', {
      ...appState,
      cookieString: appState.cookieString ? '******' : '[empty]',
    });
  });

  useRunBackgroundTasks();

  return (
    <div className="bg-gray-50 w-full h-full overflow-hidden">
      <SideBar />
      <main
        className="ml-64 h-full overflow-auto bg-gray-50"
        key={currentRoute?.id}
        aria-label={currentRoute?.name}
      >
        <div className="px-8 py-6">{currentRoute?.element}</div>
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  const { ready, error } = useBootstrap();
  const [themeConfig, setThemeConfig] = useState(ANTD_THEME_LIGHT);

  useEffect(() => {
    const settings = useSettingsStore.getState();
    const themeMode = settings.app.themeMode;

    if (themeMode === 'dark') {
      setThemeConfig(ANTD_THEME_DARK);
    } else if (themeMode === 'light') {
      setThemeConfig(ANTD_THEME_LIGHT);
    } else {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleSystemThemeChange = (e: MediaQueryListEvent) => {
        setThemeConfig(e.matches ? ANTD_THEME_DARK : ANTD_THEME_LIGHT);
      };

      setThemeConfig(mediaQuery.matches ? ANTD_THEME_DARK : ANTD_THEME_LIGHT);
      mediaQuery.addEventListener('change', handleSystemThemeChange);

      return () => {
        mediaQuery.removeEventListener('change', handleSystemThemeChange);
      };
    }
  }, []);

  useEffect(() => {
    const unsubscribe = useSettingsStore.subscribe((state) => {
      const themeMode = state.app.themeMode;

      if (themeMode === 'dark') {
        setThemeConfig(ANTD_THEME_DARK);
      } else if (themeMode === 'light') {
        setThemeConfig(ANTD_THEME_LIGHT);
      } else {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        setThemeConfig(mediaQuery.matches ? ANTD_THEME_DARK : ANTD_THEME_LIGHT);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <ConfigProvider
      theme={themeConfig}
      autoInsertSpaceInButton={false}
      locale={zhCN}
    >
      <AntApp>
        <div className="css-var-r0 select-none text-gray-800 relative w-screen h-screen flex flex-col overflow-hidden">
          {!ready && (
            <div className="w-screen h-screen flex flex-col items-center justify-center">
              {!error && (
                <>
                  <LoadingOutlined className="text-5xl text-ant-color-primary" />
                  <p className="mt-4 text-xl">应用启动中，请稍候...</p>
                </>
              )}
              {error && (
                <>
                  <CloseCircleFilled className="text-5xl text-ant-color-error" />
                  <p className="mt-4 text-xl">应用启动失败，请尝试重启应用</p>
                  <p className="text-gray-600 mt-2">{error || '未知错误'}</p>
                </>
              )}
            </div>
          )}
          {ready && <AppInternal />}
        </div>
      </AntApp>
    </ConfigProvider>
  );
};
