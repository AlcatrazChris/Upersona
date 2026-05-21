'use client';

import { RefreshCw, Loader2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CoreUserProfile } from '@/types';
import { ORDER_STATUS_OPTIONS } from '@/types';

interface Props {
  data: CoreUserProfile;
  onRefresh?: () => void;
  refreshing?: boolean;
}

const TAG_STYLES = [
  { bg: 'var(--c-blue-bg,rgba(0,122,255,0.10))', color: '#0055cc' },
  { bg: 'var(--c-green-bg,rgba(52,199,89,0.10))', color: '#1a7a35' },
  { bg: 'rgba(120,120,128,0.10)', color: 'rgba(0,0,0,0.55)' },
  { bg: 'rgba(255,149,0,0.10)', color: '#a05500' },
  { bg: 'rgba(255,59,48,0.10)', color: '#cc1100' },
];

export function AiUserCard({ data, onRefresh, refreshing }: Props) {
  const { aiCard, sampleCount, strongIntentCount, weakIntentCount, strongIntentRatio, regionName, orderStatusFilter, cached } = data;
  const statusOpt = ORDER_STATUS_OPTIONS.find(o => o.value === orderStatusFilter);
  const strongPct = strongIntentRatio.toFixed(1);
  const tagEntries = aiCard ? Object.values(aiCard.tags).filter(Boolean) : [];

  return (
    <div className="glass-card overflow-hidden animate-slide-up">
      {/* 头部 */}
      <div className="px-6 py-5" style={{ background: 'linear-gradient(135deg,rgba(0,122,255,0.07) 0%,rgba(88,86,214,0.05) 100%)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-[13px] font-700"
                style={{ background: 'linear-gradient(135deg,#007AFF,#5856D6)' }}>核</div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[18px] font-700 text-black/85 tracking-tight">{regionName}</span>
                  {statusOpt && statusOpt.value !== 'all' && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-500"
                      style={{ background: `${statusOpt.color}15`, color: statusOpt.color }}>{statusOpt.label}</span>
                  )}
                  {cached && <span className="badge-ios badge-gray text-[9px]">缓存</span>}
                </div>
                <div className="text-[12px] text-black/40 mt-0.5">华境S 核心用户画像 · AI 生成</div>
              </div>
            </div>
            <div className="flex items-center gap-4 text-[12px]">
              <div className="flex items-center gap-1.5"><Users size={12} className="text-black/35" /><span className="text-black/50">总样本</span><span className="font-600 text-black/75">{sampleCount}</span></div>
              <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-[#34C759]" /><span className="text-[#34C759] font-600">{strongIntentCount}</span><span className="text-black/40">强意向</span></div>
              <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-black/20" /><span className="text-black/45 font-600">{weakIntentCount}</span><span className="text-black/40">弱意向</span></div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[32px] font-700 leading-none tabular-nums" style={{ color: '#007AFF' }}>{strongPct}%</div>
            <div className="text-[11px] text-black/35 mt-0.5">强意向占比</div>
          </div>
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-black/06 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${strongPct}%`, background: 'linear-gradient(90deg,#34C759,#5AC8FA)' }} />
        </div>
      </div>

      {/* 卡片主体 */}
      <div className="px-6 py-5">
        {refreshing ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 size={24} className="animate-spin text-[#5856D6]" />
            <span className="text-[13px] text-black/45">AI 正在生成画像…</span>
          </div>
        ) : aiCard ? (
          <>
            {/* 人群标签 + 刷新按钮 */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-[#5856D6] bg-[#5856D6]/10 px-2 py-0.5 rounded-full font-500">人群 A</span>
              {onRefresh && (
                <button onClick={onRefresh} disabled={refreshing}
                  className="flex items-center gap-1 text-[11px] text-black/30 hover:text-[#007AFF] transition-colors">
                  <RefreshCw size={10} />重新生成
                </button>
              )}
            </div>

            {/* 大标题 */}
            <h2 className="text-[20px] font-700 text-black/88 tracking-tight mb-4 leading-tight">
              {aiCard.title}
            </h2>

            {/* 4 条要点 */}
            <ul className="space-y-2.5 mb-5">
              {(aiCard.bullets as string[]).map((b, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0"
                    style={{ background: ['#007AFF','#5856D6','#FF9500','#34C759'][i] }} />
                  <span className="text-[14px] text-black/65 leading-relaxed">{b}</span>
                </li>
              ))}
            </ul>

            {/* 标签行 */}
            {tagEntries.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-3 border-t border-black/06">
                {tagEntries.map((t, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full text-[12px] font-500"
                    style={TAG_STYLES[i % TAG_STYLES.length]}>
                    {t}
                  </span>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="py-6 text-center">
            <div className="text-[13px] text-black/35">AI 画像生成失败</div>
            {onRefresh && <button onClick={onRefresh} className="mt-2 text-[12px] text-[#007AFF]">点击重试</button>}
          </div>
        )}
      </div>
    </div>
  );
}
