import type { Dataset, Field, FieldType } from '@/types/dataSchema';

export interface FieldContext {
  name: string;
  type: FieldType;
  totalCount: number;
  missingCount?: number;
  uniqueCount?: number;
  distribution?: Record<string, number>;
  topValues?: { value: string; count: number }[];
}

export interface AIContext {
  datasetName: string;
  rowCount: number;
  fields: FieldContext[];
  sampleRows: Record<string, unknown>[];
}

function buildFieldContext(f: Field): FieldContext {
  const ctx: FieldContext = {
    name: f.name,
    type: f.type,
    totalCount: f.statistics?.count ?? 0,
    missingCount: f.statistics?.missing,
    uniqueCount: f.statistics?.unique,
  };

  if (f.type === 'single_choice' || f.type === 'multi_choice' || f.type === 'boolean') {
    if (f.statistics?.topValues) {
      ctx.distribution = Object.fromEntries(
        f.statistics.topValues.map(({ value, count }) => [value, count])
      );
    }
  } else {
    ctx.topValues = f.statistics?.topValues?.slice(0, 5);
  }

  return ctx;
}

export function buildAIContext(dataset: Dataset): AIContext {
  const fields = dataset.fields.map(buildFieldContext);

  // 最多抽 8 行样本（均匀抽样）
  const sampleCount = Math.min(8, dataset.records.length);
  const step = Math.max(1, Math.floor(dataset.records.length / sampleCount));
  const fieldKeys  = dataset.fields.slice(0, 6).map(f => f.key);
  const fieldNames = dataset.fields.slice(0, 6).map(f => f.name);

  const sampleRows = Array.from({ length: sampleCount }, (_, i) => {
    const record = dataset.records[Math.min(i * step, dataset.records.length - 1)];
    return Object.fromEntries(fieldKeys.map((key, j) => [fieldNames[j], record[key]]));
  });

  return { datasetName: dataset.name, rowCount: dataset.rowCount, fields, sampleRows };
}

export function serializeAIContext(ctx: AIContext): string {
  return JSON.stringify(ctx, null, 2);
}
