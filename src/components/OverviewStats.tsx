'use client';

import { Users, CheckCircle, Clock, XCircle, MapPin } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, Legend,
} from 'recharts';

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

const COLORS = { locked: '#34C759', pending: '#FF9500', cancelled: '#FF3B30' };

export function OverviewStats({ data }: { data: OverviewData }) {
  const pendingRate = (100 - parseFloat(data.lockedRate) - parseFloat(data.cancelledRate)).toFixed(1);

  const statCards = [
    {
      icon: Users,       label: '总样本量',   value: data.total.toLocaleString(),
      sub: '份调研问卷', color: '#007AFF',    bg: 'rgba(0,122,255,0.08)',
    },
    {
      icon: CheckCircle, label: '锁单/提车',  value: data.locked.toLocaleString(),
      sub: `占比 ${data.lockedRate}%`,        color: '#34C759', bg: 'rgba(52,199,89,0.08)',
    },
    {
      icon: Clock,       label: '未锁单',     value: data.pending.toLocaleString(),
      sub: `占比 ${pendingRate}%`,            color: '#FF9500', bg: 'rgba(255,149,0,0.08)',
    },
    {
      icon: XCircle,     label: '退单',       value: data.cancelled.toLocaleString(),
      sub: `占比 ${data.cancelledRate}%`,     color: '#FF3B30', bg: 'rgba(255,59,48,0.08)',
    },
  ];

  // 大区堆积图数据
  const barData = data.areaDistribution.map(a => ({
    area: a.area,
    锁单提车: a.locked,
    未锁单:   a.pending,
    退单:     a.cancelled,
    total:    a.total,
  }));

  return (
    <div className="space-y-5">
      {/* 顶部 4 张数字卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ icon: Icon, label, value, sub, color, bg }) => (
          <div key={label} className="glass-card p-5 animate-slide-up">
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

      {/* 订单状态分布条 + 大区分布图 */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* 左：三段分布条 */}
        <div className="glass-card p-6 lg:col-span-2 flex flex-col justify-between">
          <h3 className="text-[16px] font-600 text-black/80 mb-5">订单状态分布</h3>

          <div className="space-y-4 flex-1">
            {[
              { label: '锁单/提车', count: data.locked,    rate: data.lockedRate,    color: COLORS.locked },
              { label: '未锁单',   count: data.pending,   rate: pendingRate,         color: COLORS.pending },
              { label: '退单',     count: data.cancelled, rate: data.cancelledRate,  color: COLORS.cancelled },
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

          {/* 版本信息 */}
          {data.version && (
            <div className="mt-5 pt-4 border-t border-black/08 text-[11px] text-black/35 space-y-0.5">
              <div>数据版本 v{data.version.version_id}</div>
              <div>上传于 {new Date(data.version.uploaded_at).toLocaleString('zh-CN', {
                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
              })}</div>
            </div>
          )}
        </div>

        {/* 右：大区堆积柱图 */}
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
                      <div className="glass-card-elevated px-3 py-2.5 text-[12px] min-w-[140px]">
                        <div className="font-600 text-black/75 mb-1.5">{d.area}</div>
                        <div className="space-y-0.5">
                          <div className="flex justify-between gap-4">
                            <span style={{ color: COLORS.locked }}>锁单/提车</span>
                            <span className="font-500">{d.锁单提车}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span style={{ color: COLORS.pending }}>未锁单</span>
                            <span className="font-500">{d.未锁单}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span style={{ color: COLORS.cancelled }}>退单</span>
                            <span className="font-500">{d.退单}</span>
                          </div>
                          <div className="flex justify-between gap-4 pt-1 border-t border-black/08">
                            <span className="text-black/40">合计</span>
                            <span className="font-600">{d.total}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }}
                  formatter={v => <span style={{ color: 'rgba(0,0,0,0.55)', fontSize: 12 }}>{v}</span>} />
                <Bar dataKey="锁单提车" name="锁单/提车" stackId="s" fill={COLORS.locked}
                  fillOpacity={0.82} radius={[0, 0, 0, 0]} barSize={16} />
                <Bar dataKey="未锁单" stackId="s" fill={COLORS.pending}
                  fillOpacity={0.82} radius={[0, 0, 0, 0]} barSize={16} />
                <Bar dataKey="退单" stackId="s" fill={COLORS.cancelled}
                  fillOpacity={0.82} radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 快捷入口 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { href: '/profile',  label: '用户画像',   sub: '多维度分布分析',  color: '#007AFF' },
          { href: '/compare',  label: '地域对比',   sub: '跨地区数据比较',  color: '#5856D6' },
          { href: '/predict',  label: '雷达对比',   sub: '五维特征雷达图',  color: '#34C759' },
          { href: '/insights', label: '核心洞察',   sub: 'AI 用户画像卡片', color: '#FF9500' },
        ].map(({ href, label, sub, color }) => (
          <a key={href} href={href}
            className="glass-card-subtle p-4 flex items-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-transform no-tap cursor-pointer">
            <div className="w-2 h-8 rounded-full flex-shrink-0" style={{ background: color }} />
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
