export interface Settings_V1 {
  proxy: {
    enable: boolean;
    url: string;
    useSystem: boolean;
  };
  download: {
    savePath: string;
    fileNameTemplate: string;
    sameFileSkip: boolean;
  };
  app: {
    autoCheckUpdate: boolean;
    acceptPrerelease: boolean;
  };
}

export interface Settings_V2 {
  proxy: {
    enable: boolean;
    url: string;
    useSystem: boolean;
  };
  download: {
    saveDirBase: string;
    dirTemplate: string;
    folderMode: 'default' | 'template';
    fileNameTemplate: string;
    sameFileSkip: boolean;
  };
  app: {
    autoCheckUpdate: boolean;
    acceptPrerelease: boolean;
    writeLogs: boolean;
    themeMode: 'light' | 'dark' | 'auto';
  };
}

export type Settings = Settings_V2;
