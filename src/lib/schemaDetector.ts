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

const DATE_RE = /^\d{4}[-/\.]\d{1,2}[-/\.]\d{1,2}$/;
const NUMBER_RE = /^-?\d+(\.\d+)?$/;

export function detectFieldType(values: unknown[]): FieldType {
  const nonEmpty = values
    .map(v => (v == null ? '' : String(v).trim()))
    .filter(v => v !== '');

  if (nonEmpty.length === 0) return 'text';

  const total = nonEmpty.length;

  // 布尔
  const boolSet = new Set(['是', '否', 'true', 'false', 'y', 'n', '1', '0', '有', '无']);
  const uniqueSet = new Set(nonEmpty.map(v => v.toLowerCase()));
  if (uniqueSet.size <= 2 && [...uniqueSet].every(v => boolSet.has(v))) {
    return 'boolean';
  }

  // 日期：≥70% 的值匹配日期格式
  const dateCount = nonEmpty.filter(v => DATE_RE.test(v)).length;
  if (dateCount / total >= 0.7) return 'date';

  // 数值：≥80% 的值匹配数字
  const numCount = nonEmpty.filter(v => NUMBER_RE.test(v)).length;
  if (numCount / total >= 0.8) return 'number';

  // 排序题：≥15% 的值包含 → 且每部分长度合理（排除 URL、箭头符号滥用）
  const rankCount = nonEmpty.filter(v => {
    if (!v.includes('→')) return false;
    const parts = v.split('→').map(p => p.trim()).filter(Boolean);
    return parts.length >= 2 && parts.every(p => p.length >= 1 && p.length <= 30);
  }).length;
  if (rankCount / total >= 0.15) return 'ranking';

  // 多选：出现 ┋ 分隔符 → 确定是多选（无需达到阈值）
  if (nonEmpty.some(v => v.includes('┋'))) return 'multi_choice';

  // 多选：≥20% 的值包含常见分隔符（顿号、逗号等）
  const COMMON_MULTI_RE = /[、，,;；|\/]/;
  const multiCount = nonEmpty.filter(v => {
    if (!COMMON_MULTI_RE.test(v)) return false;
    const parts = v.split(COMMON_MULTI_RE);
    return parts.length >= 2 && parts.every(p => p.trim().length <= 40);
  }).length;
  if (multiCount / total >= 0.2) return 'multi_choice';

  // 单选：唯一值数量 ≤ min(30, total * 0.3)
  const uniqueCount = new Set(nonEmpty).size;
  const threshold = Math.min(30, Math.ceil(total * 0.3));
  if (uniqueCount <= threshold) return 'single_choice';

  return 'text';
}

function computeStatistics(values: unknown[]): Field['statistics'] {
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

    let options: string[] | undefined;
    let multiDelimiter: string | undefined;

    if (type === 'single_choice') {
      const opts = [...new Set(
        values.map(v => (v == null ? '' : String(v).trim())).filter(Boolean)
      )];
      options = opts.sort();
    } else if (type === 'ranking') {
      // Extract unique options across all ranked sequences
      const opts = new Set<string>();
      for (const v of values) {
        if (v == null) continue;
        const raw = String(v).trim();
        if (!raw) continue;
        raw.split('→').map(p => p.trim()).filter(Boolean).forEach(p => opts.add(p));
      }
      options = [...opts];
      multiDelimiter = '→';
    } else if (type === 'multi_choice') {
      // Detect which delimiter this column actually uses
      const DELIM_CANDIDATES = ['┋', '、', '，', ',', ';', '；', '|', '/'];
      for (const d of DELIM_CANDIDATES) {
        if (values.some(v => v != null && String(v).includes(d))) {
          multiDelimiter = d;
          break;
        }
      }
      const delim = multiDelimiter ?? '┋';

      const opts = new Set<string>();
      for (const v of values) {
        if (v == null) continue;
        const raw = String(v).trim();
        if (!raw) continue;
        const parts = raw.includes(delim)
          ? raw.split(delim).map(p => p.trim()).filter(Boolean)
          : [raw];
        parts.forEach(p => opts.add(p.startsWith('其他') ? '其他' : p));
      }
      options = [...opts].sort();
    }

    return {
      key,
      name: key,
      type,
      options,
      statistics: stats,
      recommendedCharts: recommendCharts(type),
      ...(multiDelimiter !== undefined && { multiDelimiter }),
    } satisfies Field;
  });
}

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

export function refreshDatasetStats(dataset: Dataset): Dataset {
  const fields = dataset.fields.map(f => ({
    ...f,
    statistics: computeStatistics(dataset.records.map(r => r[f.key])),
  }));
  return { ...dataset, fields };
}
