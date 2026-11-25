import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PanelPlantelGlobal from '../components/PanelPlantelGlobal.jsx';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Dashboard de un plantel para el Admin global: /instituciones/:id (se abre desde la lista de Planteles).
export default function PlantelDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  if (!UUID.test(id || '')) {
    return (
      <div>
        <p style={{ fontSize: 13 }}>El enlace del plantel no es válido.</p>
        <button className="btn btn-secondary" onClick={() => navigate('/instituciones')}>← Volver a Planteles</button>
      </div>
    );
  }
  return <PanelPlantelGlobal plantelId={id} onVolver={() => navigate('/instituciones')} />;
}
