'use client';

import { useState } from 'react';
import { Check, ChevronDown, Edit2, ArrowUpDown, Sparkles } from 'lucide-react';
import { useDatasetStore } from '@/store/datasetStore';
import { ManualOrderModal } from './ManualOrderModal';
import { FieldAIEnrichModal } from './FieldAIEnrichModal';
import { cn } from '@/lib/utils';
import type { Dataset, Field, FieldType } from '@/types/dataSchema';

// ── Type config ────────────────────────────────────────────────────

const FIELD_TYPES: FieldType[] = ['single_choice', 'multi_choice', 'number', 'date', 'boolean', 'text'];

const TYPE_LABELS: Record<FieldType, string> = {
  single_choice: '单选',
  multi_choice:  '多选',
  number:        '数值',
  date:          '日期',
  boolean:       '布尔',
  text:          '文本',
};

const TYPE_DOT: Record<FieldType, string> = {
  single_choice: 'bg-blue-400',
  multi_choice:  'bg-purple-400',
  number:        'bg-emerald-400',
  date:          'bg-amber-400',
  boolean:       'bg-rose-400',
  text:          'bg-gray-300',
};

const TYPE_BADGE: Record<FieldType, string> = {
  single_choice: 'bg-blue-50 text-blue-700 border-blue-200',
  multi_choice:  'bg-purple-50 text-purple-700 border-purple-200',
  number:        'bg-emerald-50 text-emerald-700 border-emerald-200',
  date:          'bg-amber-50 text-amber-700 border-amber-200',
  boolean:       'bg-rose-50 text-rose-700 border-rose-200',
  text:          'bg-gray-100 text-gray-500 border-gray-200',
};

// ── TypeDropdown ───────────────────────────────────────────────────

function TypeDropdown({ field, datasetId }: { field: Field; datasetId: string }) {
  const { updateFieldType } = useDatasetStore();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        title="点击切换字段类型"
        className={cn(
          'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors select-none w-full',
          TYPE_BADGE[field.type],
        )}
      >
        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', TYPE_DOT[field.type])} />
        <span className="flex-1 text-left">{TYPE_LABELS[field.type]}</span>
        <ChevronDown size={10} className="opacity-50 flex-shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-9 left-0 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 w-[136px]">
            {FIELD_TYPES.map(t => (
              <button
                key={t}
                onClick={() => { updateFieldType(datasetId, field.key, t); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors"
              >
                <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', TYPE_DOT[t])} />
                <span className={field.type === t ? 'text-blue-600 font-medium' : 'text-gray-700'}>
                  {TYPE_LABELS[t]}
                </span>
                {field.type === t && <Check size={11} className="ml-auto text-blue-500" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── DelimiterPicker ────────────────────────────────────────────────

const DELIMITER_PRESETS = [
  { label: '┋', value: '┋' },
  { label: '、', value: '、' },
  { label: '，', value: '，' },
  { label: ',',  value: ','  },
  { label: ';',  value: ';'  },
];

function DelimiterPicker({ field, datasetId }: { field: Field; datasetId: string }) {
  const { updateFieldMultiDelimiter } = useDatasetStore();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const current = field.multiDelimiter ?? '┋';

  function apply(v: string) {
    const d = v.trim();
    if (d) updateFieldMultiDelimiter(datasetId, field.key, d);
    setOpen(false);
    setCustom('');
  }

  return (
    <div className="relative mt-1.5">
      <button
        onClick={() => setOpen(o => !o)}
        title="点击更改多值分隔符"
        className="flex items-center gap-0.5 text-[10px] font-mono text-purple-600 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded hover:bg-purple-100 transition-colors"
      >
        sep: {current}
        <ChevronDown size={8} className="opacity-50" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-7 left-0 bg-white border border-gray-200 rounded-xl shadow-xl p-3 w-44">
            <div className="text-[10px] text-gray-400 mb-2 font-medium tracking-wide uppercase">
              多值分隔符
            </div>
            <div className="flex flex-wrap gap-1 mb-2.5">
              {DELIMITER_PRESETS.map(p => (
                <button
                  key={p.value}
                  onClick={() => apply(p.value)}
                  className={cn(
                    'font-mono text-xs px-2 py-0.5 rounded-md border transition-colors',
                    current === p.value
                      ? 'bg-purple-500 text-white border-purple-500'
                      : 'border-gray-200 text-gray-600 hover:border-purple-400 hover:text-purple-600',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <input
                value={custom}
                onChange={e => setCustom(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') apply(custom);
                  if (e.key === 'Escape') setOpen(false);
                }}
                placeholder="自定义…"
                className="flex-1 text-xs font-mono border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-purple-400"
                maxLength={4}
              />
              <button
                onClick={() => apply(custom)}
                className="p-1 text-purple-500 hover:text-purple-700 flex-shrink-0"
              >
                <Check size={12} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── FieldNameCell ──────────────────────────────────────────────────

function FieldNameCell({ field, datasetId }: { field: Field; datasetId: string }) {
  const { updateFieldName } = useDatasetStore();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(field.name);

  function commit() {
    if (value.trim()) updateFieldName(datasetId, field.key, value.trim());
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 min-w-0">
        <input
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') { setValue(field.name); setEditing(false); }
          }}
          className="flex-1 text-sm font-medium border-b-2 border-blue-500 outline-none bg-transparent py-0.5 min-w-0"
        />
        <button
          onMouseDown={e => { e.preventDefault(); commit(); }}
          className="p-0.5 text-blue-500 hover:text-blue-700 flex-shrink-0"
        >
          <Check size={13} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-1.5 min-w-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm font-medium text-gray-800 truncate">{field.name}</span>
          {field.derived && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-500 font-medium flex-shrink-0 border border-purple-200">
              派生
            </span>
          )}
        </div>
        <div className="text-[11px] text-gray-400 truncate mt-0.5 font-mono">{field.key}</div>
      </div>
      {/* Pencil: always present at low opacity — makes rename affordance discoverable */}
      <button
        onClick={() => { setValue(field.name); setEditing(true); }}
        title="重命名字段"
        className="flex-shrink-0 mt-0.5 p-0.5 text-gray-300 hover:text-gray-500 hover:bg-gray-100 rounded transition-colors"
      >
        <Edit2 size={11} />
      </button>
    </div>
  );
}

// ── MissingBadge ───────────────────────────────────────────────────

function MissingBadge({ missing, count }: { missing: number; count: number }) {
  if (!count) return null;
  if (missing === 0) {
    return <span className="text-[10px] text-gray-300">无缺失</span>;
  }
  const pct = (missing / count) * 100;
  if (pct < 5) {
    return (
      <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">
        {pct.toFixed(1)}% 缺失
      </span>
    );
  }
  return (
    <span className="text-[10px] text-red-600 font-medium bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-md">
      {pct.toFixed(1)}% 缺失
    </span>
  );
}

// ── FieldList ──────────────────────────────────────────────────────

export function FieldList({ dataset }: { dataset: Dataset }) {
  const { updateFieldOrdering } = useDatasetStore();
  const [orderingField, setOrderingField] = useState<Field | null>(null);
  const [enrichField,   setEnrichField]   = useState<Field | null>(null);

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">

        {/* Header */}
        <div className="grid grid-cols-[2.5fr_1.4fr_2fr_96px] gap-4 px-5 py-3 bg-gray-50 border-b border-gray-100">
          {(['字段信息', '类型', '数据概览', '操作'] as const).map(h => (
            <div key={h} className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              {h}
            </div>
          ))}
        </div>

        {/* Rows */}
        <div className="divide-y divide-gray-50">
          {dataset.fields.map(field => {
            const stats   = field.statistics;
            const canSort = (field.type === 'single_choice' || field.type === 'multi_choice')
              && (field.options?.length ?? 0) >= 3;
            const canAI   = (field.type === 'single_choice' || field.type === 'text') && !field.derived;

            return (
              <div
                key={field.key}
                className="grid grid-cols-[2.5fr_1.4fr_2fr_96px] gap-4 px-5 py-3.5 items-start hover:bg-gray-50/60 transition-colors"
              >
                {/* Col 1: Field info */}
                <FieldNameCell field={field} datasetId={dataset.id} />

                {/* Col 2: Type + delimiter */}
                <div>
                  <TypeDropdown field={field} datasetId={dataset.id} />
                  {field.type === 'multi_choice' && (
                    <DelimiterPicker field={field} datasetId={dataset.id} />
                  )}
                </div>

                {/* Col 3: Data overview */}
                <div className="space-y-1.5 pt-0.5">
                  <div className="flex items-center gap-2 flex-wrap min-h-[22px]">
                    {stats ? (
                      <>
                        <MissingBadge missing={stats.missing} count={stats.count} />
                        {stats.unique !== undefined && (
                          <span className="text-[10px] text-gray-400">
                            {stats.unique} 个取值
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-[10px] text-gray-300">暂无统计</span>
                    )}
                  </div>
                  {stats?.topValues && stats.topValues.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {stats.topValues.slice(0, 3).map(({ value, count }) => (
                        <span
                          key={value}
                          className="inline-flex items-center gap-1 text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-md"
                        >
                          <span className="truncate max-w-[56px]">{value}</span>
                          <span className="text-gray-400 flex-shrink-0 tabular-nums">{count}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Col 4: Actions — always visible, no hover-hide */}
                <div className="flex flex-col gap-1.5 pt-0.5">
                  {canSort && (
                    <button
                      onClick={() => setOrderingField(field)}
                      title={field.isOrdered ? '已设置排序（点击调整）' : '设置选项排列顺序'}
                      className={cn(
                        'inline-flex items-center justify-center gap-1 text-[11px] px-2 py-1 rounded-lg border transition-colors w-full',
                        field.isOrdered
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50',
                      )}
                    >
                      <ArrowUpDown size={10} />
                      {field.isOrdered ? '已排序' : '排序'}
                    </button>
                  )}
                  {canAI && (
                    <button
                      onClick={() => setEnrichField(field)}
                      title="用 AI 自动归类，生成派生字段"
                      className="inline-flex items-center justify-center gap-1 text-[11px] px-2 py-1 rounded-lg border bg-gray-50 text-gray-500 border-gray-200 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50 transition-colors w-full"
                    >
                      <Sparkles size={10} />
                      AI 派生
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer — stats only, no UI legend needed */}
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
          <span className="text-xs text-gray-400">
            共 {dataset.fields.length} 个字段 · {dataset.rowCount.toLocaleString()} 行数据
          </span>
        </div>
      </div>

      {/* Manual ordering modal */}
      {orderingField && (
        <ManualOrderModal
          field={orderingField}
          onClose={() => setOrderingField(null)}
          onSave={(isOrdered, orderedValues) => {
            updateFieldOrdering(dataset.id, orderingField.key, isOrdered, orderedValues);
            setOrderingField(null);
          }}
        />
      )}

      {/* AI enrichment modal */}
      {enrichField && (
        <FieldAIEnrichModal
          datasetId={dataset.id}
          field={enrichField}
          onClose={() => setEnrichField(null)}
        />
      )}
    </>
  );
}
