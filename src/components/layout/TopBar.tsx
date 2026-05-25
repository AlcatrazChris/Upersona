'use client';

import { usePathname } from 'next/navigation';
import { Database, RefreshCw } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/':         { title: '概览',      subtitle: '华境S 用户调研数据总览' },
  '/profile':  { title: '用户画像',  subtitle: '全量及筛选用户的维度分布' },
  '/compare':  { title: '地域对比',  subtitle: '选择地区进行多维度比较' },
  '/predict':  { title: '雷达对比',  subtitle: '五维用户特征与全国均值对比' },
  '/insights': { title: '核心洞察',  subtitle: '强意向用户画像与转化潜力' },
  '/admin':    { title: '数据管理',  subtitle: '上传数据 · 管理版本 · Prompt 配置' },
};

interface SampleInfo { total: number; versionId: number; date: string; }

export function TopBar() {
  const pathname = usePathname();
  const [info, setInfo] = useState<SampleInfo | null>(null);

  const pageKey = Object.keys(PAGE_TITLES).find(k => k !== '/' && pathname.startsWith(k)) || '/';
  const { title, subtitle } = PAGE_TITLES[pageKey] || PAGE_TITLES['/'];

  const fetchInfo = useCallback(() => {
    // 直接查 users 表总数，绕过 data_versions.record_count 字段
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

  useEffect(() => {
    fetchInfo();
  }, [fetchInfo]);

  return (
    <header className="sticky top-0 z-30 glass-nav px-8 py-4 flex items-center justify-between">
      <div>
        <h1 className="text-[20px] font-700 tracking-tight text-black/85">{title}</h1>
        <p className="text-[13px] text-black/40 mt-0.5">{subtitle}</p>
      </div>

      {info ? (
        <button
          onClick={fetchInfo}
          className="glass-card-subtle flex items-center gap-2 px-3 py-2 hover:bg-white/60 transition-colors group"
        >
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
    </header>
  );
}
