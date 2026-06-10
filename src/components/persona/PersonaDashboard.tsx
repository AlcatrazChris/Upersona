'use client';

import { useMemo } from 'react';
import { Users, Filter, BarChart2 } from 'lucide-react';
import { useDatasetStore } from '@/store/datasetStore';
import { buildPersonaView } from '@/lib/personaEngine';
import { PersonaBlockRenderer } from './PersonaBlocks';
import type { Dataset } from '@/types/dataSchema';
import type { PersonaConfig } from '@/types/personaSchema';
import { cn } from '@/lib/utils';

interface PersonaDashboardProps {
  dataset: Dataset;
  config: PersonaConfig;
}

export function PersonaDashboard({ dataset, config }: PersonaDashboardProps) {
  const viewData = useMemo(
    () => buildPersonaView(dataset, config),
    [dataset, config],
  );

  const columns = config.layout?.columns ?? 2;
  const showHeader = config.layout?.showHeader ?? true;
  const showRecordCount = config.layout?.showRecordCount ?? true;

  if (viewData.blocks.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <BarChart2 size={36} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm">暂无画像区块</p>
        <p className="text-xs mt-1 opacity-70">请在配置编辑器中添加字段区块</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-blue-500" />
            <h2 className="text-lg font-semibold text-gray-800">{config.name}</h2>
          </div>
          {showRecordCount && (
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <Users size={12} />
                {viewData.summary.filteredRows.toLocaleString()} 人
              </span>
              {viewData.summary.filteredRows < viewData.summary.totalRows && (
                <span className="flex items-center gap-1 text-orange-500">
                  <Filter size={12} />
                  已筛选（共 {viewData.summary.totalRows.toLocaleString()} 人）
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Blocks grid */}
      <div
        className={cn(
          'grid gap-4',
          columns === 1 ? 'grid-cols-1' :
          columns === 2 ? 'grid-cols-1 md:grid-cols-2' :
                          'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
        )}
      >
        {viewData.blocks.map((blockData) => {
          const b = blockData.block;
          return (
            <div
              key={`${b.sourceFieldKey}-${b.blockType}`}
              className="bg-white rounded-2xl border border-gray-100 p-4 hover:border-gray-200 transition-colors"
            >
              {/* Block header */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {b.displayName}
                </h3>
                <span className="text-[10px] text-gray-300 bg-gray-50 px-1.5 py-0.5 rounded">
                  {b.blockType === 'tag_cloud'       && '标签云'}
                  {b.blockType === 'stat_badge'      && '数值'}
                  {b.blockType === 'distribution'    && '分布'}
                  {b.blockType === 'property_row'    && '属性'}
                  {b.blockType === 'text_card'       && '文本'}
                  {b.blockType === 'boolean_tick'    && '布尔'}
                  {b.blockType === 'date_range'      && '日期'}
                  {b.blockType === 'grouped_compare' && '对比'}
                  {b.blockType === 'ranking_heatmap' && '排序'}
                </span>
              </div>

              {/* Block content */}
              <div className="min-h-[60px]">
                {blockData.validCount > 0 ? (
                  <PersonaBlockRenderer data={blockData} />
                ) : (
                  <div className="text-sm text-gray-300 italic text-center py-4">
                    无有效数据
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
