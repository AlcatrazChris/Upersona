/**
 * 字段类型自动识别引擎
 *
 * 从一列数据推断最合适的 FieldType：
 *   - 大量逗号分隔 → multi_choice
 *   - 全为数字      → number
 *   - 全为日期格式  → date
 *   - 唯一值少      → single_choice
 *   - 否则           → text
 */

import type { Field, FieldType, Dataset } from '@/types/dataSchema';
import { recommendCharts } from '@/types/dataSchema';

// ── 正则 ──────────────────────────────────────────────────────
const DATE_RE = /^\d{4}[-/\.]\d{1,2}[-/\.]\d{1,2}$/;
const NUMBER_RE = /^-?\d+(\.\d+)?$/;

// ── 单字段类型推断 ────────────────────────────────────────────

/**
 * 从一列原始值推断字段类型。
 * @param values 该列所有行的值（含 null / undefined / 空字符串）
 */
export function detectFieldType(values: unknown[]): FieldType {
  const nonEmpty = values
    .map(v => (v == null ? '' : String(v).trim()))
    .filter(v => v !== '');

  if (nonEmpty.length === 0) return 'text';

  const total = nonEmpty.length;

  // 布尔判断（是/否、true/false、y/n）
  const boolSet = new Set(['是', '否', 'true', 'false', 'y', 'n', '1', '0', '有', '无']);
  const uniqueSet = new Set(nonEmpty.map(v => v.toLowerCase()));
  if (uniqueSet.size <= 2 && [...uniqueSet].every(v => boolSet.has(v))) {
    return 'boolean';
  }

  // 日期判断：≥70% 的值匹配日期格式
  const dateCount = nonEmpty.filter(v => DATE_RE.test(v)).length;
  if (dateCount / total >= 0.7) return 'date';

  // 数值判断：≥80% 的值匹配数字
  const numCount = nonEmpty.filter(v => NUMBER_RE.test(v)).length;
  if (numCount / total >= 0.8) return 'number';

  // 多选判断：≥20% 的值包含逗号且逗号分隔后的每段都不超长
  const commaCount = nonEmpty.filter(v => {
    if (!v.includes(',') && !v.includes('，')) return false;
    const parts = v.split(/[,，]/);
    return parts.length >= 2 && parts.every(p => p.trim().length <= 30);
  }).length;
  if (commaCount / total >= 0.2) return 'multi_choice';

  // 单选判断：唯一值数量 ≤ min(30, total * 0.3)
  const uniqueCount = new Set(nonEmpty).size;
  const threshold = Math.min(30, Math.ceil(total * 0.3));
  if (uniqueCount <= threshold) return 'single_choice';

  return 'text';
}

// ── 字段统计 ──────────────────────────────────────────────────

function computeStatistics(
  values: unknown[]
): Field['statistics'] {
  const total = values.length;
  const nonEmpty = values.filter(v => v != null && String(v).trim() !== '');
  const missing = total - nonEmpty.length;

  const counter: Record<string, number> = {};
  for (const v of nonEmpty) {
    const s = String(v).trim();
    counter[s] = (counter[s] || 0) + 1;
  }
  const unique = Object.keys(counter).length;

  const topValues = Object.entries(counter)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([value, count]) => ({ value, count }));

  return { count: total, unique, missing, topValues };
}

// ── 全表 Schema 推断 ─────────────────────────────────────────

/**
 * 从记录数组推断完整 Schema（所有字段）。
 * @param records  数据行数组
 * @param headers  列名顺序（若未提供则从第一行 key 推断）
 */
export function detectSchema(
  records: Record<string, unknown>[],
  headers?: string[]
): Field[] {
  if (records.length === 0) return [];

  const keys = headers ?? Object.keys(records[0]);

  return keys.map(key => {
    const values = records.map(r => r[key]);
    const type = detectFieldType(values);
    const stats = computeStatistics(values);

    // 取值集合（单选/多选 展开逗号分隔）
    let options: string[] | undefined;
    if (type === 'single_choice') {
      const opts = [...new Set(
        values
          .map(v => (v == null ? '' : String(v).trim()))
          .filter(Boolean)
      )];
      options = opts.sort();
    } else if (type === 'multi_choice') {
      const opts = new Set<string>();
      for (const v of values) {
        if (v == null) continue;
        const parts = String(v).split(/[,，]/).map(p => p.trim()).filter(Boolean);
        parts.forEach(p => opts.add(p));
      }
      options = [...opts].sort();
    }

    return {
      key,
      name: key,          // 默认 name = key（用户可编辑）
      type,
      options,
      statistics: stats,
      recommendedCharts: recommendCharts(type),
    } satisfies Field;
  });
}

// ── 版本比较 ──────────────────────────────────────────────────

/**
 * 比较两个 Schema 版本，返回字段变化报告。
 */
export function compareSchemas(
  oldFields: Field[],
  newFields: Field[]
): import('@/types/dataSchema').FieldDiff {
  const oldMap = new Map(oldFields.map(f => [f.key, f]));
  const newMap = new Map(newFields.map(f => [f.key, f]));

  const added   = newFields.filter(f => !oldMap.has(f.key)).map(f => f.key);
  const removed = oldFields.filter(f => !newMap.has(f.key)).map(f => f.key);
  const changed = newFields
    .filter(f => oldMap.has(f.key) && oldMap.get(f.key)!.type !== f.type)
    .map(f => ({ field: f.key, from: oldMap.get(f.key)!.type, to: f.type }));

  return { added, removed, changed, renamed: [] };
}

// ── 从 Dataset 快速获取字段统计 ──────────────────────────────

/** 重新计算 Dataset 中所有字段的统计信息（用于增量更新） */
export function refreshDatasetStats(dataset: Dataset): Dataset {
  const fields = dataset.fields.map(f => ({
    ...f,
    statistics: computeStatistics(dataset.records.map(r => r[f.key])),
  }));
  return { ...dataset, fields };
}
