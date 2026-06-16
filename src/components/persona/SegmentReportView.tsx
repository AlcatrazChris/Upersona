'use client';

import { useMemo } from 'react';
import { Users, Settings2 } from 'lucide-react';
import { useDatasetStore } from '@/store/datasetStore';
import { SegmentReportCard } from './SegmentReportCard';
import type { Dataset } from '@/types/dataSchema';
import type { PersonaConfig, SegmentNarrative } from '@/types/personaSchema';

interface SegmentReportViewProps {
  dataset:     Dataset;
  onConfig?:   () => void;
}

export function SegmentReportView({ dataset, onConfig }: SegmentReportViewProps) {
  const {
    personaConfigs,
    activePersonaConfigId,
    updatePersonaConfig,
  } = useDatasetStore();

  const configs      = personaConfigs[dataset.id] ?? [];
  const activeConfig: PersonaConfig | null =
    configs.find(c => c.id === activePersonaConfigId) ?? configs[0] ?? null;

  const segments = useMemo(
    () => activeConfig?.segments ?? [],
    [activeConfig],
  );

  function handleNarrativeUpdate(segId: string, narrative: SegmentNarrative) {
    if (!activeConfig) return;
    updatePersonaConfig(dataset.id, activeConfig.id, {
      segments: (activeConfig.segments ?? []).map(s =>
        s.id === segId ? { ...s, cachedNarrative: narrative } : s
      ),
    });
  }

  if (!activeConfig) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <Users size={36} className="mb-3 opacity-20" />
        <p className="text-sm">还没有画像配置</p>
        {onConfig && (
          <button onClick={onConfig}
            className="mt-3 text-sm text-blue-600 hover:underline flex items-center gap-1">
            <Settings2 size={13} />前往配置画像
          </button>
        )}
      </div>
    );
  }

  if (segments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <Users size={36} className="mb-3 opacity-20" />
        <p className="text-sm">「{activeConfig.name}」还没有分群定义</p>
        <p className="text-xs mt-1 text-gray-300">在「配置画像 → 分群报告」Tab 中添加分群</p>
        {onConfig && (
          <button onClick={onConfig}
            className="mt-3 text-sm text-blue-600 hover:underline flex items-center gap-1">
            <Settings2 size={13} />配置分群
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">分群画像报告</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {activeConfig.name} · {segments.length} 个分群 · 共 {dataset.records.length.toLocaleString()} 条数据
            </p>
          </div>
        </div>
        {onConfig && (
          <button onClick={onConfig}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-gray-200 text-gray-500 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50 transition-all">
            <Settings2 size={12} />配置分群
          </button>
        )}
      </div>

      {/* Cards: horizontal scroll */}
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
        {segments.map(seg => (
          <SegmentReportCard
            key={seg.id}
            seg={seg}
            dataset={dataset}
            onNarrativeUpdate={handleNarrativeUpdate}
          />
        ))}
      </div>
    </div>
  );
}
