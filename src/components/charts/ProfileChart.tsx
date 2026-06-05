'use client';

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, LabelList, CartesianGrid,
  PieChart, Pie, Legend,
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

// 饼图内部标签（白色，仅显示占比 ≥ 4% 的扇区）
const RADIAN = Math.PI / 180;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PieSliceLabel(props: any) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percentage, count, showLabel, labelType } = props;
  if (!showLabel || percentage < 4) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.52;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  const text = labelType === 'count' ? `${count}` : `${percentage.toFixed(0)}%`;
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
      style={{ fontSize: 11, fontWeight: 600, pointerEvents: 'none' }}>
      {text}
    </text>
  );
}

// 共用图表标题区
function ChartHeader({ dimensionLabel, isMultiSelect, sampleText, showSampleCount, note }: {
  dimensionLabel: string; isMultiSelect: boolean; sampleText: string;
  showSampleCount: boolean; note?: string;
}) {
  return (
    <div className="mb-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-600 text-black/80">{dimensionLabel}</h3>
        {isMultiSelect && (
          <span className="badge-ios badge-blue text-[10px] flex-shrink-0 mt-0.5">多选</span>
        )}
      </div>
      {showSampleCount && (
        <div className="text-[11px] text-black/35 mt-0.5">{sampleText}</div>
      )}
      {note && !isMultiSelect && (
        <div className="text-[10px] text-black/28 mt-0.5">{note}</div>
      )}
    </div>
  );
}

export function ProfileChart({ data, config }: Props) {
  const { dimensionLabel, items, totalSamples, validSamples, isMultiSelect, note, chartType } = data;
  const colors = getColors(config.colorScheme);

  const sampleText = isMultiSelect
    ? `样本数 n=${totalSamples.toLocaleString()}，各项之和 = 100%`
    : `有效样本 n=${validSamples.toLocaleString()}`;

  // ── 饼图模式 ──────────────────────────────────────────────────
  if (chartType === 'pie' && !isMultiSelect) {
    return (
      <div className="p-5">
        <ChartHeader
          dimensionLabel={dimensionLabel} isMultiSelect={isMultiSelect}
          sampleText={sampleText} showSampleCount={config.showSampleCount} note={note}
        />
        <div style={{ height: 272 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <Pie
                data={items}
                dataKey="percentage"
                nameKey="label"
                cx="50%" cy="44%"
                innerRadius={44}
                outerRadius={78}
                paddingAngle={2}
                label={(props) => (
                  <PieSliceLabel {...props}
                    showLabel={config.showLabel}
                    labelType={config.labelType}
                  />
                )}
                labelLine={false}
              >
                {items.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} fillOpacity={config.barOpacity} />
                ))}
              </Pie>
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
                />
              )}
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: config.axisFontSize - 1, color: 'rgba(0,0,0,0.55)', paddingTop: 2 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // ── 条形图模式（默认）─────────────────────────────────────────
  const barHeight = 26;
  const chartHeight = Math.max(160, items.length * barHeight + 40);

  return (
    <div className="p-5">
      <ChartHeader
        dimensionLabel={dimensionLabel} isMultiSelect={isMultiSelect}
        sampleText={sampleText} showSampleCount={config.showSampleCount} note={note}
      />

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
              {config.showLabel && config.labelType === 'pct' && (
                <LabelList
                  dataKey="percentage" position="right"
                  formatter={(v: number) => `${v.toFixed(1)}%`}
                  style={{ fontSize: config.labelFontSize, fill: 'rgba(0,0,0,0.45)', fontWeight: 500 }}
                />
              )}
              {config.showLabel && config.labelType === 'count' && (
                <LabelList
                  dataKey="count" position="right"
                  formatter={(v: number) => `${v}`}
                  style={{ fontSize: config.labelFontSize, fill: 'rgba(0,0,0,0.45)', fontWeight: 500 }}
                />
              )}
              {config.showLabel && config.labelType === 'both' && (
                <LabelList
                  dataKey="percentage" position="right"
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  content={({ x, y, width, height, value, index }: any) => {
                    const item = items[index];
                    if (!item || x == null || y == null) return null;
                    const labelX = (x as number) + (width as number) + 6;
                    const labelY = (y as number) + (height as number) / 2 + 1;
                    return (
                      <text x={labelX} y={labelY} dominantBaseline="middle"
                        style={{ fontSize: config.labelFontSize, fill: 'rgba(0,0,0,0.45)', fontWeight: 500 }}>
                        {Number(value).toFixed(1)}% / {item.count}
                      </text>
                    );
                  }}
                />
              )}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
