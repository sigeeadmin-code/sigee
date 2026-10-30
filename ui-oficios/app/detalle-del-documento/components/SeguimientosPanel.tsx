import React from 'react';
import Link from 'next/link';
import { Link2, Plus, ArrowUpRight } from 'lucide-react';
import { SEGUIMIENTOS_0142 } from '@/lib/oficios-data';
import { EstadoBadge } from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';

interface Props {
  onGenerar: () => void;
}

export default function SeguimientosPanel({ onGenerar }: Props) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Seguimientos enlazados</h3>
          <p className="text-xs text-muted-foreground">Documentos hijo que referencian el N° 0142-2026-UEIPP</p>
        </div>
        <button
          type="button"
          onClick={onGenerar}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-all duration-150 hover:bg-primary/90 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Generar informe de seguimiento
        </button>
      </div>
      {SEGUIMIENTOS_0142.length === 0 ? (
        <EmptyState
          icon={<Link2 className="h-6 w-6" />}
          title="Sin informes de seguimiento"
          description="Cuando evalúes si el estudiante mejoró, el informe quedará enlazado a este oficio con su propio número."
          actionLabel="Generar informe de seguimiento"
          onAction={onGenerar}
        />
      ) : (
        <ul className="divide-y divide-border">
          {SEGUIMIENTOS_0142.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 transition-colors duration-150 hover:bg-muted/40">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href="/" className="font-doc text-sm font-semibold text-primary hover:underline">
                    {s.numero}
                  </Link>
                  <EstadoBadge estado={s.estado} />
                </div>
                <p className="mt-1 text-sm font-medium text-foreground">{s.titulo}</p>
                <p className="text-xs text-muted-foreground">Creado el {s.fecha}</p>
              </div>
              <div className="flex items-center gap-5">
                <div className="text-right">
                  <p className="text-[12px] uppercase tracking-wide text-muted-foreground">Promedio inicial</p>
                  <p className="text-lg font-bold tabular text-foreground">{s.promedioInicial.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[12px] uppercase tracking-wide text-muted-foreground">Promedio siguiente</p>
                  <p className="text-lg font-bold tabular text-muted-foreground">
                    {s.promedioSiguiente === null ? 'Pendiente' : s.promedioSiguiente.toFixed(2)}
                  </p>
                </div>
                <Link
                  href="/"
                  className="inline-flex items-center gap-1 rounded-md border border-input px-3 py-1.5 text-sm font-medium text-secondary-foreground transition-all duration-150 hover:bg-muted active:scale-95"
                >
                  Abrir
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
