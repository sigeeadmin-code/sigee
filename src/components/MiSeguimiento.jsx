import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { fetchHojaRutaFamilia } from '../lib/oficiosDocumental.js';
import { armarLineaTiempo, docParaImpresion, resumenHojaRuta, soloFecha } from '../lib/hojaRutaFamilia.js';
import { useImpresionOficio } from '../lib/useImpresionOficio.js';
import OficioImpresion from './oficios/OficioImpresion.jsx';

/**
 * «Mi seguimiento»: hoja de ruta del estudiante para él y su representante (solo lectura).
 * Muestra oficios por faltas, avisos y los documentos ya aprobados (oficio de alerta, plan de refuerzo,
 * acta de compromiso, informes de seguimiento). Reutilizable en el panel y en «Asistencia y faltas».
 */
export default function MiSeguimiento({ estudianteId, nombreEstudiante, limite = 6, titulo = 'Seguimiento y documentos' }) {
  const { institucion } = useSession();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [verTodo, setVerTodo] = useState(false);
  const [abierto, setAbierto] = useState(null);
  const { modo, imprimir } = useImpresionOficio();

  useEffect(() => {
    let vivo = true;
    setDatos(null); setError('');
    if (!estudianteId) return undefined;
    fetchHojaRutaFamilia(estudianteId).then(d => { if (vivo) setDatos(d); }).catch(e => { if (vivo) setError(e.message); });
    return () => { vivo = false; };
  }, [estudianteId]);

  const items = useMemo(() => armarLineaTiempo(datos), [datos]);
  const r = useMemo(() => resumenHojaRuta(items), [items]);
  const visibles = verTodo ? items : items.slice(0, limite);

  return (
    <div className="card">
      <div className="ch"><h3>{titulo}</h3></div>
      <div className="cb">
        {error && <div className="lerr" style={{ display: 'flex' }}>{error}</div>}
        {!error && !datos && <p className="ofd-muted">Cargando…</p>}
        {datos && !items.length && (
          <div className="empty" style={{ padding: 16 }}>
            <span className="ti ti-circle-check" />
            <p style={{ fontSize: 13 }}>Sin novedades: no hay oficios ni documentos de seguimiento registrados.</p>
          </div>
        )}
        {items.length > 0 && (
          <>
            <p className="ofd-sub" style={{ margin: '0 0 10px' }}>
              {[r.faltas && `${r.faltas} oficio${r.faltas > 1 ? 's' : ''} por faltas`, r.documentos && `${r.documentos} documento${r.documentos > 1 ? 's' : ''}`,
                r.seguimientos && `${r.seguimientos} seguimiento${r.seguimientos > 1 ? 's' : ''}`, r.avisos && `${r.avisos} aviso${r.avisos > 1 ? 's' : ''}`].filter(Boolean).join(' · ')}
            </p>
            <ul className="ofd-hr">
              {visibles.map(i => (
                <li key={i.id}>
                  <span className={'ti ' + i.icono + ' ofd-hr-i'} aria-hidden="true" />
                  <div className="ofd-hr-c">
                    <div className="ofd-hr-t"><strong>{i.titulo}</strong><span className={'badge ' + i.tono}>{i.estado}</span></div>
                    <small>{i.detalle}</small>
                    <small className="ofd-hr-m"><time>{soloFecha(i.fecha)}</time>{i.numero && <span className="ofd-num">{i.numero}</span>}
                      {i.doc && <button type="button" className="ofd-link" onClick={() => setAbierto(i.doc)}>Ver documento</button>}</small>
                  </div>
                </li>
              ))}
            </ul>
            {items.length > limite && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setVerTodo(v => !v)}>{verTodo ? 'Ver menos' : `Ver todo (${items.length})`}</button>
            )}
          </>
        )}
      </div>

      {abierto && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setAbierto(null); }}>
          <div className="modal ofd-modal" role="dialog" aria-modal="true" aria-labelledby="ms-t">
            <div className="modal-h"><h3 id="ms-t">{abierto.tipo_nombre}</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAbierto(null)} aria-label="Cerrar"><span className="ti ti-x" /></button></div>
            <div className="modal-b">
              <p className="ofd-num" style={{ margin: '0 0 6px' }}>{abierto.numero} · {soloFecha(abierto.fecha)}</p>
              <p style={{ fontWeight: 700, margin: '0 0 6px' }}>{abierto.asunto || abierto.titulo}</p>
              {abierto.documento_origen_numero && <p className="ofd-sub">Seguimiento del documento {abierto.documento_origen_numero}</p>}
              <p className="ofd-texto">{abierto.contenido || 'Sin contenido adicional.'}</p>
            </div>
            <div className="modal-f">
              <button type="button" className="btn btn-secondary" onClick={() => setAbierto(null)}>Cerrar</button>
              <button type="button" className="btn btn-primary" onClick={() => imprimir('entrega')}><span className="ti ti-printer" /> Imprimir</button>
            </div>
          </div>
        </div>
      )}
      {modo && abierto && <OficioImpresion doc={docParaImpresion(abierto)} modo={modo} nombreEstudiante={nombreEstudiante || ''} institucion={institucion} />}
    </div>
  );
}
