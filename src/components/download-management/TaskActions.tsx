/* eslint-disable react/prop-types */
import clsx from 'clsx';
import React from 'react';
import { useTheme } from '../../App';

export interface TaskAction {
  name: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  primary?: boolean;
}

export interface TaskActionsProps {
  actions: TaskAction[];
}

export const TaskActions: React.FC<TaskActionsProps> = ({ actions }) => {
  const { isDark } = useTheme();

  return (
    <ul className="flex space-x-3 text-sm">
      {actions.map((action) => (
        <li key={action.name}>
          <button
            onClick={action.onClick}
            aria-label={action.name}
            title={action.name}
            style={{
              color: actionColor(action.primary, action.danger, isDark),
            }}
            className={clsx(
              'bg-transparent transition-all duration-150 space-x-1 hover:brightness-125',
            )}
          >
            <span className="inline-flex items-center">{action.icon}</span>
            <span>{action.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
};

const actionColor = (
  primary: boolean | undefined,
  danger: boolean | undefined,
  isDark: boolean,
): string => {
  if (primary) return '#3b82f6';
  if (danger) return isDark ? '#ff6b6b' : '#ef4444';
  return isDark ? '#A0A0A0' : '#6b6b70';
};
