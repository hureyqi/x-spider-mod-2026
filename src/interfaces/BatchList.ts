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
