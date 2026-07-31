'use client';

import { applyTopN } from './shared';
import { getColors } from '@/lib/chartConfig';
import type { ChartEngineProps } from './types';

export function WaffleChartEngine({ data: raw, config }: ChartEngineProps) {
  const data = applyTopN(raw, Math.min(config.topN || 5, 5));
  const colors = getColors(config.colorScheme);
  const cells = Array.from({ length: 100 }, (_, index) => {
    const pct = index + 1;
    let total = 0;
    const itemIndex = data.findIndex(item => {
      total += item.percentage;
      return pct <= total;
    });
    return itemIndex;
  });
  return (
    <div className="grid gap-5 sm:grid-cols-[minmax(180px,240px)_1fr]">
      <div className="grid aspect-square grid-cols-10 gap-1" role="img" aria-label="百分比构成图">
        {cells.map((itemIndex, index) => (
          <span key={index} className="rounded-[2px]" style={{
            background: itemIndex >= 0 ? colors[itemIndex % colors.length] : '#e2e8f0',
            opacity: config.barOpacity,
          }} />
        ))}
      </div>
      {config.showLegend && <div className="space-y-2 self-center">
        {data.map((item, index) => (
          <div key={item.label} className="flex items-center gap-2 text-xs text-slate-600">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: colors[index % colors.length] }} />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {config.showLabel && <span className="font-semibold text-slate-900 tabular-nums">{item.percentage.toFixed(1)}%</span>}
          </div>
        ))}
      </div>}
    </div>
  );
}
