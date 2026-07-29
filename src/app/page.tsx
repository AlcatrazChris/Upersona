'use client';

import { useState, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Users, MapPin, GitCompare, Lightbulb, Database, BarChart2, Settings2, Map, Loader2, CloudDownload, Menu, X } from 'lucide-react';
import { useDatasetStore, useActiveDataset } from '@/store/datasetStore';
import { useIsAdmin } from '@/lib/auth';
import { UserSection } from '@/components/auth/UserSection';
import { autoDetectViewConfig } from '@/lib/viewConfig';
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
const PersonaConfigEditor = dynamic(
  () => import('@/components/persona/PersonaConfigEditor').then(module => module.PersonaConfigEditor),
  { loading: ViewLoading },
);

// ── View definitions ──────────────────────────────────────────────

const VIEWS = [
  { id: 'persona',  label: '用户画像', sub: 'Profile',   icon: Users      },
  { id: 'regional', label: '地域对比', sub: 'Compare',   icon: MapPin      },
  { id: 'status',   label: '状态对比', sub: 'Status',    icon: GitCompare  },
  { id: 'insight',  label: '核心洞察', sub: 'Insights',  icon: Lightbulb   },
  { id: 'rfeature', label: '区域特征', sub: 'Features',  icon: Map         },
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

const VIEW_SUBTITLES: Record<ViewId, string> = {
  persona:  '全量及筛选用户的维度分布',
  regional: '按地区对比人群特征差异',
  status:   '不同状态用户的特征对比',
  insight:  '数据驱动的关键洞察与典型人群画像',
  rfeature: '地区 × 画像维度交叉特征表',
};

// ── Empty state ───────────────────────────────────────────────────

function EmptyState({ onOpenDC, isAdmin }: { onOpenDC: () => void; isAdmin: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-5">
        <BarChart2 size={28} className="text-blue-400" />
      </div>
      <h2 className="text-lg font-semibold text-gray-700 mb-2">还没有数据集</h2>
      <p className="text-sm text-gray-400 mb-6 max-w-xs leading-relaxed">
        {isAdmin
          ? '在数据中心上传 Excel / CSV 文件，或从云端选择已有数据集'
          : '从云端选择一个已有数据集开始分析'}
      </p>
      <div className="flex items-center gap-3">
        <CloudDatasetSelector />
        {isAdmin && (
          <button
            onClick={onOpenDC}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-all shadow-sm"
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
  const [personaConfig, setPersonaConfig] = useState(false);
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
    setPersonaConfig(false);
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

    // 已有配置：仅补充"字段概览里有但 personaFieldKeys 里没有"的字段
    // 不删除用户手动移除的字段，不重置其他配置项
    const storedSet = new Set(stored.personaFieldKeys ?? []);
    const missing   = (detected.personaFieldKeys ?? []).filter(k => !storedSet.has(k));
    if (!stored.personaFieldKeys || missing.length > 0) {
      updateViewConfig(dataset.id, {
        personaFieldKeys: [...(stored.personaFieldKeys ?? []), ...missing],
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset?.id]);

  const viewConfig = useMemo(
    () => dataset
      ? { ...autoDetectViewConfig(dataset), ...(viewConfigs[dataset.id] ?? {}) }
      : null,
    [dataset, viewConfigs],
  );

  return (
    <div className="flex min-h-dvh bg-slate-100 md:h-dvh md:overflow-hidden">

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
          'fixed inset-y-0 left-0 z-40 flex w-[200px] flex-shrink-0 flex-col overflow-hidden transition-transform md:static md:translate-x-0',
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        style={{ background: '#0f1923' }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-4 py-[18px] border-b border-white/5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0 shadow-md">
            <svg viewBox="0 0 24 24" fill="white" className="w-[18px] h-[18px]" aria-hidden="true">
              <rect x="3"  y="3"  width="7" height="7" rx="1.5" />
              <rect x="14" y="3"  width="7" height="7" rx="1.5" />
              <rect x="3"  y="14" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-white leading-tight tracking-tight">
              Upersona
            </div>
            <div className="text-[10px] leading-tight mt-0.5" style={{ color: '#4a6080' }}>
              用户画像平台
            </div>
          </div>
          <button
            type="button"
            aria-label="关闭导航"
            className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white md:hidden"
            onClick={() => setMobileNavOpen(false)}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Nav tabs */}
        <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto">
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
                  'w-full flex items-center gap-3 px-3 py-[9px] rounded-xl transition-all text-left',
                  disabled
                    ? 'opacity-25 cursor-not-allowed'
                    : active
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
                )}
              >
                <Icon size={17} className="flex-shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="text-[12.5px] font-medium leading-tight">{v.label}</div>
                  <div
                    className="mt-0.5 text-xs leading-tight"
                    style={{ color: active ? 'rgba(239,246,255,0.82)' : '#8294aa' }}
                  >
                    {v.sub}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Bottom — data center (admin only) + user section */}
        <div className="flex flex-col">
          {isAdmin && (
            <div
              className="px-2.5 pt-2 pb-1 space-y-0.5"
              style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
            >
              <button
                type="button"
                onMouseEnter={() => void import('@/components/views/DataCenterPanel')}
                onFocus={() => void import('@/components/views/DataCenterPanel')}
                onClick={() => setDcOpen(true)}
                className="w-full flex items-center gap-3 px-3 py-[9px] rounded-xl text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-all text-left"
              >
                <Database size={17} className="flex-shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="text-[12.5px] font-medium leading-tight">数据中心</div>
                  <div className="mt-0.5 text-xs leading-tight" style={{ color: '#8294aa' }}>
                    Management
                  </div>
                </div>
              </button>
            </div>
          )}
          <div className="px-2.5 pb-2 pt-1">
            <UserSection />
          </div>
        </div>
      </aside>

      {/* ══ Main ═══════════════════════════════════════════════════ */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

        {/* Top bar */}
        <header className="flex min-h-14 flex-shrink-0 flex-wrap items-center gap-3 border-b border-gray-100/80 bg-white px-3 py-2 md:px-6">
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
                <h1 className="truncate text-[15px] font-semibold leading-tight text-gray-900">
                  {VIEWS.find(v => v.id === view)?.label}
                </h1>
                <div className="mt-0.5 hidden truncate text-xs leading-tight text-gray-500 sm:block">
                  {VIEW_SUBTITLES[view]}
                </div>
              </>
            ) : (
              <h1 className="text-sm font-medium text-gray-500">选择或上传数据集后开始分析</h1>
            )}
          </div>

          {/* 云端同步状态指示器 */}
          {cloudSyncing && !dataset && (
            <div className="flex flex-shrink-0 items-center gap-1.5 text-xs text-indigo-600" aria-live="polite">
              <Loader2 size={12} className="animate-spin" aria-hidden="true" />
              <span>正在同步云端数据…</span>
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
              {/* 配置画像 — admin only, persona / insight view */}
              {(view === 'persona' || view === 'insight') && isAdmin && (
                <button
                  onClick={() => setPersonaConfig(true)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-violet-600 text-white hover:bg-violet-700 transition-all shadow-sm font-medium"
                >
                  <Settings2 size={12} aria-hidden="true" />
                  配置画像
                </button>
              )}
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
        <main id="main-content" className="flex-1 overflow-y-auto overflow-x-hidden" tabIndex={-1}>
          {/* Persona config editor — full-content takeover when open */}
          {personaConfig && dataset ? (
            <div className="mx-auto max-w-7xl px-3 py-4 md:px-6 md:py-5">
              <PersonaConfigEditor
                dataset={dataset}
                onClose={() => setPersonaConfig(false)}
              />
            </div>
          ) : !dataset || !viewConfig ? (
            <EmptyState onOpenDC={() => setDcOpen(true)} isAdmin={isAdmin} />
          ) : (
            <div className="mx-auto max-w-7xl px-3 py-4 md:px-6 md:py-5">
              {view === 'persona'  && (
                <PersonaView
                  dataset={dataset}
                  viewConfig={viewConfig}
                  onConfig={() => setPersonaConfig(true)}
                />
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
