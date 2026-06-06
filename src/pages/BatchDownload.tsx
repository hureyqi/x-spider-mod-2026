import React from 'react';
import { PageHeader } from '../components/PageHeader';
import { BatchListManager } from '../components/batch-list/BatchListManager';
import { useTheme } from '../App';

export const BatchDownload: React.FC = () => {
  const { isDark } = useTheme();

  return (
    <div
      className="h-full overflow-auto"
      style={{ backgroundColor: isDark ? '#0a0a0a' : '#f0f2f5' }}
    >
      <PageHeader />
      <BatchListManager />
    </div>
  );
};
