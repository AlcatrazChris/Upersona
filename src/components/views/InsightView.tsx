'use client';

import { useState, useMemo } from 'react';
import { Sparkles, RefreshCw, Loader2, Edit2, Check, X, ChevronDown } from 'lucide-react';
import { filterRecords, getStatusOptions, getGeoOptions, type GeoLevel } from '@/lib/filterRecords';
import { buildInsightContext, DEFAULT_INSIGHT_PROMPT, type ViewConfig, type StatusGroup } from '@/lib/viewConfig';
import { useDatasetStore } from '@/store/datasetStore';
import type { Dataset } from '@/types/dataSchema';

// ── Segment parser ────────────────────────────────────────────

interface Segment {
  label: string;   // 人群A
  title: string;
  bullets: string[];
}

function parseInsightResult(text: string): Segment[] {
  const segments: Segment[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let current: Segment | null = null;

  for (const line of lines) {
    if (/^人群[A-Za-z一二三四五六七八九十\d]/.test(line)) {
      if (current) segments.push(current);
      current = { label: line, title: '', bullets: [] };
    } else if (current && !current.title && !line.startsWith('•') && !line.startsWith('·') && !line.startsWith('-') && !line.startsWith('*')) {
      current.title = line;
    } else if (current && (line.startsWith('•') || line.startsWith('·') || line.startsWith('-') || line.startsWith('*'))) {
      current.bullets.push(line.replace(/^[•·\-*]\s*/, ''));
    } else if (current && current.title) {
      // continuation of last bullet
      if (current.bullets.length > 0) {
        current.bullets[current.bullets.length - 1] += ' ' + line;
      }
    }
  }
  if (current) segments.push(current);
  return segments;
}

// ── Stats header ──────────────────────────────────────────────

function StatsHeader({
  label, totalN, strongN, weakN, groupConfig,
}: {
  label: string;
  totalN: number;
  strongN: number;
  weakN: number;
  groupConfig: StatusGroup[];
}) {
  const strongPct = totalN > 0 ? (strongN / totalN) * 100 : 0;
  const strongGroup = groupConfig.find(g => g.intent === 'strong');
  const weakGroup   = groupConfig.find(g => g.intent === 'weak');

  return (
    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg font-bold">{label}</span>
            {strongGroup && (
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{strongGroup.label}</span>
            )}
          </div>
          <p className="text-sm text-blue-200">{label} · 核心用户画像 · AI 生成</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold tabular-nums">{strongPct.toFixed(1)}%</div>
          <div className="text-xs text-blue-200">强意向占比</div>
        </div>
      </div>
      <div className="flex items-center gap-4 text-sm mb-3">
        <span className="text-blue-200">
          总样本 <span className="text-white font-semibold">{totalN.toLocaleString()}</span>
        </span>
        {strongGroup && (
          <span className="text-blue-200">
            {strongGroup.label} <span className="text-white font-semibold">{strongPct.toFixed(1)}%</span>
          </span>
        )}
      </div>
      {/* Progress bar */}
      <div className="h-2 bg-white/20 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-400 rounded-full transition-all"
          style={{ width: `${Math.max(2, strongPct)}%` }}
        />
      </div>
    </div>
  );
}

// ── Segment card ──────────────────────────────────────────────

function SegmentCard({ segment, index }: { segment: Segment; index: number }) {
  const colors = ['blue', 'violet', 'amber'] as const;
  const color  = colors[index % colors.length];
  const labels: Record<typeof colors[number], string> = {
    blue: 'bg-blue-100 text-blue-700', violet: 'bg-violet-100 text-violet-700', amber: 'bg-amber-100 text-amber-700',
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="mb-3">
        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${labels[color]}`}>
          {segment.label}
        </span>
      </div>
      <h3 className="text-lg font-bold text-gray-800 mb-4">{segment.title || '（AI 未提供标题）'}</h3>
      <ul className="space-y-2.5">
        {segment.bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-600 leading-relaxed">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Prompt editor ─────────────────────────────────────────────

function PromptEditor({
  prompt, onSave, onClose,
}: {
  prompt: string;
  onSave: (p: string) => void;
  onClose: () => void;
}) {
  const [val, setVal] = useState(prompt);
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">编辑分析提示词</span>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X size={14} /></button>
      </div>
      <textarea
        value={val}
        onChange={e => setVal(e.target.value)}
        rows={10}
        className="w-full text-xs border border-gray-200 rounded-xl p-3 outline-none focus:border-blue-400 resize-none leading-relaxed text-gray-700 font-mono"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={() => setVal(DEFAULT_INSIGHT_PROMPT)}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          还原默认
        </button>
        <div className="flex-1" />
        <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-xl text-gray-500 hover:bg-gray-100">
          取消
        </button>
        <button
          onClick={() => { onSave(val); onClose(); }}
          className="text-xs px-4 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1"
        >
          <Check size={11} />
          保存并生成
        </button>
      </div>
    </div>
  );
}

// ── InsightView ───────────────────────────────────────────────

interface Props {
  dataset:    Dataset;
  viewConfig: ViewConfig;
}

export function InsightView({ dataset, viewConfig }: Props) {
  const { updateViewConfig, personaConfigs, activePersonaConfigId } = useDatasetStore();
  const activeConfig = (personaConfigs[dataset.id] ?? []).find(c => c.id === activePersonaConfigId);

  // Use persona config fields when available
  const insightFieldKeys = useMemo(() => {
    if (activeConfig) {
      return activeConfig.blocks
        .filter(b => b.visible && b.sourceFieldKey)
        .map(b => b.sourceFieldKey!);
    }
    return viewConfig.personaFieldKeys ?? [];
  }, [activeConfig, viewConfig.personaFieldKeys]);

  const [geoLevel,    setGeoLevel]    = useState<GeoLevel>('region');
  const [selectedGeo, setSelectedGeo] = useState<string[]>([]);
  const [selStatus,   setSelStatus]   = useState<string[]>(['__all']);
  const [editPrompt,  setEditPrompt]  = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  const statusOptions = useMemo(
    () => viewConfig.statusGroups?.map(g => ({ key: g.key, label: g.label, values: g.values })) ?? [],
    [viewConfig],
  );

  const geoLevels = ([
    { key: 'region'   as GeoLevel, label: '大区',  fieldKey: viewConfig.geoRegionKey   },
    { key: 'province' as GeoLevel, label: '省份',  fieldKey: viewConfig.geoProvinceKey },
    { key: 'city'     as GeoLevel, label: '城市',  fieldKey: viewConfig.geoCityKey     },
  ] as const).filter(l => l.fieldKey);

  // Context label for display + cache key
  const contextLabel = useMemo(() => {
    const geo    = selectedGeo.length > 0 ? selectedGeo.join('/') : '全国';
    const status = selStatus.includes('__all') ? '全部状态'
      : statusOptions.find(g => g.values.some(v => selStatus.includes(v)))?.label ?? selStatus.join('/');
    return `${geo}·${status}`;
  }, [selectedGeo, selStatus, statusOptions]);

  const cacheKey = useMemo(
    () => `${geoLevel}_${selectedGeo.join(',')}_${selStatus.join(',')}`,
    [geoLevel, selectedGeo, selStatus],
  );

  const cachedResult = viewConfig.insightResults?.[cacheKey];

  const filteredRecords = useMemo(
    () => filterRecords(dataset.records, viewConfig, geoLevel, selectedGeo, selStatus),
    [dataset, viewConfig, geoLevel, selectedGeo, selStatus],
  );

  // Status counts
  const statusCountMap = useMemo(() => {
    if (!viewConfig.statusFieldKey) return new Map<string, number>();
    const m = new Map<string, number>();
    for (const r of filteredRecords) {
      const v = String(r[viewConfig.statusFieldKey!] ?? '').trim();
      if (v) m.set(v, (m.get(v) ?? 0) + 1);
    }
    return m;
  }, [filteredRecords, viewConfig]);

  const strongN = (viewConfig.statusGroups ?? [])
    .filter(g => g.intent === 'strong')
    .flatMap(g => g.values)
    .reduce((s, v) => s + (statusCountMap.get(v) ?? 0), 0);
  const weakN = (viewConfig.statusGroups ?? [])
    .filter(g => g.intent === 'weak')
    .flatMap(g => g.values)
    .reduce((s, v) => s + (statusCountMap.get(v) ?? 0), 0);

  async function generate(prompt: string) {
    setLoading(true);
    setError('');
    try {
      const context = buildInsightContext(
        dataset, filteredRecords, insightFieldKeys, contextLabel,
      );
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context, question: prompt }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      const { answer } = await res.json();
      // Cache result
      updateViewConfig(dataset.id, {
        insightResults: { ...(viewConfig.insightResults ?? {}), [cacheKey]: answer },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败');
    } finally {
      setLoading(false);
    }
  }

  const segments = cachedResult ? parseInsightResult(cachedResult) : [];

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Geo level */}
          {geoLevels.map(l => (
            <button
              key={l.key}
              onClick={() => { setGeoLevel(l.key); setSelectedGeo([]); }}
              className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-all ${
                geoLevel === l.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {l.label}
            </button>
          ))}

          {/* Geo value selector */}
          {geoLevel !== 'all' && (
            <GeoFilterInline
              dataset={dataset}
              viewConfig={viewConfig}
              geoLevel={geoLevel}
              selected={selectedGeo}
              onChange={setSelectedGeo}
            />
          )}

          <div className="w-px h-4 bg-gray-200 mx-1" />

          {/* Status */}
          {statusOptions.map(g => (
            <button
              key={g.key}
              onClick={() => setSelStatus(g.values)}
              className={`text-xs px-3 py-1 rounded-full border font-medium transition-all ${
                g.values.some(v => selStatus.includes(v))
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-blue-300'
              }`}
            >
              {g.label}
            </button>
          ))}
          <button
            onClick={() => setSelStatus(['__all'])}
            className={`text-xs px-3 py-1 rounded-full border font-medium transition-all ${
              selStatus.includes('__all')
                ? 'bg-gray-800 text-white border-gray-800'
                : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-400'
            }`}
          >
            全部
          </button>
        </div>
      </div>

      {/* Prompt editor */}
      {editPrompt && (
        <PromptEditor
          prompt={viewConfig.insightPrompt ?? DEFAULT_INSIGHT_PROMPT}
          onSave={p => {
            updateViewConfig(dataset.id, { insightPrompt: p });
            generate(p);
          }}
          onClose={() => setEditPrompt(false)}
        />
      )}

      {/* Action bar */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 flex-shrink-0">
          {contextLabel} · {filteredRecords.length} 个样本
        </span>
        <div className="flex-1" />
        <button
          onClick={() => setEditPrompt(o => !o)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-all"
        >
          <Edit2 size={11} />
          {editPrompt ? '收起提示词' : '编辑提示词'}
        </button>
        <button
          onClick={() => generate(viewConfig.insightPrompt ?? DEFAULT_INSIGHT_PROMPT)}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {cachedResult ? '重新生成' : '生成洞察'}
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-500 bg-red-50 rounded-xl px-4 py-3">{error}</div>
      )}

      {/* Loading placeholder */}
      {loading && (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 flex flex-col items-center gap-3 text-gray-400">
          <Loader2 size={24} className="animate-spin text-blue-500" />
          <p className="text-sm">AI 正在分析数据，生成用户画像…</p>
          <p className="text-xs text-gray-300">通常需要 15-30 秒</p>
        </div>
      )}

      {/* Result */}
      {!loading && cachedResult && (
        <div className="space-y-4">
          <StatsHeader
            label={selectedGeo.length > 0 ? selectedGeo.join('/') : '全国'}
            totalN={filteredRecords.length}
            strongN={strongN}
            weakN={weakN}
            groupConfig={viewConfig.statusGroups ?? []}
          />
          {segments.length > 0 ? (
            segments.map((seg, i) => <SegmentCard key={i} segment={seg} index={i} />)
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{cachedResult}</p>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!loading && !cachedResult && !error && (
        <div className="text-center py-20 text-gray-400 bg-white rounded-2xl border border-gray-100">
          <Sparkles size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">点击「生成洞察」，AI 将分析当前人群特征</p>
        </div>
      )}
    </div>
  );
}

// ── Inline geo filter (used in InsightView) ───────────────────

function GeoFilterInline({
  dataset, viewConfig, geoLevel, selected, onChange,
}: {
  dataset:    Dataset;
  viewConfig: ViewConfig;
  geoLevel:   GeoLevel;
  selected:   string[];
  onChange:   (v: string[]) => void;
}) {
  const options = useMemo(
    () => getGeoOptions(dataset.records, viewConfig, geoLevel),
    [dataset, viewConfig, geoLevel],
  );
  const [open, setOpen] = useState(false);
  const label =
    selected.length === 0 ? `选择${geoLevel === 'region' ? '大区' : geoLevel === 'province' ? '省份' : '城市'}`
    : selected.length === 1 ? selected[0]
    : `${selected.length}个地区`;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition-all ${
          selected.length > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-500'
        }`}
      >
        {label}
        <ChevronDown size={9} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-8 left-0 bg-white border border-gray-200 rounded-xl shadow-xl p-2 w-36 max-h-52 overflow-y-auto">
            <button
              onClick={() => { onChange([]); setOpen(false); }}
              className="w-full text-left text-xs px-2 py-1.5 rounded-lg hover:bg-gray-50 text-gray-500"
            >
              全国（全部）
            </button>
            {options.map(v => (
              <button
                key={v}
                onClick={() => {
                  onChange(selected.includes(v) ? selected.filter(s => s !== v) : [...selected, v]);
                }}
                className={`w-full text-left text-xs px-2 py-1.5 rounded-lg hover:bg-gray-50 flex items-center gap-1.5 ${
                  selected.includes(v) ? 'text-blue-600 font-medium' : 'text-gray-700'
                }`}
              >
                {selected.includes(v) && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />}
                {v}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
