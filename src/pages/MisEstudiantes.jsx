import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { supabase } from '../lib/supabase.js';
import { fetchEstudiantesDeTutor, actualizarEstudianteComoTutor, subirArchivo, fetchEstudiantePerfil, actualizarRepresentanteComoTutor } from '../lib/data.js';
import { FormAlumno } from '../components/FormulariosPersona.jsx';

const CAMPOS_EDITABLES = ['telefono', 'email', 'direccion', 'fecha_nacimiento', 'genero', 'etnia', 'discapacidad', 'provincia', 'canton', 'observaciones', 'foto_url'];

// Estudiantes del/los curso(s) de los que el docente es TUTOR. Se editan con el MISMO editor de estudiantes del plantel
// (pestaña Alumno), solo si el administrador del plantel lo habilitó. Nombres, apellidos y cédula quedan en solo lectura.
export default function MisEstudiantes() {
  const { profile, permisos, recargarPermisos } = useSession();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [lista, setLista] = useState([]);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [errorModal, setErrorModal] = useState('');
  const puedeEditar = !!permisos?.tutoresEditanEstudiantes;
  const [tab, setTab] = useState('alumno');
  const [reps, setReps] = useState(null);      // representantes del estudiante abierto (null = cargando)
  const [repMsg, setRepMsg] = useState({});    // { [repId]: { ok?, error?, guardando? } }

  useEffect(() => { recargarPermisos?.(); }, []); // eslint-disable-line
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { data: doc } = await supabase.from('docentes').select('id').eq('profile_id', profile.id).maybeSingle();
        if (!doc) { if (vivo) setLista([]); return; }
        const r = await fetchEstudiantesDeTutor(doc.id);
        if (vivo) setLista(r.estudiantes);
      } catch (e) { if (vivo) setError(e.message || 'No se pudo cargar.'); }
      finally { if (vivo) setCargando(false); }
    })();
    return () => { vivo = false; };
  }, [profile.id]);

  const visibles = useMemo(() => lista.filter(e => !q || `${e.apellidos} ${e.nombres} ${e.cedula || ''}`.toLowerCase().includes(q.toLowerCase())), [lista, q]);

  const abrir = e => {
    setErrorModal(''); setTab('alumno'); setReps(null); setRepMsg({}); setModal({ ...e });
    fetchEstudiantePerfil(e.id).then(p => setReps((p?.representantes || []).map(r => ({ ...r })))).catch(() => setReps([]));
  };
  const updRep = (id, campo, valor) => setReps(rs => rs.map(r => r.id === id ? { ...r, [campo]: valor } : r));
  async function guardarRep(r) {
    setRepMsg(m => ({ ...m, [r.id]: { guardando: true } }));
    try {
      await actualizarRepresentanteComoTutor(r.id, { telefono: r.telefono || '', email: r.email || '', rol_representante: r.rol_representante || '' });
      setRepMsg(m => ({ ...m, [r.id]: { ok: true } }));
    } catch (e) { setRepMsg(m => ({ ...m, [r.id]: { error: e.message || 'No se pudo guardar.' } })); }
  }
  const cerrar = () => { if (!guardando) { setModal(null); setErrorModal(''); } };
  const upd = (campo, valor) => setModal(m => ({ ...m, [campo]: valor }));

  async function subirFoto(file) {
    try {
      const ext = file.name.split('.').pop();
      upd('foto_url', await subirArchivo('estudiantes-fotos', `${modal.id}/foto.${ext}`, file));
    } catch (e) { setErrorModal('No se pudo subir la foto: ' + e.message); }
  }

  async function guardar() {
    setGuardando(true); setErrorModal('');
    try {
      const campos = Object.fromEntries(CAMPOS_EDITABLES.map(k => [k, modal[k] || '']));
      await actualizarEstudianteComoTutor(modal.id, campos);
      setLista(l => l.map(x => (x.id === modal.id ? { ...x, ...campos } : x)));
      setModal(null);
    } catch (err) { setErrorModal('No se pudo guardar: ' + (err.message || err)); }
    setGuardando(false);
  }

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Mis estudiantes</h2>
      <p className="muted" style={{ margin: '0 0 12px' }}>Estudiantes de los cursos en los que eres docente tutor.</p>
      {!puedeEditar && <div className="card" style={{ marginBottom: 14 }}><div className="cb" style={{ fontSize: 13 }}>🔒 La edición de fichas por el docente tutor no está habilitada. Puedes consultarlas; para corregir un dato, pídeselo al administrador de tu plantel.</div></div>}
      {error && <div className="lerr" style={{ display: 'flex', marginBottom: 10 }}>{error}</div>}
      <div className="search-bar"><input className="fc" style={{ flex: 1 }} placeholder="Buscar por nombre o cédula…" value={q} onChange={e => setQ(e.target.value)} /></div>
      <div className="card">
        <table className="data" style={{ width: '100%' }}>
          <thead><tr><th>Cédula</th><th>Apellidos y nombres</th><th>Curso</th><th>Teléfono</th><th>Acciones</th></tr></thead>
          <tbody>
            {cargando && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20 }}>Cargando…</td></tr>}
            {!cargando && visibles.length === 0 && <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 20 }}>{lista.length ? 'Sin resultados.' : 'No tienes estudiantes asignados como tutor en el período activo.'}</td></tr>}
            {visibles.map(e => (
              <tr key={e.id}>
                <td className="mono">{e.cedula || '—'}</td><td><strong>{e.apellidos} {e.nombres}</strong></td><td>{e.curso}</td><td>{e.telefono || '—'}</td>
                <td><button className="btn btn-ghost btn-sm" onClick={() => abrir(e)}>{puedeEditar ? '✏️ Editar' : '👁️ Ver'}</button></td>
              </tr>))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-bg" onClick={cerrar}>
          <div className="modal wide" onClick={e => e.stopPropagation()}>
            <div className="modal-h">
              <h3>{puedeEditar ? '✏️ Editar estudiante' : '👁️ Estudiante'} — {modal.nombres} {modal.apellidos}</h3>
              <button className="btn btn-ghost btn-sm" onClick={cerrar}><span className="ti ti-x" /></button>
            </div>
            {errorModal && <div className="lerr">{errorModal}</div>}
            <div className="tabs">
              <button className={'tab' + (tab === 'alumno' ? ' on' : '')} onClick={() => setTab('alumno')}>Alumno</button>
              <button className={'tab' + (tab === 'reps' ? ' on' : '')} onClick={() => setTab('reps')}>Representantes{reps ? ` (${reps.length})` : ''}</button>
            </div>
            {tab === 'reps' && (
              <div className="modal-b">
                <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>Corrige teléfono, correo y parentesco. Nombres y cédula los administra el plantel.</p>
                {reps === null && <p className="muted">Cargando…</p>}
                {reps && reps.length === 0 && <p className="muted">Este estudiante aún no tiene representante registrado. Pide al administrador del plantel que lo agregue.</p>}
                {(reps || []).map(r => (
                  <div key={r.id} className="card" style={{ padding: 12, marginBottom: 10 }}>
                    <strong>{r.apellidos} {r.nombres}</strong> <span className="mono muted" style={{ fontSize: 12 }}>{r.cedula || ''}</span>
                    <fieldset disabled={!puedeEditar || repMsg[r.id]?.guardando} style={{ border: 0, padding: 0, margin: '8px 0 0', minWidth: 0 }}>
                      <div className="form-grid">
                        <div><label className="fl">Parentesco</label>
                          <select className="fc" value={r.rol_representante || ''} onChange={e => updRep(r.id, 'rol_representante', e.target.value)}>
                            <option value="">—</option><option value="padre">Padre</option><option value="madre">Madre</option><option value="tutor">Tutor/a legal</option>
                          </select></div>
                        <div><label className="fl">Teléfono</label><input className="fc" value={r.telefono || ''} onChange={e => updRep(r.id, 'telefono', e.target.value)} /></div>
                        <div className="full"><label className="fl">Correo</label><input className="fc" type="email" value={r.email || ''} onChange={e => updRep(r.id, 'email', e.target.value)} /></div>
                      </div>
                    </fieldset>
                    {puedeEditar && <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} disabled={repMsg[r.id]?.guardando} onClick={() => guardarRep(r)}>{repMsg[r.id]?.guardando ? 'Guardando…' : '💾 Guardar representante'}</button>}
                    {repMsg[r.id]?.ok && <span style={{ color: 'var(--green, #16a34a)', fontSize: 13, marginLeft: 10 }}>Guardado</span>}
                    {repMsg[r.id]?.error && <p style={{ color: 'var(--red)', fontSize: 13, margin: '6px 0 0' }}>{repMsg[r.id].error}</p>}
                  </div>))}
              </div>
            )}
            <div className="modal-b" style={tab === 'alumno' ? undefined : { display: 'none' }}>
              <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>{modal.curso}. Apellidos, nombres y cédula los administra el plantel.</p>
              <fieldset disabled={!puedeEditar || guardando} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
                <FormAlumno modal={modal} upd={upd} subirFoto={subirFoto} bloqueados />
              </fieldset>
            </div>
            <div className="modal-f">
              <button className="btn btn-secondary" onClick={cerrar} disabled={guardando}>{puedeEditar ? 'Cancelar' : 'Cerrar'}</button>
              {puedeEditar && tab === 'alumno' && <button className="btn btn-primary" disabled={guardando} onClick={guardar}>{guardando ? 'Guardando…' : '💾 Guardar'}</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
