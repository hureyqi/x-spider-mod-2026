/* eslint-disable react/prop-types */
import React from 'react';
import { Radio } from 'antd';
import { useTheme } from '../../App';

export interface ThemeModeSelectorProps {
  value?: 'light' | 'dark' | 'auto';
  onChange?: (value: 'light' | 'dark' | 'auto') => void;
}

export const ThemeModeSelector: React.FC<ThemeModeSelectorProps> = ({
  value,
  onChange,
}) => {
  const { isDark } = useTheme();

  return (
    <Radio.Group
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      optionType="button"
      buttonStyle="solid"
      style={{
        borderRadius: 9,
        overflow: 'hidden',
        border: isDark
          ? '1px solid rgba(255,255,255,0.1)'
          : '1px solid rgba(0,0,0,0.1)',
        padding: 2,
        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
      }}
    >
      <Radio.Button
        value="light"
        style={{
          borderRadius: 7,
          border: 'none',
          background: 'transparent',
          color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
          fontSize: 13,
        }}
      >
        亮色
      </Radio.Button>
      <Radio.Button
        value="dark"
        style={{
          borderRadius: 7,
          border: 'none',
          background: 'transparent',
          color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
          fontSize: 13,
        }}
      >
        暗色
      </Radio.Button>
      <Radio.Button
        value="auto"
        style={{
          borderRadius: 7,
          border: 'none',
          background: 'transparent',
          color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
          fontSize: 13,
        }}
      >
        自动
      </Radio.Button>
    </Radio.Group>
  );
};
