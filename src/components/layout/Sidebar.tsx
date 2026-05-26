'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutGrid, Users, BarChart2, Activity, Sparkles, Settings, GitCompare, Map } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/',         icon: LayoutGrid, label: '概览',      desc: 'Overview' },
  { href: '/profile',  icon: Users,      label: '用户画像',  desc: 'Profile' },
  { href: '/compare',  icon: BarChart2,  label: '地域对比',  desc: 'Compare' },
  { href: '/predict',  icon: Activity,   label: '雷达对比',  desc: 'Radar' },
  { href: '/insights',       icon: Sparkles,    label: '核心洞察',  desc: 'Insights' },
  { href: '/status-compare',   icon: GitCompare,  label: '状态对比',   desc: 'Status' },
  { href: '/area-portrait',     icon: Map,         label: '区域特征',   desc: 'Regional' },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed left-0 top-0 h-screen w-64 z-40 flex flex-col">
      <div className="absolute inset-0 glass-nav border-r border-white/40" />
      <div className="relative flex flex-col h-full px-4 py-6">
        <div className="mb-8 px-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold shadow-lg"
              style={{ background: 'linear-gradient(135deg,#007AFF 0%,#5856D6 100%)' }}>华</div>
            <div>
              <div className="text-[15px] font-700 tracking-tight text-black/85 leading-tight">华境S</div>
              <div className="text-[11px] text-black/40 leading-tight mt-0.5">用户画像平台</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1">
          {NAV_ITEMS.map(({ href, icon: Icon, label, desc }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link key={href} href={href}
                className={cn('group flex items-center gap-3 px-3 py-2.5 rounded-ios transition-all duration-200 no-tap',
                  isActive ? 'bg-white/75 shadow-ios-sm' : 'hover:bg-white/45')}>
                <div className={cn('w-8 h-8 rounded-[8px] flex items-center justify-center transition-all duration-200',
                  isActive ? 'text-white shadow-md' : 'text-black/40 bg-black/05 group-hover:text-black/60')}
                  style={isActive ? { background: 'linear-gradient(135deg,#007AFF 0%,#5856D6 100%)' } : {}}>
                  <Icon size={16} strokeWidth={isActive ? 2 : 1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={cn('text-[14px] leading-tight transition-colors',
                    isActive ? 'font-600 text-black/85' : 'font-450 text-black/60')}>{label}</div>
                  <div className="text-[10px] text-black/30 leading-tight mt-0.5">{desc}</div>
                </div>
                {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[#007AFF]" />}
              </Link>
            );
          })}
        </nav>
        <div className="mt-4 pt-4 border-t border-black/08">
          <Link href="/admin" className="flex items-center gap-3 px-3 py-2.5 rounded-ios hover:bg-white/45 transition-all group no-tap">
            <div className="w-8 h-8 rounded-[8px] flex items-center justify-center bg-black/05 text-black/35 group-hover:text-black/55 transition-colors">
              <Settings size={15} strokeWidth={1.75} />
            </div>
            <div className="text-[13px] text-black/45 group-hover:text-black/65 transition-colors">数据管理</div>
          </Link>
        </div>
      </div>
    </aside>
  );
}
