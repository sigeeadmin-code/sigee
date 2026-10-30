import React from 'react';
import Link from 'next/link';
import { ChevronLeft, UserRound, GraduationCap, CalendarClock, AlertOctagon } from 'lucide-react';
import { EstadoBadge, TipoBadge, VersionChip } from '@/components/ui/Badge';
import RouteStepper from '@/components/ui/RouteStepper';
import type { PasoRuta } from '@/lib/oficios-data';

interface Props {
  ruta: PasoRuta[];
}

export default function DocumentoHeader({ ruta }: Props) {
  return (
    <section aria-label="Cabecera del documento" className="fade-up rounded-lg border border-border bg-card print-hide">
      <div className="border-b border-border px-5 py-4">
        <Link
          href="/"
          className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Volver a la bandeja del emisor
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-doc text-2xl font-semibold text-foreground">0142-2026-UEIPP</h2>
              <EstadoBadge estado="observado" />
              <TipoBadge tipo="oficio_alerta" />
              <VersionChip version={2} />
            </div>
            <p className="mt-1.5 max-w-3xl text-base font-medium text-foreground">
              Citación a reunión por bajo rendimiento en Matemática y Física
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <GraduationCap className="h-4 w-4" />
                Mateo Andrés Cárdenas Loaiza · 10mo A · CI 0705381246
              </span>
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="h-4 w-4" />
                Emisor: Lcda. Karina Zambrano (Tutora)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4" />
                Emitido 24/10/2026 08:05 · periodo 2026-2027
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Ruta de aprobación</p>
          <p className="text-xs text-muted-foreground">Oficio de alerta · Tutor → Inspector → Rector</p>
        </div>
        <RouteStepper ruta={ruta} />
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 px-3.5 py-3 text-sm text-warning">
          <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <span className="font-semibold">Devuelto por el Rector (27/10/2026 15:12):</span> Detallar acciones de refuerzo sugeridas para la familia antes de la citación. Corrige la plantilla y reenvía para continuar en el paso del Rector.
          </p>
        </div>
      </div>
    </section>
  );
}
