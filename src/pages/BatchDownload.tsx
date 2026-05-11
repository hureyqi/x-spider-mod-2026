import React from 'react';
import { PageHeader } from '../components/PageHeader';
import { BatchListManager } from '../components/batch-list/BatchListManager';

export const BatchDownload: React.FC = () => {
  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <PageHeader />
      <BatchListManager />
    </div>
  );
};
