'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, Check, Loader2, MapPinned, Save, Settings2, SlidersHorizontal, UserRoundSearch } from 'lucide-react';
import { useDatasetStore } from '@/store/datasetStore';
import { buildDefaultStatusGroups } from '@/lib/viewConfig';
import { detectTimeField } from '@/lib/timeStatus';
import { DateBlockEditor } from './DateBlockEditor';
import { StatusGroupEditor } from './StatusGroupEditor';
import { PersonaTemplatePanel } from '@/components/persona/PersonaTemplatePanel';
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

  return <div className="mx-auto max-w-5xl space-y-5 pb-8">
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white"><Settings2 size={16} /></div>
        <div><h3 className="text-sm font-semibold text-slate-900">数据角色</h3>
          <p className="mt-1 text-xs text-slate-500">指定各页面共同使用的状态、时间和地区字段。</p></div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <FieldSelect label="订单状态字段" value={draft.statusFieldKey} fields={categorical} onChange={value => {
          setDraft(current => ({ ...current,
            statusFieldKey: value,
            statusGroups: value ? buildDefaultStatusGroups(uniqueValues(dataset, value)) : [],
          }));
          setSaveState('idle');
        }} />
        <div><div className="text-xs font-medium text-slate-600">时间字段</div>
          <div className="mt-1.5 flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
            {timeField?.name ?? '未识别到日期字段'}
          </div><p className="mt-1 text-[10px] text-slate-400">由日期字段类型自动识别，需调整时请前往字段处理。</p></div>
      </div>
      {draft.statusFieldKey ? <div className="mt-4 rounded-lg bg-slate-50 p-3">
        <div className="mb-2 flex items-center justify-between gap-3"><span className="text-[11px] font-medium text-slate-500">状态分组预览</span>
          <button type="button" onClick={() => setEditingStatus(true)} className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 hover:border-blue-300 hover:text-blue-700"><SlidersHorizontal size={11} />编辑分组</button></div>
        <div className="flex flex-wrap gap-2">{(draft.statusGroups ?? []).map(group =>
          <span key={group.key} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600">{group.label}</span>)}</div>
      </div> : null}
      <div className="mt-5 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
        {saveState === 'error' && <span className="text-xs text-red-600">保存失败，请确认管理员权限和网络状态</span>}
        {saveState === 'saved' && <span className="flex items-center gap-1 text-xs text-emerald-600"><Check size={13} />已保存，各页面立即生效</span>}
        <button type="button" onClick={saveGlobalSettings} disabled={saveState === 'saving'} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60">
          {saveState === 'saving' ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}保存全局设置
        </button>
      </div>
    </section>

    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-5 flex items-start gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><MapPinned size={17} /></div>
        <div><h3 className="text-sm font-semibold text-slate-900">地区字段</h3><p className="mt-1 text-xs text-slate-500">区域筛选、地域对比和区域特征会统一使用这些设置。</p></div></div>
      <div className="grid gap-4 md:grid-cols-3">
        <FieldSelect label="大区" value={draft.geoRegionKey} fields={categorical} onChange={value => patch('geoRegionKey', value)} />
        <FieldSelect label="省份" value={draft.geoProvinceKey} fields={categorical} onChange={value => patch('geoProvinceKey', value)} />
        <FieldSelect label="城市" value={draft.geoCityKey} fields={categorical} onChange={value => patch('geoCityKey', value)} />
      </div>
    </section>

    <section className="rounded-xl border border-slate-200 bg-white p-1">
      <div className="flex items-center gap-2 px-4 pt-4 text-sm font-semibold text-slate-900"><CalendarRange size={16} className="text-blue-600" />时间分块</div>
      <div className="p-3"><DateBlockEditor dataset={dataset} /></div>
    </section>

    <section className="rounded-xl border border-slate-200 bg-white p-1">
      <div className="flex items-center gap-2 px-4 pt-4 text-sm font-semibold text-slate-900"><UserRoundSearch size={16} className="text-blue-600" />用户画像模板</div>
      <div className="p-3"><PersonaTemplatePanel dataset={dataset} /></div>
    </section>
    {editingStatus && draft.statusFieldKey && <StatusGroupEditor
      allValues={uniqueValues(dataset, draft.statusFieldKey)}
      groups={draft.statusGroups ?? []}
      onSave={groups => { setDraft(current => ({ ...current, statusGroups: groups })); setSaveState('idle'); }}
      onClose={() => setEditingStatus(false)}
    />}
  </div>;
}
