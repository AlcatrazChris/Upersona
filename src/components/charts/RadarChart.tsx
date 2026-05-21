'use client';

import { useState } from 'react';
import {
  RadarChart as RechartsRadar,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Info, X } from 'lucide-react';
import { RADAR_RULE_TEXT } from '@/types';
import type { RadarDimension } from '@/types';

interface Props {
  dimensions: RadarDimension[];
  regionName: string;
  sampleCount: number;
}

function CustomTooltip({ active, payload }: {
  active?: boolean;
  payload?: { name: string; value: number; payload: { label: string } }[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card-elevated px-3 py-2.5 text-[12px] min-w-[150px]">
      <div className="font-600 text-black/75 mb-1.5">{payload[0]?.payload?.label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full"
              style={{ background: p.name === 'region' ? '#007AFF' : 'rgba(0,0,0,0.25)' }} />
            <span className="text-black/55">{p.name === 'region' ? '当前地区' : '全国均值'}</span>
          </div>
          <span className="font-500 text-black/70 tabular-nums">{p.value.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}

export function RadarChart({ dimensions, regionName, sampleCount }: Props) {
  const [showRules, setShowRules] = useState(false);

  const chartData = dimensions.map(d => ({
    label:    d.label,
    region:   parseFloat(d.score.toFixed(1)),
    national: parseFloat(d.nationalScore.toFixed(1)),
  }));

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-[14px] font-600 text-black/75">{regionName}</span>
          <span className="text-[12px] text-black/35 ml-2">n={sampleCount}</span>
        </div>
        <button
          onClick={() => setShowRules(true)}
          className="flex items-center gap-1 text-[12px] text-black/40 hover:text-[#007AFF] transition-colors glass-card-subtle px-2.5 py-1 rounded-ios"
        >
          <Info size={12} />查看规则
        </button>
      </div>

      <div className="flex items-center gap-5 mb-2 justify-center">
        <div className="flex items-center gap-1.5">
          <div className="w-6 border-t-2 border-dashed border-black/25" />
          <span className="text-[11px] text-black/40">全国均值</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-6 border-t-2 border-[#007AFF]" />
          <span className="text-[11px] text-black/60">{regionName}</span>
        </div>
      </div>

      <div style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RechartsRadar
            data={chartData}
            cx="50%"
            cy="50%"
            outerRadius="72%"
            margin={{ top: 10, right: 30, bottom: 10, left: 30 }}
          >
            <PolarGrid stroke="rgba(0,0,0,0.10)" />
            <PolarAngleAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: 'rgba(0,0,0,0.60)', fontWeight: 500 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fontSize: 9, fill: 'rgba(0,0,0,0.30)' }}
              tickCount={6}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Radar
              name="national"
              dataKey="national"
              stroke="rgba(0,0,0,0.28)"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              fill="rgba(0,0,0,0.05)"
              isAnimationActive={false}
            />
            <Radar
              name="region"
              dataKey="region"
              stroke="#007AFF"
              strokeWidth={2}
              fill="rgba(0,122,255,0.14)"
              dot={{ r: 4, fill: '#007AFF', strokeWidth: 0 }}
              isAnimationActive={true}
            />
          </RechartsRadar>
        </ResponsiveContainer>
      </div>

      {showRules && (
        <div
          className="fixed inset-0 z-[99998] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.35)' }}
          onClick={() => setShowRules(false)}
        >
          <div
            className="glass-card-elevated p-6 max-w-md w-full mx-4 animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-[15px] font-600 text-black/80">五维评分规则</span>
              <button onClick={() => setShowRules(false)} className="text-black/35 hover:text-black/60 transition-colors">
                <X size={16} />
              </button>
            </div>
            <pre
              className="text-[12px] text-black/60 leading-relaxed whitespace-pre-wrap font-sans overflow-y-auto"
              style={{ maxHeight: 400 }}
            >
              {RADAR_RULE_TEXT}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
