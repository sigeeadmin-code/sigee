import React from 'react';

export type MetricTone = 'neutral' | 'alert' | 'warning' | 'success' | 'info';

interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  hint: string;
  icon: React.ReactNode;
  tone?: MetricTone;
  hero?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const TONE: Record<MetricTone, { wrap: string; icon: string; value: string }> = {
  neutral: { wrap: 'bg-card border-border', icon: 'bg-muted text-secondary-foreground', value: 'text-foreground' },
  alert: { wrap: 'bg-destructive/5 border-destructive/30', icon: 'bg-destructive/15 text-destructive', value: 'text-destructive' },
  warning: { wrap: 'bg-warning/5 border-warning/30', icon: 'bg-warning/15 text-warning', value: 'text-warning' },
  success: { wrap: 'bg-success/5 border-success/25', icon: 'bg-success/15 text-success', value: 'text-success' },
  info: { wrap: 'bg-info/5 border-info/25', icon: 'bg-info/15 text-info', value: 'text-info' },
};

export default function MetricCard({
  label,
  value,
  unit,
  hint,
  icon,
  tone = 'neutral',
  hero = false,
  className = '',
  children,
}: MetricCardProps) {
  const t = TONE[tone];
  return (
    <div
      className={`fade-up flex flex-col justify-between rounded-lg border p-4 transition-shadow duration-150 hover:shadow-md ${t.wrap} ${hero ? 'p-5' : ''} ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${t.icon}`}>{icon}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className={`font-bold tabular leading-none ${hero ? 'text-5xl' : 'text-3xl'} ${t.value}`}>{value}</span>
        {unit && <span className="text-sm font-medium text-muted-foreground">{unit}</span>}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
