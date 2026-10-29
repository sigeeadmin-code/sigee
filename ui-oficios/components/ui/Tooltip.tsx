'use client';
import React, { useState } from 'react';

export default function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-2 py-1 text-[11px] font-medium text-background shadow">
          {label}
        </span>
      )}
    </span>
  );
}
