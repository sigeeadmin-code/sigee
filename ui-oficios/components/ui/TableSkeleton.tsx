import React from 'react';

export default function TableSkeleton({ rows = 8, cols = 8 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }, (_, r) => (
        <div key={`skeleton-row-${r + 1}`} className="flex items-center gap-4 px-4 py-3.5">
          {Array.from({ length: cols }, (_, c) => (
            <div
              key={`skeleton-cell-${r + 1}-${c + 1}`}
              className={`h-4 animate-pulse rounded bg-muted ${c === 1 ? 'flex-[2]' : 'flex-1'}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
