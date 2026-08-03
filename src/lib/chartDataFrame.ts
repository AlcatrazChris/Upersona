import type { Dataset } from '@/types/dataSchema';
import type { ChartSchema } from '@/types/chartSchema';
import { aggregateField, aggregateFieldGrouped, aggregateRanking } from '@/lib/dataAggregator';

export interface ChartColumn {
  key: string;
  label: string;
  role: 'dimension' | 'measure' | 'series';
  dataType: 'string' | 'number';
}

export interface ChartDataFrame {
  columns: ChartColumn[];
  rows: Array<Record<string, string | number>>;
  meta: {
    sourceRowCount: number;
    validRowCount: number;
    filteredRowCount: number;
    isMultiSelect: boolean;
    seriesKeys: string[];
    groupTotals?: Record<string, number>;
    rawCounts?: Record<string, Record<string, number>>;
    numericValues?: number[];
  };
}

function applyFilters(records: Dataset['records'], schema: ChartSchema): Dataset['records'] {
  return (schema.data.filters ?? []).reduce((current, filter) => current.filter(record => {
    const value = String(record[filter.fieldKey] ?? '');
    const values = filter.values ?? [];
    if (filter.operator === 'exists') return value.trim().length > 0;
    if (filter.operator === 'eq') return value === values[0];
    if (filter.operator === 'neq') return value !== values[0];
    if (filter.operator === 'in') return values.includes(value);
    return !values.includes(value);
  }), records);
}

export function buildChartDataFrame(dataset: Dataset, schema: ChartSchema): ChartDataFrame {
  const field = dataset.fields.find(item => item.key === schema.data.fieldKey);
  if (!field) throw new Error(`字段不存在：${schema.data.fieldKey}`);

  const records = applyFilters(dataset.records, schema);
  const isGrouped = schema.chart.type === 'grouped-bar' || schema.chart.type === 'stacked-bar';
  const baseMeta = {
    sourceRowCount: dataset.records.length,
    filteredRowCount: records.length,
    isMultiSelect: field.type === 'multi_choice',
  };

  if (field.type === 'ranking') {
    const ranking = aggregateRanking(records, field);
    return {
      columns: [
        { key: 'option', label: field.name, role: 'dimension', dataType: 'string' },
        { key: 'meanRank', label: '平均排名', role: 'measure', dataType: 'number' },
      ],
      rows: ranking.rows.map(row => ({ option: row.option, meanRank: row.meanRank })),
      meta: { ...baseMeta, validRowCount: ranking.N, seriesKeys: [] },
    };
  }

  if (isGrouped) {
    const groupField = dataset.fields.find(item => item.key === schema.data.groupFieldKey);
    if (!groupField) throw new Error('对比图缺少有效的分组字段');
    const grouped = aggregateFieldGrouped(records, field, groupField, schema.data.selectedGroups ?? []);
    const rows = schema.chart.type === 'stacked-bar' ? grouped.stackItems : grouped.items;
    const seriesKeys = schema.chart.type === 'stacked-bar' ? grouped.stackSeriesKeys : grouped.seriesKeys;
    return {
      columns: [
        { key: 'label', label: field.name, role: 'dimension', dataType: 'string' },
        ...seriesKeys.map(key => ({ key, label: key, role: 'series' as const, dataType: 'number' as const })),
      ],
      rows,
      meta: {
        ...baseMeta,
        validRowCount: Object.values(grouped.groupTotals).reduce((sum, value) => sum + value, 0),
        seriesKeys,
        groupTotals: grouped.groupTotals,
        rawCounts: grouped.rawCounts,
      },
    };
  }

  let rows = aggregateField(records, field, schema.data.dateGranularity ?? 'month');
  // Field overview ordering is the global source of truth and cannot be overridden by chart settings.
  if (!field.isOrdered || !field.orderedValues?.length) {
    if (schema.data.sort === 'value-asc') rows = [...rows].sort((a, b) => a.count - b.count);
    if (schema.data.sort === 'value-desc') rows = [...rows].sort((a, b) => b.count - a.count);
  }
  if (schema.data.limit) rows = rows.slice(0, schema.data.limit);
  const frameRows = rows.map(({ label, count, percentage, group }) => ({
    label,
    count,
    percentage,
    ...(group ? { group } : {}),
  }));
  return {
    columns: [
      { key: 'label', label: field.name, role: 'dimension', dataType: 'string' },
      { key: 'count', label: '数量', role: 'measure', dataType: 'number' },
      { key: 'percentage', label: '占比', role: 'measure', dataType: 'number' },
    ],
    rows: frameRows,
    meta: {
      ...baseMeta,
      validRowCount: records.filter(record => String(record[field.key] ?? '').trim()).length,
      seriesKeys: [],
      numericValues: field.type === 'number'
        ? records.flatMap(record => {
            const raw = String(record[field.key] ?? '').trim();
            const value = Number(raw);
            return raw && Number.isFinite(value) ? [value] : [];
          })
        : undefined,
    },
  };
}
