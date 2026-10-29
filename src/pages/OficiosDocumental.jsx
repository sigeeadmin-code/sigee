/**
 * SIGEE · Módulo Oficios y Tráfico Documental
 * Pantallas: bandeja emisor / revisor + detalle + acciones por estado.
 * Especificación v1.0 · Fase 1 + base Fase 2.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import {
  fetchOficiosBandeja, crearBorradorOficio, enviarOficio, aprobarPasoOficio,
  observarOficio, corregirOficio, registrarEntregaOficio, archivarOficio,
  rechazarOficio, eliminarBorradorOficio, guardarBorradorOficio,
  TIPOS_DOCUMENTO, ACCIONES_HISTORIAL,
  etiquetaEstado, badgeEstado, etiquetaCargo, etiquetaTipo,
  puedeActuarEnPaso, esEmisor
} from '../lib/oficiosDocumental.js';

const FILTROS = [
  { id: 'todos', label: 'Todos' },
  { id: 'borrador', label: 'Borradores' },
  { id: 'en_ruta', label: 'En ruta' },
  { id: 'observado', label: 'Observados' },
  { id: 'aprobado_final', label: 'Aprobados' },
  { id: 'entregado', label: 'Entregados' },
  { id: 'archivado', label: 'Archivados' },
  { id: 'rechazado', label: 'Rechazados' }
];

function fmtFecha(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' });
  } catch { return String(iso).slice(0, 16); }
}

export default function OficiosDocumental() {
  const { profile, institucion, data } = useSession();
  const institucionId = institucion?.id;
  const estudiantes = data?.estudiantes || [];

  const [filtro, setFiltro] = useState('todos');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [formNuevo, setFormNuevo] = useState({
    tipo: 'oficio_alerta', titulo: '', asunto: '', estudiante_id: '', curso: '', paralelo: '', periodo: ''
  });
  const [saving, setSaving] = useState(false);
  const [motivoObs, setMotivoObs] = useState('');
  const [entregaForm, setEntregaForm] = useState({ recibidoPor: '', cedula: '', medio: 'presencial' });
  const [vistaImpresion, setVistaImpresion] = useState(null);

  const cargar = useCallback(async () => {
    if (!institucionId && profile?.rolDb !== 'super_admin') return;
    setLoading(true);
    try {
      setItems(await fetchOficiosBandeja(filtro));
    } catch (e) {
      setToast({ tipo: 'err', msg: e.message || 'Error al cargar bandeja.' });
    }
    setLoading(false);
  }, [institucionId, filtro, profile?.rolDb]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const nombreEst = useCallback((id) => {
    if (!id) return '—';
    const e = estudiantes.find(x => x.id === id);
    return e ? (e.nombre || `${e.apellidos || ''} ${e.nombres || ''}`.trim()) : (id ? id.slice(0, 8) : '—');
  }, [estudiantes]);

  async function crearNuevo(e) {
    e.preventDefault();
    if (!institucionId) { setToast({ tipo: 'err', msg: 'Selecciona un plantel.' }); return; }
    if (!formNuevo.titulo.trim()) { setToast({ tipo: 'err', msg: 'El título es obligatorio.' }); return; }
    setSaving(true);
    try {
      const doc = await crearBorradorOficio({
        institucionId,
        tipo: formNuevo.tipo,
        titulo: formNuevo.titulo.trim(),
        asunto: formNuevo.asunto.trim() || null,
        estudianteId: formNuevo.estudiante_id || null,
        curso: formNuevo.curso || null,
        paralelo: formNuevo.paralelo || null,
        periodo: formNuevo.periodo || null,
        datosPlantilla: { cuerpo: '', tablas: [], notas: formNuevo.asunto || '' }
      });
      setModalNuevo(false);
      setFormNuevo({ tipo: 'oficio_alerta', titulo: '', asunto: '', estudiante_id: '', curso: '', paralelo: '', periodo: '' });
      setDetalle(doc);
      await cargar();
      setToast({ tipo: 'ok', msg: 'Borrador creado.' });
    } catch (err) {
      setToast({ tipo: 'err', msg: err.message || 'No se pudo crear.' });
    }
    setSaving(false);
  }

  async function accion(fn, okMsg) {
    if (!detalle?.id) return;
    setSaving(true);
    try {
      const actualizado = await fn();
      setDetalle(actualizado);
      await cargar();
      setToast({ tipo: 'ok', msg: okMsg });
    } catch (err) {
      setToast({ tipo: 'err', msg: err.message || 'Error en la acción.' });
    }
    setSaving(false);
  }

  const onEnviar = () => accion(() => enviarOficio(detalle.id), 'Documento enviado a ruta.');
  const onAprobar = () => accion(() => aprobarPasoOficio(detalle.id), 'Paso aprobado.');
  const onObservar = () => {
    if (!motivoObs.trim()) { setToast({ tipo: 'err', msg: 'Indica el motivo de la observación.' }); return; }
    accion(() => observarOficio(detalle.id, motivoObs.trim()), 'Documento observado (devuelto al emisor).');
    setMotivoObs('');
  };
  const onCorregirYReenviar = () => accion(async () => {
    await corregirOficio(detalle.id, { datosPlantilla: detalle.datos_plantilla, titulo: detalle.titulo, asunto: detalle.asunto });
    return enviarOficio(detalle.id);
  }, 'Corregido y reenviado a ruta.');
  const onRegistrarEntrega = () => {
    if (!entregaForm.recibidoPor.trim()) { setToast({ tipo: 'err', msg: 'Indica quién recibió el documento.' }); return; }
    accion(() => registrarEntregaOficio(detalle.id, {
      recibidoPor: entregaForm.recibidoPor.trim(), cedula: entregaForm.cedula || null, medio: entregaForm.medio
    }), 'Entrega registrada.');
  };
  const onArchivar = () => accion(() => archivarOficio(detalle.id), 'Documento archivado.');
  const onRechazar = () => {
    const motivo = window.prompt('Motivo del rechazo:');
    if (!motivo) return;
    accion(() => rechazarOficio(detalle.id, motivo), 'Documento rechazado.');
  };

  async function onEliminarBorrador() {
    if (!window.confirm('¿Eliminar este borrador?')) return;
    setSaving(true);
    try {
      await eliminarBorradorOficio(detalle.id);
      setDetalle(null);
      await cargar();
      setToast({ tipo: 'ok', msg: 'Borrador eliminado.' });
    } catch (err) { setToast({ tipo: 'err', msg: err.message }); }
    setSaving(false);
  }

  async function onGuardarBorrador() {
    if (!detalle || detalle.estado !== 'borrador') return;
    setSaving(true);
    try {
      const actualizado = await guardarBorradorOficio(detalle.id, {
        titulo: detalle.titulo, asunto: detalle.asunto, datos_plantilla: detalle.datos_plantilla
      });
      setDetalle(actualizado);
      setToast({ tipo: 'ok', msg: 'Borrador guardado.' });
    } catch (err) { setToast({ tipo: 'err', msg: err.message }); }
    setSaving(false);
  }

  useEffect(() => {
    if (!vistaImpresion) return;
    document.body.classList.add('imprimiendo-oficio');
    const fin = () => { document.body.classList.remove('imprimiendo-oficio'); setVistaImpresion(null); };
    window.addEventListener('afterprint', fin, { once: true });
    const t = setTimeout(() => window.print(), 200);
    return () => { clearTimeout(t); window.removeEventListener('afterprint', fin); document.body.classList.remove('imprimiendo-oficio'); };
  }, [vistaImpresion]);

  const soyEmisor = esEmisor(detalle, profile);
  const puedoActuar = puedeActuarEnPaso(detalle, profile);

  if (!institucionId && profile?.rolDb !== 'super_admin') {
    return (
      <div className="empty" style={{ padding: 40 }}>
        <span className="ti ti-building" style={{ fontSize: 28 }} />
        <p>Selecciona un plantel para ver los oficios.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 4px' }}>Oficios y tráfico documental</h2>
          <div style={{ fontSize: 13, color: 'var(--slate)' }}>
            Un caso · un documento · un PDF por versión · recorrido con firmas
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setModalNuevo(true)}>
          <span className="ti ti-plus" /> Nuevo documento
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {FILTROS.map(f => (
          <button key={f.id} className={'btn btn-sm ' + (filtro === f.id ? 'btn-primary' : 'btn-secondary')} onClick={() => setFiltro(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: detalle ? '1fr 1.2fr' : '1fr', gap: 14 }}>
        <div className="card">
          <div className="cb" style={{ padding: 0, overflowX: 'auto' }}>
            {loading ? (
              <p style={{ padding: 16, fontSize: 13, color: 'var(--slate)' }}>Cargando…</p>
            ) : items.length === 0 ? (
              <div className="empty" style={{ padding: 24 }}>
                <span className="ti ti-file-text" /><p>No hay documentos en este filtro.</p>
              </div>
            ) : (
              <table className="data" style={{ width: '100%' }}>
                <thead><tr><th>N°</th><th>Tipo</th><th>Título</th><th>Estado</th><th>Actualizado</th></tr></thead>
                <tbody>
                  {items.map(d => (
                    <tr key={d.id} onClick={() => setDetalle(d)}
                      style={{ cursor: 'pointer', background: detalle?.id === d.id ? 'var(--bg-hover, #f1f5f9)' : undefined }}>
                      <td className="mono" style={{ fontSize: 12 }}>{d.numero || '—'}</td>
                      <td style={{ fontSize: 12 }}>{etiquetaTipo(d.tipo)}</td>
                      <td><strong>{d.titulo || 'Sin título'}</strong>
                        {d.es_seguimiento && <span className="badge b-info" style={{ marginLeft: 6, fontSize: 10 }}>seguimiento</span>}
                      </td>
                      <td><span className={'badge ' + badgeEstado(d.estado)}>{etiquetaEstado(d.estado)}</span></td>
                      <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtFecha(d.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {detalle && (
          <div className="card">
            <div className="cb" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--slate)' }}>{etiquetaTipo(detalle.tipo)} · v{detalle.version}</div>
                  {detalle.estado === 'borrador' && soyEmisor ? (
                    <input className="fc" style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}
                      value={detalle.titulo || ''} onChange={e => setDetalle(d => ({ ...d, titulo: e.target.value }))} />
                  ) : (
                    <h3 style={{ margin: '4px 0 0' }}>{detalle.titulo}</h3>
                  )}
                  {detalle.numero && <div className="mono" style={{ fontSize: 13, marginTop: 2 }}>{detalle.numero}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span className={'badge ' + badgeEstado(detalle.estado)}>{etiquetaEstado(detalle.estado)}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => setDetalle(null)}>✕</button>
                </div>
              </div>

              <div style={{ fontSize: 13, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <div><span style={{ color: 'var(--slate)' }}>Estudiante:</span> {nombreEst(detalle.estudiante_id)}</div>
                <div><span style={{ color: 'var(--slate)' }}>Curso:</span> {[detalle.curso, detalle.paralelo].filter(Boolean).join(' ') || '—'}</div>
                <div><span style={{ color: 'var(--slate)' }}>Periodo:</span> {detalle.periodo || '—'}</div>
                <div><span style={{ color: 'var(--slate)' }}>Emisor:</span> {detalle.emisor_cargo}</div>
                {detalle.documento_origen_numero && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ color: 'var(--slate)' }}>Documento origen:</span> <strong>{detalle.documento_origen_numero}</strong>
                  </div>
                )}
              </div>

              <div>
                <label className="fl">Asunto / contenido</label>
                {detalle.estado === 'borrador' && soyEmisor ? (
                  <textarea className="fc" rows={4}
                    value={detalle.asunto || (detalle.datos_plantilla?.notas || '')}
                    onChange={e => setDetalle(d => ({
                      ...d, asunto: e.target.value,
                      datos_plantilla: { ...(d.datos_plantilla || {}), notas: e.target.value }
                    }))} />
                ) : (
                  <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', background: 'var(--bg, #f8fafc)', padding: 10, borderRadius: 6 }}>
                    {detalle.asunto || detalle.datos_plantilla?.notas || '—'}
                  </div>
                )}
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Ruta de autoridades</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(detalle.ruta || []).map((p, i) => (
                    <span key={i} className={'badge ' + (
                      p.estado_paso === 'aprobado' ? 'b-ok'
                        : p.estado_paso === 'observado' ? 'b-warn'
                          : i === detalle.paso_actual && detalle.estado === 'en_ruta' ? 'b-info' : 'b-muted'
                    )} title={p.estado_paso}>
                      {i + 1}. {etiquetaCargo(p.cargo)}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Historial de recorrido</div>
                <div style={{ maxHeight: 180, overflowY: 'auto', fontSize: 12 }}>
                  {(detalle.historial_recorrido || []).length === 0 ? (
                    <span style={{ color: 'var(--slate)' }}>Sin movimientos aún.</span>
                  ) : (
                    <table className="data" style={{ width: '100%' }}>
                      <thead><tr><th>#</th><th>Cargo</th><th>Acción</th><th>Fecha</th><th>Comentario</th><th>vPDF</th></tr></thead>
                      <tbody>
                        {[...(detalle.historial_recorrido || [])].reverse().map((h, i) => (
                          <tr key={i}>
                            <td>{h.orden ?? i}</td>
                            <td>{etiquetaCargo(h.cargo)}</td>
                            <td>{ACCIONES_HISTORIAL[h.accion] || h.accion}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>{fmtFecha(h.fecha_accion)}</td>
                            <td>{h.comentario || '—'}</td>
                            <td>{h.version_pdf ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border, #e2e8f0)', paddingTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {detalle.estado === 'borrador' && soyEmisor && (
                  <>
                    <button className="btn btn-secondary btn-sm" disabled={saving} onClick={onGuardarBorrador}>Guardar</button>
                    <button className="btn btn-primary btn-sm" disabled={saving} onClick={onEnviar}>Enviar a ruta</button>
                    <button className="btn btn-danger btn-sm" disabled={saving} onClick={onEliminarBorrador}>Eliminar borrador</button>
                  </>
                )}
                {detalle.estado === 'en_ruta' && puedoActuar && (
                  <>
                    <button className="btn btn-success btn-sm" disabled={saving} onClick={onAprobar}>Aprobar paso</button>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <input className="fc" style={{ width: 180, fontSize: 12 }} placeholder="Motivo observación…"
                        value={motivoObs} onChange={e => setMotivoObs(e.target.value)} />
                      <button className="btn btn-secondary btn-sm" disabled={saving || !motivoObs.trim()} onClick={onObservar}>Observar</button>
                    </div>
                    <button className="btn btn-danger btn-sm" disabled={saving} onClick={onRechazar}>Rechazar</button>
                  </>
                )}
                {detalle.estado === 'observado' && soyEmisor && (
                  <button className="btn btn-primary btn-sm" disabled={saving} onClick={onCorregirYReenviar}>
                    Corregir y reenviar (v{detalle.version + 1})
                  </button>
                )}
                {detalle.estado === 'aprobado_final' && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', width: '100%' }}>
                    <input className="fc" style={{ width: 160 }} placeholder="Recibido por" value={entregaForm.recibidoPor}
                      onChange={e => setEntregaForm(f => ({ ...f, recibidoPor: e.target.value }))} />
                    <input className="fc" style={{ width: 120 }} placeholder="Cédula" value={entregaForm.cedula}
                      onChange={e => setEntregaForm(f => ({ ...f, cedula: e.target.value }))} />
                    <select className="fc" style={{ width: 120 }} value={entregaForm.medio}
                      onChange={e => setEntregaForm(f => ({ ...f, medio: e.target.value }))}>
                      <option value="presencial">Presencial</option>
                      <option value="correo">Correo</option>
                      <option value="whatsapp">WhatsApp</option>
                    </select>
                    <button className="btn btn-success btn-sm" disabled={saving} onClick={onRegistrarEntrega}>Registrar entrega</button>
                  </div>
                )}
                {detalle.estado === 'entregado' && (
                  <button className="btn btn-secondary btn-sm" disabled={saving} onClick={onArchivar}>Archivar</button>
                )}
                {detalle.estado !== 'borrador' && (
                  <>
                    <button className="btn btn-secondary btn-sm" onClick={() => setVistaImpresion('entrega')}>🖨️ Para entrega</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setVistaImpresion('recorrido')}>🖨️ Con recorrido</button>
                  </>
                )}
              </div>

              {detalle.version > 5 && (
                <div style={{ fontSize: 12, color: '#b45309', background: '#fffbeb', padding: '6px 10px', borderRadius: 6 }}>
                  ⚠️ Este documento tiene más de 5 versiones. Revisa si el proceso está generando demasiadas devoluciones.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {modalNuevo && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setModalNuevo(false); }}>
          <form className="modal" onSubmit={crearNuevo} style={{ maxWidth: 480 }}>
            <div className="modal-h"><h3>Nuevo documento</h3></div>
            <div className="modal-b">
              <div className="form-grid">
                <div className="full">
                  <label className="fl">Tipo</label>
                  <select className="fc" value={formNuevo.tipo} onChange={e => setFormNuevo(f => ({ ...f, tipo: e.target.value }))}>
                    {Object.entries(TIPOS_DOCUMENTO).map(([k, v]) => (
                      <option key={k} value={k}>{v.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="full">
                  <label className="fl">Título *</label>
                  <input className="fc" value={formNuevo.titulo} onChange={e => setFormNuevo(f => ({ ...f, titulo: e.target.value }))} required />
                </div>
                <div className="full">
                  <label className="fl">Asunto / resumen</label>
                  <textarea className="fc" rows={2} value={formNuevo.asunto} onChange={e => setFormNuevo(f => ({ ...f, asunto: e.target.value }))} />
                </div>
                <div className="full">
                  <label className="fl">Estudiante</label>
                  <select className="fc" value={formNuevo.estudiante_id} onChange={e => setFormNuevo(f => ({ ...f, estudiante_id: e.target.value }))}>
                    <option value="">— Sin estudiante —</option>
                    {estudiantes.map(e => (
                      <option key={e.id} value={e.id}>{e.nombre || `${e.apellidos || ''} ${e.nombres || ''}`.trim()}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="fl">Curso</label>
                  <input className="fc" value={formNuevo.curso} onChange={e => setFormNuevo(f => ({ ...f, curso: e.target.value }))} />
                </div>
                <div>
                  <label className="fl">Paralelo</label>
                  <input className="fc" value={formNuevo.paralelo} onChange={e => setFormNuevo(f => ({ ...f, paralelo: e.target.value }))} />
                </div>
                <div className="full">
                  <label className="fl">Periodo</label>
                  <input className="fc" value={formNuevo.periodo} placeholder="Ej. 2026-2027" onChange={e => setFormNuevo(f => ({ ...f, periodo: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-f">
              <button type="button" className="btn btn-secondary" onClick={() => setModalNuevo(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creando…' : 'Crear borrador'}</button>
            </div>
          </form>
        </div>
      )}

      {vistaImpresion && detalle && (
        <div className="oficio-print">
          <VistaImpresion doc={detalle} modo={vistaImpresion} nombreEstudiante={nombreEst(detalle.estudiante_id)} institucion={institucion} />
        </div>
      )}

      {toast && <div className={'toast ' + (toast.tipo === 'ok' ? 'ok' : 'err')}>{toast.msg}</div>}
    </div>
  );
}

function VistaImpresion({ doc, modo, nombreEstudiante, institucion }) {
  const conRecorrido = modo === 'recorrido';
  return (
    <div className="oficio-hoja" style={{ maxWidth: 720, margin: '0 auto', padding: 24, fontFamily: 'serif', fontSize: 13, lineHeight: 1.45 }}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{institucion?.nombre || 'INSTITUCIÓN EDUCATIVA'}</div>
        {institucion?.codigo_amie && <div style={{ fontSize: 11 }}>AMIE {institucion.codigo_amie}</div>}
        <div style={{ marginTop: 10, fontWeight: 700, fontSize: 14, textTransform: 'uppercase' }}>{etiquetaTipo(doc.tipo)}</div>
        {doc.numero && <div style={{ marginTop: 4 }}>N° {doc.numero}</div>}
        {conRecorrido && (
          <div style={{ marginTop: 6, fontSize: 11, color: '#b45309', border: '1px solid #fbbf24', display: 'inline-block', padding: '2px 8px' }}>
            USO INTERNO · IMPRESIÓN CON RECORRIDO (AUDITORÍA)
          </div>
        )}
      </div>
      <div style={{ marginBottom: 12 }}>
        <div><strong>Asunto:</strong> {doc.asunto || doc.titulo}</div>
        <div><strong>Estudiante:</strong> {nombreEstudiante}</div>
        {(doc.curso || doc.paralelo) && <div><strong>Curso:</strong> {[doc.curso, doc.paralelo].filter(Boolean).join(' ')}</div>}
        {doc.periodo && <div><strong>Periodo:</strong> {doc.periodo}</div>}
        <div><strong>Fecha de emisión:</strong> {fmtFecha(doc.created_at)}</div>
        <div><strong>Versión:</strong> {doc.version}</div>
      </div>
      <div style={{ marginBottom: 20, whiteSpace: 'pre-wrap' }}>{doc.datos_plantilla?.notas || doc.asunto || doc.titulo}</div>
      <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 40, marginBottom: 20 }}>
        <div style={{ textAlign: 'center', width: 160 }}><div style={{ borderTop: '1px solid #333', marginTop: 48, paddingTop: 4 }}>Tutor / Emisor</div></div>
        <div style={{ textAlign: 'center', width: 160 }}><div style={{ borderTop: '1px solid #333', marginTop: 48, paddingTop: 4 }}>Inspector General</div></div>
        <div style={{ textAlign: 'center', width: 160 }}><div style={{ borderTop: '1px solid #333', marginTop: 48, paddingTop: 4 }}>Representante legal</div></div>
      </div>
      {doc.entrega && (
        <div style={{ fontSize: 12, marginTop: 12 }}>
          <strong>Entrega registrada:</strong> {doc.entrega.recibido_por}
          {doc.entrega.cedula ? ` (CI ${doc.entrega.cedula})` : ''} · {fmtFecha(doc.entrega.fecha)} · {doc.entrega.medio}
        </div>
      )}
      {conRecorrido && (
        <div style={{ marginTop: 28, borderTop: '2px solid #333', paddingTop: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>ANEXO · RECORRIDO INTERNO</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #999', padding: 4 }}>#</th>
                <th style={{ border: '1px solid #999', padding: 4 }}>Cargo</th>
                <th style={{ border: '1px solid #999', padding: 4 }}>Acción</th>
                <th style={{ border: '1px solid #999', padding: 4 }}>Fecha</th>
                <th style={{ border: '1px solid #999', padding: 4 }}>Comentario</th>
                <th style={{ border: '1px solid #999', padding: 4 }}>v</th>
              </tr>
            </thead>
            <tbody>
              {(doc.historial_recorrido || []).map((h, i) => (
                <tr key={i}>
                  <td style={{ border: '1px solid #999', padding: 4 }}>{h.orden ?? i}</td>
                  <td style={{ border: '1px solid #999', padding: 4 }}>{etiquetaCargo(h.cargo)}</td>
                  <td style={{ border: '1px solid #999', padding: 4 }}>{ACCIONES_HISTORIAL[h.accion] || h.accion}</td>
                  <td style={{ border: '1px solid #999', padding: 4 }}>{fmtFecha(h.fecha_accion)}</td>
                  <td style={{ border: '1px solid #999', padding: 4 }}>{h.comentario || ''}</td>
                  <td style={{ border: '1px solid #999', padding: 4 }}>{h.version_pdf ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
