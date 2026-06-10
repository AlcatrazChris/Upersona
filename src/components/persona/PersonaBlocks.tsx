'use client';

import { ChartRenderer }         from '@/components/charts/engine/ChartRenderer';
import { RankingHeatmapEngine }  from '@/components/charts/engine/RankingHeatmapEngine';
import { cn } from '@/lib/utils';
import { DEFAULT_CHART_CONFIG } from '@/lib/chartConfig';
import type { PersonaBlockData } from '@/lib/personaEngine';

// ════════════════ Tag Cloud Block ════════════════

export function TagCloudBlock({ data }: { data: PersonaBlockData }) {
  const items = data.aggregate ?? [];
  const maxTags = data.block.config?.maxTags ?? 10;
  const sortBy = data.block.config?.tagSortBy ?? 'count';
  const maxCount = items.length > 0 ? items[0].count : 1;

  let sorted = [...items];
  if (sortBy === 'alpha') sorted.sort((a, b) => a.label.localeCompare(b.label));
  const tags = sorted.slice(0, maxTags);

  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map(item => {
        // size scale from 11px to 15px based on relative count
        const ratio = item.count / maxCount;
        const size = 11 + ratio * 4;
        const opacity = 0.5 + ratio * 0.5;
        return (
          <span
            key={item.label}
            style={{ fontSize: size, opacity }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-medium whitespace-nowrap"
          >
            {item.label}
            <span className="text-blue-400 text-[0.7em] font-normal">{item.count}</span>
          </span>
        );
      })}
    </div>
  );
}

// ════════════════ Stat Badge Block ════════════════

export function StatBadgeBlock({ data }: { data: PersonaBlockData }) {
  const suffix = data.block.config?.statSuffix ?? '';
  const value = data.statValue ?? '—';

  return (
    <div className="flex flex-col items-center justify-center py-3">
      <span className="text-3xl font-bold text-gray-800 tabular-nums tracking-tight">
        {value}{suffix}
      </span>
      <span className="text-xs text-gray-400 mt-1">
        {data.validCount.toLocaleString()} 条有效数据
      </span>
    </div>
  );
}

// ════════════════ Distribution Block ════════════════

export function DistributionBlock({ data }: { data: PersonaBlockData }) {
  const items = data.aggregate ?? [];
  const chartType = data.block.config?.chartType ?? 'bar';

  if (items.length === 0) return null;

  return (
    <div className="w-full" style={{ minHeight: 180 }}>
      <ChartRenderer
        type={chartType}
        data={items}
        config={{ ...DEFAULT_CHART_CONFIG, showLegend: chartType === 'pie' || chartType === 'donut', chartHeight: 200 }}
        height={200}
      />
    </div>
  );
}

// ════════════════ Property Row Block ════════════════

export function PropertyRowBlock({ data }: { data: PersonaBlockData }) {
  const items = data.aggregate ?? [];
  if (items.length === 0) return null;

  return (
    <div className="space-y-0.5">
      {items.slice(0, 8).map(item => (
        <div key={item.label} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50">
          <span className="text-sm text-gray-600 truncate">{item.label}</span>
          <span className="text-sm font-medium text-gray-800 tabular-nums flex-shrink-0 ml-2">
            {item.count.toLocaleString()}
            <span className="text-gray-400 text-xs ml-1">({item.percentage.toFixed(1)}%)</span>
          </span>
        </div>
      ))}
    </div>
  );
}

// ════════════════ Text Card Block ════════════════

export function TextCardBlock({ data }: { data: PersonaBlockData }) {
  const block = data.block;
  const samples = (data as any).samples as string[] ?? [];

  if (samples.length === 0) return null;

  return (
    <div className="space-y-2">
      {samples.slice(0, 3).map((text, i) => (
        <div key={i} className="bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-600 leading-relaxed italic border-l-2 border-gray-200">
          &ldquo;{text}&rdquo;
        </div>
      ))}
    </div>
  );
}

// ════════════════ Boolean Tick Block ════════════════

export function BooleanTickBlock({ data }: { data: PersonaBlockData }) {
  const items = data.aggregate ?? [];
  if (items.length === 0) return null;

  return (
    <div className="flex items-center gap-4 flex-wrap">
      {items.map(item => {
        const isTrue = ['yes', 'true', '1', '是', '有'].includes(item.label.toLowerCase());
        return (
          <div key={item.label} className="flex items-center gap-2">
            <div className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold',
              isTrue ? 'bg-emerald-500' : 'bg-red-400',
            )}>
              {isTrue ? '✓' : '✗'}
            </div>
            <span className="text-sm text-gray-700 font-medium">{item.label}</span>
            <span className="text-xs text-gray-400">({item.percentage.toFixed(1)}%)</span>
          </div>
        );
      })}
    </div>
  );
}

// ════════════════ Date Range Block ════════════════

export function DateRangeBlock({ data }: { data: PersonaBlockData }) {
  return (
    <div className="flex items-center justify-center gap-4 py-3">
      <div className="text-center">
        <div className="text-xs text-gray-400 mb-1">最早</div>
        <div className="text-lg font-semibold text-gray-800">{data.dateMin ?? '—'}</div>
      </div>
      <div className="text-gray-300 text-xl">→</div>
      <div className="text-center">
        <div className="text-xs text-gray-400 mb-1">最晚</div>
        <div className="text-lg font-semibold text-gray-800">{data.dateMax ?? '—'}</div>
      </div>
    </div>
  );
}

// ════════════════ Ranking Heatmap Block ════════════════

export function RankingHeatmapBlock({ data }: { data: PersonaBlockData }) {
  if (!data.rankingData || data.rankingData.N === 0) return null;
  return (
    <RankingHeatmapEngine
      data={data.rankingData}
      fieldName={data.block.displayName}
    />
  );
}

// ════════════════ Block Dispatcher ════════════════

export function PersonaBlockRenderer({ data }: { data: PersonaBlockData }) {
  switch (data.block.blockType) {
    case 'tag_cloud':       return <TagCloudBlock data={data} />;
    case 'stat_badge':      return <StatBadgeBlock data={data} />;
    case 'distribution':    return <DistributionBlock data={data} />;
    case 'property_row':    return <PropertyRowBlock data={data} />;
    case 'text_card':       return <TextCardBlock data={data} />;
    case 'boolean_tick':    return <BooleanTickBlock data={data} />;
    case 'date_range':      return <DateRangeBlock data={data} />;
    case 'ranking_heatmap': return <RankingHeatmapBlock data={data} />;
    case 'grouped_compare':
      return <div className="text-sm text-gray-400 italic">分组对比（待渲染）</div>;
    default:
      return null;
  }
}
