'use client';

import { useMemo } from 'react';
import type { Dataset } from '@/types/dataSchema';
import type { ChartSchema } from '@/types/chartSchema';
import { buildChartDataFrame } from '@/lib/chartDataFrame';
import { validateChartSchema } from '@/lib/chartValidator';
import { aggregateRanking } from '@/lib/dataAggregator';
import { ChartRenderer, GroupChartRenderer } from './engine/ChartRenderer';
import type { ChartDataItem } from './engine/types';
import type { GroupedChartData } from '@/lib/dataAggregator';
import { cn } from '@/lib/utils';

interface ChartContainerProps {
  schema: ChartSchema;
  dataset: Dataset;
  className?: string;
  contentOnly?: boolean;
}

export function ChartContainer({ schema, dataset, className, contentOnly = false }: ChartContainerProps) {
  const validation = useMemo(() => validateChartSchema(schema, dataset), [schema, dataset]);
  const frameResult = useMemo(() => {
    if (!validation.valid) return null;
    try {
      return { frame: buildChartDataFrame(dataset, schema), error: null };
    } catch (error) {
      return { frame: null, error: error instanceof Error ? error.message : '图表数据处理失败' };
    }
  }, [dataset, schema, validation.valid]);

  const body = (() => {
    if (!validation.valid) {
      return <ChartMessage title="当前配置无法生成图表" detail={validation.errors.map(item => item.message).join('；')} />;
    }
    if (frameResult?.error || !frameResult?.frame) {
      return <ChartMessage title="图表数据处理失败" detail={frameResult?.error ?? ''} />;
    }

    const frame = frameResult.frame;
    if (!frame.rows.length) return <ChartMessage title="暂无可展示的数据" detail="请调整筛选条件或字段绑定" />;

    if (schema.chart.type === 'ranking-heatmap') {
      const field = dataset.fields.find(item => item.key === schema.data.fieldKey)!;
      return (
        <ChartRenderer
          type="ranking-heatmap"
          data={[]}
          rankingData={aggregateRanking(dataset.records, field)}
          fieldName={field.name}
          config={schema.appearance}
          height={schema.layout.height}
        />
      );
    }

    if (schema.chart.type === 'grouped-bar' || schema.chart.type === 'stacked-bar') {
      const grouped: GroupedChartData = {
        items: schema.chart.type === 'grouped-bar' ? frame.rows : [],
        seriesKeys: schema.chart.type === 'grouped-bar' ? frame.meta.seriesKeys : [],
        stackItems: schema.chart.type === 'stacked-bar' ? frame.rows : [],
        stackSeriesKeys: schema.chart.type === 'stacked-bar' ? frame.meta.seriesKeys : [],
        groupTotals: frame.meta.groupTotals ?? {},
        rawCounts: frame.meta.rawCounts ?? {},
      };
      return (
        <GroupChartRenderer
          type={schema.chart.type === 'stacked-bar' ? 'stacked' : 'grouped'}
          data={grouped}
          config={schema.appearance}
          height={schema.layout.height}
        />
      );
    }

    return (
      <ChartRenderer
        type={schema.chart.type}
        data={frame.rows as unknown as ChartDataItem[]}
        config={schema.appearance}
        isMultiSelect={frame.meta.isMultiSelect}
        totalSamples={frame.meta.sourceRowCount}
        height={schema.layout.height}
      />
    );
  })();

  if (contentOnly) return body;
  return (
    <section className={cn('ui-card p-5 md:p-6', className)}>
      <header className="mb-3 border-b border-gray-100 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-slate-900">{schema.presentation.title}</h3>
            {schema.presentation.description && <p className="mt-1 text-xs text-slate-500">{schema.presentation.description}</p>}
          </div>
          {frameResult?.frame && <span className="text-xs text-slate-500">n={frameResult.frame.meta.validRowCount.toLocaleString()}</span>}
        </div>
      </header>
      {body}
    </section>
  );
}

function ChartMessage({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex min-h-60 flex-col items-center justify-center rounded-lg bg-slate-50 px-6 text-center" role="status">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
    </div>
  );
}
