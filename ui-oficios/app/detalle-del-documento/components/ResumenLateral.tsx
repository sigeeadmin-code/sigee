import React from 'react';
import { Clock3, Hash, UserRound, BookOpen } from 'lucide-react';

/** Resumen lateral del documento 0142 — prototipo estático para referencia UX */
export default function ResumenLateral() {
  return (
    <section aria-label="Resumen del caso" className="rounded-lg border border-border bg-card print-hide">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-base font-semibold text-foreground">Resumen del caso</h3>
        <p className="text-xs text-muted-foreground">Datos fijos del oficio de alerta</p>
      </div>
      <dl className="space-y-3 p-4 text-sm">
        <div className="flex items-start gap-3">
          <Hash className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <dt className="text-xs text-muted-foreground">Número</dt>
            <dd className="font-doc font-semibold text-primary">0142-2026-UEIPP</dd>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <dt className="text-xs text-muted-foreground">Estudiante</dt>
            <dd className="font-medium text-foreground">Mateo Andrés Cárdenas Loaiza</dd>
            <dd className="font-doc text-xs text-muted-foreground">CI 0705381246 · 10mo A</dd>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <dt className="text-xs text-muted-foreground">Periodo / plantel</dt>
            <dd className="text-foreground">2026-2027 · UEIPP (07H00094)</dd>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <dt className="text-xs text-muted-foreground">En trámite</dt>
            <dd className="font-semibold tabular text-warning">3 d 2 h</dd>
            <dd className="text-xs text-muted-foreground">Desde emisión 24/10/2026</dd>
          </div>
        </div>
      </dl>
      <div className="border-t border-border px-4 py-3">
        <p className="text-xs text-muted-foreground">
          SLA institucional: 3 días hábiles para cierre de oficios de alerta. Este caso supera la meta.
        </p>
      </div>
    </section>
  );
}
