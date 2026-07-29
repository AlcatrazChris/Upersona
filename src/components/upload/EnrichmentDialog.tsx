'use client';

import { useState } from 'react';
import { Sparkles, MapPin, Building2, Briefcase, Check, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Dataset } from '@/types/dataSchema';
import type { EnrichableField } from '@/lib/fieldEnricher';
import { useModalA11y } from '@/hooks/useModalA11y';

interface EnrichmentDialogProps {
  dataset: Dataset;
  enrichments: EnrichableField[];
  onConfirm: (selected: EnrichableField[]) => void;
  onCancel: () => void;
}

const TYPE_META: Record<string, { label: string; icon: React.ReactNode; color: string; badge: string }> = {
  region: {
    label: '大区映射',
    icon: <MapPin size={14} />,
    color: 'bg-blue-50 text-blue-600 border-blue-200',
    badge: '规则',
  },
  cityTier: {
    label: '城市级别',
    icon: <Building2 size={14} />,
    color: 'bg-green-50 text-green-600 border-green-200',
    badge: '规则',
  },
  occupation: {
    label: '职业类别',
    icon: <Briefcase size={14} />,
    color: 'bg-purple-50 text-purple-600 border-purple-200',
    badge: 'AI',
  },
};

export function EnrichmentDialog({
  dataset, enrichments, onConfirm, onCancel,
}: EnrichmentDialogProps) {
  const dialogRef = useModalA11y<HTMLDivElement>(onCancel);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(enrichments.map(e => e.newFieldKey)),
  );
  const [loading, setLoading] = useState(false);

  function toggle(key: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function handleConfirm() {
    setLoading(true);
    try {
      onConfirm(enrichments.filter(e => selected.has(e.newFieldKey)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="enrichment-title"
        tabIndex={-1}
        className="w-full max-w-md overscroll-contain rounded-2xl border border-gray-100 bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-gray-100">
          <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
            <Sparkles size={16} className="text-purple-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="enrichment-title" className="text-sm font-semibold text-gray-800">检测到可派生字段</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              以下字段可自动生成分析维度，添加到「{dataset.name}」
            </p>
          </div>
          <button aria-label="关闭派生字段建议" onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={14} />
          </button>
        </div>

        {/* Enrichment list */}
        <div className="p-4 space-y-2">
          {enrichments.map(e => {
            const meta = TYPE_META[e.enrichType];
            const isSelected = selected.has(e.newFieldKey);
            return (
              <button
                key={e.newFieldKey}
                onClick={() => toggle(e.newFieldKey)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                  isSelected ? meta.color : 'border-gray-100 hover:bg-gray-50',
                )}
              >
                <div className={cn(
                  'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
                  isSelected ? '' : 'bg-gray-100 text-gray-400',
                )}>
                  {meta.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-700">{e.newFieldName}</span>
                    <span className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full font-semibold',
                      meta.badge === 'AI' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500',
                    )}>
                      {meta.badge}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    来源字段：{e.field.name}
                    {meta.badge === 'AI' && ' · 需要调用 AI'}
                  </div>
                </div>
                <div className={cn(
                  'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0',
                  isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300',
                )}>
                  {isSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 p-4 pt-2 border-t border-gray-50">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-xl text-xs font-medium text-gray-500 hover:bg-gray-50 transition-all"
          >
            跳过
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || selected.size === 0}
            className={cn(
              'flex-[2] py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5',
              selected.size > 0
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed',
            )}
          >
            {loading ? (
              <><Loader2 size={12} className="animate-spin" />处理中…</>
            ) : (
              `添加 ${selected.size} 个字段`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
