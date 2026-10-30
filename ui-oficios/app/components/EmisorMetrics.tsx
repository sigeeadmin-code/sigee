import React from 'react';
import { AlertTriangle, Route, FileEdit, Timer, ShieldAlert, CheckCheck } from 'lucide-react';
import MetricCard from '@/components/ui/MetricCard';
import CargaEstadoChart from '@/app/components/CargaEstadoChart';

export default function EmisorMetrics() {
  return (
    <section aria-label="Resumen de tus documentos" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        hero
        tone="warning"
        label="Observados por corregir"
        value="2"
        hint="Devueltos por Rector y por DECE. El más antiguo lleva 4 días sin corregir."
        icon={<AlertTriangle className="h-5 w-5" />}
        className="sm:col-span-2"
      >
        <div className="flex flex-wrap gap-2">
          <span className="rounded-md bg-warning/15 px-2 py-1 font-doc text-xs font-semibold text-warning">0142-2026-UEIPP</span>
          <span className="rounded-md bg-destructive/10 px-2 py-1 font-doc text-xs font-semibold text-destructive">0138-2026-UEIPP · v6</span>
        </div>
      </MetricCard>

      <MetricCard
        tone="info"
        label="En ruta"
        value="4"
        hint="Esperando firma en Inspector, DECE o Secretaría."
        icon={<Route className="h-5 w-5" />}
      />

      <MetricCard
        tone="neutral"
        label="Borradores"
        value="2"
        hint="Sin enviar. Ficha 0155 y seguimiento 0156."
        icon={<FileEdit className="h-5 w-5" />}
      />

      <MetricCard
        tone="alert"
        label="Versión mayor a 5"
        value="1"
        hint="El acta 0138 va por la versión 6: revisar con Inspección."
        icon={<ShieldAlert className="h-5 w-5" />}
      />

      <MetricCard
        tone="success"
        label="Tiempo medio de trámite"
        value="3,8"
        unit="días"
        hint="Meta institucional: 3 días. Bajó 0,4 días frente a septiembre."
        icon={<Timer className="h-5 w-5" />}
      />

      <div className="fade-up rounded-lg border border-border bg-card p-4 sm:col-span-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-medium uppercase tracking-wide text-muted-foreground">Carga por estado</p>
            <p className="text-sm text-muted-foreground">12 documentos del periodo 2026-2027</p>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/15 text-success">
            <CheckCheck className="h-5 w-5" />
          </span>
        </div>
        <div className="mt-2">
          <CargaEstadoChart />
        </div>
      </div>
    </section>
  );
}
