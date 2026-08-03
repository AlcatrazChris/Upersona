'use client';

import { getColors } from '@/lib/chartConfig';
import { applyTopN } from './shared';
import type { ChartEngineProps } from './types';

export function WordCloudEngine({ data: raw, config, height }: ChartEngineProps) {
  const data = applyTopN(raw, config.topN).filter(item => item.count > 0);
  const colors = getColors(config.colorScheme);
  const max = Math.max(...data.map(item => item.count), 1);
  const min = Math.min(...data.map(item => item.count), max);
  const span = max - min || 1;

  return (
    <div
      className="flex flex-wrap content-center items-center justify-center gap-x-4 gap-y-3 overflow-hidden"
      style={{
        minHeight: height ?? config.chartHeight,
        padding: config.chartPadding,
        background: config.backgroundColor,
        fontFamily: config.fontFamily,
      }}
      aria-label="词云"
    >
      {data.map((item, index) => {
        const weight = (item.count - min) / span;
        return (
          <span
            key={item.label}
            title={config.showTooltip ? `${item.label}：${item.count}（${item.percentage.toFixed(1)}%）` : undefined}
            className="max-w-full cursor-default truncate font-semibold leading-none transition-transform hover:scale-105"
            style={{
              color: colors[index % colors.length],
              fontSize: `${Math.round(13 + weight * 27)}px`,
              opacity: Math.max(.45, config.barOpacity * (.62 + weight * .38)),
            }}
          >
            {item.label}
          </span>
        );
      })}
    </div>
  );
}
