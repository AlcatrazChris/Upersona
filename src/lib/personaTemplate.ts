import type { Field } from '@/types/dataSchema';

export type PersonaSemanticRole =
  | 'demographic'
  | 'geography'
  | 'lifecycle'
  | 'behavior'
  | 'motivation'
  | 'preference'
  | 'barrier'
  | 'intent'
  | 'open_text'
  | 'metadata';

export type PersonaChartType =
  | 'bar' | 'lollipop' | 'waffle' | 'donut' | 'wordcloud'
  | 'line' | 'area' | 'ranking-heatmap'
  | 'scatter' | 'histogram' | 'dumbbell' | 'difference' | 'heatmap';

export interface PersonaChartSpec {
  type: PersonaChartType;
  secondaryFieldKey?: string;
  endFieldKey?: string;
  valueFieldKey?: string;
  bins?: number;
}

export interface ScatterPoint { x: number; y: number }
export interface HistogramBin { range: string; start: number; end: number; count: number }
export interface DumbbellPoint { label: string; start: number; end: number }
export interface DifferencePoint { label: string; baseline: number; delta: number; value: number }
export interface HeatmapCell { row: string; column: string; value: number }

export const PERSONA_CHART_LABELS: Record<PersonaChartType, string> = {
  bar: '条形图', lollipop: '棒棒糖图', waffle: '华夫图', donut: '环形图', wordcloud: '词云',
  line: '折线图', area: '面积图', 'ranking-heatmap': '排序热力图',
  scatter: '散点图', histogram: '直方图', dumbbell: '哑铃图',
  difference: '差异图', heatmap: '矩阵热力图',
};

export function personaChartOptions(field: Field): PersonaChartType[] {
  if (field.type === 'ranking') return ['ranking-heatmap'];
  if (field.type === 'number') return ['histogram', 'scatter', 'dumbbell', 'bar'];
  if (field.type === 'date') return ['line', 'area'];
  if (field.type === 'single_choice' || field.type === 'boolean') {
    return ['bar', 'donut', 'heatmap', 'wordcloud', 'dumbbell'];
  }
  if (field.type === 'multi_choice') return ['bar', 'wordcloud'];
  if (field.type === 'text') return ['wordcloud', 'bar'];
  return ['bar'];
}

export function defaultPersonaChart(field: Field): PersonaChartType {
  return personaChartOptions(field)[0];
}

export function autoPersonaChartSpec(
  field: Field,
  type: PersonaChartType,
  fields: Field[],
): PersonaChartSpec {
  const numeric = fields.filter(item => item.key !== field.key && item.type === 'number');
  const categorical = fields.filter(item =>
    item.key !== field.key && (item.type === 'single_choice' || item.type === 'boolean')
  );

  if (type === 'scatter') return { type, secondaryFieldKey: numeric[0]?.key };
  if (type === 'histogram') return { type, bins: 8 };
  if (type === 'heatmap') {
    return {
      type,
      secondaryFieldKey: categorical[0]?.key,
      valueFieldKey: numeric[0]?.key,
    };
  }
  if (type === 'dumbbell') {
    return {
      type,
      secondaryFieldKey: numeric[0]?.key,
      endFieldKey: numeric[1]?.key,
    };
  }
  return { type };
}

export const PERSONA_ROLE_META: Record<PersonaSemanticRole, {
  label: string;
  description: string;
  order: number;
}> = {
  demographic: { label: '基础属性', description: '年龄、性别、职业、家庭结构', order: 1 },
  geography:   { label: '地域特征', description: '地区、城市级别与生活圈', order: 2 },
  lifecycle:   { label: '用户阶段', description: '线索、购买与使用阶段', order: 3 },
  behavior:    { label: '行为表现', description: '到店、试驾与使用行为', order: 4 },
  motivation:  { label: '动机与态度', description: '需求、动机与决策因素', order: 5 },
  preference:  { label: '产品偏好', description: '价格、车型与功能偏好', order: 6 },
  barrier:     { label: '决策障碍', description: '顾虑与未购买原因', order: 7 },
  intent:      { label: '转化意向', description: '意向度与购买计划', order: 8 },
  open_text:   { label: '用户原声', description: '建议、评价与开放题', order: 9 },
  metadata:    { label: '不参与画像', description: '标识、时间与技术字段', order: 10 },
};

export function inferPersonaRole(field: Field): PersonaSemanticRole {
  const name = `${field.name} ${field.key}`.toLowerCase();
  if (/姓名|手机|电话|证件|编号|id|提交|创建|时间|日期/.test(name)) return 'metadata';
  if (/省|市|区|县|地域|地区|城市|大区/.test(name)) return 'geography';
  if (/年龄|性别|职业|学历|收入|婚姻|家庭|孩子/.test(name)) return 'demographic';
  if (/状态|阶段|成交|订单|交付|购买时间/.test(name)) return 'lifecycle';
  if (/意向|计划|考虑|可能性/.test(name)) return 'intent';
  if (/顾虑|障碍|原因|放弃|不买|担心/.test(name)) return 'barrier';
  if (/动机|需求|场景|原因|态度|价值/.test(name)) return 'motivation';
  if (/偏好|预算|价格|车型|配置|颜色|品牌|功能/.test(name)) return 'preference';
  if (/试驾|到店|使用|频率|渠道|行为/.test(name)) return 'behavior';
  if (field.type === 'text') return 'open_text';
  return 'demographic';
}

export function roleForField(
  field: Field,
  roles?: Record<string, PersonaSemanticRole>,
): PersonaSemanticRole {
  return roles?.[field.key] ?? inferPersonaRole(field);
}
