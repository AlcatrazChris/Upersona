'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, Check, Loader2, Save, SlidersHorizontal } from 'lucide-react';
import { useDatasetStore } from '@/store/datasetStore';
import { buildDefaultStatusGroups } from '@/lib/viewConfig';
import { detectTimeField } from '@/lib/timeStatus';
import { DateBlockEditor } from './DateBlockEditor';
import { StatusGroupEditor } from './StatusGroupEditor';
import type { Dataset } from '@/types/dataSchema';
import type { ViewConfig } from '@/lib/viewConfig';

function FieldSelect({ label, value, fields, onChange }: {
  label: string;
  value?: string;
  fields: Dataset['fields'];
  onChange: (value: string) => void;
}) {
  return <label className="block text-xs font-medium text-slate-600">{label}
    <select value={value ?? ''} onChange={event => onChange(event.target.value)}
      className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400">
      <option value="">未设置</option>
      {fields.map(field => <option key={field.key} value={field.key}>{field.name}</option>)}
    </select>
  </label>;
}

function uniqueValues(dataset: Dataset, key?: string) {
  if (!key) return [];
  return [...new Set(dataset.records.map(record => String(record[key] ?? '').trim()).filter(Boolean))];
}

export function DatasetSettingsPanel({ dataset }: { dataset: Dataset }) {
  const { viewConfigs, updateViewConfig } = useDatasetStore();
  const config = viewConfigs[dataset.id] ?? {};
  const [draft, setDraft] = useState<ViewConfig>(config);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const categorical = useMemo(() => dataset.fields.filter(field =>
    ['single_choice', 'multi_choice', 'text'].includes(field.type)), [dataset.fields]);
  const timeField = useMemo(() => detectTimeField(dataset), [dataset]);
  const [editingStatus, setEditingStatus] = useState(false);

  useEffect(() => setDraft(config), [dataset.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function patch(key: keyof ViewConfig, value: string | undefined) {
    setDraft(current => ({ ...current, [key]: value }));
    setSaveState('idle');
  }

  async function saveGlobalSettings() {
    setSaveState('saving');
    updateViewConfig(dataset.id, draft);
    if (dataset.source === 'supabase') {
      const response = await fetch(`/api/datasets/${dataset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ viewConfig: draft }),
      });
      if (!response.ok) { setSaveState('error'); return; }
    }
    setSaveState('saved');
  }

  return <div className="space-y-6">
    <section>
      <h3 className="mb-4 text-lg font-semibold text-slate-900">状态变量</h3>
      <div className="grid gap-4 rounded-2xl bg-white p-5 md:grid-cols-3">
        <label className="block text-xs font-medium text-slate-600">变量名称
          <input value={draft.statusVariableName ?? '状态变量'} onChange={event => patch('statusVariableName', event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400" />
        </label>
        <FieldSelect label="对应字段" value={draft.statusFieldKey} fields={categorical} onChange={value => {
          setDraft(current => ({ ...current,
            statusFieldKey: value,
            statusGroups: value ? buildDefaultStatusGroups(uniqueValues(dataset, value)) : [],
          }));
          setSaveState('idle');
        }} />
        <div><div className="text-xs font-medium text-slate-600">时间字段</div>
          <div className="mt-1.5 flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
            {timeField?.name ?? '未识别到日期字段'}
          </div></div>
        {draft.statusFieldKey ? <div className="md:col-span-3 rounded-xl bg-slate-50 p-4">
        <div className="mb-3 flex items-center justify-between gap-3"><span className="text-[13px] font-medium text-slate-600">状态配置</span>
          <button type="button" onClick={() => setEditingStatus(true)} className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-600 hover:border-blue-300 hover:text-blue-700"><SlidersHorizontal size={13} />编辑状态</button></div>
        <div className="flex flex-wrap gap-2">{(draft.statusGroups ?? []).map(group =>
          <span key={group.key} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600">{group.label}</span>)}</div>
      </div> : null}</div>
    </section>

    <section>
      <h3 className="mb-4 text-lg font-semibold text-slate-900">地区与时间</h3>
      <div className="grid gap-4 rounded-2xl bg-white p-5 md:grid-cols-3">
        <FieldSelect label="大区" value={draft.geoRegionKey} fields={categorical} onChange={value => patch('geoRegionKey', value)} />
        <FieldSelect label="省份" value={draft.geoProvinceKey} fields={categorical} onChange={value => patch('geoProvinceKey', value)} />
        <FieldSelect label="城市" value={draft.geoCityKey} fields={categorical} onChange={value => patch('geoCityKey', value)} />
      </div>
      <div className="mt-4 rounded-2xl bg-white p-1">
        <div className="flex items-center gap-2 px-4 pt-4 text-sm font-semibold text-slate-900"><CalendarRange size={16} className="text-blue-600" />时间分块</div>
        <div className="p-3"><DateBlockEditor dataset={dataset} /></div>
      </div>
    </section>
    <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t border-black/[0.06] bg-[#F5F5F7]/95 py-4 backdrop-blur">
      {saveState === 'error' && <span className="text-xs text-red-600">保存失败，请确认管理员权限和网络状态</span>}
      {saveState === 'saved' && <span className="flex items-center gap-1 text-xs text-emerald-600"><Check size={13} />已保存</span>}
      <button type="button" onClick={saveGlobalSettings} disabled={saveState === 'saving'} className="flex h-10 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
        {saveState === 'saving' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}保存数据集设置
      </button>
    </div>
    {editingStatus && draft.statusFieldKey && <StatusGroupEditor
      allValues={uniqueValues(dataset, draft.statusFieldKey)}
      groups={draft.statusGroups ?? []}
      onSave={groups => { setDraft(current => ({ ...current, statusGroups: groups })); setSaveState('idle'); }}
      onClose={() => setEditingStatus(false)}
    />}
  </div>;
}
