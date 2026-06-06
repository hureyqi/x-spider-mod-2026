import React from 'react';
import { ROUTES } from '../constants/routes';
import { Route } from '../interfaces/Route';
import { useRouteStore } from '../stores/route';
import { Account } from './Account';
import { useSettingsStore } from '../stores/settings';

interface SideBarItemProps {
  route: Route;
  active: boolean;
  isDark: boolean;
}

const Item: React.FC<SideBarItemProps> = ({ route, active, isDark }) => {
  const setRoute = useRouteStore((state) => state.setRoute);
  const [hovered, setHovered] = React.useState(false);

  const baseStyle = {
    display: 'block',
    width: '100%',
    padding: '10px 16px',
    borderRadius: 10,
    transition: 'all 0.2s',
    position: 'relative' as const,
    overflow: 'hidden',
    textAlign: 'left' as const,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
  };

  const normalStyle = isDark
    ? {
        ...baseStyle,
        color: '#ffffff',
        background: 'transparent',
        border: '1px solid transparent',
      }
    : {
        ...baseStyle,
        color: '#1d1d1f',
        background: '#f5f5f7',
        border: '1px solid rgba(0, 0, 0, 0.25)',
      };

  const hoverStyle = isDark
    ? { background: 'rgba(255, 255, 255, 0.1)' }
    : { background: '#ebebeb' };

  const activeStyle = {
    ...baseStyle,
    background: 'linear-gradient(135deg, #1d9bf0 0%, #0d8ecf 100%)',
    color: '#ffffff',
    boxShadow: '0 2px 8px rgba(29, 155, 240, 0.3)',
    border: '1px solid transparent',
  };

  const currentStyle = active ? activeStyle : normalStyle;

  return (
    <li>
      <button
        aria-label={`切换到${route.name}${active ? '（当前）' : ''}`}
        style={
          hovered && !active ? { ...currentStyle, ...hoverStyle } : currentStyle
        }
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => {
          setRoute(route);
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18 }}>{route.icon}</span>
          <span>{route.name}</span>
        </div>
      </button>
    </li>
  );
};

export const SideBar: React.FC = () => {
  const current = useRouteStore((state) => state.route);
  const themeMode = useSettingsStore((state) => state.app.themeMode);
  const [systemDark, setSystemDark] = React.useState(() => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const isDark = themeMode === 'dark' || (themeMode === 'auto' && systemDark);

  if (!current) return null;

  return (
    <aside
      aria-label="侧边栏"
      className="fixed top-0 left-0 h-full w-64 z-40 flex flex-col"
      style={{
        backgroundColor: isDark ? '#000000' : '#ffffff',
        borderRight: isDark
          ? '1px solid rgba(255,255,255,0.08)'
          : '1px solid rgba(0,0,0,0.1)',
      }}
    >
      <div className="h-full flex flex-col">
        <Account />
        <div className="px-5 py-3">
          <div
            style={{
              height: 1,
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.15)'
                : 'rgba(0,0,0,0.15)',
            }}
          />
        </div>
        <nav aria-label="页面导航" className="flex-1">
          <ul className="space-y-1 px-3">
            {ROUTES.map((route) => (
              <Item
                key={route.id}
                route={route}
                active={current.id === route.id}
                isDark={isDark}
              />
            ))}
          </ul>
        </nav>
        <div className="p-5">
          <div
            style={{
              height: 1,
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.15)'
                : 'rgba(0,0,0,0.15)',
              marginBottom: 12,
            }}
          />
          <p
            style={{
              fontSize: 11,
              textAlign: 'center',
              color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
            }}
          >
            X-Spider v{PACKAGE_JSON_VERSION}
          </p>
        </div>
      </div>
    </aside>
  );
};
