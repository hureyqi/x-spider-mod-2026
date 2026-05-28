import { ThemeConfig, theme } from 'antd';

const sharedToken = {
  colorPrimary: '#1d9bf0',
};

export const ANTD_THEME_LIGHT: ThemeConfig = {
  token: {
    ...sharedToken,
    colorBgLayout: '#f5f5f5',
    colorBgContainer: '#ffffff',
    colorText: '#000000',
    colorTextSecondary: '#666666',
  },
  cssVar: true,
  hashed: false,
};

export const ANTD_THEME_DARK: ThemeConfig = {
  token: {
    ...sharedToken,
    colorBgLayout: '#141414',
    colorBgContainer: '#1f1f1f',
    colorText: '#ffffff',
    colorTextSecondary: '#aaaaaa',
  },
  algorithm: theme.darkAlgorithm,
  cssVar: true,
  hashed: false,
};
