'use client';

/**
 * SegmentInsightCard
 *
 * 分群洞察卡片，嵌入「核心洞察」视图。
 * - 左栏：AI 自动挑选 2-3 个最具区分性的人群特征字段（横向进度条）
 * - 右栏（主体）：消费心理叙事（cachedNarrative.psych_title + psych_text）
 * - 底部：深度分析卡片 grid（sections）+ AI 生成按钮
 */

import { useMemo, useState } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { SEGMENT_COLORS } from '@/types/personaSchema';
import { MarkdownContent } from '@/components/ui/MarkdownContent';
import { cn } from '@/lib/utils';
import type { Field, Dataset } from '@/types/dataSchema';
import type { SegmentDef, SegmentNarrative } from '@/types/personaSchema';

// ── Stat helpers ───────────────────────────────────────────────

function filterSegRecords(
  records: Record<string, unknown>[],
  seg: SegmentDef,
): Record<string, unknown>[] {
  if (!seg.filterField || !seg.filterValues.length) return records;
  return records.filter(r =>
    seg.filterValues.includes(String(r[seg.filterField] ?? '').trim()),
  );
}

interface DistItem { label: string; segPct: number; allPct: number; }

function computeDist(records: Record<string, unknown>[], fieldKey: string): Map<string, number> {
  const m = new Map<string, number>();
  const total = records.length || 1;
  for (const r of records) {
    const raw = r[fieldKey];
    const vals = Array.isArray(raw) ? raw : [raw];
    for (const v of vals) {
      const s = String(v ?? '').trim();
      if (s) m.set(s, (m.get(s) ?? 0) + 1 / total);
    }
  }
  return m;
}

/** Pick top-N fields that differ most from the overall population */
function autoPickFields(
  segRecords: Record<string, unknown>[],
  allRecords: Record<string, unknown>[],
  fields: Field[],
  exclude: string[],
  topN = 3,
): string[] {
  if (!segRecords.length) return [];
  return fields
    .filter(f =>
      !exclude.includes(f.key) &&
      f.type !== 'text' &&
      f.type !== 'ranking' &&
      (f.options?.length ?? 0) > 1,
    )
    .map(f => {
      const segMap = computeDist(segRecords, f.key);
      const allMap = computeDist(allRecords, f.key);
      const keys   = new Set([...segMap.keys(), ...allMap.keys()]);
      let score    = 0;
      for (const k of keys) score += Math.abs((segMap.get(k) ?? 0) - (allMap.get(k) ?? 0));
      return { key: f.key, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(s => s.key);
}

function computeDistItems(
  segRecords: Record<string, unknown>[],
  allRecords: Record<string, unknown>[],
  fieldKey: string,
  topN = 4,
): DistItem[] {
  const segMap = computeDist(segRecords, fieldKey);
  const allMap = computeDist(allRecords, fieldKey);
  return [...segMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([label, segPct]) => ({ label, segPct, allPct: allMap.get(label) ?? 0 }));
}

// ── CompactDemoBar ─────────────────────────────────────────────

function CompactDemoBar({
  fieldName, items, accent, bar,
}: { fieldName: string; items: DistItem[]; accent: string; bar: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{fieldName}</div>
      <div className="space-y-1.5">
        {items.slice(0, 3).map(it => {
          const delta = it.segPct - it.allPct;
          return (
            <div key={it.label} className="flex items-center gap-2">
              <div className="text-[10px] text-gray-600 w-14 truncate flex-shrink-0">{it.label}</div>
              <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${it.segPct * 100}%`, background: bar }} />
              </div>
              <div className="text-[10px] w-8 text-right flex-shrink-0 font-medium" style={{ color: accent }}>
                {(it.segPct * 100).toFixed(1)}%
              </div>
              {Math.abs(delta) > 0.03 && (
                <div className={cn('text-[9px] w-8 text-right flex-shrink-0', delta > 0 ? 'text-emerald-500' : 'text-red-400')}>
                  {delta > 0 ? '+' : ''}{(delta * 100).toFixed(1)}%
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── SegmentInsightCard ─────────────────────────────────────────

export interface SegmentInsightCardProps {
  seg:                 SegmentDef;
  dataset:             Dataset;
  onNarrativeUpdate:   (segId: string, narrative: SegmentNarrative) => void;
}

export function SegmentInsightCard({ seg, dataset, onNarrativeUpdate }: SegmentInsightCardProps) {
  const [generating, setGenerating] = useState(false);
  const [genError,   setGenError]   = useState<string | null>(null);

  const colors = SEGMENT_COLORS[seg.color];

  const segRecords = useMemo(
    () => filterSegRecords(dataset.records, seg),
    [dataset.records, seg],
  );

  // Auto-select top distinguishing fields
  const autoFields = useMemo(
    () => autoPickFields(
      segRecords, dataset.records, dataset.fields,
      seg.filterField ? [seg.filterField] : [],
      3,
    ),
    [segRecords, dataset.records, dataset.fields, seg.filterField],
  );

  const demoData = useMemo(
    () => autoFields.map(key => {
      const field = dataset.fields.find(f => f.key === key);
      return {
        key,
        name:  field?.name ?? key,
        items: computeDistItems(segRecords, dataset.records, key, 4),
      };
    }),
    [autoFields, segRecords, dataset.records, dataset.fields],
  );

  const keywords  = (seg.keywords ?? []).filter(Boolean);
  const narrative = seg.cachedNarrative;
  const pct       = dataset.records.length > 0
    ? ((segRecords.length / dataset.records.length) * 100).toFixed(1)
    : '0';

  async function generate() {
    setGenerating(true);
    setGenError(null);
    try {
      const stats = {
        demoFields:  demoData.map(d => ({
          field:        d.name,
          distribution: d.items.map(it => ({
            value: it.label,
            pct:   Math.round(it.segPct * 100),
            delta: Math.round((it.segPct - it.allPct) * 100),
          })),
        })),
        chartFields: (seg.chartFields ?? []).map(key => {
          const f     = dataset.fields.find(x => x.key === key);
          const items = computeDistItems(segRecords, dataset.records, key, 4);
          return {
            field:        f?.name ?? key,
            distribution: items.map(it => ({ value: it.label, pct: Math.round(it.segPct * 100) })),
          };
        }),
      };

      const res = await fetch('/api/ai/segment-narrative', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasetName:  dataset.name,
          segmentName:  seg.name,
          segmentCount: segRecords.length,
          totalCount:   dataset.records.length,
          keywords,
          stats,
        }),
      });
      const data = await res.json() as { narrative?: SegmentNarrative; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? 'AI 生成失败');
      if (data.narrative) onNarrativeUpdate(seg.id, data.narrative);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : '生成失败');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div
      className="rounded-2xl border overflow-hidden bg-white"
      style={{ borderColor: colors.border }}
    >
      {/* ── Header ── */}
      <div
        className="px-5 py-3.5 flex items-center gap-3 flex-wrap"
        style={{ background: colors.bg, borderBottom: `1.5px solid ${colors.border}` }}
      >
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colors.accent }} />
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-sm font-bold" style={{ color: colors.accent }}>{seg.name}</span>
          <span className="text-[10px] text-gray-400">{segRecords.length.toLocaleString()} 人 · {pct}%</span>
        </div>
        {keywords.map((kw, i) => (
          <span key={i}
            className="text-[11px] px-2 py-0.5 rounded-md border border-dashed font-medium"
            style={{ borderColor: colors.accent, color: colors.accent }}>
            {kw}
          </span>
        ))}
        <div className="flex-1" />
        <button
          onClick={generate}
          disabled={generating}
          className={cn(
            'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all font-medium flex-shrink-0',
            generating ? 'text-gray-300 border border-gray-200' : 'text-white',
          )}
          style={!generating ? { background: colors.accent } : undefined}
        >
          {generating
            ? <><RefreshCw size={10} className="animate-spin" />生成中…</>
            : <><Sparkles size={10} />{narrative ? '重新生成' : 'AI 生成画像'}</>
          }
        </button>
      </div>

      {genError && (
        <div className="mx-5 mt-3 text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{genError}</div>
      )}

      {/* ── Body ── */}
      <div className="p-5 grid grid-cols-[1fr_2fr] gap-6">

        {/* Left: auto-selected demo fields */}
        <div className="space-y-4">
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">人群特征</div>
          {demoData.length === 0 ? (
            <div className="text-xs text-gray-300">暂无可区分字段</div>
          ) : (
            demoData.map(d => (
              <CompactDemoBar
                key={d.key}
                fieldName={d.name}
                items={d.items}
                accent={colors.accent}
                bar={colors.bar}
              />
            ))
          )}
          <div className="text-[9px] text-gray-300 mt-2">↑ 自动选取偏离全量最大的字段</div>
        </div>

        {/* Right: narrative (star content) */}
        <div>
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">消费心理</div>
          {narrative ? (
            <div className="space-y-3">
              <div className="text-base font-bold leading-snug" style={{ color: colors.accent }}>
                {narrative.psych_title}
              </div>
              <div className="text-[12px] leading-relaxed text-gray-600">
                <MarkdownContent content={narrative.psych_text} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full min-h-[80px] text-center py-6">
              <Sparkles size={20} className="mb-2 opacity-20" style={{ color: colors.accent }} />
              <p className="text-xs text-gray-300">点击「AI 生成画像」，自动分析此人群的消费心理与偏好</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Sections grid (deep analysis) ── */}
      {narrative?.sections && narrative.sections.length > 0 && (
        <div className="px-5 pb-5">
          <div className="h-px bg-gray-100 mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {narrative.sections.map((s, i) => (
              <div
                key={i}
                className="rounded-xl p-3 text-[11px]"
                style={{ background: colors.bg }}
              >
                <div className="font-semibold mb-1 text-xs" style={{ color: colors.accent }}>{s.title}</div>
                <div className="text-gray-500 leading-relaxed">{s.content}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Purchase text ── */}
      {narrative?.purchase_text && (
        <div className="px-5 pb-4">
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">决策偏好</div>
          <div className="text-[11px] text-gray-600 leading-relaxed">
            <MarkdownContent content={narrative.purchase_text} />
          </div>
        </div>
      )}

      {narrative?.generatedAt && (
        <div className="px-5 pb-3 text-[10px] text-gray-300 text-right">
          AI 生成于 {new Date(narrative.generatedAt).toLocaleString('zh-CN')}
        </div>
      )}
    </div>
  );
}
