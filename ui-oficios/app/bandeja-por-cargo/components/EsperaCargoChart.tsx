'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { ESPERA_POR_CARGO } from '@/lib/oficios-data';

interface TipProps {
  active?: boolean;
  payload?: { value: number; payload: { cargo: string } }[];
}

function CustomTip({ active, payload }: TipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-xs text-muted-foreground">{payload[0].payload.cargo}</p>
      <p className="text-sm font-bold text-foreground tabular">{payload[0].value} h de espera media</p>
    </div>
  );
}

export default function EsperaCargoChart() {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={ESPERA_POR_CARGO} layout="vertical" margin={{ top: 4, right: 24, left: 10, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} unit=" h" />
          <YAxis type="category" dataKey="cargo" width={72} tick={{ fontSize: 12, fill: 'var(--foreground)' }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTip />} cursor={{ fill: 'var(--muted)' }} />
          <ReferenceLine x={24} stroke="var(--accent)" strokeDasharray="4 4" label={{ value: 'SLA 24 h', fill: 'var(--accent)', fontSize: 11, position: 'top' }} />
          <Bar dataKey="horas" radius={[0, 5, 5, 0]} maxBarSize={20}>
            {ESPERA_POR_CARGO.map((d) => (
              <Cell key={`cell-cargo-${d.cargo}`} fill={d.horas > 48 ? 'var(--destructive)' : d.horas > 24 ? 'var(--warning)' : 'var(--success)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
