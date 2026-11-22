import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase.js';
import { useSession } from '../lib/SessionContext.jsx';
import DocumentoEditable from '../components/DocumentoEditable.jsx';
import { useImpresionOficio } from '../lib/useImpresionOficio.js';
import {
  CATEGORIAS, ORIGENES, RIESGOS, ESTADOS_CASO, ORDEN_ESTADOS, TIPOS_INTERVENCION, CAUSALES, DESTINOS, TIPOS_DOC,
  hoyISO, fechaCorta, indicadores, lineaDeTiempo, revisionVencida, estadoTrasAccion, siguienteCodigo, construirDocDece, tituloDoc,
} from '../lib/deceInformes.js';

/**
 * Consejería estudiantil (DECE): expedientes de casos, sesiones, derivaciones y oficios/informes editables.
 * Confidencial: las tablas dece_* solo las ve el DECE del propio plantel (RLS). Estructura según el Modelo de
 * Funcionamiento de los DECE del Ministerio de Educación: detección → intervención → derivación → seguimiento.
 */
const BADGE_RIESGO = { bajo: 'b-ok', medio: 'b-warn', alto: 'b-err' };
const BADGE_ESTADO = { deteccion: 'b-info', intervencion: 'b-warn', derivado: 'b-muted', seguimiento: 'b-info', cerrado: 'b-ok' };
const opciones = obj => Object.entries(obj).map(([k, l]) => <option key={k} value={k}>{l}</option>);
const nombreEst = (est, id) => est[id]?.nombre || 'Estudiante';

function Modal({ titulo, onClose, children, pie, ancho, bloqueado }) {
  return (
    <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget && !bloqueado) onClose(); }}>
      <div className={'modal' + (ancho ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="modal-h"><h3>{titulo}</h3><button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={bloqueado} aria-label="Cerrar">✕</button></div>
        <div className="modal-b">{children}</div>
        {pie && <div className="modal-f">{pie}</div>}
      </div>
    </div>
  );
}
const Campo = ({ etiqueta, children, ancho2 }) => <div style={ancho2 ? { gridColumn: '1 / -1' } : undefined}><label className="fl">{etiqueta}</label>{children}</div>;

export default function InformesDece() {
  const { data, institucion, profile } = useSession();
  const [casos, setCasos] = useState([]);
  const [intervenciones, setIntervenciones] = useState([]);
  const [derivaciones, setDerivaciones] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [q, setQ] = useState('');
  const [fEstado, setFEstado] = useState('');
  const [fRiesgo, setFRiesgo] = useState('');
  const [abiertoId, setAbiertoId] = useState(null);
  const [modal, setModal] = useState(null);     // { k: 'caso' | 'sesion' | 'derivar' | 'estado', ... }
  const [editor, setEditor] = useState(null);   // { id, tipo, casoId, estudianteId, titulo, fecha, version, doc, sucio }
  const [guardando, setGuardando] = useState(false);
  const { modo: modoImp, imprimir } = useImpresionOficio();

  const estudiantes = useMemo(() => Object.fromEntries((data?.estudiantes || []).map(e => [e.id, e])), [data]);
  const caso = casos.find(c => c.id === abiertoId) || null;

  const cargar = useCallback(async () => {
    if (!institucion?.id) { setCargando(false); return; }
    setCargando(true); setError('');
    const porInst = t => supabase.from(t).select(t === 'dece_documentos' ? 'id, caso_id, estudiante_id, tipo, titulo, fecha, version, updated_at' : '*').eq('institucion_id', institucion.id);
    const [c, i, d, x] = await Promise.all([
      porInst('dece_casos').order('created_at', { ascending: false }), porInst('dece_intervenciones').order('fecha', { ascending: false }),
      porInst('dece_derivaciones').order('fecha', { ascending: false }), porInst('dece_documentos').order('fecha', { ascending: false }),
    ]);
    const fallo = [c, i, d, x].find(r => r.error);
    if (fallo) setError('No se pudo cargar la información del DECE. ' + fallo.error.message);
    else { setCasos(c.data || []); setIntervenciones(i.data || []); setDerivaciones(d.data || []); setDocumentos(x.data || []); }
    setCargando(false);
  }, [institucion?.id]);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { if (!aviso) return undefined; const t = setTimeout(() => setAviso(''), 4000); return () => clearTimeout(t); }, [aviso]);

  const kpi = useMemo(() => indicadores({ casos, derivaciones, documentos }), [casos, derivaciones, documentos]);
  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    return casos.filter(c => {
      if (fEstado && c.estado !== fEstado) return false;
      if (fRiesgo && c.nivel_riesgo !== fRiesgo) return false;
      if (!t) return true;
      const e = estudiantes[c.estudiante_id];
      return (e?.nombre || '').toLowerCase().includes(t) || (e?.cedula || '').includes(t) || (c.codigo || '').toLowerCase().includes(t);
    });
  }, [casos, q, fEstado, fRiesgo, estudiantes]);

  const profesional = { nombre: profile?.nombre || profile?.email || '' };

  // ── Documentos ──
  function nuevoDoc(tipo, extra = {}) {
    const c = extra.caso || caso;
    const estudiante = estudiantes[c.estudiante_id] || {};
    const fecha = hoyISO();
    const doc = construirDocDece(tipo, {
      institucion, estudiante, caso: c, profesional, fecha, ciudad: '',
      intervenciones: intervenciones.filter(i => i.caso_id === c.id).sort((a, b) => (a.fecha < b.fecha ? -1 : 1)),
      intervencion: extra.intervencion, derivacion: extra.derivacion,
    });
    setEditor({ id: null, tipo, casoId: c.id, estudianteId: c.estudiante_id, titulo: tituloDoc(tipo, estudiante, fecha), fecha, version: 0, doc, sucio: true });
  }
  async function abrirDoc(fila) {
    const { data: d, error: e } = await supabase.from('dece_documentos').select('*').eq('id', fila.id).single();
    if (e || !d) { setAviso('No se pudo abrir el documento.'); return; }
    setEditor({ id: d.id, tipo: d.tipo, casoId: d.caso_id, estudianteId: d.estudiante_id, titulo: d.titulo, fecha: d.fecha, version: d.version, doc: d.documento, sucio: false });
  }
  async function guardarDoc() {
    if (!editor || guardando) return;
    if ((editor.titulo || '').trim().length < 3) { setAviso('Escriba un título para el documento.'); return; }
    setGuardando(true);
    const campos = { titulo: editor.titulo.trim(), fecha: editor.fecha, documento: editor.doc, updated_by: profile?.id || null, updated_at: new Date().toISOString() };
    const r = editor.id
      ? await supabase.from('dece_documentos').update({ ...campos, version: (editor.version || 1) + 1 }).eq('id', editor.id).select('id, version').single()
      : await supabase.from('dece_documentos').insert({ ...campos, institucion_id: institucion.id, caso_id: editor.casoId, estudiante_id: editor.estudianteId, tipo: editor.tipo, created_by: profile?.id || null }).select('id, version').single();
    setGuardando(false);
    if (r.error) { setAviso('No se pudo guardar: ' + r.error.message); return; }
    setEditor(e => ({ ...e, id: r.data.id, version: r.data.version, sucio: false }));
    setAviso('Documento guardado.');
    cargar();
  }
  async function borrarDoc(fila) {
    if (!window.confirm(`¿Eliminar «${fila.titulo}»? Esta acción no se puede deshacer.`)) return;
    const { error: e } = await supabase.from('dece_documentos').delete().eq('id', fila.id);
    if (e) setAviso('No se pudo eliminar: ' + e.message); else { setAviso('Documento eliminado.'); cargar(); }
  }
  function cerrarEditor() {
    if (editor?.sucio && !window.confirm('Hay cambios sin guardar. ¿Cerrar de todos modos?')) return;
    setEditor(null);
  }

  // ── Casos, sesiones y derivaciones ──
  async function guardarCaso(f, existente) {
    const fila = { categoria: f.categoria, origen: f.origen, fecha_deteccion: f.fecha_deteccion, nivel_riesgo: f.nivel_riesgo, descripcion: f.descripcion.trim() || null, proxima_revision: f.proxima_revision || null, registrado_educar: !!f.registrado_educar };
    const r = existente
      ? await supabase.from('dece_casos').update({ ...fila, updated_at: new Date().toISOString() }).eq('id', existente.id).select('id').single()
      : await supabase.from('dece_casos').insert({ ...fila, institucion_id: institucion.id, estudiante_id: f.estudiante_id, codigo: siguienteCodigo(casos), estado: 'deteccion', responsable_id: profile?.id || null, created_by: profile?.id || null }).select('id').single();
    if (r.error) return r.error.message;
    setModal(null); setAviso(existente ? 'Caso actualizado.' : 'Caso registrado.'); await cargar();
    if (!existente) setAbiertoId(r.data.id);
    return '';
  }
  async function guardarSesion(f) {
    const r = await supabase.from('dece_intervenciones').insert({ institucion_id: institucion.id, caso_id: caso.id, fecha: f.fecha, tipo: f.tipo, participantes: f.participantes.trim() || null, resumen: f.resumen.trim(), acuerdos: f.acuerdos.trim() || null, proxima_fecha: f.proxima_fecha || null, created_by: profile?.id || null });
    if (r.error) return r.error.message;
    const sig = estadoTrasAccion(caso.estado, 'sesion');
    const cambios = {}; if (sig !== caso.estado) cambios.estado = sig; if (f.proxima_fecha) cambios.proxima_revision = f.proxima_fecha;
    if (Object.keys(cambios).length) await supabase.from('dece_casos').update({ ...cambios, updated_at: new Date().toISOString() }).eq('id', caso.id);
    setModal(null); setAviso('Sesión registrada.'); await cargar(); return '';
  }
  async function guardarDerivacion(f) {
    const r = await supabase.from('dece_derivaciones').insert({ institucion_id: institucion.id, caso_id: caso.id, fecha: f.fecha, causal: f.causal, destino: f.destino, destino_detalle: f.destino_detalle.trim() || null, motivo: f.motivo.trim(), estado: 'enviada', created_by: profile?.id || null });
    if (r.error) return r.error.message;
    await supabase.from('dece_casos').update({ estado: estadoTrasAccion(caso.estado, 'derivacion'), updated_at: new Date().toISOString() }).eq('id', caso.id);
    setModal(null); setAviso('Derivación registrada.'); await cargar(); return '';
  }
  async function cambiarEstado(f) {
    const cambios = { estado: f.estado, updated_at: new Date().toISOString() };
    if (f.estado === 'cerrado') { cambios.fecha_cierre = f.fecha_cierre || hoyISO(); cambios.motivo_cierre = f.motivo_cierre.trim(); cambios.proxima_revision = null; }
    else { cambios.fecha_cierre = null; cambios.motivo_cierre = null; if (f.proxima_revision) cambios.proxima_revision = f.proxima_revision; }
    const r = await supabase.from('dece_casos').update(cambios).eq('id', caso.id);
    if (r.error) return r.error.message;
    setModal(null); setAviso('Estado actualizado.'); await cargar(); return '';
  }
  async function actualizarDerivacion(d, estado) {
    const r = await supabase.from('dece_derivaciones').update({ estado, updated_at: new Date().toISOString() }).eq('id', d.id);
    if (r.error) setAviso('No se pudo actualizar la derivación.'); else cargar();
  }

  const docsDelCaso = caso ? documentos.filter(d => d.caso_id === caso.id) : [];
  const sesiones = caso ? intervenciones.filter(i => i.caso_id === caso.id) : [];
  const deriv = caso ? derivaciones.filter(d => d.caso_id === caso.id) : [];
  const tiempo = caso ? lineaDeTiempo({ caso, intervenciones: sesiones, derivaciones: deriv, documentos: docsDelCaso }) : [];

  return (
    <div className="dc">
      <div className="dc-head">
        <div>
          <h2 style={{ margin: 0 }}>Consejería estudiantil</h2>
          <p className="dc-sub">Expedientes de casos, sesiones, derivaciones y oficios editables, según el Modelo de Funcionamiento de los DECE del Ministerio de Educación.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ k: 'caso' })}><span className="ti ti-plus" /> Nuevo caso</button>
      </div>

      <div className="dc-conf" role="note"><span className="ti ti-lock" aria-hidden="true" /> Información confidencial: solo el equipo DECE de este plantel puede ver y editar estos expedientes.</div>

      {aviso && <div className="dc-toast" role="status">{aviso}</div>}
      {error && <div className="dc-error" role="alert">{error} <button className="btn btn-secondary btn-sm" onClick={cargar}>Reintentar</button></div>}

      <div className="dc-kpis">
        {[['Casos abiertos', kpi.abiertos, 'ti ti-folder-open', ''], ['Riesgo alto', kpi.riesgoAlto, 'ti ti-alert-triangle', kpi.riesgoAlto ? 'dc-k-rojo' : ''], ['Revisión vencida', kpi.revisionVencida, 'ti ti-clock-exclamation', kpi.revisionVencida ? 'dc-k-ambar' : ''], ['Derivaciones activas', kpi.derivadosActivos, 'ti ti-arrow-forward-up', ''], ['Documentos del mes', kpi.informesMes, 'ti ti-file-text', '']].map(([l, v, ic, cl]) => (
          <div key={l} className={'dc-kpi ' + cl}><span className={ic} aria-hidden="true" /><strong>{v}</strong><small>{l}</small></div>
        ))}
      </div>

      <div className="search-bar">
        <input className="fc" placeholder="Buscar por estudiante, cédula o código…" value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar casos" />
        <select className="fc" value={fEstado} onChange={e => setFEstado(e.target.value)} aria-label="Filtrar por estado"><option value="">Todos los estados</option>{opciones(ESTADOS_CASO)}</select>
        <select className="fc" value={fRiesgo} onChange={e => setFRiesgo(e.target.value)} aria-label="Filtrar por riesgo"><option value="">Todo nivel de riesgo</option>{opciones(RIESGOS)}</select>
      </div>

      {cargando ? <p className="dc-sub">Cargando…</p> : filtrados.length === 0 ? (
        <div className="empty"><span className="ti ti-heart-handshake" /><p>{casos.length ? 'Ningún caso coincide con los filtros.' : 'Aún no hay casos registrados. Registre el primero para abrir un expediente.'}</p>
          {!casos.length && <button className="btn btn-primary" onClick={() => setModal({ k: 'caso' })}>Registrar un caso</button>}</div>
      ) : (
        <div className="card"><div className="cb" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="data" style={{ width: '100%' }}>
            <thead><tr><th>Estudiante</th><th>Situación</th><th>Riesgo</th><th>Estado</th><th>Próxima revisión</th><th /></tr></thead>
            <tbody>
              {filtrados.map(c => {
                const e = estudiantes[c.estudiante_id]; const venc = revisionVencida(c);
                return (
                  <tr key={c.id} className="dc-fila" onClick={() => setAbiertoId(c.id)}>
                    <td><strong>{e?.nombre || 'Estudiante'}</strong><div className="dc-mini">{[e?.curso, e?.paralelo].filter(x => x && x !== '—').join(' ')} · {c.codigo || 'Sin código'}</div></td>
                    <td>{CATEGORIAS[c.categoria] || c.categoria}</td>
                    <td><span className={'badge ' + BADGE_RIESGO[c.nivel_riesgo]}>{RIESGOS[c.nivel_riesgo]}</span></td>
                    <td><span className={'badge ' + BADGE_ESTADO[c.estado]}>{ESTADOS_CASO[c.estado]}</span></td>
                    <td className={venc ? 'dc-venc' : ''}>{c.estado === 'cerrado' ? '—' : fechaCorta(c.proxima_revision)}{venc && ' · vencida'}</td>
                    <td style={{ textAlign: 'right' }}><button className="btn btn-secondary btn-sm" onClick={ev => { ev.stopPropagation(); setAbiertoId(c.id); }}>Abrir expediente</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div></div>
      )}

      {caso && (
        <div className="dc-over" onClick={e => { if (e.target === e.currentTarget) setAbiertoId(null); }}>
          <aside className="dc-panel" role="dialog" aria-modal="true" aria-label="Expediente del caso">
            <div className="dc-ph">
              <div><h3 style={{ margin: 0 }}>{nombreEst(estudiantes, caso.estudiante_id)}</h3>
                <div className="dc-mini">{[estudiantes[caso.estudiante_id]?.curso, estudiantes[caso.estudiante_id]?.paralelo].filter(x => x && x !== '—').join(' ')} · {caso.codigo}</div></div>
              <button className="btn btn-ghost btn-sm" onClick={() => setAbiertoId(null)} aria-label="Cerrar expediente">✕</button>
            </div>
            <div className="dc-pb">
              <ol className="dc-pasos" aria-label="Eje del proceso">
                {ORDEN_ESTADOS.map((s, i) => { const actual = ORDEN_ESTADOS.indexOf(caso.estado); return <li key={s} className={i < actual ? 'ok' : i === actual ? 'act' : ''}><span>{i < actual ? '✓' : i + 1}</span>{ESTADOS_CASO[s]}</li>; })}
              </ol>
              <div className="dc-chips">
                <span className="badge b-muted">{CATEGORIAS[caso.categoria]}</span><span className={'badge ' + BADGE_RIESGO[caso.nivel_riesgo]}>{RIESGOS[caso.nivel_riesgo]}</span>
                <span className="badge b-muted">Origen: {ORIGENES[caso.origen]}</span>{caso.registrado_educar && <span className="badge b-ok">Registrado en portal oficial</span>}
              </div>
              {caso.descripcion && <p className="dc-desc">{caso.descripcion}</p>}
              <p className="dc-mini">Detectado el {fechaCorta(caso.fecha_deteccion)}{caso.estado === 'cerrado' ? ` · Cerrado el ${fechaCorta(caso.fecha_cierre)}${caso.motivo_cierre ? ': ' + caso.motivo_cierre : ''}` : caso.proxima_revision ? ` · Próxima revisión ${fechaCorta(caso.proxima_revision)}` : ''}</p>

              <div className="dc-acc">
                <button className="btn btn-primary btn-sm" onClick={() => setModal({ k: 'sesion' })}><span className="ti ti-notes" /> Registrar sesión</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setModal({ k: 'derivar' })}><span className="ti ti-arrow-forward-up" /> Derivar</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setModal({ k: 'estado' })}><span className="ti ti-switch-horizontal" /> Cambiar estado</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setModal({ k: 'caso', existente: caso })}><span className="ti ti-pencil" /> Editar caso</button>
              </div>

              <h4 className="dc-h">Nuevo oficio o informe</h4>
              <div className="dc-tipos">
                {Object.entries(TIPOS_DOC).map(([k, t]) => <button key={k} type="button" className="dc-tipo" onClick={() => nuevoDoc(k)}><span className={t.icono} aria-hidden="true" /><strong>{t.corto}</strong><small>{t.desc}</small></button>)}
              </div>

              <h4 className="dc-h">Documentos del expediente ({docsDelCaso.length})</h4>
              {docsDelCaso.length === 0 ? <p className="dc-mini">Todavía no hay documentos. Elija un tipo para generarlo; podrá editarlo directamente sobre la hoja.</p> : (
                <ul className="dc-docs">{docsDelCaso.map(d => (
                  <li key={d.id}><div><strong>{d.titulo}</strong><div className="dc-mini">{TIPOS_DOC[d.tipo]?.corto} · {fechaCorta(d.fecha)} · v{d.version}</div></div>
                    <span><button className="btn btn-secondary btn-sm" onClick={() => abrirDoc(d)}>Abrir y editar</button> <button className="btn btn-ghost btn-sm" onClick={() => borrarDoc(d)} aria-label={'Eliminar ' + d.titulo}>🗑</button></span></li>
                ))}</ul>
              )}

              {deriv.length > 0 && (<><h4 className="dc-h">Derivaciones</h4><ul className="dc-docs">{deriv.map(d => (
                <li key={d.id}><div><strong>{DESTINOS[d.destino]}</strong><div className="dc-mini">{fechaCorta(d.fecha)} · {CAUSALES[d.causal]}</div></div>
                  <select className="fc dc-sel" value={d.estado} onChange={e => actualizarDerivacion(d, e.target.value)} aria-label="Estado de la derivación"><option value="enviada">Enviada</option><option value="en_atencion">En atención</option><option value="contrarreferencia">Contrarreferencia</option><option value="cerrada">Cerrada</option></select></li>
              ))}</ul></>)}

              <h4 className="dc-h">Línea de tiempo</h4>
              <ol className="dc-tl">{tiempo.map(ev => {
                const origen = ev.tipo === 'intervencion' ? sesiones.find(i => 'i-' + i.id === ev.clave) : ev.tipo === 'derivacion' ? deriv.find(d => 'd-' + d.id === ev.clave) : null;
                return (<li key={ev.clave} className={'dc-t-' + ev.tipo}><time>{fechaCorta(ev.fecha)}</time><strong>{ev.titulo}</strong>{ev.detalle && <p>{ev.detalle}</p>}
                  {ev.tipo === 'intervencion' && origen && <button className="btn btn-ghost btn-sm" onClick={() => nuevoDoc('registro_sesion', { intervencion: origen })}>Generar registro de sesión</button>}
                  {ev.tipo === 'derivacion' && origen && <button className="btn btn-ghost btn-sm" onClick={() => nuevoDoc('informe_derivacion', { derivacion: origen })}>Generar informe de derivación</button>}</li>);
              })}</ol>
            </div>
          </aside>
        </div>
      )}

      {modal?.k === 'caso' && <FormCaso estudiantes={data?.estudiantes || []} existente={modal.existente} onClose={() => setModal(null)} onGuardar={f => guardarCaso(f, modal.existente)} />}
      {modal?.k === 'sesion' && <FormSesion onClose={() => setModal(null)} onGuardar={guardarSesion} />}
      {modal?.k === 'derivar' && <FormDerivar onClose={() => setModal(null)} onGuardar={guardarDerivacion} />}
      {modal?.k === 'estado' && caso && <FormEstado caso={caso} onClose={() => setModal(null)} onGuardar={cambiarEstado} />}

      {editor && (
        <div className="modal-bg open dc-ed-bg">
          <div className="dc-ed" role="dialog" aria-modal="true" aria-label="Editor del documento">
            <div className="dc-ed-bar">
              <input className="fc dc-ed-titulo" value={editor.titulo} onChange={e => setEditor(x => ({ ...x, titulo: e.target.value, sucio: true }))} aria-label="Título del documento" />
              <input className="fc dc-ed-fecha" type="date" value={editor.fecha} onChange={e => setEditor(x => ({ ...x, fecha: e.target.value, sucio: true }))} aria-label="Fecha del documento" />
              <span className="dc-ed-ac">
                <button className="btn btn-secondary btn-sm" onClick={() => imprimir('entrega')}><span className="ti ti-printer" /> Imprimir</button>
                <button className="btn btn-primary btn-sm" onClick={guardarDoc} disabled={guardando}>{guardando ? 'Guardando…' : editor.sucio ? 'Guardar' : 'Guardado ✓'}</button>
                <button className="btn btn-ghost btn-sm" onClick={cerrarEditor} aria-label="Cerrar editor">✕</button>
              </span>
            </div>
            <p className="dc-ed-ayuda">Escriba directamente sobre la hoja: cada texto, campo, fila y firma es editable. Las casillas se marcan con un clic.</p>
            <div className="dc-ed-hoja"><DocumentoEditable editable doc={editor.doc} onCambio={d => setEditor(x => ({ ...x, doc: d, sucio: true }))} /></div>
          </div>
        </div>
      )}
      {modoImp && editor && createPortal(<div className="oficio-print"><DocumentoEditable doc={editor.doc} editable={false} /></div>, document.body)}
    </div>
  );
}

// ── Formularios ──
function useFormulario(inicial, validar, onGuardar) {
  const [f, setF] = useState(inicial); const [err, setErr] = useState(''); const [env, setEnv] = useState(false);
  const set = k => e => setF(x => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  async function enviar(ev) {
    ev.preventDefault(); const v = validar(f); if (v) { setErr(v); return; }
    setEnv(true); setErr(''); const r = await onGuardar(f); setEnv(false); if (r) setErr(r);
  }
  return { f, set, setF, err, env, enviar };
}
function Pie({ env, onClose, etiqueta }) { return (<><button type="button" className="btn btn-secondary" onClick={onClose} disabled={env}>Cancelar</button><button type="submit" className="btn btn-primary" disabled={env}>{env ? 'Guardando…' : etiqueta}</button></>); }

function FormCaso({ estudiantes, existente, onClose, onGuardar }) {
  const [busca, setBusca] = useState('');
  const { f, set, setF, err, env, enviar } = useFormulario(
    existente ? { estudiante_id: existente.estudiante_id, categoria: existente.categoria, origen: existente.origen, fecha_deteccion: String(existente.fecha_deteccion).slice(0, 10), nivel_riesgo: existente.nivel_riesgo, descripcion: existente.descripcion || '', proxima_revision: existente.proxima_revision ? String(existente.proxima_revision).slice(0, 10) : '', registrado_educar: !!existente.registrado_educar }
      : { estudiante_id: '', categoria: 'emocional_conductual', origen: 'dece', fecha_deteccion: hoyISO(), nivel_riesgo: 'medio', descripcion: '', proxima_revision: '', registrado_educar: false },
    x => (!x.estudiante_id ? 'Seleccione al estudiante.' : x.descripcion.length > 4000 ? 'La descripción es demasiado larga (máximo 4000 caracteres).' : ''), onGuardar);
  const t = busca.trim().toLowerCase();
  const coincide = t.length < 2 ? [] : estudiantes.filter(e => e.activo && ((e.nombre || '').toLowerCase().includes(t) || (e.cedula || '').includes(t))).slice(0, 6);
  const elegido = estudiantes.find(e => e.id === f.estudiante_id);
  return (
    <Modal titulo={existente ? 'Editar caso' : 'Nuevo caso (detección)'} onClose={onClose} bloqueado={env} ancho>
      <form onSubmit={enviar} id="dc-f-caso">
        <div className="form-grid">
          <Campo etiqueta="Estudiante" ancho2>
            {elegido ? <div className="dc-elegido"><strong>{elegido.nombre}</strong><span className="dc-mini">{[elegido.curso, elegido.paralelo].filter(x => x && x !== '—').join(' ')} · {elegido.cedula}</span>{!existente && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setF(x => ({ ...x, estudiante_id: '' }))}>Cambiar</button>}</div> : (
              <><input className="fc" placeholder="Escriba el nombre o la cédula…" value={busca} onChange={e => setBusca(e.target.value)} autoFocus />
                {coincide.length > 0 && <ul className="dc-lista">{coincide.map(e => <li key={e.id}><button type="button" onClick={() => { setF(x => ({ ...x, estudiante_id: e.id })); setBusca(''); }}>{e.nombre}<small>{[e.curso, e.paralelo].filter(x => x && x !== '—').join(' ')} · {e.cedula}</small></button></li>)}</ul>}</>
            )}
          </Campo>
          <Campo etiqueta="Situación o problemática"><select className="fc" value={f.categoria} onChange={set('categoria')}>{opciones(CATEGORIAS)}</select></Campo>
          <Campo etiqueta="Detectado por"><select className="fc" value={f.origen} onChange={set('origen')}>{opciones(ORIGENES)}</select></Campo>
          <Campo etiqueta="Fecha de detección"><input className="fc" type="date" value={f.fecha_deteccion} onChange={set('fecha_deteccion')} max={hoyISO()} /></Campo>
          <Campo etiqueta="Nivel de riesgo"><select className="fc" value={f.nivel_riesgo} onChange={set('nivel_riesgo')}>{opciones(RIESGOS)}</select></Campo>
          <Campo etiqueta="Próxima revisión (opcional)"><input className="fc" type="date" value={f.proxima_revision} onChange={set('proxima_revision')} /></Campo>
          <Campo etiqueta="Registrado en el portal oficial"><label className="dc-check"><input type="checkbox" checked={f.registrado_educar} onChange={set('registrado_educar')} /> Ya se registró</label></Campo>
          <Campo etiqueta="Descripción (hechos observados, sin juicios de valor ni diagnósticos)" ancho2><textarea className="fc" rows={4} value={f.descripcion} onChange={set('descripcion')} maxLength={4000} /></Campo>
        </div>
        {(f.categoria === 'violencia' || f.categoria === 'drogas') && <p className="dc-nota">Para violencia o drogas aplique las rutas y protocolos de actuación vigentes del Ministerio de Educación; este registro no los reemplaza.</p>}
        {err && <p className="dc-err" role="alert">{err}</p>}
        <div className="modal-f" style={{ margin: '14px -20px -18px' }}><Pie env={env} onClose={onClose} etiqueta={existente ? 'Guardar cambios' : 'Registrar caso'} /></div>
      </form>
    </Modal>
  );
}

function FormSesion({ onClose, onGuardar }) {
  const { f, set, err, env, enviar } = useFormulario({ fecha: hoyISO(), tipo: 'individual', participantes: '', resumen: '', acuerdos: '', proxima_fecha: '' }, x => (x.resumen.trim().length < 3 ? 'Describa brevemente la sesión.' : ''), onGuardar);
  return (
    <Modal titulo="Registrar sesión o seguimiento" onClose={onClose} bloqueado={env} ancho>
      <form onSubmit={enviar}>
        <div className="form-grid">
          <Campo etiqueta="Fecha"><input className="fc" type="date" value={f.fecha} onChange={set('fecha')} max={hoyISO()} /></Campo>
          <Campo etiqueta="Tipo"><select className="fc" value={f.tipo} onChange={set('tipo')}>{opciones(TIPOS_INTERVENCION)}</select></Campo>
          <Campo etiqueta="Participantes" ancho2><input className="fc" value={f.participantes} onChange={set('participantes')} placeholder="Estudiante, representante, docente tutor…" /></Campo>
          <Campo etiqueta="Desarrollo de la sesión" ancho2><textarea className="fc" rows={4} value={f.resumen} onChange={set('resumen')} /></Campo>
          <Campo etiqueta="Acuerdos y compromisos" ancho2><textarea className="fc" rows={3} value={f.acuerdos} onChange={set('acuerdos')} /></Campo>
          <Campo etiqueta="Próxima sesión o revisión"><input className="fc" type="date" value={f.proxima_fecha} onChange={set('proxima_fecha')} /></Campo>
        </div>
        {err && <p className="dc-err" role="alert">{err}</p>}
        <div className="modal-f" style={{ margin: '14px -20px -18px' }}><Pie env={env} onClose={onClose} etiqueta="Registrar sesión" /></div>
      </form>
    </Modal>
  );
}

function FormDerivar({ onClose, onGuardar }) {
  const { f, set, err, env, enviar } = useFormulario({ fecha: hoyISO(), causal: 'reiteracion', destino: 'udai', destino_detalle: '', motivo: '' }, x => (x.motivo.trim().length < 3 ? 'Indique el motivo de la derivación.' : ''), onGuardar);
  return (
    <Modal titulo="Derivar el caso" onClose={onClose} bloqueado={env} ancho>
      <form onSubmit={enviar}>
        <div className="form-grid">
          <Campo etiqueta="Fecha"><input className="fc" type="date" value={f.fecha} onChange={set('fecha')} max={hoyISO()} /></Campo>
          <Campo etiqueta="Destino"><select className="fc" value={f.destino} onChange={set('destino')}>{opciones(DESTINOS)}</select></Campo>
          <Campo etiqueta="Causal de la derivación" ancho2><select className="fc" value={f.causal} onChange={set('causal')}>{opciones(CAUSALES)}</select></Campo>
          <Campo etiqueta="Institución o profesional (detalle)" ancho2><input className="fc" value={f.destino_detalle} onChange={set('destino_detalle')} /></Campo>
          <Campo etiqueta="Motivo" ancho2><textarea className="fc" rows={4} value={f.motivo} onChange={set('motivo')} /></Campo>
        </div>
        <p className="dc-nota">Antes de derivar, coordine con el representante legal, el docente tutor y la autoridad. Luego puede generar el informe de derivación desde la línea de tiempo.</p>
        {err && <p className="dc-err" role="alert">{err}</p>}
        <div className="modal-f" style={{ margin: '14px -20px -18px' }}><Pie env={env} onClose={onClose} etiqueta="Registrar derivación" /></div>
      </form>
    </Modal>
  );
}

function FormEstado({ caso, onClose, onGuardar }) {
  const { f, set, err, env, enviar } = useFormulario({ estado: caso.estado, motivo_cierre: caso.motivo_cierre || '', fecha_cierre: hoyISO(), proxima_revision: caso.proxima_revision ? String(caso.proxima_revision).slice(0, 10) : '' },
    x => (x.estado === 'cerrado' && x.motivo_cierre.trim().length < 3 ? 'Indique el motivo del cierre (objetivos cumplidos, apoyos sostenidos, estudiante en bienestar).' : ''), onGuardar);
  return (
    <Modal titulo="Cambiar el estado del caso" onClose={onClose} bloqueado={env}>
      <form onSubmit={enviar}>
        <div className="form-grid">
          <Campo etiqueta="Estado" ancho2><select className="fc" value={f.estado} onChange={set('estado')}>{opciones(ESTADOS_CASO)}</select></Campo>
          {f.estado === 'cerrado' ? (<>
            <Campo etiqueta="Fecha de cierre"><input className="fc" type="date" value={f.fecha_cierre} onChange={set('fecha_cierre')} max={hoyISO()} /></Campo>
            <Campo etiqueta="Motivo del cierre" ancho2><textarea className="fc" rows={3} value={f.motivo_cierre} onChange={set('motivo_cierre')} /></Campo>
            <p className="dc-nota" style={{ gridColumn: '1 / -1' }}>El seguimiento termina cuando se cumplieron los objetivos del plan, el sistema de apoyos se mantiene y el estudiante está en situación de protección y bienestar.</p>
          </>) : <Campo etiqueta="Próxima revisión (opcional)"><input className="fc" type="date" value={f.proxima_revision} onChange={set('proxima_revision')} /></Campo>}
        </div>
        {err && <p className="dc-err" role="alert">{err}</p>}
        <div className="modal-f" style={{ margin: '14px -20px -18px' }}><Pie env={env} onClose={onClose} etiqueta="Guardar" /></div>
      </form>
    </Modal>
  );
}
