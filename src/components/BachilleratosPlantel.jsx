import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import {
  fetchTiposBachillerato, fetchFigurasProfesionales, fetchBachilleratosPlantel,
  setBachilleratoPlantel, setFigurasPlantel, contarCursosConBachillerato
} from '../lib/data.js';

// Panel único para habilitar los bachilleratos y figuras profesionales de un plantel.
// Lo usan el Admin global (por plantel) y el Admin del plantel (el suyo): ambos pueden cambiarlo.
export default function BachilleratosPlantel({ institucionId }) {
  const { profile } = useSession();
  const [tipos, setTipos] = useState([]);
  const [figuras, setFiguras] = useState([]);
  const [hab, setHab] = useState({ tipos: [], figuras: [] });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState('');
  const [abierto, setAbierto] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    let vivo = true;
    setCargando(true); setError('');
    Promise.all([fetchTiposBachillerato(), fetchFigurasProfesionales(), fetchBachilleratosPlantel(institucionId)])
      .then(([t, f, h]) => { if (vivo) { setTipos(t); setFiguras(f); setHab(h); } })
      .catch(e => vivo && setError(e.message || 'No se pudo cargar.'))
      .finally(() => vivo && setCargando(false));
    return () => { vivo = false; };
  }, [institucionId]);

  const habTipos = useMemo(() => new Set(hab.tipos), [hab.tipos]);
  const habFig = useMemo(() => new Set(hab.figuras), [hab.figuras]);

  async function alternarTipo(t) {
    const nuevo = !habTipos.has(t.codigo);
    if (!nuevo) {
      const n = await contarCursosConBachillerato(institucionId, t.codigo);
      if (n > 0 && !window.confirm(`Hay ${n} curso(s) con "${t.nombre}". Seguirán funcionando, pero no podrás crear nuevos con este tipo. ¿Deshabilitarlo?`)) return;
    }
    setGuardando(t.codigo); setError('');
    try {
      await setBachilleratoPlantel(institucionId, t.codigo, nuevo, profile?.id);
      setHab(h => ({ ...h, tipos: nuevo ? [...h.tipos, t.codigo] : h.tipos.filter(x => x !== t.codigo) }));
      if (nuevo && t.requiere_figura) setAbierto(t.codigo);
    } catch (e) { setError('No se pudo guardar: ' + (e.message || e)); }
    setGuardando('');
  }
  async function marcarFiguras(ids, activo) {
    setGuardando('figuras'); setError('');
    try {
      await setFigurasPlantel(institucionId, ids, activo, profile?.id);
      setHab(h => {
        const s = new Set(h.figuras);
        ids.forEach(id => (activo ? s.add(id) : s.delete(id)));
        return { ...h, figuras: [...s] };
      });
    } catch (e) { setError('No se pudo guardar: ' + (e.message || e)); }
    setGuardando('');
  }

  if (cargando) return <p className="muted">Cargando bachilleratos…</p>;
  return (
    <div>
      {error && <div className="lerr" style={{ display: 'flex', marginBottom: 10 }}>{error}</div>}
      {tipos.map(t => {
        const on = habTipos.has(t.codigo);
        const figs = figuras.filter(f => f.tipo_codigo === t.codigo);
        const nHab = figs.filter(f => habFig.has(f.id)).length;
        const ql = q.trim().toLowerCase();
        const areas = [...new Set(figs.map(f => f.area))];
        return (
          <div key={t.codigo} className="card" style={{ padding: 14, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: 14 }}>{t.nombre}</strong>
                {t.complementario && <span className="badge b-muted" style={{ marginLeft: 8 }}>Complementario</span>}
                <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>{t.descripcion}</div>
                {on && t.requiere_figura && <div style={{ fontSize: 12.5, marginTop: 4 }}>{nHab} de {figs.length} figuras habilitadas · <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAbierto(abierto === t.codigo ? '' : t.codigo)}>{abierto === t.codigo ? 'Ocultar figuras' : 'Elegir figuras'}</button></div>}
              </div>
              <button type="button" className={'btn btn-sm ' + (on ? 'btn-secondary' : 'btn-primary')} disabled={guardando === t.codigo} onClick={() => alternarTipo(t)}>
                {guardando === t.codigo ? '…' : on ? '✔ Habilitado · Deshabilitar' : 'Habilitar'}
              </button>
            </div>
            {on && t.requiere_figura && abierto === t.codigo && (
              <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                <input className="fc" placeholder="Buscar figura…" value={q} onChange={e => setQ(e.target.value)} style={{ marginBottom: 8 }} />
                {areas.map(a => {
                  const delArea = figs.filter(f => f.area === a && (!ql || f.nombre.toLowerCase().includes(ql)));
                  if (!delArea.length) return null;
                  const todas = delArea.every(f => habFig.has(f.id));
                  return (
                    <div key={a} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: 12.5 }}>Área {a}</strong>
                        <button type="button" className="btn btn-ghost btn-sm" disabled={guardando === 'figuras'} onClick={() => marcarFiguras(delArea.map(f => f.id), !todas)}>{todas ? 'Quitar todas' : 'Marcar todas'}</button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 4 }}>
                        {delArea.map(f => (
                          <label key={f.id} style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                            <input type="checkbox" checked={habFig.has(f.id)} disabled={guardando === 'figuras'} onChange={() => marcarFiguras([f.id], !habFig.has(f.id))} />
                            {f.nombre}
                          </label>))}
                      </div>
                    </div>);
                })}
              </div>
            )}
          </div>);
      })}
    </div>
  );
}
