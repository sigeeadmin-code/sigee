import React from 'react';

type Tone = 'info' | 'alert' | 'warning' | 'success' | 'neutral';
const TONE: Record<Tone, string> = {
  info: 'border-l-4 border-l-sky-500',
  alert: 'border-l-4 border-l-red-500',
  warning: 'border-l-4 border-l-amber-500',
  success: 'border-l-4 border-l-emerald-500',
  neutral: 'border-l-4 border-l-slate-400',
};

interface Props {
  label: string; value: string; unit?: string; hint?: string; tone?: Tone; hero?: boolean;
  icon?: React.ReactNode; className?: string; children?: React.ReactNode;
}

export default function MetricCard({ label, value, unit, hint, tone = 'neutral', hero, icon, className = '', children }: Props) {
  return (
    <div className={`rounded-lg border border-border bg-card p-4 shadow-sm ${TONE[tone]} ${hero ? 'min-h-[120px]' : ''} ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <p className="mt-2 text-3xl font-extrabold tabular text-foreground">
        {value}{unit && <span className="ml-1 text-base font-semibold text-muted-foreground">{unit}</span>}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
