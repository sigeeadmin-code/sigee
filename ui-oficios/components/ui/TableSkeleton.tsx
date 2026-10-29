import React from 'react';

export default function TableSkeleton({ rows = 6, cols = 8 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 p-4" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={`sk-r-${r}`} className="flex gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={`sk-c-${r}-${c}`} className="h-8 flex-1 animate-pulse rounded bg-muted" style={{ animationDelay: `${(r * cols + c) * 30}ms` }} />
          ))}
        </div>
      ))}
    </div>
  );
}
