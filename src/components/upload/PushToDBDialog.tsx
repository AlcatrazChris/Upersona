'use client';

/**
 * PushToDBDialog — 将本地数据集推送到 Supabase 的确认弹窗
 *
 * 展示：数据集摘要、字段列表预览、推送进度
 * 推送成功后回调 onSuccess(datasetId)
 */

import { useState } from 'react';
import {
  CloudUpload, X, Database, Loader2, Check,
  AlertTriangle, Table2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Dataset } from '@/types/dataSchema';
import type { ViewConfig } from '@/lib/viewConfig';
import { useModalA11y } from '@/hooks/useModalA11y';

interface Props {
  dataset:        Dataset;
  viewConfig?:    ViewConfig;
  personaConfigs?: unknown;
  savedCharts?:   unknown;
  canvasElements?: unknown;
  onClose:        () => void;
  onSuccess:      (datasetId: string) => void;
}

const TYPE_COLORS: Record<string, string> = {
  single_choice: 'bg-blue-50 text-blue-600 border-blue-200',
  multi_choice:  'bg-purple-50 text-purple-600 border-purple-200',
  number:        'bg-emerald-50 text-emerald-600 border-emerald-200',
  date:          'bg-amber-50 text-amber-600 border-amber-200',
  boolean:       'bg-rose-50 text-rose-600 border-rose-200',
  text:          'bg-gray-100 text-gray-500 border-gray-200',
};

const TYPE_LABELS: Record<string, string> = {
  single_choice: '单选',
  multi_choice:  '多选',
  number:        '数值',
  date:          '日期',
  boolean:       '布尔',
  text:          '文本',
};

export function PushToDBDialog({
  dataset, viewConfig, personaConfigs, savedCharts, canvasElements,
  onClose, onSuccess,
}: Props) {
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);
  const [phase,   setPhase]   = useState<'preview' | 'pushing' | 'done' | 'error'>('preview');
  const [error,   setError]   = useState('');
  const [progress, setProgress] = useState('');

  const fieldCount  = dataset.fields.length;
  const recordCount = dataset.rowCount;
  const chunkCount  = Math.ceil(recordCount / 1000);

  const fieldTypeSummary = dataset.fields.reduce<Record<string, number>>((acc, f) => {
    acc[f.type] = (acc[f.type] ?? 0) + 1;
    return acc;
  }, {});

  async function handlePush() {
    setPhase('pushing');
    setProgress('正在连接数据库…');

    try {
      setProgress(`正在上传 ${recordCount.toLocaleString()} 条记录（约 ${chunkCount} 个数据块）…`);

      const res = await fetch('/api/datasets', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataset,
          viewConfig,
          personaConfigs,
          savedCharts,
          canvasElements,
        }),
      });

      const json = await res.json() as { ok?: boolean; error?: string; chunkCount?: number };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `上传失败 (${res.status})`);
      }

      setProgress(`上传完成，共 ${json.chunkCount} 个数据块`);
      setPhase('done');
      setTimeout(() => onSuccess(dataset.id), 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : '未知错误');
      setPhase('error');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="push-db-title"
        tabIndex={-1}
        className="mx-4 flex max-h-[85vh] w-[560px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden overscroll-contain rounded-2xl border border-gray-100 bg-white shadow-2xl"
      >

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <CloudUpload size={16} className="text-blue-500" />
          </div>
          <div className="flex-1">
            <h2 id="push-db-title" className="text-sm font-semibold text-gray-800">推送到数据库</h2>
            <div className="text-xs text-gray-400 mt-0.5">将本地数据集上传至 Supabase 云端</div>
          </div>
          {phase === 'preview' && (
            <button aria-label="关闭数据库推送" onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
              <X size={15} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Dataset summary */}
          <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Database size={14} className="text-gray-400" />
              <span className="text-sm font-semibold text-gray-800 truncate">{dataset.name}</span>
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full font-medium ml-auto flex-shrink-0',
                dataset.source === 'xlsx' || dataset.source === 'xls'
                  ? 'bg-green-50 text-green-700'
                  : dataset.source === 'csv'
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-orange-50 text-orange-700',
              )}>
                {dataset.source.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-xl border border-gray-100 px-3 py-2 text-center">
                <div className="text-lg font-bold text-gray-800">{recordCount.toLocaleString()}</div>
                <div className="text-[10.5px] text-gray-400">记录行数</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 px-3 py-2 text-center">
                <div className="text-lg font-bold text-gray-800">{fieldCount}</div>
                <div className="text-[10.5px] text-gray-400">字段数量</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 px-3 py-2 text-center">
                <div className="text-lg font-bold text-gray-800">{chunkCount}</div>
                <div className="text-[10.5px] text-gray-400">存储分块</div>
              </div>
            </div>

            {/* Type summary */}
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(fieldTypeSummary).map(([type, count]) => (
                <span key={type}
                      className={cn('text-[10.5px] px-2 py-0.5 rounded-lg border font-medium', TYPE_COLORS[type] ?? 'bg-gray-50 text-gray-500 border-gray-200')}>
                  {TYPE_LABELS[type] ?? type} ×{count}
                </span>
              ))}
            </div>
          </div>

          {/* Field list preview */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Table2 size={13} className="text-gray-400" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">字段预览（将全量上传）</span>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50 max-h-48 overflow-y-auto">
              {dataset.fields.map(f => (
                <div key={f.key} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-md border font-medium flex-shrink-0',
                    TYPE_COLORS[f.type] ?? 'bg-gray-50 text-gray-500 border-gray-200',
                  )}>
                    {TYPE_LABELS[f.type] ?? f.type}
                  </span>
                  <span className="text-[12.5px] font-medium text-gray-800 flex-1 truncate">{f.name}</span>
                  {f.derived && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-500 border border-purple-200 flex-shrink-0">派生</span>
                  )}
                  <span className="text-[10.5px] text-gray-400 flex-shrink-0 tabular-nums">
                    {f.statistics?.unique ?? '—'} 值
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-2">
              如需修改字段（删除、重命名、调整类型），请先在「字段概览」完成，再执行推送。
            </p>
          </div>

          {/* Note */}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            <AlertTriangle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-[11.5px] text-amber-700">
              若同名数据集已在云端，此操作将<strong>覆盖</strong>其字段 schema 和全量记录（保留 ID）。
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3">

          {/* Phase: preview */}
          {phase === 'preview' && (
            <>
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-all">
                取消
              </button>
              <button
                onClick={handlePush}
                className="flex items-center gap-2 px-5 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all font-medium ml-auto shadow-sm"
              >
                <CloudUpload size={14} />
                确认推送
              </button>
            </>
          )}

          {/* Phase: pushing */}
          {phase === 'pushing' && (
            <div className="flex items-center gap-3 w-full">
              <Loader2 size={16} className="text-blue-500 animate-spin flex-shrink-0" />
              <span className="text-sm text-gray-600">{progress}</span>
            </div>
          )}

          {/* Phase: done */}
          {phase === 'done' && (
            <div className="flex items-center gap-3 w-full">
              <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Check size={14} className="text-emerald-600" />
              </div>
              <span className="text-sm text-emerald-700 font-medium">推送成功！数据集已同步至云端</span>
            </div>
          )}

          {/* Phase: error */}
          {phase === 'error' && (
            <div className="flex items-center gap-3 w-full">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <AlertTriangle size={15} className="text-red-500 flex-shrink-0" />
                <span className="text-sm text-red-600 truncate">{error}</span>
              </div>
              <button
                onClick={() => { setPhase('preview'); setError(''); }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl flex-shrink-0"
              >
                返回
              </button>
              <button
                onClick={handlePush}
                className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-xl flex-shrink-0 font-medium"
              >
                重试
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
