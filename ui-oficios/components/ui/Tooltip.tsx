import React from 'react';

interface TooltipProps {
  label: string;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom';
  className?: string;
}

export default function Tooltip({ label, children, side = 'top', className = '' }: TooltipProps) {
  const pos =
    side === 'top'
      ? 'bottom-full left-1/2 -translate-x-1/2 mb-1.5'
      : side === 'right'
      ? 'left-full top-1/2 -translate-y-1/2 ml-2'
      : 'top-full left-1/2 -translate-x-1/2 mt-1.5';
  return (
    <span className={`group/tip relative inline-flex ${className}`}>
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-50 ${pos} whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100`}
      >
        {label}
      </span>
    </span>
  );
}
