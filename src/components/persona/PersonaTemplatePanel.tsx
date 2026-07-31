'use client';

import { useMemo, useState } from 'react';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { useDatasetStore } from '@/store/datasetStore';
import {
  PERSONA_ROLE_META,
  PERSONA_CHART_LABELS,
  autoPersonaChartSpec,
  defaultPersonaChart,
  inferPersonaRole,
  personaChartOptions,
  type PersonaChartSpec,
  type PersonaChartType,
  type PersonaSemanticRole,
} from '@/lib/personaTemplate';
import type { Dataset } from '@/types/dataSchema';

export function PersonaTemplatePanel({ dataset }: { dataset: Dataset }) {
  const { viewConfigs, updateViewConfig } = useDatasetStore();
  const config = viewConfigs[dataset.id] ?? {};
  const selected = new Set(config.personaFieldKeys ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fields = useMemo(() => dataset.fields.map(field => ({
    field,
    role: config.personaRoles?.[field.key] ?? inferPersonaRole(field),
  })).sort((a, b) =>
    PERSONA_ROLE_META[a.role].order - PERSONA_ROLE_META[b.role].order
  ), [dataset.fields, config.personaRoles]);

  function patchField(key: string, role: PersonaSemanticRole, included: boolean) {
    updateViewConfig(dataset.id, {
      personaFieldKeys: included
        ? [...new Set([...(config.personaFieldKeys ?? []), key])]
        : (config.personaFieldKeys ?? []).filter(item => item !== key),
      personaRoles: { ...(config.personaRoles ?? {}), [key]: role },
    });
  }

  function patchChart(key: string, patch: Partial<PersonaChartSpec>) {
    const field = dataset.fields.find(item => item.key === key);
    if (!field) return;
    updateViewConfig(dataset.id, {
      personaCharts: {
        ...(config.personaCharts ?? {}),
        [key]: {
          type: config.personaCharts?.[key]?.type ?? defaultPersonaChart(field),
          ...config.personaCharts?.[key],
          ...patch,
        },
      },
    });
  }

  async function analyze() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/fields/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'persona',
          fields: dataset.fields.map(field => ({
            key: field.key,
            name: field.name,
            type: field.type,
            unique: field.statistics?.unique ?? field.options?.length ?? 0,
            missingRate: (field.statistics?.missing ?? 0) / Math.max(1, dataset.rowCount),
            values: field.options?.slice(0, 20)
              ?? field.statistics?.topValues?.map(item => item.value).slice(0, 20)
              ?? [],
          })),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'AI语义识别失败');
      updateViewConfig(dataset.id, {
        personaFieldKeys: result.personaFieldKeys,
        personaRoles: result.roles,
        personaRoleReasons: result.reasons,
        personaCharts: Object.fromEntries(
          Object.entries(result.chartTypes ?? {}).map(([key, rawType]) => {
            const field = dataset.fields.find(item => item.key === key);
            const type = rawType as PersonaChartType;
            return [key, field ? autoPersonaChartSpec(field, type, dataset.fields) : { type }];
          }),
        ),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'AI语义识别失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="ui-control-panel flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-slate-900">用户画像模板</h2>
          <p className="mt-1 text-xs text-slate-500">这里是画像页面的唯一配置来源，修改后立即同步。</p>
        </div>
        <button type="button" onClick={analyze} disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {loading ? '正在识别…' : 'AI识别语义角色'}
        </button>
      </div>
      {error && <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <div className="grid min-w-[880px] grid-cols-[44px_minmax(150px,1fr)_150px_150px_minmax(220px,1fr)] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-500">
          <span>启用</span><span>字段</span><span>画像角色</span><span>图表类型</span><span>关联字段 / 识别依据</span>
        </div>
        {fields.map(({ field, role }) => {
          const included = selected.has(field.key);
          return (
            <div key={field.key} className="grid min-w-[880px] grid-cols-[44px_minmax(150px,1fr)_150px_150px_minmax(220px,1fr)] items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0">
              <button type="button" aria-label={`${included ? '移除' : '加入'}画像字段 ${field.name}`}
                aria-pressed={included} onClick={() => patchField(field.key, role, !included)}
                className={`flex h-6 w-6 items-center justify-center rounded border ${included ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-transparent'}`}>
                <Check size={14} />
              </button>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-800">{field.name}</div>
                <div className="truncate text-xs text-slate-400">{field.key}</div>
              </div>
              <select value={role} onChange={event => {
                const next = event.target.value as PersonaSemanticRole;
                patchField(field.key, next, next === 'metadata' ? false : included);
              }} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700">
                {Object.entries(PERSONA_ROLE_META).map(([key, meta]) => (
                  <option key={key} value={key}>{meta.label}</option>
                ))}
              </select>
              <select
                value={config.personaCharts?.[field.key]?.type ?? defaultPersonaChart(field)}
                onChange={event => {
                  const type = event.target.value as PersonaChartType;
                  patchChart(field.key, autoPersonaChartSpec(field, type, dataset.fields));
                }}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700"
              >
                {personaChartOptions(field).map(type => (
                  <option key={type} value={type}>{PERSONA_CHART_LABELS[type]}</option>
                ))}
              </select>
              <div className="min-w-0">
                {['scatter', 'heatmap', 'dumbbell'].includes(config.personaCharts?.[field.key]?.type ?? '') && (
                  <div className="mb-1 flex gap-1">
                    <select value={config.personaCharts?.[field.key]?.secondaryFieldKey ?? ''}
                      aria-label={`${field.name} 关联字段`}
                      onChange={event => patchChart(field.key, { secondaryFieldKey: event.target.value || undefined })}
                      className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-1.5 text-xs text-slate-600">
                      <option value="">选择关联字段</option>
                      {dataset.fields.filter(item => item.key !== field.key).map(item => (
                        <option key={item.key} value={item.key}>{item.name}</option>
                      ))}
                    </select>
                    {config.personaCharts?.[field.key]?.type === 'dumbbell' && (
                      <select value={config.personaCharts?.[field.key]?.endFieldKey ?? ''}
                        aria-label={`${field.name} 结束字段`}
                        onChange={event => patchChart(field.key, { endFieldKey: event.target.value || undefined })}
                        className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-1.5 text-xs text-slate-600">
                        <option value="">选择结束字段</option>
                        {dataset.fields.filter(item => item.key !== field.key).map(item => (
                          <option key={item.key} value={item.key}>{item.name}</option>
                        ))}
                      </select>
                    )}
                    {config.personaCharts?.[field.key]?.type === 'heatmap' && (
                      <select value={config.personaCharts?.[field.key]?.valueFieldKey ?? ''}
                        aria-label={`${field.name} 数值字段`}
                        onChange={event => patchChart(field.key, { valueFieldKey: event.target.value || undefined })}
                        className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-1.5 text-xs text-slate-600">
                        <option value="">计数</option>
                        {dataset.fields.filter(item => item.type === 'number').map(item => (
                          <option key={item.key} value={item.key}>{item.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
                <p className="line-clamp-2 text-xs leading-5 text-slate-500">
                  {config.personaRoleReasons?.[field.key] ?? PERSONA_ROLE_META[role].description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
