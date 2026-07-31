'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, Table2, BarChart2, Bookmark, Sparkles, UserRoundSearch,
  Database, Trash2, ChevronRight, CloudUpload, CalendarRange,
  Cloud, RefreshCw, Loader2, HardDrive,
} from 'lucide-react';
import { FieldList }         from '@/components/fields/FieldList';
import { ChartBuilder }      from '@/components/charts/ChartBuilder';
import { SavedChartGrid }    from '@/components/charts/SavedChartGrid';
import { AIPanel }           from '@/components/ai/AIPanel';
import { PersonaTemplatePanel } from '@/components/persona/PersonaTemplatePanel';
import { DateBlockEditor } from '@/components/views/DateBlockEditor';
import { UploadDropzone }    from '@/components/upload/UploadDropzone';
import { SchemaDiffDialog }  from '@/components/upload/SchemaDiffDialog';
import { EnrichmentDialog }  from '@/components/upload/EnrichmentDialog';
import { PushToDBDialog }    from '@/components/upload/PushToDBDialog';
import { useDatasetStore, useDatasetList } from '@/store/datasetStore';
import { useIsAdmin }        from '@/lib/auth';
import { compareSchemas }    from '@/lib/schemaDetector';
import {
  detectEnrichable, applyRegionEnrichment,
  applyCityTierEnrichment, applyOccupationEnrichment,
} from '@/lib/fieldEnricher';
import { cn } from '@/lib/utils';
import { useModalA11y } from '@/hooks/useModalA11y';
import type { Dataset, Field, FieldDiff } from '@/types/dataSchema';
import type { EnrichableField }           from '@/lib/fieldEnricher';

// ── Tabs ──────────────────────────────────────────────────────────

const TABS = [
  { id: 'data',    label: '数据管理', icon: Database,  needsDataset: false },
  { id: 'fields',  label: '字段概览', icon: Table2,    needsDataset: true  },
  { id: 'dates',   label: '时间分块', icon: CalendarRange, needsDataset: true },
  { id: 'persona', label: '画像模板', icon: UserRoundSearch, needsDataset: true },
  { id: 'builder', label: '图表构建', icon: BarChart2, needsDataset: true  },
  { id: 'saved',   label: '图表浏览', icon: Bookmark,  needsDataset: true  },
  { id: 'ai',      label: 'AI 分析',  icon: Sparkles,  needsDataset: true  },
] as const;
type TabId = typeof TABS[number]['id'];

// ── 云端数据集元信息 ──────────────────────────────────────────────

interface DBDatasetMeta {
  id:           string;
  name:         string;
  source_type:  string;
  row_count:    number;
  fields:       Field[];
  created_at:   string;
  uploaded_by:  string | null;
}

// ── Source badge ──────────────────────────────────────────────────

const SOURCE_COLORS: Record<string, string> = {
  xlsx:     'bg-green-50 text-green-700',
  xls:      'bg-green-50 text-green-700',
  csv:      'bg-blue-50 text-blue-700',
  json:     'bg-orange-50 text-orange-700',
  supabase: 'bg-violet-50 text-violet-700',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-CN', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ── DataManagementTab ─────────────────────────────────────────────

function DataManagementTab() {
  const {
    addDataset, removeDataset, setActiveDatasetId, getDataset,
    activeDatasetId, updateDataset, viewConfigs, personaConfigs,
    savedCharts, canvasElements,
  } = useDatasetStore();
  const datasets  = useDatasetList();
  const isAdmin   = useIsAdmin();

  // Local upload state
  const [uploading,     setUploading]     = useState(false);
  const [uploadStatus,  setUploadStatus]  = useState('');
  const [uploadError,   setUploadError]   = useState('');
  const cancelParseRef = useRef<(() => void) | null>(null);
  const [pendingData,   setPendingData]   =
    useState<{ dataset: Dataset; diff: FieldDiff; targetId: string } | null>(null);
  const [pendingEnrich, setPendingEnrich] =
    useState<{ dataset: Dataset; enrichments: EnrichableField[] } | null>(null);

  // Push-to-DB state
  const [pushingDs,     setPushingDs]     = useState<Dataset | null>(null);

  // Cloud datasets state
  const [dbDatasets,    setDbDatasets]    = useState<DBDatasetMeta[]>([]);
  const [dbLoading,     setDbLoading]     = useState(false);
  const [dbError,       setDbError]       = useState('');
  const [loadingId,     setLoadingId]     = useState<string | null>(null);

  // ── Fetch DB dataset list ────────────────────────────────────

  const fetchDBDatasets = useCallback(async () => {
    setDbLoading(true);
    setDbError('');
    try {
      const res = await fetch('/api/datasets');
      if (!res.ok) {
        if (res.status === 401) { setDbError('未登录，无法拉取云端数据集'); return; }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json() as DBDatasetMeta[];
      setDbDatasets(data);
    } catch (e) {
      setDbError(e instanceof Error ? e.message : '拉取失败');
    } finally {
      setDbLoading(false);
    }
  }, []);

  useEffect(() => { fetchDBDatasets(); }, [fetchDBDatasets]);

  // ── Local upload flow ────────────────────────────────────────

  function finalizeDataset(ds: Dataset) { addDataset(ds); }

  function parseInWorker(buffer: ArrayBuffer, filename: string): Promise<Dataset> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(
        new URL('../../workers/dataParser.worker.ts', import.meta.url),
      );
      const finish = () => {
        worker.terminate();
        cancelParseRef.current = null;
      };
      cancelParseRef.current = () => {
        finish();
        reject(new DOMException('用户取消了文件处理', 'AbortError'));
      };
      worker.onmessage = (event: MessageEvent<{ dataset?: Dataset; error?: string }>) => {
        finish();
        if (event.data.error) reject(new Error(event.data.error));
        else if (event.data.dataset) resolve(event.data.dataset);
        else reject(new Error('解析器未返回有效数据'));
      };
      worker.onerror = event => {
        finish();
        reject(new Error(event.message || '文件解析失败'));
      };
      worker.postMessage({ buffer, filename }, [buffer]);
    });
  }

  async function handleFile(file: File) {
    setUploading(true);
    setUploadError('');
    try {
      setUploadStatus('正在读取文件…');
      const buffer = await file.arrayBuffer();
      setUploadStatus('正在后台解析，页面仍可正常操作…');
      const newDs = await parseInWorker(buffer, file.name);

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
      if ((e as Error).name !== 'AbortError') {
        setUploadError(`上传失败：${(e as Error).message}`);
      }
    } finally {
      setUploading(false);
      setUploadStatus('');
    }
  }

  function cancelUpload() {
    cancelParseRef.current?.();
    cancelParseRef.current = null;
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

  // ── Load DB dataset into local store ─────────────────────────

  async function handleLoadDB(meta: DBDatasetMeta) {
    // Already loaded locally?
    const existing = datasets.find(d => d.id === meta.id);
    if (existing) { setActiveDatasetId(existing.id); return; }

    setLoadingId(meta.id);
    try {
      const res = await fetch(`/api/datasets/${meta.id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { dataset: ds } = await res.json() as { dataset: Dataset };
      addDataset(ds);
    } catch (e) {
      alert(`加载失败: ${(e as Error).message}`);
    } finally {
      setLoadingId(null);
    }
  }

  // ── Delete DB dataset ─────────────────────────────────────────

  async function handleDeleteDB(meta: DBDatasetMeta) {
    if (!confirm(`彻底删除云端数据集「${meta.name}」？此操作不可撤销。`)) return;
    try {
      const res = await fetch(`/api/datasets/${meta.id}?hard=1`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDbDatasets(prev => prev.filter(d => d.id !== meta.id));
      // Also remove from local store if loaded
      removeDataset(meta.id);
    } catch (e) {
      alert(`删除失败: ${(e as Error).message}`);
    }
  }

  // ── Push success ──────────────────────────────────────────────

  function handlePushSuccess(datasetId: string) {
    setPushingDs(null);
    // Mark local dataset as supabase-sourced
    updateDataset(datasetId, { source: 'supabase' });
    // Refresh cloud list
    fetchDBDatasets();
  }

  // ── UI helpers ────────────────────────────────────────────────

  const isLoadedLocally = (id: string) => datasets.some(d => d.id === id);

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
      {pushingDs && (
        <PushToDBDialog
          dataset={pushingDs}
          viewConfig={viewConfigs[pushingDs.id]}
          personaConfigs={personaConfigs[pushingDs.id]}
          savedCharts={savedCharts[pushingDs.id]}
          canvasElements={canvasElements[pushingDs.id]}
          onClose={() => setPushingDs(null)}
          onSuccess={handlePushSuccess}
        />
      )}

      {/* ── Upload area ── */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          上传新数据集
        </h3>
        <UploadDropzone
          onFile={handleFile}
          loading={uploading}
          status={uploadStatus}
          onCancel={uploading ? cancelUpload : undefined}
        />
        {uploadError && (
          <div
            role="alert"
            aria-live="assertive"
            className="mt-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700"
          >
            {uploadError}
          </div>
        )}
      </div>

      {/* ── Local datasets ── */}
      {datasets.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
              <HardDrive size={11} />
              本地数据集
            </h3>
            <span className="text-[10px] text-gray-400">{datasets.length} 个</span>
          </div>
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
                      {ds.source === 'supabase' ? '已同步' : ds.source.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {ds.rowCount.toLocaleString()} 行 · {ds.fields.length} 字段 · {fmtDate(ds.createdAt)}
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  {/* Push / re-sync to DB (admin only) */}
                  {isAdmin && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        const full = getDataset(ds.id);
                        if (full) setPushingDs(full);
                      }}
                      aria-label={ds.source === 'supabase' ? `同步数据集 ${ds.name}` : `推送数据集 ${ds.name}`}
                      title={ds.source === 'supabase' ? '同步最新修改到 Supabase（覆盖）' : '推送到 Supabase 数据库'}
                      className={cn(
                        'flex items-center gap-1 p-1.5 rounded-lg transition-all',
                        ds.source === 'supabase'
                          ? 'text-gray-300 hover:bg-emerald-50 hover:text-emerald-600'
                          : 'text-gray-300 hover:bg-blue-50 hover:text-blue-500',
                      )}
                    >
                      {ds.source === 'supabase'
                        ? <RefreshCw size={13} />
                        : <CloudUpload size={13} />
                      }
                    </button>
                  )}
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      if (confirm(`删除本地「${ds.name}」？`)) removeDataset(ds.id);
                    }}
                    aria-label={`删除本地数据集 ${ds.name}`}
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
        <div className="text-center py-8 text-gray-300">
          <HardDrive size={28} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">上传数据文件后开始分析</p>
          <p className="text-xs mt-1">支持 Excel (.xlsx/.xls)、CSV、JSON</p>
        </div>
      )}

      {/* ── Cloud datasets (Supabase) ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
            <Cloud size={11} />
            云端数据集（Supabase）
          </h3>
          <button
            onClick={fetchDBDatasets}
            disabled={dbLoading}
            className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 transition-all disabled:opacity-40"
          >
            <RefreshCw size={10} className={dbLoading ? 'animate-spin' : ''} />
            刷新
          </button>
        </div>

        {dbLoading && (
          <div className="flex items-center justify-center py-6 text-gray-400 gap-2">
            <Loader2 size={14} className="animate-spin" />
            <span className="text-xs">正在拉取…</span>
          </div>
        )}

        {dbError && !dbLoading && (
          <div className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            {dbError}
          </div>
        )}

        {!dbLoading && !dbError && dbDatasets.length === 0 && (
          <div className="text-center py-8 text-gray-300">
            <Cloud size={28} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">暂无云端数据集</p>
            {isAdmin && (
              <p className="text-xs mt-1">在本地数据集上点击 <CloudUpload size={10} className="inline" /> 推送到 Supabase</p>
            )}
          </div>
        )}

        {!dbLoading && dbDatasets.length > 0 && (
          <div className="space-y-2">
            {dbDatasets.map(meta => {
              const loaded   = isLoadedLocally(meta.id);
              const isActive = activeDatasetId === meta.id;
              const isLoading = loadingId === meta.id;
              return (
                <div
                  key={meta.id}
                  className={cn(
                    'group flex items-center gap-3 p-3.5 rounded-xl border transition-all',
                    isActive
                      ? 'bg-violet-50 border-violet-200'
                      : 'bg-white border-gray-100 hover:border-violet-200 hover:shadow-sm',
                  )}
                >
                  <div className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                    isActive ? 'bg-violet-600' : 'bg-violet-50',
                  )}>
                    <Cloud size={15} className={isActive ? 'text-white' : 'text-violet-400'} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800 truncate">{meta.name}</span>
                      {loaded && !isActive && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 font-medium flex-shrink-0">
                          已加载
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {meta.row_count.toLocaleString()} 行 · {meta.fields.length} 字段
                      {meta.uploaded_by && ` · 由 ${meta.uploaded_by} 上传`}
                      {' · '}{fmtDate(meta.created_at)}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Load button */}
                    <button
                      onClick={() => handleLoadDB(meta)}
                      disabled={isLoading}
                      className={cn(
                        'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all font-medium',
                        isActive
                          ? 'bg-violet-100 text-violet-700 cursor-default'
                          : loaded
                            ? 'bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600'
                            : 'bg-violet-100 text-violet-700 hover:bg-violet-200',
                        isLoading && 'opacity-60 cursor-wait',
                      )}
                    >
                      {isLoading
                        ? <Loader2 size={11} className="animate-spin" />
                        : isActive
                          ? <><Database size={11} />使用中</>
                          : loaded
                            ? <><ChevronRight size={11} />切换</>
                            : <><CloudUpload size={11} className="rotate-180" />加载</>
                      }
                    </button>

                    {/* Delete (admin) */}
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteDB(meta)}
                        aria-label={`删除云端数据集 ${meta.name}`}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/25 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="data-center-title"
        tabIndex={-1}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-5xl flex-col overflow-hidden overscroll-contain bg-gray-50 shadow-2xl"
      >

        {/* Header */}
        <div className="flex items-center gap-2 border-b border-gray-100 bg-white px-3 py-3 sm:gap-3 sm:px-6 sm:py-4">
          <div className="hidden h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 sm:flex">
            <Database size={14} className="text-blue-500" />
          </div>
          <h2 id="data-center-title" className="text-sm font-semibold text-gray-800">数据中心</h2>
          {dataset && (
            <span className="hidden truncate text-xs text-gray-500 lg:inline">— {dataset.name}</span>
          )}

          {/* Tabs */}
          <div className="ml-1 flex flex-1 items-center gap-0.5 overflow-x-auto sm:ml-4">
            {TABS.map(t => {
              const Icon     = t.icon;
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
            aria-label="关闭数据中心"
            className="flex-shrink-0 p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-5">
          {tab === 'data'    && <DataManagementTab />}
          {tab === 'fields'  && dataset && <FieldList      dataset={dataset} />}
          {tab === 'dates'   && dataset && <DateBlockEditor dataset={dataset} />}
          {tab === 'persona' && dataset && <PersonaTemplatePanel dataset={dataset} />}
          {tab === 'builder' && dataset && <ChartBuilder   dataset={dataset} />}
          {tab === 'saved'   && dataset && <SavedChartGrid dataset={dataset} />}
          {tab === 'ai'      && dataset && <AIPanel        dataset={dataset} />}
        </div>
      </div>
    </>
  );
}
