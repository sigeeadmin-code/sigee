import React from 'react';
import { TIPO_LABEL, type TipoDocumento } from '@/lib/oficios-data';

const TIPO_COLOR: Record<TipoDocumento, string> = {
  oficio_alerta: 'bg-sky-100 text-sky-800',
  ficha_tutor: 'bg-violet-100 text-violet-800',
  plan_refuerzo: 'bg-amber-100 text-amber-900',
  acta_compromiso: 'bg-emerald-100 text-emerald-800',
  oficio_faltas: 'bg-rose-100 text-rose-800',
  informe_seguimiento: 'bg-slate-100 text-slate-800',
};

export function TipoBadge({ tipo }: { tipo: TipoDocumento }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-semibold ${TIPO_COLOR[tipo]}`}>
      {TIPO_LABEL[tipo]}
    </span>
  );
}

export function VersionChip({ version }: { version: number }) {
  const alert = version > 5;
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold tabular ${
      alert ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground'
    }`} title={alert ? 'Más de 5 versiones — revisar saturación' : undefined}>
      v{version}
    </span>
  );
}
