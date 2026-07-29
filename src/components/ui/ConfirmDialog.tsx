'use client';

import type { ReactNode } from 'react';
import { useModalA11y } from '@/hooks/useModalA11y';

interface ConfirmDialogProps {
  title: string;
  description: ReactNode;
  details?: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  description,
  details,
  confirmLabel = '确认删除',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useModalA11y<HTMLDivElement>(onCancel);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={onCancel} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          ref={dialogRef}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-description"
          tabIndex={-1}
          className="pointer-events-auto w-full max-w-md space-y-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl"
        >
          <div>
            <h2 id="confirm-dialog-title" className="text-sm font-semibold text-gray-900">{title}</h2>
            <div id="confirm-dialog-description" className="mt-1 text-xs leading-5 text-gray-500">
              {description}
            </div>
          </div>
          {details}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
            >
              取消
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
