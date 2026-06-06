'use client';

/**
 * 通用数据集导入组件
 *
 * 支持：
 * - 拖拽上传 / 点击选择（xlsx / xls / csv / json）
 * - 自动识别字段类型，展示 Schema 预览
 * - 导入后写入 Zustand Store
 */

import { useState, useRef, useCallback } from 'react';
import {
  Upload, FileText, CheckCircle, AlertCircle,
  Loader2, Database, Tag, X, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDatasetStore } from '@/store/datasetStore';
import type { Dataset, Field, FieldType } from '@/types/dataSchema';

// 稳定 selector：只订阅 addDataset action，不随其他状态变化重渲染
const selectAddDataset = (s: ReturnType<typeof useDatasetStore.getState>) => s.addDataset;

// ── 字段类型标签颜色 ──────────────────────────────────────────
const TYPE_COLORS: Record<FieldType, string> = {
  single_choice: 'bg-[#007AFF]/10 text-[#007AFF]',
  multi_choice:  'bg-[#5856D6]/10 text-[#5856D6]',
  number:        'bg-[#34C759]/10 text-[#34C759]',
  date:          'bg-[#FF9500]/10 text-[#FF9500]',
  boolean:       'bg-[#FF2D55]/10 text-[#FF2D55]',
  text:          'bg-black/06 text-black/40',
};

const TYPE_LABELS: Record<FieldType, string> = {
  single_choice: '单选',
  multi_choice:  '多选',
  number:        '数值',
  date:          '日期',
  boolean:       '布尔',
  text:          '文本',
};

// ── 字段预览行 ────────────────────────────────────────────────
function FieldRow({ field }: { field: Field }) {
  const stats = field.statistics;
  const top = stats?.topValues?.slice(0, 3).map(v => v.value).join(' / ') ?? '';
  return (
    <div className="flex items-center gap-3 py-2 px-3 hover:bg-black/02 rounded-ios transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-500 text-black/70 truncate">{field.name}</span>
          <span className={cn('px-1.5 py-0.5 rounded-full text-[10px] font-500 flex-shrink-0', TYPE_COLORS[field.type])}>
            {TYPE_LABELS[field.type]}
          </span>
        </div>
        {top && (
          <div className="text-[11px] text-black/30 mt-0.5 truncate">示例：{top}</div>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        {stats && (
          <>
            <div className="text-[11px] text-black/45 tabular-nums">
              {stats.unique} <span className="text-black/25">唯一值</span>
            </div>
            {stats.missing > 0 && (
              <div className="text-[10px] text-[#FF9500]">
                {stats.missing} 缺失
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── 主组件 ────────────────────────────────────────────────────
interface DatasetImporterProps {
  onImported?: (dataset: Dataset) => void;
  compact?: boolean;   // 紧凑模式（用于嵌入卡片）
}

export function DatasetImporter({ onImported, compact = false }: DatasetImporterProps) {
  // 只订阅 action（函数引用在 Zustand 中永远稳定），不会因数据变化重渲染
  const addDataset = useDatasetStore(selectAddDataset);
  const inputRef = useRef<HTMLInputElement>(null);

  const [dragging, setDragging]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [preview, setPreview]     = useState<Dataset | null>(null);
  const [fileName, setFileName]   = useState('');

  async function handleFile(file: File) {
    setLoading(true);
    setError('');
    setPreview(null);
    setFileName(file.name);

    try {
      const form = new FormData();
      form.append('file', file);
      form.append('name', file.name.replace(/\.[^.]+$/, ''));

      const res = await fetch('/api/datasets', { method: 'POST', body: form });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error ?? '解析失败');
      setPreview(json as Dataset);
    } catch (e) {
      setError(e instanceof Error ? e.message : '上传失败');
    } finally {
      setLoading(false);
    }
  }

  function confirmImport() {
    if (!preview) return;
    addDataset(preview);
    onImported?.(preview);
    // 不清除预览，让用户看到结果
  }

  function reset() {
    setPreview(null);
    setError('');
    setFileName('');
    if (inputRef.current) inputRef.current.value = '';
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  return (
    <div className="space-y-4">
      {/* 上传区域 */}
      {!preview && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-ios-lg transition-all cursor-pointer',
            compact ? 'p-6' : 'p-10',
            dragging
              ? 'border-[#007AFF] bg-[#007AFF]/05'
              : 'border-black/12 bg-black/02 hover:border-[#007AFF]/40 hover:bg-[#007AFF]/02'
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.json"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={28} className="animate-spin text-[#007AFF]" />
              <div className="text-[13px] text-black/45">正在解析 {fileName}…</div>
              <div className="text-[11px] text-black/30">自动识别字段类型中</div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-center">
              <div className={cn(
                'w-12 h-12 rounded-ios flex items-center justify-center',
                dragging ? 'bg-[#007AFF]/12' : 'bg-black/06'
              )}>
                <Upload size={20} className={dragging ? 'text-[#007AFF]' : 'text-black/35'} />
              </div>
              <div>
                <div className="text-[14px] font-600 text-black/65">
                  {dragging ? '松开以上传' : '拖拽文件到此处'}
                </div>
                <div className="text-[12px] text-black/35 mt-1">
                  支持 Excel (.xlsx .xls)、CSV、JSON
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-center">
                {['xlsx', 'xls', 'csv', 'json'].map(ext => (
                  <span key={ext} className="px-2 py-0.5 bg-black/05 rounded text-[11px] text-black/40 font-mono">
                    .{ext}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-ios bg-[#FF3B30]/08 border border-[#FF3B30]/20">
          <AlertCircle size={14} className="text-[#FF3B30] flex-shrink-0" />
          <span className="text-[13px] text-[#FF3B30]">{error}</span>
          <button onClick={reset} className="ml-auto text-[#FF3B30]/60 hover:text-[#FF3B30]">
            <X size={13} />
          </button>
        </div>
      )}

      {/* Schema 预览 */}
      {preview && (
        <div className="space-y-3">
          {/* 数据集摘要 */}
          <div className="flex items-center gap-3 p-3 bg-[#34C759]/06 rounded-ios border border-[#34C759]/20">
            <CheckCircle size={15} className="text-[#34C759] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <FileText size={13} className="text-black/40" />
                <span className="text-[13px] font-600 text-black/70 truncate">{preview.name}</span>
              </div>
              <div className="text-[11px] text-black/35 mt-0.5 flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <Database size={10} />
                  {preview.rowCount.toLocaleString()} 行
                </span>
                <span className="flex items-center gap-1">
                  <Tag size={10} />
                  {preview.fields.length} 个字段
                </span>
                <span className="uppercase">.{preview.source}</span>
              </div>
            </div>
            <button onClick={reset} className="p-1 text-black/30 hover:text-black/60 transition-colors flex-shrink-0">
              <RefreshCw size={13} />
            </button>
          </div>

          {/* 字段列表 */}
          <div className="border border-black/06 rounded-ios overflow-hidden">
            <div className="px-3 py-2 bg-black/03 border-b border-black/06">
              <span className="text-[12px] font-600 text-black/45">字段识别结果</span>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-black/04">
              {preview.fields.map(f => (
                <FieldRow key={f.key} field={f} />
              ))}
            </div>
          </div>

          {/* 类型分布统计 */}
          <div className="flex gap-2 flex-wrap">
            {Object.entries(
              preview.fields.reduce((acc, f) => {
                acc[f.type] = (acc[f.type] || 0) + 1;
                return acc;
              }, {} as Record<FieldType, number>)
            ).map(([type, count]) => (
              <span key={type}
                className={cn('px-2 py-1 rounded-full text-[11px] font-500', TYPE_COLORS[type as FieldType])}>
                {TYPE_LABELS[type as FieldType]} × {count}
              </span>
            ))}
          </div>

          {/* 确认导入按钮 */}
          <button
            onClick={confirmImport}
            className="w-full btn-ios bg-[#007AFF] text-white text-[14px] font-600 py-3 rounded-ios"
          >
            导入数据集
          </button>
        </div>
      )}
    </div>
  );
}
