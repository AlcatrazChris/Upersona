'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Database, RefreshCw, LogOut } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import type { Role } from '@/lib/session';

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/':               { title: '概览',    subtitle: '华境S 用户调研数据总览' },
  '/profile':        { title: '用户画像', subtitle: '全量及筛选用户的维度分布' },
  '/compare':        { title: '地域对比', subtitle: '选择地区进行多维度比较' },
  '/predict':        { title: '雷达对比', subtitle: '五维用户特征与全国均值对比' },
  '/insights':       { title: '核心洞察', subtitle: '强意向用户画像与转化潜力' },
  '/status-compare': { title: '状态对比', subtitle: '锁单 / 未锁单 / 退单用户特征差异' },
  '/area-portrait':  { title: '区域特征', subtitle: '各地区用户画像与差异分析' },
  '/admin':          { title: '数据管理', subtitle: '上传数据 · 管理版本 · Prompt 配置' },
};

interface SampleInfo { total: number; versionId: number; date: string; }

export function TopBar({ role, username }: { role: Role; username: string }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [info,        setInfo]        = useState<SampleInfo | null>(null);
  const [loggingOut,  setLoggingOut]  = useState(false);

  const pageKey = Object.keys(PAGE_TITLES).find(k => k !== '/' && pathname.startsWith(k)) || '/';
  const { title, subtitle } = PAGE_TITLES[pageKey] || PAGE_TITLES['/'];

  const fetchInfo = useCallback(() => {
    fetch('/api/overview', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.total !== undefined) {
          setInfo({
            total: d.total,
            versionId: d.version?.version_id ?? 0,
            date: d.version
              ? new Date(d.version.uploaded_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
              : '',
          });
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => { fetchInfo(); }, [fetchInfo]);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.replace('/login');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 glass-nav px-8 py-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[20px] font-700 tracking-tight text-black/85">{title}</h1>
        <p className="text-[13px] text-black/40 mt-0.5">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        {/* 数据版本信息 */}
        {info ? (
          <button onClick={fetchInfo}
            className="glass-card-subtle flex items-center gap-2 px-3 py-2 hover:bg-white/60 transition-colors group">
            <Database size={13} className="text-[#007AFF]" />
            <span className="text-[12px] text-black/55">
              <span className="font-600 text-black/75">{info.total.toLocaleString()}</span>
              {' '}条数据
            </span>
            <span className="text-black/20">·</span>
            <span className="text-[12px] text-black/40">v{info.versionId}</span>
            {info.date && (
              <>
                <span className="text-black/20">·</span>
                <span className="text-[12px] text-black/40">{info.date}</span>
              </>
            )}
            <RefreshCw size={10} className="text-black/20 group-hover:text-[#007AFF] transition-colors" />
          </button>
        ) : (
          <div className="glass-card-subtle flex items-center gap-2 px-3 py-2">
            <Database size={13} className="text-black/25" />
            <div className="w-16 h-3 skeleton rounded" />
          </div>
        )}

        {/* 用户信息 + 退出 */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-[12px] text-black/40">
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-500 ${
              role === 'admin'
                ? 'bg-[#AF52DE]/10 text-[#AF52DE]'
                : 'bg-[#007AFF]/10 text-[#007AFF]'
            }`}>
              {role === 'admin' ? '管理员' : '访客'}
            </span>
            <span className="text-black/35">{username}</span>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            title="退出登录"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-ios text-[12px] text-black/35 hover:text-[#FF3B30] hover:bg-[#FF3B30]/08 transition-all disabled:opacity-40"
          >
            <LogOut size={13} />
            <span>退出</span>
          </button>
        </div>
      </div>
    </header>
  );
}
