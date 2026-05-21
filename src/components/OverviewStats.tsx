'use client';

import { Users, TrendingUp, MapPin, Target } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { CHART_COLORS } from '@/lib/utils';

interface OverviewData {
  total: number;
  strongIntent: number;
  weakIntent: number;
  conversionRate: string;
  areaDistribution: { area: string; count: number; pct: string }[];
  version: { version_id: number; record_count: number; uploaded_at: string } | null;
}

const STAT_CARDS = [
  {
    key: 'total',
    icon: Users,
    label: '总样本量',
    color: '#007AFF',
    bg: 'rgba(0,122,255,0.08)',
    format: (v: number) => v.toLocaleString(),
    sub: '份调研问卷',
  },
  {
    key: 'strongIntent',
    icon: Target,
    label: '强意向用户',
    color: '#34C759',
    bg: 'rgba(52,199,89,0.08)',
    format: (v: number) => v.toLocaleString(),
    sub: '已锁单 + 订单完成',
  },
  {
    key: 'conversionRate',
    icon: TrendingUp,
    label: '强意向占比',
    color: '#FF9500',
    bg: 'rgba(255,149,0,0.08)',
    format: (v: string) => `${v}%`,
    sub: '基准转化率',
  },
  {
    key: 'areaCount',
    icon: MapPin,
    label: '覆盖大区',
    color: '#5856D6',
    bg: 'rgba(88,86,214,0.08)',
    format: (v: number) => v.toString(),
    sub: '个地区',
  },
];

export function OverviewStats({ data }: { data: OverviewData }) {
  const statsValues: Record<string, string | number> = {
    total: data.total,
    strongIntent: data.strongIntent,
    conversionRate: data.conversionRate,
    areaCount: data.areaDistribution.length,
  };

  return (
    <div className="space-y-6">
      {/* 顶部数字卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map(({ key, icon: Icon, label, color, bg, format, sub }) => (
          <div key={key} className="glass-card p-5 animate-slide-up">
            <div className="flex items-start justify-between mb-3">
              <div
                className="w-10 h-10 rounded-ios flex items-center justify-center"
                style={{ background: bg }}
              >
                <Icon size={18} style={{ color }} strokeWidth={1.75} />
              </div>
              <span className="text-[11px] text-black/35 font-450 mt-1">{sub}</span>
            </div>
            <div
              className="text-[32px] font-700 tracking-tight leading-none mb-1"
              style={{ color }}
            >
              {format(statsValues[key] as never)}
            </div>
            <div className="text-[13px] text-black/50">{label}</div>
          </div>
        ))}
      </div>

      {/* 意向分布 + 大区分布 */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* 意向分布 */}
        <div className="glass-card p-6 lg:col-span-2">
          <h3 className="text-[16px] font-600 text-black/80 mb-4">意向强度分布</h3>

          <div className="space-y-3">
            {/* 强意向 */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[13px] text-black/60">强意向（锁单/完成）</span>
                <span className="text-[13px] font-600 text-[#34C759]">
                  {data.strongIntent.toLocaleString()} · {data.conversionRate}%
                </span>
              </div>
              <div className="progress-ios">
                <div
                  className="progress-ios-fill"
                  style={{
                    width: `${data.conversionRate}%`,
                    background: 'linear-gradient(90deg, #34C759, #5AC8FA)',
                  }}
                />
              </div>
            </div>

            {/* 弱意向 */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[13px] text-black/60">弱意向（未锁单）</span>
                <span className="text-[13px] font-600 text-black/45">
                  {data.weakIntent.toLocaleString()} · {(100 - parseFloat(data.conversionRate)).toFixed(1)}%
                </span>
              </div>
              <div className="progress-ios">
                <div
                  className="progress-ios-fill"
                  style={{
                    width: `${(100 - parseFloat(data.conversionRate)).toFixed(1)}%`,
                    background: 'rgba(0,0,0,0.15)',
                  }}
                />
              </div>
            </div>
          </div>

          {/* 数据版本信息 */}
          {data.version && (
            <div className="mt-6 pt-4 border-t border-black/08">
              <div className="text-[11px] text-black/35 space-y-0.5">
                <div>数据版本 v{data.version.version_id}</div>
                <div>
                  上传于 {new Date(data.version.uploaded_at).toLocaleString('zh-CN', {
                    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 大区样本分布 */}
        <div className="glass-card p-6 lg:col-span-3">
          <h3 className="text-[16px] font-600 text-black/80 mb-4">大区样本分布</h3>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.areaDistribution}
                layout="vertical"
                margin={{ left: 8, right: 40, top: 0, bottom: 0 }}
              >
                <XAxis type="number" tick={{ fontSize: 11, fill: 'rgba(0,0,0,0.35)' }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="area"
                  width={36}
                  tick={{ fontSize: 12, fill: 'rgba(0,0,0,0.55)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="glass-card px-3 py-2 text-[12px]">
                        <div className="font-600 text-black/75">{d.area}</div>
                        <div className="text-black/50">{d.count} 人 · {d.pct}%</div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
                  {data.areaDistribution.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.75} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 快捷入口 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { href: '/profile',   label: '查看用户画像',    sub: '13 个维度分布',     color: '#007AFF' },
          { href: '/compare',   label: '地域对比分析',    sub: '选择多地区对比',     color: '#5856D6' },
          { href: '/predict',   label: '意向预测',        sub: 'AI 评估购买意向',    color: '#34C759' },
          { href: '/insights',  label: '核心用户洞察',    sub: '转化潜力评分',       color: '#FF9500' },
        ].map(({ href, label, sub, color }) => (
          <a
            key={href}
            href={href}
            className="glass-card-subtle p-4 flex items-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-transform no-tap cursor-pointer"
          >
            <div
              className="w-2 h-8 rounded-full flex-shrink-0"
              style={{ background: color }}
            />
            <div>
              <div className="text-[14px] font-600 text-black/75">{label}</div>
              <div className="text-[11px] text-black/40 mt-0.5">{sub}</div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
