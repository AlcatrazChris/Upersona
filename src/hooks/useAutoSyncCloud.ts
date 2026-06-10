'use client';

/**
 * useAutoSyncCloud
 *
 * 在应用启动后自动拉取最新云端数据集并写入本地 store。
 * 规则：
 *  - 仅在 IndexedDB 水合完成后执行，避免覆盖本地缓存
 *  - 若当前活跃数据集是本地上传（source !== 'supabase'），跳过，不打断管理员工作流
 *  - 若已加载该数据集且版本与云端一致（updated_at 相同），跳过网络请求
 *  - 失败静默处理，不向用户展示错误
 */

import { useEffect, useRef, useState } from 'react';
import { useDatasetStore } from '@/store/datasetStore';
import type { Dataset } from '@/types/dataSchema';
import type { ViewConfig } from '@/lib/viewConfig';
import type { PersonaConfig } from '@/types/personaSchema';
import type { SavedChart, CanvasTextElement } from '@/store/datasetStore';

interface CloudMeta {
  id:          string;
  name:        string;
  updated_at:  string;
}

interface CloudFull {
  dataset: Dataset;
  config:  {
    view_config?:      ViewConfig        | null;
    persona_configs?:  PersonaConfig[]   | null;
    saved_charts?:     SavedChart[]      | null;
    canvas_elements?:  CanvasTextElement[] | null;
  } | null;
}

export interface AutoSyncState {
  syncing:    boolean;
  syncedName: string | null;  // dataset name shown briefly after successful sync
}

export function useAutoSyncCloud(): AutoSyncState {
  const [syncing,    setSyncing]    = useState(false);
  const [syncedName, setSyncedName] = useState<string | null>(null);
  const didSync = useRef(false);

  useEffect(() => {
    if (didSync.current) return;

    function run() {
      if (didSync.current) return;
      didSync.current = true;

      const { datasets, activeDatasetId, loadFromCloud } = useDatasetStore.getState();
      const current = datasets.find(d => d.id === activeDatasetId);

      // 若当前活跃的是本地上传文件，不覆盖
      if (current && current.source !== 'supabase') return;

      setSyncing(true);

      fetch('/api/datasets')
        .then(r => (r.ok ? r.json() : Promise.resolve([])) as Promise<CloudMeta[]>)
        .then(list => {
          if (!list.length) return null;
          const latest = list[0]; // 已按 created_at DESC 排序

          // 已加载 且 云端版本不比本地新 → 只激活，不重新拉取
          const local = useDatasetStore.getState().datasets.find(d => d.id === latest.id);
          if (local?.source === 'supabase') {
            const cloudTs = new Date(latest.updated_at).getTime();
            const localTs = new Date(local.updatedAt).getTime();
            if (cloudTs <= localTs) {
              useDatasetStore.getState().setActiveDatasetId(latest.id);
              return null;
            }
          }

          return fetch(`/api/datasets/${latest.id}`)
            .then(r => (r.ok ? r.json() : null)) as Promise<CloudFull | null>;
        })
        .then(result => {
          if (!result) return;
          loadFromCloud(result.dataset.id, result.dataset, result.config);
          setSyncedName(result.dataset.name);
          setTimeout(() => setSyncedName(null), 3000);
        })
        .catch(() => { /* 云端不可用时静默降级 */ })
        .finally(() => setSyncing(false));
    }

    // 等待 Zustand persist 从 IndexedDB 水合完成后再检查本地状态
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const persist = (useDatasetStore as any).persist as {
      hasHydrated: () => boolean;
      onFinishHydration: (cb: () => void) => () => void;
    } | undefined;

    if (persist?.hasHydrated?.()) {
      run();
    } else if (persist?.onFinishHydration) {
      const unsub = persist.onFinishHydration(run);
      return () => unsub();
    } else {
      // Fallback：300ms 后执行（通常 IndexedDB 读取 < 100ms）
      const t = setTimeout(run, 300);
      return () => clearTimeout(t);
    }
  }, []);

  return { syncing, syncedName };
}
