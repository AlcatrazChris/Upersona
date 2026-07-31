'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Settings2, Palette, LayoutGrid, Type, Maximize2, ArrowUpDown, ListFilter } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  COLOR_SCHEMES,
  REPORT_COLOR_SCHEMES,
  DEFAULT_CHART_CONFIG,
  loadChartConfig,
  saveChartConfig,
  supportsChartSetting,
  supportsAnyChartSetting,
} from '@/lib/chartConfig';
import { ManualOrderModal } from '@/components/fields/ManualOrderModal';
import type { ChartConfig, ColorScheme } from '@/lib/chartConfig';
import type { Field } from '@/types/dataSchema';

export function useStoredChartConfig(page: string, defaults = DEFAULT_CHART_CONFIG) {
  const [config, setConfig] = useState<ChartConfig>(
    () => ({ ...defaults, ...loadChartConfig(page) }),
  );
  const onChange = useCallback((next: ChartConfig) => {
    setConfig(next);
    saveChartConfig(page, next);
  }, [page]);
  return [config, onChange] as const;
}

interface ChartSettingsPanelProps {
  config: ChartConfig;
  onChange: (c: ChartConfig) => void;
  /** If provided, shows an ordering section for categorical fields */
  field?: Field;
  onUpdateOrdering?: (isOrdered: boolean, orderedValues: string[]) => void;
  className?: string;
  iconOnly?: boolean;
  chartTypes?: string[];
  allowPartial?: boolean;
}

export function ChartSettingsPanel({
  config, onChange, field, onUpdateOrdering, className, iconOnly = false, chartTypes, allowPartial = false,
}: ChartSettingsPanelProps) {
  const [open,          setOpen]          = useState(false);
  const [panelStyle,    setPanelStyle]    = useState<React.CSSProperties>({});
  const [showOrderModal, setShowOrderModal] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef   = useRef<HTMLDivElement>(null);

  const canOrder = !!field
    && (field.type === 'single_choice' || field.type === 'multi_choice')
    && (field.options?.length ?? 0) >= 3
    && !!onUpdateOrdering;
  const supports = (key: keyof ChartConfig) => allowPartial
    ? supportsAnyChartSetting(chartTypes, key)
    : supportsChartSetting(chartTypes, key);

  function updatePosition() {
    if (!triggerRef.current) return;
    const rect       = triggerRef.current.getBoundingClientRect();
    const panelWidth = 280;
    const left       = Math.min(rect.right - panelWidth, window.innerWidth - panelWidth - 12);
    setPanelStyle({ position: 'fixed', top: rect.bottom + 6, left: Math.max(12, left), width: panelWidth, zIndex: 99999 });
  }

  useEffect(() => { if (open) updatePosition(); }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!triggerRef.current?.contains(e.target as Node) &&
          !panelRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };
    const onViewportChange = () => updatePosition();
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [open]);

  function update<K extends keyof ChartConfig>(key: K, val: ChartConfig[K]) {
    onChange({ ...config, [key]: val });
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(p => !p)}
        aria-label="图表设置"
        aria-expanded={open}
        aria-controls="chart-settings-panel"
        title={iconOnly ? '图表设置' : undefined}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs transition-all',
          open
            ? 'bg-blue-50 text-blue-600 border border-blue-200'
            : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700',
          className
        )}
      >
        <Settings2 size={13} />
        {!iconOnly && '图表设置'}
      </button>

      {open && typeof window !== 'undefined' && createPortal(
        <div
          id="chart-settings-panel"
          ref={panelRef}
          role="dialog"
          aria-label="图表设置"
          style={panelStyle}
          className="max-w-[calc(100vw-24px)] overflow-hidden overscroll-contain rounded-2xl border border-gray-100 bg-white shadow-2xl"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">图表设置</span>
            <button
              onClick={() => onChange(DEFAULT_CHART_CONFIG)}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              还原默认
            </button>
          </div>

          <div className="p-4 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* 配色方案 */}
            <Section icon={<Palette size={13} />} label="配色方案">
              <div className="grid grid-cols-2 gap-1.5">
                {REPORT_COLOR_SCHEMES.map(key => {
                  const scheme = COLOR_SCHEMES[key];
                  return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => update('colorScheme', key)}
                    aria-pressed={config.colorScheme === key}
                    className={cn(
                      'flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-all',
                      config.colorScheme === key
                        ? 'bg-blue-50 border border-blue-200'
                        : 'hover:bg-gray-50'
                    )}
                  >
                    <div className="flex gap-0.5 flex-shrink-0">
                      {scheme.preview.slice(0, 4).map((c, i) => (
                        <div key={i} className="w-3 h-3 rounded-full" style={{ background: c }} />
                      ))}
                    </div>
                    <span className={cn(
                      'text-xs leading-tight',
                      config.colorScheme === key ? 'text-blue-600 font-medium' : 'text-gray-500'
                    )}>
                      {scheme.name}
                    </span>
                  </button>
                  );
                })}
              </div>
            </Section>

            {/* 显示元素 */}
            <Section icon={<LayoutGrid size={13} />} label="显示元素">
              <div className="grid grid-cols-2 gap-1">
                {([
                  ['showXAxis',       'X 轴'],
                  ['showYAxis',       'Y 轴'],
                  ['showGrid',        '网格线'],
                  ['showLabel',       '数值标签'],
                  ['showTooltip',     '提示框'],
                  ['showLegend',      '图例'],
                  ['showSampleCount', '样本数'],
                  ['compact',         '紧凑模式'],
                ] as [keyof ChartConfig, string][]).map(([key, label]) => (
                  <Toggle
                    key={key}
                    label={label}
                    value={!!(config[key] as boolean)}
                    onChange={v => update(key, v as ChartConfig[typeof key])}
                    disabled={!supports(key)}
                  />
                ))}
              </div>
            </Section>

            {/* 前N项 */}
            <Section icon={<ListFilter size={13} />} label="前 N 项">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-14 flex-shrink-0">项目数</span>
                  <input
                    aria-label="显示项目数"
                    type="range" min={0} max={15} step={1}
                    value={config.topN ?? 0}
                    onChange={e => update('topN', parseInt(e.target.value))}
                    className="flex-1 h-1.5 accent-blue-600"
                    disabled={!supports('topN')}
                  />
                  <span className="text-xs text-gray-400 w-10 text-right tabular-nums">
                    {(config.topN ?? 0) === 0 ? '全部' : `前 ${config.topN}`}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 leading-relaxed">
                  超出部分合并为「其他」，0 = 显示全部
                </p>
              </div>
            </Section>

            {/* 标签类型 */}
            <Section icon={<Type size={13} />} label="数值标签内容">
              <div className="flex gap-1.5">
                {(['pct', 'count', 'both'] as const).map(t => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => update('labelType', t)}
                    aria-pressed={config.labelType === t}
                    disabled={!supports('labelType')}
                    className={cn(
                      'flex-1 py-1.5 rounded-xl text-xs transition-all',
                      !supports('labelType')
                        ? 'cursor-not-allowed bg-gray-50 text-gray-300'
                        : config.labelType === t
                        ? 'bg-blue-600 text-white font-medium'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    )}
                  >
                    {t === 'pct' ? '百分比' : t === 'count' ? '数量' : '两者'}
                  </button>
                ))}
              </div>
            </Section>

            <Section icon={<LayoutGrid size={13} />} label="图例位置">
              <div className="grid grid-cols-4 gap-1">
                {([
                  ['top', '顶部'], ['bottom', '底部'], ['left', '左侧'], ['right', '右侧'],
                ] as const).map(([position, label]) => {
                  const disabled = !supports('legendPosition');
                  return (
                    <button type="button" key={position} disabled={disabled}
                      title={disabled ? '当前图表类型不支持图例位置设置' : undefined}
                      onClick={() => update('legendPosition', position)}
                      className={cn(
                        'rounded-lg py-1.5 text-xs',
                        disabled ? 'cursor-not-allowed bg-gray-50 text-gray-300'
                          : config.legendPosition === position
                            ? 'bg-blue-600 font-medium text-white'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
                      )}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* 数值调节 */}
            <Section icon={<span className="text-[10px] font-bold text-gray-400">px</span>} label="样式微调">
              <div className="space-y-2">
                {([
                  ['barRadius',  '圆角',   0, 12],
                  ['barOpacity', '透明度', 0.3, 1, 0.05],
                ] as [keyof ChartConfig, string, number, number, number?][]).map(([key, label, min, max, step = 1]) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-14 flex-shrink-0">{label}</span>
                    <input
                      aria-label={label}
                      type="range" min={min} max={max} step={step}
                      value={config[key] as number}
                      onChange={e => update(key, parseFloat(e.target.value) as ChartConfig[typeof key])}
                      className="flex-1 h-1.5 accent-blue-600"
                      disabled={!supports(key)}
                    />
                    <span className="text-xs text-gray-400 w-8 text-right tabular-nums">
                      {((config[key] as number) * (key === 'barOpacity' ? 100 : 1)).toFixed(0)}{key === 'barOpacity' ? '%' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </Section>

            {/* 图表尺寸 */}
            <Section icon={<Maximize2 size={13} />} label="图表尺寸">
              <div className="space-y-2">
                {([
                  ['chartHeight', '总高度', 180, 900, 20, (v: number) => `${v}px`],
                  ['minBarSize',  '条形高度', 8, 48, 2, (v: number) => `${v}px`],
                ] as [keyof ChartConfig, string, number, number, number, (v: number) => string][]).map(
                  ([key, label, min, max, step, fmt]) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-14 flex-shrink-0">{label}</span>
                    <input
                      aria-label={label}
                      type="range" min={min} max={max} step={step}
                      value={config[key] as number}
                      onChange={e => update(key, parseFloat(e.target.value) as ChartConfig[typeof key])}
                      className="flex-1 h-1.5 accent-blue-600"
                      disabled={!supports(key)}
                    />
                    <span className="text-xs text-gray-400 w-10 text-right tabular-nums">
                      {fmt(config[key] as number)}
                    </span>
                  </div>
                ))}
                <p className="text-[10px] text-gray-400 leading-relaxed pt-0.5">
                  条形高度影响横向簇状图最小行高；项目增多时图表自动撑高。
                </p>
              </div>
            </Section>

            {/* 排列顺序（仅单选/多选字段） */}
            {canOrder && field && (
              <Section icon={<ArrowUpDown size={13} />} label="排列顺序">
                <div className="space-y-2">
                  {/* Status badge */}
                  <div className="flex items-center gap-2">
                    {field.isOrdered && field.orderedValues?.length ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">
                        <ArrowUpDown size={10} />
                        已按自然顺序排列（{field.orderedValues.length} 项）
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">按数量降序（默认）</span>
                    )}
                  </div>
                  {/* Preview of current order */}
                  {field.isOrdered && field.orderedValues?.length ? (
                    <div className="text-[10px] text-gray-400 leading-relaxed">
                      {field.orderedValues.slice(0, 4).join(' → ')}
                      {field.orderedValues.length > 4 && ` … (共${field.orderedValues.length}项)`}
                    </div>
                  ) : null}
                  {/* Edit button */}
                  <button
                    onClick={() => setShowOrderModal(true)}
                    className="w-full py-1.5 rounded-xl text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                  >
                    {field.isOrdered ? '调整顺序' : '设置排列顺序'}
                  </button>
                </div>
              </Section>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ManualOrderModal rendered at top level to avoid z-index issues */}
      {showOrderModal && field && onUpdateOrdering && (
        <ManualOrderModal
          field={field}
          onClose={() => setShowOrderModal(false)}
          onSave={(isOrdered, orderedValues) => {
            onUpdateOrdering(isOrdered, orderedValues);
            setShowOrderModal(false);
          }}
        />
      )}
    </>
  );
}

function Section({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-gray-400">{icon}</span>
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
      </div>
      {children}
    </div>
  );
}

function Toggle({ label, value, onChange, disabled = false }: { label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-pressed={value}
      disabled={disabled}
      title={disabled ? '当前图表类型不支持此设置' : undefined}
      className={cn(
        'flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs transition-all text-left',
        disabled ? 'cursor-not-allowed text-gray-300' : value ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'
      )}
    >
      <div className={cn(
        'w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-all',
        value ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
      )}>
        {value && <span className="text-white text-[9px] font-bold leading-none">✓</span>}
      </div>
      {label}
    </button>
  );
}
