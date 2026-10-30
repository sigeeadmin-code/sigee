import React from 'react';
import type { EstadoDocumento, TipoDocumento } from '@/lib/oficios-data';
import { ESTADO_LABEL, TIPO_CORTO } from '@/lib/oficios-data';

const ESTADO_STYLE: Record<EstadoDocumento, string> = {
  borrador: 'bg-muted text-muted-foreground ring-border',
  en_ruta: 'bg-info/10 text-info ring-info/25',
  observado: 'bg-warning/10 text-warning ring-warning/30',
  aprobado_final: 'bg-success/10 text-success ring-success/25',
  entregado: 'bg-success/15 text-success ring-success/30',
  archivado: 'bg-secondary text-secondary-foreground ring-border',
  rechazado: 'bg-destructive/10 text-destructive ring-destructive/25',
};

const ESTADO_DOT: Record<EstadoDocumento, string> = {
  borrador: 'bg-muted-foreground',
  en_ruta: 'bg-info',
  observado: 'bg-warning',
  aprobado_final: 'bg-success',
  entregado: 'bg-success',
  archivado: 'bg-muted-foreground',
  rechazado: 'bg-destructive',
};

export function EstadoBadge({ estado, className = '' }: { estado: EstadoDocumento; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset whitespace-nowrap ${ESTADO_STYLE[estado]} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ESTADO_DOT[estado]} ${estado === 'observado' ? 'pulse-dot' : ''}`} />
      {ESTADO_LABEL[estado]}
    </span>
  );
}

const TIPO_STYLE: Record<TipoDocumento, string> = {
  oficio_alerta: 'bg-accent/10 text-accent ring-accent/25',
  ficha_tutor: 'bg-secondary text-secondary-foreground ring-border',
  plan_refuerzo: 'bg-primary/10 text-primary ring-primary/25',
  acta_compromiso: 'bg-info/10 text-info ring-info/25',
  oficio_faltas: 'bg-destructive/10 text-destructive ring-destructive/25',
  informe_seguimiento: 'bg-success/10 text-success ring-success/25',
};

export function TipoBadge({ tipo }: { tipo: TipoDocumento }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset whitespace-nowrap ${TIPO_STYLE[tipo]}`}
    >
      {TIPO_CORTO[tipo]}
    </span>
  );
}

export function VersionChip({ version }: { version: number }) {
  const alerta = version > 5;
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-semibold font-doc tabular ring-1 ring-inset ${
        alerta
          ? 'bg-destructive/10 text-destructive ring-destructive/30'
          : 'bg-muted text-muted-foreground ring-border'
      }`}
      title={alerta ? 'Versión superior a 5: revisar posible abuso de correcciones' : `Versión ${version}`}
    >
      v{version}
    </span>
  );
}
