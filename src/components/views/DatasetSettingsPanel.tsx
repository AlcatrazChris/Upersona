'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, Check, Loader2, Plus, Save, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useDatasetStore } from '@/store/datasetStore';
import { buildDefaultStatusGroups } from '@/lib/viewConfig';
import { detectTimeField } from '@/lib/timeStatus';
import { DateBlockEditor } from './DateBlockEditor';
import { StatusGroupEditor } from './StatusGroupEditor';
import type { Dataset } from '@/types/dataSchema';
import type { StatusVariable, ViewConfig } from '@/lib/viewConfig';

const T = {
  unset: '\u672a\u8bbe\u7f6e', status: '\u72b6\u6001\u53d8\u91cf', add: '\u65b0\u589e\u72b6\u6001\u53d8\u91cf', unnamed: '\u672a\u547d\u540d\u53d8\u91cf',
  name: '\u53d8\u91cf\u540d\u79f0', field: '\u5bf9\u5e94\u5b57\u6bb5', timeField: '\u65f6\u95f4\u5b57\u6bb5', noTime: '\u672a\u8bc6\u522b\u5230\u65e5\u671f\u5b57\u6bb5',
  config: '\u72b6\u6001\u914d\u7f6e', edit: '\u7f16\u8f91\u72b6\u6001', empty: '\u6682\u65e0\u72b6\u6001\u53d8\u91cf',
  emptyHelp: '\u65b0\u589e\u53d8\u91cf\u540e\uff0c\u53ef\u81ea\u7531\u8bbe\u7f6e\u540d\u79f0\u3001\u5bf9\u5e94\u5b57\u6bb5\u548c\u72b6\u6001\u5206\u7ec4\u3002',
  delete: '\u5220\u9664', confirmDelete: '\u5220\u9664\u8be5\u72b6\u6001\u53d8\u91cf\uff1f\u4fdd\u5b58\u6570\u636e\u96c6\u8bbe\u7f6e\u540e\u5c06\u65e0\u6cd5\u6062\u590d\u3002', geoTime: '\u5730\u533a\u4e0e\u65f6\u95f4', region: '\u5927\u533a', province: '\u7701\u4efd', city: '\u57ce\u5e02',
  timeBlocks: '\u65f6\u95f4\u5206\u5757', save: '\u4fdd\u5b58\u6570\u636e\u96c6\u8bbe\u7f6e', saved: '\u5df2\u4fdd\u5b58',
  saving: '\u6b63\u5728\u4fdd\u5b58',
  error: '\u4fdd\u5b58\u5931\u8d25\uff0c\u8bf7\u786e\u8ba4\u7ba1\u7406\u5458\u6743\u9650\u548c\u7f51\u7edc\u72b6\u6001',
};

function FieldSelect({ label, value, fields, onChange }: { label: string; value?: string; fields: Dataset['fields']; onChange: (value: string) => void }) {
  return <label className="block text-xs font-medium text-slate-600">{label}
    <select value={value ?? ''} onChange={event => onChange(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus-visible:ring-2 focus-visible:ring-[#007AFF]">
      <option value="">{T.unset}</option>
      {fields.map(field => <option key={field.key} value={field.key}>{field.name}</option>)}
    </select>
  </label>;
}

function uniqueValues(dataset: Dataset, key?: string) {
  return key ? [...new Set(dataset.records.map(record => String(record[key] ?? '').trim()).filter(Boolean))] : [];
}

export function DatasetSettingsPanel({ dataset }: { dataset: Dataset }) {
  const { viewConfigs, updateViewConfig } = useDatasetStore();
  const config = viewConfigs[dataset.id] ?? {};
  const [draft, setDraft] = useState<ViewConfig>(config);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [editingStatus, setEditingStatus] = useState(false);
  const categorical = useMemo(() => dataset.fields.filter(field => ['single_choice', 'multi_choice', 'text'].includes(field.type)), [dataset.fields]);
  const timeField = useMemo(() => detectTimeField(dataset), [dataset]);
  const variables: StatusVariable[] = draft.statusVariables ?? (draft.statusFieldKey ? [{ id: 'default', name: draft.statusVariableName?.trim() || T.status, fieldKey: draft.statusFieldKey, groups: draft.statusGroups ?? [] }] : []);
  const activeId = draft.activeStatusVariableId ?? variables[0]?.id;
  const active = variables.find(item => item.id === activeId);

  useEffect(() => setDraft(config), [dataset.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function patch(key: keyof ViewConfig, value: string | undefined) {
    setDraft(current => ({ ...current, [key]: value })); setSaveState('idle');
  }

  function commitVariables(items: StatusVariable[], requestedId?: string) {
    const selected = items.find(item => item.id === requestedId) ?? items[0];
    setDraft(current => ({ ...current, statusVariables: items, activeStatusVariableId: selected?.id, statusVariableName: selected?.name, statusFieldKey: selected?.fieldKey ?? '', statusGroups: selected?.groups ?? [] }));
    setSaveState('idle');
  }

  function updateActive(change: Partial<StatusVariable>) {
    if (active) commitVariables(variables.map(item => item.id === active.id ? { ...item, ...change } : item), active.id);
  }

  function addVariable() {
    const item = { id: `status_${Date.now().toString(36)}`, name: `${T.status} ${variables.length + 1}`, fieldKey: '', groups: [] };
    commitVariables([...variables, item], item.id);
  }

  function removeVariable(id: string) {
    if (!window.confirm(T.confirmDelete)) return;
    const remaining = variables.filter(item => item.id !== id);
    const nextId = id === activeId ? remaining[0]?.id : activeId;
    commitVariables(remaining, nextId);
    requestAnimationFrame(() => document.getElementById(nextId ? `status-variable-${nextId}` : 'add-status-variable')?.focus());
  }

  async function save() {
    setSaveState('saving');
    try {
      if (dataset.source === 'supabase') {
        const response = await fetch(`/api/datasets/${dataset.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ viewConfig: draft }) });
        if (!response.ok) throw new Error('save failed');
      }
      updateViewConfig(dataset.id, draft);
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  }

  return <div className="space-y-6">
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-900">{T.status}</h3>
        <button id="add-status-variable" type="button" onClick={addVariable} className="flex h-9 items-center gap-1.5 rounded-xl border border-[#007AFF]/30 bg-white px-3 text-xs font-medium text-[#007AFF] hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] focus-visible:ring-offset-2"><Plus size={14} />{T.add}</button>
      </div>
      <div className="rounded-2xl bg-white p-5">
        {variables.length ? <>
          <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label={T.status}>
            {variables.map(item => <div key={item.id} className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button id={`status-variable-${item.id}`} type="button" aria-pressed={item.id === activeId} onClick={() => commitVariables(variables, item.id)} className={`h-8 rounded-lg px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] ${item.id === activeId ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>{item.name || T.unnamed}</button>
              <button type="button" onClick={() => removeVariable(item.id)} aria-label={`${T.delete}${item.name || T.unnamed}`} className="ml-0.5 grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"><Trash2 size={13} /></button>
            </div>)}
          </div>
          {active && <div className="grid gap-4 md:grid-cols-3">
            <label className="block text-xs font-medium text-slate-600">{T.name}<input value={active.name} onChange={event => updateActive({ name: event.target.value })} className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus-visible:ring-2 focus-visible:ring-[#007AFF]" /></label>
            <FieldSelect label={T.field} value={active.fieldKey} fields={categorical} onChange={fieldKey => updateActive({ fieldKey, groups: fieldKey ? buildDefaultStatusGroups(uniqueValues(dataset, fieldKey)) : [] })} />
            <div><div className="text-xs font-medium text-slate-600">{T.timeField}</div><div className="mt-1.5 flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">{timeField?.name ?? T.noTime}</div></div>
            {active.fieldKey && <div className="rounded-xl bg-slate-50 p-4 md:col-span-3">
              <div className="mb-3 flex items-center justify-between gap-3"><span className="text-[13px] font-medium text-slate-600">{T.config}</span><button type="button" onClick={() => setEditingStatus(true)} className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-600 hover:border-blue-300 hover:text-blue-700"><SlidersHorizontal size={13} />{T.edit}</button></div>
              <div className="flex flex-wrap gap-2">{active.groups.map(group => <span key={group.key} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600">{group.label}</span>)}</div>
            </div>}
          </div>}
        </> : <div className="flex min-h-32 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-6 text-center"><p className="text-sm font-medium text-slate-700">{T.empty}</p><p className="mt-1 text-xs text-slate-500">{T.emptyHelp}</p></div>}
      </div>
    </section>

    <section>
      <h3 className="mb-4 text-lg font-semibold text-slate-900">{T.geoTime}</h3>
      <div className="grid gap-4 rounded-2xl bg-white p-5 md:grid-cols-3"><FieldSelect label={T.region} value={draft.geoRegionKey} fields={categorical} onChange={value => patch('geoRegionKey', value)} /><FieldSelect label={T.province} value={draft.geoProvinceKey} fields={categorical} onChange={value => patch('geoProvinceKey', value)} /><FieldSelect label={T.city} value={draft.geoCityKey} fields={categorical} onChange={value => patch('geoCityKey', value)} /></div>
      <div className="mt-4 rounded-2xl bg-white p-1"><div className="flex items-center gap-2 px-4 pt-4 text-sm font-semibold text-slate-900"><CalendarRange size={16} className="text-blue-600" />{T.timeBlocks}</div><div className="p-3"><DateBlockEditor dataset={dataset} /></div></div>
    </section>

    <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t border-black/[0.06] bg-[#F5F5F7]/95 py-4 backdrop-blur">
      <span role="status" aria-live="polite" className="text-xs">{saveState === 'saving' && <span className="text-slate-600">{T.saving}</span>}{saveState === 'error' && <span className="text-red-600">{T.error}</span>}{saveState === 'saved' && <span className="flex items-center gap-1 text-emerald-700"><Check size={13} />{T.saved}</span>}</span>
      <button type="button" onClick={save} disabled={saveState === 'saving'} className="flex h-10 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">{saveState === 'saving' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}{T.save}</button>
    </div>

    {editingStatus && active?.fieldKey && <StatusGroupEditor allValues={uniqueValues(dataset, active.fieldKey)} groups={active.groups} onSave={groups => updateActive({ groups })} onClose={() => setEditingStatus(false)} />}
  </div>;
}
