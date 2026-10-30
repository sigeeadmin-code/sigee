import React from 'react';
import AppLayout from '@/components/AppLayout';
import DocumentoHeader from '@/app/detalle-del-documento/components/DocumentoHeader';
import DetalleTabs from '@/app/detalle-del-documento/components/DetalleTabs';
import type { PasoRuta } from '@/lib/oficios-data';

const RUTA_0142: PasoRuta[] = [
  { orden: 1, cargo: 'tutor', estado: 'completado' },
  { orden: 2, cargo: 'inspector_general', estado: 'completado' },
  { orden: 3, cargo: 'rector', estado: 'observado' },
];

export default function DetalleDocumentoPage() {
  return (
    <AppLayout
      title="Detalle del documento"
      subtitle="Un caso · un documento · un PDF por versión · recorrido con firmas"
    >
      <div className="space-y-5">
        <DocumentoHeader ruta={RUTA_0142} />
        <DetalleTabs />
      </div>
    </AppLayout>
  );
}
