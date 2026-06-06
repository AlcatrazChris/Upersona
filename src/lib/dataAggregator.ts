/**
 * dataAggregator
 *
 * 将 Dataset.records（原始行数组）按指定 Field 聚合为 ChartDataItem[]，
 * 直接喂给 ChartRenderer / ChartCard 渲染。
 *
 * 支持：
 *  - single_choice / boolean → 分类频率统计
 *  - multi_choice            → 分隔符拆分后分类统计
 *  - number                  → 低基数归类 / 高基数自动分箱（10 箱）
 *  - date                    → 按年 / 月 / 日分组折线
 *  - text                    → 高频词前 15（粗略预览）
 */

import type { Field } from '@/types/dataSchema';
import type { ChartDataItem } from '@/components/charts/engine/types';

// ── 内部工具 ──────────────────────────────────────────────────

/** 任意值 → 去首尾空格字符串 */
function toStr(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

/** 布尔类型标准化 */
function normalizeBool(v: unknown): string {
  const s = toStr(v).toLowerCase();
  if (['true', '1', '是', 'yes', 'y', '对', 'checked', 'true'].includes(s)) return '是';
  if (['false', '0', '否', 'no', 'n', '错', 'unchecked', 'false'].includes(s)) return '否';
  return s || '';
}

/** 格式化数值（尽量整数，避免 .0） */
function fmtNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

/** 构建 count map（key → count） */
function countMap(keys: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const k of keys) {
    if (!k) continue;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}

/** count map → ChartDataItem[]，支持按指定顺序排列 */
function toItems(
  map: Map<string, number>,
  total: number,
  orderedValues?: string[],
  sortDesc = true,
): ChartDataItem[] {
  const entries = [...map.entries()];

  if (orderedValues && orderedValues.length > 0) {
    entries.sort((a, b) => {
      const ai = orderedValues.indexOf(a[0]);
      const bi = orderedValues.indexOf(b[0]);
      if (ai === -1 && bi === -1) return sortDesc ? b[1] - a[1] : a[0].localeCompare(b[0]);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  } else if (sortDesc) {
    entries.sort((a, b) => b[1] - a[1]);
  }

  return entries.map(([label, count]) => ({
    label,
    count,
    percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
  }));
}

// ── 各类型聚合 ────────────────────────────────────────────────

/** single_choice / boolean */
function aggregateCategorical(
  records: Record<string, unknown>[],
  field: Field,
): ChartDataItem[] {
  const isBool = field.type === 'boolean';
  const keys = records
    .map(r => (isBool ? normalizeBool(r[field.key]) : toStr(r[field.key])))
    .filter(Boolean);

  const map = countMap(keys);
  return toItems(map, keys.length, field.orderedValues);
}

/** multi_choice：自动识别分隔符并拆分 */
function aggregateMultiChoice(
  records: Record<string, unknown>[],
  field: Field,
): ChartDataItem[] {
  const DELIMITERS = ['、', '，', ',', ';', '；', '|', '/'];

  const allParts: string[] = [];
  let validRows = 0;

  for (const r of records) {
    const raw = toStr(r[field.key]);
    if (!raw) continue;
    validRows++;

    let parts: string[] = [raw];
    for (const d of DELIMITERS) {
      if (raw.includes(d)) {
        parts = raw.split(d).map(s => s.trim()).filter(Boolean);
        break;
      }
    }
    allParts.push(...parts);
  }

  const map = countMap(allParts);
  // 多选：百分比以有效答题人数为分母（每选项独立）
  return toItems(map, validRows, field.orderedValues);
}

/** number：低基数归类 / 高基数分箱 */
function aggregateNumeric(
  records: Record<string, unknown>[],
  field: Field,
): ChartDataItem[] {
  const values: number[] = [];
  for (const r of records) {
    const n = parseFloat(toStr(r[field.key]));
    if (!isNaN(n)) values.push(n);
  }
  if (values.length === 0) return [];

  const uniqueSet = new Set(values);

  // 低基数（≤ 20 唯一值）→ 当分类处理，按数值升序
  if (uniqueSet.size <= 20) {
    const map = countMap(values.map(String));
    const entries = [...map.entries()].sort((a, b) => Number(a[0]) - Number(b[0]));
    const total = values.length;
    return entries.map(([label, count]) => ({
      label,
      count,
      percentage: Math.round((count / total) * 1000) / 10,
    }));
  }

  // 高基数 → Sturges 分箱（最多 12 箱）
  const min = Math.min(...values);
  const max = Math.max(...values);
  const BIN_COUNT = Math.min(12, Math.ceil(Math.log2(values.length) + 1));
  const binSize = (max - min) / BIN_COUNT;

  interface Bin { label: string; count: number }
  const bins: Bin[] = Array.from({ length: BIN_COUNT }, (_, i) => {
    const lo = min + i * binSize;
    const hi = i === BIN_COUNT - 1 ? max : lo + binSize;
    return { label: `${fmtNum(lo)}–${fmtNum(hi)}`, count: 0 };
  });

  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / binSize), BIN_COUNT - 1);
    bins[idx].count++;
  }

  const total = values.length;
  return bins
    .filter(b => b.count > 0)
    .map(b => ({
      label: b.label,
      count: b.count,
      percentage: Math.round((b.count / total) * 1000) / 10,
    }));
}

/** date：按年/月/日分组，按时间升序 */
function aggregateDate(
  records: Record<string, unknown>[],
  field: Field,
  granularity: 'year' | 'month' | 'day' = 'month',
): ChartDataItem[] {
  const map = new Map<string, number>();

  for (const r of records) {
    const raw = toStr(r[field.key]);
    if (!raw) continue;
    const d = new Date(raw);
    if (isNaN(d.getTime())) continue;

    const key =
      granularity === 'year'  ? String(d.getFullYear()) :
      granularity === 'month' ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` :
                                d.toISOString().slice(0, 10);
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  const entries = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const total = entries.reduce((s, [, c]) => s + c, 0);
  return entries.map(([label, count]) => ({
    label,
    count,
    percentage: Math.round((count / total) * 1000) / 10,
  }));
}

// ── 主入口 ────────────────────────────────────────────────────

/**
 * 将 records 按照 field 的类型聚合为 ChartDataItem[]。
 *
 * @param records   Dataset.records（原始行）
 * @param field     目标 Field（含 type / orderedValues 等元数据）
 * @param dateGran  日期字段粒度（默认 month）
 */
export function aggregateField(
  records: Record<string, unknown>[],
  field: Field,
  dateGran: 'year' | 'month' | 'day' = 'month',
): ChartDataItem[] {
  if (records.length === 0) return [];

  switch (field.type) {
    case 'single_choice':
    case 'boolean':
      return aggregateCategorical(records, field);
    case 'multi_choice':
      return aggregateMultiChoice(records, field);
    case 'number':
      return aggregateNumeric(records, field);
    case 'date':
      return aggregateDate(records, field, dateGran);
    case 'text':
      // 文本：仅显示出现频率最高的前 15 个值（粗略预览）
      return aggregateCategorical(records, field).slice(0, 15);
    default:
      return [];
  }
}

/**
 * 根据 field.type 推导适合图表构建器的 dateGran。
 * 数据若跨多年用 month，若只有一年用 day，否则 year。
 */
export function inferDateGran(
  records: Record<string, unknown>[],
  fieldKey: string,
): 'year' | 'month' | 'day' {
  const years = new Set<number>();
  const months = new Set<string>();

  for (const r of records) {
    const d = new Date(toStr(r[fieldKey]));
    if (isNaN(d.getTime())) continue;
    years.add(d.getFullYear());
    months.add(`${d.getFullYear()}-${d.getMonth()}`);
  }

  if (years.size > 3) return 'year';
  if (months.size <= 2) return 'day';
  return 'month';
}
