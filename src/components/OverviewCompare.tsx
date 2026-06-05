'use client';

import { useState, useEffect } from 'react';
import { GitCompare, Loader2, AlertCircle, ChevronDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { AREA_LIST, ORDER_STATUS_OPTIONS } from '@/types';
import type { DimensionConfig, DataVersion } from '@/types';

const MAX_SLOTS = 3;
const SLOT_COLORS = ['#007AFF', '#34C759', '#FF9500'];

interface CompareSlot {
  id: number;
  versionId: number | null;
  orderStatus: string;
  area?: string;
  province?: string;
  city?: string;
  label: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CompareData = any;

interface Props { versions: DataVersion[]; profileDims: DimensionConfig[]; }

function VersionName(v: DataVersion) { return v.version_name || v.notes || 'v' + v.version_id; }

export function OverviewCompare({ versions, profileDims }: Props) {
  const [dimKey, setDimKey] = useState(profileDims.length > 0 ? (profileDims[0].key as string) : '');
  const [slots, setSlots] = useState<CompareSlot[]>([
    { id: 1, versionId: null, orderStatus: 'all', label: 'C1' },
    { id: 2, versionId: null, orderStatus: 'all', label: 'C2' },
  ]);
  const [slotData, setSlotData] = useState<Map<string, CompareData>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => { setSlotData(new Map()); setError(''); }, [dimKey]);

  function addSlot() {
    if (slots.length >= MAX_SLOTS) return;
    setSlots([...slots, { id: Math.max(...slots.map(s => s.id), 0) + 1, versionId: null, orderStatus: 'all', label: 'C' + (slots.length + 1) }]);
  }
  function removeSlot(id: number) {
    if (slots.length <= 2) return;
    setSlots(slots.filter(s => s.id !== id));
    setSlotData(prev => { const n = new Map(prev); n.delete(String(id)); return n; });
  }
  function updateSlot(id: number, updates: Partial<CompareSlot>) {
    setSlots(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }

  async function runCompare() {
    const valid = slots.filter(s => s.versionId !== null);
    if (valid.length < 2) { setError('请至少选择 2 个对比组'); return; }
    setLoading(true); setError('');
    const results = new Map<string, CompareData>();
    for (const slot of valid) {
      const params = new URLSearchParams({ dim: dimKey, versionId: String(slot.versionId) });
      if (slot.orderStatus !== 'all') params.set('orderStatus', slot.orderStatus);
      if (slot.city) { params.set('city', slot.city); params.set('province', slot.province || ''); params.set('area', slot.area || ''); }
      else if (slot.province) { params.set('province', slot.province); params.set('area', slot.area || ''); }
      else if (slot.area) params.set('area', slot.area);
      try {
        const res = await fetch('/api/status-compare?' + params, { cache: 'no-store' });
        const json = await res.json();
        if (res.ok) results.set(String(slot.id), json);
      } catch {}
    }
    setSlotData(results); setLoading(false);
  }

  // Region cascade state per slot
  const [regions, setRegions] = useState<Record<number, { provinces: string[]; cities: string[] }>>({});
  useEffect(() => {
    slots.forEach(slot => {
      if (slot.area && !regions[slot.id]?.provinces.length) {
        supabase.from('active_users').select('region_province').eq('region_area', slot.area)
          .then(({ data }) => {
            const p = [...new Set((data || []).map((d: { region_province: string }) => d.region_province))].sort();
            setRegions(prev => ({ ...prev, [slot.id]: { provinces: p, cities: prev[slot.id]?.cities || [] } }));
          });
      }
      if (slot.province) {
        supabase.from('active_users').select('region_city').eq('region_province', slot.province)
          .then(({ data }) => {
            const c = [...new Set((data || []).map((d: { region_city: string }) => d.region_city))].sort();
            setRegions(prev => ({ ...prev, [slot.id]: { provinces: prev[slot.id]?.provinces || [], cities: c } }));
          });
      }
    });
  }, [slots.map(s => s.area + '|' + s.province).join(',')]);

  const validSlots = slots.filter(s => s.versionId !== null);
  const entries = Array.from(slotData.entries());
  const allLabels = [...new Set(entries.flatMap(([, d]) => (d as CompareData).allLabels || []))].slice(0, 20);

  const chartData = allLabels.map(label => {
    const entry: Record<string, string | number> = { label };
    for (const [id, data] of entries) {
      const row = (data as CompareData).rows?.find((r: { label: string }) => r.label === label);
      entry['s' + id] = row ? Math.max(...row.statusCounts.map((s: { pct: number }) => s.pct)) : 0;
    }
    return entry;
  });

  if (profileDims.length === 0) return null;

  return (
    <div className="glass-card overflow-hidden">
      <button className="w-full flex items-center justify-between px-5 py-4 hover:bg-black/02 transition-colors no-tap" onClick={() => setExpanded(p => !p)}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#5856D6]/10 flex items-center justify-center">
            <GitCompare size={15} className="text-[#5856D6]" />
          </div>
          <div className="text-left">
            <div className="text-[14px] font-600 text-black/80">多维对比</div>
            <div className="text-[11px] text-black/35 mt-0.5">跨版本 / 状态 / 地区 多角度分析</div>
          </div>
        </div>
        {expanded
          ? <ChevronDown size={14} className="text-black/30 rotate-180" />
          : <ChevronDown size={14} className="text-black/30" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-black/06 space-y-4 pt-4">
          {/* 维度选择 */}
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-black/45 w-16 flex-shrink-0">维度</span>
            <select value={dimKey} onChange={e => setDimKey(e.target.value)}
              className="input-ios text-[12px] py-1.5 px-2 rounded-ios">
              {profileDims.map(d => <option key={d.key as string} value={d.key as string}>{d.label}</option>)}
            </select>
          </div>

          {/* 对比槽 */}
          {slots.map((slot, idx) => (
            <div key={slot.id} className="flex items-center gap-2 flex-wrap">
              <span className={cn('text-[12px] w-16 flex-shrink-0 font-500',
                idx === 0 ? 'text-[#007AFF]' : idx === 1 ? 'text-[#34C759]' : 'text-[#FF9500]')}>
                对比 {idx + 1}
              </span>
              <select value={slot.versionId ?? ''} onChange={e => updateSlot(slot.id, { versionId: e.target.value ? parseInt(e.target.value, 10) : null })}
                className="input-ios text-[12px] py-1.5 px-2 rounded-ios w-[150px]">
                <option value="">选择版本</option>
                {versions.map(v => <option key={v.version_id} value={v.version_id}>{VersionName(v)} {v.is_active ? '(当前)' : ''}</option>)}
              </select>
              <select value={slot.orderStatus} onChange={e => updateSlot(slot.id, { orderStatus: e.target.value })}
                className="input-ios text-[12px] py-1.5 px-2 rounded-ios w-[110px]">
                {ORDER_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select value={slot.area || ''} onChange={e => updateSlot(slot.id, { area: e.target.value || undefined, province: undefined, city: undefined })}
                className="input-ios text-[12px] py-1.5 px-2 rounded-ios w-[90px]">
                <option value="">全国</option>
                {AREA_LIST.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              {slot.area && (regions[slot.id]?.provinces || []).length > 0 && (
                <select value={slot.province || ''} onChange={e => updateSlot(slot.id, { province: e.target.value || undefined, city: undefined })}
                  className="input-ios text-[12px] py-1.5 px-2 rounded-ios w-[90px]">
                  <option value="">全省</option>
                  {(regions[slot.id]?.provinces || []).map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              )}
              {slot.province && (regions[slot.id]?.cities || []).length > 0 && (
                <select value={slot.city || ''} onChange={e => updateSlot(slot.id, { city: e.target.value || undefined })}
                  className="input-ios text-[12px] py-1.5 px-2 rounded-ios w-[90px]">
                  <option value="">全市</option>
                  {(regions[slot.id]?.cities || []).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              {slots.length > 2 && (
                <button onClick={() => removeSlot(slot.id)}
                  className="text-[11px] text-black/25 hover:text-[#FF3B30] transition-colors ml-1">
                  删除
                </button>
              )}
            </div>
          ))}

          {/* 操作行 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {slots.length < MAX_SLOTS && (
                <button onClick={addSlot} className="text-[11px] text-[#007AFF] hover:text-[#0066DD] transition-colors no-tap">
                  + 添加对比组 ({slots.length}/{MAX_SLOTS})
                </button>
              )}
            </div>
            <button onClick={runCompare} disabled={loading || validSlots.length < 2}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-ios text-[12px] bg-[#5856D6] text-white font-500 hover:bg-[#4846C0] transition-colors disabled:opacity-40 no-tap">
              {loading ? <Loader2 size={12} className="animate-spin" /> : <GitCompare size={12} />}
              {loading ? '对比中…' : '开始对比'}
            </button>
          </div>

          {error && (
            <div className="text-[12px] text-[#FF3B30] flex items-center gap-1">
              <AlertCircle size={11} />{error}
            </div>
          )}

          {/* 结果区 */}
          {entries.length >= 2 && (<>
            {/* 柱状图 */}
            <div className="glass-card-subtle p-4 rounded-ios">
              <div className="text-[12px] font-500 text-black/55 mb-3">
                分布对比 · {profileDims.find(d => d.key === dimKey)?.label ?? dimKey}
              </div>
              <div style={{ height: Math.max(200, allLabels.length * 28 + 40) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 40, top: 2, bottom: 2 }} barCategoryGap="20%" barGap={4}>
                    <XAxis type="number" domain={[0, 'auto']} tick={{ fontSize: 9, fill: 'rgba(0,0,0,0.25)' }} axisLine={false} tickLine={false} tickFormatter={v => v + '%'} />
                    <YAxis type="category" dataKey="label" width={88}
                      tick={({ x, y, payload }) => {
                        const text = payload?.value ?? '';
                        return (
                          <g transform={`translate(${x},${y})`}>
                            <title>{text}</title>
                            <text x={-4} y={0} dy={4} textAnchor="end" fill="rgba(0,0,0,0.55)" fontSize={10}>
                              {text.length > 9 ? text.slice(0, 8) + '…' : text}
                            </text>
                          </g>
                        );
                      }}
                      axisLine={false} tickLine={false} interval={0} />
                    <Tooltip content={
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      (props: any) => {
                        if (!props.active || !props.payload?.length) return null;
                        return (
                          <div className="glass-card-elevated px-2.5 py-2 text-[11px] min-w-[150px]">
                            <div className="font-600 text-black/70 mb-1">{props.label}</div>
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {props.payload.map((p: any, i: number) => (
                              <div key={i} className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2 h-2 rounded-sm" style={{ background: SLOT_COLORS[i] }} />
                                  <span className="text-black/50">{validSlots[i]?.label || 'C' + (i + 1)}</span>
                                </div>
                                <span className="font-600 tabular-nums">{Number(p.value ?? 0).toFixed(1)}%</span>
                              </div>
                            ))}
                          </div>
                        );
                      }} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                    {validSlots.map((slot, i) => (
                      <Bar key={'s' + slot.id} dataKey={'s' + slot.id} name={slot.label || 'C' + (i + 1)}
                        fill={SLOT_COLORS[i]} fillOpacity={0.75} barSize={8} radius={[0, 2, 2, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 样本概览 */}
            <div className="glass-card-subtle p-4 rounded-ios">
              <div className="text-[12px] font-500 text-black/55 mb-3">样本概览</div>
              <div className="grid grid-cols-3 gap-3">
                {validSlots.map((slot, i) => {
                  const data = slotData.get(String(slot.id)) as CompareData;
                  const statusLabel = slot.orderStatus !== 'all'
                    ? ORDER_STATUS_OPTIONS.find(o => o.value === slot.orderStatus)?.label
                    : null;
                  return (
                    <div key={slot.id} className="p-3 rounded-ios"
                      style={{ border: '1px solid ' + SLOT_COLORS[i] + '20', background: SLOT_COLORS[i] + '08' }}>
                      <div className="text-[13px] font-600 mb-1" style={{ color: SLOT_COLORS[i] }}>
                        {validSlots[i]?.label || 'C' + (i + 1)}
                      </div>
                      <div className="text-[11px] text-black/40 mb-2">
                        v{slot.versionId}
                        {statusLabel ? ' · ' + statusLabel : ''}
                        {slot.city ? ' · ' + slot.city : slot.province ? ' · ' + slot.province : slot.area ? ' · ' + slot.area : ''}
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-[11px] text-black/35">样本量</span>
                          <span className="text-[12px] font-600 tabular-nums text-black/65">
                            {data?.totalSamples?.toLocaleString() ?? '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 数据明细 */}
            <div className="glass-card-subtle rounded-ios overflow-hidden">
              <div className="text-[12px] font-500 text-black/55 px-4 pt-3 mb-2">数据明细</div>
              <div className="overflow-x-auto px-1">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-black/06">
                      <th className="text-left py-2 pl-3 text-black/35 font-500">标签</th>
                      {validSlots.map((slot, i) => (
                        <th key={slot.id} className="text-right py-2 px-2 font-600" style={{ color: SLOT_COLORS[i] }}>
                          {slot.label || 'C' + (i + 1)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allLabels.map(label => {
                      const row: Record<string, number> = {};
                      let maxVal = 0;
                      for (const [id, data] of entries) {
                        const r = (data as CompareData).rows?.find((x: { label: string }) => x.label === label);
                        row[id] = r ? Math.max(...r.statusCounts.map((s: { pct: number }) => s.pct)) : 0;
                        if (row[id] > maxVal) maxVal = row[id];
                      }
                      return (
                        <tr key={label} className="border-b border-black/03 hover:bg-black/01 transition-colors">
                          <td className="py-1.5 pl-3 text-black/60 font-500 truncate max-w-[120px]">{label}</td>
                          {validSlots.map((slot, i) => (
                            <td key={slot.id}
                              className={cn('py-1.5 px-2 text-right tabular-nums',
                                row[slot.id] === maxVal && maxVal > 0 ? 'font-600' : 'text-black/45')}
                              style={{ color: row[slot.id] === maxVal && maxVal > 0 ? SLOT_COLORS[i] : undefined }}>
                              {row[slot.id]?.toFixed(1)}%
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>)}
        </div>
      )}
    </div>
  );
}
