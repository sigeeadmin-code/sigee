import React from 'react';
import AppLayout from '@/components/AppLayout';
import EmisorMetrics from '@/app/components/EmisorMetrics';
import EmisorTable from '@/app/components/EmisorTable';

export default function BandejaEmisorPage() {
  return (
    <AppLayout
      title="Bandeja del emisor"
      subtitle="Lcda. Karina Zambrano · Tutora de 10mo A · U.E. Ismael Pérez Pazmiño"
    >
      <div className="space-y-5">
        <EmisorMetrics />
        <EmisorTable />
      </div>
    </AppLayout>
  );
}
