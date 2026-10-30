'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { CARGA_POR_ESTADO } from '@/lib/oficios-data';

interface TipProps {
  active?: boolean;
  payload?: { value: number; payload: { estado: string } }[];
}

function CustomTip({ active, payload }: TipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-xs text-muted-foreground">{payload[0].payload.estado}</p>
      <p className="text-sm font-bold text-foreground tabular">{payload[0].value} documentos</p>
    </div>
  );
}

const COLORES: Record<string, string> = {
  Borrador: 'var(--muted-foreground)',
  Observado: 'var(--warning)',
  'En ruta': 'var(--info)',
  Aprobado: 'var(--success)',
  Entregado: 'var(--success)',
  Archivado: 'var(--input)',
  Rechazado: 'var(--destructive)',
};

export default function CargaEstadoChart() {
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={CARGA_POR_ESTADO} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="estado" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTip />} cursor={{ fill: 'var(--muted)' }} />
          <Bar dataKey="cantidad" radius={[5, 5, 0, 0]} maxBarSize={36}>
            {CARGA_POR_ESTADO.map((d) => (
              <Cell key={`cell-estado-${d.estado}`} fill={COLORES[d.estado]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
