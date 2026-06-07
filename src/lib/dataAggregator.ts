/**
 * dataAggregator
 *
 * 将 Dataset.records 按指定 Field 聚合为 ChartDataItem[]。
 */

import type { Field } from '@/types/dataSchema';
import type { ChartDataItem } from '@/components/charts/engine/types';

function toStr(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function normalizeBool(v: unknown): string {
  const s = toStr(v).toLowerCase();
  if (['true', '1', '是', 'yes', 'y', '对', 'checked'].includes(s)) return '是';
  if (['false', '0', '否', 'no', 'n', '错', 'unchecked'].includes(s)) return '否';
  return s || '';
}

function fmtNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

function countMap(keys: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const k of keys) {
    if (!k) continue;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}

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

function aggregateCategorical(records: Record<string, unknown>[], field: Field): ChartDataItem[] {
  const isBool = field.type === 'boolean';
  const keys = records
    .map(r => (isBool ? normalizeBool(r[field.key]) : toStr(r[field.key])))
    .filter(Boolean);
  return toItems(countMap(keys), keys.length, field.orderedValues);
}

// Normalize one split part: any value starting with "其他" collapses to "其他"
function normalizeMultiPart(s: string): string {
  const t = s.trim();
  if (t.startsWith('其他')) return '其他';
  return t;
}

// Split a raw cell value using exactly one delimiter.
// If the delimiter is absent the whole value is treated as a single choice.
function splitMultiChoice(raw: string, delimiter: string = '┋'): string[] {
  if (!raw.includes(delimiter)) return [normalizeMultiPart(raw)].filter(Boolean);
  return raw.split(delimiter).map(normalizeMultiPart).filter(Boolean);
}

function aggregateMultiChoice(records: Record<string, unknown>[], field: Field): ChartDataItem[] {
  const delimiter = field.multiDelimiter ?? '┋';
  const allParts: string[] = [];
  let validRows = 0;

  for (const r of records) {
    const raw = toStr(r[field.key]);
    if (!raw) continue;
    validRows++;
    allParts.push(...splitMultiChoice(raw, delimiter));
  }

  return toItems(countMap(allParts), validRows, field.orderedValues);
}

function aggregateNumeric(records: Record<string, unknown>[], field: Field): ChartDataItem[] {
  const values: number[] = [];
  for (const r of records) {
    const n = parseFloat(toStr(r[field.key]));
    if (!isNaN(n)) values.push(n);
  }
  if (values.length === 0) return [];

  const uniqueSet = new Set(values);

  if (uniqueSet.size <= 20) {
    const map = countMap(values.map(String));
    const entries = [...map.entries()].sort((a, b) => Number(a[0]) - Number(b[0]));
    const total = values.length;
    return entries.map(([label, count]) => ({
      label, count,
      percentage: Math.round((count / total) * 1000) / 10,
    }));
  }

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
  return bins.filter(b => b.count > 0).map(b => ({
    label: b.label, count: b.count,
    percentage: Math.round((b.count / total) * 1000) / 10,
  }));
}

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
    label, count,
    percentage: Math.round((count / total) * 1000) / 10,
  }));
}

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
      return aggregateCategorical(records, field).slice(0, 15);
    default:
      return [];
  }
}

// ── Grouped aggregation (for comparison charts) ──────────────

export interface GroupedChartData {
  /** Clustered horizontal: each row = one dimension value; keys = selectedGroups */
  items: Record<string, number | string>[];
  seriesKeys: string[];  // = selectedGroups
  /** Stacked vertical: each row = one group; keys = dimension values */
  stackItems: Record<string, number | string>[];
  stackSeriesKeys: string[];  // = dimension values in natural order
  groupTotals: Record<string, number>;
  rawCounts: Record<string, Record<string, number>>;
}

function getMainVals(record: Record<string, unknown>, f: Field): string[] {
  if (f.type === 'boolean') {
    const v = normalizeBool(record[f.key]);
    return v ? [v] : [];
  }
  const raw = toStr(record[f.key]);
  if (!raw) return [];
  if (f.type === 'multi_choice') return splitMultiChoice(raw, f.multiDelimiter ?? '┋');
  return [raw];
}

export function aggregateFieldGrouped(
  records: Record<string, unknown>[],
  mainField: Field,
  groupField: Field,
  selectedGroups: string[],
  maxSeries = 12,
): GroupedChartData {
  const rawCounts: Record<string, Record<string, number>> = {};
  const groupTotals: Record<string, number> = {};
  for (const g of selectedGroups) { rawCounts[g] = {}; groupTotals[g] = 0; }

  for (const record of records) {
    const gRaw = groupField.type === 'boolean'
      ? normalizeBool(record[groupField.key])
      : toStr(record[groupField.key]);
    if (!gRaw || !selectedGroups.includes(gRaw)) continue;

    const mVals = getMainVals(record, mainField);
    if (!mVals.length) continue;

    groupTotals[gRaw] += 1;
    for (const mv of mVals) rawCounts[gRaw][mv] = (rawCounts[gRaw][mv] ?? 0) + 1;
  }

  const totalByMain = new Map<string, number>();
  for (const g of selectedGroups) {
    for (const [mv, cnt] of Object.entries(rawCounts[g])) {
      totalByMain.set(mv, (totalByMain.get(mv) ?? 0) + cnt);
    }
  }

  // mainKeys = the dimension values shown on the Y-axis
  let mainKeys = [...totalByMain.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k)
    .slice(0, maxSeries);

  if (mainField.orderedValues?.length) {
    const ord = mainField.orderedValues;
    mainKeys.sort((a, b) => {
      const ai = ord.indexOf(a); const bi = ord.indexOf(b);
      if (ai === -1 && bi === -1) return (totalByMain.get(b) ?? 0) - (totalByMain.get(a) ?? 0);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }

  // Clustered horizontal: rows = mainValues, series = groups.
  // When orderedValues is set the order is already "largest first" (display top→bottom),
  // so we keep it as-is. Without orderedValues we reverse the count-sorted list so the
  // highest-count item appears at the bottom of the chart (reading-direction convention).
  const displayKeys = mainField.orderedValues?.length ? mainKeys : [...mainKeys].reverse();
  const items = displayKeys.map(mv => {
    const row: Record<string, number | string> = { label: mv };
    for (const g of selectedGroups) {
      const total = groupTotals[g];
      row[g] = total > 0 ? Math.round(((rawCounts[g][mv] ?? 0) / total) * 1000) / 10 : 0;
    }
    return row;
  });

  // Stacked vertical: rows = groups, series = mainValues (natural order for stacking)
  const stackItems = selectedGroups.map(g => {
    const total = groupTotals[g];
    const row: Record<string, number | string> = { label: g };
    for (const mv of mainKeys) {
      row[mv] = total > 0 ? Math.round(((rawCounts[g][mv] ?? 0) / total) * 1000) / 10 : 0;
    }
    return row;
  });

  return {
    items, seriesKeys: selectedGroups,
    stackItems, stackSeriesKeys: mainKeys,
    groupTotals, rawCounts,
  };
}

// ── Group-aware status comparison aggregation ─────────────────
// Each StatusGroup (which can contain multiple raw status values) becomes
// ONE series in the output chart.  Counts from all values inside a group
// are summed before computing percentages.

export function aggregateByStatusGroups(
  records: Record<string, unknown>[],
  mainField: Field,
  statusFieldKey: string,
  groups: Array<{ key: string; label: string; values: string[] }>,
  maxSeries = 12,
): GroupedChartData {
  const seriesKeys = groups.map(g => g.label);

  // rawStatusValue → groupLabel
  const valueToGroupLabel = new Map<string, string>();
  for (const g of groups) {
    for (const v of g.values) valueToGroupLabel.set(v, g.label);
  }

  const rawCounts: Record<string, Record<string, number>> = {};
  const groupTotals: Record<string, number> = {};
  for (const g of groups) { rawCounts[g.label] = {}; groupTotals[g.label] = 0; }

  for (const record of records) {
    const statusVal  = toStr(record[statusFieldKey]);
    const groupLabel = valueToGroupLabel.get(statusVal);
    if (!groupLabel) continue;

    const mVals = getMainVals(record, mainField);
    if (!mVals.length) continue;

    groupTotals[groupLabel] += 1;
    for (const mv of mVals) {
      rawCounts[groupLabel][mv] = (rawCounts[groupLabel][mv] ?? 0) + 1;
    }
  }

  // Rank dimension values by total mentions across all groups
  const totalByMain = new Map<string, number>();
  for (const g of groups) {
    for (const [mv, cnt] of Object.entries(rawCounts[g.label])) {
      totalByMain.set(mv, (totalByMain.get(mv) ?? 0) + cnt);
    }
  }

  let mainKeys = [...totalByMain.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k)
    .slice(0, maxSeries);

  if (mainField.orderedValues?.length) {
    const ord = mainField.orderedValues;
    mainKeys.sort((a, b) => {
      const ai = ord.indexOf(a); const bi = ord.indexOf(b);
      if (ai === -1 && bi === -1) return (totalByMain.get(b) ?? 0) - (totalByMain.get(a) ?? 0);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }

  const displayKeys = mainField.orderedValues?.length ? mainKeys : [...mainKeys].reverse();

  const items = displayKeys.map(mv => {
    const row: Record<string, number | string> = { label: mv };
    for (const g of groups) {
      const total = groupTotals[g.label];
      row[g.label] = total > 0 ? Math.round(((rawCounts[g.label][mv] ?? 0) / total) * 1000) / 10 : 0;
    }
    return row;
  });

  const stackItems = groups.map(g => {
    const total = groupTotals[g.label];
    const row: Record<string, number | string> = { label: g.label };
    for (const mv of mainKeys) {
      row[mv] = total > 0 ? Math.round(((rawCounts[g.label][mv] ?? 0) / total) * 1000) / 10 : 0;
    }
    return row;
  });

  return {
    items, seriesKeys,
    stackItems, stackSeriesKeys: mainKeys,
    groupTotals, rawCounts,
  };
}

// ── Cross-dataset status comparison ──────────────────────────
// Two datasets share the same statusFieldKey and group definitions.
// Series are interleaved: [A·g1, B·g1, A·g2, B·g2, ...]
// Percentage denominator = total records in each dataset (option B:
// "% of total dataset"), so bars reflect both group prevalence and
// within-group distribution.  groupTotals stores the group size (for
// the tooltip n= display).

export function aggregateCrossDatasetByStatus(
  primary: { records: Record<string, unknown>[]; label: string },
  compare: { records: Record<string, unknown>[]; label: string },
  mainField: Field,
  statusFieldKey: string,
  groups: Array<{ key: string; label: string; values: string[] }>,
  maxItems = 12,
): GroupedChartData {
  // Build reverse map: statusValue → groupLabel
  const valueToGroup = new Map<string, string>();
  for (const g of groups) {
    for (const v of g.values) valueToGroup.set(v, g.label);
  }

  // Interleaved series: A·g1, B·g1, A·g2, B·g2 …
  const seriesKeys: string[] = [];
  for (const g of groups) {
    seriesKeys.push(`${primary.label} · ${g.label}`);
    seriesKeys.push(`${compare.label} · ${g.label}`);
  }

  const rawCounts: Record<string, Record<string, number>> = {};
  // groupTotals stores group sizes (for tooltip n= display)
  const groupTotals: Record<string, number> = {};
  for (const sk of seriesKeys) { rawCounts[sk] = {}; groupTotals[sk] = 0; }

  // Dataset totals — denominator for percentages (option B)
  const datasetTotal: Record<string, number> = {
    [primary.label]: primary.records.length,
    [compare.label]: compare.records.length,
  };

  // Count function
  function processRecords(
    records: Record<string, unknown>[],
    datasetLabel: string,
  ) {
    for (const record of records) {
      const statusVal  = toStr(record[statusFieldKey]);
      const groupLabel = valueToGroup.get(statusVal);
      if (!groupLabel) continue;

      const sk    = `${datasetLabel} · ${groupLabel}`;
      const mVals = getMainVals(record, mainField);
      if (!mVals.length) continue;

      groupTotals[sk] = (groupTotals[sk] ?? 0) + 1;
      for (const mv of mVals) {
        rawCounts[sk][mv] = (rawCounts[sk][mv] ?? 0) + 1;
      }
    }
  }
  processRecords(primary.records, primary.label);
  processRecords(compare.records, compare.label);

  // Rank field values by total mentions across all series
  const totalByMain = new Map<string, number>();
  for (const sk of seriesKeys) {
    for (const [mv, cnt] of Object.entries(rawCounts[sk])) {
      totalByMain.set(mv, (totalByMain.get(mv) ?? 0) + cnt);
    }
  }

  let mainKeys = [...totalByMain.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k)
    .slice(0, maxItems);

  if (mainField.orderedValues?.length) {
    const ord = mainField.orderedValues;
    mainKeys.sort((a, b) => {
      const ai = ord.indexOf(a); const bi = ord.indexOf(b);
      if (ai === -1 && bi === -1) return (totalByMain.get(b) ?? 0) - (totalByMain.get(a) ?? 0);
      if (ai === -1) return 1; if (bi === -1) return -1;
      return ai - bi;
    });
  }

  const displayKeys = mainField.orderedValues?.length ? mainKeys : [...mainKeys].reverse();

  // Compute percentages using dataset total as denominator (option B)
  const items = displayKeys.map(mv => {
    const row: Record<string, number | string> = { label: mv };
    for (const g of groups) {
      const skA = `${primary.label} · ${g.label}`;
      const skB = `${compare.label} · ${g.label}`;
      const totA = datasetTotal[primary.label];
      const totB = datasetTotal[compare.label];
      row[skA] = totA > 0 ? Math.round(((rawCounts[skA][mv] ?? 0) / totA) * 1000) / 10 : 0;
      row[skB] = totB > 0 ? Math.round(((rawCounts[skB][mv] ?? 0) / totB) * 1000) / 10 : 0;
    }
    return row;
  });

  const stackItems = groups.flatMap(g => [
    { label: `${primary.label} · ${g.label}` },
    { label: `${compare.label} · ${g.label}` },
  ]) as Record<string, number | string>[];

  return {
    items,
    seriesKeys,
    stackItems,
    stackSeriesKeys: mainKeys,
    groupTotals,
    rawCounts,
  };
}

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
