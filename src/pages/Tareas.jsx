import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import {
  fetchTareasDocente, crearTarea, actualizarTarea, eliminarTarea, calificarEntrega,
  fetchTareasAlumno, entregarTarea, fetchEstudianteIdPorProfile
} from '../lib/data.js';

const ESTADO_BADGE = { pendiente: ['b-warn', 'Pendiente'], entregado: ['b-ok', 'Entregado'], tardio: ['b-err', 'Tardío'] };

export default function Tareas() {
  const { profile, data } = useSession();
  if (profile.rolDb === 'docente') return <VistaDocente profile={profile} data={data} />;
  if (profile.rol === 'alumno' || profile.rolDb === 'estudiante') return <VistaAlumno profile={profile} />;
  return <div className="empty"><span className="ti ti-lock" /><p>Este módulo es para docentes y estudiantes.</p></div>;
}

/* ───────────────────── Vista Docente ───────────────────── */
function VistaDocente({ profile, data }) {
  const miDocente = useMemo(() => (data?.docentes || []).find(d => d.profileId === profile.id), [data, profile.id]);
  const [tareas, setTareas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [expandida, setExpandida] = useState(null);
  const [form, setForm] = useState({ carga: '', titulo: '', descripcion: '', fecha_limite: '', hora_limite: '' });
  const [saving, setSaving] = useState(false);
  const [notas, setNotas] = useState({});

  const cargar = useCallback(async () => {
    if (!miDocente) { setLoading(false); return; }
    setLoading(true);
    setTareas(await fetchTareasDocente(miDocente.id));
    setLoading(false);
  }, [miDocente]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }, [toast]);

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
    try {
      await actualizarTarea(t.id, { bloqueado: !t.bloqueado });
      await cargar();
    } catch (err) { setToast({ tipo: 'err', msg: err.message || 'No se pudo actualizar.' }); }
  }
  async function borrar(id) {
    if (!window.confirm('¿Eliminar esta tarea y sus entregas?')) return;
    try { await eliminarTarea(id); await cargar(); setToast({ tipo: 'ok', msg: 'Tarea eliminada.' }); }
    catch (err) { setToast({ tipo: 'err', msg: err.message || 'No se pudo eliminar.' }); }
  }
  async function guardarNota(entregaId) {
    const n = notas[entregaId];
    try {
      await calificarEntrega(entregaId, n?.nota ?? '', n?.comentario ?? '', profile.id);
      await cargar();
      setToast({ tipo: 'ok', msg: 'Calificación guardada.' });
    } catch (err) { setToast({ tipo: 'err', msg: err.message || 'No se pudo calificar.' }); }
  }

  if (!miDocente) return <div className="empty"><span className="ti ti-clipboard-list" /><p>No se encontró tu perfil docente.</p></div>;
  if (loading) return <p style={{ fontSize: 13, color: 'var(--slate)' }}>Cargando…</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: '0 0 4px' }}>Tareas y avisos</h2>
          <div style={{ fontSize: 13, color: 'var(--slate)' }}>Publica tareas para tus cursos y califica las entregas.</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={abrirCrear}><span className="ti ti-plus" /> Nueva tarea</button>
      </div>

      <div className="card"><div className="cb">
        {tareas.length === 0 ? (
          <div className="empty"><span className="ti ti-clipboard-list" /><p>Todavía no has publicado tareas.</p></div>
        ) : tareas.map(t => {
          const abierta = expandida === t.id;
          return (
            <div key={t.id} style={{ border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: '12px 14px', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <strong>{t.titulo}</strong>
                  <span className="badge b-info" style={{ marginLeft: 8 }}>{t.materias?.nombre}</span>
                  <span className="badge b-muted" style={{ marginLeft: 4 }}>{t.paralelos?.grados?.nombre} {t.paralelos?.nombre}</span>
                  {t.bloqueado && <span className="badge b-err" style={{ marginLeft: 4 }}>Bloqueada</span>}
                  <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 4 }}>
                    Vence: {t.fecha_limite}{t.hora_limite ? ` ${t.hora_limite}` : ''} · {t.entregas.filter(e => e.estado !== 'pendiente').length}/{t.entregas.length || '—'} entregadas
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setExpandida(abierta ? null : t.id)}>{abierta ? 'Ocultar' : 'Ver entregas'}</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => toggleBloqueo(t)}>{t.bloqueado ? 'Desbloquear' : 'Bloquear'}</button>
                  <button className="btn btn-danger btn-sm" onClick={() => borrar(t.id)}>Eliminar</button>
                </div>
              </div>
              {t.descripcion && <div style={{ fontSize: 13, color: 'var(--slate)', marginTop: 6 }}>{t.descripcion}</div>}
              {abierta && (
                <div style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                  {t.entregas.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--slateL)' }}>Ningún estudiante tiene entrega registrada todavía.</div>
                  ) : t.entregas.map(en => {
                    const [cls, label] = ESTADO_BADGE[en.estado] || ['b-muted', en.estado];
                    const nEdit = notas[en.id] ?? { nota: en.nota ?? '', comentario: en.comentario ?? '' };
                    return (
                      <div key={en.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '6px 0', borderBottom: '1px dashed var(--line)' }}>
                        <span style={{ minWidth: 160 }}>{en.estudiantes?.apellidos} {en.estudiantes?.nombres}</span>
                        <span className={'badge ' + cls}>{label}</span>
                        {en.archivo_url && <a href={en.archivo_url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>Ver entrega</a>}
                        <input className="fc" type="number" min="0" max="10" step="0.1" placeholder="Nota" style={{ width: 70 }}
                          value={nEdit.nota} onChange={e => setNotas(s => ({ ...s, [en.id]: { ...nEdit, nota: e.target.value } }))} />
                        <input className="fc" placeholder="Comentario" style={{ flex: 1, minWidth: 140 }}
                          value={nEdit.comentario} onChange={e => setNotas(s => ({ ...s, [en.id]: { ...nEdit, comentario: e.target.value } }))} />
                        <button className="btn btn-primary btn-sm" onClick={() => guardarNota(en.id)}>Guardar</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div></div>

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
