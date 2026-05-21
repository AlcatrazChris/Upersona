'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Settings2, RotateCcw } from 'lucide-react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { ChartConfig, ColorScheme, LegendPosition, COLOR_SCHEMES, DEFAULT_CHART_CONFIG } from '@/lib/chartConfig';

interface Props {
  config: ChartConfig;
  onChange: (c: ChartConfig) => void;
  showLegendOption?: boolean;
}

const LEGEND_POSITIONS: { value: LegendPosition; label: string }[] = [
  { value: 'bottom', label: '底部' },
  { value: 'top',    label: '顶部' },
  { value: 'right',  label: '右侧' },
  { value: 'left',   label: '左侧' },
];

export function ChartConfigPanel({ config, onChange, showLegendOption = false }: Props) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef   = useRef<HTMLDivElement>(null);

  function update<K extends keyof ChartConfig>(key: K, value: ChartConfig[K]) {
    onChange({ ...config, [key]: value });
  }
  function reset() { onChange({ ...DEFAULT_CHART_CONFIG }); }

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const panelW = 340;
    let left = rect.right - panelW;
    if (left < 8) left = rect.left;
    setPanelStyle({ position: 'fixed', top: rect.bottom + 6, left, width: panelW, zIndex: 99999 });
  }, []);

  useEffect(() => { if (open) updatePosition(); }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!triggerRef.current?.contains(e.target as Node) && !panelRef.current?.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition]);

  return (
    <>
      <button ref={triggerRef} onClick={() => setOpen(p => !p)}
        className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-ios text-[13px] transition-all no-tap',
          open ? 'bg-[#007AFF]/12 text-[#007AFF] border border-[#007AFF]/20' : 'glass-card-subtle text-black/55 hover:bg-white/60')}>
        <Settings2 size={13} />图表设置
      </button>

      {open && typeof window !== 'undefined' && createPortal(
        <div ref={panelRef}
          className="glass-card-elevated p-4 animate-scale-in shadow-ios-xl overflow-y-auto"
          style={{ ...panelStyle, maxHeight: 'calc(100vh - 120px)' }}>

          <div className="flex items-center justify-between mb-4">
            <span className="text-[13px] font-600 text-black/70">图表显示设置</span>
            <button onClick={reset} className="flex items-center gap-1 text-[11px] text-black/40 hover:text-[#007AFF] transition-colors">
              <RotateCcw size={10} />恢复默认
            </button>
          </div>

          {/* 配色方案 */}
          <Section title="配色方案">
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(COLOR_SCHEMES) as [ColorScheme, typeof COLOR_SCHEMES[ColorScheme]][]).map(([key, scheme]) => (
                <button key={key} onClick={() => update('colorScheme', key)}
                  className={cn('flex items-center gap-2 px-2.5 py-2 rounded-ios text-[12px] transition-all no-tap border',
                    config.colorScheme === key ? 'border-[#007AFF]/40 bg-[#007AFF]/08 text-[#007AFF] font-500' : 'border-transparent hover:bg-black/04 text-black/60')}>
                  <div className="flex gap-0.5 flex-shrink-0">
                    {scheme.preview.slice(0, 4).map((c, i) => (
                      <div key={i} className="w-3 h-3 rounded-full" style={{ background: c }} />
                    ))}
                  </div>
                  <span className="truncate">{scheme.name}</span>
                </button>
              ))}
            </div>
          </Section>

          {/* 显示元素 */}
          <Section title="显示元素">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              <Toggle label="X 轴"    value={config.showXAxis}       onChange={v => update('showXAxis', v)} />
              <Toggle label="Y 轴"    value={config.showYAxis}       onChange={v => update('showYAxis', v)} />
              <Toggle label="网格线"  value={config.showGrid}        onChange={v => update('showGrid', v)} />
              <Toggle label="数值标签" value={config.showLabel}      onChange={v => update('showLabel', v)} />
              <Toggle label="提示框"  value={config.showTooltip}     onChange={v => update('showTooltip', v)} />
              <Toggle label="样本数"  value={config.showSampleCount} onChange={v => update('showSampleCount', v)} />
              {showLegendOption && (
                <Toggle label="图例" value={config.showLegend} onChange={v => update('showLegend', v)} />
              )}
            </div>
          </Section>

          {/* 图例位置（仅堆积图显示） */}
          {showLegendOption && config.showLegend && (
            <Section title="图例位置">
              <div className="flex gap-2 flex-wrap">
                {LEGEND_POSITIONS.map(pos => (
                  <button key={pos.value} onClick={() => update('legendPosition', pos.value)}
                    className={cn('px-3 py-1 rounded-ios text-[12px] transition-all no-tap border',
                      config.legendPosition === pos.value ? 'border-[#007AFF]/40 bg-[#007AFF]/08 text-[#007AFF] font-500' : 'border-black/10 text-black/55 hover:bg-black/04')}>
                    {pos.label}
                  </button>
                ))}
              </div>
            </Section>
          )}

          {/* 字体大小 */}
          <Section title="字体大小">
            <div className="space-y-2.5">
              <Slider label="坐标轴"  value={config.axisFontSize}   min={9} max={16} onChange={v => update('axisFontSize', v)}   unit="px" />
              <Slider label="数值标签" value={config.labelFontSize} min={9} max={16} onChange={v => update('labelFontSize', v)}  unit="px" />
              {showLegendOption && (
                <Slider label="图例"  value={config.legendFontSize} min={9} max={16} onChange={v => update('legendFontSize', v)} unit="px" />
              )}
            </div>
          </Section>

          {/* 条形样式 */}
          <Section title="条形图样式">
            <div className="space-y-2.5">
              <Slider label="圆角"    value={config.barRadius}                     min={0} max={10}  onChange={v => update('barRadius', v)}   unit="px" />
              <Slider label="透明度"  value={Math.round(config.barOpacity * 100)}  min={40} max={100} onChange={v => update('barOpacity', v / 100)} unit="%" />
            </div>
          </Section>
        </div>,
        document.body
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-[11px] text-black/35 font-500 uppercase tracking-wider mb-2">{title}</div>
      {children}
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} className="flex items-center justify-between gap-2 no-tap group">
      <span className="text-[12px] text-black/60 group-hover:text-black/75 transition-colors">{label}</span>
      <div className={cn('relative rounded-full transition-all duration-200 flex-shrink-0', value ? 'bg-[#34C759]' : 'bg-black/15')}
        style={{ width: 30, height: 18 }}>
        <div className={cn('absolute top-[2px] w-[14px] h-[14px] bg-white rounded-full shadow-sm transition-all duration-200',
          value ? 'left-[14px]' : 'left-[2px]')} />
      </div>
    </button>
  );
}

function Slider({ label, value, min, max, onChange, unit = '' }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void; unit?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[12px] text-black/55 w-14 flex-shrink-0">{label}</span>
      <input type="range" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 h-1 rounded-full cursor-pointer" style={{ accentColor: '#007AFF' }} />
      <span className="text-[11px] text-black/40 w-10 text-right tabular-nums">{value}{unit}</span>
    </div>
  );
}
