/* eslint-disable react/prop-types */
import clsx from 'clsx';
import React from 'react';
import { ROUTES } from '../constants/routes';
import { Route } from '../interfaces/Route';
import { useRouteStore } from '../stores/route';
import { Account } from './Account';

interface SideBarItemProps {
  route: Route;
  active: boolean;
}

const Item: React.FC<SideBarItemProps> = ({ route, active }) => {
  const setRoute = useRouteStore((state) => state.setRoute);
  return (
    <li className="pr-3">
      <button
        aria-label={`切换到${route.name}${active ? '（当前）' : ''}`}
        className={clsx(
          'block w-full py-3 px-4 rounded-xl transition-all duration-200 relative overflow-hidden group',
          active
            ? 'bg-blue-600/90 text-white shadow-md'
            : 'bg-transparent text-gray-200 hover:bg-white/10',
        )}
        onClick={() => {
          setRoute(route);
        }}
      >
        {active && (
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-transparent" />
        )}
        <div className="relative flex items-center gap-3">
          <span className={clsx(
            'text-xl transition-transform group-hover:scale-110',
            active ? 'text-white' : 'text-gray-300'
          )}>
            {route.icon}
          </span>
          <span className={clsx(
            'font-semibold text-base',
            active ? 'text-white' : 'text-gray-200 group-hover:text-white'
          )}>
            {route.name}
          </span>
          {active && (
            <span className="ml-auto">
              <div className="w-2 h-2 bg-white rounded-full" />
            </span>
          )}
        </div>
      </button>
    </li>
  );
};

export const SideBar: React.FC = () => {
  const current = useRouteStore((state) => state.route);

  if (!current) return null;

  return (
    <aside
      aria-label="侧边栏"
      className="fixed top-0 left-0 h-full w-64 z-40 shadow-xl"
      style={{
        background: 'linear-gradient(180deg, #1e1e2e 0%, #2d2d44 100%)',
      }}
    >
      <div className="relative z-10 h-full flex flex-col">
        <Account />
        
        <div className="px-5 pt-5 pb-3">
          <div className="h-px bg-gray-700/50" />
        </div>
        
        <nav aria-label="页面导航" className="flex-1">
          <ul className="space-y-2 px-4">
            {ROUTES.map((route) => (
              <Item
                key={route.id}
                route={route}
                active={current.id === route.id}
              />
            ))}
          </ul>
        </nav>
        
        <div className="p-5">
          <div className="h-px bg-gray-700/50 mb-3" />
          <p className="text-gray-500 text-xs text-center">
            X-Spider v{PACKAGE_JSON_VERSION}
          </p>
        </div>
      </div>
    </aside>
  );
};
