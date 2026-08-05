import type { Dataset, Field } from '@/types/dataSchema';

export const ALL_STATUS = '__all';

export interface DateBlock {
  key: string;
  label: string;
  start: string;
  end: string;
}

export function recordDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && value > 0) {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(String(value).trim());
  return Number.isNaN(date.getTime()) ? null : date;
}

export function recordMonth(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && value > 0) {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    if (!Number.isNaN(date.getTime())) {
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    }
  }
  const raw = String(value).trim();
  const direct = raw.match(/^(\d{4})[年./-](\d{1,2})(?:[月./-]|$)/);
  if (direct) {
    const month = Number(direct[2]);
    if (month >= 1 && month <= 12) {
      return `${direct[1]}-${String(month).padStart(2, '0')}`;
    }
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(month: string): string {
  const [year, value] = month.split('-');
  return `${year}年${Number(value)}月`;
}

export function getDefaultDateBlocks(dataset: Dataset, field?: Field): DateBlock[] {
  return getMonthOptions(dataset, field).map(month => {
    const [year, value] = month.split('-').map(Number);
    const endDay = new Date(year, value, 0).getDate();
    return {
      key: month,
      label: monthLabel(month),
      start: `${month}-01`,
      end: `${month}-${String(endDay).padStart(2, '0')}`,
    };
  });
}

export function dateBlockForValue(value: unknown, blocks: DateBlock[]): string | null {
  const date = recordDate(value);
  if (!date) return null;
  const day = date.toISOString().slice(0, 10);
  return blocks.find(block => day >= block.start && day <= block.end)?.key ?? null;
}

export function detectTimeField(dataset: Dataset): Field | undefined {
  const keyword = /提交|创建|完成|时间|日期|date|time/i;
  const candidates = dataset.fields.filter(field =>
    field.type === 'date' || keyword.test(`${field.name} ${field.key}`),
  );
  return candidates
    .map(field => {
      const values = dataset.records
        .slice(0, 300)
        .map(record => record[field.key])
        .filter(value => value !== null && value !== undefined && String(value).trim() !== '');
      const valid = values.filter(value => recordMonth(value) !== null).length;
      const ratio = values.length > 0 ? valid / values.length : 0;
      const score = ratio + (field.type === 'date' ? 1 : 0) + (keyword.test(field.name) ? 0.5 : 0);
      return { field, ratio, score };
    })
    .filter(candidate => candidate.ratio >= 0.5)
    .sort((a, b) => b.score - a.score)[0]?.field;
}

export function getMonthOptions(dataset: Dataset, field?: Field): string[] {
  if (!field) return [];
  const months = new Set<string>();
  dataset.records.forEach(record => {
    const month = recordMonth(record[field.key]);
    if (month) months.add(month);
  });
  return [...months].sort((a, b) => b.localeCompare(a));
}

export function filterByMonths(
  records: Record<string, unknown>[],
  field: Field | undefined,
  selectedMonths: string[],
): Record<string, unknown>[] {
  if (
    !field ||
    selectedMonths.length === 0 ||
    selectedMonths.includes(ALL_STATUS)
  ) return records;
  const selected = new Set(selectedMonths);
  return records.filter(record => {
    const month = recordMonth(record[field.key]);
    return month !== null && selected.has(month);
  });
}

export function filterByDateBlocks(
  records: Record<string, unknown>[],
  field: Field | undefined,
  selectedBlocks: string[],
  blocks: DateBlock[],
): Record<string, unknown>[] {
  if (!field || selectedBlocks.length === 0 || selectedBlocks.includes(ALL_STATUS)) return records;
  const validKeys = new Set(blocks.map(block => block.key));
  const selected = new Set(selectedBlocks.filter(key => validKeys.has(key)));
  if (selected.size === 0) return records;
  return records.filter(record => {
    const block = dateBlockForValue(record[field.key], blocks);
    return block !== null && selected.has(block);
  });
}
