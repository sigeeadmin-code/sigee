import React, { useEffect, useState, useCallback } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { fetchJustificaciones, crearJustificacion, fetchHijosDeRepresentante, fetchEstudianteIdPorProfile, fetchJustificacionesParaResolver, justificarFalta, fetchDocenteIdDePerfil, fetchCursosComoTutor, fetchAsistenciaParalelos } from '../lib/data.js';

const ROLES_REVISAN = ['admin_plantel', 'secretario', 'inspector_general', 'super_admin', 'supervisor_plantel', 'docente'];
const fmt = d => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');

export default function Justificaciones() {
  const { profile, institucion, data } = useSession();
  const institucionId = institucion?.id;
  const puedeRevisar = ROLES_REVISAN.includes(profile.rolDb);
  const [estudiantesPropios, setEstudiantesPropios] = useState(null); // null = "todavía no aplica restricción / no cargado"
  // Para roles administrativos, se sigue usando el listado completo de la institución.
  const estudiantes = estudiantesPropios ?? (data?.estudiantes || []);

  useEffect(() => {
    (async () => {
      if (profile.rolDb === 'docente') {
        // El docente tutor solo ve y justifica a los estudiantes de su curso
        try {
          const did = await fetchDocenteIdDePerfil(profile.id);
          const cursos = did ? await fetchCursosComoTutor(did) : [];
          const hoy = new Date().toISOString().slice(0, 10);
          const d = cursos.length ? await fetchAsistenciaParalelos(institucionId, cursos.map(c => c.id), hoy, hoy) : { alumnos: [] };
          setEstudiantesPropios((d.alumnos || []).map(a => ({ id: a.id, nombre: a.nombre || `${a.apellidos || ''} ${a.nombres || ''}`.trim() })));
        } catch { setEstudiantesPropios([]); }
      } else if (profile.rolDb === 'padre') {
        setEstudiantesPropios(await fetchHijosDeRepresentante(profile.id));
      } else if (profile.rolDb === 'estudiante') {
        const id = await fetchEstudianteIdPorProfile(profile.id);
        const propio = (data?.estudiantes || []).find(e => e.id === id);
        setEstudiantesPropios(propio ? [{ id: propio.id, nombre: propio.nombre }] : []);
      }
    })();
  }, [profile.rolDb, profile.id, data, institucionId]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ estudiante_id: '', fecha: '', motivo: '' });
  const [saving, setSaving] = useState(false);
  const [filtro, setFiltro] = useState('todas');
  const [busqueda, setBusqueda] = useState('');
  const [detalle, setDetalle] = useState(null);
  const esFamilia = ['estudiante', 'padre'].includes(profile.rolDb);

  const cargar = useCallback(async () => {
    if (!institucionId) return;
    setLoading(true);
    setItems(puedeRevisar ? await fetchJustificacionesParaResolver() : await fetchJustificaciones(institucionId));
    setLoading(false);
  }, [institucionId, puedeRevisar]);

  useEffect(() => { cargar(); }, [cargar]);
  // Aviso en vivo: cuando llega o cambia una justificación del plantel, la lista se refresca sola (sin parpadeo).
  useEffect(() => {
    const alAviso = async e => {
      const t = e && e.detail && e.detail.tabla;
      if (t !== 'justificaciones' && t !== '*') return;
      try { setItems(puedeRevisar ? await fetchJustificacionesParaResolver() : await fetchJustificaciones(institucionId)); } catch { /* se queda lo que ya se veía */ }
    };
    window.addEventListener('sigee:avisos', alAviso);
    return () => window.removeEventListener('sigee:avisos', alAviso);
  }, [institucionId, puedeRevisar]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const pendientes = items.filter(j => j.estado === 'pendiente').length;
  const nombreEst = id => { const e = estudiantes.find(x => x.id === id); return e ? e.nombre : '—'; };
  const idsPropios = new Set((estudiantesPropios || []).map(e => e.id));
  const itemsVisibles = puedeRevisar ? items : items.filter(j => idsPropios.has(j.estudiante_id));
  const directo = ['docente', 'inspector_general'].includes(profile.rolDb); // tutor e inspector justifican directamente (con el plazo que controla la base)

  async function resolver(j, estado) {
    let motivoRechazo = null;
    if (estado === 'rechazada') {
      motivoRechazo = window.prompt('Motivo del rechazo:');
      if (!motivoRechazo) return;
    }
    try {
      // La base valida quién puede (tutor dentro de su plazo, luego inspector), justifica la asistencia y avisa a los docentes
      await justificarFalta(j.estudiante_id, j.fecha, estado, motivoRechazo, j.id);
      setToast({ tipo: 'ok', msg: estado === 'aprobada' ? 'Falta justificada. Se avisó al docente que la registró.' : 'Justificación rechazada.' });
      await cargar();
    } catch (err) {
      setToast({ tipo: 'err', msg: err.message || 'No se pudo actualizar.' });
    }
  }

  function abrirCrear() {
    setForm({ estudiante_id: estudiantes[0]?.id || '', fecha: '', motivo: '' });
    setModalOpen(true);
  }

  async function crear(e) {
    e.preventDefault();
    if (!form.estudiante_id || !form.fecha || !form.motivo.trim()) return;
    setSaving(true);
    try {
      if (directo) await justificarFalta(form.estudiante_id, form.fecha, 'aprobada', form.motivo.trim(), null);
      else await crearJustificacion(institucionId, { estudiante_id: form.estudiante_id, fecha: form.fecha, motivo: form.motivo.trim() }, profile.id);
      setModalOpen(false);
      await cargar();
      setToast({ tipo: 'ok', msg: directo ? 'Falta justificada. Se avisó al docente que la registró.' : 'Justificación registrada.' });
    } catch (err) {
      setToast({ tipo: 'err', msg: err.message || 'No se pudo registrar.' });
    }
    setSaving(false);
  }

  if (loading) return <p style={{ fontSize: 13, color: 'var(--slate)' }}>Cargando…</p>;

  const modalCrear = (
modalOpen && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <form className="modal" onSubmit={crear} style={{ maxWidth: 460 }}>
            <div className="modal-h"><h3>Nueva justificación</h3></div>
            <div className="modal-b">
              <div className="form-grid">
                <div className="full">
                  <label className="fl">Estudiante</label>
                  <select className="fc" value={form.estudiante_id} onChange={e => setForm(f => ({ ...f, estudiante_id: e.target.value }))}>
                    {estudiantes.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="fl">Fecha de la falta</label>
                  <input className="fc" type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
                </div>
                <div className="full">
                  <label className="fl">Motivo</label>
                  <textarea className="fc" rows={3} value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-f">
              <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Registrar'}</button>
            </div>
          </form>
        </div>
      )
  );
  const toastEl = (toast && <div className={'toast ' + (toast.tipo === 'ok' ? 'ok' : 'err')}>{toast.msg}</div>);

  if (esFamilia) {
    const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const lista = itemsVisibles;
    const cuenta = est => lista.filter(j => j.estado === est).length;
    const q = norm(busqueda);
    const visibles = lista
      .filter(j => filtro === 'todas' || j.estado === filtro)
      .filter(j => !q || norm(j.motivo).includes(q) || norm(fmt(j.fecha)).includes(q) || String(j.fecha).includes(q) || norm(nombreEst(j.estudiante_id)).includes(q));
    const dia = f => new Date(String(f).slice(0, 10) + 'T00:00:00');
    const iconoMotivo = m => {
      const t = norm(m);
      if (/medic|enferm|salud|doctor|hospital|cita/.test(t)) return 'ti-stethoscope';
      if (/famil|fallec|luto|calamidad/.test(t)) return 'ti-users';
      if (/lluvia|clima|inunda|via|transito|transporte|bus/.test(t)) return 'ti-cloud-rain';
      if (/olimp|concurso|torneo|evento|deport|academ/.test(t)) return 'ti-trophy';
      if (/viaje/.test(t)) return 'ti-plane';
      return 'ti-file-text';
    };
    const etiqueta = { pendiente: 'Pendiente', aprobada: 'Aprobada', rechazada: 'Rechazada' };
    const tarjeta = (clave, clase, icono, titulo, estado) => (
      <button type="button" className={`fj-stat ${clase}${filtro === estado ? ' on' : ''}`} onClick={() => setFiltro(f => (f === estado ? 'todas' : estado))}>
        <span className="ic"><span className={`ti ${icono}`} /></span>
        <span><div className="lb">{titulo}</div><div className="nu">{cuenta(estado)}</div><div className="pt">{etiqueta[estado]}</div></span>
      </button>
    );
    return (
      <div>
        <div className="fj-top">
          <div>
            <h2>{profile.rolDb === 'padre' ? 'Justificaciones' : 'Mis justificaciones'}</h2>
            <div style={{ fontSize: 14, color: 'var(--slate)' }}>Consulta y gestiona las justificaciones de inasistencia{profile.rolDb === 'padre' ? ' de tus representados' : ''}.</div>
          </div>
          <button className="btn btn-primary" onClick={abrirCrear}><span className="ti ti-plus" /> Nueva justificación</button>
        </div>

        <div className="fj-stats">
          {tarjeta('p', 'pen', 'ti-clock', 'Pendientes', 'pendiente')}
          {tarjeta('a', 'apr', 'ti-circle-check', 'Aprobadas', 'aprobada')}
          {tarjeta('r', 'rec', 'ti-circle-x', 'Rechazadas', 'rechazada')}
        </div>

        <div className="fj-barra">
          {[['todas', 'Todas'], ['pendiente', 'Pendientes'], ['aprobada', 'Aprobadas'], ['rechazada', 'Rechazadas']].map(([k, t]) => (
            <button key={k} type="button" className={'fj-filtro' + (filtro === k ? ' on' : '')} onClick={() => setFiltro(k)}>{t}</button>
          ))}
          <label className="fj-buscar"><span className="ti ti-search" style={{ color: 'var(--slate)' }} /><input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por fecha o motivo…" /></label>
        </div>

        {visibles.length === 0 ? (
          <div className="empty"><span className="ti ti-file-check" /><p>{lista.length ? 'No hay justificaciones con ese filtro.' : 'Aún no tienes justificaciones registradas.'}</p></div>
        ) : visibles.map(j => {
          const d = dia(j.fecha);
          return (
            <div className="fj-fila" key={j.id}>
              <div className="fj-fecha">
                <span className="fj-ico f"><span className="ti ti-calendar" /></span>
                <div>
                  <div className="fj-pq">Fecha de inasistencia</div>
                  <div className="fj-gr">{d.toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  <div className="fj-pq" style={{ textTransform: 'capitalize' }}>{d.toLocaleDateString('es-EC', { weekday: 'long' })}{profile.rolDb === 'padre' ? ` · ${nombreEst(j.estudiante_id)}` : ''}</div>
                </div>
              </div>
              <div className="fj-motivo">
                <span className="fj-ico"><span className={`ti ${iconoMotivo(j.motivo)}`} /></span>
                <div style={{ minWidth: 0 }}>
                  <div className="fj-pq">Motivo</div>
                  <div className="fj-gr" style={{ fontSize: 15, wordBreak: 'break-word' }}>{j.motivo}</div>
                  {j.archivo_url && <div className="fj-pq">Documento adjunto</div>}
                </div>
              </div>
              <div className="fj-der">
                <span className={'badge ' + (j.estado === 'pendiente' ? 'b-warn' : j.estado === 'aprobada' ? 'b-ok' : 'b-err')}>
                  <span className={'ti ' + (j.estado === 'pendiente' ? 'ti-clock' : j.estado === 'aprobada' ? 'ti-circle-check' : 'ti-circle-x')} /> {etiqueta[j.estado] || j.estado}
                </span>
                <button className="btn btn-secondary btn-sm" onClick={() => setDetalle(j)}>Ver detalles <span className="ti ti-chevron-right" /></button>
              </div>
            </div>
          );
        })}

        {cuenta('pendiente') === 0 && lista.length > 0 && (
          <div className="fj-pie"><span className="ti ti-sparkles" /><span>No tienes justificaciones pendientes. Un registro de asistencia al día refleja compromiso y responsabilidad.</span></div>
        )}

        {detalle && (
          <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setDetalle(null); }}>
            <div className="modal" style={{ maxWidth: 480 }}>
              <div className="modal-h"><h3>Detalle de la justificación</h3></div>
              <div className="modal-b">
                <div className="form-grid">
                  <div className="full"><div className="fj-pq">Estudiante</div><strong>{nombreEst(detalle.estudiante_id)}</strong></div>
                  <div><div className="fj-pq">Fecha de la falta</div><strong>{dia(detalle.fecha).toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong></div>
                  <div><div className="fj-pq">Estado</div><span className={'badge ' + (detalle.estado === 'pendiente' ? 'b-warn' : detalle.estado === 'aprobada' ? 'b-ok' : 'b-err')}>{etiqueta[detalle.estado] || detalle.estado}</span></div>
                  <div className="full"><div className="fj-pq">Motivo</div>{detalle.motivo}</div>
                  {detalle.archivo_url && <div className="full"><a className="btn btn-secondary btn-sm" href={detalle.archivo_url} target="_blank" rel="noopener noreferrer"><span className="ti ti-paperclip" /> Ver documento adjunto</a></div>}
                  {detalle.estado === 'rechazada' && detalle.decision_motivo && <div className="full"><div className="fj-pq">Motivo del rechazo</div>{detalle.decision_motivo}</div>}
                  {detalle.estado === 'pendiente' && <div className="full fj-pq">Esperando la revisión del docente tutor o del inspector.</div>}
                  {detalle.revisado_at && <div className="full fj-pq">Revisada el {new Date(detalle.revisado_at).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Guayaquil' })}</div>}
                </div>
              </div>
              <div className="modal-f"><button type="button" className="btn btn-secondary" onClick={() => setDetalle(null)}>Cerrar</button></div>
            </div>
          </div>
        )}
        {modalCrear}
        {toastEl}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: '0 0 4px' }}>Justificaciones de inasistencia</h2>
          <div style={{ fontSize: 13, color: 'var(--slate)' }}>{pendientes} pendiente(s) · Al justificar, la falta pasa a «justificado» y se avisa al docente que la registró (su hora y asignatura).</div>
        </div>
        {(profile.rolDb !== 'supervisor_plantel') && <button className="btn btn-primary btn-sm" onClick={abrirCrear}><span className="ti ti-plus" /> {directo ? 'Justificar una falta' : 'Nueva justificación'}</button>}
      </div>

      {itemsVisibles.length === 0 ? (
        <div className="empty"><span className="ti ti-file-check" /><p>Sin justificaciones registradas.</p></div>
      ) : (
        <div className="card"><div className="cb" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="data" style={{ width: '100%' }}>
            <thead><tr><th>Falta</th><th>Estudiante</th><th>Motivo</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {itemsVisibles.map(j => (
                <tr key={j.id}>
                  <td className="mono">{j.fecha}</td>
                  <td><strong>{nombreEst(j.estudiante_id)}</strong></td>
                  <td>{j.motivo}</td>
                  <td>
                    <span className={'badge ' + (j.estado === 'pendiente' ? 'b-warn' : j.estado === 'aprobada' ? 'b-ok' : 'b-err')}>
                      {j.estado}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {j.estado === 'pendiente' && puedeRevisar && j.puede_resolver ? (
                      <>
                        <button className="btn btn-success btn-sm" onClick={() => resolver(j, 'aprobada')}>Aprobar</button>{' '}
                        <button className="btn btn-danger btn-sm" onClick={() => resolver(j, 'rechazada')}>Rechazar</button>
                      </>
                    ) : (j.estado === 'pendiente' && j.responsable ? <span style={{ fontSize: 11.5, color: 'var(--slate)' }}>{j.responsable === 'tutor' ? `Le corresponde al docente tutor${j.limite_tutor ? ` (hasta el ${fmt(j.limite_tutor)})` : ''}` : 'Le corresponde al inspector general'}</span> : '—')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      )}

      {modalCrear}

      {toastEl}
    </div>
  );
}
