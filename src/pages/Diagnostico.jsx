import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { fetchDiagnostico, medirConexiones, fetchInstitucionesBusqueda } from '../lib/data.js';
import BuscadorInstitucion from '../components/BuscadorInstitucion.jsx';
import { descargarLibro } from '../lib/exportLibro.js';
import { calcularPuntaje, estadoPuntaje } from '../lib/diagnostico.js';
import InfraestructuraPanel from '../components/InfraestructuraPanel.jsx';

const SEV = {
  alta: { label: 'Alta', color: 'var(--red)', fondo: 'var(--redL)', borde: 'var(--redXL)', peso: 12, icon: 'ti ti-alert-octagon' },
  media: { label: 'Media', color: 'var(--amberD)', fondo: 'var(--amberL)', borde: 'var(--amberXL)', peso: 6, icon: 'ti ti-alert-triangle' },
  baja: { label: 'Baja', color: 'var(--blue)', fondo: 'var(--blueL)', borde: 'var(--blueXL)', peso: 2, icon: 'ti ti-info-circle' }
};
const KPIS = [
  ['planteles', 'Planteles activos', 'ti ti-building-community'], ['usuarios', 'Usuarios', 'ti ti-users'], ['docentes', 'Docentes', 'ti ti-chalkboard'],
  ['estudiantes', 'Estudiantes', 'ti ti-school'], ['matriculas_activas', 'Matrículas activas', 'ti ti-id-badge-2'], ['paralelos', 'Paralelos', 'ti ti-layout-grid'],
  ['cargas', 'Cargas docentes', 'ti ti-book'], ['bloques', 'Bloques de horario', 'ti ti-clock']
];
const fmt = n => Number(n || 0).toLocaleString('es-EC');

function Anillo({ valor }) {
  const est = estadoPuntaje(valor); const R = 52, C = 2 * Math.PI * R;
  return (
    <div style={{ position: 'relative', width: 140, height: 140, flex: '0 0 auto' }}>
      <svg viewBox="0 0 120 120" width="140" height="140" role="img" aria-label={`Puntaje de salud ${valor} de 100`}>
        <circle cx="60" cy="60" r={R} fill="none" stroke="var(--line)" strokeWidth="10" />
        <circle cx="60" cy="60" r={R} fill="none" stroke={est.color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${(valor / 100) * C} ${C}`} transform="rotate(-90 60 60)" style={{ transition: 'stroke-dasharray .6s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1, color: est.color }}>{valor}</div>
        <div style={{ fontSize: 11, color: 'var(--slate)', marginTop: 2 }}>de 100</div>
      </div>
    </div>
  );
}

function Conexion({ icon, titulo, estado }) {
  const cargando = !estado;
  const ok = estado?.ok; const lento = ok && estado.ms > 1500;
  const color = cargando ? 'var(--slate)' : !ok ? 'var(--red)' : lento ? 'var(--amber)' : 'var(--green)';
  return (
    <div className="card" style={{ padding: 14, display: 'flex', gap: 12, alignItems: 'center', margin: 0 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--page)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color }}><span className={icon} /></div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--slate)' }}>{titulo}</div>
        <div style={{ fontWeight: 700, color }}>{cargando ? 'Comprobando…' : ok ? (lento ? 'Lento' : 'En línea') : 'Sin respuesta'}{!cargando && ok && <span style={{ fontWeight: 500, color: 'var(--slate)' }}> · {estado.ms} ms</span>}</div>
        {estado?.detalle && <div style={{ fontSize: 11, color: 'var(--slate)' }}>{estado.detalle}</div>}
      </div>
    </div>
  );
}

function Control({ c, abierto, onToggle }) {
  const sev = SEV[c.severidad] || SEV.baja; const bien = c.total === 0;
  return (
    <div style={{ border: '1px solid ' + (bien ? 'var(--line)' : sev.borde), borderRadius: 12, background: 'var(--white)', overflow: 'hidden' }}>
      <button type="button" onClick={() => !bien && onToggle()} aria-expanded={abierto} disabled={bien}
        style={{ width: '100%', display: 'flex', gap: 12, alignItems: 'center', padding: '12px 14px', background: bien ? 'transparent' : sev.fondo, border: 'none', cursor: bien ? 'default' : 'pointer', textAlign: 'left' }}>
        <span className={bien ? 'ti ti-circle-check' : sev.icon} style={{ fontSize: 22, color: bien ? 'var(--green)' : sev.color }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{c.titulo}</span>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--slate)' }}>{bien ? 'Sin hallazgos' : c.que}</span>
        </span>
        {!bien && <span className="badge" style={{ background: 'var(--white)', color: sev.color, border: '1px solid ' + sev.borde }}>{sev.label}</span>}
        <span style={{ fontWeight: 800, fontSize: 18, minWidth: 44, textAlign: 'right', color: bien ? 'var(--green)' : sev.color }}>{fmt(c.total)}</span>
        {!bien && <span className={abierto ? 'ti ti-chevron-up' : 'ti ti-chevron-down'} style={{ color: 'var(--slate)' }} />}
      </button>
      {abierto && !bien && (
        <div style={{ padding: '12px 14px', borderTop: '1px solid ' + sev.borde }}>
          <div style={{ fontSize: 13, marginBottom: 10 }}><strong>Qué hacer:</strong> {c.accion}</div>
          <div style={{ border: '1px solid var(--line)', borderRadius: 10, maxHeight: 280, overflowY: 'auto' }}>
            <table className="data" style={{ width: '100%' }}>
              <thead><tr><th style={{ width: '38%' }}>Plantel</th><th>Detalle</th></tr></thead>
              <tbody>{(c.muestra || []).map((m, i) => <tr key={i}><td style={{ fontSize: 12 }}>{m.plantel}</td><td style={{ fontSize: 12 }}>{m.detalle}</td></tr>)}</tbody>
            </table>
          </div>
          {c.total > (c.muestra || []).length && <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 6 }}>Se muestran los primeros {(c.muestra || []).length} de {fmt(c.total)}. Elige un plantel arriba para ver solo los suyos.</div>}
        </div>
      )}
    </div>
  );
}

export default function Diagnostico() {
  const { profile } = useSession();
  const esSuper = profile?.rolDb === 'super_admin';
  const [instId, setInstId] = useState('');
  const [instituciones, setInstituciones] = useState([]);
  const [instCargando, setInstCargando] = useState(false);
  const [datos, setDatos] = useState(null);
  const [conex, setConex] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState('hallazgos');
  const [abiertos, setAbiertos] = useState(() => new Set());
  const [revisado, setRevisado] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true); setError(''); setConex(null);
    medirConexiones().then(setConex).catch(() => setConex({ base: { ok: false, ms: 0 }, servidor: { ok: false, ms: 0 } }));
    try { setDatos(await fetchDiagnostico(instId || null)); setRevisado(new Date()); }
    catch (e) { setError(e.message || 'No se pudo generar el diagnóstico.'); }
    setCargando(false);
  }, [instId]);

  useEffect(() => { if (esSuper) cargar(); }, [esSuper, cargar]);
  useEffect(() => {
    if (!esSuper) return; let activo = true; setInstCargando(true);
    fetchInstitucionesBusqueda().then(l => { if (activo) setInstituciones(l); }).catch(() => {}).finally(() => { if (activo) setInstCargando(false); });
    return () => { activo = false; };
  }, [esSuper]);

  const controles = datos?.controles || [];
  const puntaje = useMemo(() => calcularPuntaje(controles), [controles]);
  const est = estadoPuntaje(puntaje);
  const cuenta = useMemo(() => ({
    alta: controles.filter(c => c.severidad === 'alta' && c.total > 0).length,
    media: controles.filter(c => c.severidad === 'media' && c.total > 0).length,
    baja: controles.filter(c => c.severidad === 'baja' && c.total > 0).length,
    ok: controles.filter(c => c.total === 0).length
  }), [controles]);
  const visibles = useMemo(() => {
    const orden = { alta: 0, media: 1, baja: 2 };
    return controles.filter(c => filtro === 'todos' || (filtro === 'hallazgos' ? c.total > 0 : filtro === 'ok' ? c.total === 0 : c.severidad === filtro && c.total > 0))
      .sort((a, b) => (b.total > 0) - (a.total > 0) || orden[a.severidad] - orden[b.severidad] || b.total - a.total);
  }, [controles, filtro]);

  function alternar(id) { setAbiertos(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function exportar() {
    const alcance = instId ? (instituciones.find(i => i.id === instId)?.nombre || 'plantel') : 'Todos los planteles';
    descargarLibro(`diagnostico_${new Date().toISOString().slice(0, 10)}.xlsx`, [
      { nombre: 'Resumen', filas: [{ Concepto: 'Alcance', Valor: alcance }, { Concepto: 'Puntaje de salud', Valor: `${puntaje} / 100 (${est.texto})` }, ...KPIS.map(([k, l]) => ({ Concepto: l, Valor: datos?.resumen?.[k] ?? 0 })), ...controles.map(c => ({ Concepto: `[${SEV[c.severidad]?.label}] ${c.titulo}`, Valor: c.total }))], cols: ['Concepto', 'Valor'] },
      { nombre: 'Hallazgos', filas: controles.flatMap(c => (c.muestra || []).map(m => ({ Control: c.titulo, Severidad: SEV[c.severidad]?.label, Plantel: m.plantel, Detalle: m.detalle, 'Qué hacer': c.accion }))), cols: ['Control', 'Severidad', 'Plantel', 'Detalle', 'Qué hacer'] }
    ]);
  }

  if (!esSuper) return <div><h2>Diagnóstico del sistema</h2><div className="card"><p className="muted">Esta pantalla es solo para el Super Administrador.</p></div></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: '0 0 4px' }}>Diagnóstico del sistema</h2>
          <div style={{ fontSize: 13, color: 'var(--slate)' }}>Estado de la plataforma y calidad de los datos{revisado ? ` · revisado ${revisado.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}` : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={exportar} disabled={cargando || !datos}>⬇️ Exportar Excel</button>
          <button className="btn btn-primary" onClick={cargar} disabled={cargando}>{cargando ? 'Revisando…' : '↻ Volver a revisar'}</button>
        </div>
      </div>

      <div className="card" style={{ padding: 14, marginBottom: 16 }}>
        <label className="fl">Alcance</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px' }}><BuscadorInstitucion instituciones={instituciones} value={instId} onChange={id => setInstId(id)} cargando={instCargando} /></div>
          <button type="button" className="btn btn-secondary" onClick={() => setInstId('')} disabled={!instId}>Todos los planteles</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 6 }}>{instId ? 'Mostrando solo el plantel elegido.' : 'Mostrando todos los planteles.'}</div>
      </div>

      {error && <div className="card" style={{ padding: 14, color: 'var(--red)', marginBottom: 16 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div className="card" style={{ padding: 16, margin: 0, display: 'flex', gap: 16, alignItems: 'center', gridColumn: 'span 1' }}>
          {cargando && !datos ? <div style={{ width: 140, height: 140, borderRadius: '50%', background: 'var(--page)' }} /> : <Anillo valor={puntaje} />}
          <div>
            <div style={{ fontSize: 12, color: 'var(--slate)' }}>Salud de los datos</div>
            <div style={{ fontWeight: 800, fontSize: 18, color: est.color }}>{cargando && !datos ? '…' : est.texto}</div>
            <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 6, lineHeight: 1.6 }}>
              <span style={{ color: SEV.alta.color }}>● {cuenta.alta} alta</span> · <span style={{ color: SEV.media.color }}>● {cuenta.media} media</span><br />
              <span style={{ color: SEV.baja.color }}>● {cuenta.baja} baja</span> · <span style={{ color: 'var(--green)' }}>● {cuenta.ok} sin problema</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          <Conexion icon="ti ti-database" titulo="Base de datos (Supabase)" estado={conex?.base} />
          <Conexion icon="ti ti-server" titulo="Servidor de asistencia y notas (Railway)" estado={conex?.servidor} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 18 }}>
        {KPIS.map(([k, label, icon]) => (
          <div key={k} className="card" style={{ padding: 12, margin: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--slate)' }}><span className={icon} />{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{cargando && !datos ? '—' : fmt(datos?.resumen?.[k])}</div>
          </div>
        ))}
      </div>

      <InfraestructuraPanel recargar={revisado} />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {[['hallazgos', 'Con hallazgos'], ['alta', 'Alta'], ['media', 'Media'], ['baja', 'Baja'], ['ok', 'Sin problema'], ['todos', 'Todos']].map(([v, l]) => (
          <button key={v} type="button" className="chip" onClick={() => setFiltro(v)}
            style={{ cursor: 'pointer', border: '1px solid ' + (filtro === v ? 'var(--brand)' : 'var(--line)'), background: filtro === v ? 'var(--brandL)' : 'var(--white)', color: filtro === v ? 'var(--brandD)' : 'var(--ink3)', fontWeight: filtro === v ? 700 : 500 }}>{l}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {cargando && !datos && [1, 2, 3].map(i => <div key={i} style={{ height: 62, borderRadius: 12, background: 'var(--page)', border: '1px solid var(--line)' }} />)}
        {visibles.map(c => <Control key={c.id} c={c} abierto={abiertos.has(c.id)} onToggle={() => alternar(c.id)} />)}
        {datos && visibles.length === 0 && <div className="card" style={{ padding: 18, textAlign: 'center', color: 'var(--slate)' }}>{filtro === 'hallazgos' ? '🎉 No hay hallazgos: todo está en orden.' : 'No hay controles en este filtro.'}</div>}
      </div>
    </div>
  );
}
