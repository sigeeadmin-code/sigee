import React from 'react';
import { etiquetaCargo, etiquetaTipo } from '../../lib/oficiosDocumental.js';
import { fmtFecha, LIMITE_VERSIONES } from '../../lib/oficiosVista.js';
import { EsperaTag, EstadoBadge } from './OficioUI.jsx';

/**
 * Lista de documentos. Un solo marcado: tabla en pantallas anchas y tarjetas apiladas en móvil
 * (las celdas llevan data-label y el CSS las convierte; no hay dos versiones de la lista).
 */
export default function OficiosTabla({ items, seleccionadoId, onSelect, nombreEst, vacio }) {
  if (!items.length) {
    return <div className="empty"><span className="ti ti-file-text" /><p>{vacio || 'No hay documentos para mostrar.'}</p></div>;
  }
  return (
    <div className="ofd-tabla-wrap">
      <table className="data ofd-tabla">
        <thead>
          <tr><th>N°</th><th>Documento</th><th>Estudiante</th><th>Estado</th><th>Despacho</th><th>En trámite</th><th>Actualizado</th></tr>
        </thead>
        <tbody>
          {items.map(d => {
            const paso = d.estado === 'en_ruta' ? (d.ruta || [])[d.paso_actual] : null;
            return (
              <tr key={d.id} className={(seleccionadoId === d.id ? 'ofd-sel ' : '') + (d.puede_actuar ? 'ofd-pend' : '')}>
                <td data-label="N°" className="ofd-num">{d.numero || 'Sin número'}</td>
                <td data-label="Documento" className="ofd-doc">
                  <button type="button" className="ofd-abrir" onClick={() => onSelect(d.id)} aria-label={`Abrir ${d.titulo || 'documento'}`}>
                    <strong>{d.titulo || 'Sin título'}</strong>
                  </button>
                  <small>
                    {etiquetaTipo(d.tipo)}
                    {d.es_seguimiento && ' · seguimiento'}
                    {d.version > LIMITE_VERSIONES && <span className="ofd-alerta-v"> · v{d.version}</span>}
                  </small>
                </td>
                <td data-label="Estudiante" className="ofd-est">
                  <span>{nombreEst(d.estudiante_id)}</span>
                  <small>{[d.curso, d.paralelo].filter(Boolean).join(' ')}</small>
                </td>
                <td data-label="Estado"><EstadoBadge estado={d.estado} /></td>
                <td data-label="Despacho">{paso ? etiquetaCargo(paso.cargo) : <span className="ofd-muted">—</span>}</td>
                <td data-label="En trámite"><EsperaTag doc={d} /></td>
                <td data-label="Actualizado" className="ofd-fecha">{fmtFecha(d.updated_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
