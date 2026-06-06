/* eslint-disable react/prop-types */
import { CloseCircleFilled, LoadingOutlined } from '@ant-design/icons';
import { useMount } from 'ahooks';
import { ConfigProvider, App as AntApp, theme as antdTheme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { SideBar } from './components/SideBar';
import { useBootstrap } from './hooks/useBootstrap';
import { useRunBackgroundTasks } from './hooks/useRunBackgroundTasks';
import { useAppStateStore } from './stores/app-state';
import { useRouteStore } from './stores/route';
import { useSettingsStore } from './stores/settings';

const sharedToken = {
  colorPrimary: '#1d9bf0',
  borderRadius: 10,
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
};

const lightToken = {
  colorBgLayout: '#f0f2f5',
  colorBgContainer: '#ffffff',
  colorBgElevated: '#ffffff',
  colorText: '#1d1d1f',
  colorTextSecondary: '#86868b',
  colorTextTertiary: '#aeaeb2',
  colorBorder: '#e5e5e7',
  colorBorderSecondary: '#f0f0f0',
  colorFill: 'rgba(0, 0, 0, 0.04)',
  colorFillSecondary: 'rgba(0, 0, 0, 0.02)',
  colorBgSpotlight: 'rgba(0, 0, 0, 0.85)',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)',
  boxShadowSecondary:
    '0 4px 12px rgba(0, 0, 0, 0.06), 0 2px 6px rgba(0, 0, 0, 0.04)',
};

const darkToken = {
  colorBgLayout: '#0a0a0a',
  colorBgContainer: '#1c1c1e',
  colorBgElevated: '#2c2c2e',
  colorText: '#f5f5f7',
  colorTextSecondary: '#98989d',
  colorTextTertiary: '#6e6e73',
  colorBorder: '#38383a',
  colorBorderSecondary: '#2c2c2e',
  colorFill: 'rgba(255, 255, 255, 0.08)',
  colorFillSecondary: 'rgba(255, 255, 255, 0.04)',
  colorBgSpotlight: 'rgba(255, 255, 255, 0.15)',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2)',
  boxShadowSecondary:
    '0 4px 12px rgba(0, 0, 0, 0.4), 0 2px 6px rgba(0, 0, 0, 0.3)',
};

interface ThemeContextType {
  isDark: boolean;
  token: typeof lightToken;
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: false,
  token: lightToken,
});

export const useTheme = () => useContext(ThemeContext);

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
    <div
      className="w-full h-full overflow-hidden"
      style={{ backgroundColor: 'var(--ant-color-bg-layout)' }}
    >
      <SideBar />
      <main
        className="ml-64 h-full overflow-auto"
        key={currentRoute?.id}
        aria-label={currentRoute?.name}
        style={{ backgroundColor: 'var(--ant-color-bg-layout)' }}
      >
        <div className="px-8 py-6">{currentRoute?.element}</div>
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  const { ready, error } = useBootstrap();
  const themeMode = useSettingsStore((state) => state.app.themeMode);
  const [isSystemDark, setIsSystemDark] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setIsSystemDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const isDark = themeMode === 'dark' || (themeMode === 'auto' && isSystemDark);

  const tokens = isDark ? darkToken : lightToken;

  const themeConfig = useMemo(
    () => ({
      token: {
        ...sharedToken,
        ...tokens,
      },
      components: {
        Card: {
          colorBgContainer: tokens.colorBgContainer,
          colorBorderSecondary: tokens.colorBorder,
        },
        Button: {
          colorBgContainer: tokens.colorBgContainer,
        },
        Input: {
          colorBgContainer: tokens.colorBgContainer,
        },
        Switch: {
          colorBgContainer: tokens.colorBgContainer,
        },
      },
      algorithm: isDark ? antdTheme.darkAlgorithm : undefined,
      cssVar: true,
      hashed: false,
    }),
    [isDark, tokens],
  );

  return (
    <ThemeContext.Provider value={{ isDark, token: tokens }}>
      <ConfigProvider
        theme={themeConfig}
        autoInsertSpaceInButton={false}
        locale={zhCN}
      >
        <AntApp>
          <div
            className="css-var-r0 select-none relative w-screen h-screen flex flex-col overflow-hidden"
            style={{
              backgroundColor: 'var(--ant-color-bg-layout)',
              color: 'var(--ant-color-text)',
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
            }}
          >
            {!ready && (
              <div
                className="w-screen h-screen flex flex-col items-center justify-center"
                style={{ backgroundColor: 'var(--ant-color-bg-layout)' }}
              >
                {!error && (
                  <>
                    <LoadingOutlined
                      className="text-5xl"
                      style={{ color: 'var(--ant-color-primary)' }}
                    />
                    <p
                      className="mt-4 text-xl"
                      style={{ color: 'var(--ant-color-text)' }}
                    >
                      应用启动中，请稍候...
                    </p>
                  </>
                )}
                {error && (
                  <>
                    <CloseCircleFilled
                      className="text-5xl"
                      style={{ color: 'var(--ant-color-error)' }}
                    />
                    <p
                      className="mt-4 text-xl"
                      style={{ color: 'var(--ant-color-text)' }}
                    >
                      应用启动失败，请尝试重启应用
                    </p>
                    <p
                      className="mt-2"
                      style={{ color: 'var(--ant-color-text-secondary)' }}
                    >
                      {error || '未知错误'}
                    </p>
                  </>
                )}
              </div>
            )}
            {ready && <AppInternal />}
          </div>
        </AntApp>
      </ConfigProvider>
    </ThemeContext.Provider>
  );
};
