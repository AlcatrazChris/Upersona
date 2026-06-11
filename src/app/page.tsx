'use client';

import { useState, useMemo, useEffect } from 'react';
import { Users, MapPin, GitCompare, Lightbulb, Database, BarChart2, Settings2, Map, Loader2, CloudDownload } from 'lucide-react';
import { useDatasetStore, useActiveDataset } from '@/store/datasetStore';
import { useIsAdmin } from '@/lib/auth';
import { UserSection } from '@/components/auth/UserSection';
import { autoDetectViewConfig } from '@/lib/viewConfig';
import { useAutoSyncCloud }  from '@/hooks/useAutoSyncCloud';
import { useConfigAutoSync } from '@/hooks/useConfigAutoSync';
import { PersonaView }          from '@/components/views/PersonaView';
import { RegionalView }         from '@/components/views/RegionalView';
import { StatusView }           from '@/components/views/StatusView';
import { InsightView }          from '@/components/views/InsightView';
import { RegionalFeatureView }  from '@/components/views/RegionalFeatureView';
import { DataCenterPanel }      from '@/components/views/DataCenterPanel';
import { PersonaConfigEditor } from '@/components/persona/PersonaConfigEditor';
import { cn } from '@/lib/utils';

// ── View definitions ──────────────────────────────────────────────

const VIEWS = [
  { id: 'persona',  label: '用户画像', sub: 'Profile',   icon: Users      },
  { id: 'regional', label: '地域对比', sub: 'Compare',   icon: MapPin      },
  { id: 'status',   label: '状态对比', sub: 'Status',    icon: GitCompare  },
  { id: 'insight',  label: '核心洞察', sub: 'Insights',  icon: Lightbulb   },
  { id: 'rfeature', label: '区域特征', sub: 'Features',  icon: Map         },
] as const;
type ViewId = typeof VIEWS[number]['id'];

const VIEW_SUBTITLES: Record<ViewId, string> = {
  persona:  '全量及筛选用户的维度分布',
  regional: '按地区对比人群特征差异',
  status:   '不同状态用户的特征对比',
  insight:  '数据驱动的关键洞察',
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
      {isAdmin ? (
        <>
          <p className="text-sm text-gray-400 mb-6 max-w-xs leading-relaxed">
            在数据中心上传 Excel / CSV 文件，即可自动识别字段并开始画像分析
          </p>
          <button
            onClick={onOpenDC}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-all shadow-sm"
          >
            <Database size={15} />
            打开数据中心
          </button>
        </>
      ) : (
        <p className="text-sm text-gray-400 max-w-xs leading-relaxed">
          当前暂无可用数据，请联系管理员上传数据集后刷新页面
        </p>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────

export default function MainPage() {
  const { viewConfigs, updateViewConfig } = useDatasetStore();
  const dataset  = useActiveDataset();
  const isAdmin  = useIsAdmin();
  const [view,         setView]         = useState<ViewId>('persona');
  const [dcOpen,       setDcOpen]       = useState(false);
  const [personaConfig, setPersonaConfig] = useState(false);

  // 自动拉取最新云端数据集（对 viewer 透明）
  const { syncing: cloudSyncing, syncedName } = useAutoSyncCloud();
  // 配置变更后自动同步到云端（仅 supabase 来源数据集）
  useConfigAutoSync(dataset);

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
    <div className="flex h-screen overflow-hidden bg-slate-100">

      {/* ══ Sidebar ════════════════════════════════════════════════ */}
      <aside
        className="flex-shrink-0 w-[200px] flex flex-col overflow-hidden z-20"
        style={{ background: '#0f1923' }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-4 py-[18px] border-b border-white/5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0 shadow-md">
            <svg viewBox="0 0 24 24" fill="white" className="w-[18px] h-[18px]">
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
                onClick={() => !disabled && setView(v.id)}
                disabled={disabled}
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
                <Icon size={17} className="flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-[12.5px] font-medium leading-tight">{v.label}</div>
                  <div
                    className="text-[10px] leading-tight mt-0.5"
                    style={{ color: active ? 'rgba(219,234,254,0.6)' : '#3d5066' }}
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
                onClick={() => setDcOpen(true)}
                className="w-full flex items-center gap-3 px-3 py-[9px] rounded-xl text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-all text-left"
              >
                <Database size={17} className="flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-[12.5px] font-medium leading-tight">数据中心</div>
                  <div className="text-[10px] leading-tight mt-0.5" style={{ color: '#3d5066' }}>
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
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Top bar */}
        <div className="flex-shrink-0 h-14 bg-white border-b border-gray-100/80 flex items-center px-6 gap-5">
          <div className="flex-1 min-w-0">
            {dataset ? (
              <>
                <div className="text-[15px] font-semibold text-gray-900 leading-tight">
                  {VIEWS.find(v => v.id === view)?.label}
                </div>
                <div className="text-[11px] text-gray-400 leading-tight mt-0.5">
                  {VIEW_SUBTITLES[view]}
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-400">选择或上传数据集后开始分析</div>
            )}
          </div>

          {/* 云端同步状态指示器 */}
          {cloudSyncing && !dataset && (
            <div className="flex items-center gap-1.5 text-xs text-indigo-500 flex-shrink-0">
              <Loader2 size={12} className="animate-spin" />
              <span>正在同步云端数据…</span>
            </div>
          )}
          {syncedName && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg flex-shrink-0">
              <CloudDownload size={11} />
              <span>已同步：{syncedName}</span>
            </div>
          )}

          {dataset && (
            <div className="flex items-center gap-2.5 flex-shrink-0">
              {/* 配置画像 — admin only, persona view only */}
              {view === 'persona' && isAdmin && (
                <button
                  onClick={() => setPersonaConfig(true)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-violet-600 text-white hover:bg-violet-700 transition-all shadow-sm font-medium"
                >
                  <Settings2 size={12} />
                  配置画像
                </button>
              )}
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-blue-600 font-medium"
                  style={{ background: '#eff6ff' }}
                >
                  <Database size={11} />
                  {dataset.name}
                </span>
                <span>{dataset.rowCount.toLocaleString()} 条数据</span>
                <span className="text-gray-200">·</span>
                <span>{dataset.fields.length} 字段</span>
              </div>
              {/* 云端实时同步中（数据集已显示但刷新中） */}
              {cloudSyncing && (
                <span title="正在检查云端更新…">
                  <Loader2 size={11} className="animate-spin text-indigo-400 flex-shrink-0" />
                </span>
              )}
            </div>
          )}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Persona config editor — full-content takeover when open */}
          {personaConfig && dataset ? (
            <div className="max-w-7xl mx-auto px-6 py-5">
              <PersonaConfigEditor
                dataset={dataset}
                onClose={() => setPersonaConfig(false)}
              />
            </div>
          ) : !dataset || !viewConfig ? (
            <EmptyState onOpenDC={() => setDcOpen(true)} isAdmin={isAdmin} />
          ) : (
            <div className="max-w-7xl mx-auto px-6 py-5">
              {view === 'persona'  && (
                <PersonaView
                  dataset={dataset}
                  viewConfig={viewConfig}
                  onConfig={() => setPersonaConfig(true)}
                />
              )}
              {view === 'regional'  && <RegionalView        dataset={dataset} viewConfig={viewConfig} />}
              {view === 'status'    && <StatusView          dataset={dataset} viewConfig={viewConfig} />}
              {view === 'insight'   && <InsightView         dataset={dataset} viewConfig={viewConfig} />}
              {view === 'rfeature'  && <RegionalFeatureView dataset={dataset} viewConfig={viewConfig} />}
            </div>
          )}
        </div>
      </div>

      {/* Data center panel */}
      {dcOpen && <DataCenterPanel dataset={dataset} onClose={() => setDcOpen(false)} />}
    </div>
  );
}
