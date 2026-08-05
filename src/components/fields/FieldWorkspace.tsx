'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowUpDown, ChevronRight, FilterX, Loader2,
  Save, Search, Sparkles, Trash2, X,
} from 'lucide-react';
import { useDatasetStore } from '@/store/datasetStore';
import { useIsAdmin } from '@/lib/auth';
import { isSkipValue } from '@/lib/skipPatterns';
import { cn } from '@/lib/utils';
import { ManualOrderModal } from './ManualOrderModal';
import { FieldAIEnrichModal } from './FieldAIEnrichModal';
import type { Dataset, Field, FieldType } from '@/types/dataSchema';

const TYPES: Array<{ value: FieldType; label: string }> = [
  { value: 'single_choice', label: '单选' },
  { value: 'multi_choice', label: '多选' },
  { value: 'ranking', label: '排序' },
  { value: 'number', label: '数值' },
  { value: 'date', label: '日期' },
  { value: 'boolean', label: '布尔' },
  { value: 'text', label: '文本' },
];

const TYPE_LABEL = Object.fromEntries(TYPES.map(item => [item.value, item.label])) as Record<FieldType, string>;

function skipCount(dataset: Dataset, key: string) {
  return dataset.records.reduce((count, record) => count + Number(isSkipValue(record[key])), 0);
}

function cleanField(dataset: Dataset, fieldKey: string): Dataset {
  const records = dataset.records.map(record =>
    isSkipValue(record[fieldKey]) ? { ...record, [fieldKey]: '' } : record,
  );
  const fields = dataset.fields.map(field => {
    if (field.key !== fieldKey) return field;
    const values = records.map(record => String(record[fieldKey] ?? '').trim()).filter(Boolean);
    const frequency = new Map<string, number>();
    for (const value of values) frequency.set(value, (frequency.get(value) ?? 0) + 1);
    return {
      ...field,
      options: field.options?.filter(value => !isSkipValue(value)),
      statistics: {
        count: records.length,
        missing: records.length - values.length,
        unique: frequency.size,
        topValues: [...frequency].sort((a, b) => b[1] - a[1]).slice(0, 10)
          .map(([value, count]) => ({ value, count })),
      },
    };
  });
  return { ...dataset, records, fields };
}

function removeField(dataset: Dataset, fieldKey: string): Dataset {
  return {
    ...dataset,
    fields: dataset.fields.filter(field => field.key !== fieldKey),
    records: dataset.records.map(record => {
      const next = { ...record };
      delete next[fieldKey];
      return next;
    }),
  };
}

export function FieldWorkspace({ dataset, onDirtyChange }: { dataset: Dataset; onDirtyChange?: (dirty: boolean) => void }) {
  const isAdmin = useIsAdmin();
  const { updateDataset, viewConfigs, updateViewConfig } = useDatasetStore();
  const [draft, setDraft] = useState(dataset);
  const [baseUpdatedAt, setBaseUpdatedAt] = useState(dataset.updatedAt);
  const [selectedKey, setSelectedKey] = useState(dataset.fields[0]?.key ?? '');
  const [checked, setChecked] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'issue' | 'unordered' | FieldType>('all');
  const [changes, setChanges] = useState<string[]>([]);
  const [ordering, setOrdering] = useState<Field | null>(null);
  const [enriching, setEnriching] = useState<Field | null>(null);
  const [aiSorting, setAiSorting] = useState(false);
  const personaKeys = viewConfigs[dataset.id]?.personaFieldKeys ?? [];

  useEffect(() => onDirtyChange?.(changes.length > 0), [changes.length, onDirtyChange]);

  useEffect(() => {
    if (dataset.updatedAt === baseUpdatedAt || changes.length > 0) return;
    setDraft(dataset);
    setBaseUpdatedAt(dataset.updatedAt);
    if (!dataset.fields.some(field => field.key === selectedKey)) setSelectedKey(dataset.fields[0]?.key ?? '');
  }, [baseUpdatedAt, changes.length, dataset, selectedKey]);

  const counts = useMemo(() => Object.fromEntries(
    draft.fields.map(field => [field.key, skipCount(draft, field.key)]),
  ), [draft]);
  const selected = draft.fields.find(field => field.key === selectedKey) ?? draft.fields[0];
  const visibleFields = useMemo(() => draft.fields.filter(field => {
    const matchesQuery = !query.trim() || `${field.name} ${field.key}`.toLowerCase().includes(query.trim().toLowerCase());
    const missingRate = (field.statistics?.missing ?? 0) / Math.max(1, field.statistics?.count ?? draft.rowCount);
    const hasIssue = missingRate >= .05 || (counts[field.key] ?? 0) > 0 ||
      ((field.type === 'multi_choice' || field.type === 'ranking') && (field.multiDelimiter ?? '┋') !== '┋');
    const matchesFilter = filter === 'all' || field.type === filter ||
      (filter === 'issue' && hasIssue) ||
      (filter === 'unordered' && ['single_choice', 'multi_choice'].includes(field.type) && !field.isOrdered);
    return matchesQuery && matchesFilter;
  }), [counts, draft.fields, draft.rowCount, filter, query]);

  function note(message: string) {
    setChanges(current => current.includes(message) ? current : [...current, message]);
  }

  function patchSelected(patch: Partial<Field>, message: string) {
    if (!selected) return;
    setDraft(current => ({
      ...current,
      fields: current.fields.map(field => field.key === selected.key ? { ...field, ...patch } : field),
    }));
    note(message);
  }

  function discard() {
    setDraft(dataset);
    setChanges([]);
    setChecked([]);
    setSelectedKey(dataset.fields[0]?.key ?? '');
  }

  function save() {
    updateDataset(dataset.id, { fields: draft.fields, records: draft.records, rowCount: draft.records.length });
    setChanges([]);
    setChecked([]);
    setBaseUpdatedAt(new Date().toISOString());
  }

  function setPersona(included: boolean, keys = [selected?.key].filter(Boolean) as string[]) {
    const current = viewConfigs[dataset.id]?.personaFieldKeys ?? [];
    updateViewConfig(dataset.id, {
      personaFieldKeys: included
        ? [...new Set([...current, ...keys])]
        : current.filter(key => !keys.includes(key)),
    });
  }

  async function autoSort(keys: string[]) {
    const candidates = draft.fields.filter(field => keys.includes(field.key) &&
      ['single_choice', 'multi_choice'].includes(field.type) && (field.options?.length ?? 0) >= 3);
    if (!candidates.length) return;
    setAiSorting(true);
    try {
      let next = draft;
      for (const field of candidates) {
        const response = await fetch('/api/order', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fieldName: field.name, values: field.options }),
        });
        const result = await response.json() as { isOrdered?: boolean; orderedValues?: string[]; error?: string };
        if (!response.ok || result.error) throw new Error(result.error ?? 'AI排序失败');
        if (result.isOrdered && result.orderedValues?.length === field.options?.length) {
          next = { ...next, fields: next.fields.map(item => item.key === field.key
            ? { ...item, isOrdered: true, orderedValues: result.orderedValues }
            : item) };
        }
      }
      setDraft(next);
      note(`AI排序 ${candidates.length} 个字段`);
    } finally {
      setAiSorting(false);
    }
  }

  const checkedAll = visibleFields.length > 0 && visibleFields.every(field => checked.includes(field.key));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索字段名称或原始列名"
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:bg-white" />
        </div>
        <select value={filter} onChange={event => setFilter(event.target.value as typeof filter)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600">
          <option value="all">全部字段</option><option value="issue">仅看异常</option><option value="unordered">待排序字段</option>
          {TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
        </select>
        {isAdmin && <button type="button" disabled={aiSorting} onClick={() => autoSort(checked.length ? checked : draft.fields.map(field => field.key))}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-sm text-indigo-700 disabled:opacity-50">
          {aiSorting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} AI自动排序
        </button>}
      </div>

      {checked.length > 0 && isAdmin && (
        <div className="flex flex-wrap items-center gap-2 border-b border-blue-100 bg-blue-50 px-4 py-2 text-xs text-blue-800">
          <span className="font-medium">已选 {checked.length} 个字段</span>
          <button onClick={() => setPersona(true, checked)} className="rounded-md bg-white px-2.5 py-1 shadow-sm">加入画像</button>
          <button onClick={() => setPersona(false, checked)} className="rounded-md bg-white px-2.5 py-1 shadow-sm">移出画像</button>
          <button onClick={() => {
            let next = draft;
            for (const key of checked) if ((counts[key] ?? 0) > 0) next = cleanField(next, key);
            setDraft(next); note(`清理 ${checked.length} 个字段的无效值`);
          }} className="rounded-md bg-white px-2.5 py-1 shadow-sm">清除无效答案</button>
          <button onClick={() => setChecked([])} className="ml-auto p-1 text-blue-500"><X size={13} /></button>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(420px,1fr)_360px]">
        <div className="min-h-0 overflow-auto border-r border-slate-200 bg-white">
          <div className="sticky top-0 z-10 grid grid-cols-[32px_minmax(180px,1fr)_90px_110px_20px] items-center gap-3 border-b border-slate-200 bg-slate-50/95 px-4 py-2 text-[11px] font-medium text-slate-500 backdrop-blur">
            <input type="checkbox" checked={checkedAll} onChange={() => setChecked(checkedAll ? [] : visibleFields.map(field => field.key))} aria-label="选择全部字段" />
            <span>字段</span><span>类型</span><span>质量</span><span />
          </div>
          {visibleFields.map(field => {
            const count = field.statistics?.count ?? draft.rowCount;
            const missing = field.statistics?.missing ?? 0;
            const missingRate = count ? missing / count : 0;
            const badDelimiter = (field.type === 'multi_choice' || field.type === 'ranking') && (field.multiDelimiter ?? '┋') !== '┋';
            return (
              <button type="button" key={field.key} onClick={() => setSelectedKey(field.key)}
                className={cn('grid w-full grid-cols-[32px_minmax(180px,1fr)_90px_110px_20px] items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors',
                  selected?.key === field.key ? 'bg-blue-50/70' : 'hover:bg-slate-50')}>
                <input type="checkbox" checked={checked.includes(field.key)} onClick={event => event.stopPropagation()}
                  onChange={() => setChecked(current => current.includes(field.key) ? current.filter(key => key !== field.key) : [...current, field.key])}
                  aria-label={`选择字段 ${field.name}`} />
                <span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-800">{field.name}</span>
                  <span className="block truncate font-mono text-[10px] text-slate-400">{field.key}</span></span>
                <span className="text-xs text-slate-600">{TYPE_LABEL[field.type]}</span>
                <span className="flex flex-wrap items-center gap-1 text-[10px]">
                  {missingRate >= .05 && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700">缺失 {(missingRate * 100).toFixed(1)}%</span>}
                  {(counts[field.key] ?? 0) > 0 && <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-600">无效 {counts[field.key]}</span>}
                  {badDelimiter && <AlertTriangle size={13} className="text-amber-500" />}
                  {missingRate < .05 && !(counts[field.key] ?? 0) && !badDelimiter && <span className="text-emerald-600">正常</span>}
                </span>
                <ChevronRight size={14} className="text-slate-300" />
              </button>
            );
          })}
          {!visibleFields.length && <div className="p-12 text-center text-sm text-slate-400">没有符合条件的字段</div>}
        </div>

        <aside className="min-h-0 overflow-y-auto bg-slate-50 p-5">
          {selected ? <div className="space-y-5">
            <div><div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">字段检查台</div>
              <h3 className="mt-1 text-base font-semibold text-slate-900">{selected.name}</h3>
              <p className="mt-1 break-all font-mono text-[10px] text-slate-400">{selected.key}</p></div>

            <label className="block text-xs font-medium text-slate-600">显示名称
              <input value={selected.name} disabled={!isAdmin} onChange={event => patchSelected({ name: event.target.value }, `重命名字段 ${selected.key}`)}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 disabled:bg-slate-100" />
            </label>
            <label className="block text-xs font-medium text-slate-600">字段类型
              <select value={selected.type} disabled={!isAdmin} onChange={event => patchSelected({ type: event.target.value as FieldType }, `修改 ${selected.name} 类型`)}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm disabled:bg-slate-100">
                {TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </label>
            {(selected.type === 'multi_choice' || selected.type === 'ranking') && <label className="block text-xs font-medium text-slate-600">多值分隔符
              <input value={selected.multiDelimiter ?? '┋'} maxLength={4} disabled={!isAdmin}
                onChange={event => patchSelected({ multiDelimiter: event.target.value || '┋' }, `修改 ${selected.name} 分隔符`)}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-sm disabled:bg-slate-100" />
              <span className="mt-1 block text-[10px] text-slate-400">默认只使用 ┋，其他字符需手动确认。</span>
            </label>}

            <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-white p-3 text-center">
              <div><div className="text-lg font-semibold text-slate-800">{selected.statistics?.unique ?? selected.options?.length ?? 0}</div><div className="text-[10px] text-slate-400">唯一值</div></div>
              <div><div className="text-lg font-semibold text-slate-800">{selected.statistics?.missing ?? 0}</div><div className="text-[10px] text-slate-400">缺失</div></div>
              <div><div className="text-lg font-semibold text-slate-800">{counts[selected.key] ?? 0}</div><div className="text-[10px] text-slate-400">无效答案</div></div>
            </div>

            {selected.statistics?.topValues?.length ? <div><div className="mb-2 text-xs font-medium text-slate-600">取值预览</div>
              <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
                {selected.statistics.topValues.map(item => <div key={item.value} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-xs hover:bg-slate-50">
                  <span className="truncate text-slate-600">{item.value}</span><span className="tabular-nums text-slate-400">{item.count}</span>
                </div>)}
              </div></div> : null}

            <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
              加入用户画像
              <input type="checkbox" disabled={!isAdmin} checked={personaKeys.includes(selected.key)} onChange={event => setPersona(event.target.checked)} />
            </label>

            {isAdmin && <div className="grid grid-cols-2 gap-2">
              {['single_choice', 'multi_choice'].includes(selected.type) && <button onClick={() => setOrdering(selected)} className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 hover:border-blue-300">
                <ArrowUpDown size={13} />{selected.isOrdered ? '调整排序' : '设置排序'}</button>}
              <button disabled={changes.length > 0} title={changes.length ? '请先保存当前修改' : '使用AI生成派生字段'} onClick={() => setEnriching(selected)} className="flex items-center justify-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-700 disabled:opacity-40"><Sparkles size={13} />AI派生</button>
              <button disabled={(counts[selected.key] ?? 0) === 0} onClick={() => { setDraft(current => cleanField(current, selected.key)); note(`清理 ${selected.name} 无效值`); }} className="flex items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 disabled:opacity-40"><FilterX size={13} />清除无效值</button>
              <button onClick={() => { if (!confirm(`删除字段「${selected.name}」及其所有数据？保存前仍可放弃修改。`)) return; setDraft(current => removeField(current, selected.key)); note(`删除字段 ${selected.name}`); const next = draft.fields.find(field => field.key !== selected.key); setSelectedKey(next?.key ?? ''); }} className="flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600"><Trash2 size={13} />删除字段</button>
            </div>}
          </div> : <div className="p-8 text-center text-sm text-slate-400">请选择一个字段</div>}
        </aside>
      </div>

      {isAdmin && <div className="flex items-center gap-3 border-t border-slate-200 bg-white px-4 py-3">
        <div className="min-w-0 flex-1 text-xs text-slate-500">{changes.length ? <><span className="font-medium text-slate-800">待保存 {changes.length} 项</span> · {changes.join('、')}</> : '所有字段修改均已保存'}</div>
        <button disabled={!changes.length} onClick={discard} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-30">放弃修改</button>
        <button disabled={!changes.length} onClick={save} className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-30"><Save size={14} />保存修改</button>
      </div>}

      {ordering && <ManualOrderModal field={ordering} onClose={() => setOrdering(null)} onSave={(isOrdered, orderedValues) => {
        setDraft(current => ({ ...current, fields: current.fields.map(field => field.key === ordering.key ? { ...field, isOrdered, orderedValues } : field) }));
        note(`调整 ${ordering.name} 排序`); setOrdering(null);
      }} />}
      {enriching && <FieldAIEnrichModal datasetId={dataset.id} field={enriching} onClose={() => {
        setEnriching(null); const latest = useDatasetStore.getState().getDataset(dataset.id); if (latest) setDraft(latest);
      }} />}
    </div>
  );
}
