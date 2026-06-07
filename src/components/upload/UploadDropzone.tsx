'use client';

import { useRef, useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UploadDropzoneProps {
  onFile: (file: File) => void | Promise<void>;
  loading?: boolean;
  className?: string;
}

const ACCEPTED = ['.xlsx', '.xls', '.csv', '.json'];
const MAX_SIZE_MB = 50;

export function UploadDropzone({ onFile, loading = false, className }: UploadDropzoneProps) {
  const [dragging, setDragging]       = useState(false);
  const [sizeWarning, setSizeWarning] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED.includes(ext)) {
      alert(`不支持 "${ext}" 格式，请上传 ${ACCEPTED.join(' / ')}`);
      return;
    }
    const mb = file.size / 1024 / 1024;
    setSizeWarning(mb > MAX_SIZE_MB ? `文件较大（${mb.toFixed(1)} MB），解析可能较慢` : '');
    onFile(file);
  }, [onFile]);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div
        onClick={() => !loading && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'relative border-2 border-dashed rounded-2xl p-10 text-center transition-all select-none',
          dragging  ? 'border-blue-400 bg-blue-50 cursor-copy' :
          loading   ? 'border-gray-200 bg-gray-50 cursor-default' :
                      'border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 cursor-pointer'
        )}
      >
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={36} className="text-blue-500 animate-spin" />
            <p className="text-sm text-gray-500 font-medium">解析中，请稍候…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className={cn(
              'w-14 h-14 rounded-2xl flex items-center justify-center transition-colors',
              dragging ? 'bg-blue-100' : 'bg-gray-100'
            )}>
              {dragging
                ? <Upload size={24} className="text-blue-500" />
                : <FileSpreadsheet size={24} className="text-gray-400" />
              }
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">
                {dragging ? '松开以上传' : '拖放文件到此，或点击选择'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                支持 {ACCEPTED.join(' · ')}，最大 {MAX_SIZE_MB} MB
              </p>
            </div>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(',')}
          onChange={onInputChange}
          className="hidden"
        />
      </div>
      {sizeWarning && (
        <div className="flex items-center gap-2 text-xs text-orange-600 px-1">
          <AlertCircle size={12} />
          {sizeWarning}
        </div>
      )}
    </div>
  );
}
