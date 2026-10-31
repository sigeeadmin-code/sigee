import React, { useEffect, useState } from 'react';
import { etiquetaCargo, etiquetaTipo } from '../../lib/oficiosDocumental.js';
import { accionesDisponibles, fmtEspera, fmtFecha, LIMITE_VERSIONES, ultimaObservacion, versionesDe } from '../../lib/oficiosVista.js';
import { EstadoBadge, MotivoForm, Recorrido, RutaStepper } from './OficioUI.jsx';
import OficioDocumentoModal from './OficioDocumentoModal.jsx';
import { notasDe } from '../../lib/documentoOficio.js';

const editable = d => d.soy_emisor && (d.estado === 'borrador' || d.estado === 'observado');

/**
 * Detalle de un documento: cabecera, ruta, contenido, recorrido y acciones.
 * Los permisos vienen del servidor (doc.puede_actuar / doc.soy_emisor); aquí solo se muestran.
 */
export default function OficioDetalle({ doc, nombreEst, ocupado, onAccion, onCerrar, seguimientos = [], origen = null, onAbrir, institucion, abrirVisor = false, pestanaInicial = 'documento', onVisorAbierto }) {
  const [edit, setEdit] = useState({ titulo: '', asunto: '', notas: '', documento: null });
  const [visor, setVisor] = useState(null);                    // 'ver' | 'editar' | null
  const [modo, setModo] = useState(null);                       // 'observar' | 'rechazar' | 'entrega' | null
  const [entrega, setEntrega] = useState({ recibidoPor: '', cedula: '', medio: 'presencial' });
  const [pestana, setPestana] = useState('documento');

  // Reinicia el formulario al cambiar de documento o de versión (no al refrescar por una acción ajena).
  useEffect(() => {
    setEdit({ titulo: doc.titulo || '', asunto: doc.asunto || '', notas: doc.datos_plantilla?.notas || '', documento: doc.datos_plantilla?.documento || null });
    setModo(null); setPestana(pestanaInicial); setVisor(abrirVisor ? 'ver' : null);
    if (abrirVisor) onVisorAbierto?.();
  }, [doc.id, doc.version, doc.estado]); // eslint-disable-line react-hooks/exhaustive-deps

  const acc = accionesDisponibles(doc);
  const puedeEditar = editable(doc);
  const obs = doc.estado === 'observado' ? ultimaObservacion(doc) : null;
  const datos = () => ({ titulo: edit.titulo, asunto: edit.asunto, datos_plantilla: { ...(doc.datos_plantilla || {}), ...(edit.documento ? { documento: edit.documento, notas: notasDe(edit.documento) } : { notas: edit.notas }) } });
  const sinCambios = edit.titulo === (doc.titulo || '') && edit.asunto === (doc.asunto || '') && edit.notas === (doc.datos_plantilla?.notas || '')
    && JSON.stringify(edit.documento) === JSON.stringify(doc.datos_plantilla?.documento || null);

  return (
    <section className="ofd-detalle" aria-label="Detalle del documento">
      <header className="ofd-det-h">
        <button type="button" className="btn btn-ghost btn-sm ofd-volver" onClick={onCerrar}><span className="ti ti-arrow-left" /> Volver</button>
        <div className="ofd-det-id">
          <span className="ofd-num">{doc.numero || 'Borrador sin número'}</span>
          <EstadoBadge estado={doc.estado} />
          <span className="ofd-chip">v{doc.version}</span>
        </div>
        <button type="button" className="btn btn-ghost btn-sm ofd-cerrar" onClick={onCerrar} aria-label="Cerrar detalle"><span className="ti ti-x" /></button>
      </header>

      <div className="ofd-det-body">
        {puedeEditar ? (
          <input className="fc ofd-titulo-in" value={edit.titulo} onChange={e => setEdit(x => ({ ...x, titulo: e.target.value }))} aria-label="Título" maxLength={160} />
        ) : <h3 className="ofd-titulo">{doc.titulo}</h3>}

        <dl className="ofd-meta">
          <div><dt>Tipo</dt><dd>{etiquetaTipo(doc.tipo)}</dd></div>
          <div><dt>Estudiante</dt><dd>{nombreEst(doc.estudiante_id)}</dd></div>
          <div><dt>Curso</dt><dd>{[doc.curso, doc.paralelo].filter(Boolean).join(' ') || '—'}</dd></div>
          <div><dt>Período</dt><dd>{doc.periodo || '—'}</dd></div>
          <div><dt>Emitido por</dt><dd>{doc.emisor_nombre || '—'}</dd></div>
          <div><dt>Creado</dt><dd>{fmtFecha(doc.created_at)}</dd></div>
          {doc.documento_origen_numero && <div className="ofd-wide"><dt>Documento de origen</dt><dd className="ofd-num">{origen && onAbrir
            ? <button type="button" className="ofd-link" onClick={() => onAbrir(origen.id)}>{doc.documento_origen_numero}</button> : doc.documento_origen_numero}</dd></div>}
          {doc.estado === 'en_ruta' && doc.espera_seg != null && <div><dt>En este despacho</dt><dd>{fmtEspera(doc.espera_seg)}</dd></div>}
        </dl>

        {obs && (
          <div className="ofd-callout ofd-callout-warn" role="status">
            <strong>Devuelto para corrección</strong>
            <p>{obs.comentario}</p>
            <small>{obs.usuario_nombre || ''} {fmtFecha(obs.fecha_accion)}</small>
          </div>
        )}
        {doc.estado === 'rechazado' && doc.motivo_rechazo && (
          <div className="ofd-callout ofd-callout-err" role="status"><strong>Rechazado</strong><p>{doc.motivo_rechazo}</p></div>
        )}
        {doc.version > LIMITE_VERSIONES && doc.estado !== 'archivado' && (
          <div className="ofd-callout ofd-callout-warn" role="status">
            <strong>Más de {LIMITE_VERSIONES} versiones</strong><p>Este caso acumula demasiadas devoluciones; conviene revisarlo con Inspección.</p>
          </div>
        )}

        <div className="ofd-docbox">
          <span className="ti ti-file-text ofd-docbox-i" aria-hidden="true" />
          <div className="ofd-docbox-t"><strong>{doc.datos_plantilla?.documento ? 'Documento generado' : 'Contenido del documento'}</strong>
            <small>{doc.datos_plantilla?.documento ? 'Hoja oficial con notas del estudiante, firmas y recepción.' : 'Documento sin hoja estructurada.'}</small></div>
          <div className="ofd-docbox-b">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setVisor('ver')}><span className="ti ti-eye" /> Ver documento</button>
            {puedeEditar && edit.documento && <button type="button" className="btn btn-primary btn-sm" onClick={() => setVisor('editar')}><span className="ti ti-edit" /> Editar</button>}
          </div>
        </div>

        <RutaStepper doc={doc} />

        <div className="tabs ofd-subtabs" role="tablist">
          {[['documento', 'Documento'], ['recorrido', `Recorrido (${(doc.historial_recorrido || []).length})`], ['versiones', `Versiones (${doc.version})`], ...(seguimientos.length || acc.includes('seguimiento') ? [['seguimientos', `Seguimientos (${seguimientos.length})`]] : [])].map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={pestana === id} className={'tab' + (pestana === id ? ' on' : '')} onClick={() => setPestana(id)}>{label}</button>
          ))}
        </div>

        {pestana === 'documento' ? (
          <div className="ofd-contenido">
            <label className="fl" htmlFor="ofd-asunto">Asunto</label>
            {puedeEditar
              ? <input id="ofd-asunto" className="fc" value={edit.asunto} onChange={e => setEdit(x => ({ ...x, asunto: e.target.value }))} maxLength={200} />
              : <p className="ofd-texto">{doc.asunto || '—'}</p>}
            {puedeEditar && !edit.documento && (<>
              <label className="fl" htmlFor="ofd-notas">Contenido</label>
              <textarea id="ofd-notas" className="fc" rows={9} value={edit.notas} onChange={e => setEdit(x => ({ ...x, notas: e.target.value }))} placeholder="Redacta el cuerpo del documento…" />
            </>)}
            {doc.entrega && (
              <p className="ofd-entrega"><span className="ti ti-circle-check" /> Entregado a <strong>{doc.entrega.recibido_por}</strong>
                {doc.entrega.cedula ? ` (CI ${doc.entrega.cedula})` : ''} · {doc.entrega.medio} · {fmtFecha(doc.entrega.fecha)}</p>
            )}
          </div>
        ) : pestana === 'recorrido' ? <Recorrido historial={doc.historial_recorrido} />
          : pestana === 'versiones' ? (
            <ul className="ofd-ver">
              {versionesDe(doc).reverse().map(v => (
                <li key={v.version} className={v.actual ? 'ofd-ver-act' : ''}>
                  <div className="ofd-ver-top"><span className="ofd-chip">v{v.version}</span>{v.actual && <strong>Vigente</strong>}<time className="ofd-muted">{fmtFecha(v.fecha)}</time></div>
                  <small>{v.nota}{v.usuario ? ` · ${v.usuario}` : ''}</small>
                  {v.observadaPor && <small>Observada por {etiquetaCargo(v.observadaPor.cargo)}: {v.observadaPor.motivo}</small>}
                </li>
              ))}
            </ul>
          ) : (
            <div className="ofd-contenido">
              {seguimientos.length ? (
                <ul className="ofd-ver">
                  {seguimientos.map(x => (
                    <li key={x.id}>
                      <div className="ofd-ver-top"><span className="ofd-num">{x.numero || 'Borrador'}</span><EstadoBadge estado={x.estado} /></div>
                      <small>{x.titulo}</small>
                      {onAbrir && <button type="button" className="ofd-link" onClick={() => onAbrir(x.id)}>Abrir seguimiento</button>}
                    </li>
                  ))}
                </ul>
              ) : <p className="ofd-muted">Aún no se registró ningún seguimiento de este documento.</p>}
            </div>
          )}

        {modo === 'observar' && (
          <MotivoForm etiqueta="Motivo de la observación" placeholder="Indica qué debe corregir el emisor…" boton="Devolver al emisor" disabled={ocupado}
            onCancelar={() => setModo(null)} onConfirmar={m => onAccion('observar', m)} />
        )}
        {modo === 'rechazar' && (
          <MotivoForm etiqueta="Motivo del rechazo" placeholder="El caso se cierra y no continúa en la ruta." boton="Rechazar documento" tono="danger" disabled={ocupado}
            onCancelar={() => setModo(null)} onConfirmar={m => onAccion('rechazar', m)} />
        )}
        {modo === 'entrega' && (
          <div className="ofd-motivo">
            <div className="form-grid">
              <div className="full"><label className="fl" htmlFor="ofd-rec">Recibido por</label>
                <input id="ofd-rec" className="fc" autoFocus value={entrega.recibidoPor} onChange={e => setEntrega(x => ({ ...x, recibidoPor: e.target.value }))} /></div>
              <div><label className="fl" htmlFor="ofd-ced">Cédula</label>
                <input id="ofd-ced" className="fc" inputMode="numeric" value={entrega.cedula} onChange={e => setEntrega(x => ({ ...x, cedula: e.target.value }))} /></div>
              <div><label className="fl" htmlFor="ofd-med">Medio</label>
                <select id="ofd-med" className="fc" value={entrega.medio} onChange={e => setEntrega(x => ({ ...x, medio: e.target.value }))}>
                  <option value="presencial">Presencial</option><option value="correo">Correo</option><option value="whatsapp">WhatsApp</option></select></div>
            </div>
            <div className="ofd-motivo-f">
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => setModo(null)}>Cancelar</button>
              <button className="btn btn-success btn-sm" type="button" disabled={ocupado || !entrega.recibidoPor.trim()} onClick={() => onAccion('entregar', entrega)}>Registrar entrega</button>
            </div>
          </div>
        )}
      </div>

      {visor && (
        <OficioDocumentoModal doc={visor === 'editar' ? { ...doc, datos_plantilla: { ...doc.datos_plantilla, documento: edit.documento } } : doc} editable={visor === 'editar'}
          institucion={institucion} nombreEstudiante={nombreEst(doc.estudiante_id)} onCerrar={() => setVisor(null)}
          onAplicar={h => { setEdit(x => ({ ...x, documento: h })); setVisor(null); }} onImprimir={m => { setVisor(null); onAccion('imprimir', m); }} />
      )}
      {!modo && (
        <footer className="ofd-acciones">
          {acc.includes('enviar') && <button className="btn btn-primary" disabled={ocupado} onClick={() => onAccion('enviar', datos(), !sinCambios)}>Enviar a ruta</button>}
          {acc.includes('guardar') && <button className="btn btn-secondary" disabled={ocupado || sinCambios} onClick={() => onAccion('guardar', datos())}>Guardar</button>}
          {acc.includes('corregir') && <button className="btn btn-primary" disabled={ocupado} onClick={() => onAccion('corregir', datos())}>
            {sinCambios ? 'Reenviar sin cambios' : `Corregir y reenviar (v${doc.version + 1})`}</button>}
          {acc.includes('aprobar') && <button className="btn btn-success" disabled={ocupado} onClick={() => onAccion('aprobar')}>Aprobar</button>}
          {acc.includes('observar') && <button className="btn btn-secondary" disabled={ocupado} onClick={() => setModo('observar')}>Observar</button>}
          {acc.includes('entregar') && <button className="btn btn-success" disabled={ocupado} onClick={() => setModo('entrega')}>Registrar entrega</button>}
          {acc.includes('archivar') && <button className="btn btn-secondary" disabled={ocupado} onClick={() => onAccion('archivar')}>Archivar</button>}
          {acc.includes('seguimiento') && <button className="btn btn-secondary" disabled={ocupado} onClick={() => onAccion('seguimiento')}>Generar seguimiento</button>}
          {acc.includes('imprimir') && (
            <>
              <button className="btn btn-ghost" onClick={() => onAccion('imprimir', 'entrega')}><span className="ti ti-printer" /> Para entrega</button>
              <button className="btn btn-ghost" onClick={() => onAccion('imprimir', 'recorrido')}><span className="ti ti-route" /> Con recorrido</button>
            </>
          )}
          {acc.includes('rechazar') && <button className="btn btn-ghost ofd-peligro" disabled={ocupado} onClick={() => setModo('rechazar')}>Rechazar</button>}
          {acc.includes('eliminar') && <button className="btn btn-ghost ofd-peligro" disabled={ocupado} onClick={() => onAccion('eliminar')}>Eliminar borrador</button>}
        </footer>
      )}
    </section>
  );
}
