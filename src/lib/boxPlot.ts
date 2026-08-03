export interface BoxPlotSummary {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  count: number;
}

function quantile(sorted: number[], p: number): number {
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const weight = index - lower;
  return sorted[lower + 1] === undefined
    ? sorted[lower]
    : sorted[lower] * (1 - weight) + sorted[lower + 1] * weight;
}

export function summarizeBoxPlot(values: number[]): BoxPlotSummary | null {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  return {
    min: sorted[0],
    q1: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    q3: quantile(sorted, 0.75),
    max: sorted.at(-1)!,
    count: sorted.length,
  };
}
