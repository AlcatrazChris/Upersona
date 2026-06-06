/**
 * 图表引擎统一接口
 *
 * 所有引擎（Bar / Pie / Line）接受相同的 data + config，
 * 上层只需切换 <ChartRenderer type="bar|pie|line" /> 即可。
 */

import type { ChartConfig } from '@/lib/chartConfig';

// ── 统一数据行 ────────────────────────────────────────────────
export interface ChartDataItem {
  label:      string;
  count:      number;       // 原始样本数
  percentage: number;       // 百分比（0–100）
  /** 可选：额外分组字段（用于堆叠/分组图） */
  group?:     string;
}

// ── 所有引擎共用 Props ────────────────────────────────────────
export interface ChartEngineProps {
  data:          ChartDataItem[];
  config:        ChartConfig;
  /** 是否多选题（影响样本说明文案） */
  isMultiSelect?: boolean;
  /** 有效样本总数（用于 tooltip 及底部说明） */
  totalSamples?:  number;
  /** 覆盖自动计算高度（px） */
  height?:        number;
  /** 图表 className */
  className?:     string;
}

// ── 导出图表类型联合 ─────────────────────────────────────────
export type ChartType = 'bar' | 'pie' | 'donut' | 'line' | 'area';
