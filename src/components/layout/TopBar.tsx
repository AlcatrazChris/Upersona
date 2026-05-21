'use client';

import { usePathname } from 'next/navigation';
import { Database } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/':         { title: '概览',      subtitle: '华境S 用户调研数据总览' },
  '/profile':  { title: '用户画像',  subtitle: '全量及筛选用户的维度分布' },
  '/compare':  { title: '地域对比',  subtitle: '选择地区进行多维度比较' },
  '/predict':  { title: '意向预测',  subtitle: '基于 AI 的购买意向评估' },
  '/insights': { title: '核心洞察',  subtitle: '强意向用户画像与转化潜力' },
  '/admin':    { title: '数据管理',  subtitle: '上传数据 · 管理版本' },
};

export function TopBar() {
  const pathname = usePathname();
  const [versionInfo, setVersionInfo] = useState<{ id: number; count: number; date: string } | null>(null);

  const pageKey = Object.keys(PAGE_TITLES).find(k => k !== '/' && pathname.startsWith(k)) || '/';
  const { title, subtitle } = PAGE_TITLES[pageKey] || PAGE_TITLES['/'];

  useEffect(() => {
    supabase
      .from('data_versions')
      .select('version_id, record_count, uploaded_at')
      .eq('is_active', true)
      .single()
      .then(({ data }) => {
        if (data) {
          setVersionInfo({
            id: data.version_id,
            count: data.record_count,
            date: new Date(data.uploaded_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
          });
        }
      });
  }, []);

  return (
    <header className="sticky top-0 z-30 glass-nav px-8 py-4 flex items-center justify-between">
      <div>
        <h1 className="text-[20px] font-700 tracking-tight text-black/85">{title}</h1>
        <p className="text-[13px] text-black/40 mt-0.5">{subtitle}</p>
      </div>

      {versionInfo && (
        <div className="glass-card-subtle flex items-center gap-2 px-3 py-2">
          <Database size={13} className="text-[#007AFF]" />
          <span className="text-[12px] text-black/55">
            <span className="font-500 text-black/70">{versionInfo.count.toLocaleString()}</span>
            {' '}条数据
          </span>
          <span className="text-black/20">·</span>
          <span className="text-[12px] text-black/40">v{versionInfo.id}</span>
          <span className="text-black/20">·</span>
          <span className="text-[12px] text-black/40">{versionInfo.date}</span>
        </div>
      )}
    </header>
  );
}
