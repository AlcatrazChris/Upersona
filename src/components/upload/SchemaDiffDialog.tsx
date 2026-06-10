'use client';

import { X, Plus, Minus, RefreshCw } from 'lucide-react';
import type { FieldDiff, FieldType } from '@/types/dataSchema';

const TYPE_LABELS: Record<FieldType, string> = {
  single_choice: '单选', multi_choice: '多选', ranking: '排序',
  number: '数值', date: '日期', boolean: '布尔', text: '文本',
};

interface SchemaDiffDialogProps {
  diff: FieldDiff;
  datasetName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SchemaDiffDialog({ diff, datasetName, onConfirm, onCancel }: SchemaDiffDialogProps) {
  const hasChanges = diff.added.length > 0 || diff.removed.length > 0 || diff.changed.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-800">字段变化检测</h2>
            <p className="text-xs text-gray-500 mt-0.5">更新「{datasetName}」</p>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {!hasChanges ? (
            <div className="text-center py-6 text-sm text-gray-500">
              字段结构与原数据集完全一致，可以直接替换。
            </div>
          ) : (
            <>
              {diff.added.length > 0 && (
                <DiffSection icon={<Plus size={13} />} color="green" title={`新增 ${diff.added.length} 个字段`}>
                  {diff.added.map(key => <DiffRow key={key} color="green">{key}</DiffRow>)}
                </DiffSection>
              )}
              {diff.removed.length > 0 && (
                <DiffSection icon={<Minus size={13} />} color="red" title={`删除 ${diff.removed.length} 个字段`}>
                  {diff.removed.map(key => <DiffRow key={key} color="red">{key}</DiffRow>)}
                </DiffSection>
              )}
              {diff.changed.length > 0 && (
                <DiffSection icon={<RefreshCw size={13} />} color="yellow" title={`类型变化 ${diff.changed.length} 个字段`}>
                  {diff.changed.map(({ field, from, to }) => (
                    <DiffRow key={field} color="yellow">
                      <span className="font-medium">{field}</span>
                      <span className="text-current/60 text-xs ml-auto">
                        {TYPE_LABELS[from]} → {TYPE_LABELS[to]}
                      </span>
                    </DiffRow>
                  ))}
                </DiffSection>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-all">
            取消
          </button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all">
            {hasChanges ? '确认替换' : '直接替换'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DiffSection({ icon, color, title, children }: {
  icon: React.ReactNode;
  color: 'green' | 'red' | 'yellow';
  title: string;
  children: React.ReactNode;
}) {
  const styles = {
    green:  'bg-green-50 text-green-700',
    red:    'bg-red-50 text-red-700',
    yellow: 'bg-yellow-50 text-yellow-700',
  }[color];
  return (
    <div className={`rounded-xl overflow-hidden ${styles.split(' ')[0]}`}>
      <div className={`flex items-center gap-2 px-3 py-2 text-sm font-medium ${styles}`}>
        {icon}{title}
      </div>
      <div className={`px-3 pb-2 pt-1 space-y-1 ${styles}`}>{children}</div>
    </div>
  );
}

function DiffRow({ color, children }: { color: 'green' | 'red' | 'yellow'; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm py-0.5">{children}</div>
  );
}
