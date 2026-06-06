/* eslint-disable react/prop-types */
import React from 'react';
import { useRouteStore } from '../stores/route';
import { useTheme } from '../App';

export const PageHeader: React.FC = () => {
  const currentRoute = useRouteStore((state) => state.route);
  const { isDark } = useTheme();

  if (!currentRoute) return null;

  return (
    <div className="pt-8 pb-4">
      <h1
        className="font-semibold flex items-center leading-none pb-4"
        style={{
          borderBottom: '1px solid',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        }}
      >
        <span
          aria-hidden
          className="flex items-center justify-center w-8 h-8 rounded-full"
          style={{
            border: '1.5px solid',
            borderColor: 'var(--ant-color-primary)',
            color: 'var(--ant-color-primary)',
            fontSize: 16,
          }}
        >
          {currentRoute.icon}
        </span>
        <span
          className="ml-3 text-2xl font-semibold"
          style={{ color: isDark ? '#f5f5f7' : '#1d1d1f' }}
        >
          {currentRoute.name}
        </span>
      </h1>
    </div>
  );
};
