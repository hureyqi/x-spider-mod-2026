export interface BatchList {
  id: string;
  name: string;
  description?: string;
  accounts: string[];
  filter: {
    mediaTypes: ('photo' | 'video' | 'gif')[];
    source: 'medias' | 'tweets';
    dateRange?: [start: number, end: number];
  };
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
  autoDownload?: boolean;
}

export interface BatchDownloadTask {
  id: string;
  listId: string;
  listName: string;
  currentAccount: string;
  accountIndex: number;
  totalAccounts: number;
  status: 'pending' | 'downloading' | 'paused' | 'completed' | 'error';
  progress: {
    current: number;
    total: number;
    percentage: number;
    speed?: number;
    eta?: number;
  };
  errors: string[];
  startedAt?: number;
  completedAt?: number;
}

export interface BatchListProgress {
  listId: string;
  listName: string;
  totalAccounts: number;
  completedAccounts: number;
  failedAccounts: number;
  currentAccount: string;
  currentAccountIndex: number;
  overallProgress: number;
  estimatedTimeRemaining?: number;
  currentSpeed?: number;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
}
