'use client';

import { useState } from 'react';
import { Users, CheckCircle, Clock, XCircle, MapPin } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, Legend,
} from 'recharts';
import { cn } from '@/lib/utils';

const ALL_STATUSES = ['锁单/提车', '未锁单', '退单'];
const STATUS_COLORS_MAP: Record<string, string> = {
  '锁单/提车': '#34C759',
  '未锁单':    '#FF9500',
  '退单':      '#FF3B30',
};

interface AreaItem {
  area: string; total: number;
  locked: number; pending: number; cancelled: number;
}

interface OverviewData {
  total: number;
  locked: number;
  pending: number;
  cancelled: number;
  lockedRate: string;
  cancelledRate: string;
  areaDistribution: AreaItem[];
  version: { version_id: number; record_count: number; uploaded_at: string } | null;
}

interface DimData {
  dimKey: string;
  dimLabel: string;
  rows: Record<string, string | number>[];
  allLabels: string[];
}

interface OverviewDimsData {
  dims: DimData[];
  statusGroups: { key: string; color: string }[];
  totalSamples: number;
}

const COLORS = { locked: '#34C759', pending: '#FF9500', cancelled: '#FF3B30' };

// ── 单个维度簇状图卡片 ────────────────────────────────────────
function DimCard({ dimData, activeStatuses }: { dimData: DimData; activeStatuses: string[] }) {
  const { rows, allLabels, dimLabel } = dimData;
  const groupH = activeStatuses.length * 22 + 10;
  const chartH = Math.max(160, allLabels.length * groupH + 48);
  const barSize = Math.max(7, Math.min(16, Math.floor(groupH / activeStatuses.length) - 2));

  return (
    <div className="glass-card p-4">
      <div className="text-[13px] font-600 text-black/65 mb-3">{dimLabel}</div>
      <div style={{ height: chartH }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ left: 0, right: 42, top: 2, bottom: 2 }}
            barCategoryGap="18%"
            barGap={2}
          >
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis
              type="category"
              dataKey="label"
              width={88}
              tick={({ x, y, payload }) => {
                const text: string = payload?.value ?? '';
                return (
                  <g transform={`translate(${x},${y})`}>
                    <text x={-4} y={0} dy={4} textAnchor="end"
                      fill="rgba(0,0,0,0.58)" fontSize={10}>
                      {text.length > 9 ? text.slice(0, 8) + '…' : text}
                    </text>
                  </g>
                );
              }}
              axisLine={false} tickLine={false}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="glass-card-elevated px-2.5 py-2 text-[11px] min-w-[130px]">
                    <div className="font-600 text-black/70 mb-1">{label}</div>
                    {payload.map((p, i: number) => {
                      const name = String(p.name ?? '');
                      return (
                        <div key={i} className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-sm" style={{ background: STATUS_COLORS_MAP[name] }} />
                            <span className="text-black/50">{name}</span>
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
            {ALL_STATUSES.filter(s => activeStatuses.includes(s)).map(status => (
              <Bar key={status} dataKey={status} name={status}
                fill={STATUS_COLORS_MAP[status]} fillOpacity={0.82}
                barSize={barSize} radius={[0, 3, 3, 0]}
                label={{
                  position: 'right',
                  formatter: (v: number) => v >= 5 ? `${Math.round(v)}%` : '',
                  style: { fontSize: 9, fill: 'rgba(0,0,0,0.35)' },
                }}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function OverviewStats({ data }: { data: OverviewData }) {
  const [activeStatuses, setActiveStatuses] = useState<string[]>(ALL_STATUSES);
  const pendingRate = (100 - parseFloat(data.lockedRate) - parseFloat(data.cancelledRate)).toFixed(1);

  function toggleStatus(s: string) {
    setActiveStatuses(prev =>
      prev.includes(s)
        ? prev.length > 1 ? prev.filter(x => x !== s) : prev
        : [...prev, s]
    );
  }

  const statCards = [
    { icon: Users,        label: '总样本量',  value: data.total.toLocaleString(),    sub: '份调研问卷',        color: '#007AFF', bg: 'rgba(0,122,255,0.08)' },
    { icon: CheckCircle,  label: '锁单/提车', value: data.locked.toLocaleString(),   sub: `占比 ${data.lockedRate}%`,   color: '#34C759', bg: 'rgba(52,199,89,0.08)' },
    { icon: Clock,        label: '未锁单',    value: data.pending.toLocaleString(),  sub: `占比 ${pendingRate}%`,       color: '#FF9500', bg: 'rgba(255,149,0,0.08)' },
    { icon: XCircle,      label: '退单',      value: data.cancelled.toLocaleString(),sub: `占比 ${data.cancelledRate}%`,color: '#FF3B30', bg: 'rgba(255,59,48,0.08)' },
  ];

  const barData = data.areaDistribution.map(a => ({
    area: a.area,
    锁单提车: a.locked,
    未锁单:   a.pending,
    退单:     a.cancelled,
    total:    a.total,
  }));

  return (
    <div className="space-y-5">
      {/* 4张统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ icon: Icon, label, value, sub, color, bg }) => (
          <div key={label} className="glass-card p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-ios flex items-center justify-center" style={{ background: bg }}>
                <Icon size={18} style={{ color }} strokeWidth={1.75} />
              </div>
              <span className="text-[11px] text-black/35 mt-1">{sub}</span>
            </div>
            <div className="text-[32px] font-700 tracking-tight leading-none mb-1" style={{ color }}>
              {value}
            </div>
            <div className="text-[13px] text-black/50">{label}</div>
          </div>
        ))}
      </div>

      {/* 订单状态分布 + 大区分布 */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="glass-card p-6 lg:col-span-2 flex flex-col justify-between">
          <h3 className="text-[16px] font-600 text-black/80 mb-5">订单状态分布</h3>
          <div className="space-y-4 flex-1">
            {[
              { label: '锁单/提车', count: data.locked,    rate: data.lockedRate,    color: COLORS.locked },
              { label: '未锁单',    count: data.pending,   rate: pendingRate,         color: COLORS.pending },
              { label: '退单',      count: data.cancelled, rate: data.cancelledRate,  color: COLORS.cancelled },
            ].map(({ label, count, rate, color }) => (
              <div key={label}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[13px] text-black/60">{label}</span>
                  <span className="text-[13px] font-600 tabular-nums" style={{ color }}>
                    {count.toLocaleString()} · {rate}%
                  </span>
                </div>
                <div className="progress-ios">
                  <div className="progress-ios-fill" style={{ width: `${rate}%`, background: color }} />
                </div>
              </div>
            ))}
          </div>
          {data.version && (
            <div className="mt-5 pt-4 border-t border-black/08 text-[11px] text-black/35 space-y-0.5">
              <div>数据版本 v{data.version.version_id}</div>
              <div>{new Date(data.version.uploaded_at).toLocaleString('zh-CN', {
                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
              })}</div>
            </div>
          )}
        </div>
        <div className="glass-card p-6 lg:col-span-3">
          <div className="flex items-center gap-2 mb-4">
            <MapPin size={14} className="text-black/40" />
            <h3 className="text-[16px] font-600 text-black/80">大区订单分布</h3>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical"
                margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <XAxis type="number" tick={{ fontSize: 11, fill: 'rgba(0,0,0,0.30)' }}
                  axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="area" width={36}
                  tick={{ fontSize: 12, fill: 'rgba(0,0,0,0.55)' }}
                  axisLine={false} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="glass-card-elevated px-3 py-2.5 text-[12px]">
                        <div className="font-600 text-black/75 mb-1">{d.area}</div>
                        {[['锁单/提车', d.锁单提车, COLORS.locked], ['未锁单', d.未锁单, COLORS.pending], ['退单', d.退单, COLORS.cancelled]].map(([l, v, c]) => (
                          <div key={l as string} className="flex justify-between gap-4">
                            <span style={{ color: c as string }}>{l as string}</span>
                            <span className="font-500">{v as number}</span>
                          </div>
                        ))}
                        <div className="flex justify-between gap-4 pt-1 border-t border-black/08 mt-1">
                          <span className="text-black/40">合计</span>
                          <span className="font-600">{d.total}</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }}
                  formatter={v => <span style={{ color: 'rgba(0,0,0,0.55)', fontSize: 12 }}>{v}</span>} />
                <Bar dataKey="锁单提车" name="锁单/提车" stackId="s" fill={COLORS.locked} fillOpacity={0.82} barSize={16} />
                <Bar dataKey="未锁单" stackId="s" fill={COLORS.pending} fillOpacity={0.82} barSize={16} />
                <Bar dataKey="退单" stackId="s" fill={COLORS.cancelled} fillOpacity={0.82} radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>


    </div>
  );
}
