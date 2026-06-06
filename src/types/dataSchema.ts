/**
 * 统一数据模型 — Dataset / Field
 *
 * 所有数据源（Excel / CSV / JSON / Supabase）统一转换为此格式，
 * 作为 AI 分析、图表引擎、Zustand 状态层的唯一数据语言。
 */

// ── 字段类型 ──────────────────────────────────────────────────
export type FieldType =
  | 'single_choice'  // 单选：如性别、年龄段
  | 'multi_choice'   // 多选：如消费观念（逗号分隔）
  | 'number'         // 数值：如年龄、金额
  | 'date'           // 日期：如 2025-01-01
  | 'boolean'        // 布尔：如是/否
  | 'text';          // 自由文本：如意见建议

// 推荐图表类型
export type ChartTypeRecommend =
  | 'bar' | 'pie' | 'donut'
  | 'line' | 'area'
  | 'scatter' | 'heatmap'
  | 'wordcloud' | 'table';

// ── 字段描述 ──────────────────────────────────────────────────
export interface Field {
  key: string;                    // 原始列名（原始 key，保持与数据一致）
  name: string;                   // 人类可读标签
  type: FieldType;                // 自动识别 or 用户覆盖
  options?: string[];             // 单选/多选的取值集合
  isOrdered?: boolean;            // 取值是否有序（如年龄段）
  orderedValues?: string[];       // 有序时的自定义排序
  statistics?: {
    count: number;                // 总行数
    unique: number;               // 唯一值数量
    missing: number;              // 空值数量
    topValues?: { value: string; count: number }[];  // 最常见的前 10 个取值
  };
  recommendedCharts: ChartTypeRecommend[];   // AI / 规则推荐图表
}

// ── 数据集 ────────────────────────────────────────────────────
export interface Dataset {
  id: string;                              // UUID
  name: string;                            // 数据集名称（来自文件名或用户输入）
  source: 'xlsx' | 'xls' | 'csv' | 'json' | 'supabase';
  createdAt: string;                       // ISO 8601
  updatedAt: string;
  rowCount: number;
  fields: Field[];
  records: Record<string, unknown>[];      // 实际数据行
}

// ── 字段变化检测 ──────────────────────────────────────────────
export interface FieldDiff {
  added: string[];                         // 新增字段 key
  removed: string[];                       // 删除字段 key
  changed: {
    field: string;
    from: FieldType;
    to: FieldType;
  }[];
  renamed: {
    from: string;
    to: string;
  }[];
}

// ── 图表配置（通用） ────────────────────────────────────────
export interface UniversalChartConfig {
  id: string;
  title: string;
  chartType: ChartTypeRecommend;
  datasetId: string;
  fieldKey: string;            // 主数据字段
  groupByKey?: string;         // 分组字段（可选）
  aggregation?: 'count' | 'sum' | 'avg' | 'max' | 'min';
  filters?: Record<string, string[]>;
  style?: {
    colorScheme?: string;
    showLabel?: boolean;
    showLegend?: boolean;
    opacity?: number;
  };
}

// ── 工具类型 ──────────────────────────────────────────────────

/** 从 Dataset 中提取一个字段的所有值 */
export function getFieldValues(dataset: Dataset, fieldKey: string): unknown[] {
  return dataset.records.map(r => r[fieldKey]);
}

/** 根据字段类型推荐图表 */
export function recommendCharts(type: FieldType): ChartTypeRecommend[] {
  switch (type) {
    case 'single_choice':
      return ['bar', 'pie', 'donut'];
    case 'multi_choice':
      return ['bar', 'wordcloud'];
    case 'number':
      return ['bar', 'line', 'scatter'];
    case 'date':
      return ['line', 'area'];
    case 'boolean':
      return ['pie', 'bar'];
    case 'text':
      return ['table', 'wordcloud'];
    default:
      return ['bar'];
  }
}
