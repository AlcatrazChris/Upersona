'use client';

import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';

const STATUS_COLORS: Record<string, string> = {
  '锁单/提车': '#34C759',
  '未锁单':    '#FF9500',
  '退单':      '#FF3B30',
};
const ALL_STATUSES = ['锁单/提车', '未锁单', '退单'];

// ── 滚动显示的 Y 轴 tick ────────────────────────────────────
function ScrollYTick({ x, y, payload, maxWidth = 88 }: {
  x?: number; y?: number;
  payload?: { value: string };
  maxWidth?: number;
}) {
  const [scrolling, setScrolling] = useState(false);
  const text = payload?.value ?? '';
  // 超过 8 个字符才启用滚动
  const needsScroll = text.length > 8;

  if (!needsScroll) {
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={-4} y={0} dy={4} textAnchor="end"
          fill="rgba(0,0,0,0.60)" fontSize={11}>
          {text}
        </text>
      </g>
    );
  }

  return (
    <g transform={`translate(${(x ?? 0) - maxWidth},${y})`}>
      <foreignObject x={0} y={-9} width={maxWidth - 4} height={18}>
        <div
          style={{
            width: maxWidth - 4,
            height: 18,
            overflow: 'hidden',
            fontSize: 11,
            color: 'rgba(0,0,0,0.60)',
            lineHeight: '18px',
            whiteSpace: 'nowrap',
            cursor: 'default',
          }}
          onMouseEnter={() => setScrolling(true)}
          onMouseLeave={() => setScrolling(false)}
        >
          <span style={{
            display: 'inline-block',
            transition: scrolling ? `transform ${Math.max(1.5, text.length * 0.12)}s linear` : 'none',
            transform: scrolling ? `translateX(calc(${maxWidth - 4}px - 100% - 4px))` : 'translateX(0)',
          }}>
            {text}
          </span>
        </div>
      </foreignObject>
    </g>
  );
}

interface DimData {
  dimKey: string;
  dimLabel: string;
  rows: Record<string, string | number>[];
  allLabels: string[];
}

interface Props {
  dimData: DimData;
  activeStatuses: string[];
}

export function StatusClusteredChart({ dimData, activeStatuses }: Props) {
  const { rows, allLabels, dimLabel } = dimData;
  const barH   = 18;
  const gap    = 4;
  const groupH = activeStatuses.length * (barH + gap) + 12;
  const chartH = Math.max(180, allLabels.length * groupH + 50);
  const yAxisW = 92;

  const barSize = Math.max(8, Math.min(barH, Math.floor(groupH / activeStatuses.length) - 2));

  return (
    <div>
      <div className="text-[13px] font-600 text-black/65 mb-2 px-1">{dimLabel}</div>
      <div style={{ height: chartH }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ left: 0, right: 44, top: 4, bottom: 4 }}
            barCategoryGap="20%"
            barGap={2}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: 'rgba(0,0,0,0.28)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => `${v}%`}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={yAxisW}
              tick={<ScrollYTick maxWidth={yAxisW} />}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="glass-card-elevated px-3 py-2 text-[11px] min-w-[140px]">
                    <div className="font-600 text-black/75 mb-1.5">{label}</div>
                    {payload.map((p, i: number) => {
                      const name = String(p.name ?? '');
                      return (
                        <div key={i} className="flex items-center justify-between gap-3 mb-0.5">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-sm"
                              style={{ background: STATUS_COLORS[name] }} />
                            <span className="text-black/55">{name}</span>
                          </div>
                          <span className="font-600 tabular-nums">{Number(p.value ?? 0).toFixed(1)}%</span>
                        </div>
                      );
                    })}
                  </div>
                );
              }}
              cursor={{ fill: 'rgba(0,0,0,0.03)' }}
            />
            <Legend
              formatter={v => (
                <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.50)' }}>{v}</span>
              )}
            />
            {ALL_STATUSES.filter(s => activeStatuses.includes(s)).map(status => (
              <Bar
                key={status}
                dataKey={status}
                name={status}
                fill={STATUS_COLORS[status]}
                fillOpacity={0.82}
                barSize={barSize}
                radius={[0, 3, 3, 0]}
                label={{
                  position: 'right',
                  formatter: (v: number) => v >= 3 ? `${Math.round(v)}%` : '',
                  style: { fontSize: 10, fill: 'rgba(0,0,0,0.38)' },
                }}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
