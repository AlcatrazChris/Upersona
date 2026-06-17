'use client';

/**
 * RegionalFeatureView — 区域特征
 *
 * 交叉表：行 = 地区，列 = 画像字段，单元格 = TOP 值 + 百分比 + 与全国均值偏差
 * 颜色编码：红 > +5%，蓝 < -5%，加粗 |delta| > 10%
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { Download, RefreshCw, Loader2, Sparkles, Edit2, Check, X, Search, Plus, ChevronDown } from 'lucide-react';
import { filterRecords, getStatusOptions, type GeoLevel } from '@/lib/filterRecords';
import { useDatasetStore } from '@/store/datasetStore';
import { useIsAdmin } from '@/lib/auth';
import { cn } from '@/lib/utils';
import type { Dataset, Field } from '@/types/dataSchema';
import type { ViewConfig } from '@/lib/viewConfig';

// ── Data types ──────────────────────────────────────────────────

interface ValueItem {
  value: string;
  pct: number;    // % in this region
  delta: number;  // pct - national_pct
}

interface RegionProfile {
  region: string;
  n: number;
  fieldValues: ValueItem[][];  // index = personaFields index
}

// ── Computation ─────────────────────────────────────────────────

function getFieldFreq(
  records: Record<string, unknown>[],
  field: Field,
): Map<string, number> {
  const map = new Map<string, number>();
  const delim = field.multiDelimiter ?? '|';
  for (const rec of records) {
    const raw = String(rec[field.key] ?? '');
    const vals = field.type === 'multi_choice' ? raw.split(delim) : [raw];
    for (const v of vals) {
      const t = v.trim();
      if (t) map.set(t, (map.get(t) ?? 0) + 1);
    }
  }
  return map;
}

function computeRegionProfiles(
  allRecords: Record<string, unknown>[],
  geoFieldKey: string,
  regions: string[],
  personaFields: Field[],
): RegionProfile[] {
  // National percentages per field
  const nationalPcts: Map<string, number>[] = personaFields.map(field => {
    const freq = getFieldFreq(allRecords, field);
    const total = [...freq.values()].reduce((a, b) => a + b, 0);
    const pct = new Map<string, number>();
    for (const [v, c] of freq) {
      pct.set(v, total > 0 ? (c / total) * 100 : 0);
    }
    return pct;
  });

  return regions.map(region => {
    const recs = allRecords.filter(r => String(r[geoFieldKey] ?? '') === region);
    const n = recs.length;

    const fieldValues = personaFields.map((field, fi) => {
      const natPct = nationalPcts[fi];
      const freq = getFieldFreq(recs, field);
      const total = [...freq.values()].reduce((a, b) => a + b, 0);
      return [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([value, count]) => {
          const pct = total > 0 ? (count / total) * 100 : 0;
          const delta = pct - (natPct.get(value) ?? 0);
          return { value, pct, delta };
        });
    });

    return { region, n, fieldValues };
  });
}

// ── Cell renderer ───────────────────────────────────────────────

function ValueCell({ items }: { items: ValueItem[] }) {
  if (!items.length) return <span className="text-gray-200 text-[10px]">—</span>;
  const maxPct = Math.max(...items.map(i => i.pct), 1);
  return (
    <div className="space-y-[3px]">
      {items.slice(0, 4).map((item, i) => {
        const isUp   = item.delta >=  5;
        const isDown = item.delta <= -5;
        const isBig  = Math.abs(item.delta) >= 10;
        const isTop  = i === 0;
        return (
          <div key={i}>
            <div className="flex items-center gap-1 min-w-0">
              {isTop && (
                <div className="w-7 h-[3px] rounded-full bg-gray-100 flex-shrink-0 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(item.pct / maxPct) * 100}%`,
                      background: isUp ? '#ef4444' : isDown ? '#3b82f6' : '#94a3b8',
                    }}
                  />
                </div>
              )}
              <span className={cn(
                'text-[10px] leading-tight flex-1 truncate min-w-0',
                isBig ? 'font-semibold' : 'font-normal',
                isTop
                  ? (isUp ? 'text-red-500' : isDown ? 'text-blue-500' : 'text-gray-700')
                  : 'text-gray-500',
              )}>
                {item.value}
              </span>
              <span className={cn(
                'text-[10px] tabular-nums flex-shrink-0',
                isUp ? 'text-red-400' : isDown ? 'text-blue-400' : 'text-gray-400',
              )}>
                {item.pct.toFixed(0)}%
              </span>
              {Math.abs(item.delta) >= 5 && (
                <span className={cn(
                  'text-[8px] tabular-nums px-[3px] py-[1px] rounded leading-none flex-shrink-0 font-medium',
                  isUp ? 'bg-red-50 text-red-400' : 'bg-blue-50 text-blue-400',
                )}>
                  {item.delta > 0 ? `+${item.delta.toFixed(0)}` : item.delta.toFixed(0)}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── CSV + AI Export ─────────────────────────────────────────────

function exportCSV(
  profiles:   RegionProfile[],
  fields:     Field[],
  aiText?:    string,  // raw AI cached result
) {
  const rows: string[][] = [];

  // ── Section 1: Statistical table ────────────────────────────
  rows.push(['【区域特征数据表】']);
  rows.push(['地域', '样本量', ...fields.map(f => f.name)]);
  for (const p of profiles) {
    rows.push([
      p.region,
      String(p.n),
      ...p.fieldValues.map(items =>
        items.slice(0, 3)
          .map(v => `${v.value} ${v.pct.toFixed(0)}%(${v.delta >= 0 ? '+' : ''}${v.delta.toFixed(0)}%)`)
          .join(' / ')
      ),
    ]);
  }

  // ── Section 2: AI insights (if available) ───────────────────
  if (aiText) {
    rows.push([]);  // blank separator
    rows.push(['【AI 差异化特征分析】']);
    // Parse structured blocks
    const regions = profiles.map(p => p.region);
    const blocks: { dimension: string; regionData: Record<string, string> }[] = [];
    let cur: typeof blocks[0] | null = null;
    for (const line of aiText.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      if (t.startsWith('[') && t.endsWith(']')) {
        if (cur) blocks.push(cur);
        cur = { dimension: t.slice(1, -1), regionData: {} };
      } else if (cur && t.includes(':')) {
        const idx = t.indexOf(':');
        cur.regionData[t.slice(0, idx).trim()] = t.slice(idx + 1).trim();
      }
    }
    if (cur) blocks.push(cur);

    if (blocks.length > 0) {
      rows.push(['维度', ...regions]);
      for (const b of blocks) {
        rows.push([b.dimension, ...regions.map(r => b.regionData[r] ?? '—')]);
      }
    } else {
      // Fallback: dump raw text
      rows.push([aiText]);
    }
  }

  const csv = rows
    .map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `区域特征_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Region picker dropdown ───────────────────────────────────────

function RegionPickerDropdown({
  allOptions, selected, onAdd,
}: {
  allOptions: string[];
  selected:   string[];
  onAdd:      (v: string) => void;
}) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState('');

  const remaining = allOptions.filter(
    o => !selected.includes(o) && o.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs px-3 py-1 rounded-full border border-dashed border-blue-300 text-blue-500 hover:bg-blue-50 transition-all"
      >
        <Plus size={10} />
        添加地区
        <ChevronDown size={9} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setSearch(''); }} />
          <div className="absolute z-50 top-8 left-0 bg-white border border-gray-200 rounded-xl shadow-xl p-2 w-44">
            <div className="relative mb-1">
              <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="搜索地区…"
                className="w-full pl-6 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-blue-300"
              />
            </div>
            <div className="max-h-52 overflow-y-auto">
              {remaining.length === 0 ? (
                <p className="text-xs text-gray-300 text-center py-3">
                  {allOptions.length === selected.length ? '已全部添加' : '无匹配结果'}
                </p>
              ) : (
                remaining.map(opt => (
                  <button
                    key={opt}
                    onClick={() => { onAdd(opt); /* stay open for multi-select */ }}
                    className="w-full text-left text-xs px-2 py-1.5 hover:bg-blue-50 hover:text-blue-700 rounded-lg text-gray-700 transition-all"
                  >
                    {opt}
                  </button>
                ))
              )}
            </div>
            {remaining.length > 0 && remaining.length < allOptions.length && (
              <button
                onClick={() => { remaining.forEach(onAdd); }}
                className="w-full text-xs text-center py-1.5 text-blue-500 hover:text-blue-700 border-t border-gray-100 mt-1"
              >
                全部添加 ({remaining.length})
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── AI summary table ────────────────────────────────────────────

const DEFAULT_AI_PROMPT =
  `基于上方数据，为每个维度的每个地区提炼2-3个判断性描述词（直接说结论，如"理性价值主导"，禁止说"占比最高/低"），括号内补充关键数据（如"本科62%"）。

严格按以下格式输出，不输出其他任何内容：
[维度名]
地区1: 特征词1、特征词2（XX%）
地区2: 特征词1、特征词2（XX%）`;

interface AISummaryProps {
  profiles:      RegionProfile[];
  fields:        Field[];
  datasetName:   string;
  cachedResult:  string | undefined;
  onCache:       (result: string) => void;
  savedPrompt?:  string;
  onPromptSave?: (p: string) => void;
}

function AISummaryTable({ profiles, fields, datasetName, cachedResult, onCache, savedPrompt, onPromptSave }: AISummaryProps) {
  const isAdmin   = useIsAdmin();
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [editPrompt, setEditPrompt] = useState(false);
  const [prompt,     setPrompt]     = useState(savedPrompt ?? DEFAULT_AI_PROMPT);
  const [draftPrompt, setDraftPrompt] = useState(savedPrompt ?? DEFAULT_AI_PROMPT);

  // Sync if an external update arrives (e.g. from cloud or another session)
  const prevSavedRef = useRef(savedPrompt);
  useEffect(() => {
    if (savedPrompt !== prevSavedRef.current) {
      prevSavedRef.current = savedPrompt;
      setPrompt(savedPrompt ?? DEFAULT_AI_PROMPT);
      setDraftPrompt(savedPrompt ?? DEFAULT_AI_PROMPT);
    }
  }, [savedPrompt]);

  async function generate() {
    setLoading(true);
    setError('');
    try {
      const context = {
        analysisType: 'regional_feature_summary',
        dataset: datasetName,
        regions: profiles.map(p => ({
          region: p.region,
          n: p.n,
          features: fields.map((f, fi) => ({
            dimension: f.name,
            topValues: (p.fieldValues[fi] ?? []).slice(0, 3)
              .map(v => `${v.value}(${v.pct.toFixed(0)}%, Δ${v.delta >= 0 ? '+' : ''}${v.delta.toFixed(0)}%)`)
              .join(', '),
          })),
        })),
      };
      const res = await fetch('/api/ai', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ context, question: prompt }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      const { answer } = await res.json();
      onCache(answer);
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败');
    } finally {
      setLoading(false);
    }
  }

  // Parse AI output: blocks separated by [Dimension]\n Region: text
  const tableData = useMemo(() => {
    if (!cachedResult) return null;
    const blocks: { dimension: string; regionData: Record<string, string> }[] = [];
    let cur: { dimension: string; regionData: Record<string, string> } | null = null;
    for (const line of cachedResult.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        if (cur) blocks.push(cur);
        cur = { dimension: trimmed.slice(1, -1), regionData: {} };
      } else if (cur && trimmed.includes(':')) {
        const colonIdx = trimmed.indexOf(':');
        const region = trimmed.slice(0, colonIdx).trim();
        const text   = trimmed.slice(colonIdx + 1).trim();
        if (region) cur.regionData[region] = text;
      }
    }
    if (cur) blocks.push(cur);
    return blocks.length > 0 ? blocks : null;
  }, [cachedResult]);

  const regions = profiles.map(p => p.region);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100">
        <Sparkles size={14} className="text-blue-400 flex-shrink-0" />
        <span className="text-sm font-semibold text-gray-700">AI 差异化特征分析</span>
        {cachedResult && !loading && (
          <span className="text-[10px] text-blue-400 bg-blue-50 px-1.5 py-0.5 rounded-md">已生成</span>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {isAdmin && (
            <button
              onClick={() => { setDraftPrompt(prompt); setEditPrompt(o => !o); }}
              className={cn(
                'flex items-center gap-1 text-xs px-2.5 py-1 rounded-xl border transition-all',
                editPrompt
                  ? 'bg-blue-50 border-blue-200 text-blue-600'
                  : 'border-gray-200 text-gray-400 hover:text-gray-600',
              )}
            >
              <Edit2 size={10} />
              编辑
            </button>
          )}
          <button
            onClick={generate}
            disabled={loading}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-all"
          >
            {loading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            {cachedResult ? '重新生成' : '生成分析'}
          </button>
        </div>
      </div>

      {/* Prompt editor */}
      {editPrompt && isAdmin && (
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 space-y-2">
          <textarea
            value={draftPrompt}
            onChange={e => setDraftPrompt(e.target.value)}
            rows={4}
            className="w-full text-xs border border-gray-200 rounded-xl p-2.5 outline-none focus:border-blue-400 font-mono resize-none"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditPrompt(false)} className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1">
              取消
            </button>
            <button
              onClick={() => { setPrompt(draftPrompt); onPromptSave?.(draftPrompt); setEditPrompt(false); generate(); }}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
            >
              <Check size={10} />
              保存并生成
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="px-5 py-3 text-xs text-red-500 bg-red-50">{error}</div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-gray-400">
          <Loader2 size={16} className="animate-spin text-blue-400" />
          <span className="text-sm">AI 正在分析各地区差异特征…</span>
        </div>
      ) : !cachedResult ? (
        <div className="flex flex-col items-center gap-2 py-12 text-gray-400">
          <Sparkles size={22} className="opacity-25" />
          <p className="text-sm">点击「生成分析」获取 AI 地区差异化洞察</p>
        </div>
      ) : tableData ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-[#1e3a5f] text-white text-left px-3 py-2 font-medium min-w-[80px] border-r border-[#2a4a7f] text-[11px]">
                  维度
                </th>
                {regions.map(r => (
                  <th key={r} className="bg-[#1e3a5f] text-white text-left px-2.5 py-2 font-medium min-w-[100px] border-r border-[#2a4a7f] whitespace-nowrap text-[11px]">
                    {r}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.map((block, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-blue-50/30'}>
                  <td className="sticky left-0 z-10 bg-inherit px-3 py-2 font-medium text-gray-700 border-r border-gray-100 whitespace-nowrap text-[11px]">
                    {block.dimension}
                  </td>
                  {regions.map(region => (
                    <td key={region} className="px-2.5 py-2 text-gray-600 border-r border-gray-50 leading-snug text-[11px]">
                      {block.regionData[region] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-5 py-5">
          <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{cachedResult}</p>
        </div>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────

interface Props {
  dataset:    Dataset;
  viewConfig: ViewConfig;
}

export function RegionalFeatureView({ dataset, viewConfig }: Props) {
  const { updateViewConfig, personaConfigs, activePersonaConfigId } = useDatasetStore();
  const activeConfig = (personaConfigs[dataset.id] ?? []).find(c => c.id === activePersonaConfigId);

  const [geoLevel,         setGeoLevel]         = useState<GeoLevel>('region');
  const [selStatus,        setSelStatus]        = useState<string[]>(['__all']);
  const [selectedRegions,  setSelectedRegions]  = useState<string[]>([]);

  // Available geo levels (only those with a configured field key)
  const geoLevels = ([
    { key: 'region'   as GeoLevel, label: '大区',   fieldKey: viewConfig.geoRegionKey   },
    { key: 'province' as GeoLevel, label: '省份',   fieldKey: viewConfig.geoProvinceKey },
    { key: 'city'     as GeoLevel, label: '城市',   fieldKey: viewConfig.geoCityKey     },
  ] as const).filter(l => l.fieldKey);

  const geoFieldKey = (
    geoLevel === 'region'   ? viewConfig.geoRegionKey   :
    geoLevel === 'province' ? viewConfig.geoProvinceKey :
    viewConfig.geoCityKey
  ) ?? '';

  const statusOptions = useMemo(
    () => getStatusOptions(dataset.records, viewConfig),
    [dataset.records, viewConfig],
  );

  const filteredRecords = useMemo(
    () => filterRecords(dataset.records, viewConfig, 'all', [], selStatus),
    [dataset.records, viewConfig, selStatus],
  );

  const allRegions = useMemo(() => {
    if (!geoFieldKey) return [];
    const s = new Set<string>();
    for (const r of filteredRecords) {
      const v = String(r[geoFieldKey] ?? '').trim();
      if (v) s.add(v);
    }
    return [...s].sort();
  }, [filteredRecords, geoFieldKey]);

  // Persona fields — prefer active persona config blocks
  const personaFields = useMemo(() => {
    if (activeConfig) {
      return activeConfig.blocks
        .filter(b => b.visible && b.sourceFieldKey)
        .map(b => dataset.fields.find(f => f.key === b.sourceFieldKey))
        .filter(Boolean) as Field[];
    }
    return (viewConfig.personaFieldKeys ?? [])
      .map(k => dataset.fields.find(f => f.key === k))
      .filter(Boolean) as Field[];
  }, [dataset.fields, viewConfig.personaFieldKeys, activeConfig]);

  // selectedRegions empty = show all regions (auto mode)
  // selectedRegions non-empty = explicit selection only
  const displayedRegions = useMemo(
    () => selectedRegions.length > 0
      ? allRegions.filter(r => selectedRegions.includes(r))
      : allRegions,
    [allRegions, selectedRegions],
  );

  const profiles = useMemo(
    () => computeRegionProfiles(filteredRecords, geoFieldKey, displayedRegions, personaFields),
    [filteredRecords, geoFieldKey, displayedRegions, personaFields],
  );

  // AI cache key
  const aiCacheKey = `rfeat_${geoLevel}_${selStatus.join(',')}_${displayedRegions.join(',')}_${personaFields.map(f => f.key).join(',')}`;
  const cachedAI   = viewConfig.insightResults?.[aiCacheKey];

  if (!geoFieldKey) {
    return (
      <div className="text-center py-16 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">
        请先在数据中心配置地理字段（大区 / 省份 / 城市）
      </div>
    );
  }

  const geoLabel = geoLevel === 'region' ? '大区' : geoLevel === 'province' ? '省份' : '城市';

  return (
    <div className="space-y-4">

      {/* ── Filter bar ── */}
      <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 space-y-3">

        {/* Row 1: Geo level tabs + stats + export */}
        <div className="flex items-center gap-2 flex-wrap">
          {geoLevels.map(l => (
            <button
              key={l.key}
              onClick={() => { setGeoLevel(l.key); setSelectedRegions([]); }}
              className={cn(
                'text-xs px-3 py-1.5 rounded-xl font-medium transition-all',
                geoLevel === l.key
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
              )}
            >
              {l.label}
            </button>
          ))}

          <span className="text-xs text-gray-400 ml-auto">
            共 <span className="font-semibold text-gray-800">{filteredRecords.length.toLocaleString()}</span> 人
            · 展示 <span className="font-semibold text-gray-800">{displayedRegions.length}</span>
            /{allRegions.length} 个{geoLabel}
          </span>

          <button
            onClick={() => exportCSV(profiles, personaFields, cachedAI)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-all"
          >
            <Download size={12} />
            导出 Excel{cachedAI ? ' + AI' : ''}
          </button>
        </div>

        {/* Row 2: Region selector chips + picker */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-gray-400 flex-shrink-0">对比地区</span>

          {/* Selected chips */}
          {selectedRegions.map(r => (
            <span
              key={r}
              className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 pl-2.5 pr-1.5 py-1 rounded-full"
            >
              {r}
              <button
                onClick={() => setSelectedRegions(prev => prev.filter(x => x !== r))}
                className="hover:text-blue-900"
              >
                <X size={10} />
              </button>
            </span>
          ))}

          {/* Add region dropdown */}
          <RegionPickerDropdown
            allOptions={allRegions}
            selected={selectedRegions}
            onAdd={v => setSelectedRegions(prev => [...prev, v])}
          />

          {/* "Show all" shortcut when nothing selected */}
          {selectedRegions.length === 0 && allRegions.length > 0 && (
            <span className="text-xs text-gray-300 ml-1">（当前展示全部 {allRegions.length} 个{geoLabel}）</span>
          )}

          {/* Clear button */}
          {selectedRegions.length > 0 && (
            <button
              onClick={() => setSelectedRegions([])}
              className="text-xs text-gray-400 hover:text-gray-600 ml-1"
            >
              清空
            </button>
          )}
        </div>

        {/* Row 3: Status filter */}
        {viewConfig.statusFieldKey && statusOptions.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400 flex-shrink-0">用户类型</span>
            <button
              onClick={() => setSelStatus(['__all'])}
              className={cn(
                'text-xs px-3 py-1 rounded-full transition-all',
                selStatus.includes('__all')
                  ? 'bg-blue-600 text-white font-medium'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
              )}
            >
              全部用户
            </button>
            {statusOptions.map(v => (
              <button
                key={v}
                onClick={() => setSelStatus(prev =>
                  prev.includes(v)
                    ? prev.filter(x => x !== v && x !== '__all')
                    : [...prev.filter(x => x !== '__all'), v]
                )}
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

      {/* ── Legend ── */}
      <div className="flex items-center gap-3 px-1 text-[11px] text-gray-400">
        <span><span className="text-red-400 font-medium">红色</span> = 高于全国均值 5%+</span>
        <span className="text-gray-200">|</span>
        <span><span className="text-blue-400 font-medium">蓝色</span> = 低于全国均值 5%+</span>
        <span className="text-gray-200">|</span>
        <span><span className="font-semibold text-gray-600">加粗</span> = 偏差 10%+</span>
        <span className="text-gray-200">|</span>
        <span className="text-gray-300">偏差相对全部用户（不受用户类型筛选影响）</span>
      </div>

      {/* ── Main table ── */}
      {allRegions.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">
          所选筛选条件下无地区数据
        </div>
      ) : personaFields.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">
          请先在用户画像中配置可见字段
        </div>
      ) : displayedRegions.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">
          请通过「添加地区」选择要对比的{geoLabel}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 bg-[#1e3a5f] text-white text-left px-3 py-2 font-medium min-w-[72px] border-r border-[#2a4a7f] text-[11px]">
                    地域
                  </th>
                  <th className="sticky left-[72px] z-20 bg-[#1e3a5f] text-white text-center px-2 py-2 font-medium w-[52px] border-r border-[#2a4a7f] text-[11px]">
                    n
                  </th>
                  {personaFields.map(f => (
                    <th
                      key={f.key}
                      className="bg-[#1e3a5f] text-white text-left px-2.5 py-2 font-medium min-w-[100px] border-r border-[#2a4a7f] whitespace-nowrap text-[11px]"
                    >
                      {f.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile, ri) => (
                  <tr key={profile.region} className={ri % 2 === 0 ? 'bg-white' : 'bg-blue-50/20'}>
                    <td className="sticky left-0 z-10 bg-inherit px-3 py-2 font-semibold text-gray-800 border-r border-gray-100 whitespace-nowrap text-[11px]">
                      {profile.region}
                    </td>
                    <td className="sticky left-[72px] z-10 bg-inherit px-2 py-2 text-center text-gray-500 tabular-nums border-r border-gray-100 text-[11px]">
                      {profile.n.toLocaleString()}
                    </td>
                    {profile.fieldValues.map((items, fi) => (
                      <td key={fi} className="px-2.5 py-2 border-r border-gray-50 align-top">
                        <ValueCell items={items} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── AI Summary ── */}
      {displayedRegions.length > 0 && personaFields.length > 0 && (
        <AISummaryTable
          profiles={profiles}
          fields={personaFields}
          datasetName={dataset.name}
          cachedResult={cachedAI}
          onCache={result =>
            updateViewConfig(dataset.id, {
              insightResults: { ...(viewConfig.insightResults ?? {}), [aiCacheKey]: result },
            })
          }
          savedPrompt={viewConfig.viewPrompts?.['rfeature']}
          onPromptSave={p =>
            updateViewConfig(dataset.id, {
              viewPrompts: { ...(viewConfig.viewPrompts ?? {}), rfeature: p },
            })
          }
        />
      )}
    </div>
  );
}
