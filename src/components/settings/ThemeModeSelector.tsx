/* eslint-disable react/prop-types */
import React from 'react';
import { Radio } from 'antd';

export interface ThemeModeSelectorProps {
  value?: 'light' | 'dark' | 'auto';
  onChange?: (value: 'light' | 'dark' | 'auto') => void;
}

export const ThemeModeSelector: React.FC<ThemeModeSelectorProps> = ({
  value,
  onChange,
}) => {
  return (
    <Radio.Group
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      optionType="button"
      buttonStyle="solid"
    >
      <Radio.Button value="light">亮色模式</Radio.Button>
      <Radio.Button value="dark">暗色模式</Radio.Button>
      <Radio.Button value="auto">跟随系统</Radio.Button>
    </Radio.Group>
  );
};
