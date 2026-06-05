/**
 * 动态维度配置加载器
 *
 * 优先从 DB 的 dimensions_config 表读取，表不存在或为空时
 * 降级到代码中的 PROFILE_DIMENSIONS 硬编码常量。
 *
 * 60 秒进程内缓存，避免每次 API 请求都查 DB。
 */

import type { DimensionConfig } from '@/types';
import { PROFILE_DIMENSIONS } from '@/types';

// ── 进程内缓存 ──────────────────────────────────────────────────
let _cache: { dims: DimensionConfig[]; ts: number } | null = null;
const CACHE_TTL = 60_000; // 60 秒

/** 清除维度缓存（admin 修改后调用） */
export function clearDimensionCache() {
  _cache = null;
}

// ── DB 行 → DimensionConfig 映射 ────────────────────────────────
interface DimRow {
  dim_key: string;
  label: string;
  is_ordered: boolean;
  is_multi_select: boolean;
  ordered_values: string[] | null;
  note: string | null;
  field_type: string;
  enabled_profile: boolean;
  enabled_insight: boolean;
  sort_order: number;
  chart_type: string;
  group_name: string;
}

function rowToConfig(row: DimRow): DimensionConfig {
  return {
    key:             row.dim_key,
    label:           row.label,
    isOrdered:       row.is_ordered,
    isMultiSelect:   row.is_multi_select,
    orderedValues:   row.ordered_values ?? undefined,
    note:            row.note ?? undefined,
    // 扩展字段
    fieldType:       row.field_type,
    enabledProfile:  row.enabled_profile,
    enabledInsight:  row.enabled_insight,
    sortOrder:       row.sort_order,
    chartType:       row.chart_type  || 'bar',
    groupName:       row.group_name  || '',
  };
}

// ── 公开 API ──────────────────────────────────────────────────

/** 获取全量维度配置（含缓存 + 降级） */
export async function getDimensions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any
): Promise<DimensionConfig[]> {
  const now = Date.now();
  if (_cache && now - _cache.ts < CACHE_TTL) return _cache.dims;

  try {
    const { data, error } = await db
      .from('dimensions_config')
      .select('*')
      .order('sort_order');
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('empty');
    const dims = (data as DimRow[]).map(rowToConfig);
    _cache = { dims, ts: now };
    return dims;
  } catch {
    // 表不存在或为空 → 降级到硬编码
    return PROFILE_DIMENSIONS;
  }
}

/** 获取用于画像/状态对比/概览的维度（enabled_profile=true） */
export async function getProfileDimensions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any
): Promise<DimensionConfig[]> {
  const all = await getDimensions(db);
  return all.filter(d => d.enabledProfile !== false);
}

/** 获取参与 AI 洞察分析的维度（enabled_insight=true） */
export async function getInsightDimensions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any
): Promise<DimensionConfig[]> {
  const all = await getDimensions(db);
  return all.filter(d => d.enabledInsight !== false);
}

/**
 * 从维度列表构建 SQL SELECT 列名字符串。
 * 自动包含 order_status（几乎所有查询都需要），可选追加额外列。
 */
export function getDimensionColumns(
  dims: DimensionConfig[],
  extra: string[] = ['order_status']
): string {
  const keys = dims.map(d => typeof d.key === 'string' ? d.key : String(d.key));
  const all  = [...new Set([...keys, ...extra])];
  return all.join(', ');
}
