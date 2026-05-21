'use client';

import { useState, useRef } from 'react';
import { Upload, CheckCircle, AlertCircle, Loader2, Database, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { DataVersion } from '@/types';
import { useEffect } from 'react';

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed]   = useState(false);
  const [file, setFile]       = useState<File | null>(null);
  const [status, setStatus]   = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [result, setResult]   = useState<{ versionId: number; recordCount: number } | null>(null);
  const [errMsg, setErrMsg]   = useState('');
  const [versions, setVersions] = useState<DataVersion[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authed) return;
    supabase
      .from('data_versions')
      .select('*')
      .order('version_id', { ascending: false })
      .limit(10)
      .then(({ data }) => setVersions((data as DataVersion[]) || []));
  }, [authed, result]);

  async function handleUpload() {
    if (!file) return;
    setStatus('uploading');
    setErrMsg('');

    const form = new FormData();
    form.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'x-admin-password': password },
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '上传失败');
      setResult({ versionId: json.versionId, recordCount: json.recordCount });
      setStatus('success');
      setFile(null);
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : '上传失败');
      setStatus('error');
    }
  }

  if (!authed) {
    return (
      <div className="max-w-sm mx-auto mt-20 space-y-4 animate-slide-up">
        <div className="glass-card p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#007AFF]/10 flex items-center justify-center mx-auto mb-6">
            <Database size={24} className="text-[#007AFF]" />
          </div>
          <h2 className="text-[20px] font-700 text-black/80 mb-1">数据管理</h2>
          <p className="text-[13px] text-black/40 mb-6">请输入管理密码继续</p>
          <input
            type="password"
            className="input-ios mb-4"
            placeholder="管理密码"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && setAuthed(true)}
          />
          <button
            onClick={() => setAuthed(true)}
            className="btn-ios btn-primary w-full"
          >
            进入管理
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-slide-up">
      {/* 上传区域 */}
      <div className="glass-card p-6">
        <h2 className="text-[17px] font-600 text-black/80 mb-4">上传新数据</h2>

        {/* 拖拽区 */}
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f?.name.endsWith('.xlsx')) setFile(f);
          }}
          className={cn(
            'border-2 border-dashed rounded-ios-xl p-10 text-center cursor-pointer transition-all',
            dragging
              ? 'border-[#007AFF] bg-[#007AFF]/05'
              : file
              ? 'border-[#34C759] bg-[#34C759]/04'
              : 'border-black/12 hover:border-[#007AFF]/40 hover:bg-[#007AFF]/02'
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={e => setFile(e.target.files?.[0] || null)}
          />
          <Upload size={28} className={cn('mx-auto mb-3', file ? 'text-[#34C759]' : 'text-black/30')} />
          {file ? (
            <>
              <div className="text-[14px] font-600 text-[#34C759]">{file.name}</div>
              <div className="text-[12px] text-black/40 mt-1">
                {(file.size / 1024).toFixed(1)} KB · 点击重新选择
              </div>
            </>
          ) : (
            <>
              <div className="text-[14px] text-black/50">将 .xlsx 文件拖到此处</div>
              <div className="text-[12px] text-black/30 mt-1">或点击选择文件</div>
            </>
          )}
        </div>

        {/* 说明 */}
        <div className="glass-card-subtle p-3 mt-3 text-[12px] text-black/45 space-y-0.5">
          <div>• 文件格式：Excel (.xlsx)，Sheet1 为数据表</div>
          <div>• 必须包含列：姓名、大区、省份、城市、年龄段、学历、职业等 19 列</div>
          <div>• 上传后将完全替换当前数据，原数据仍保留可回滚</div>
          <div>• 职业清洗将自动调用 DeepSeek API（会缓存，同一职业不重复计费）</div>
        </div>

        {/* 操作区 */}
        <div className="flex items-center justify-between mt-4">
          <div className="text-[12px] text-black/35">
            已登录 · 数据将完全替换
          </div>
          <button
            onClick={handleUpload}
            disabled={!file || status === 'uploading'}
            className={cn(
              'btn-ios btn-primary',
              (!file || status === 'uploading') && 'opacity-50 cursor-not-allowed'
            )}
          >
            {status === 'uploading' ? (
              <><Loader2 size={14} className="animate-spin" /> 处理中…</>
            ) : '开始上传'}
          </button>
        </div>

        {/* 状态反馈 */}
        {status === 'success' && result && (
          <div className="mt-3 glass-card-subtle p-3 flex items-center gap-2 border border-[#34C759]/20">
            <CheckCircle size={16} className="text-[#34C759] flex-shrink-0" />
            <span className="text-[13px] text-black/65">
              数据版本 v{result.versionId} 已激活，共 {result.recordCount.toLocaleString()} 条记录
            </span>
          </div>
        )}
        {status === 'error' && (
          <div className="mt-3 glass-card-subtle p-3 flex items-center gap-2 border border-[#FF3B30]/20">
            <AlertCircle size={16} className="text-[#FF3B30] flex-shrink-0" />
            <span className="text-[13px] text-black/65">{errMsg}</span>
          </div>
        )}
      </div>

      {/* 版本历史 */}
      {versions.length > 0 && (
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <History size={15} className="text-black/40" />
            <h2 className="text-[15px] font-600 text-black/70">版本历史</h2>
          </div>
          <div className="space-y-2">
            {versions.map(v => (
              <div
                key={v.version_id}
                className={cn(
                  'flex items-center justify-between px-3 py-2.5 rounded-ios transition-all',
                  v.is_active ? 'bg-[#007AFF]/06 border border-[#007AFF]/15' : 'hover:bg-black/03'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <div className={cn(
                    'w-2 h-2 rounded-full',
                    v.is_active ? 'bg-[#34C759]' : 'bg-black/15'
                  )} />
                  <div>
                    <span className="text-[13px] font-500 text-black/70">v{v.version_id}</span>
                    <span className="text-[12px] text-black/40 ml-2">
                      {v.record_count.toLocaleString()} 条
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {v.is_active && <span className="badge-ios badge-green">当前</span>}
                  <span className="text-[11px] text-black/35">
                    {new Date(v.uploaded_at).toLocaleString('zh-CN', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
