import { Settings } from '../interfaces/Settings';
import { DEFAULT_POST_PROCESS } from '../interfaces/PostProcess';

export const DEFAULT_SETTINGS: Settings = {
  proxy: {
    enable: true,
    url: 'http://127.0.0.1:7890',
    useSystem: true,
  },
  download: {
    saveDirBase: '',
    dirTemplate: '',
    folderMode: 'default',
    fileNameTemplate:
      '%POST_TIME% %USER_SCREEN_NAME% %POST_ID%-%MEDIA_INDEX%%EXT%',
    sameFileSkip: true,
  },
  app: {
    autoCheckUpdate: true,
    acceptPrerelease: false,
    writeLogs: false,
    themeMode: 'auto',
    enableCookieRotation: true,
  },
  postProcess: DEFAULT_POST_PROCESS,
};

export const CURRENT_SETTINGS_VERSION = 5;
