/**
 * 画像配置类型定义
 *
 * PersonaConfig 定义了"一个数据集里的字段如何渲染成用户画像看板"。
 * 每种字段可以选不同的区块类型（标签云、统计徽标、分布图等）。
 * 可选地定义 segments[]，用于驱动分群画像报告视图。
 */
import type { ChartTypeRecommend } from './dataSchema';

// ═══════════ 区块展现方式 ═══════════

export type PersonaBlockType =
  | 'tag_cloud'        // 标签云：展示一组标签 + 计数
  | 'stat_badge'       // 数值徽标：展示大号数值 + 标签
  | 'distribution'     // 分布图：以图表展示占比
  | 'property_row'     // 属性行：字段名:值 列表
  | 'text_card'        // 文本卡片：精选文本展示
  | 'boolean_tick'     // 布尔标记：显示为勾选/叉号
  | 'date_range'       // 日期范围：展示最早～最晚
  | 'grouped_compare'  // 分组对比：两个字段交叉分析
  | 'ranking_heatmap'; // 排序热力图：位次矩阵 + 平均名次

// ═══════════ 区块字段映射 ═══════════

export interface PersonaBlockField {
  sourceFieldKey: string;
  displayName: string;
  blockType: PersonaBlockType;
  order: number;
  visible: boolean;
  config?: {
    showLabel?: boolean;
    chartType?: 'bar' | 'pie' | 'donut';
    maxTags?: number;
    tagSortBy?: 'count' | 'alpha';
    granularity?: 'year' | 'month' | 'day';
    statAggregation?: 'count' | 'avg' | 'top';
    statSuffix?: string;
    groupFieldKey?: string;
    selectedGroups?: string[];
    groupChartType?: 'grouped' | 'stacked';
  };
}

// ═══════════ 分群报告类型 ═══════════

/** 每个分群的颜色主题 */
export type SegmentColor = 'red' | 'yellow' | 'green' | 'blue' | 'purple';

export const SEGMENT_COLORS: Record<SegmentColor, {
  bg: string; bar: string; accent: string; border: string; label: string;
}> = {
  red:    { bg: '#FEF2F2', bar: '#FCA5A5', accent: '#DC2626', border: '#FECACA', label: '红' },
  yellow: { bg: '#FFFBEB', bar: '#FCD34D', accent: '#D97706', border: '#FDE68A', label: '黄' },
  green:  { bg: '#F0FDF4', bar: '#86EFAC', accent: '#16A34A', border: '#BBF7D0', label: '绿' },
  blue:   { bg: '#EFF6FF', bar: '#93C5FD', accent: '#2563EB', border: '#BFDBFE', label: '蓝' },
  purple: { bg: '#FAF5FF', bar: '#C4B5FD', accent: '#7C3AED', border: '#DDD6FE', label: '紫' },
};

/** AI 生成的分群叙事（缓存在分群定义里） */
export interface SegmentNarrative {
  psych_title:   string;                                  // 消费心理标题
  psych_text:    string;                                  // Markdown 正文
  sections:      Array<{ title: string; content: string }>; // 各维度分析卡
  purchase_text: string;                                  // 购车偏好 Markdown
  generatedAt:   string;                                  // ISO 时间戳
}

/** 一个分群的完整定义 */
export interface SegmentDef {
  id:          string;
  name:        string;               // "进取务实的职场中产"
  color:       SegmentColor;
  /** 筛选条件：filterField 字段的值在 filterValues 里 → 属于本分群
   *  filterField 为空字符串 = 全量（不过滤）
   */
  filterField:  string;
  filterValues: string[];
  /** 最多 4 个画像词标签（虚线边框展示） */
  keywords:    string[];
  /** 左栏人口统计用哪些字段（按序排列） */
  demoFields:  string[];
  /** 右下角迷你对比图用哪些字段 */
  chartFields: string[];
  /** AI 生成的叙事文本（缓存，Package C 填充） */
  cachedNarrative?: SegmentNarrative | null;
}

// ═══════════ 整张画像配置 ═══════════

export interface PersonaConfig {
  id: string;
  name: string;
  datasetId: string;
  createdAt: string;
  updatedAt: string;
  blocks: PersonaBlockField[];
  layout?: {
    columns?: 1 | 2 | 3;
    gap?: number;
    showHeader?: boolean;
    showRecordCount?: boolean;
  };
  filters?: Record<string, string[]>;
  /** 分群报告定义（Package A+B+C 驱动） */
  segments?: SegmentDef[];
}

// ═══════════ 预置区块类型元信息 ═══════════

export const PERSONA_BLOCK_META: Record<PersonaBlockType, {
  label: string;
  description: string;
  supportedFieldTypes: string[];
}> = {
  tag_cloud: {
    label: '标签云',
    description: '展示一组标签及其出现次数',
    supportedFieldTypes: ['single_choice', 'multi_choice', 'boolean', 'text'],
  },
  stat_badge: {
    label: '数值徽标',
    description: '展示大号数值 + 标签说明',
    supportedFieldTypes: ['number', 'date'],
  },
  distribution: {
    label: '分布图',
    description: '以饼图或条形图展示各选项占比',
    supportedFieldTypes: ['single_choice', 'multi_choice', 'boolean', 'number', 'date'],
  },
  property_row: {
    label: '属性行',
    description: '键值对列表',
    supportedFieldTypes: ['single_choice', 'multi_choice', 'text', 'number', 'boolean', 'date'],
  },
  text_card: {
    label: '文本卡片',
    description: '精选原文展示',
    supportedFieldTypes: ['text'],
  },
  boolean_tick: {
    label: '布尔标记',
    description: '用勾选/叉号表示是否',
    supportedFieldTypes: ['boolean'],
  },
  date_range: {
    label: '日期范围',
    description: '展示数据日期的最早～最晚范围',
    supportedFieldTypes: ['date'],
  },
  grouped_compare: {
    label: '分组对比',
    description: '两个字段交叉分析',
    supportedFieldTypes: ['single_choice', 'multi_choice', 'boolean'],
  },
  ranking_heatmap: {
    label: '排序热力图',
    description: '以热力图矩阵展示排序题的位次分布',
    supportedFieldTypes: ['ranking'],
  },
};

// ═══════════ 默认区块推荐 ═══════════

export function recommendPersonaBlocks(
  fields: { key: string; name: string; type: string }[],
): PersonaBlockField[] {
  const blocks: PersonaBlockField[] = [];
  let order = 0;

  for (const field of fields) {
    let blockType: PersonaBlockType | null = null;

    switch (field.type) {
      case 'ranking':      blockType = 'ranking_heatmap'; break;
      case 'number':       blockType = 'stat_badge';      break;
      case 'multi_choice': blockType = 'tag_cloud';       break;
      case 'single_choice':blockType = 'distribution';    break;
      case 'boolean':      blockType = 'boolean_tick';    break;
      case 'date':         blockType = 'date_range';      break;
      case 'text':         blockType = 'property_row';    break;
    }

    if (blockType) {
      blocks.push({
        sourceFieldKey: field.key,
        displayName:    field.name,   // use human-readable name, not raw key
        blockType,
        order: order++,
        visible: true,
        config: blockType === 'tag_cloud'  ? { maxTags: 10, tagSortBy: 'count' } :
                blockType === 'stat_badge' ? { statAggregation: 'top', statSuffix: '' } : undefined,
      });
    }
  }

  return blocks;
}
