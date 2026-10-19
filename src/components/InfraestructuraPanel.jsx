import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GraficoLineas from './GraficoLineas.jsx';
import { fetchInfraestructura, fetchMetricasServidor, guardarLimitesInfra } from '../lib/data.js';
import { PLANES_SUPABASE, planDeLimites, porcentaje, colorCapacidad, formatearBytes, comoPorcentajeDelPico, detectarPicos } from '../lib/diagnostico.js';

const TZ = 'America/Guayaquil';
const fmtHora = iso => new Date(iso).toLocaleString('es-EC', { timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
const fmtNum = n => Number(n || 0).toLocaleString('es-EC');
const COL = { db: '#0f9d8a', tx: '#6366f1', srv: '#f59e0b' };

function Capacidad({ icon, titulo, nota, usado, total, texto, vacio }) {
  const pct = porcentaje(usado, total); const color = colorCapacidad(pct);
  return (
    <div className="card" style={{ padding: 14, margin: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--slate)' }}><span className={icon} style={{ fontSize: 16 }} />{titulo}</div>
      {vacio ? <div style={{ marginTop: 10, fontSize: 13, color: 'var(--slate)' }}>{vacio}</div> : <>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
          <span style={{ fontSize: 26, fontWeight: 800, color }}>{pct == null ? '—' : pct < 1 ? '<1' : Math.round(pct)}%</span>
          <span style={{ fontSize: 12, color: 'var(--slate)' }}>{texto}</span>
        </div>
        <div style={{ height: 8, borderRadius: 99, background: 'var(--line)', overflow: 'hidden', marginTop: 8 }} role="progressbar" aria-valuenow={Math.round(pct || 0)} aria-valuemin={0} aria-valuemax={100} aria-label={titulo}>
          <div style={{ width: `${pct || 0}%`, minWidth: pct ? 4 : 0, height: '100%', background: color, borderRadius: 99, transition: 'width .5s ease' }} />
        </div>
        {nota && <div style={{ fontSize: 11, color: 'var(--slate)', marginTop: 6 }}>{nota}</div>}
      </>}
    </div>
  );
}

export default function InfraestructuraPanel({ recargar }) {
  const [dias, setDias] = useState(14);
  const [infra, setInfra] = useState(null);
  const [srv, setSrv] = useState(null);
  const [errInfra, setErrInfra] = useState('');
  const [errSrv, setErrSrv] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [visibles, setVisibles] = useState({ db: true, tx: true, srv: true });

  const cargar = useCallback(async () => {
    setCargando(true); setErrInfra(''); setErrSrv('');
    const [a, b] = await Promise.allSettled([fetchInfraestructura(dias), fetchMetricasServidor()]);
    if (a.status === 'fulfilled') setInfra(a.value); else setErrInfra(a.reason?.message || 'No se pudo leer la base de datos.');
    if (b.status === 'fulfilled') setSrv(b.value); else { setSrv(null); setErrSrv(b.reason?.message || 'El servidor no respondió.'); }
    setCargando(false);
  }, [dias]);
  useEffect(() => { cargar(); }, [cargar]);
  // Recarga cuando el diagnóstico de arriba se vuelve a revisar (se ignora la primera marca, que es la carga inicial).
  const ultimaMarca = useRef(null);
  useEffect(() => { if (ultimaMarca.current !== null && recargar !== ultimaMarca.current) cargar(); ultimaMarca.current = recargar; }, [recargar]); // eslint-disable-line react-hooks/exhaustive-deps

  const sb = infra?.supabase;
  const plan = sb ? planDeLimites(sb.db_limite, sb.storage_limite) : 'free';
  async function cambiarPlan(id) {
    const p = PLANES_SUPABASE[id]; if (!p) return;
    setGuardando(true);
    try { await guardarLimitesInfra({ dbBytes: p.db, storageBytes: p.storage }); await cargar(); } catch (e) { setErrInfra(e.message); }
    setGuardando(false);
  }

  // Gráfico 1: perfil por hora del día (promedio de N días), como % de la hora más cargada
  const hp = infra?.horas_pico || [];
  const horaMax = useMemo(() => hp.reduce((a, h) => (h.pct > (a?.pct ?? -1) ? h : a), null), [hp]);
  const serieDia = useMemo(() => ({ id: 'dia', label: '% del pico', color: COL.db, puntos: hp.map(h => ({ pct: h.pct, texto: `${h.pct}% · ${h.ops} operaciones/día` })) }), [hp]);
  const etDia = hp.map(h => `${String(h.hora).padStart(2, '0')}:00`);
  const horasAltas = hp.filter(h => h.pct >= 80).map(h => `${String(h.hora).padStart(2, '0')}:00`);

  // Gráfico 2: flujo de las últimas 72 h (cada serie como % de su propio máximo)
  const horas = infra?.serie || [];
  const srvSerie = srv?.serie || [];
  const srvPorHora = useMemo(() => Object.fromEntries(srvSerie.map(s => [new Date(s.hora).toISOString(), s])), [srvSerie]);
  const opsDb = horas.map(h => h.ops);
  const txDb = horas.map(h => h.tx);
  const peticiones = horas.map(h => srvPorHora[new Date(h.hora).toISOString()]?.peticiones ?? 0);
  const hayTx = txDb.some(v => v > 0);
  const haySrv = peticiones.some(v => v > 0);
  const serieFlujo = useMemo(() => {
    const mk = (id, label, color, vals) => { const p = comoPorcentajeDelPico(vals); return { id, label, color, puntos: vals.map((v, i) => ({ pct: p[i], texto: `${fmtNum(v)} (${Math.round(p[i])}% de su máx.)` })) }; };
    return [
      visibles.db && mk('db', 'Escrituras en la base', COL.db, opsDb),
      visibles.tx && hayTx && mk('tx', 'Transacciones de la base', COL.tx, txDb.map(v => v || 0)),
      visibles.srv && haySrv && mk('srv', 'Peticiones al servidor', COL.srv, peticiones)
    ].filter(Boolean);
  }, [opsDb, txDb, peticiones, visibles, hayTx, haySrv]);
  const etFlujo = horas.map(h => fmtHora(h.hora));
  const picos = useMemo(() => detectarPicos(opsDb), [opsDb]);
  const picoMayor = picos.length ? picos.reduce((a, i) => (opsDb[i] > opsDb[a] ? i : a), picos[0]) : null;

  const rec = srv?.memoria; const disco = srv?.disco;

  return (
    <section style={{ marginTop: 6, marginBottom: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '4px 0 10px' }}>
        <h3 style={{ margin: 0 }}>Infraestructura y tráfico</h3>
        <span style={{ fontSize: 12, color: 'var(--slate)' }}>Datos de toda la plataforma (no cambian con el plantel elegido)</span>
      </div>
      {errInfra && <div className="card" style={{ padding: 12, color: 'var(--red)', marginBottom: 10 }}>{errInfra}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12, marginBottom: 12 }}>
        <Capacidad icon="ti ti-database" titulo="Supabase · Base de datos" usado={sb?.db_bytes} total={sb?.db_limite} texto={sb ? `${formatearBytes(sb.db_bytes)} de ${formatearBytes(sb.db_limite)}` : ''} vacio={!sb && (cargando ? 'Leyendo…' : 'Sin datos')} nota={sb?.tablas?.[0] ? `Tabla más grande: ${sb.tablas[0].tabla} (${formatearBytes(sb.tablas[0].bytes)})` : ''} />
        <Capacidad icon="ti ti-files" titulo="Supabase · Archivos (Storage)" usado={sb?.storage_bytes} total={sb?.storage_limite} texto={sb ? `${formatearBytes(sb.storage_bytes)} de ${formatearBytes(sb.storage_limite)}` : ''} vacio={!sb && (cargando ? 'Leyendo…' : 'Sin datos')} />
        <Capacidad icon="ti ti-plug-connected" titulo="Supabase · Conexiones abiertas" usado={sb?.conexiones} total={sb?.max_conexiones} texto={sb ? `${sb.conexiones} de ${sb.max_conexiones}` : ''} vacio={!sb && (cargando ? 'Leyendo…' : 'Sin datos')} nota="Si se llena, nadie más puede entrar hasta que se libere." />
        <Capacidad icon="ti ti-cpu" titulo="Railway · Memoria" usado={rec?.usada} total={rec?.total} texto={rec ? `${formatearBytes(rec.usada)} de ${formatearBytes(rec.total)}` : ''} vacio={!rec && (cargando ? 'Leyendo…' : errSrv || 'Sin datos')} nota={rec ? `Encendido hace ${Math.max(1, Math.round(srv.activo_seg / 60))} min` : ''} />
        <Capacidad icon="ti ti-server-2" titulo="Railway · Disco" usado={disco?.usado} total={disco?.total} texto={disco ? `${formatearBytes(disco.usado)} de ${formatearBytes(disco.total)}` : ''} vacio={!disco && (cargando ? 'Leyendo…' : srv ? 'No disponible' : errSrv || 'Sin datos')} nota="Es el disco temporal del contenedor: el servicio no tiene volumen persistente (guarda todo en Supabase)." />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--slate)', marginBottom: 14 }}>
        <span>Plan de Supabase para calcular los porcentajes:</span>
        <select className="fc" value={plan} disabled={guardando || !sb} onChange={e => cambiarPlan(e.target.value)} style={{ width: 'auto', padding: '4px 8px' }} aria-label="Plan de Supabase">
          <option value="free">Free (500 MB de base · 1 GB de archivos)</option>
          <option value="pro">Pro (8 GB de base · 100 GB de archivos)</option>
          {plan === 'otro' && <option value="otro">Personalizado</option>}
        </select>
        <span>Railway: memoria y disco reales del contenedor.</span>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 700 }}>Horas pico del día</div>
            <div style={{ fontSize: 12, color: 'var(--slate)' }}>Cuánto se usa el sistema en cada hora (hora de Ecuador), como % de la hora más cargada. Promedio de los últimos {dias} días.</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>{[7, 14, 30].map(d => <button key={d} type="button" className="chip" onClick={() => setDias(d)} style={{ cursor: 'pointer', border: '1px solid ' + (dias === d ? 'var(--brand)' : 'var(--line)'), background: dias === d ? 'var(--brandL)' : 'var(--white)', fontWeight: dias === d ? 700 : 500 }}>{d} días</button>)}</div>
        </div>
        {hp.length ? <>
          <div style={{ marginTop: 8 }}><GraficoLineas titulo="Uso del sistema por hora del día" series={[serieDia]} etiquetas={etDia} umbral={80} cadaX={3} /></div>
          <div style={{ fontSize: 13, marginTop: 6 }}>
            {horaMax && horaMax.ops > 0
              ? <>Hora más cargada: <strong>{String(horaMax.hora).padStart(2, '0')}:00</strong> ({horaMax.ops} operaciones por día en promedio). {horasAltas.length ? <>Horas sobre el 80 %: <strong>{horasAltas.join(', ')}</strong>.</> : null}</>
              : 'Todavía no hay actividad registrada en este período.'}
          </div>
        </> : <div style={{ padding: 20, color: 'var(--slate)' }}>{cargando ? 'Cargando…' : 'Sin datos.'}</div>}
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 700 }}>Flujo de información · últimas 72 horas</div>
            <div style={{ fontSize: 12, color: 'var(--slate)' }}>Cada línea va de 0 a 100 % de su propio máximo; al pasar el mouse ves los valores reales.</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[['db', 'Escrituras en la base', true], ['tx', 'Transacciones de la base', hayTx], ['srv', 'Peticiones al servidor', haySrv]].map(([k, l, hay]) => (
              <label key={k} className="chip" style={{ cursor: hay ? 'pointer' : 'not-allowed', opacity: hay ? 1 : .5, border: '1px solid var(--line)', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={visibles[k] && hay} disabled={!hay} onChange={e => setVisibles(v => ({ ...v, [k]: e.target.checked }))} />
                <span style={{ color: COL[k] }}>●</span>{l}
              </label>
            ))}
          </div>
        </div>
        {horas.length && serieFlujo.length ? <>
          <div style={{ marginTop: 8 }}><GraficoLineas titulo="Flujo de información de las últimas 72 horas" series={serieFlujo} etiquetas={etFlujo} marcas={picos} cadaX={12} /></div>
          {picoMayor != null
            ? <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 10, background: 'var(--redL)', color: 'var(--red)', fontSize: 13 }}>
                ⚠️ <strong>Flujo excesivo</strong>: {fmtNum(opsDb[picoMayor])} escrituras en una hora ({fmtHora(horas[picoMayor].hora)}), muy por encima de lo normal{picos.length > 1 ? ` (${picos.length} horas con picos)` : ''}. Suele ser una importación masiva; si no la hiciste tú, conviene revisarlo en Auditoría.
              </div>
            : <div style={{ marginTop: 8, fontSize: 13, color: 'var(--green)' }}>✓ Sin picos anormales en las últimas 72 horas.</div>}
          <div style={{ fontSize: 11.5, color: 'var(--slate)', marginTop: 6 }}>
            {!hayTx && 'Transacciones de la base: se empezó a medir ahora (cada 5 min); la línea aparece en cuanto haya varias horas de datos. '}
            {!haySrv && (srv ? 'Peticiones al servidor: el contador se reinicia cuando Railway reinicia o duerme el servicio, por eso puede estar en cero. ' : 'Peticiones al servidor: sin respuesta de Railway. ')}
            Las escrituras en la base salen del registro de auditoría.
          </div>
        </> : <div style={{ padding: 20, color: 'var(--slate)' }}>{cargando ? 'Cargando…' : 'Sin datos.'}</div>}
      </div>
    </section>
  );
}
