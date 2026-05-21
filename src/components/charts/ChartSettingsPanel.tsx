'use client';

import { useState } from 'react';
import { Settings2, ChevronDown, Palette, Type, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createPortal } from 'react-dom';
import { useRef, useEffect } from 'react';

// ============================================================
// 图表设置类型
// ============================================================
export interface ChartSettings {
  // 配色方案
  colorScheme: 'ios' | 'pastel' | 'warm' | 'cool' | 'mono' | 'vivid';
  // 显示元素
  showXAxis: boolean;
  showYAxis: boolean;
  showGrid: boolean;
  showLabel: boolean;    // 条形末端数值标签
  showTooltip: boolean;
  showLegend: boolean;
  // 字体大小
  fontSize: 'sm' | 'md' | 'lg';
  // 条形尺寸
  barSize: 'thin' | 'normal' | 'thick';
}

export const DEFAULT_CHART_SETTINGS: ChartSettings = {
  colorScheme: 'ios',
  showXAxis: true,
  showYAxis: true,
  showGrid: false,
  showLabel: true,
  showTooltip: true,
  showLegend: true,
  fontSize: 'md',
  barSize: 'normal',
};

// 颜色方案定义
export const COLOR_SCHEMES: Record<ChartSettings['colorScheme'], { label: string; colors: string[] }> = {
  ios:    { label: 'iOS 系统色',   colors: ['#007AFF','#34C759','#FF9500','#5856D6','#FF2D55','#5AC8FA','#AF52DE','#FFCC00','#32ADE6','#FF3B30'] },
  pastel: { label: '柔和马卡龙',   colors: ['#A8D8EA','#AA96DA','#FCBAD3','#FFFFD2','#B8F0D4','#FFD3A5','#C3B1E1','#FADADD','#B5EAD7','#FFE8D6'] },
  warm:   { label: '暖色系',       colors: ['#FF6B6B','#FF8E53','#FFA726','#FFCA28','#FF7043','#EF5350','#FFA000','#FF8F00','#FF6F00','#BF360C'] },
  cool:   { label: '冷色系',       colors: ['#0288D1','#0097A7','#00796B','#1565C0','#283593','#4527A0','#6A1B9A','#0277BD','#006064','#004D40'] },
  mono:   { label: '单色渐变',     colors: ['#1a1a2e','#16213e','#0f3460','#533483','#e94560','#a8a8b3','#6c6c80','#41415a','#2d2d44','#1f1f30'] },
  vivid:  { label: '高饱和鲜亮',   colors: ['#FF0080','#7928CA','#0070F3','#00DFD8','#FF4D4D','#F5A623','#7ED321','#417505','#BD10E0','#9013FE'] },
};

export const FONT_SIZES = {
  sm: { label: '小', axisSize: 10, labelSize: 10 },
  md: { label: '中', axisSize: 12, labelSize: 11 },
  lg: { label: '大', axisSize: 14, labelSize: 13 },
};

export const BAR_SIZES = {
  thin:   { label: '细', size: 12 },
  normal: { label: '中', size: 18 },
  thick:  { label: '粗', size: 26 },
};

// ============================================================
// 设置面板组件
// ============================================================
interface ChartSettingsPanelProps {
  settings: ChartSettings;
  onChange: (s: ChartSettings) => void;
  className?: string;
}

export function ChartSettingsPanel({ settings, onChange, className }: ChartSettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function updatePosition() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const panelWidth = 280;
    const left = Math.min(rect.right - panelWidth, window.innerWidth - panelWidth - 12);
    setPanelStyle({
      position: 'fixed',
      top: rect.bottom + 6,
      left: Math.max(12, left),
      width: panelWidth,
      zIndex: 99999,
    });
  }

  useEffect(() => {
    if (open) updatePosition();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!triggerRef.current?.contains(e.target as Node) &&
          !panelRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function update<K extends keyof ChartSettings>(key: K, val: ChartSettings[K]) {
    onChange({ ...settings, [key]: val });
  }

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen(p => !p)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-ios text-[12px] transition-all no-tap',
          open
            ? 'bg-[#007AFF]/10 text-[#007AFF] border border-[#007AFF]/20'
            : 'glass-card-subtle text-black/45 hover:text-black/65',
          className
        )}
        title="图表设置"
      >
        <Settings2 size={13} />
        <span>图表设置</span>
      </button>

      {open && typeof window !== 'undefined' && createPortal(
        <div
          ref={panelRef}
          style={panelStyle}
          className="glass-card-elevated animate-scale-in shadow-ios-xl overflow-hidden"
        >
          {/* 标题栏 */}
          <div className="px-4 py-3 border-b border-black/08 flex items-center justify-between">
            <span className="text-[13px] font-600 text-black/75">图表设置</span>
            <button onClick={() => onChange(DEFAULT_CHART_SETTINGS)}
              className="text-[11px] text-[#007AFF] hover:text-blue-700">
              还原默认
            </button>
          </div>

          <div className="p-4 space-y-5 max-h-[70vh] overflow-y-auto">

            {/* 配色方案 */}
            <Section icon={<Palette size={13} />} label="配色方案">
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.entries(COLOR_SCHEMES) as [ChartSettings['colorScheme'], { label: string; colors: string[] }][]).map(([key, scheme]) => (
                  <button
                    key={key}
                    onClick={() => update('colorScheme', key)}
                    className={cn(
                      'flex items-center gap-2 px-2.5 py-2 rounded-ios text-left transition-all',
                      settings.colorScheme === key
                        ? 'bg-[#007AFF]/10 border border-[#007AFF]/25'
                        : 'hover:bg-black/04'
                    )}
                  >
                    {/* 色块预览 */}
                    <div className="flex gap-0.5 flex-shrink-0">
                      {scheme.colors.slice(0, 4).map((c, i) => (
                        <div key={i} className="w-3 h-3 rounded-full" style={{ background: c }} />
                      ))}
                    </div>
                    <span className={cn(
                      'text-[11px] leading-tight',
                      settings.colorScheme === key ? 'text-[#007AFF] font-500' : 'text-black/55'
                    )}>
                      {scheme.label}
                    </span>
                  </button>
                ))}
              </div>
            </Section>

            {/* 显示元素 */}
            <Section icon={<LayoutGrid size={13} />} label="显示元素">
              <div className="grid grid-cols-2 gap-1">
                {([
                  ['showXAxis',   'X 轴'],
                  ['showYAxis',   'Y 轴'],
                  ['showGrid',    '网格线'],
                  ['showLabel',   '数值标签'],
                  ['showTooltip', '提示框'],
                ] as [keyof ChartSettings, string][]).map(([key, label]) => (
                  <Toggle
                    key={key}
                    label={label}
                    value={settings[key] as boolean}
                    onChange={v => update(key, v as ChartSettings[typeof key])}
                  />
                ))}
              </div>
            </Section>

            {/* 字体大小 */}
            <Section icon={<Type size={13} />} label="字体大小">
              <div className="flex gap-1.5">
                {(Object.entries(FONT_SIZES) as [ChartSettings['fontSize'], { label: string }][]).map(([key, { label }]) => (
                  <button
                    key={key}
                    onClick={() => update('fontSize', key)}
                    className={cn(
                      'flex-1 py-1.5 rounded-ios text-[12px] transition-all',
                      settings.fontSize === key
                        ? 'bg-[#007AFF] text-white font-500'
                        : 'bg-black/05 text-black/55 hover:bg-black/08'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Section>

            {/* 条形粗细 */}
            <Section icon={<span className="text-[11px] font-bold text-black/40">■</span>} label="条形粗细">
              <div className="flex gap-1.5">
                {(Object.entries(BAR_SIZES) as [ChartSettings['barSize'], { label: string }][]).map(([key, { label }]) => (
                  <button
                    key={key}
                    onClick={() => update('barSize', key)}
                    className={cn(
                      'flex-1 py-1.5 rounded-ios text-[12px] transition-all',
                      settings.barSize === key
                        ? 'bg-[#007AFF] text-white font-500'
                        : 'bg-black/05 text-black/55 hover:bg-black/08'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Section>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function Section({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-black/35">{icon}</span>
        <span className="text-[11px] font-600 text-black/45 uppercase tracking-wider">{label}</span>
      </div>
      {children}
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={cn(
        'flex items-center gap-2 px-2.5 py-1.5 rounded-ios text-[12px] transition-all text-left',
        value ? 'bg-[#007AFF]/08 text-[#007AFF]' : 'text-black/45 hover:bg-black/04'
      )}
    >
      <div className={cn(
        'w-3.5 h-3.5 rounded-sm border flex items-center justify-center flex-shrink-0 transition-all',
        value ? 'bg-[#007AFF] border-[#007AFF]' : 'border-black/25'
      )}>
        {value && <span className="text-white text-[9px] font-bold leading-none">✓</span>}
      </div>
      {label}
    </button>
  );
}
