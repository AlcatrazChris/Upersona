import type { Dataset, Field } from '@/types/dataSchema';

export const ALL_STATUS = '__all';

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
