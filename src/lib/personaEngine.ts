/**
 * personaEngine
 *
 * 画像引擎：接收 Dataset + PersonaConfig → 产出渲染所需的 PersonaViewData。
 * 负责：
 *   1. 应用 filters 过滤 records
 *   2. 按每个 block 定义聚合数据
 *   3. 组装为结构化的 PersonaViewData
 */

import { aggregateField, aggregateFieldGrouped, aggregateRanking, inferDateGran } from '@/lib/dataAggregator';
import type { Dataset, Field } from '@/types/dataSchema';
import type { PersonaBlockField, PersonaConfig, PersonaBlockType } from '@/types/personaSchema';
import type { ChartDataItem, } from '@/components/charts/engine/types';
import type { GroupedChartData, RankingData } from '@/lib/dataAggregator';

// ═══════════ 区块聚合结果 ═══════════

export interface PersonaBlockData {
  block: PersonaBlockField;
  field?: Field;
  // 通用聚合数据（distribution / tag_cloud / stat_badge 都用）
  aggregate?: ChartDataItem[];
  // 数值徽标专用
  statValue?: number | string;
  // 日期范围专用
  dateMin?: string;
  dateMax?: string;
  // 分组对比专用
  groupedData?: GroupedChartData;
  // 排序热力图专用
  rankingData?: RankingData;
  // 统计摘要
  totalCount: number;
  validCount: number;
}

// ═══════════ 画像视图数据 ═══════════

export interface PersonaViewData {
  config: PersonaConfig;
  datasetId: string;
  datasetName: string;
  summary: {
    totalRows: number;
    filteredRows: number;
  };
  blocks: PersonaBlockData[];
}

// ═══════════ 画像引擎 ═══════════

export function buildPersonaView(
  dataset: Dataset,
  config: PersonaConfig,
): PersonaViewData {
  // 1. 应用 filters
  let records = dataset.records;
  if (config.filters) {
    for (const [fieldKey, allowedValues] of Object.entries(config.filters)) {
      if (allowedValues.length === 0) continue;
      records = records.filter(r => {
        const v = String(r[fieldKey] ?? '').trim();
        return allowedValues.includes(v);
      });
    }
  }

  // 2. 按 block 定义逐个聚合
  const visibleBlocks = config.blocks
    .filter(b => b.visible)
    .sort((a, b) => a.order - b.order);

  const blockData: PersonaBlockData[] = visibleBlocks.map(block => {
    const field = dataset.fields.find(f => f.key === block.sourceFieldKey);
    if (!field) {
      return {
        block,
        totalCount: dataset.records.length,
        validCount: 0,
      };
    }

    // 根据 blockType 做不同处理
    switch (block.blockType) {
      case 'tag_cloud':
      case 'distribution':
      case 'property_row':
      case 'boolean_tick': {
        const data = aggregateField(records, field,
          field.type === 'date' ? (block.config?.granularity ?? 'month') : 'month'
        );
        const validCount = data.reduce((s, d) => s + d.count, 0);
        return { block, field, aggregate: data, totalCount: records.length, validCount };
      }

      case 'stat_badge': {
        const data = aggregateField(records, field);
        const validCount = data.reduce((s, d) => s + d.count, 0);
        const agg = block.config?.statAggregation ?? 'top';

        let statValue: number | string = '—';
        if (field.type === 'number') {
          if (agg === 'avg') {
            const nums = records
              .map(r => Number(r[field.key]))
              .filter(n => !isNaN(n));
            statValue = nums.length > 0
              ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1)
              : '—';
          } else if (agg === 'count') {
            statValue = validCount;
          } else {
            statValue = data[0]?.label ?? '—';
          }
        } else if (field.type === 'date') {
          statValue = data[0]?.label ?? '—';
        }

        return { block, field, aggregate: data, statValue, totalCount: records.length, validCount };
      }

      case 'text_card': {
        const validCount = records.length;
        return { block, field, totalCount: records.length, validCount };
      }

      case 'date_range': {
        const dates = records
          .map(r => new Date(String(r[field.key] ?? '')))
          .filter(d => !isNaN(d.getTime()))
          .sort((a, b) => a.getTime() - b.getTime());
        const dateMin = dates.length > 0 ? dates[0].toISOString().slice(0, 10) : undefined;
        const dateMax = dates.length > 0 ? dates[dates.length - 1].toISOString().slice(0, 10) : undefined;
        return { block, field, dateMin, dateMax, totalCount: records.length, validCount: dates.length };
      }

      case 'ranking_heatmap': {
        const rd = aggregateRanking(records, field);
        return { block, field, rankingData: rd, totalCount: records.length, validCount: rd.N };
      }

      case 'grouped_compare': {
        const groupKey = block.config?.groupFieldKey;
        const groups = block.config?.selectedGroups ?? [];
        if (groupKey && groups.length >= 2) {
          const groupField = dataset.fields.find(f => f.key === groupKey);
          if (groupField) {
            const groupedData = aggregateFieldGrouped(records, field, groupField, groups);
            return { block, field, groupedData, totalCount: records.length, validCount: records.length };
          }
        }
        return { block, field, totalCount: records.length, validCount: 0 };
      }

      default:
        return { block, field, totalCount: records.length, validCount: 0 };
    }
  });

  return {
    config,
    datasetId: dataset.id,
    datasetName: dataset.name,
    summary: {
      totalRows: dataset.records.length,
      filteredRows: records.length,
    },
    blocks: blockData,
  };
}

// ═══════════ 工具函数 ═══════════

export function getBlockFieldTypes(dataset: Dataset): Record<string, string> {
  const map: Record<string, string> = {};
  for (const f of dataset.fields) {
    map[f.key] = f.type;
  }
  return map;
}
