'use client';

/**
 * useConfigAutoSync
 *
 * 当 source=supabase 的数据集的配置（viewConfig / personaConfigs 等）
 * 在本地发生变更时，延迟 1.5s 自动推送到云端 upersona_dataset_configs 表。
 *
 * 只推送配置，不重传记录，操作极轻量。
 */

import { useEffect, useRef } from 'react';
import { useDatasetStore }    from '@/store/datasetStore';
import type { Dataset }       from '@/types/dataSchema';

export function useConfigAutoSync(dataset: Dataset | undefined) {
  const { viewConfigs, personaConfigs, savedCharts, canvasElements } = useDatasetStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const datasetId = dataset?.id;
  const isCloud   = dataset?.source === 'supabase';

  const viewConfig     = datasetId ? viewConfigs[datasetId]     : undefined;
  const pConfigs       = datasetId ? personaConfigs[datasetId]  : undefined;
  const sCharts        = datasetId ? savedCharts[datasetId]     : undefined;
  const cElements      = datasetId ? canvasElements[datasetId]  : undefined;

  useEffect(() => {
    if (!datasetId || !isCloud) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      fetch(`/api/datasets/${datasetId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          viewConfig,
          personaConfigs: pConfigs,
          savedCharts:    sCharts,
          canvasElements: cElements,
        }),
      }).catch(() => { /* 静默失败，不影响本地操作 */ });
    }, 1500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId, isCloud, viewConfig, pConfigs, sCharts, cElements]);
}
