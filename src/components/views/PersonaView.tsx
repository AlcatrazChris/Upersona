'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Filter, MapPin, ChevronDown, Check, Settings2, Pencil } from 'lucide-react';
import { aggregateField } from '@/lib/dataAggregator';
import { filterRecords, getGeoOptions, getStatusOptions, type GeoLevel } from '@/lib/filterRecords';
import { ChartRenderer, type ChartType } from '@/components/charts/engine/ChartRenderer';
import { ChartSettingsPanel } from '@/components/charts/ChartSettingsPanel';
import { DEFAULT_CHART_CONFIG, loadChartConfig, saveChartConfig, type ChartConfig } from '@/lib/chartConfig';
import type { Dataset, Field } from '@/types/dataSchema';
import type { ViewConfig } from '@/lib/viewConfig';
import { useDatasetStore } from '@/store/datasetStore';
import { PersonaDashboard } from '@/components/persona/PersonaDashboard';
import { useIsAdmin } from '@/lib/auth';
import { cn } from '@/lib/utils';

// ── Geo dropdown (multi-select) ───────────────────────────────

function GeoDropdown({
  options, selected, onChange, placeholder,
}: {
  options:     string[];
  selected:    string[];
  onChange:    (v: string[]) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);

  function toggle(v: string) {
    onChange(selected.includes(v) ? selected.filter(s => s !== v) : [...selected, v]);
  }

  const label =
    selected.length === 0 ? placeholder :
    selected.length === 1 ? selected[0] :
    `${selected.length} 个地区`;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition-all',
          selected.length > 0
            ? 'bg-blue-50 border-blue-200 text-blue-700'
            : 'bg-white border-gray-200 text-gray-500 hover:border-blue-300',
        )}
      >
        <MapPin size={11} />
        {label}
        <ChevronDown size={10} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-8 left-0 bg-white border border-gray-200 rounded-xl shadow-xl p-2 min-w-[140px] max-h-52 overflow-y-auto">
            <button
              onClick={() => { onChange([]); setOpen(false); }}
              className="w-full text-left text-xs px-2 py-1.5 rounded-lg hover:bg-gray-50 text-gray-500 flex items-center gap-1.5"
            >
              {selected.length === 0 && <Check size={10} className="text-blue-500" />}
              {selected.length > 0   && <div className="w-[10px]" />}
              全国
            </button>
            {options.map(v => (
              <button
                key={v}
                onClick={() => toggle(v)}
                className="w-full text-left text-xs px-2 py-1.5 rounded-lg hover:bg-gray-50 text-gray-700 flex items-center gap-1.5"
              >
                {selected.includes(v)
                  ? <Check size={10} className="text-blue-500 flex-shrink-0" />
                  : <div className="w-[10px] flex-shrink-0" />}
                {v}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Per-card chart card ────────────────────────────────────────

function PersonaChartCard({
  field,
  filteredRecords,
  config,
  datasetId,
}: {
  field:           Field;
  filteredRecords: Record<string, unknown>[];
  config:          ChartConfig;   // global config (from filter bar)
  datasetId:       string;
}) {
  const { updateFieldOrdering } = useDatasetStore();
  const data   = useMemo(() => aggregateField(filteredRecords, field), [filteredRecords, field]);
  const validN = data.reduce((s, d) => s + d.count, 0);

  const [chartType, setChartType] = useState<ChartType>('bar');
  // localCfg: null = follow global; non-null = card-level override
  const [localCfg, setLocalCfg] = useState<ChartConfig | null>(null);
  // manualH: 用户拖拽覆盖；null 时跟随有效配置的 chartHeight
  const [manualH,  setManualH]  = useState<number | null>(null);

  const effective = localCfg ?? config;
  const cardH     = manualH ?? effective.chartHeight;

  const resizeRef = useRef<{ startY: number; startH: number } | null>(null);
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    resizeRef.current = { startY: e.clientY, startH: cardH };
    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      setManualH(Math.max(120, resizeRef.current.startH + (ev.clientY - resizeRef.current.startY)));
    };
    const onUp = () => {
      resizeRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 relative group select-none">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">{field.name}</h3>
          <p className="text-xs text-gray-400 mt-0.5">有效样本 n={validN.toLocaleString()}</p>
        </div>

        {/* Hover toolbar: chart type switcher + settings */}
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Chart type switcher */}
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
            {(['bar', 'pie', 'donut'] as ChartType[]).map(t => (
              <button
                key={t}
                onClick={() => setChartType(t)}
                className={cn(
                  'text-[10px] px-2 py-1 rounded-md transition-all',
                  chartType === t
                    ? 'bg-white text-gray-800 shadow-sm font-medium'
                    : 'text-gray-400 hover:text-gray-600',
                )}
              >
                {t === 'bar' ? '条' : t === 'pie' ? '饼' : '环'}
              </button>
            ))}
          </div>

          {/* Per-card chart settings (includes field ordering) */}
          <ChartSettingsPanel
            config={effective}
            onChange={c => { setLocalCfg(c); setManualH(null); }}
            field={field}
            onUpdateOrdering={(isOrdered, orderedValues) =>
              updateFieldOrdering(datasetId, field.key, isOrdered, orderedValues)
            }
          />

          {/* Reset local override back to global config */}
          {localCfg && (
            <button
              onClick={() => { setLocalCfg(null); setManualH(null); }}
              title="恢复全局设置"
              className="text-[10px] text-gray-400 hover:text-blue-500 px-1 leading-none"
            >
              ↺
            </button>
          )}
        </div>
      </div>

      {/* Chart */}
      <ChartRenderer
        type={chartType}
        data={data.slice(0, 10)}
        config={{ ...effective, chartHeight: cardH, showSampleCount: false }}
        isMultiSelect={field.type === 'multi_choice'}
        totalSamples={filteredRecords.length}
        height={cardH}
      />

      {/* Resize handle */}
      <div
        onMouseDown={handleResizeStart}
        className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-16 h-4 flex items-center justify-center cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity"
        title="拖动调整高度"
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full hover:bg-blue-300 transition-colors" />
      </div>
    </div>
  );
}

// ── PersonaView ───────────────────────────────────────────────

interface Props {
  dataset:    Dataset;
  viewConfig: ViewConfig;
  onConfig:   () => void;
}

const PERSONA_DEFAULT: ChartConfig = {
  ...DEFAULT_CHART_CONFIG,
  colorScheme: 'forest',
  showLabel:   true,
  showXAxis:   false,
  showGrid:    false,
};

export function PersonaView({ dataset, viewConfig, onConfig }: Props) {
  const { personaConfigs, activePersonaConfigId, setActivePersonaConfigId, updatePersonaConfig } = useDatasetStore();
  const configs      = personaConfigs[dataset.id] ?? [];
  const activeConfig = configs.find(c => c.id === activePersonaConfigId);

  // ── All hooks MUST be declared before any conditional return ──
  const isAdmin         = useIsAdmin();
  const [dashMode,      setDashMode]      = useState(!!activeConfig);
  // 改名状态
  const [editingName,   setEditingName]   = useState(false);
  const [nameInput,     setNameInput]     = useState('');

  // 配置完成后自动进入看板模式
  useEffect(() => {
    if (activeConfig) setDashMode(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConfig?.id]);
  const [geoLevel,      setGeoLevel]      = useState<GeoLevel>('all');
  const [selectedGeo,   setSelectedGeo]   = useState<string[]>([]);
  const [selStatus,     setSelStatus]     = useState<string[]>(['__all']);
  const [globalConfig,  setGlobalConfig]  = useState<ChartConfig>(
    () => ({ ...PERSONA_DEFAULT, ...loadChartConfig('persona') }),
  );

  const handleConfigChange = (c: ChartConfig) => {
    setGlobalConfig(c);
    saveChartConfig('persona', c);
  };

  const geoOptions    = useMemo(
    () => getGeoOptions(dataset.records, viewConfig, geoLevel),
    [dataset, viewConfig, geoLevel],
  );
  const statusOptions = useMemo(
    () => getStatusOptions(dataset.records, viewConfig),
    [dataset, viewConfig],
  );
  const filteredRecords = useMemo(
    () => filterRecords(dataset.records, viewConfig, geoLevel, selectedGeo, selStatus),
    [dataset.records, viewConfig, geoLevel, selectedGeo, selStatus],
  );
  const personaFields = useMemo(
    () => {
      // 有活跃画像配置时，图表模式也按配置字段顺序展示
      if (activeConfig) {
        return activeConfig.blocks
          .filter(b => b.visible && b.sourceFieldKey)
          .map(b => dataset.fields.find(f => f.key === b.sourceFieldKey))
          .filter(Boolean) as Field[];
      }
      return (viewConfig.personaFieldKeys ?? [])
        .map(k => dataset.fields.find(f => f.key === k))
        .filter(Boolean) as Field[];
    },
    [dataset.fields, viewConfig.personaFieldKeys, activeConfig],
  );

  // ── Dashboard mode (safe early-return — all hooks already called) ──
  if (dashMode && activeConfig) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 px-1">
          {/* 画像选择 */}
          {configs.length > 1 ? (
            <select
              value={activeConfig.id}
              onChange={e => setActivePersonaConfigId(e.target.value || null)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 outline-none bg-white"
            >
              {configs.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          ) : (
            /* 单个画像时：点击可改名 */
            editingName ? (
              <input
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onBlur={() => {
                  if (nameInput.trim()) updatePersonaConfig(dataset.id, activeConfig.id, { name: nameInput.trim() });
                  setEditingName(false);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    if (nameInput.trim()) updatePersonaConfig(dataset.id, activeConfig.id, { name: nameInput.trim() });
                    setEditingName(false);
                  }
                  if (e.key === 'Escape') setEditingName(false);
                }}
                autoFocus
                className="text-sm border border-blue-300 rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-100 bg-white w-40"
              />
            ) : (
              <button
                onClick={() => { setNameInput(activeConfig.name); setEditingName(true); }}
                title="点击改名"
                className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-blue-600 group"
              >
                {activeConfig.name}
                <Pencil size={11} className="text-gray-300 group-hover:text-blue-400 transition-colors" />
              </button>
            )
          )}
          <button
            onClick={() => setDashMode(false)}
            className="text-xs px-3 py-1.5 rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 transition-all"
          >
            切换到图表模式
          </button>
          {isAdmin && (
            <button
              onClick={() => onConfig()}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-violet-600 text-white hover:bg-violet-700 transition-all shadow-sm"
            >
              <Settings2 size={12} />
              配置画像
            </button>
          )}
          <span className="text-xs text-gray-400">
            {activeConfig.blocks.filter(b => b.visible).length} 个区块
          </span>
        </div>
        <PersonaDashboard dataset={dataset} config={activeConfig} />
      </div>
    );
  }

  const geoLabel =
    selectedGeo.length === 0 ? '全国' :
    selectedGeo.length === 1 ? selectedGeo[0] :
    `${selectedGeo.length} 个地区`;

  const geoLevels = ([
    { key: 'region'   as GeoLevel, label: '大区', fieldKey: viewConfig.geoRegionKey   },
    { key: 'province' as GeoLevel, label: '省份', fieldKey: viewConfig.geoProvinceKey },
    { key: 'city'     as GeoLevel, label: '城市', fieldKey: viewConfig.geoCityKey     },
  ] as const).filter(l => l.fieldKey);

  const changeGeoLevel = (lv: GeoLevel) => { setGeoLevel(lv); setSelectedGeo([]); };

  return (
    <div className="space-y-4">

      {/* ── Filter bar ─────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 space-y-3">

        {/* Row 1: Geo filter + chart settings + view toggles */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 flex items-center gap-1 flex-shrink-0">
            <Filter size={11} />
            筛选地区
          </span>

          <button
            onClick={() => { setGeoLevel('all'); setSelectedGeo([]); }}
            className={cn(
              'text-xs px-2.5 py-1 rounded-lg transition-all',
              geoLevel === 'all' && selectedGeo.length === 0
                ? 'bg-blue-600 text-white font-medium'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
            )}
          >
            全国
          </button>

          {geoLevels.map(l => (
            <button
              key={l.key}
              onClick={() => changeGeoLevel(l.key)}
              className={cn(
                'text-xs px-2.5 py-1 rounded-lg transition-all',
                geoLevel === l.key
                  ? 'bg-blue-600 text-white font-medium'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
              )}
            >
              {l.label}
            </button>
          ))}

          {geoLevel !== 'all' && geoOptions.length > 0 && (
            <GeoDropdown
              options={geoOptions}
              selected={selectedGeo}
              onChange={setSelectedGeo}
              placeholder={`选择${geoLevels.find(l => l.key === geoLevel)?.label ?? ''}`}
            />
          )}

          {selectedGeo.length > 0 && (
            <button
              onClick={() => setSelectedGeo([])}
              className="text-xs text-gray-400 hover:text-gray-600 px-1"
            >
              清空
            </button>
          )}

          {/* Right-side controls */}
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            <span className="text-sm text-gray-500">
              <span className="text-gray-400">{geoLabel}</span>
              <span className="mx-1.5 text-gray-300">·</span>
              <span className="font-semibold text-gray-700">
                {filteredRecords.length.toLocaleString()}
              </span>
              <span className="text-gray-400 ml-1">个样本</span>
            </span>

            <div className="w-px h-4 bg-gray-200" />

            {/* Global chart settings */}
            <ChartSettingsPanel config={globalConfig} onChange={handleConfigChange} />

            {configs.length > 0 && (
              <button
                onClick={() => {
                  if (!activePersonaConfigId && configs.length > 0) setActivePersonaConfigId(configs[0].id);
                  setDashMode(true);
                }}
                className="text-xs px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all"
              >
                画像看板
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => onConfig()}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-violet-600 text-white hover:bg-violet-700 transition-all shadow-sm"
              >
                <Settings2 size={12} />
                配置画像
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Status filter */}
        {viewConfig.statusFieldKey && statusOptions.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400 flex-shrink-0">订单状态</span>
            <button
              onClick={() => setSelStatus(['__all'])}
              className={cn(
                'text-xs px-3 py-1 rounded-full transition-all',
                selStatus.includes('__all')
                  ? 'bg-gray-800 text-white font-medium'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
              )}
            >
              全部
            </button>
            {statusOptions.map(v => (
              <button
                key={v}
                onClick={() => setSelStatus([v])}
                className={cn(
                  'text-xs px-3 py-1 rounded-full transition-all',
                  selStatus.includes(v)
                    ? 'bg-blue-600 text-white font-medium'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
                )}
              >
                {v}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Chart grid ─────────────────────────────────────── */}
      {personaFields.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          暂无配置的人口维度字段。请在数据中心的字段概览中配置字段后返回。
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {personaFields.map(field => (
            <PersonaChartCard
              key={field.key}
              field={field}
              filteredRecords={filteredRecords}
              config={globalConfig}
              datasetId={dataset.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
