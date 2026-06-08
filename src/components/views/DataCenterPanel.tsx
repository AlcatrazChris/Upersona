'use client';

import { useState } from 'react';
import {
  X, Table2, BarChart2, Bookmark, Sparkles,
  Database, Trash2, ChevronRight,
} from 'lucide-react';
import { FieldList }       from '@/components/fields/FieldList';
import { ChartBuilder }    from '@/components/charts/ChartBuilder';
import { SavedChartGrid }  from '@/components/charts/SavedChartGrid';
import { AIPanel }         from '@/components/ai/AIPanel';
import { UploadDropzone }  from '@/components/upload/UploadDropzone';
import { SchemaDiffDialog } from '@/components/upload/SchemaDiffDialog';
import { EnrichmentDialog } from '@/components/upload/EnrichmentDialog';
import { useDatasetStore, useDatasetList } from '@/store/datasetStore';
import { compareSchemas }  from '@/lib/schemaDetector';
import {
  detectEnrichable, applyRegionEnrichment,
  applyCityTierEnrichment, applyOccupationEnrichment,
} from '@/lib/fieldEnricher';
import { cn } from '@/lib/utils';
import type { Dataset, FieldDiff } from '@/types/dataSchema';
import type { EnrichableField }    from '@/lib/fieldEnricher';

// ── Tabs ─────────────────────────────────────────────────────────

const TABS = [
  { id: 'data',    label: '数据管理', icon: Database,  needsDataset: false },
  { id: 'fields',  label: '字段概览', icon: Table2,    needsDataset: true  },
  { id: 'builder', label: '图表构建', icon: BarChart2, needsDataset: true  },
  { id: 'saved',   label: '图表浏览', icon: Bookmark,  needsDataset: true  },
  { id: 'ai',      label: 'AI 分析',  icon: Sparkles,  needsDataset: true  },
] as const;
type TabId = typeof TABS[number]['id'];

// ── Dataset management tab ────────────────────────────────────────

function DataManagementTab() {
  const { addDataset, removeDataset, setActiveDatasetId, getDataset, activeDatasetId } =
    useDatasetStore();
  const datasets = useDatasetList();

  const [uploading,    setUploading]    = useState(false);
  const [pendingData,  setPendingData]  =
    useState<{ dataset: Dataset; diff: FieldDiff; targetId: string } | null>(null);
  const [pendingEnrich, setPendingEnrich] =
    useState<{ dataset: Dataset; enrichments: EnrichableField[] } | null>(null);

  function finalizeDataset(ds: Dataset) {
    addDataset(ds); // also sets activeDatasetId
  }

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/parse', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? '解析失败');
      }
      const newDs: Dataset = await res.json();

      const existing = datasets.find(d => d.name === newDs.name);
      if (existing) {
        const existingFull = getDataset(existing.id);
        if (existingFull) {
          const diff = compareSchemas(existingFull.fields, newDs.fields);
          setPendingData({ dataset: { ...newDs, id: existing.id }, diff, targetId: existing.id });
          return;
        }
      }
      runEnrichStep(newDs);
    } catch (e) {
      alert(`上传失败: ${(e as Error).message}`);
    } finally {
      setUploading(false);
    }
  }

  function confirmUpdate() {
    if (!pendingData) return;
    setPendingData(null);
    runEnrichStep(pendingData.dataset);
  }

  function runEnrichStep(ds: Dataset) {
    const enrichments = detectEnrichable(ds);
    if (enrichments.length === 0) { finalizeDataset(ds); return; }
    setPendingEnrich({ dataset: ds, enrichments });
  }

  async function handleEnrichConfirm(selected: EnrichableField[]) {
    if (!pendingEnrich) return;
    // 先关闭弹窗，再在后台完成 enrichment
    const snapshot = pendingEnrich;
    setPendingEnrich(null);
    setUploading(true);
    try {
      let ds = snapshot.dataset;
      const ruleItems = selected.filter(e => e.enrichType !== 'occupation');
      const aiItems   = selected.filter(e => e.enrichType === 'occupation');
      for (const enrich of ruleItems) {
        if (enrich.enrichType === 'region')   ds = applyRegionEnrichment(ds, enrich);
        if (enrich.enrichType === 'cityTier') ds = applyCityTierEnrichment(ds, enrich);
      }
      for (const enrich of aiItems) {
        try {
          const uniqueVals = [...new Set(
            ds.records.map(r => String(r[enrich.field.key] ?? '').trim()).filter(Boolean),
          )];
          const res = await fetch('/api/enrich', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'occupation', values: uniqueVals }),
          });
          if (res.ok) {
            const { mapping } = await res.json() as { mapping: Record<string, string> };
            ds = applyOccupationEnrichment(ds, enrich, mapping);
          }
        } catch { /* AI enrichment failure is non-fatal */ }
      }
      finalizeDataset(ds);
    } finally {
      setUploading(false);
    }
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('zh-CN', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  const SOURCE_COLORS: Record<string, string> = {
    xlsx: 'bg-green-50 text-green-700',
    xls:  'bg-green-50 text-green-700',
    csv:  'bg-blue-50 text-blue-700',
    json: 'bg-orange-50 text-orange-700',
  };

  return (
    <div className="space-y-6">
      {/* ── Dialogs ── */}
      {pendingData && (
        <SchemaDiffDialog
          diff={pendingData.diff}
          datasetName={pendingData.dataset.name}
          onConfirm={confirmUpdate}
          onCancel={() => { setPendingData(null); setUploading(false); }}
        />
      )}
      {pendingEnrich && (
        <EnrichmentDialog
          dataset={pendingEnrich.dataset}
          enrichments={pendingEnrich.enrichments}
          onConfirm={handleEnrichConfirm}
          onCancel={() => { const ds = pendingEnrich.dataset; setPendingEnrich(null); finalizeDataset(ds); }}
        />
      )}

      {/* ── Upload area ── */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          上传新数据集
        </h3>
        <UploadDropzone onFile={handleFile} loading={uploading} />
      </div>

      {/* ── Dataset list ── */}
      {datasets.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            已上传数据集
          </h3>
          <div className="space-y-2">
            {datasets.map(ds => (
              <div
                key={ds.id}
                onClick={() => setActiveDatasetId(ds.id)}
                className={cn(
                  'group flex items-center gap-3 p-3.5 rounded-xl cursor-pointer transition-all border',
                  ds.id === activeDatasetId
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-white border-gray-100 hover:border-blue-200 hover:shadow-sm',
                )}
              >
                <div className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                  ds.id === activeDatasetId ? 'bg-blue-600' : 'bg-gray-100',
                )}>
                  <Database
                    size={15}
                    className={ds.id === activeDatasetId ? 'text-white' : 'text-gray-500'}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800 truncate">{ds.name}</span>
                    <span className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0',
                      SOURCE_COLORS[ds.source] ?? 'bg-gray-100 text-gray-500',
                    )}>
                      {ds.source.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {ds.rowCount.toLocaleString()} 行 · {ds.fields.length} 字段 · {fmtDate(ds.createdAt)}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      if (confirm(`删除「${ds.name}」？此操作不可撤销。`)) removeDataset(ds.id);
                    }}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all"
                  >
                    <Trash2 size={13} />
                  </button>
                  <ChevronRight size={14} className="text-gray-300" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {datasets.length === 0 && !uploading && (
        <div className="text-center py-12 text-gray-300">
          <Database size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">上传数据文件后开始分析</p>
          <p className="text-xs mt-1">支持 Excel (.xlsx/.xls)、CSV、JSON</p>
        </div>
      )}
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────

interface Props {
  dataset?: Dataset;
  onClose:  () => void;
}

export function DataCenterPanel({ dataset, onClose }: Props) {
  const [tab, setTab] = useState<TabId>('data');

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/25 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-5xl bg-gray-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 bg-white border-b border-gray-100 flex-shrink-0">
          <div className="w-7 h-7 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Database size={14} className="text-blue-500" />
          </div>
          <span className="text-sm font-semibold text-gray-800">数据中心</span>
          {dataset && (
            <span className="text-xs text-gray-400 truncate">— {dataset.name}</span>
          )}

          {/* Tabs */}
          <div className="flex items-center gap-0.5 ml-4 overflow-x-auto flex-1">
            {TABS.map(t => {
              const Icon = t.icon;
              const disabled = t.needsDataset && !dataset;
              return (
                <button
                  key={t.id}
                  onClick={() => !disabled && setTab(t.id)}
                  disabled={disabled}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl transition-all whitespace-nowrap flex-shrink-0',
                    disabled
                      ? 'text-gray-300 cursor-not-allowed'
                      : tab === t.id
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700',
                  )}
                >
                  <Icon size={13} />
                  {t.label}
                </button>
              );
            })}
          </div>

          <button
            onClick={onClose}
            className="flex-shrink-0 p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === 'data'    && <DataManagementTab />}
          {tab === 'fields'  && dataset && <FieldList      dataset={dataset} />}
          {tab === 'builder' && dataset && <ChartBuilder   dataset={dataset} />}
          {tab === 'saved'   && dataset && <SavedChartGrid dataset={dataset} />}
          {tab === 'ai'      && dataset && <AIPanel        dataset={dataset} />}
        </div>
      </div>
    </>
  );
}
