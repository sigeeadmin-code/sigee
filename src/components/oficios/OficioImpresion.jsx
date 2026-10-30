import React from 'react';
import { ACCIONES_HISTORIAL, etiquetaCargo, etiquetaTipo } from '../../lib/oficiosDocumental.js';
import { firmantesPorCargo, fmtEspera, fmtFecha } from '../../lib/oficiosVista.js';

/**
 * Hoja imprimible. «entrega»: limpia, para el representante (firmas de tutor, inspector y representante).
 * «recorrido»: misma hoja + anexo interno para auditoría. Reutiliza .oficio-hoja y el mecanismo
 * body.imprimiendo-oficio que ya usan los oficios y fichas del sistema (márgenes incluidos).
 */
export default function OficioImpresion({ doc, modo, nombreEstudiante, institucion }) {
  const conRecorrido = modo === 'recorrido';
  const firmas = firmantesPorCargo(doc);
  const bloques = [
    { cargo: 'Tutor', nombre: firmas.tutor || doc.emisor_nombre },
    { cargo: 'Inspector General', nombre: firmas.inspector_general },
    { cargo: 'Representante legal', nombre: doc.entrega?.recibido_por }
  ];
  return (
    <div className="oficio-print">
      <div className="oficio-hoja ofd-hoja">
        <header className="ofd-hoja-h">
          {institucion?.logo && <img src={institucion.logo} alt="" />}
          <div>
            <strong>{institucion?.nombre || 'Institución educativa'}</strong>
            {institucion?.amie && <span>AMIE {institucion.amie}</span>}
          </div>
        </header>
        <h1 className="ofd-hoja-t">{etiquetaTipo(doc.tipo)}</h1>
        {doc.numero && <p className="ofd-hoja-n">N.° {doc.numero}</p>}
        {conRecorrido && <p className="ofd-hoja-int">Uso interno · impresión con recorrido (auditoría)</p>}

        <dl className="ofd-hoja-d">
          <div><dt>Asunto</dt><dd>{doc.asunto || doc.titulo}</dd></div>
          <div><dt>Estudiante</dt><dd>{nombreEstudiante}</dd></div>
          {(doc.curso || doc.paralelo) && <div><dt>Curso</dt><dd>{[doc.curso, doc.paralelo].filter(Boolean).join(' ')}</dd></div>}
          {doc.periodo && <div><dt>Período</dt><dd>{doc.periodo}</dd></div>}
          <div><dt>Fecha de emisión</dt><dd>{fmtFecha(doc.created_at)}</dd></div>
        </dl>

        <div className="ofd-hoja-cuerpo">{doc.datos_plantilla?.notas || doc.asunto || doc.titulo}</div>

        <div className="ofd-hoja-firmas">
          {bloques.map(b => (
            <div key={b.cargo}><span className="ofd-firma-l" /><strong>{b.cargo}</strong><small>{b.nombre || ' '}</small></div>
          ))}
        </div>
        {doc.entrega && (
          <p className="ofd-hoja-ent">Entrega registrada: {doc.entrega.recibido_por}{doc.entrega.cedula ? ` (CI ${doc.entrega.cedula})` : ''} · {fmtFecha(doc.entrega.fecha)} · {doc.entrega.medio}</p>
        )}

        {conRecorrido && (
          <section className="ofd-hoja-anexo">
            <h2>Anexo · recorrido interno</h2>
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
          </section>
        )}
      </div>
    </div>
  );
}
