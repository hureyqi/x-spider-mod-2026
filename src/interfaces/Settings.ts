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

export interface Settings_V3 extends Settings_V2 {
  app: Settings_V2['app'] & {
    /** 是否启用多 Cookie 自动轮换（429/401 时自动切换） */
    enableCookieRotation: boolean;
  };
  postProcess: {
    saveSidecar: boolean;
    tagWithLlm: boolean;
    llmEndpoint: string;
    llmApiKey: string;
    llmModel: string;
    llmPrompt: string;
  };
}

export type Settings = Settings_V3;
