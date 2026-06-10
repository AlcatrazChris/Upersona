'use client';

/**
 * RankingHeatmapEngine
 *
 * 排序题专用可视化，包含三层：
 * 1. 摘要统计卡（N / 平均排名深度 / 最受青睐项）
 * 2. 热力矩阵（行=选项，列=位次，单元格颜色深浅=频率）
 * 3. 平均排名横向条形图（按 meanRank 升序）
 */

import type { RankingData } from '@/lib/dataAggregator';

interface Props {
  data:      RankingData;
  fieldName: string;
  height?:   number;
}

// 0-100 → CSS rgba blue-purple gradient
function heatColor(pct: number): { bg: string; text: string } {
  if (pct <= 0) return { bg: 'transparent', text: 'transparent' };
  // map pct [0-100] → opacity [0.06-0.92]
  const opacity = 0.06 + (pct / 100) * 0.86;
  // shift hue: low pct → blue-200, high pct → violet-700
  const r = Math.round(79  + (pct / 100) * (109 - 79));
  const g = Math.round(130 + (pct / 100) * (40  - 130));
  const b = Math.round(246 + (pct / 100) * (217 - 246));
  return {
    bg:   `rgba(${r},${g},${b},${opacity.toFixed(2)})`,
    text: pct >= 20 ? '#fff' : pct >= 8 ? '#4338ca' : '#94a3b8',
  };
}

export function RankingHeatmapEngine({ data, fieldName }: Props) {
  if (!data || data.N === 0) {
    return (
      <div className="text-center text-xs text-gray-300 py-8">暂无有效排序数据</div>
    );
  }

  const { maxRank, rows } = data;
  const posLabels = Array.from({ length: maxRank }, (_, i) => `#${i + 1}`);

  return (
    <div className="overflow-x-auto select-none text-[12px]">
      <table className="w-full border-separate border-spacing-[3px]">
        <thead>
          <tr>
            <th className="text-left px-2 py-1 text-[10.5px] font-semibold text-gray-400 uppercase tracking-wide min-w-[120px]">
              {fieldName}
            </th>
            {posLabels.map(pos => (
              <th key={pos}
                  className="text-center px-1 py-1 text-[10.5px] font-semibold text-gray-400 uppercase tracking-wide min-w-[52px]">
                {pos}
              </th>
            ))}
            <th className="text-right px-2 py-1 text-[10.5px] font-semibold text-gray-400 uppercase tracking-wide min-w-[52px]">
              均名
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={row.option}>
              <td className="px-2 py-1.5 font-medium text-gray-700 leading-tight max-w-[140px]">
                <div className="truncate" title={row.option}>{row.option}</div>
              </td>

              {row.positions.map((pct, pi) => {
                const { bg, text } = heatColor(pct);
                return (
                  <td key={pi}
                      className="rounded-lg text-center tabular-nums leading-tight"
                      style={{ background: bg }}>
                    <div className="px-1 py-2" style={{ color: text }}>
                      {pct > 0
                        ? <><span className="font-semibold">{pct.toFixed(0)}</span><span className="text-[9px]">%</span></>
                        : <span className="text-gray-200">·</span>
                      }
                    </div>
                  </td>
                );
              })}

              <td className="px-2 py-1.5 text-right tabular-nums">
                <span className={
                  ri === 0
                    ? 'font-bold text-indigo-700'
                    : ri === rows.length - 1
                      ? 'text-gray-400'
                      : 'text-gray-600'
                }>
                  {row.meanRank.toFixed(1)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
