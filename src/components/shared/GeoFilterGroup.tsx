'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronDown, MapPin, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getGeoOptionsWithCount, type GeoLevel } from '@/lib/filterRecords';
import type { Dataset } from '@/types/dataSchema';
import type { ViewConfig } from '@/lib/viewConfig';

export function GeoFilterGroup({
  dataset, viewConfig, level, selected, onLevelChange, onChange, allowAll = true,
}: {
  dataset: Dataset;
  viewConfig: ViewConfig;
  level: GeoLevel;
  selected: string[];
  onLevelChange: (level: GeoLevel) => void;
  onChange: (values: string[]) => void;
  allowAll?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const levels = ([
    ...(allowAll ? [{ key: 'all' as GeoLevel, label: '全国', fieldKey: 'all' }] : []),
    { key: 'region' as GeoLevel, label: '大区', fieldKey: viewConfig.geoRegionKey },
    { key: 'province' as GeoLevel, label: '省份', fieldKey: viewConfig.geoProvinceKey },
    { key: 'city' as GeoLevel, label: '城市', fieldKey: viewConfig.geoCityKey },
  ]).filter(item => item.fieldKey);
  const options = useMemo(
    () => level === 'all' ? [] : getGeoOptionsWithCount(dataset.records, viewConfig, level),
    [dataset.records, viewConfig, level],
  );
  const visible = search ? options.filter(item => item.value.includes(search)) : options;
  const levelLabel = levels.find(item => item.key === level)?.label ?? '地区';

  function changeLevel(next: GeoLevel) {
    onLevelChange(next);
    onChange([]);
    setOpen(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1 text-xs text-slate-400"><MapPin size={12} />地区</span>
      <div className="flex rounded-lg bg-slate-100 p-0.5">
        {levels.map(item => (
          <button key={item.key} type="button" onClick={() => changeLevel(item.key)}
            className={cn('rounded-md px-2.5 py-1 text-xs transition-colors',
              level === item.key ? 'bg-white font-medium text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
            {item.label}
          </button>
        ))}
      </div>
      {level !== 'all' && (
        <div className="relative">
          <button type="button" onClick={() => setOpen(value => !value)}
            className={cn('flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors',
              selected.length ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300')}>
            {selected.length === 0 ? `全部${levelLabel}` : selected.length === 1 ? selected[0] : `${selected.length} 个${levelLabel}`}
            <ChevronDown size={11} />
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setSearch(''); }} />
              <div className="absolute left-0 top-9 z-50 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                  <Search size={12} className="text-slate-400" />
                  <input autoFocus value={search} onChange={event => setSearch(event.target.value)}
                    placeholder={`搜索${levelLabel}…`} className="w-full bg-transparent text-xs outline-none" />
                </div>
                <div className="max-h-64 overflow-y-auto p-1.5">
                  {visible.map(item => {
                    const checked = selected.includes(item.value);
                    return (
                      <button type="button" key={item.value}
                        onClick={() => onChange(checked ? selected.filter(value => value !== item.value) : [...selected, item.value])}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-slate-700 hover:bg-blue-50">
                        <span className={cn('flex h-4 w-4 items-center justify-center rounded border', checked ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300')}>
                          {checked && <Check size={11} />}
                        </span>
                        <span className="flex-1 truncate">{item.value}</span>
                        <span className="text-[10px] text-slate-400">n={item.count.toLocaleString()}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}
      {selected.length > 0 && (
        <button type="button" onClick={() => onChange([])} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
          <X size={11} />清空
        </button>
      )}
    </div>
  );
}
