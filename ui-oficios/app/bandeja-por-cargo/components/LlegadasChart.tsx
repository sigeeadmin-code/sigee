'use client';

import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { LLEGADAS_DIARIAS } from '@/lib/oficios-data';

interface TipProps {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}

function CustomTip({ active, payload, label }: TipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
      <p className="mb-1 text-xs font-semibold text-foreground">{label}</p>
      {payload.map((p) => (
        <p key={`tip-${p.name}`} className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          {p.name === 'llegadas' ? 'Llegaron' : 'Resueltos'}:
          <span className="font-bold text-foreground tabular">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

export default function LlegadasChart() {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={LLEGADAS_DIARIAS} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
          <defs>
            <linearGradient id="grad-llegadas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.35} />
              <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="grad-resueltos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="dia" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTip />} />
          <Legend verticalAlign="top" align="right" iconType="circle" iconSize={8} formatter={(v: string) => (
            <span className="text-xs text-muted-foreground">{v === 'llegadas' ? 'Llegaron' : 'Resueltos'}</span>
          )} />
          <Area type="monotone" dataKey="llegadas" stroke="var(--accent)" strokeWidth={2} fill="url(#grad-llegadas)" />
          <Area type="monotone" dataKey="resueltos" stroke="var(--primary)" strokeWidth={2} fill="url(#grad-resueltos)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
