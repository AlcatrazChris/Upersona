'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Database, ChevronDown, Loader2, Cloud, Check, AlertCircle } from 'lucide-react';
import { useDatasetStore } from '@/store/datasetStore';
import { cn } from '@/lib/utils';
import type { Dataset } from '@/types/dataSchema';
import type { ViewConfig } from '@/lib/viewConfig';
import type { PersonaConfig } from '@/types/personaSchema';
import type { SavedChart, CanvasTextElement } from '@/store/datasetStore';

interface CloudMeta {
  id:          string;
  name:        string;
  source_type: string;
  row_count:   number;
  created_at:  string;
  updated_at:  string;
  uploaded_by: string | null;
}

interface CloudFull {
  dataset: Dataset;
  config: {
    view_config?:      ViewConfig         | null;
    persona_configs?:  PersonaConfig[]    | null;
    saved_charts?:     SavedChart[]       | null;
    canvas_elements?:  CanvasTextElement[] | null;
  } | null;
}

interface Props {
  currentDataset?: Dataset | null;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-CN', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function CloudDatasetSelector({ currentDataset }: Props) {
  const { loadFromCloud } = useDatasetStore();
  const [open, setOpen]           = useState(false);
  const [list, setList]           = useState<CloudMeta[]>([]);
  const [loading, setLoading]     = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError]         = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/datasets');
      if (!res.ok) throw new Error('加载失败');
      const data = await res.json() as CloudMeta[];
      setList(data);
    } catch {
      setError('无法加载云端数据集');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchList();
  }, [open, fetchList]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function switchDataset(id: string) {
    if (id === currentDataset?.id || switching) return;
    setSwitching(id);
    try {
      const res = await fetch(`/api/datasets/${id}`);
      if (!res.ok) throw new Error('拉取失败');
      const result = await res.json() as CloudFull;
      loadFromCloud(result.dataset.id, result.dataset, result.config);
      setOpen(false);
    } catch {
      setError('切换数据集失败，请重试');
    } finally {
      setSwitching(null);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium text-xs transition-all cursor-pointer',
          currentDataset
            ? open ? 'bg-blue-100 ring-1 ring-blue-200 text-blue-600' : 'bg-blue-50 hover:bg-blue-100 text-blue-600'
            : open ? 'bg-indigo-100 ring-1 ring-indigo-200 text-indigo-600' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600',
        )}
      >
        {currentDataset ? <Database size={11} /> : <Cloud size={11} />}
        <span className="max-w-[180px] truncate">
          {currentDataset ? currentDataset.name : '选择云端数据集'}
        </span>
        <ChevronDown size={11} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full mt-1.5 left-0 w-[340px] bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          <div className="px-3.5 py-2.5 border-b border-gray-50 flex items-center gap-2">
            <Cloud size={13} className="text-indigo-500" />
            <span className="text-xs font-medium text-gray-700">云端数据集</span>
            {loading && <Loader2 size={11} className="animate-spin text-gray-400 ml-auto" />}
          </div>

          {error && (
            <div className="px-3.5 py-2 text-xs text-red-500 flex items-center gap-1.5 bg-red-50">
              <AlertCircle size={11} />
              {error}
            </div>
          )}

          <div className="max-h-[320px] overflow-y-auto">
            {!loading && list.length === 0 && !error && (
              <div className="px-3.5 py-6 text-center text-xs text-gray-400">
                暂无云端数据集
              </div>
            )}
            {list.map(item => {
              const isCurrent = item.id === currentDataset?.id;
              const isSwitching = switching === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => switchDataset(item.id)}
                  disabled={isCurrent || !!switching}
                  className={cn(
                    'w-full px-3.5 py-2.5 flex items-start gap-3 text-left transition-all border-b border-gray-50 last:border-0',
                    isCurrent
                      ? 'bg-blue-50/60'
                      : switching
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:bg-gray-50 cursor-pointer',
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        'text-[12.5px] font-medium truncate',
                        isCurrent ? 'text-blue-600' : 'text-gray-800',
                      )}>
                        {item.name}
                      </span>
                      {isCurrent && <Check size={12} className="text-blue-500 flex-shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[10.5px] text-gray-400">
                      <span>{item.row_count.toLocaleString()} 条</span>
                      <span className="text-gray-200">·</span>
                      <span>{fmtDate(item.created_at)}</span>
                      {item.uploaded_by && (
                        <>
                          <span className="text-gray-200">·</span>
                          <span>{item.uploaded_by}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {isSwitching && (
                    <Loader2 size={13} className="animate-spin text-blue-500 flex-shrink-0 mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
