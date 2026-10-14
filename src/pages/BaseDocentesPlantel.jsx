import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { fetchBaseDocentesPlantel } from '../lib/data.js';

// "Base de docentes" vista por el administrador de un PLANTEL. Viene desactivada: la activa el Admin global.
// Solo lectura, y solo lo que el Admin global asignó a este plantel desde la base central.
export default function BaseDocentesPlantel() {
  const { permisos, institucion, profile } = useSession();
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const activo = permisos?.baseDocentes;

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
      <p className="muted" style={{ margin: '0 0 12px' }}>Docentes de la base central asignados a {institucion?.nombre}. Solo lectura.</p>
      {error && <div className="lerr" style={{ display: 'flex', marginBottom: 10 }}>{error}</div>}
      <div className="search-bar"><input className="fc" style={{ flex: 1 }} placeholder="Buscar por cédula, nombre o especialidad…" value={q} onChange={e => setQ(e.target.value)} /></div>
      <div className="card">
        <table className="data" style={{ width: '100%' }}>
          <thead><tr><th>Cédula</th><th>Apellidos y nombres</th><th>Cantón</th><th>Categoría</th><th>Especialidad</th><th>Títulos</th></tr></thead>
          <tbody>
            {cargando && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20 }}>Cargando…</td></tr>}
            {!cargando && visibles.length === 0 && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 20 }}>{filas.length ? 'Sin resultados.' : 'Todavía no hay docentes de la base central asignados a tu plantel.'}</td></tr>}
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
