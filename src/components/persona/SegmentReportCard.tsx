'use client';

import { useMemo, useState } from 'react';
import { Sparkles, RefreshCw, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { SEGMENT_COLORS } from '@/types/personaSchema';
import { MarkdownContent } from '@/components/ui/MarkdownContent';
import { cn } from '@/lib/utils';
import type { Dataset } from '@/types/dataSchema';
import type { SegmentDef, SegmentNarrative } from '@/types/personaSchema';

// ── Local stat helpers ─────────────────────────────────────────────

interface DistItem { label: string; count: number; pct: number; }

function filterSegmentRecords(
  records: Record<string, unknown>[],
  seg: SegmentDef,
): Record<string, unknown>[] {
  if (!seg.filterField || seg.filterValues.length === 0) return records;
  return records.filter(r => {
    const v = String(r[seg.filterField] ?? '').trim();
    return seg.filterValues.includes(v);
  });
}

function computeDistribution(
  records: Record<string, unknown>[],
  fieldKey: string,
  topN = 6,
): DistItem[] {
  const counts: Record<string, number> = {};
  for (const r of records) {
    const raw = r[fieldKey];
    const vals = Array.isArray(raw) ? raw : [raw];
    for (const v of vals) {
      const s = String(v ?? '').trim();
      if (s) counts[s] = (counts[s] ?? 0) + 1;
    }
  }
  const total = records.length || 1;
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([label, count]) => ({ label, count, pct: count / total }));
}

// ── MiniBarChart ───────────────────────────────────────────────────

function MiniBarChart({ items, accent }: { items: DistItem[]; accent: string }) {
  if (!items.length) return <div className="text-xs text-gray-300 py-2">无数据</div>;
  const max = items[0].pct;
  return (
    <div className="space-y-1">
      {items.map(it => (
        <div key={it.label} className="flex items-center gap-1.5">
          <div className="text-[10px] text-gray-500 w-16 truncate flex-shrink-0">{it.label}</div>
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(it.pct / max) * 100}%`, background: accent }}
            />
          </div>
          <div className="text-[10px] text-gray-400 w-8 text-right flex-shrink-0">
            {(it.pct * 100).toFixed(1)}%
          </div>
        </div>
      ))}
    </div>
  );
}

// ── DemoBar (for demographic fields — taller, labeled) ─────────────

function DemoBar({ field, items, accent, bar }: { field: string; items: DistItem[]; accent: string; bar: string }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="text-[10px] font-medium text-gray-500 mb-1.5">{field}</div>
      <div className="space-y-1">
        {items.slice(0, 5).map(it => (
          <div key={it.label} className="flex items-center gap-2">
            <div className="text-[10px] text-gray-600 w-20 truncate flex-shrink-0">{it.label}</div>
            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${it.pct * 100}%`, background: bar }}
              />
            </div>
            <div className="text-[10px] font-medium w-10 text-right flex-shrink-0" style={{ color: accent }}>
              {(it.pct * 100).toFixed(1)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SegmentReportCard ──────────────────────────────────────────────

export interface SegmentReportCardProps {
  seg:       SegmentDef;
  dataset:   Dataset;
  onNarrativeUpdate: (segId: string, narrative: SegmentNarrative) => void;
}

export function SegmentReportCard({ seg, dataset, onNarrativeUpdate }: SegmentReportCardProps) {
  const [generating, setGenerating] = useState(false);
  const [genError,   setGenError]   = useState<string | null>(null);
  const [expanded,   setExpanded]   = useState(true);

  const colors = SEGMENT_COLORS[seg.color];

  // Filtered records for this segment
  const records = useMemo(
    () => filterSegmentRecords(dataset.records, seg),
    [dataset.records, seg],
  );

  const totalRecords = dataset.records.length;
  const pct = totalRecords > 0 ? ((records.length / totalRecords) * 100).toFixed(1) : '0';

  // Demo field distributions
  const demoData = useMemo(() => {
    return (seg.demoFields ?? []).map(key => {
      const field = dataset.fields.find(f => f.key === key);
      return { key, name: field?.name ?? key, items: computeDistribution(records, key, 5) };
    });
  }, [records, seg.demoFields, dataset.fields]);

  // Chart field distributions
  const chartData = useMemo(() => {
    return (seg.chartFields ?? []).map(key => {
      const field = dataset.fields.find(f => f.key === key);
      return { key, name: field?.name ?? key, items: computeDistribution(records, key, 4) };
    });
  }, [records, seg.chartFields, dataset.fields]);

  // Keywords (non-empty)
  const keywords = (seg.keywords ?? []).filter(Boolean);

  async function generateNarrative() {
    setGenerating(true);
    setGenError(null);
    try {
      // Build compact stats payload for the AI
      const stats = {
        demoFields: demoData.map(d => ({
          field: d.name,
          distribution: d.items.map(it => ({ value: it.label, pct: Math.round(it.pct * 100) })),
        })),
        chartFields: chartData.map(d => ({
          field: d.name,
          distribution: d.items.map(it => ({ value: it.label, pct: Math.round(it.pct * 100) })),
        })),
      };

      const res = await fetch('/api/ai/segment-narrative', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasetName:  dataset.name,
          segmentName:  seg.name,
          segmentCount: records.length,
          totalCount:   totalRecords,
          keywords,
          stats,
        }),
      });

      const data = await res.json() as { narrative?: SegmentNarrative; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? 'AI 生成失败');
      if (data.narrative) {
        onNarrativeUpdate(seg.id, data.narrative);
      }
    } catch (e) {
      setGenError(e instanceof Error ? e.message : '生成失败');
    } finally {
      setGenerating(false);
    }
  }

  const narrative = seg.cachedNarrative;

  return (
    <div
      className="rounded-2xl border overflow-hidden flex-shrink-0"
      style={{ borderColor: colors.border, minWidth: '320px', maxWidth: '380px' }}
    >
      {/* ── Header ── */}
      <div
        className="px-4 py-3"
        style={{ background: colors.bg, borderBottom: `2px solid ${colors.border}` }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5" style={{ background: colors.accent }} />
            <div className="min-w-0">
              <div className="text-sm font-bold truncate" style={{ color: colors.accent }}>{seg.name}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">
                {records.length.toLocaleString()} 人 · 占总量 {pct}%
              </div>
            </div>
          </div>
          <button onClick={() => setExpanded(v => !v)}
            className="flex-shrink-0 p-1 rounded-lg hover:bg-black/5 text-gray-400 transition-all">
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>

        {/* Keywords */}
        {keywords.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {keywords.map((kw, i) => (
              <span key={i}
                className="text-[11px] px-2 py-0.5 rounded-md border border-dashed font-medium"
                style={{ borderColor: colors.accent, color: colors.accent }}>
                {kw}
              </span>
            ))}
          </div>
        )}
      </div>

      {expanded && (
        <div className="bg-white divide-y divide-gray-50">

          {/* ── Body: demo stats + narrative ── */}
          <div className="p-4 grid grid-cols-2 gap-4">

            {/* Left: demographic bars */}
            <div className="space-y-3">
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">人群特征</div>
              {demoData.length === 0 ? (
                <div className="text-xs text-gray-300">未配置统计字段</div>
              ) : (
                demoData.map(d => (
                  <DemoBar key={d.key} field={d.name} items={d.items} accent={colors.accent} bar={colors.bar} />
                ))
              )}
            </div>

            {/* Right: AI narrative */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">消费心理</div>
                <button
                  onClick={generateNarrative}
                  disabled={generating}
                  title={narrative ? '重新生成AI画像' : '生成AI画像'}
                  className={cn(
                    'flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg border transition-all',
                    generating
                      ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                      : 'border-transparent text-white hover:opacity-90',
                  )}
                  style={!generating ? { background: colors.accent } : undefined}
                >
                  {generating
                    ? <><RefreshCw size={9} className="animate-spin" />生成中…</>
                    : <><Sparkles size={9} />{narrative ? '重新生成' : 'AI 生成'}</>
                  }
                </button>
              </div>

              {genError && (
                <div className="text-[10px] text-red-500 bg-red-50 rounded-lg px-2 py-1">{genError}</div>
              )}

              {narrative ? (
                <div className="space-y-2">
                  <div className="text-xs font-semibold" style={{ color: colors.accent }}>
                    {narrative.psych_title}
                  </div>
                  <div className="text-[11px] leading-relaxed text-gray-600 line-clamp-6">
                    <MarkdownContent content={narrative.psych_text} />
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-gray-300 italic py-3">
                  点击「AI 生成」自动分析此分群的消费心理与偏好
                </div>
              )}
            </div>
          </div>

          {/* ── AI sections (full-width) ── */}
          {narrative?.sections && narrative.sections.length > 0 && (
            <div className="px-4 py-3 space-y-2">
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">深度分析</div>
              <div className="grid grid-cols-2 gap-2">
                {narrative.sections.map((s, i) => (
                  <div key={i}
                    className="rounded-xl p-2.5 text-[11px]"
                    style={{ background: colors.bg }}>
                    <div className="font-semibold mb-1 text-xs" style={{ color: colors.accent }}>{s.title}</div>
                    <div className="text-gray-500 leading-relaxed">{s.content}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Chart fields: mini bars ── */}
          {chartData.length > 0 && (
            <div className="px-4 py-3">
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-3">偏好分布</div>
              <div className={cn(
                'grid gap-3',
                chartData.length === 1 ? 'grid-cols-1' : 'grid-cols-2',
              )}>
                {chartData.map(d => (
                  <div key={d.key}>
                    <div className="text-[10px] text-gray-500 font-medium mb-1.5">{d.name}</div>
                    <MiniBarChart items={d.items} accent={colors.accent} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── AI purchase text ── */}
          {narrative?.purchase_text && (
            <div className="px-4 py-3">
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">决策偏好</div>
              <div className="text-[11px] text-gray-600 leading-relaxed">
                <MarkdownContent content={narrative.purchase_text} />
              </div>
            </div>
          )}

          {/* ── Footer: generation timestamp ── */}
          {narrative?.generatedAt && (
            <div className="px-4 py-2 text-[10px] text-gray-300 text-right">
              AI 生成于 {new Date(narrative.generatedAt).toLocaleString('zh-CN')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
