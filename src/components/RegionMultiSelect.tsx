'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, X, Check, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createPortal } from 'react-dom';

export type RegionType = 'area' | 'province' | 'city';

interface RegionItem {
  name: string;
  count: number;
}

interface Props {
  type: RegionType;
  options: RegionItem[];
  selected: string[];
  onChange: (selected: string[]) => void;
  maxSelect?: number;
}

export function RegionMultiSelect({ type, options, selected, onChange, maxSelect = 12 }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const typeLabel = type === 'area' ? '大区' : type === 'province' ? '省份' : '城市';

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const menuH = 320;
    const spaceBelow = viewportHeight - rect.bottom;
    const openUp = spaceBelow < menuH && rect.top > menuH;
    setMenuStyle({
      position: 'fixed',
      left: rect.left,
      width: Math.max(rect.width, 220),
      zIndex: 99999,
      ...(openUp ? { bottom: viewportHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
    });
  }, []);

  useEffect(() => {
    if (open) {
      updatePosition();
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!triggerRef.current?.contains(e.target as Node) &&
          !menuRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
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

  const filtered = options.filter(o =>
    !search || o.name.toLowerCase().includes(search.toLowerCase())
  );

  function toggle(name: string) {
    if (selected.includes(name)) {
      onChange(selected.filter(s => s !== name));
    } else if (selected.length < maxSelect) {
      onChange([...selected, name]);
    }
  }

  const isMaxed = selected.length >= maxSelect;

  return (
    <>
      <div ref={triggerRef}>
        {/* 触发器：已选 tags + 添加按钮 */}
        <div className="flex items-center gap-2 flex-wrap">
          {selected.map(s => (
            <span
              key={s}
              className="flex items-center gap-1 px-2.5 py-1 rounded-ios text-[13px] bg-[#007AFF]/10 text-[#007AFF] border border-[#007AFF]/20 font-500"
            >
              {s}
              <button
                onClick={() => toggle(s)}
                className="hover:bg-[#007AFF]/20 rounded-full p-0.5 transition-colors"
              >
                <X size={10} />
              </button>
            </span>
          ))}

          {!isMaxed && (
            <button
              onClick={() => setOpen(p => !p)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-ios text-[13px] transition-all no-tap border border-dashed',
                open
                  ? 'border-[#007AFF]/40 bg-[#007AFF]/08 text-[#007AFF]'
                  : 'border-black/20 text-black/45 hover:border-[#007AFF]/30 hover:text-[#007AFF]/70'
              )}
            >
              <MapPin size={12} />
              添加{typeLabel}
              <ChevronDown size={11} className={cn('transition-transform', open && 'rotate-180')} />
            </button>
          )}

          {selected.length > 0 && (
            <button
              onClick={() => onChange([])}
              className="text-[12px] text-black/35 hover:text-[#FF3B30] transition-colors ml-1"
            >
              清空
            </button>
          )}
        </div>
      </div>

      {open && typeof window !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          style={menuStyle}
          className="glass-card-elevated py-2 animate-scale-in shadow-ios-xl overflow-hidden"
        >
          {/* 搜索框 */}
          <div className="px-3 pb-2 border-b border-black/06">
            <input
              ref={searchRef}
              type="text"
              placeholder={`搜索${typeLabel}…`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-ios text-[13px] py-1.5"
            />
          </div>

          {/* 已选数量提示 */}
          <div className="px-3 py-1.5 flex items-center justify-between">
            <span className="text-[11px] text-black/35">
              已选 {selected.length}/{maxSelect}
            </span>
            {isMaxed && (
              <span className="text-[11px] text-[#FF9500]">最多选 {maxSelect} 个</span>
            )}
          </div>

          {/* 选项列表 */}
          <div className="overflow-y-auto" style={{ maxHeight: 220 }}>
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-[12px] text-black/35">无匹配结果</div>
            ) : (
              filtered.map(opt => {
                const isSelected = selected.includes(opt.name);
                const isDisabled = !isSelected && isMaxed;
                return (
                  <button
                    key={opt.name}
                    onMouseDown={e => { e.preventDefault(); toggle(opt.name); }}
                    disabled={isDisabled}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 text-[13px] transition-colors no-tap',
                      isSelected ? 'bg-[#007AFF]/08 text-[#007AFF]' : '',
                      isDisabled ? 'opacity-35 cursor-not-allowed' : 'hover:bg-black/04 text-black/70',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'w-4 h-4 rounded-[4px] border flex items-center justify-center flex-shrink-0 transition-all',
                        isSelected
                          ? 'bg-[#007AFF] border-[#007AFF]'
                          : 'border-black/20 bg-transparent'
                      )}>
                        {isSelected && <Check size={10} color="white" strokeWidth={3} />}
                      </div>
                      <span>{opt.name}</span>
                    </div>
                    <span className="text-[11px] text-black/35 tabular-nums">n={opt.count}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
