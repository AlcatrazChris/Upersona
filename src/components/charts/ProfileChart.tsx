'use client';

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, LabelList, CartesianGrid,
} from 'recharts';
import { getColors } from '@/lib/chartConfig';
import type { ChartConfig } from '@/lib/chartConfig';
import type { ProfileData } from '@/types';

interface Props {
  data: ProfileData;
  config: ChartConfig;
}

function CustomTooltip({ active, payload, isMultiSelect, totalSamples }: {
  active?: boolean;
  payload?: { payload: { label: string; count: number; percentage: number } }[];
  isMultiSelect: boolean;
  totalSamples: number;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="glass-card-elevated px-3 py-2.5 text-[12px] min-w-[140px]">
      <div className="font-600 text-black/80 mb-1">{d.label}</div>
      <div className="text-black/55">{d.count} 人</div>
      <div className="text-black/45">{d.percentage.toFixed(1)}%</div>
      {isMultiSelect && (
        <div className="text-black/30 text-[10px] mt-0.5">样本数：{totalSamples} 人</div>
      )}
    </div>
  );
}

export function ProfileChart({ data, config }: Props) {
  const { dimensionLabel, items, totalSamples, validSamples, isMultiSelect, note } = data;
  const colors = getColors(config.colorScheme);
  const barHeight = 26;
  const chartHeight = Math.max(160, items.length * barHeight + 40);

  // 样本数文字：单选显示有效样本，多选显示总样本
  const sampleText = isMultiSelect
    ? `样本数 n=${totalSamples.toLocaleString()}，各项之和 = 100%`
    : `有效样本 n=${validSamples.toLocaleString()}`;

  return (
    <div className="p-5">
      <div className="mb-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[15px] font-600 text-black/80">{dimensionLabel}</h3>
          {isMultiSelect && (
            <span className="badge-ios badge-blue text-[10px] flex-shrink-0 mt-0.5">多选</span>
          )}
        </div>
        {/* 样本数描述：受 showSampleCount 控制 */}
        {config.showSampleCount && (
          <div className="text-[11px] text-black/35 mt-0.5">{sampleText}</div>
        )}
        {note && !isMultiSelect && (
          <div className="text-[10px] text-black/28 mt-0.5">{note}</div>
        )}
      </div>

      <div style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={items}
            layout="vertical"
            margin={{ left: 0, right: config.showLabel ? 50 : 10, top: 0, bottom: 0 }}
            barCategoryGap="20%"
          >
            {config.showGrid && (
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
            )}
            {config.showXAxis && (
              <XAxis
                type="number"
                tick={{ fontSize: config.axisFontSize, fill: 'rgba(0,0,0,0.30)' }}
                axisLine={false} tickLine={false}
                tickFormatter={v => `${v}%`}
              />
            )}
            {config.showYAxis && (
              <YAxis
                type="category" dataKey="label" width={85}
                tick={{ fontSize: config.axisFontSize, fill: 'rgba(0,0,0,0.55)' }}
                axisLine={false} tickLine={false}
              />
            )}
            {config.showTooltip && (
              <Tooltip
                content={({ active, payload }) => (
                  <CustomTooltip
                    active={active}
                    payload={payload as { payload: { label: string; count: number; percentage: number } }[]}
                    isMultiSelect={isMultiSelect}
                    totalSamples={totalSamples}
                  />
                )}
                cursor={{ fill: 'rgba(0,0,0,0.03)' }}
              />
            )}
            <Bar dataKey="percentage" radius={[0, config.barRadius, config.barRadius, 0]} barSize={18}>
              {items.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} fillOpacity={config.barOpacity} />
              ))}
              {config.showLabel && (
                <LabelList
                  dataKey="percentage" position="right"
                  formatter={(v: number) => `${v.toFixed(1)}%`}
                  style={{ fontSize: config.labelFontSize, fill: 'rgba(0,0,0,0.45)', fontWeight: 500 }}
                />
              )}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
