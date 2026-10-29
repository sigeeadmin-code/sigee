import React from 'react';
import { CARGO_CORTO, type PasoRuta } from '@/lib/oficios-data';

export function RouteMini({ ruta }: { ruta: PasoRuta[] }) {
  return (
    <div className="flex items-center gap-1">
      {ruta.map((p, i) => (
        <React.Fragment key={`${p.cargo}-${i}`}>
          <span
            className={`h-2 w-2 rounded-full ${
              p.estado === 'aprobado' ? 'bg-success'
                : p.estado === 'actual' ? 'bg-primary ring-2 ring-primary/30'
                : p.estado === 'observado' ? 'bg-warning'
                : 'bg-muted-foreground/30'
            }`}
            title={`${CARGO_CORTO[p.cargo]} · ${p.estado}`}
          />
          {i < ruta.length - 1 && <span className="h-px w-3 bg-border" />}
        </React.Fragment>
      ))}
    </div>
  );
}
