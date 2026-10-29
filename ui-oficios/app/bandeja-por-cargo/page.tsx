import React from 'react';
import AppLayout from '@/components/AppLayout';
import CargoMetrics from '@/app/bandeja-por-cargo/components/CargoMetrics';
import DespachoTable from '@/app/bandeja-por-cargo/components/DespachoTable';

export default function BandejaPorCargoPage() {
  return (
    <AppLayout
      title="Bandeja por cargo"
      subtitle="Mgs. Ricardo Palacios · Inspector General · documentos pendientes de tu decisión"
    >
      <div className="space-y-5">
        <CargoMetrics />
        <DespachoTable />
      </div>
    </AppLayout>
  );
}
