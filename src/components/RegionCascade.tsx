'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { AREA_LIST } from '@/types';
import { createPortal } from 'react-dom';

interface RegionFilter {
  area?: string;
  province?: string;
  city?: string;
}

interface Props {
  value: RegionFilter;
  onChange: (v: RegionFilter) => void;
}

export function RegionCascade({ value, onChange }: Props) {
  const [provinces, setProvinces] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);

  useEffect(() => {
    if (!value.area) { setProvinces([]); setCities([]); return; }
    supabase
      .from('active_users')
      .select('region_province')
      .eq('region_area', value.area)
      .then(({ data }) => {
        setProvinces([...new Set((data || []).map((d: { region_province: string }) => d.region_province))].sort());
      });
  }, [value.area]);

  useEffect(() => {
    if (!value.province) { setCities([]); return; }
    supabase
      .from('active_users')
      .select('region_city')
      .eq('region_province', value.province)
      .then(({ data }) => {
        setCities([...new Set((data || []).map((d: { region_city: string }) => d.region_city))].sort());
      });
  }, [value.province]);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <PortalSelect
        placeholder="选择大区"
        options={AREA_LIST}
        value={value.area}
        onChange={a => onChange({ area: a })}
      />
      {provinces.length > 0 && (
        <PortalSelect
          placeholder="选择省份"
          options={provinces}
          value={value.province}
          onChange={p => onChange({ area: value.area, province: p })}
        />
      )}
      {cities.length > 0 && (
        <PortalSelect
          placeholder="选择城市"
          options={cities}
          value={value.city}
          onChange={c => onChange({ area: value.area, province: value.province, city: c })}
        />
      )}
    </div>
  );
}

function PortalSelect({
  placeholder, options, value, onChange,
}: {
  placeholder: string;
  options: string[];
  value?: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const menuHeight = Math.min(options.length * 34 + 8, 224);
    const spaceBelow = viewportHeight - rect.bottom;
    const openUpward = spaceBelow < menuHeight && rect.top > menuHeight;

    setMenuStyle({
      position: 'fixed',
      left: rect.left,
      width: Math.max(rect.width, 140),
      maxHeight: 224,
      overflowY: 'auto',
      zIndex: 99999,
      ...(openUpward
        ? { bottom: viewportHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
  }, [options.length]);

  useEffect(() => {
    if (open) updateMenuPosition();
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !menuRef.current?.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener('scroll', updateMenuPosition, true);
    window.addEventListener('resize', updateMenuPosition);
    return () => {
      window.removeEventListener('scroll', updateMenuPosition, true);
      window.removeEventListener('resize', updateMenuPosition);
    };
  }, [open, updateMenuPosition]);

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen(p => !p)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-ios text-[13px] transition-all no-tap',
          value
            ? 'bg-[#007AFF]/10 text-[#007AFF] font-500 border border-[#007AFF]/20'
            : 'glass-card-subtle text-black/55 hover:bg-white/60'
        )}
      >
        {value || placeholder}
        <ChevronDown size={12} className={cn('transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {open && typeof window !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          style={menuStyle}
          className="glass-card-elevated py-1 animate-scale-in shadow-ios-xl"
        >
          {options.map(opt => (
            <button
              key={opt}
              onMouseDown={e => { e.preventDefault(); onChange(opt); setOpen(false); }}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 text-[13px] transition-colors no-tap',
                value === opt ? 'text-[#007AFF] font-500 bg-[#007AFF]/08' : 'text-black/70 hover:bg-black/04'
              )}
            >
              {opt}
              {value === opt && <Check size={12} className="text-[#007AFF]" />}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
