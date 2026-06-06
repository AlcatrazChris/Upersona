'use client';

import { useState } from 'react';
import {
  Database, Upload, Trash2, RefreshCw, Tag,
  BarChart2, FileText, ChevronRight, AlertTriangle, Info, Layers,
} from 'lucide-react';
import { DatasetImporter }  from '@/components/datasets/DatasetImporter';
import { ChartBuilder }     from '@/components/datasets/ChartBuilder';
import { SavedChartGrid }   from '@/components/datasets/SavedChartGrid';
import { useDatasetStore, useDatasetList } from '@/store/datasetStore';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/lib/utils';
import type { Dataset, FieldType } from '@/types/dataSchema';
import { compareSchemas } from '@/lib/schemaDetector';

// ── 常量 ──────────────────────────────────────────────────────

const TYPE_COLORS: Record<FieldType, string> = {
  single_choice: 'bg-[#007AFF]/10 text-[#007AFF]',
  multi_choice:  'bg-[#5856D6]/10 text-[#5856D6]',
  number:        'bg-[#34C759]/10 text-[#34C759]',
  date:          'bg-[#FF9500]/10 text-[#FF9500]',
  boolean:       'bg-[#FF2D55]/10 text-[#FF2D55]',
  text:          'bg-black/06 text-black/40',
};

const TYPE_LABELS: Record<FieldType, string> = {
  single_choice: '单选',
  multi_choice:  '多选',
  number:        '数值',
  date:          '日期',
  boolean:       '布尔',
  text:          '文本',
};

// ── 右侧 Tab ──────────────────────────────────────────────────
type RightTab = 'schema' | 'chart';

// ── 主页面 ────────────────────────────────────────────────────

export default function DatasetsPage() {
  // 仅关心 datasets（含 records，ChartBuilder 需要）和 removeDataset
  const { datasets, removeDataset } = useDatasetStore(
    useShallow(s => ({ datasets: s.datasets, removeDataset: s.removeDataset }))
  );
  const datasetList = useDatasetList();   // 摘要列表（不含 records）

  const [showImporter, setShowImporter] = useState(false);
  const [selectedId, setSelectedId]     = useState<string | null>(null);
  const [compareId, setCompareId]       = useState<string | null>(null);
  const [rightTab, setRightTab]         = useState<RightTab>('schema');

  // 当前选中 / 对比数据集
  const selectedDataset: Dataset | null =
    datasets.find(d => d.id === selectedId) ?? datasets[0] ?? null;
  const compareDataset: Dataset | null =
    compareId ? (datasets.find(d => d.id === compareId) ?? null) : null;

  // 字段变化对比
  const diff = selectedDataset && compareDataset
    ? compareSchemas(compareDataset.fields, selectedDataset.fields)
    : null;
  const hasDiff = diff && (diff.added.length + diff.removed.length + diff.changed.length) > 0;

  function handleImported(dataset: Dataset) {
    setSelectedId(dataset.id);
    setShowImporter(false);
    setRightTab('chart');   // 导入后直接打开图表构建
  }

  function handleSelect(id: string) {
    setSelectedId(id);
    setCompareId(null);
  }

  return (
    <div className="space-y-5">
      {/* ── 页头 ───────────────────────────────────────────── */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-ios bg-[#5856D6]/12 flex items-center justify-center">
              <Database size={16} className="text-[#5856D6]" />
            </div>
            <div>
              <h1 className="text-[16px] font-700 text-black/80">数据集管理</h1>
              <p className="text-[12px] text-black/35 mt-0.5">
                导入任意 Excel / CSV，自动识别字段并生成可视化图表
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowImporter(p => !p)}
            className="flex items-center gap-2 btn-ios bg-[#007AFF] text-white px-4 py-2 text-[13px]"
          >
            <Upload size={13} />
            {showImporter ? '取消' : '导入新数据集'}
          </button>
        </div>

        {showImporter && (
          <div className="mt-4 pt-4 border-t border-black/06">
            <DatasetImporter onImported={handleImported} compact />
          </div>
        )}
      </div>

      {/* ── 空态 ───────────────────────────────────────────── */}
      {datasetList.length === 0 && !showImporter && (
        <div className="glass-card p-12 text-center">
          <Database size={36} className="mx-auto mb-3 text-black/15" />
          <div className="text-[15px] font-600 text-black/35 mb-1">暂无数据集</div>
          <div className="text-[13px] text-black/25 mb-4">
            点击右上角「导入新数据集」上传 Excel 或 CSV
          </div>
          <button
            onClick={() => setShowImporter(true)}
            className="btn-ios bg-[#007AFF] text-white px-5 py-2 text-[13px] mx-auto"
          >
            <Upload size={13} />立即导入
          </button>
        </div>
      )}

      {/* ── 数据集列表 + 详情 ─────────────────────────────── */}
      {datasetList.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

          {/* 左栏：数据集列表 */}
          <div className="space-y-2">
            {datasetList.map(ds => {
              const isActive = ds.id === (selectedId ?? datasets[0]?.id);
              return (
                <div
                  key={ds.id}
                  onClick={() => handleSelect(ds.id)}
                  className={cn(
                    'glass-card p-4 cursor-pointer transition-all group',
                    isActive
                      ? 'border border-[#007AFF]/30 ring-1 ring-[#007AFF]/15'
                      : 'hover:border-black/12',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText size={14} className="text-black/35 flex-shrink-0" />
                      <span className="text-[13px] font-600 text-black/70 truncate">{ds.name}</span>
                    </div>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        removeDataset(ds.id);
                        if (selectedId === ds.id) setSelectedId(null);
                      }}
                      className="p-1 text-black/20 hover:text-[#FF3B30] rounded transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-[11px] text-black/35 tabular-nums">
                      {ds.rowCount.toLocaleString()} 行 · {ds.fields.length} 字段
                    </span>
                    <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-black/05 text-black/35">
                      {ds.source}
                    </span>
                  </div>

                  {/* 字段类型分布 */}
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {Object.entries(
                      ds.fields.reduce((acc, f) => {
                        acc[f.type] = (acc[f.type] || 0) + 1;
                        return acc;
                      }, {} as Record<FieldType, number>)
                    ).slice(0, 4).map(([t, n]) => (
                      <span key={t} className={cn('px-1.5 py-0.5 rounded-full text-[10px] font-500', TYPE_COLORS[t as FieldType])}>
                        {TYPE_LABELS[t as FieldType]}×{n}
                      </span>
                    ))}
                  </div>

                  <div className="text-[10px] text-black/20 mt-1.5">
                    {new Date(ds.createdAt).toLocaleString('zh-CN', {
                      month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 右栏：Tab 面板 */}
          {selectedDataset && (
            <div className="lg:col-span-2 space-y-0">
              {/* Tab 头 */}
              <div className="glass-card rounded-b-none border-b-0 px-5 pt-4 pb-0">
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                  <div>
                    <h2 className="text-[15px] font-700 text-black/75">{selectedDataset.name}</h2>
                    <div className="text-[12px] text-black/35 mt-0.5 flex items-center gap-3">
                      <span>{selectedDataset.rowCount.toLocaleString()} 行</span>
                      <span>{selectedDataset.fields.length} 个字段</span>
                      <span className="uppercase">.{selectedDataset.source}</span>
                    </div>
                  </div>

                  {/* 版本对比（仅 Schema 标签显示） */}
                  {rightTab === 'schema' && datasetList.filter(d => d.id !== selectedDataset.id).length > 0 && (
                    <div className="flex items-center gap-2">
                      <RefreshCw size={12} className="text-[#5856D6]" />
                      <select
                        value={compareId ?? ''}
                        onChange={e => setCompareId(e.target.value || null)}
                        className="input-ios text-[12px] py-1 pr-6 pl-2 rounded-ios"
                      >
                        <option value="">对比其他版本…</option>
                        {datasetList
                          .filter(d => d.id !== selectedDataset.id)
                          .map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Tab 标签 */}
                <div className="flex gap-0 border-b border-black/08 -mx-5 px-5">
                  {([
                    { key: 'schema', icon: <Layers size={13} />,   label: '字段结构' },
                    { key: 'chart',  icon: <BarChart2 size={13} />, label: '图表构建' },
                  ] as { key: RightTab; icon: React.ReactNode; label: string }[]).map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setRightTab(tab.key)}
                      className={cn(
                        'flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-500 transition-all border-b-2 -mb-px',
                        rightTab === tab.key
                          ? 'border-[#007AFF] text-[#007AFF]'
                          : 'border-transparent text-black/40 hover:text-black/60',
                      )}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab 内容 */}
              <div className="glass-card rounded-t-none pt-4">

                {/* ── Schema Tab ────────────────────────────── */}
                {rightTab === 'schema' && (
                  <>
                    {/* 字段变化报告 */}
                    {hasDiff && (
                      <div className="px-5 pb-3 border-b border-black/06 bg-[#FF9500]/05 -mx-0 mb-0">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle size={13} className="text-[#FF9500]" />
                          <span className="text-[13px] font-600 text-[#FF9500]">检测到字段变化</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-[12px]">
                          {diff!.added.length > 0 && (
                            <div>
                              <div className="text-[#34C759] font-600 mb-1">新增 {diff!.added.length} 个</div>
                              {diff!.added.map(k => (
                                <div key={k} className="text-black/50 truncate">+ {k}</div>
                              ))}
                            </div>
                          )}
                          {diff!.removed.length > 0 && (
                            <div>
                              <div className="text-[#FF3B30] font-600 mb-1">删除 {diff!.removed.length} 个</div>
                              {diff!.removed.map(k => (
                                <div key={k} className="text-black/50 truncate">- {k}</div>
                              ))}
                            </div>
                          )}
                          {diff!.changed.length > 0 && (
                            <div>
                              <div className="text-[#FF9500] font-600 mb-1">类型变化 {diff!.changed.length} 个</div>
                              {diff!.changed.map(c => (
                                <div key={c.field} className="text-black/50 truncate text-[11px]">
                                  {c.field}: {c.from} → {c.to}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 字段列表 */}
                    <div className="divide-y divide-black/04">
                      {selectedDataset.fields.map(f => {
                        const top = f.statistics?.topValues?.slice(0, 3).map(v => v.value).join(' / ') ?? '';
                        return (
                          <div key={f.key} className="px-5 py-3 hover:bg-black/01 transition-colors">
                            <div className="flex items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[13px] font-600 text-black/70">{f.name}</span>
                                  {f.name !== f.key && (
                                    <span className="text-[11px] text-black/30 font-mono">{f.key}</span>
                                  )}
                                  <span className={cn('px-1.5 py-0.5 rounded-full text-[10px] font-500', TYPE_COLORS[f.type])}>
                                    {TYPE_LABELS[f.type]}
                                  </span>
                                </div>
                                {top && (
                                  <div className="text-[11px] text-black/35 mt-0.5 truncate">
                                    常见值：{top}
                                    {(f.statistics?.unique ?? 0) > 3 && (
                                      <span className="text-black/20"> …共 {f.statistics?.unique} 种</span>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="flex-shrink-0 text-right">
                                {f.statistics && (
                                  <div className="text-[11px] text-black/35 tabular-nums">
                                    {f.statistics.missing > 0
                                      ? <span className="text-[#FF9500]">{f.statistics.missing} 缺失</span>
                                      : <span className="text-[#34C759]">完整</span>
                                    }
                                  </div>
                                )}
                                <div className="flex gap-1 mt-1 justify-end flex-wrap">
                                  {f.recommendedCharts.slice(0, 2).map(c => (
                                    <span key={c} className="text-[10px] px-1.5 py-0.5 bg-black/05 rounded text-black/35">
                                      {c}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* 选项预览 */}
                            {f.options && f.options.length > 0 && f.options.length <= 15 && (
                              <div className="flex gap-1 flex-wrap mt-1.5">
                                {f.options.map(o => (
                                  <span key={o} className="px-1.5 py-0.5 bg-black/04 rounded text-[10px] text-black/40">
                                    {o}
                                  </span>
                                ))}
                              </div>
                            )}
                            {f.options && f.options.length > 15 && (
                              <div className="text-[11px] text-black/30 mt-1 flex items-center gap-1">
                                <Info size={10} />
                                {f.options.slice(0, 8).join(' / ')} …等 {f.options.length} 个选项
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* 推荐图表快速导航 */}
                    <div className="px-5 py-4 border-t border-black/06 bg-black/01">
                      <div className="flex items-center gap-2 mb-2">
                        <BarChart2 size={12} className="text-[#5856D6]" />
                        <span className="text-[12px] font-600 text-black/45">快速可视化建议</span>
                        <span className="ml-auto">
                          <button
                            onClick={() => setRightTab('chart')}
                            className="text-[11px] text-[#007AFF] hover:text-[#007AFF]/70 flex items-center gap-1"
                          >
                            打开图表构建 <ChevronRight size={10} />
                          </button>
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {selectedDataset.fields
                          .filter(f => f.type !== 'text')
                          .slice(0, 5)
                          .map(f => (
                            <div key={f.key} className="flex items-center gap-2 text-[12px]">
                              <ChevronRight size={11} className="text-black/20 flex-shrink-0" />
                              <span className="text-black/55 truncate font-500">{f.name}</span>
                              <span className="text-black/25 mx-0.5">→</span>
                              <div className="flex gap-1">
                                {f.recommendedCharts.slice(0, 2).map(c => (
                                  <span key={c} className="px-1.5 py-0.5 bg-[#5856D6]/08 text-[#5856D6] rounded text-[10px]">
                                    {c}
                                  </span>
                                ))}
                              </div>
                              <span className={cn('ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-500', TYPE_COLORS[f.type])}>
                                {TYPE_LABELS[f.type]}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </>
                )}

                {/* ── 图表构建 Tab ─────────────────────────── */}
                {rightTab === 'chart' && (
                  <div className="px-5 pb-5 space-y-5">
                    <ChartBuilder dataset={selectedDataset} />
                    <SavedChartGrid dataset={selectedDataset} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
