import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { fetchPlanteles, fetchModulosPlantel, setModuloPlantel } from '../lib/data.js';
import BachilleratosPlantel from '../components/BachilleratosPlantel.jsx';

// Módulos que el Admin global habilita plantel por plantel. Por defecto TODOS están desactivados.
// Hoy: "Base de docentes" (el admin del plantel ve lo que el Admin global le asignó de la base central).
export default function ModulosPlantel() {
  const { profile } = useSession();
  const [planteles, setPlanteles] = useState([]);
  const [activos, setActivos] = useState({});       // institucion_id -> { activo, updated_at }
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState('todos');    // todos | activos | inactivos
  const [guardando, setGuardando] = useState(null);
  const [pagina, setPagina] = useState(1);
  const [bachPlantel, setBachPlantel] = useState(null);
  const porPagina = 25;

  const cargar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const [p, m] = await Promise.all([fetchPlanteles(), fetchModulosPlantel('base_docentes')]);
      setPlanteles(p);
      setActivos(Object.fromEntries(m.map(x => [x.institucion_id, x])));
    } catch (e) { setError(e.message || 'No se pudo cargar.'); }
    setCargando(false);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { setPagina(1); }, [q, filtro]);

  async function alternar(p) {
    const nuevo = !activos[p.id]?.activo;
    setGuardando(p.id); setError('');
    try {
      await setModuloPlantel(p.id, 'base_docentes', nuevo, profile.id);
      setActivos(a => ({ ...a, [p.id]: { activo: nuevo, updated_at: new Date().toISOString() } }));
    } catch (e) { setError(`No se pudo ${nuevo ? 'activar' : 'desactivar'} el módulo en ${p.nombre}: ${e.message}`); }
    setGuardando(null);
  }

  const conModulo = useMemo(() => planteles.filter(p => activos[p.id]?.activo), [planteles, activos]);
  const filtrados = useMemo(() => planteles.filter(p => {
    const on = !!activos[p.id]?.activo;
    if (filtro === 'activos' && !on) return false;
    if (filtro === 'inactivos' && on) return false;
    if (q && !`${p.nombre || ''} ${p.amie || ''} ${p.canton || ''}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [planteles, activos, q, filtro]);
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
  const actual = Math.min(pagina, totalPaginas);
  const visibles = filtrados.slice((actual - 1) * porPagina, actual * porPagina);
  const fecha = f => (f ? new Date(f).toLocaleDateString('es-EC') : '');

  if (profile.rolDb !== 'super_admin') return <div className="empty"><span className="ti ti-lock" /><p>Solo el administrador global de SIGEE puede gestionar los módulos por plantel.</p></div>;

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Módulos por plantel</h2>
      <p className="muted" style={{ margin: '0 0 12px' }}>
        <strong>Base de docentes</strong> existe en el menú de todos los planteles, pero permanece <strong>desactivada</strong> hasta que la actives aquí para el colegio elegido.
        Al activarla, el administrador de ese plantel ve (solo lectura) los docentes de la base central que le asignaste. Puedes desactivarla cuando quieras.
      </p>
      {error && <div className="lerr" style={{ display: 'flex', marginBottom: 10 }}>{error}</div>}

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="ch"><h3>Planteles con “Base de docentes” activada ({conModulo.length})</h3></div>
        <div className="cb">
          {conModulo.length === 0
            ? <p className="muted" style={{ margin: 0 }}>Ningún plantel la tiene activada todavía.</p>
            : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {conModulo.map(p => (
                  <span key={p.id} className="badge b-ok" style={{ padding: '4px 10px' }} title={`Activada el ${fecha(activos[p.id].updated_at)}`}>
                    {p.nombre}{p.amie ? ` · ${p.amie}` : ''}
                  </span>))}
              </div>}
        </div>
      </div>

      <div className="search-bar">
        <input className="fc" style={{ flex: 1, minWidth: 200 }} placeholder="Buscar plantel por nombre, AMIE o cantón…" value={q} onChange={e => setQ(e.target.value)} />
        <select className="fc" value={filtro} onChange={e => setFiltro(e.target.value)}>
          <option value="todos">Todos los planteles</option>
          <option value="activos">Con el módulo activado</option>
          <option value="inactivos">Con el módulo desactivado</option>
        </select>
      </div>

      <div className="card">
        <table className="data" style={{ width: '100%' }}>
          <thead><tr><th>AMIE</th><th>Plantel</th><th>Cantón</th><th>Base de docentes</th><th>Acción</th><th>Bachilleratos</th></tr></thead>
          <tbody>
            {cargando && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20 }}>Cargando…</td></tr>}
            {!cargando && visibles.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20 }} className="muted">Sin resultados.</td></tr>}
            {visibles.map(p => {
              const on = !!activos[p.id]?.activo;
              return (
                <tr key={p.id}>
                  <td className="mono" style={{ fontSize: 11 }}>{p.amie || '—'}</td>
                  <td><strong>{p.nombre}</strong></td>
                  <td>{p.canton || '—'}</td>
                  <td>{on ? <span className="badge b-ok">Activada{activos[p.id]?.updated_at ? ` · ${fecha(activos[p.id].updated_at)}` : ''}</span> : <span className="badge b-muted">Desactivada</span>}</td>
                  <td>
                    <button className={'btn btn-sm ' + (on ? 'btn-secondary' : 'btn-primary')} disabled={guardando === p.id} onClick={() => alternar(p)}>
                      {guardando === p.id ? '…' : on ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                  <td><button className="btn btn-secondary btn-sm" onClick={() => setBachPlantel(p)}>🎓 Configurar</button></td>
                </tr>);
            })}
          </tbody>
        </table>
      </div>
      {bachPlantel && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setBachPlantel(null); }}>
          <div className="modal" style={{ maxWidth: 760, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-h"><h3>Bachilleratos de {bachPlantel.nombre}</h3></div>
            <div className="modal-b"><BachilleratosPlantel institucionId={bachPlantel.id} /></div>
            <div className="modal-f"><button className="btn btn-primary" onClick={() => setBachPlantel(null)}>Cerrar</button></div>
          </div>
        </div>
      )}
      {filtrados.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 2px' }}>
          <span style={{ fontSize: 12, color: 'var(--slate)' }}>{filtrados.length} plantel{filtrados.length === 1 ? '' : 'es'} · página {actual} de {totalPaginas}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-ghost btn-sm" disabled={actual <= 1} onClick={() => setPagina(p => Math.max(1, p - 1))}>Anterior</button>
            <button className="btn btn-ghost btn-sm" disabled={actual >= totalPaginas} onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}>Siguiente</button>
          </div>
        </div>
      )}
    </div>
  );
}
