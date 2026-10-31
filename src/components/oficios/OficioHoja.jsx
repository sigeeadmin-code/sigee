import React, { useEffect, useRef, useState } from 'react';
import DocumentoEditable from '../DocumentoEditable.jsx';
import { ACCIONES_HISTORIAL, etiquetaCargo, etiquetaTipo } from '../../lib/oficiosDocumental.js';
import { firmantesPorCargo, fmtEspera, fmtFecha } from '../../lib/oficiosVista.js';

/** Hoja del documento. Con `datos_plantilla.documento` usa la misma hoja de SIGEE (editable o de impresión);
 *  los trámites antiguos, sin hoja estructurada, se dibujan con el formato general. */
export default function OficioHoja({ doc, editable = false, onCambio, institucion, nombreEstudiante }) {
  const hoja = doc.datos_plantilla?.documento;
  if (hoja) return <DocumentoEditable doc={hoja} editable={editable} onCambio={onCambio} />;
  const firmas = firmantesPorCargo(doc);
  return (
    <div className="oficio-hoja ofd-hoja">
      <header className="ofd-hoja-h">
        {institucion?.logo && <img src={institucion.logo} alt="" />}
        <div><strong>{institucion?.nombre || 'Institución educativa'}</strong>{institucion?.amie && <span>AMIE {institucion.amie}</span>}</div>
      </header>
      <h1 className="ofd-hoja-t">{etiquetaTipo(doc.tipo)}</h1>
      {doc.numero && <p className="ofd-hoja-n">N.° {doc.numero}</p>}
      <dl className="ofd-hoja-d">
        <div><dt>Asunto</dt><dd>{doc.asunto || doc.titulo}</dd></div>
        <div><dt>Estudiante</dt><dd>{nombreEstudiante}</dd></div>
        {(doc.curso || doc.paralelo) && <div><dt>Curso</dt><dd>{[doc.curso, doc.paralelo].filter(Boolean).join(' ')}</dd></div>}
        <div><dt>Fecha de emisión</dt><dd>{fmtFecha(doc.created_at)}</dd></div>
      </dl>
      <div className="ofd-hoja-cuerpo">{doc.datos_plantilla?.notas || doc.asunto || doc.titulo}</div>
      <div className="ofd-hoja-firmas">
        {[['Tutor', firmas.tutor || doc.emisor_nombre], ['Inspector General', firmas.inspector_general], ['Representante legal', doc.entrega?.recibido_por]].map(([c, n]) => (
          <div key={c}><span className="ofd-firma-l" /><strong>{c}</strong><small>{n || ' '}</small></div>
        ))}
      </div>
    </div>
  );
}

/** Anexo interno: recorrido completo con tiempos (solo «vista con recorrido»). */
export function AnexoRecorrido({ doc }) {
  return (
    <div className="oficio-hoja ofd-hoja">
      <p className="ofd-hoja-int">Uso interno · anexo de recorrido (auditoría)</p>
      <h2 className="ofd-anexo-t">Recorrido del trámite {doc.numero || ''}</h2>
      <table className="of-tabla">
        <thead><tr><th>#</th><th>Cargo</th><th>Acción</th><th>Responsable</th><th>Fecha</th><th>Espera</th><th>Comentario</th><th>v</th></tr></thead>
        <tbody>
          {(doc.historial_recorrido || []).map((h, i) => (
            <tr key={i}>
              <td>{h.orden ?? i}</td><td>{etiquetaCargo(h.cargo)}</td><td>{ACCIONES_HISTORIAL[h.accion] || h.accion}</td>
              <td>{h.usuario_nombre || ''}</td><td>{fmtFecha(h.fecha_accion)}</td><td>{h.tiempo_espera != null ? fmtEspera(h.tiempo_espera) : ''}</td>
              <td>{h.comentario || ''}</td><td>{h.version_pdf ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ANCHO_A4_PX = 794;   // 210 mm a 96 dpi

/** Ajusta la hoja A4 al ancho disponible (zoom). En pantallas estrechas ofrece «Ampliar» para leerla a un tamaño cómodo
 *  (con desplazamiento horizontal dentro del visor). */
export function HojaAjustada({ children }) {
  const caja = useRef(null);
  const [auto, setAuto] = useState(1);
  const [ampliado, setAmpliado] = useState(false);
  useEffect(() => {
    const el = caja.current; if (!el) return undefined;
    const medir = () => setAuto(Math.min(1, Math.max(0.3, (el.clientWidth - 24) / ANCHO_A4_PX)));
    medir();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    ro?.observe(el); window.addEventListener('resize', medir);
    return () => { ro?.disconnect(); window.removeEventListener('resize', medir); };
  }, []);
  const hayZoom = auto < 0.8;
  const zoom = ampliado && hayZoom ? 0.85 : auto;
  return (
    <div className="ofd-hoja-caja" ref={caja}>
      {hayZoom && (
        <button type="button" className="btn btn-secondary btn-sm ofd-zoom-btn" onClick={() => setAmpliado(v => !v)} aria-pressed={ampliado}>
          <span className={'ti ' + (ampliado ? 'ti-zoom-out' : 'ti-zoom-in')} /> {ampliado ? 'Ajustar a la pantalla' : 'Ampliar para leer'}
        </button>
      )}
      <div className={'ofd-hoja-scroll' + (ampliado && hayZoom ? ' ofd-scroll-x' : '')}><div className="ofd-hoja-zoom" style={{ zoom }}>{children}</div></div>
    </div>
  );
}
