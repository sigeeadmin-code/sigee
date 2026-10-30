import React from 'react';
import { Check, AlertTriangle } from 'lucide-react';
import type { PasoRuta } from '@/lib/oficios-data';
import { CARGO_CORTO } from '@/lib/oficios-data';

export function RouteMini({ ruta }: { ruta: PasoRuta[] }) {
  return (
    <div className="flex items-center gap-1" aria-label="Avance de la ruta">
      {ruta.map((p) => (
        <span
          key={`mini-${p.orden}-${p.cargo}`}
          title={`${CARGO_CORTO[p.cargo]} — ${p.estado}`}
          className={`h-1.5 w-5 rounded-full ${
            p.estado === 'completado'
              ? 'bg-success'
              : p.estado === 'actual'
              ? 'bg-info'
              : p.estado === 'observado'
              ? 'bg-warning'
              : 'bg-border'
          }`}
        />
      ))}
    </div>
  );
}

export default function RouteStepper({ ruta }: { ruta: PasoRuta[] }) {
  return (
    <ol className="flex w-full items-start overflow-x-auto scroll-thin pb-1">
      {ruta.map((p, i) => {
        const last = i === ruta.length - 1;
        const circle =
          p.estado === 'completado'
            ? 'bg-success text-success-foreground border-success'
            : p.estado === 'actual'
            ? 'bg-info text-info-foreground border-info'
            : p.estado === 'observado'
            ? 'bg-warning text-warning-foreground border-warning'
            : 'bg-card text-muted-foreground border-input';
        return (
          <li key={`step-${p.orden}-${p.cargo}`} className="flex min-w-[112px] flex-1 flex-col">
            <div className="flex items-center">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold tabular ${circle}`}
              >
                {p.estado === 'completado' ? (
                  <Check className="h-4 w-4" />
                ) : p.estado === 'observado' ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : (
                  p.orden
                )}
              </span>
              {!last && (
                <span
                  className={`mx-2 h-0.5 flex-1 rounded-full ${p.estado === 'completado' ? 'bg-success' : 'bg-border'}`}
                />
              )}
            </div>
            <span className="mt-2 text-xs font-semibold text-foreground">{CARGO_CORTO[p.cargo]}</span>
            <span className="text-xs text-muted-foreground">
              {p.estado === 'completado'
                ? 'Aprobado'
                : p.estado === 'actual'
                ? 'En despacho'
                : p.estado === 'observado'
                ? 'Observó'
                : 'Pendiente'}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
