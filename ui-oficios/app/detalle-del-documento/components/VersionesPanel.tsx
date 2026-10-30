import React from 'react';
import { GitCommitHorizontal, Hash, ShieldAlert } from 'lucide-react';
import { VERSIONES_0142 } from '@/lib/oficios-data';

export default function VersionesPanel() {
  const actual = VERSIONES_0142?.find((v) => v?.vigente);
  const alerta = (actual?.version ?? 0) > 5;

  return (
    <div className="space-y-4">
      <div
        className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
          alerta
            ? 'border-destructive/30 bg-destructive/5 text-destructive'
            : 'border-success/25 bg-success/5 text-success'
        }`}
      >
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="font-medium">
          {alerta
            ? `Alerta anti-abuso: la versión ${actual?.version} supera el límite de 5 correcciones.`
            : `Versión ${actual?.version} de 5 permitidas antes de la alerta anti-abuso. Aún dentro del rango normal.`}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-base font-semibold text-foreground">Versiones del PDF maestro</h3>
          <p className="text-xs text-muted-foreground">
            Un solo PDF por versión de contenido. Las aprobaciones y observaciones no generan archivos nuevos.
          </p>
        </div>
        <ul className="divide-y divide-border">
          {VERSIONES_0142?.map((v) => (
            <li key={v?.id} className="flex flex-wrap items-start gap-4 px-4 py-4">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                  v?.vigente ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                <GitCommitHorizontal className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-doc text-base font-semibold text-foreground">Versión {v?.version}</p>
                  {v?.vigente && (
                    <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">
                      Vigente
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-foreground">{v?.cambio}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {v?.autor} · {v?.fecha}
                </p>
              </div>
              <div className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
                <Hash className="h-3.5 w-3.5" />
                <span className="font-doc font-semibold text-foreground">{v?.hash}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
