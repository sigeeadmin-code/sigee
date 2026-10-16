import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { fetchBaseDocentesPlantel, buscarBaseDocentes, asignarDocenteAMiPlantel } from '../lib/data.js';

// "Base de docentes" vista por el administrador de un PLANTEL. Viene desactivada: la activa el Admin global.
// Solo lectura, y solo lo que el Admin global asignó a este plantel desde la base central.
export default function BaseDocentesPlantel() {
  const { permisos, institucion, profile } = useSession();
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const activo = permisos?.baseDocentes;
  const [qc, setQc] = useState('');
  const [res, setRes] = useState(null);       // resultados de la base central (null = aún no se busca)
  const [buscando, setBuscando] = useState(false);
  const [errBusq, setErrBusq] = useState('');
  const [asignando, setAsignando] = useState('');
  const [aviso, setAviso] = useState('');

  function recargar() {
    return fetchBaseDocentesPlantel(institucion.id).then(setFilas).catch(e => setError(e.message || 'No se pudo cargar.'));
  }
  async function buscarCentral(ev) {
    ev?.preventDefault();
    setErrBusq(''); setAviso('');
    if (qc.trim().length < 3) { setErrBusq('Escribe al menos 3 letras o dígitos (apellido, nombre o cédula).'); return; }
    setBuscando(true);
    try { setRes(await buscarBaseDocentes(qc.trim())); }
    catch (e) { setErrBusq(e.message || 'No se pudo buscar.'); setRes(null); }
    setBuscando(false);
  }
  async function asignar(r) {
    if (!window.confirm(`¿Asignar a ${r.nombre} (${r.cedula || 's/c'}) a ${institucion?.nombre}?\n\nQuedará registrado en tu plantel y ya no estará disponible para otros colegios.`)) return;
    setAsignando(r.id); setErrBusq('');
    try {
      await asignarDocenteAMiPlantel(r.id);
      setAviso(`${r.nombre} quedó asignado a tu plantel.`);
      setRes(rs => (rs || []).map(x => x.id === r.id ? { ...x, ya_en_mi_plantel: true } : x));
      await recargar();
    } catch (e) { setErrBusq(e.message || 'No se pudo asignar.'); }
    setAsignando('');
  }

  useEffect(() => {
    if (!activo || !institucion?.id) return;
    let vivo = true;
    setCargando(true); setError('');
    fetchBaseDocentesPlantel(institucion.id)
      .then(f => { if (vivo) setFilas(f); })
      .catch(e => { if (vivo) setError(e.message || 'No se pudo cargar.'); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [activo, institucion?.id]);

  const visibles = useMemo(() => filas.filter(f => !q || `${f.cedula || ''} ${f.nombre || ''} ${f.especialidad || ''}`.toLowerCase().includes(q.toLowerCase())), [filas, q]);

  if (profile.rol !== 'admin_plantel') return <div className="empty"><span className="ti ti-lock" /><p>Esta sección es del administrador del plantel.</p></div>;

  if (!activo) {
    return (
      <div className="empty" style={{ padding: '50px 20px' }}>
        <span className="ti ti-lock" style={{ fontSize: 32 }} />
        <h3 style={{ margin: '12px 0 6px' }}>Base de docentes desactivada</h3>
        <p style={{ color: 'var(--slate)', maxWidth: 520, margin: '0 auto' }}>
          Este módulo está disponible en todos los planteles, pero lo activa el administrador global de SIGEE para cada colegio.
          Cuando lo active para {institucion?.nombre || 'tu plantel'}, aquí verás los docentes de la base central asignados a tu institución.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Base de docentes</h2>
      <p className="muted" style={{ margin: '0 0 12px' }}>Busca en la base central y asigna docentes a {institucion?.nombre}. Abajo ves los ya asignados.</p>
      {error && <div className="lerr" style={{ display: 'flex', marginBottom: 10 }}>{error}</div>}
      <div className="card" style={{ padding: 14, marginBottom: 16 }}>
        <strong style={{ fontSize: 14 }}>Buscar docente en la base central</strong>
        <form onSubmit={buscarCentral} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input className="fc" style={{ flex: 1 }} placeholder="Apellido, nombre o cédula (mín. 3 caracteres)…" value={qc} onChange={e => setQc(e.target.value)} />
          <button className="btn btn-primary" type="submit" disabled={buscando}>{buscando ? 'Buscando…' : '🔍 Buscar'}</button>
        </form>
        {errBusq && <p style={{ color: 'var(--red)', fontSize: 13, margin: '8px 0 0' }}>{errBusq}</p>}
        {aviso && <p style={{ color: 'var(--green, #16a34a)', fontSize: 13, margin: '8px 0 0' }}>{aviso}</p>}
        {res && (
          <table className="data" style={{ width: '100%', marginTop: 10 }}>
            <thead><tr><th>Cédula</th><th>Apellidos y nombres</th><th>Cantón</th><th>Categoría</th><th>Especialidad</th><th></th></tr></thead>
            <tbody>
              {res.length === 0 && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 16 }}>Sin resultados entre los docentes disponibles (los ya asignados a otro plantel no se muestran).</td></tr>}
              {res.map(r => (
                <tr key={r.id}>
                  <td className="mono">{r.cedula || '—'}</td><td><strong>{r.nombre}</strong></td><td>{r.canton || '—'}</td><td>{r.categoria || '—'}</td><td>{r.especialidad || '—'}</td>
                  <td>{r.ya_en_mi_plantel ? <span className="badge b-ok">En tu plantel</span>
                    : <button className="btn btn-primary btn-sm" disabled={asignando === r.id} onClick={() => asignar(r)}>{asignando === r.id ? 'Asignando…' : '➕ Asignar a mi plantel'}</button>}</td>
                </tr>))}
            </tbody>
          </table>
        )}
      </div>
      <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>Docentes asignados a tu plantel</h3>
      <div className="search-bar"><input className="fc" style={{ flex: 1 }} placeholder="Filtrar los asignados por cédula, nombre o especialidad…" value={q} onChange={e => setQ(e.target.value)} /></div>
      <div className="card">
        <table className="data" style={{ width: '100%' }}>
          <thead><tr><th>Cédula</th><th>Apellidos y nombres</th><th>Cantón</th><th>Categoría</th><th>Especialidad</th><th>Títulos</th></tr></thead>
          <tbody>
            {cargando && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20 }}>Cargando…</td></tr>}
            {!cargando && visibles.length === 0 && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 20 }}>{filas.length ? 'Sin resultados.' : 'Aún no has asignado docentes: usa el buscador de arriba.'}</td></tr>}
            {visibles.map(f => (
              <tr key={f.id}>
                <td className="mono">{f.cedula || '—'}</td><td><strong>{f.nombre}</strong></td><td>{f.canton || '—'}</td>
                <td>{f.categoria || '—'}</td><td>{f.especialidad || '—'}</td><td>{Array.isArray(f.titulos) ? f.titulos.length : 0}</td>
              </tr>))}
          </tbody>
        </table>
      </div>
      {visibles.length > 0 && <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>{visibles.length} docente{visibles.length === 1 ? '' : 's'}</p>}
    </div>
  );
}
