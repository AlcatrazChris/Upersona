'use client';

import { useState, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { Users, MapPin, GitCompare, Lightbulb, Database, Map, Loader2, CloudDownload, Menu, X } from 'lucide-react';
import { useDatasetStore, useActiveDataset } from '@/store/datasetStore';
import { useIsAdmin } from '@/lib/auth';
import { UserSection } from '@/components/auth/UserSection';
import { autoDetectViewConfig, normalizeViewConfig } from '@/lib/viewConfig';
import { useAutoSyncCloud }  from '@/hooks/useAutoSyncCloud';
import { useConfigAutoSync } from '@/hooks/useConfigAutoSync';
import { CloudDatasetSelector } from '@/components/shared/CloudDatasetSelector';
import { cn } from '@/lib/utils';

function ViewLoading() {
  return (
    <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-gray-500" role="status">
      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
      正在加载视图…
    </div>
  );
}

const PersonaView = dynamic(
  () => import('@/components/views/PersonaView').then(module => module.PersonaView),
  { loading: ViewLoading },
);
const RegionalView = dynamic(
  () => import('@/components/views/RegionalView').then(module => module.RegionalView),
  { loading: ViewLoading },
);
const StatusView = dynamic(
  () => import('@/components/views/StatusView').then(module => module.StatusView),
  { loading: ViewLoading },
);
const InsightView = dynamic(
  () => import('@/components/views/InsightView').then(module => module.InsightView),
  { loading: ViewLoading },
);
const RegionalFeatureView = dynamic(
  () => import('@/components/views/RegionalFeatureView').then(module => module.RegionalFeatureView),
  { loading: ViewLoading },
);
const DataCenterPanel = dynamic(
  () => import('@/components/views/DataCenterPanel').then(module => module.DataCenterPanel),
  { loading: ViewLoading },
);

// ── View definitions ──────────────────────────────────────────────

const VIEWS = [
  { id: 'persona',  label: '用户画像', icon: Users      },
  { id: 'regional', label: '地域对比', icon: MapPin     },
  { id: 'status',   label: '状态对比', icon: GitCompare },
  { id: 'insight',  label: '核心洞察', icon: Lightbulb  },
  { id: 'rfeature', label: '区域特征', icon: Map        },
] as const;
type ViewId = typeof VIEWS[number]['id'];
const VIEW_IDS = new Set<ViewId>(VIEWS.map(view => view.id));

const VIEW_IMPORTS: Record<ViewId, () => Promise<unknown>> = {
  persona: () => import('@/components/views/PersonaView'),
  regional: () => import('@/components/views/RegionalView'),
  status: () => import('@/components/views/StatusView'),
  insight: () => import('@/components/views/InsightView'),
  rfeature: () => import('@/components/views/RegionalFeatureView'),
};

// ── Empty state ───────────────────────────────────────────────────

function EmptyState({ onOpenDC, isAdmin }: { onOpenDC: () => void; isAdmin: boolean }) {
  return (
    <div className="flex h-full -translate-y-8 flex-col items-center justify-center px-8 text-center sm:-translate-y-12">
      <Database size={28} strokeWidth={1.5} className="mb-4 text-[#AEAEB2]" />
      <h2 className="mb-6 text-lg font-semibold text-[#1D1D1F]">暂无数据集</h2>
      <div className="flex items-center gap-3">
        <CloudDatasetSelector />
        {isAdmin && (
          <button
            onClick={onOpenDC}
            className="flex h-11 items-center gap-2 rounded-xl bg-[#007AFF] px-5 text-sm font-medium text-white transition-colors hover:bg-[#0066D6]"
          >
            <Database size={15} />
            打开数据中心
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────

export default function MainPage() {
  const viewConfigs = useDatasetStore(state => state.viewConfigs);
  const updateViewConfig = useDatasetStore(state => state.updateViewConfig);
  const dataset  = useActiveDataset();
  const isAdmin  = useIsAdmin();
  const [view,         setView]         = useState<ViewId>('persona');
  const [dcOpen,       setDcOpen]       = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // 自动拉取最新云端数据集（对 viewer 透明）
  const { syncing: cloudSyncing, syncedName } = useAutoSyncCloud();
  // 配置变更后自动同步到云端（仅 supabase 来源数据集）
  useConfigAutoSync(dataset);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('view') as ViewId | null;
    if (requested && VIEW_IDS.has(requested)) setView(requested);
  }, []);

  function selectView(nextView: ViewId) {
    setView(nextView);
    setMobileNavOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.set('view', nextView);
    window.history.replaceState(null, '', url);
  }

  useEffect(() => {
    if (!dataset) return;
    const stored   = viewConfigs[dataset.id];
    const detected = autoDetectViewConfig(dataset);

    if (!stored) {
      // 全新数据集：直接写入自动识别结果
      updateViewConfig(dataset.id, detected);
      return;
    }

    // 画像模板是唯一配置来源。仅在从未初始化时写入默认值，
    // 不自动补回用户在数据中心明确移除的字段。
    if (!stored.personaFieldKeys) {
      updateViewConfig(dataset.id, { personaFieldKeys: detected.personaFieldKeys });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset?.id]);

  const viewConfig = useMemo(
    () => dataset
      ? normalizeViewConfig(dataset, { ...autoDetectViewConfig(dataset), ...(viewConfigs[dataset.id] ?? {}) })
      : null,
    [dataset, viewConfigs],
  );

  return (
    <div className="flex min-h-dvh bg-[#F5F5F7] md:h-dvh md:overflow-hidden">

      {mobileNavOpen && (
        <button
          type="button"
          aria-label="关闭导航"
          className="fixed inset-0 z-30 bg-black/35 md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* ══ Sidebar ════════════════════════════════════════════════ */}
      <aside
        aria-label="主要导航"
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[232px] flex-shrink-0 flex-col overflow-hidden border-r border-black/[0.06] bg-white transition-transform md:static md:translate-x-0',
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Brand */}
        <div className="flex h-20 items-center gap-3 px-5">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white">
            <Image src="/icon02.png" alt="" width={32} height={32} className="h-8 w-8 object-contain" priority />
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-semibold leading-tight tracking-[-0.02em] text-[#1D1D1F]">
              Upersona
            </div>
          </div>
          <button
            type="button"
            aria-label="关闭导航"
            className="ml-auto rounded-lg p-1.5 text-[#86868B] hover:bg-black/[0.04] hover:text-[#1D1D1F] md:hidden"
            onClick={() => setMobileNavOpen(false)}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Nav tabs */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
          {VIEWS.map(v => {
            const Icon = v.icon;
            const active   = view === v.id;
            const disabled = !dataset;
            return (
              <button
                key={v.id}
                onMouseEnter={() => void VIEW_IMPORTS[v.id]()}
                onFocus={() => void VIEW_IMPORTS[v.id]()}
                onClick={() => !disabled && selectView(v.id)}
                disabled={disabled}
                aria-current={active ? 'page' : undefined}
                title={disabled ? '请先选择数据集' : v.label}
                className={cn(
                  'flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm transition-colors',
                  disabled
                    ? 'cursor-not-allowed opacity-45'
                    : active
                      ? 'bg-[#007AFF]/[0.08] text-[#007AFF]'
                      : 'text-[#515154] hover:bg-black/[0.04] hover:text-[#1D1D1F]',
                )}
              >
                <Icon size={17} className="flex-shrink-0" aria-hidden="true" />
                <span className="truncate font-medium">{v.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom — data center (admin only) + user section */}
        <div className="flex flex-col">
          {isAdmin && (
            <div
              className="mx-3 border-t border-black/[0.06] pb-1 pt-3"
            >
              <button
                type="button"
                onMouseEnter={() => void import('@/components/views/DataCenterPanel')}
                onFocus={() => void import('@/components/views/DataCenterPanel')}
                onClick={() => setDcOpen(true)}
                className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-[#515154] transition-colors hover:bg-black/[0.04] hover:text-[#1D1D1F]"
              >
                <Database size={17} className="flex-shrink-0" aria-hidden="true" />
                <span>数据中心</span>
              </button>
            </div>
          )}
          <div className="px-3 pb-3 pt-1">
            <UserSection />
          </div>
        </div>
      </aside>

      {/* ══ Main ═══════════════════════════════════════════════════ */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

        {/* Top bar */}
        <header className="flex min-h-20 flex-shrink-0 flex-wrap items-center gap-4 border-b border-black/[0.06] bg-white px-4 py-3 md:px-8">
          <button
            type="button"
            aria-label="打开导航"
            aria-expanded={mobileNavOpen}
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 md:hidden"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu size={19} aria-hidden="true" />
          </button>
          <div className="flex-1 min-w-0">
            {dataset ? (
              <>
                <h1 className="truncate text-[28px] font-medium leading-tight tracking-[-0.03em] text-[#1D1D1F]">
                  {VIEWS.find(v => v.id === view)?.label}
                </h1>
              </>
            ) : (
              <h1 className="text-[28px] font-medium tracking-[-0.03em] text-[#1D1D1F]">暂无数据集</h1>
            )}
          </div>

          {/* 云端同步状态指示器 */}
          {cloudSyncing && !dataset && (
            <div className="flex flex-shrink-0 items-center gap-1.5 text-xs text-indigo-600" aria-live="polite">
              <Loader2 size={12} className="animate-spin" aria-hidden="true" />
              <span className="hidden sm:inline">正在同步云端数据…</span>
            </div>
          )}
          {syncedName && (
            <div className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700" aria-live="polite">
              <CloudDownload size={11} aria-hidden="true" />
              <span>已同步：{syncedName}</span>
            </div>
          )}

          {dataset && (
            <div className="flex min-w-0 items-center gap-2 sm:flex-shrink-0">
              <div className="flex min-w-0 items-center gap-2 text-xs text-gray-500">
                <CloudDatasetSelector currentDataset={dataset} />
                <span className="hidden whitespace-nowrap lg:inline">{dataset.rowCount.toLocaleString()} 条数据</span>
                <span className="hidden text-gray-300 lg:inline">·</span>
                <span className="hidden whitespace-nowrap lg:inline">{dataset.fields.length} 字段</span>
              </div>
              {/* 云端实时同步中（数据集已显示但刷新中） */}
              {cloudSyncing && (
                <span title="正在检查云端更新…">
                  <Loader2 size={11} className="animate-spin text-indigo-500 flex-shrink-0" aria-hidden="true" />
                </span>
              )}
            </div>
          )}
        </header>

        {/* Scrollable content */}
        <main id="main-content" className="product-surface flex-1 overflow-y-auto overflow-x-hidden" tabIndex={-1}>
          {!dataset || !viewConfig ? (
            <EmptyState onOpenDC={() => setDcOpen(true)} isAdmin={isAdmin} />
          ) : (
            <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-8 md:py-8">
              {view === 'persona'  && (
                <PersonaView dataset={dataset} viewConfig={viewConfig} />
              )}
              {view === 'regional'  && <RegionalView        dataset={dataset} viewConfig={viewConfig} />}
              {view === 'status'    && (
                <StatusView
                  dataset={dataset}
                  viewConfig={viewConfig}
                  onOpenDataCenter={() => setDcOpen(true)}
                />
              )}
              {view === 'insight'   && <InsightView         dataset={dataset} viewConfig={viewConfig} />}
              {view === 'rfeature'  && <RegionalFeatureView dataset={dataset} viewConfig={viewConfig} />}
            </div>
          )}
        </main>
      </div>

      {/* Data center panel */}
      {dcOpen && <DataCenterPanel dataset={dataset} onClose={() => setDcOpen(false)} />}
    </div>
  );
}
