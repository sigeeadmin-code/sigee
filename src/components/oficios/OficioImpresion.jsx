import React from 'react';
import { createPortal } from 'react-dom';
import OficioHoja, { AnexoRecorrido } from './OficioHoja.jsx';

/**
 * Hoja imprimible. «entrega»: limpia, para el representante. «recorrido»: misma hoja + anexo interno de auditoría.
 * Se monta directamente en <body> (como las demás hojas del sistema): la regla de impresión oculta el resto de la app.
 */
export default function OficioImpresion({ doc, modo, nombreEstudiante, institucion }) {
  return createPortal(
    <div className="oficio-print">
      <OficioHoja doc={doc} institucion={institucion} nombreEstudiante={nombreEstudiante} />
      {modo === 'recorrido' && <AnexoRecorrido doc={doc} />}
    </div>,
    document.body
  );
}
