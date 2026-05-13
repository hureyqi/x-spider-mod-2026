/* eslint-disable react/prop-types */

import React from 'react';
import { Radio } from 'antd';

export interface FolderModeSelectorProps {
  value?: 'default' | 'template';
  onChange?: (value: 'default' | 'template') => void;
}

export const FolderModeSelector: React.FC<FolderModeSelectorProps> = ({
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
      <Radio.Button value="default">默认模式</Radio.Button>
      <Radio.Button value="template">模板模式</Radio.Button>
    </Radio.Group>
  );
};
