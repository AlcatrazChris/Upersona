'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDatasetStore } from '@/store/datasetStore';

/**
 * Legacy deep-link handler.
 * Sets the active dataset in the store, then redirects to the main page.
 * This ensures old bookmarks / shared links still work.
 */
export default function DatasetRedirectPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { setActiveDatasetId, getDataset } = useDatasetStore();

  useEffect(() => {
    const dataset = getDataset(params.id);
    if (dataset) {
      setActiveDatasetId(params.id);
    }
    router.replace('/');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <span className="text-sm text-gray-400">跳转中…</span>
    </div>
  );
}
