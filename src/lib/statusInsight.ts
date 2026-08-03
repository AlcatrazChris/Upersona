import type { GroupedChartData } from '@/lib/dataAggregator';

export function formatStatusDimensionComparison(
  dimension: string,
  grouped: GroupedChartData,
) {
  return {
    dimension,
    series: grouped.seriesKeys,
    validSamples: grouped.groupTotals,
    values: grouped.items.map(item => {
      const value = String(item.label ?? '');
      return {
        value,
        percentages: Object.fromEntries(
          grouped.seriesKeys.map(series => [series, Number(item[series] ?? 0)]),
        ),
        counts: Object.fromEntries(
          grouped.seriesKeys.map(series => [series, grouped.rawCounts[series]?.[value] ?? 0]),
        ),
      };
    }),
  };
}

export function reorderSelectedKeys(keys: string[], fromKey: string, toKey: string) {
  const from = keys.indexOf(fromKey);
  const to = keys.indexOf(toKey);
  if (from < 0 || to < 0 || from === to) return keys;
  const next = [...keys];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
