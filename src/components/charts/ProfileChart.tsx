'use client';

/**
 * ProfileChart
 *
 * 保持对外接口不变（ProfileData + ChartConfig），
 * 内部改为调用统一 ChartRenderer，消除重复代码。
 *
 * 如需在页面中同时使用隐藏/导出等卡片功能，
 * 请直接使用 <ChartCard /> 替代本组件。
 */

import { ChartRenderer } from './engine/ChartRenderer';
import type { ChartConfig } from '@/lib/chartConfig';
import type { ProfileData } from '@/types';
import type { ChartType } from './engine/types';

interface Props {
  data:   ProfileData;
  config: ChartConfig;
}

export function ProfileChart({ data, config }: Props) {
  const {
    dimensionLabel, items, totalSamples, validSamples,
    isMultiSelect, note, chartType,
  } = data;

  // ProfileData.chartType 是 'bar' | 'pie'
  // 旧数据中 'pie' → donut（环形图，视觉更清晰）
  const resolvedType: ChartType =
    chartType === 'pie' ? 'donut' : (chartType as ChartType) ?? 'bar';

  const sampleText = isMultiSelect
    ? `样本数 n=${totalSamples.toLocaleString()}，各项之和 = 100%`
    : `有效样本 n=${validSamples.toLocaleString()}`;

  return (
    <div className="p-5">
      {/* 标题区 */}
      <div className="mb-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[15px] font-600 text-black/80">{dimensionLabel}</h3>
          {isMultiSelect && (
            <span className="badge-ios badge-blue text-[10px] flex-shrink-0 mt-0.5">多选</span>
          )}
        </div>
        <div className="text-[11px] text-black/35 mt-0.5">{sampleText}</div>
        {note && !isMultiSelect && (
          <div className="text-[10px] text-black/28 mt-0.5">{note}</div>
        )}
      </div>

      {/* 图表 */}
      <ChartRenderer
        type={resolvedType}
        data={items}
        config={config}
        isMultiSelect={isMultiSelect}
        totalSamples={totalSamples}
      />
    </div>
  );
}
