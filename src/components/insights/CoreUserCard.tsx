'use client';

import { useState } from 'react';
import { User, Search, Heart, RefreshCw, Loader2, TrendingUp, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CoreUserProfile } from '@/types';

interface WeightedStat {
  label: string;
  weightedPct: number;
}

interface LegacyCoreUserProfile extends CoreUserProfile {
  topOccupations: WeightedStat[];
  topFamilyStructure: string;
  topIncome: string;
  topAgeGroups: { label: string }[];
  topCarInterests: string[];
  topInfoChannels: string[];
  topConsumptionViews: string[];
  topHobbies: string[];
  narrativeSummary?: string;
}

interface Props {
  data: LegacyCoreUserProfile;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export function CoreUserCard({ data, onRefresh, refreshing }: Props) {
  const [expanded, setExpanded] = useState(false);

  const strongPct = data.strongIntentRatio.toFixed(1);
  const weightNote = '（强意向×2.0 / 弱意向×1.0 加权）';

  return (
    <div className="glass-card overflow-hidden animate-slide-up">
      {/* ── 卡片头部 ── */}
      <div
        className="px-5 py-4"
        style={{
          background: 'linear-gradient(135deg, rgba(0,122,255,0.08) 0%, rgba(88,86,214,0.06) 100%)',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[11px] font-700"
                style={{ background: 'linear-gradient(135deg, #007AFF, #5856D6)' }}
              >
                核
              </div>
              <h3 className="text-[16px] font-700 text-black/85 tracking-tight">{data.regionName}</h3>
              <span className="badge-ios badge-blue text-[10px]">
                {data.regionType === 'area' ? '大区' : data.regionType === 'province' ? '省份' : '城市'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[12px] text-black/45">
              <span>总样本 {data.sampleCount} 人</span>
              <span className="text-black/20">·</span>
              <span className="text-[#34C759] font-500">强意向 {data.strongIntentCount} 人</span>
              <span className="text-black/20">·</span>
              <span>弱意向 {data.weakIntentCount} 人</span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[28px] font-700 text-[#007AFF] leading-none tabular-nums">{strongPct}%</div>
            <div className="text-[11px] text-black/40 mt-0.5">原始强意向占比</div>
          </div>
        </div>

        {/* 强/弱意向进度条 */}
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-12 text-[10px] text-[#34C759] font-500">强意向</div>
            <div className="flex-1 progress-ios">
              <div className="progress-ios-fill" style={{ width: `${strongPct}%`, background: 'linear-gradient(90deg, #34C759, #5AC8FA)' }} />
            </div>
            <div className="w-8 text-[10px] text-black/40 text-right tabular-nums">{strongPct}%</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-12 text-[10px] text-black/40 font-500">弱意向</div>
            <div className="flex-1 progress-ios">
              <div className="progress-ios-fill" style={{ width: `${(100 - parseFloat(strongPct)).toFixed(1)}%`, background: 'rgba(0,0,0,0.12)' }} />
            </div>
            <div className="w-8 text-[10px] text-black/40 text-right tabular-nums">{(100 - parseFloat(strongPct)).toFixed(1)}%</div>
          </div>
        </div>
      </div>

      {/* ── 卡片主体（三段） ── */}
      <div className="p-5 space-y-4">

        {/* 1. 用户是什么样 */}
        <CardSection icon={<User size={14} />} title="用户是什么样" color="#007AFF">
          <div className="grid grid-cols-2 gap-3">
            <StatItem label="主要职业" value={data.topOccupations.slice(0, 2).map(o => o.label).join(' / ')} sub={`加权 ${data.topOccupations[0]?.weightedPct.toFixed(1)}%`} />
            <StatItem label="典型家庭" value={data.topFamilyStructure} />
            <StatItem label="收入层次" value={data.topIncome} />
            <StatItem label="年龄主力" value={data.topAgeGroups.slice(0, 2).map(a => a.label).join(' / ')} />
          </div>
          {/* Top 职业加权柱 */}
          <div className="mt-3 space-y-1.5">
            {data.topOccupations.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[11px] text-black/50 w-20 truncate">{o.label}</span>
                <div className="flex-1 h-1.5 bg-black/06 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${o.weightedPct}%`, background: `hsl(${210 + i * 40}, 80%, 55%)` }}
                  />
                </div>
                <span className="text-[11px] text-black/40 w-9 text-right tabular-nums">{o.weightedPct.toFixed(1)}%</span>
              </div>
            ))}
            <div className="text-[9px] text-black/25 mt-1">{weightNote}</div>
          </div>
        </CardSection>

        {/* 2. 用户关注什么 */}
        <CardSection icon={<Search size={14} />} title="用户关注什么" color="#5856D6">
          <div className="space-y-2.5">
            <TagGroup label="关注的汽车内容" tags={data.topCarInterests} color="#5856D6" />
            <TagGroup label="了解华境S的渠道" tags={data.topInfoChannels} color="#007AFF" />
          </div>
        </CardSection>

        {/* 3. 价值观与爱好 */}
        <CardSection icon={<Heart size={14} />} title="价值观与爱好" color="#FF2D55">
          <div className="space-y-2.5">
            <TagGroup label="消费观念" tags={data.topConsumptionViews} color="#FF2D55" />
            <TagGroup label="日常爱好" tags={data.topHobbies} color="#FF9500" />
          </div>
        </CardSection>

        {/* AI 人群特征总结 */}
        {data.narrativeSummary && (
          <div
            className="rounded-ios-lg p-3.5"
            style={{ background: 'rgba(88,86,214,0.06)', border: '1px solid rgba(88,86,214,0.12)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#5856D6]" />
                <span className="text-[11px] text-[#5856D6] font-600">AI 人群特征总结</span>
                {data.cached && <span className="badge-ios badge-gray text-[9px]">缓存</span>}
              </div>
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  disabled={refreshing}
                  className="flex items-center gap-1 text-[10px] text-black/35 hover:text-[#5856D6] transition-colors"
                >
                  <RefreshCw size={9} className={refreshing ? 'animate-spin' : ''} />
                  重新生成
                </button>
              )}
            </div>
            {refreshing ? (
              <div className="flex items-center gap-1.5 text-[12px] text-black/40">
                <Loader2 size={11} className="animate-spin" />生成中…
              </div>
            ) : (
              <p className="text-[13px] text-black/65 leading-relaxed">{data.narrativeSummary}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 子组件 ──

function CardSection({ icon, title, color, children }: {
  icon: React.ReactNode; title: string; color: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: `${color}18`, color }}>
          {icon}
        </div>
        <span className="text-[13px] font-600 text-black/70">{title}</span>
      </div>
      {children}
    </div>
  );
}

function StatItem({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="glass-card-subtle px-3 py-2 rounded-ios">
      <div className="text-[10px] text-black/35 mb-0.5">{label}</div>
      <div className="text-[13px] font-500 text-black/75 leading-tight">{value || '—'}</div>
      {sub && <div className="text-[10px] text-black/30 mt-0.5">{sub}</div>}
    </div>
  );
}

function TagGroup({ label, tags, color }: { label: string; tags: string[]; color: string }) {
  return (
    <div>
      <div className="text-[10px] text-black/35 mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t, i) => (
          <span
            key={i}
            className="px-2 py-1 rounded-full text-[11px] font-500"
            style={{
              background: `${color}${i === 0 ? '18' : '0e'}`,
              color: i === 0 ? color : `${color}aa`,
            }}
          >
            {t}
          </span>
        ))}
        {tags.length === 0 && <span className="text-[12px] text-black/25">—</span>}
      </div>
    </div>
  );
}
