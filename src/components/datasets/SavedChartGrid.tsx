'use client';

/**
 * SavedChartGrid
 *
 * 展示一个数据集下所有已保存的图表（来自 ChartBuilder 的"保存到面板"）。
 * 使用 ChartCard 渲染，支持：
 *  - 标题内联编辑（持久化写回 store）
 *  - 删除单张图表
 *  - 按 2 列响应式网格排列
 *
 * 若无已保存图表则不渲染任何内容。
 */

import { useMemo } from 'react';
import { LayoutGrid } from 'lucide-react';
import { ChartCard } from '@/components/charts/ChartCard';
import { useDatasetStore } from '@/store/datasetStore';
import { aggregateField } from '@/lib/dataAggregator';
import type { Dataset } from '@/types/dataSchema';
import type { SavedChart } from '@/store/datasetStore';

// 稳定空数组，防止 undefined ?? [] 每次产生新引用
const EMPTY: SavedChart[] = [];

interface SavedChartGridProps {
  dataset: Dataset;
}

export function SavedChartGrid({ dataset }: SavedChartGridProps) {
  const charts           = useDatasetStore(s => s.savedCharts[dataset.id] ?? EMPTY);
  const removeSavedChart = useDatasetStore(s => s.removeSavedChart);
  const updateSavedChart = useDatasetStore(s => s.updateSavedChart);

  // 为每张保存图表聚合数据（仅在 charts / records 变化时重算）
  const rendered = useMemo(() => {
    return charts.map(sc => {
      const field = dataset.fields.find(f => f.key === sc.fieldKey);
      if (!field) return null;
      const data = aggregateField(dataset.records, field);
      return { sc, field, data };
    }).filter(Boolean) as { sc: SavedChart; field: typeof dataset.fields[0]; data: ReturnType<typeof aggregateField> }[];
  }, [charts, dataset.fields, dataset.records]);

  if (rendered.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* 标题行 */}
      <div className="flex items-center gap-2 pt-2 border-t border-black/06">
        <LayoutGrid size={13} className="text-[#5856D6]" />
        <span className="text-[13px] font-600 text-black/55">已保存图表</span>
        <span className="text-[11px] text-black/30 tabular-nums">
          {rendered.length} 张
        </span>
      </div>

      {/* 2 列网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rendered.map(({ sc, field, data }) => (
          <ChartCard
            key={sc.id}
            title={sc.title}
            data={data}
            config={sc.config}
            chartType={sc.chartType}
            isMultiSelect={field.type === 'multi_choice'}
            totalSamples={dataset.rowCount}
            validSamples={data.reduce((s, d) => s + d.count, 0)}
            onHide={() => removeSavedChart(dataset.id, sc.id)}
            // 标题编辑：写回 store（持久化）
            onTitleChange={(newTitle) =>
              updateSavedChart(dataset.id, sc.id, { title: newTitle })
            }
            className="shadow-none border border-black/06"
          />
        ))}
      </div>
    </div>
  );
}
