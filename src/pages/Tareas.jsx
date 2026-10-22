import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import {
  fetchTareasDocente, fetchTareasPlantel, fetchEstudiantesParalelo, crearTarea, actualizarTarea, eliminarTarea, calificarEntrega,
  fetchTareasAlumno, entregarTarea, fetchEstudianteIdPorProfile
} from '../lib/data.js';

const hhmm = h => (h ? String(h).slice(0, 5) : '');
const nombreDe = r => `${r?.apellidos || ''} ${r?.nombres || ''}`.trim();
const chip = (bg, fg) => ({ fontSize: 11, fontWeight: 600, color: fg, background: bg, padding: '3px 10px', borderRadius: 999 });
const ESTADO_BADGE = { pendiente: ['b-warn', 'Pendiente'], entregado: ['b-ok', 'Entregado'], tardio: ['b-err', 'Tardío'] };

export default function Tareas() {
  const { profile, data } = useSession();
  if (profile.rolDb === 'docente') return <VistaGestion profile={profile} data={data} modo="docente" />;
  if (['super_admin', 'admin_plantel', 'secretario', 'inspector'].includes(profile.rol)) return <VistaGestion profile={profile} data={data} modo="plantel" />;
  if (profile.rol === 'alumno' || profile.rolDb === 'estudiante') return <VistaAlumno profile={profile} />;
  return <div className="empty"><span className="ti ti-lock" /><p>Este módulo no está disponible para tu rol.</p></div>;
}

/* ───────────────────── Gestión de tareas (docente y administración del plantel) ───────────────────── */
function VistaGestion({ profile, data, modo }) {
  const esDocente = modo === 'docente';
  const miDocente = useMemo(() => (data?.docentes || []).find(d => d.profileId === profile.id), [data, profile.id]);
  const [tareas, setTareas] = useState([]);
  const [alumnosPorCurso, setAlumnosPorCurso] = useState({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selId, setSelId] = useState(null);
  const [form, setForm] = useState({ carga: '', titulo: '', descripcion: '', fecha_limite: '', hora_limite: '' });
  const [saving, setSaving] = useState(false);
  const [notas, setNotas] = useState({});

  const cargar = useCallback(async () => {
    if (esDocente && !miDocente) { setLoading(false); return; }
    setLoading(true);
    const lista = esDocente ? await fetchTareasDocente(miDocente.id) : await fetchTareasPlantel(profile.institucion_id);
    setTareas(lista);
    // Alumnos de cada curso (para mostrar también a quienes aún no entregan)
    const pares = [...new Set(lista.filter(t => t.paralelo_id && t.periodo_id).map(t => t.paralelo_id + '|' + t.periodo_id))];
    const mapa = {};
    await Promise.all(pares.map(async k => { const [pa, pe] = k.split('|'); mapa[k] = await fetchEstudiantesParalelo(pa, pe); }));
    setAlumnosPorCurso(mapa);
    setLoading(false);
  }, [esDocente, miDocente, profile.institucion_id]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { if (tareas.length && !tareas.some(t => t.id === selId)) setSelId(tareas[0].id); }, [tareas, selId]);

  // Une alumnos del curso + entregas: quien no tiene entrega aparece como pendiente
  const filasDe = useCallback(t => {
    const alumnos = alumnosPorCurso[t.paralelo_id + '|' + t.periodo_id] || [];
    const porEst = Object.fromEntries(t.entregas.map(e => [e.estudiante_id, e]));
    const filas = alumnos.map(a => ({ key: a.id, nombre: a.nombre, entrega: porEst[a.id] || null }));
    t.entregas.forEach(e => { if (!alumnos.some(a => a.id === e.estudiante_id)) filas.push({ key: e.estudiante_id, nombre: nombreDe(e.estudiantes), entrega: e }); });
    return filas.sort((x, y) => x.nombre.localeCompare(y.nombre));
  }, [alumnosPorCurso]);
  const contar = t => {
    const f = filasDe(t);
    return {
      entregados: f.filter(x => x.entrega?.estado === 'entregado').length,
      tardios: f.filter(x => x.entrega?.estado === 'tardio').length,
      pendientes: f.filter(x => !x.entrega || x.entrega.estado === 'pendiente').length
    };
  };

  function abrirCrear() {
    setForm({ carga: miDocente?.cargas?.[0]?.id || '', titulo: '', descripcion: '', fecha_limite: '', hora_limite: '' });
    setModalOpen(true);
  }
  async function crear(e) {
    e.preventDefault();
    const carga = miDocente.cargas.find(c => c.id === form.carga);
    if (!carga || !form.titulo.trim() || !form.fecha_limite) {
      setToast({ tipo: 'err', msg: 'Seleccione la materia/curso, el título y la fecha límite.' });
      return;
    }
    setSaving(true);
    try {
      await crearTarea(profile.institucion_id, {
        materia_id: carga.materiaId, paralelo_id: carga.paraleloId, periodo_id: carga.periodoId,
        docente_id: miDocente.id, titulo: form.titulo.trim(), descripcion: form.descripcion.trim() || null,
        fecha_limite: form.fecha_limite, hora_limite: form.hora_limite || null, bloqueado: false
      }, profile.id);
      setModalOpen(false);
      await cargar();
      setToast({ tipo: 'ok', msg: 'Tarea publicada.' });
    } catch (err) {
      setToast({ tipo: 'err', msg: err.message || 'No se pudo crear la tarea.' });
    }
    setSaving(false);
  }
  async function toggleBloqueo(t) {
    try { await actualizarTarea(t.id, { bloqueado: !t.bloqueado }); await cargar(); }
    catch (err) { setToast({ tipo: 'err', msg: err.message || 'No se pudo actualizar.' }); }
  }
  async function borrar(id) {
    if (!window.confirm('¿Eliminar esta tarea y sus entregas?')) return;
    try { await eliminarTarea(id); setSelId(null); await cargar(); setToast({ tipo: 'ok', msg: 'Tarea eliminada.' }); }
    catch (err) { setToast({ tipo: 'err', msg: err.message || 'No se pudo eliminar.' }); }
  }
  async function guardarNota(en) {
    const n = notas[en.id];
    if (!n) return;
    try {
      await calificarEntrega(en.id, n.nota ?? (en.nota ?? ''), n.comentario ?? (en.comentario ?? ''), profile.id);
      setNotas(s => { const c = { ...s }; delete c[en.id]; return c; });
      await cargar();
      setToast({ tipo: 'ok', msg: 'Calificación guardada.' });
    } catch (err) { setToast({ tipo: 'err', msg: err.message || 'No se pudo calificar.' }); }
  }

  if (esDocente && !miDocente) return <div className="empty"><span className="ti ti-clipboard-list" /><p>No se encontró tu perfil docente.</p></div>;
  if (loading) return <p style={{ fontSize: 13, color: 'var(--slate)' }}>Cargando…</p>;

  const sel = tareas.find(t => t.id === selId) || null;
  const cursoDe = t => (t.paralelos ? `${t.paralelos.grados?.nombre || ''} ${t.paralelos.nombre || ''}`.trim() : '—');
  const stSel = sel ? contar(sel) : null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><span className="ti ti-clipboard-list" /> Gestión de Tareas</h2>
          <div style={{ fontSize: 13, color: 'var(--slate)', marginTop: 2 }}>
            {tareas.length} tarea{tareas.length === 1 ? '' : 's'} {esDocente ? 'publicadas por ti' : 'en el plantel'}
          </div>
        </div>
        {esDocente && <button className="btn btn-primary" onClick={abrirCrear}><span className="ti ti-plus" /> Nueva Tarea</button>}
      </div>

      {tareas.length === 0 ? (
        <div className="card"><div className="cb"><div className="empty"><span className="ti ti-clipboard-list" /><p>{esDocente ? 'Todavía no has publicado tareas.' : 'Los docentes aún no han publicado tareas.'}</p></div></div></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px,.9fr) minmax(0,1.4fr)', gap: 14, alignItems: 'start' }}>
          <div>
            {tareas.map(t => {
              const st = contar(t); const on = t.id === selId;
              return (
                <button key={t.id} type="button" onClick={() => setSelId(t.id)}
                  style={{ width: '100%', textAlign: 'left', background: '#fff', border: '1.5px solid ' + (on ? '#38bdf8' : 'var(--line)'), borderRadius: 14, padding: '14px 16px', marginBottom: 10, cursor: 'pointer', boxShadow: on ? '0 0 0 3px rgba(56,189,248,.12)' : '0 1px 2px rgba(0,0,0,.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.titulo}</div>
                      <div style={{ fontSize: 12, color: '#0ea5e9', fontWeight: 600, marginTop: 3 }}>{t.materias?.nombre || '—'} · {cursoDe(t)}</div>
                    </div>
                    {t.bloqueado && <span className="badge b-err">Bloqueada</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}><span className="ti ti-calendar" /> {t.fecha_limite} {hhmm(t.hora_limite)}</div>
                  <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={chip('#ecfdf5', '#059669')}>{st.entregados + st.tardios} entregados</span>
                    {st.pendientes > 0 && <span style={chip('#f1f5f9', '#64748b')}>{st.pendientes} pendientes</span>}
                  </div>
                </button>
              );
            })}
          </div>

          {sel && (
            <div>
              <div className="card" style={{ marginBottom: 12 }}><div className="cb">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{sel.titulo}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => toggleBloqueo(sel)}>{sel.bloqueado ? 'Desbloquear' : 'Bloquear'}</button>
                    <button className="btn btn-danger btn-sm" onClick={() => borrar(sel.id)}>Eliminar</button>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 6 }}>{sel.descripcion || 'Sin descripción'}</div>
                <div style={{ marginTop: 10, fontSize: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--slate)' }}>Límite: <strong>{sel.fecha_limite}</strong> {hhmm(sel.hora_limite)}</span>
                  <span style={{ color: 'var(--brand, #0ea5e9)', fontWeight: 600 }}>{sel.materias?.nombre || ''} · {cursoDe(sel)}</span>
                  <span style={{ color: 'var(--slate)' }}>Por: {nombreDe(sel.docentes) || '—'}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 16 }}>
                  <div style={{ textAlign: 'center', padding: 8 }}><div style={{ fontSize: 22, fontWeight: 800, color: '#059669' }}>{stSel.entregados}</div><div style={{ fontSize: 11, color: '#64748b' }}>Entregados</div></div>
                  <div style={{ textAlign: 'center', padding: 8 }}><div style={{ fontSize: 22, fontWeight: 800, color: '#d97706' }}>{stSel.tardios}</div><div style={{ fontSize: 11, color: '#64748b' }}>Tardíos</div></div>
                  <div style={{ textAlign: 'center', padding: 8, background: '#f1f5f9', borderRadius: 12 }}><div style={{ fontSize: 22, fontWeight: 800, color: '#475569' }}>{stSel.pendientes}</div><div style={{ fontSize: 11, color: '#64748b' }}>Pendientes</div></div>
                </div>
              </div></div>

              <div className="card">
                <div className="ch"><h3>Entregas</h3></div>
                <div className="cb" style={{ padding: 0, overflowX: 'auto' }}>
                  <table className="data">
                    <thead><tr><th>Alumno</th><th className="center">Estado</th><th>Archivo</th><th className="center">Fecha</th><th className="center">Nota</th><th>Comentario</th><th /></tr></thead>
                    <tbody>
                      {filasDe(sel).map(f => {
                        const en = f.entrega;
                        const [cls, label] = en ? (ESTADO_BADGE[en.estado] || ['b-muted', en.estado]) : ESTADO_BADGE.pendiente;
                        const ed = en ? (notas[en.id] ?? {}) : {};
                        const hayCambio = en && notas[en.id];
                        return (
                          <tr key={f.key}>
                            <td><strong>{f.nombre}</strong></td>
                            <td className="center"><span className={'badge ' + cls}>{label}</span></td>
                            <td style={{ fontSize: 12 }}>{en?.archivo_url ? <a href={en.archivo_url} target="_blank" rel="noreferrer">Ver entrega</a> : <span style={{ color: '#94a3b8' }}>Sin archivo</span>}</td>
                            <td className="center" style={{ fontSize: 11 }}>{en?.fecha_entrega ? new Date(en.fecha_entrega).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
                            <td className="center">
                              {en && en.estado !== 'pendiente'
                                ? <input className="fc" type="number" min="0" max="10" step="0.1" placeholder="—" style={{ width: 64 }}
                                    value={ed.nota ?? en.nota ?? ''} onChange={e => setNotas(s => ({ ...s, [en.id]: { ...s[en.id], nota: e.target.value } }))} />
                                : '—'}
                            </td>
                            <td>
                              {en && en.estado !== 'pendiente' && <input className="fc" placeholder="Comentario" style={{ minWidth: 120 }}
                                value={ed.comentario ?? en.comentario ?? ''} onChange={e => setNotas(s => ({ ...s, [en.id]: { ...s[en.id], comentario: e.target.value } }))} />}
                            </td>
                            <td>{hayCambio && <button className="btn btn-primary btn-sm" onClick={() => guardarNota(en)}>Guardar</button>}</td>
                          </tr>
                        );
                      })}
                      {filasDe(sel).length === 0 && <tr><td colSpan={7} className="empty">Este curso no tiene estudiantes matriculados ni entregas.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {modalOpen && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <form className="modal" onSubmit={crear} style={{ maxWidth: 480 }}>
            <div className="modal-h"><h3>Nueva tarea</h3></div>
            <div className="modal-b">
              <div className="form-grid">
                <div className="full">
                  <label className="fl">Materia y curso</label>
                  <select className="fc" value={form.carga} onChange={e => setForm(f => ({ ...f, carga: e.target.value }))}>
                    {(miDocente.cargas || []).map(c => (
                      <option key={c.id} value={c.id}>{c.materiaNombre} · {c.gradoNombre} {c.paraleloNombre}</option>
                    ))}
                  </select>
                </div>
                <div className="full">
                  <label className="fl">Título</label>
                  <input className="fc" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ej. Taller de fracciones" />
                </div>
                <div className="full">
                  <label className="fl">Descripción (opcional)</label>
                  <textarea className="fc" rows={3} value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
                </div>
                <div>
                  <label className="fl">Fecha límite</label>
                  <input className="fc" type="date" value={form.fecha_limite} onChange={e => setForm(f => ({ ...f, fecha_limite: e.target.value }))} />
                </div>
                <div>
                  <label className="fl">Hora límite (opcional)</label>
                  <input className="fc" type="time" value={form.hora_limite} onChange={e => setForm(f => ({ ...f, hora_limite: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-f">
              <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Publicando…' : 'Publicar tarea'}</button>
            </div>
          </form>
        </div>
      )}
      {toast && <div className={'toast ' + (toast.tipo === 'ok' ? 'ok' : 'err')}>{toast.msg}</div>}
    </div>
  );
}

/* ───────────────────── Vista Alumno ───────────────────── */
function VistaAlumno({ profile }) {
  const [estudianteId, setEstudianteId] = useState(null);
  const [tareas, setTareas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [modalOpen, setModalOpen] = useState(null); // tarea seleccionada
  const [form, setForm] = useState({ archivo_url: '', comentario: '' });
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    const eid = estudianteId || await fetchEstudianteIdPorProfile(profile.id);
    setEstudianteId(eid);
    if (eid) setTareas(await fetchTareasAlumno(eid));
    setLoading(false);
  }, [profile.id, estudianteId]);

  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }, [toast]);

  function abrirEntrega(t) {
    setForm({ archivo_url: t.miEntrega?.archivo_url || '', comentario: t.miEntrega?.comentario || '' });
    setModalOpen(t);
  }
  async function enviar(e) {
    e.preventDefault();
    if (!form.archivo_url.trim() && !form.comentario.trim()) {
      setToast({ tipo: 'err', msg: 'Agrega un enlace de tu trabajo o un comentario.' });
      return;
    }
    setSaving(true);
    try {
      const tardio = modalOpen.fecha_limite && new Date() > new Date(modalOpen.fecha_limite + 'T' + (modalOpen.hora_limite || '23:59'));
      await entregarTarea(modalOpen.id, modalOpen.institucion_id, estudianteId, {
        archivoUrl: form.archivo_url.trim() || null, archivoNombre: null, comentario: form.comentario.trim() || null, tardio
      });
      setModalOpen(null);
      const eid = estudianteId;
      setTareas(await fetchTareasAlumno(eid));
      setToast({ tipo: 'ok', msg: 'Entrega registrada.' });
    } catch (err) {
      setToast({ tipo: 'err', msg: err.message || 'No se pudo enviar la entrega.' });
    }
    setSaving(false);
  }

  if (loading) return <p style={{ fontSize: 13, color: 'var(--slate)' }}>Cargando…</p>;
  if (!estudianteId) return <div className="empty"><span className="ti ti-clipboard-list" /><p>No se encontró tu matrícula.</p></div>;

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ margin: '0 0 4px' }}>Tareas y avisos</h2>
        <div style={{ fontSize: 13, color: 'var(--slate)' }}>Tareas de tu curso. Entrega un enlace a tu trabajo (Drive, foto, documento) antes de la fecha límite.</div>
      </div>
      <div className="card"><div className="cb">
        {tareas.length === 0 ? (
          <div className="empty"><span className="ti ti-clipboard-list" /><p>No hay tareas publicadas todavía.</p></div>
        ) : tareas.map(t => {
          const en = t.miEntrega;
          const [cls, label] = en ? (ESTADO_BADGE[en.estado] || ['b-muted', en.estado]) : ['b-warn', 'Sin entregar'];
          return (
            <div key={t.id} style={{ border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: '12px 14px', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <strong>{t.titulo}</strong>
                  <span className="badge b-info" style={{ marginLeft: 8 }}>{t.materias?.nombre}</span>
                  <span className={'badge ' + cls} style={{ marginLeft: 4 }}>{label}</span>
                  {en?.nota != null && <span className="badge b-ok" style={{ marginLeft: 4 }}>Nota: {en.nota}</span>}
                  <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 4 }}>Vence: {t.fecha_limite}{t.hora_limite ? ` ${t.hora_limite}` : ''}</div>
                </div>
                {!t.bloqueado && <button className="btn btn-primary btn-sm" onClick={() => abrirEntrega(t)}>{en ? 'Editar entrega' : 'Entregar'}</button>}
              </div>
              {t.descripcion && <div style={{ fontSize: 13, color: 'var(--slate)', marginTop: 6 }}>{t.descripcion}</div>}
              {en?.comentario && <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 4 }}><em>Tu comentario:</em> {en.comentario}</div>}
            </div>
          );
        })}
      </div></div>

      {modalOpen && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setModalOpen(null); }}>
          <form className="modal" onSubmit={enviar} style={{ maxWidth: 460 }}>
            <div className="modal-h"><h3>Entregar · {modalOpen.titulo}</h3></div>
            <div className="modal-b">
              <div className="form-grid">
                <div className="full">
                  <label className="fl">Enlace de tu trabajo (Drive, foto, documento)</label>
                  <input className="fc" value={form.archivo_url} onChange={e => setForm(f => ({ ...f, archivo_url: e.target.value }))} placeholder="https://..." />
                </div>
                <div className="full">
                  <label className="fl">Comentario (opcional)</label>
                  <textarea className="fc" rows={3} value={form.comentario} onChange={e => setForm(f => ({ ...f, comentario: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-f">
              <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(null)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Enviando…' : 'Enviar entrega'}</button>
            </div>
          </form>
        </div>
      )}
      {toast && <div className={'toast ' + (toast.tipo === 'ok' ? 'ok' : 'err')}>{toast.msg}</div>}
    </div>
  );
}
