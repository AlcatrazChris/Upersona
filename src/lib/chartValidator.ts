import type { Dataset, FieldType } from '@/types/dataSchema';
import { chartSchemaValidator, type ChartSchema } from '@/types/chartSchema';

export interface ChartIssue {
  code: string;
  message: string;
  path?: string;
}

export type ChartValidationResult =
  | { valid: true; warnings: ChartIssue[] }
  | { valid: false; errors: ChartIssue[]; warnings: ChartIssue[] };

const ALLOWED_FIELD_TYPES: Partial<Record<ChartSchema['chart']['type'], FieldType[]>> = {
  pie: ['single_choice', 'boolean', 'number'],
  donut: ['single_choice', 'boolean', 'number'],
  line: ['date', 'number', 'single_choice'],
  area: ['date', 'number', 'single_choice'],
  boxplot: ['number'],
  'ranking-heatmap': ['ranking'],
  wordcloud: ['text', 'multi_choice', 'single_choice'],
};

export function validateChartSchema(schema: ChartSchema, dataset: Dataset): ChartValidationResult {
  const parsed = chartSchemaValidator.safeParse(schema);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map(issue => ({ code: 'INVALID_SCHEMA', message: issue.message, path: issue.path.join('.') })),
      warnings: [],
    };
  }

  const errors: ChartIssue[] = [];
  const warnings: ChartIssue[] = [];
  if (schema.data.datasetId !== dataset.id) errors.push({ code: 'DATASET_MISMATCH', message: '图表绑定的数据集与当前数据集不一致' });
  const field = dataset.fields.find(item => item.key === schema.data.fieldKey);
  if (!field) errors.push({ code: 'FIELD_NOT_FOUND', message: `字段不存在：${schema.data.fieldKey}` });
  if (field) {
    const allowed = ALLOWED_FIELD_TYPES[schema.chart.type];
    if (allowed && !allowed.includes(field.type)) {
      errors.push({ code: 'UNSUPPORTED_FIELD_TYPE', message: `${field.name}（${field.type}）不支持 ${schema.chart.type} 图` });
    }
    if (field.type === 'multi_choice' && ['pie', 'donut', 'line', 'area'].includes(schema.chart.type)) {
      errors.push({ code: 'MULTI_SELECT_UNSUPPORTED', message: '多选题占比之和可能超过 100%，请改用条形图或棒棒糖图' });
    }
  }

  const grouped = schema.chart.type === 'grouped-bar' || schema.chart.type === 'stacked-bar';
  if (grouped) {
    if (!schema.data.groupFieldKey || !dataset.fields.some(item => item.key === schema.data.groupFieldKey)) {
      errors.push({ code: 'GROUP_FIELD_REQUIRED', message: '对比图需要有效的分组字段' });
    }
    if ((schema.data.selectedGroups?.length ?? 0) < 2) {
      errors.push({ code: 'GROUPS_REQUIRED', message: '对比图至少需要选择两个分组' });
    }
  }
  if ((schema.data.limit ?? 0) > 100) warnings.push({ code: 'LARGE_LIMIT', message: '展示超过 100 个分类可能影响可读性' });

  return errors.length ? { valid: false, errors, warnings } : { valid: true, warnings };
}
