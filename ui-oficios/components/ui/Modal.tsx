'use client';
import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean; onClose: () => void; title: string; description?: string;
  size?: 'sm' | 'md' | 'lg'; children: React.ReactNode;
}
const MAX = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' } as const;

export default function Modal({ open, onClose, title, description, size = 'md', children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className={`w-full ${MAX[size]} overflow-hidden rounded-xl border border-border bg-card shadow-2xl`}>
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-foreground">{title}</h3>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
