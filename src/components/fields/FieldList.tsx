'use client';

import { useState, useMemo } from 'react';
import {
  Check, ChevronDown, Edit2, ArrowUpDown, Sparkles, Trash2,
  Wand2, FilterX, Loader2,
} from 'lucide-react';
import { useDatasetStore } from '@/store/datasetStore';
import { useIsAdmin } from '@/lib/auth';
import { autoDetectViewConfig } from '@/lib/viewConfig';
import { ManualOrderModal } from './ManualOrderModal';
import { FieldAIEnrichModal } from './FieldAIEnrichModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { cn } from '@/lib/utils';
import { isSkipValue } from '@/lib/skipPatterns';
import { autoPersonaChartSpec } from '@/lib/personaTemplate';
import type { Dataset, Field, FieldType } from '@/types/dataSchema';

// ── Type config ────────────────────────────────────────────────────

const FIELD_TYPES: FieldType[] = ['single_choice', 'multi_choice', 'ranking', 'number', 'date', 'boolean', 'text'];

const TYPE_LABELS: Record<FieldType, string> = {
  single_choice: '单选',
  multi_choice:  '多选',
  ranking:       '排序',
  number:        '数值',
  date:          '日期',
  boolean:       '布尔',
  text:          '文本',
};

const TYPE_DOT: Record<FieldType, string> = {
  single_choice: 'bg-blue-400',
  multi_choice:  'bg-purple-400',
  ranking:       'bg-indigo-400',
  number:        'bg-emerald-400',
  date:          'bg-amber-400',
  boolean:       'bg-rose-400',
  text:          'bg-gray-300',
};

const TYPE_BADGE: Record<FieldType, string> = {
  single_choice: 'bg-blue-50 text-blue-700 border-blue-200',
  multi_choice:  'bg-purple-50 text-purple-700 border-purple-200',
  ranking:       'bg-indigo-50 text-indigo-700 border-indigo-200',
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
  const { updateFieldOrdering, removeField, updateViewConfig, cleanSkipValues } = useDatasetStore();
  const isAdmin = useIsAdmin();
  const [orderingField, setOrderingField]   = useState<Field | null>(null);
  const [enrichField,   setEnrichField]     = useState<Field | null>(null);
  const [deletingKey,   setDeletingKey]     = useState<string | null>(null);
  const [aiAction, setAiAction] = useState<'ordering' | 'persona' | null>(null);
  const [actionHint, setActionHint] = useState<{
    kind: 'success' | 'error';
    message: string;
  } | null>(null);

  // Count skip values per field for badge display
  const skipCounts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const field of dataset.fields) {
      let count = 0;
      for (const record of dataset.records) {
        if (isSkipValue(record[field.key])) count++;
      }
      result[field.key] = count;
    }
    return result;
  }, [dataset.records, dataset.fields]);

  function fieldSummary(field: Field) {
    const count = field.statistics?.count ?? dataset.rowCount;
    const missing = field.statistics?.missing ?? 0;
    return {
      key: field.key,
      name: field.name,
      type: field.type,
      unique: field.statistics?.unique ?? field.options?.length ?? 0,
      missingRate: count > 0 ? Number(((missing / count) * 100).toFixed(1)) : 0,
      values: (
        field.options?.length
          ? field.options
          : field.statistics?.topValues?.map(item => item.value) ?? []
      ).slice(0, 60),
    };
  }

  async function requestFieldAnalysis<T>(
    mode: 'ordering' | 'persona',
    fields: Field[],
  ): Promise<T> {
    const response = await fetch('/api/fields/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, fields: fields.map(fieldSummary) }),
    });
    const text = await response.text();
    let result: (T & { error?: string });
    try {
      result = JSON.parse(text) as T & { error?: string };
    } catch {
      throw new Error(text.slice(0, 160) || `AI 分析失败 (${response.status})`);
    }
    if (!response.ok || result.error) {
      throw new Error(result.error ?? `AI 分析失败 (${response.status})`);
    }
    return result;
  }

  function showHint(kind: 'success' | 'error', message: string) {
    setActionHint({ kind, message });
    setTimeout(() => setActionHint(null), 5000);
  }

  async function handleAutoOrdering() {
    const candidates = dataset.fields.filter(field =>
      !field.isOrdered &&
      (field.type === 'single_choice' || field.type === 'multi_choice') &&
      (field.options?.length ?? 0) >= 3 &&
      (field.options?.length ?? 0) <= 60,
    );
    if (candidates.length === 0) {
      showHint('success', '没有需要自动排序的字段');
      return;
    }

    setAiAction('ordering');
    setActionHint(null);
    try {
      let orderedCount = 0;
      // Use the exact same endpoint and payload as the per-field "AI 建议" action.
      for (const field of candidates) {
        const response = await fetch('/api/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fieldName: field.name, values: field.options }),
        });
        const result: { isOrdered?: boolean; orderedValues?: string[]; error?: string } = await response.json();
        if (!response.ok || result.error) throw new Error(result.error ?? `AI 排序失败 (${response.status})`);
        if (result.isOrdered && result.orderedValues && result.orderedValues.length === field.options?.length) {
          updateFieldOrdering(dataset.id, field.key, true, result.orderedValues);
          orderedCount++;
        }
      }
      showHint(
        'success',
        orderedCount > 0
          ? `已自动排序 ${orderedCount} 个字段`
          : 'AI 判断这些字段均无天然顺序',
      );
    } catch (error) {
      showHint('error', error instanceof Error ? error.message : 'AI 自动排序失败');
    } finally {
      setAiAction(null);
    }
  }

  async function handleAIPersonaDetect() {
    const ruleDetected = autoDetectViewConfig(dataset);
    const candidateKeys = new Set(ruleDetected.personaFieldKeys ?? []);
    const candidates = dataset.fields.filter(field => candidateKeys.has(field.key));
    if (candidates.length === 0) {
      showHint('error', '未发现适合画像分析的候选字段');
      return;
    }

    setAiAction('persona');
    setActionHint(null);
    try {
      const result = await requestFieldAnalysis<{
        personaFieldKeys: string[];
        roles?: Record<string, import('@/lib/personaTemplate').PersonaSemanticRole>;
        chartTypes?: Record<string, import('@/lib/personaTemplate').PersonaChartType>;
        reasons: Record<string, string>;
      }>('persona', candidates);
      updateViewConfig(dataset.id, {
        personaFieldKeys: result.personaFieldKeys,
        personaRoles: result.roles,
        personaRoleReasons: result.reasons,
        personaCharts: Object.fromEntries(
          Object.entries(result.chartTypes ?? {}).map(([key, type]) => {
            const field = dataset.fields.find(item => item.key === key);
            return [
              key,
              field ? autoPersonaChartSpec(field, type, dataset.fields) : { type },
            ];
          }),
        ),
      });
      showHint('success', `已识别并配置 ${result.personaFieldKeys.length} 个画像字段`);
    } catch (error) {
      showHint('error', error instanceof Error ? error.message : 'AI 画像字段识别失败');
    } finally {
      setAiAction(null);
    }
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">

        {/* Header */}
        <div className={cn(
          'grid gap-4 px-5 py-3 bg-gray-50 border-b border-gray-100',
          isAdmin ? 'grid-cols-[2.5fr_1.4fr_2fr_96px_36px]' : 'grid-cols-[2.5fr_1.4fr_2fr_96px]',
        )}>
          {(['字段信息', '类型', '数据概览', '操作', ...(isAdmin ? [''] : [])] as const).map((h, i) => (
            <div key={i} className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
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
            const canAI     = !field.derived;
            const skipCount = skipCounts[field.key] ?? 0;

            return (
              <div
                key={field.key}
                className={cn(
                  'grid gap-4 px-5 py-3.5 items-start hover:bg-gray-50/60 transition-colors',
                  isAdmin ? 'grid-cols-[2.5fr_1.4fr_2fr_96px_36px]' : 'grid-cols-[2.5fr_1.4fr_2fr_96px]',
                )}
              >
                {/* Col 1: Field info */}
                <FieldNameCell field={field} datasetId={dataset.id} />

                {/* Col 2: Type + delimiter */}
                <div>
                  <TypeDropdown field={field} datasetId={dataset.id} />
                  {(field.type === 'multi_choice' || field.type === 'ranking') && (
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
                  {isAdmin && !field.derived && (
                    <button
                      disabled={skipCount === 0}
                      onClick={() => {
                        if (
                          skipCount > 0 &&
                          window.confirm(`确认清除「${field.name}」中的 ${skipCount} 条跳过类答案？此操作不可撤销。`)
                        ) {
                          cleanSkipValues(dataset.id, field.key);
                        }
                      }}
                      title={
                        skipCount > 0
                          ? `将 ${skipCount} 条"跳过"类答案清空（不可撤销）`
                          : '未检测到跳过类答案（跳过 / N/A / — / 未填写 等）'
                      }
                      className={cn(
                        'inline-flex items-center justify-center gap-1 text-[11px] px-2 py-1 rounded-lg border transition-colors w-full',
                        skipCount > 0
                          ? 'bg-orange-50 text-orange-500 border-orange-200 hover:bg-orange-100 hover:text-orange-700 cursor-pointer'
                          : 'bg-gray-50 text-gray-300 border-gray-100 cursor-default',
                      )}
                    >
                      <FilterX size={10} />
                      去除跳过
                      {skipCount > 0 && (
                        <span className="ml-0.5 tabular-nums text-orange-400">({skipCount})</span>
                      )}
                    </button>
                  )}
                </div>

                {/* Col 5: Delete (admin only) */}
                {isAdmin && (
                  <div className="flex items-start pt-0.5">
                    <button
                      onClick={() => setDeletingKey(field.key)}
                      title="删除字段（同时从所有记录中移除该列）"
                      className="p-1.5 rounded-lg text-gray-200 hover:text-red-500 hover:bg-red-50 transition-all"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-4">
          <span className="text-xs text-gray-400">
            共 {dataset.fields.length} 个字段 · {dataset.rowCount.toLocaleString()} 行数据
          </span>
          {isAdmin && (
            <div className="flex items-center gap-2">
              {actionHint && (
                <span className={cn(
                  'max-w-[260px] truncate text-[11px]',
                  actionHint.kind === 'success' ? 'text-emerald-600' : 'text-red-600',
                )} title={actionHint.message}>
                  {actionHint.message}
                </span>
              )}
              <button
                onClick={handleAutoOrdering}
                disabled={aiAction !== null}
                title="批量判断分类字段是否具有天然顺序，并自动应用有效排序"
                className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs text-indigo-600 transition-all hover:bg-indigo-100 disabled:cursor-wait disabled:opacity-50"
              >
                {aiAction === 'ordering'
                  ? <Loader2 size={11} className="animate-spin" />
                  : <ArrowUpDown size={11} />}
                AI 自动排序
              </button>
              <button
                onClick={handleAIPersonaDetect}
                disabled={aiAction !== null}
                title="根据字段语义、类型、缺失率和典型值自动配置画像字段"
                className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs text-violet-600 transition-all hover:bg-violet-100 disabled:cursor-wait disabled:opacity-50"
              >
                {aiAction === 'persona'
                  ? <Loader2 size={11} className="animate-spin" />
                  : <Wand2 size={11} />}
                AI 识别画像字段
              </button>
            </div>
          )}
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

      {/* Delete field confirm dialog */}
      {deletingKey && (() => {
        const f = dataset.fields.find(x => x.key === deletingKey);
        return (
          <ConfirmDialog
            title="删除字段"
            description="此操作会从所有记录中移除该列，且不可恢复。"
            onCancel={() => setDeletingKey(null)}
            onConfirm={() => { removeField(dataset.id, deletingKey); setDeletingKey(null); }}
            details={
              <div className="space-y-2">
              <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm">
                <span className="font-medium text-gray-700">{f?.name}</span>
                <span className="text-gray-400 ml-2 font-mono text-xs">{f?.key}</span>
              </div>
              <div className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                将从 <strong>{dataset.rowCount.toLocaleString()}</strong> 条记录中删除此字段列
              </div>
              </div>
            }
          />
        );
      })()}
    </>
  );
}
