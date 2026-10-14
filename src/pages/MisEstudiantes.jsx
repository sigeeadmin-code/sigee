import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { supabase } from '../lib/supabase.js';
import { fetchEstudiantesDeTutor, actualizarEstudianteComoTutor } from '../lib/data.js';

const CAMPOS = [
  ['telefono', 'Teléfono'], ['email', 'Correo'], ['direccion', 'Dirección'], ['fecha_nacimiento', 'Fecha de nacimiento', 'date'],
  ['genero', 'Género'], ['etnia', 'Etnia'], ['discapacidad', 'Discapacidad'], ['provincia', 'Provincia'], ['canton', 'Cantón']
];

// Estudiantes del/los curso(s) de los que el docente es TUTOR. Solo puede editarlos si el administrador del plantel lo habilitó.
export default function MisEstudiantes() {
  const { profile, permisos, recargarPermisos } = useSession();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [lista, setLista] = useState([]);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const [form, setForm] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState('');
  const puedeEditar = !!permisos?.tutoresEditanEstudiantes;

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

  function abrir(e) { setSel(e); setMsg(''); setForm(Object.fromEntries([...CAMPOS.map(([k]) => [k, e[k] ?? '']), ['observaciones', e.observaciones ?? '']])); }
  async function guardar(ev) {
    ev.preventDefault(); setGuardando(true); setMsg('');
    try {
      await actualizarEstudianteComoTutor(sel.id, form);
      setLista(l => l.map(x => (x.id === sel.id ? { ...x, ...form } : x)));
      setSel(null);
    } catch (err) { setMsg(err.message || 'No se pudo guardar.'); }
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
                <td><button className="btn btn-ghost btn-sm" onClick={() => abrir(e)}>{puedeEditar ? '✏️ Editar ficha' : '👁️ Ver ficha'}</button></td>
              </tr>))}
          </tbody>
        </table>
      </div>

      {sel && (
        <div className="modal-bg open" onClick={ev => { if (ev.target === ev.currentTarget && !guardando) setSel(null); }}>
          <form className="modal" onSubmit={guardar} style={{ maxWidth: 560 }}>
            <div className="modal-h"><h3>{sel.apellidos} {sel.nombres}</h3></div>
            <div className="modal-b">
              <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>{sel.curso} · Cédula {sel.cedula || '—'}. Nombres, cédula y matrícula los administra el plantel.</p>
              <div className="form-grid">
                {CAMPOS.map(([k, t, tipo]) => (
                  <div key={k}><label className="fl">{t}</label>
                    <input className="fc" type={tipo || 'text'} disabled={!puedeEditar || guardando} value={form[k] ?? ''} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} /></div>))}
                <div className="full"><label className="fl">Observaciones</label>
                  <textarea className="fc" rows={3} disabled={!puedeEditar || guardando} value={form.observaciones ?? ''} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} /></div>
              </div>
              {msg && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{msg}</p>}
            </div>
            <div className="modal-f">
              <button type="button" className="btn btn-secondary" disabled={guardando} onClick={() => setSel(null)}>{puedeEditar ? 'Cancelar' : 'Cerrar'}</button>
              {puedeEditar && <button type="submit" className="btn btn-primary" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
