import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import {
  fetchTicTiempoReal, fetchTicHistorial, fetchTicResumenUsuarios, fetchTicUso, fetchTicLatenciaUsuarios,
  fetchTicEventos, marcarTicEvento, bloquearTicIp, desbloquearTicIp, fetchTicIpsBloqueadas
} from '../lib/data.js';
import { descargarLibro } from '../lib/exportLibro.js';
import GraficoLineas from '../components/GraficoLineas.jsx';
import {
  clasificarLatencia, usuarioConProblema, formatoDuracion, navegadorCorto, etiquetaEvento, esEventoExterno,
  ESTADOS_RED, DIAS_SEMANA, horaPico, intensidadCalor
} from '../lib/tic.js';

const TZ = 'America/Guayaquil';
const fmt = n => Number(n || 0).toLocaleString('es-EC');
const fHora = iso => (iso ? new Date(iso).toLocaleString('es-EC', { timeZone: TZ, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }) : '—');
const fSoloHora = iso => new Date(iso).toLocaleTimeString('es-EC', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
const SEV = { alta: { c: 'var(--red)', f: 'var(--redL)' }, media: { c: 'var(--amberD)', f: 'var(--amberL)' }, baja: { c: 'var(--blue)', f: 'var(--blueL)' } };
const ROL = { super_admin: 'Super Admin', admin_plantel: 'Admin plantel', secretario: 'Secretaría', supervisor_general: 'Supervisor', supervisor_plantel: 'Supervisor plantel', contador_general: 'Contador', contador_plantel: 'Contador plantel', administrativo: 'Administrativo', inspector_general: 'Inspector', docente: 'Docente', estudiante: 'Estudiante', padre: 'Padre/Madre' };

function Kpi({ icono, titulo, valor, nota, color }) {
  return (
    <div className="card" style={{ padding: 14, margin: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--slate)' }}><span className={icono} />{titulo}</div>
      <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4, color: color || 'var(--ink)' }}>{valor}</div>
      {nota && <div style={{ fontSize: 11.5, color: 'var(--slate)', marginTop: 2 }}>{nota}</div>}
    </div>
  );
}
const Ms = ({ v }) => { const c = clasificarLatencia(v); return <span style={{ color: c.color, fontWeight: 600 }}>{v == null ? '—' : `${fmt(v)} ms`}</span>; };
const Vacio = ({ children }) => <div style={{ padding: 22, textAlign: 'center', color: 'var(--slate)', fontSize: 13 }}>{children}</div>;
const Err = ({ e }) => (e ? <div className="card" style={{ padding: 12, color: 'var(--red)', marginBottom: 12, fontSize: 13 }}>{e}</div> : null);

function Banner({ diag }) {
  if (!diag) return null;
  const e = ESTADOS_RED[diag.estado] || ESTADOS_RED.normal;
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '14px 16px', borderRadius: 12, background: e.fondo, border: `1px solid ${e.color}`, marginBottom: 14 }}>
      <span className={e.icono} style={{ fontSize: 30, color: e.color }} />
      <div><div style={{ fontWeight: 800, color: e.color }}>{e.texto}</div><div style={{ fontSize: 13, color: 'var(--ink)' }}>{diag.mensaje}</div></div>
    </div>
  );
}

function TablaPlanteles({ planteles }) {
  if (!planteles?.length) return <Vacio>Aún no hay planteles con usuarios conectados en los últimos 20 minutos.</Vacio>;
  const est = { normal: ['Normal', 'var(--green)'], lento: ['Conexión lenta', 'var(--amberD)'], sin_conexion: ['Sin conexión', 'var(--red)'] };
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data" style={{ width: '100%' }}>
        <thead><tr><th>Plantel</th><th>Estado</th><th>Conectados</th><th>Sin reportar</th><th>Latencia BD (mediana / p95)</th><th>Servidor p95</th><th>Afectados</th></tr></thead>
        <tbody>{planteles.map(p => {
          const [t, c] = est[p.estado] || est.normal;
          return <tr key={p.institucion_id}><td style={{ fontSize: 12.5 }}>{p.plantel || '—'}<div style={{ fontSize: 11, color: 'var(--slate)' }}>{p.amie}</div></td><td style={{ color: c, fontWeight: 700 }}>{t}</td><td>{p.activos}</td><td style={{ color: p.silenciosos ? 'var(--red)' : undefined }}>{p.silenciosos}</td><td><Ms v={p.db_p50} /> / <Ms v={p.db_p95} /></td><td><Ms v={p.api_p95} /></td><td>{p.afectados}/{p.usuarios || 0}</td></tr>;
        })}</tbody>
      </table>
    </div>
  );
}

// ───────────────────────── Tiempo real ─────────────────────────
function TiempoReal() {
  const [d, setD] = useState(null); const [err, setErr] = useState(''); const [auto, setAuto] = useState(true); const [t, setT] = useState(null);
  const cargar = useCallback(async () => { try { setD(await fetchTicTiempoReal()); setErr(''); setT(new Date()); } catch (e) { setErr(e.message); } }, []);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { if (!auto) return undefined; const id = setInterval(cargar, 15000); return () => clearInterval(id); }, [auto, cargar]);
  const serie = d?.serie || [];
  const maxU = Math.max(1, ...serie.map(s => Number(s.usuarios) || 0));
  const maxL = Math.max(1000, ...serie.map(s => Number(s.db_p95) || 0));
  const et = serie.map(s => fSoloHora(s.ts));
  const gUsuarios = [{ id: 'u', label: 'Usuarios activos', color: '#0f9d8a', puntos: serie.map(s => ({ valor: s.usuarios, pct: (s.usuarios / maxU) * 100, texto: `${s.usuarios} usuarios` })) }];
  const gLat = [
    { id: 'db', label: 'Base de datos (p95)', color: '#6366f1', puntos: serie.map(s => ({ valor: s.db_p95, pct: (s.db_p95 / maxL) * 100, texto: `${fmt(s.db_p95)} ms` })) },
    { id: 'api', label: 'Servidor (p95)', color: '#f59e0b', puntos: serie.map(s => ({ valor: s.api_p95, pct: Math.min(100, ((s.api_p95 || 0) / maxL) * 100), texto: `${fmt(s.api_p95)} ms` })) }
  ];
  const diag = d?.diagnostico; const lat = d?.lat_5m; const ev = d?.eventos_nuevos;
  return (
    <div>
      <Err e={err} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 12, color: 'var(--slate)' }}>{t ? `Actualizado ${t.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Cargando…'}{auto ? ' · se refresca cada 15 s' : ''}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <label style={{ fontSize: 12.5, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} /> Tiempo real</label>
          <button className="btn btn-secondary btn-sm" onClick={cargar}>↻ Actualizar</button>
        </div>
      </div>
      <Banner diag={diag} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 14 }}>
        <Kpi icono="ti ti-users" titulo="Conectados ahora" valor={fmt(d?.conectados)} nota={`${fmt(d?.sesiones_hoy)} ingresos hoy`} />
        <Kpi icono="ti ti-database" titulo="Latencia BD (5 min)" valor={lat?.db_p50 != null ? `${fmt(lat.db_p50)} ms` : '—'} nota={lat?.db_p95 != null ? `p95: ${fmt(lat.db_p95)} ms` : 'sin muestras'} color={clasificarLatencia(lat?.db_p95).color} />
        <Kpi icono="ti ti-server" titulo="Servidor Railway p95" valor={lat?.api_p95 != null ? `${fmt(lat.api_p95)} ms` : '—'} nota="el primer acceso tras dormir es lento" color={lat?.api_p95 > 6000 ? 'var(--red)' : lat?.api_p95 > 3000 ? 'var(--amber)' : undefined} />
        <Kpi icono="ti ti-plug-connected" titulo="Conexiones a la BD" valor={diag?.conexiones != null ? `${diag.conexiones}/${diag.conexiones_max}` : '—'} nota="más de 85 % = saturación" />
        <Kpi icono="ti ti-shield-exclamation" titulo="Alertas nuevas (24 h)" valor={fmt((ev?.alta || 0) + (ev?.media || 0) + (ev?.baja || 0))} nota={`${ev?.alta || 0} altas · ${d?.ips_bloqueadas || 0} IP bloqueadas`} color={ev?.alta ? 'var(--red)' : undefined} />
      </div>
      <div className="card" style={{ padding: 14, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Usuarios activos (últimas 3 horas, cada 5 min)</div>
        {serie.length > 1 ? <GraficoLineas titulo="Usuarios activos" series={gUsuarios} etiquetas={et} cadaX={4} fmtY={g => String(Math.round((g / 100) * maxU))} /> : <Vacio>Aún no hay suficientes latidos. Los usuarios reportan cada ~90 s mientras tengan el sistema abierto.</Vacio>}
      </div>
      <div className="card" style={{ padding: 14, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Latencia (p95) — base de datos y servidor</div>
        {serie.length > 1 ? <GraficoLineas titulo="Latencia" series={gLat} etiquetas={et} cadaX={4} fmtY={g => `${fmt(Math.round((g / 100) * maxL))}`} umbral={(2000 / maxL) * 100 <= 100 ? (2000 / maxL) * 100 : null} umbralTexto="2 000 ms (lento)" /> : <Vacio>Sin datos todavía.</Vacio>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
        <div className="card" style={{ padding: 14, margin: 0 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Planteles con más usuarios conectados</div>
          {(d?.top_planteles || []).length ? d.top_planteles.map(p => <div key={p.plantel} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--line)' }}><span>{p.plantel}</span><strong>{p.n}</strong></div>) : <Vacio>Nadie conectado.</Vacio>}
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--slate)' }}>{Object.entries(d?.por_rol || {}).map(([r, n]) => `${ROL[r] || r}: ${n}`).join(' · ')}</div>
        </div>
        <div className="card" style={{ padding: 14, margin: 0, overflow: 'hidden' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Estado por plantel</div>
          <TablaPlanteles planteles={diag?.planteles} />
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── Accesos ─────────────────────────
function Accesos({ instituciones }) {
  const hoy = new Date().toISOString().slice(0, 10); const hace7 = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const [q, setQ] = useState(''); const [desde, setDesde] = useState(hace7); const [hasta, setHasta] = useState(hoy); const [inst, setInst] = useState('');
  const [vista, setVista] = useState('sesiones'); const [filas, setFilas] = useState([]); const [err, setErr] = useState(''); const [cargando, setCargando] = useState(false);
  const cargar = useCallback(async () => {
    setCargando(true); setErr('');
    const base = { q: q.trim() || null, desde: new Date(desde + 'T00:00:00-05:00').toISOString(), hasta: new Date(hasta + 'T23:59:59-05:00').toISOString(), inst: inst || null };
    try { setFilas(vista === 'sesiones' ? await fetchTicHistorial({ ...base, limite: 500 }) : await fetchTicResumenUsuarios(base)); } catch (e) { setErr(e.message); }
    setCargando(false);
  }, [q, desde, hasta, inst, vista]);
  useEffect(() => { cargar(); }, [vista]); // eslint-disable-line react-hooks/exhaustive-deps
  function exportar() {
    if (vista === 'sesiones') descargarLibro(`accesos_${hoy}.xlsx`, [{ nombre: 'Accesos', cols: ['Usuario', 'Correo', 'Rol', 'Plantel', 'IP', 'Navegador', 'Entrada', 'Salida', 'Minutos', 'Cierre'], filas: filas.map(s => ({ Usuario: s.nombre, Correo: s.email, Rol: ROL[s.rol] || s.rol, Plantel: s.plantel || '', IP: s.ip || '', Navegador: navegadorCorto(s.user_agent), Entrada: fHora(s.inicio), Salida: s.abierta ? 'conectado' : fHora(s.fin || s.ultimo_latido), Minutos: s.minutos, Cierre: s.motivo_fin || '' })) }]);
    else descargarLibro(`tiempo_por_usuario_${hoy}.xlsx`, [{ nombre: 'Por usuario', cols: ['Usuario', 'Correo', 'Rol', 'Plantel', 'Ingresos', 'Minutos totales', 'Promedio por ingreso', 'Última entrada', 'IP distintas'], filas: filas.map(u => ({ Usuario: u.nombre, Correo: u.email, Rol: ROL[u.rol] || u.rol, Plantel: u.plantel || '', Ingresos: u.ingresos, 'Minutos totales': u.minutos, 'Promedio por ingreso': u.promedio_min, 'Última entrada': fHora(u.ultima_entrada), 'IP distintas': u.ips })) }]);
  }
  return (
    <div>
      <div className="card" style={{ padding: 14, marginBottom: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, alignItems: 'end' }}>
        <div><label className="fl">Buscar usuario</label><input className="fc" placeholder="Nombre o correo" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && cargar()} /></div>
        <div><label className="fl">Desde</label><input className="fc" type="date" value={desde} onChange={e => setDesde(e.target.value)} /></div>
        <div><label className="fl">Hasta</label><input className="fc" type="date" value={hasta} onChange={e => setHasta(e.target.value)} /></div>
        <div><label className="fl">Plantel</label><select className="fc" value={inst} onChange={e => setInst(e.target.value)}><option value="">Todos</option>{(instituciones || []).map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}</select></div>
        <div style={{ display: 'flex', gap: 8 }}><button className="btn btn-primary" onClick={cargar} disabled={cargando}>{cargando ? 'Buscando…' : 'Buscar'}</button><button className="btn btn-secondary" onClick={exportar} disabled={!filas.length}>⬇️ Excel</button></div>
      </div>
      <div className="tabs" style={{ marginBottom: 10 }}>
        {[['sesiones', 'Entradas y salidas'], ['usuarios', 'Tiempo por usuario']].map(([v, l]) => <button key={v} className={'tab' + (vista === v ? ' on' : '')} onClick={() => setVista(v)}>{l}</button>)}
      </div>
      <Err e={err} />
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {!filas.length ? <Vacio>{cargando ? 'Cargando…' : 'No hay accesos en este período. Los accesos se registran desde que se publicó este módulo.'}</Vacio> : (
          <div style={{ overflowX: 'auto', maxHeight: 560, overflowY: 'auto' }}>
            {vista === 'sesiones' ? (
              <table className="data" style={{ width: '100%' }}>
                <thead><tr><th>Usuario</th><th>Rol</th><th>Plantel</th><th>Entrada</th><th>Salida</th><th>Tiempo dentro</th><th>IP</th><th>Navegador</th></tr></thead>
                <tbody>{filas.map(s => <tr key={s.id}><td style={{ fontSize: 12.5 }}><strong>{s.nombre || '—'}</strong><div style={{ fontSize: 11, color: 'var(--slate)' }}>{s.email}</div></td><td style={{ fontSize: 12 }}>{ROL[s.rol] || s.rol}</td><td style={{ fontSize: 12 }}>{s.plantel || '—'}</td><td style={{ fontSize: 12 }}>{fHora(s.inicio)}</td><td style={{ fontSize: 12 }}>{s.abierta ? <span className="badge" style={{ background: 'var(--greenL, #ecfdf5)', color: 'var(--green)' }}>● conectado</span> : fHora(s.fin || s.ultimo_latido)}</td><td style={{ fontSize: 12.5, fontWeight: 600 }}>{formatoDuracion(s.minutos)}</td><td style={{ fontSize: 12 }}>{s.ip || '—'}</td><td style={{ fontSize: 12 }}>{navegadorCorto(s.user_agent)}</td></tr>)}</tbody>
              </table>
            ) : (
              <table className="data" style={{ width: '100%' }}>
                <thead><tr><th>Usuario</th><th>Rol</th><th>Plantel</th><th>Ingresos</th><th>Tiempo total</th><th>Promedio</th><th>Última entrada</th><th>IP distintas</th></tr></thead>
                <tbody>{filas.map(u => <tr key={u.user_id}><td style={{ fontSize: 12.5 }}><strong>{u.nombre || '—'}</strong><div style={{ fontSize: 11, color: 'var(--slate)' }}>{u.email}</div></td><td style={{ fontSize: 12 }}>{ROL[u.rol] || u.rol}</td><td style={{ fontSize: 12 }}>{u.plantel || '—'}</td><td>{u.ingresos}</td><td style={{ fontWeight: 600 }}>{formatoDuracion(u.minutos)}</td><td style={{ fontSize: 12 }}>{formatoDuracion(u.promedio_min)}</td><td style={{ fontSize: 12 }}>{fHora(u.ultima_entrada)}</td><td style={{ color: u.ips >= 3 ? 'var(--red)' : undefined }}>{u.ips}</td></tr>)}</tbody>
              </table>
            )}
          </div>
        )}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--slate)', marginTop: 6 }}>El tiempo dentro se mide por latidos cada ~90 s; el margen de error es de aproximadamente 1,5 minutos por sesión. Si un usuario cierra la pestaña sin salir, la sesión se cierra sola al dejar de reportar.</div>
    </div>
  );
}

// ───────────────────────── Seguridad ─────────────────────────
function Seguridad() {
  const [dias, setDias] = useState(7); const [estado, setEstado] = useState(''); const [sev, setSev] = useState(''); const [login, setLogin] = useState(false);
  const [filas, setFilas] = useState([]); const [bloq, setBloq] = useState([]); const [err, setErr] = useState(''); const [cargando, setCargando] = useState(false);
  const [accion, setAccion] = useState(null); const [motivo, setMotivo] = useState(''); const [horas, setHoras] = useState('24');
  const cargar = useCallback(async () => {
    setCargando(true); setErr('');
    try { const [a, b] = await Promise.all([fetchTicEventos({ dias, estado: estado || null, sev: sev || null, incluirLogin: login }), fetchTicIpsBloqueadas()]); setFilas(a); setBloq(b); } catch (e) { setErr(e.message); }
    setCargando(false);
  }, [dias, estado, sev, login]);
  useEffect(() => { cargar(); }, [cargar]);
  const cuenta = useMemo(() => ({ ext: filas.filter(e => esEventoExterno(e.tipo)).length, int: filas.filter(e => !esEventoExterno(e.tipo) && !['ip_bloqueada', 'ip_desbloqueada'].includes(e.tipo)).length, alta: filas.filter(e => e.severidad === 'alta').length }), [filas]);
  async function marcar(e, est) { try { await marcarTicEvento(e.id, est); await cargar(); } catch (x) { setErr(x.message); } }
  async function confirmarBloqueo() {
    try { await bloquearTicIp(accion.ip, motivo || etiquetaEvento(accion.tipo), horas === 'siempre' ? null : Number(horas)); setAccion(null); setMotivo(''); await cargar(); } catch (x) { setErr(x.message); }
  }
  async function expediente(ip) {
    try {
      const evs = await fetchTicEventos({ ip, dias: 180, incluirLogin: true, limite: 1000 });
      descargarLibro(`expediente_${ip.replace(/[^0-9a-f.:]/gi, '_')}.xlsx`, [
        { nombre: 'Resumen', cols: ['Dato', 'Valor'], filas: [{ Dato: 'IP', Valor: ip }, { Dato: 'Eventos registrados', Valor: evs.length }, { Dato: 'Primer evento', Valor: fHora(evs[evs.length - 1]?.ts) }, { Dato: 'Último evento', Valor: fHora(evs[0]?.ts) }, { Dato: 'Generado', Valor: new Date().toLocaleString('es-EC', { timeZone: TZ }) }, { Dato: 'Nota', Valor: 'Evidencia para denuncia ante la Fiscalía / EcuCERT. Las fechas están en hora de Ecuador.' }] },
        { nombre: 'Eventos', cols: ['Fecha', 'Tipo', 'Severidad', 'Correo', 'Detalle'], filas: evs.map(e => ({ Fecha: fHora(e.ts), Tipo: etiquetaEvento(e.tipo), Severidad: e.severidad, Correo: e.email || '', Detalle: JSON.stringify(e.detalle || {}) })) }
      ]);
    } catch (x) { setErr(x.message); }
  }
  return (
    <div>
      <div className="card" style={{ padding: 14, marginBottom: 12, background: 'var(--amberL)', border: '1px solid var(--amberXL)' }}>
        <strong>¿Contraatacar?</strong> No: atacar de vuelta es delito (COIP, acceso no consentido a sistemas), y la IP que se ve casi nunca es la del atacante real. Lo correcto es <strong>bloquear la IP</strong>, guardar la evidencia (botón «Expediente») y denunciarla. El bloqueo aplica al servidor de asistencia y notas (Railway); el inicio de sesión lo protege Supabase.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 12 }}>
        <Kpi icono="ti ti-world-www" titulo="Eventos externos" valor={fmt(cuenta.ext)} nota="ataques, sondeos, intentos de ingreso" />
        <Kpi icono="ti ti-user-exclamation" titulo="Uso indebido interno" valor={fmt(cuenta.int)} nota="usuarios del propio sistema" />
        <Kpi icono="ti ti-alert-octagon" titulo="Severidad alta" valor={fmt(cuenta.alta)} color={cuenta.alta ? 'var(--red)' : undefined} />
        <Kpi icono="ti ti-ban" titulo="IP bloqueadas" valor={fmt(bloq.length)} />
      </div>
      <div className="card" style={{ padding: 12, marginBottom: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
        <div><label className="fl">Período</label><select className="fc" value={dias} onChange={e => setDias(Number(e.target.value))}>{[1, 7, 30, 90].map(d => <option key={d} value={d}>{d === 1 ? 'Últimas 24 h' : `Últimos ${d} días`}</option>)}</select></div>
        <div><label className="fl">Severidad</label><select className="fc" value={sev} onChange={e => setSev(e.target.value)}><option value="">Todas</option><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></select></div>
        <div><label className="fl">Estado</label><select className="fc" value={estado} onChange={e => setEstado(e.target.value)}><option value="">Todos</option><option value="nuevo">Nuevos</option><option value="revisado">Revisados</option><option value="descartado">Descartados</option></select></div>
        <label style={{ fontSize: 12.5, display: 'flex', gap: 6, alignItems: 'center', paddingBottom: 8 }}><input type="checkbox" checked={login} onChange={e => setLogin(e.target.checked)} /> Incluir cada intento fallido</label>
        <button className="btn btn-secondary" onClick={cargar} disabled={cargando}>↻</button>
      </div>
      <Err e={err} />
      {bloq.length > 0 && (
        <div className="card" style={{ padding: 12, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>IP bloqueadas</div>
          {bloq.map(b => <div key={b.ip} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}><code>{b.ip}</code><span style={{ color: 'var(--slate)', flex: 1 }}>{b.motivo || ''} · {b.hasta ? `hasta ${fHora(b.hasta)}` : 'permanente'}</span><button className="btn btn-secondary btn-sm" onClick={async () => { await desbloquearTicIp(b.ip); cargar(); }}>Desbloquear</button></div>)}
        </div>
      )}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {!filas.length ? <Vacio>{cargando ? 'Cargando…' : '🎉 Sin eventos de seguridad en este período.'}</Vacio> : (
          <div style={{ overflowX: 'auto', maxHeight: 560, overflowY: 'auto' }}>
            <table className="data" style={{ width: '100%' }}>
              <thead><tr><th>Cuándo</th><th>Severidad</th><th>Qué pasó</th><th>Origen</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>{filas.map(e => {
                const s = SEV[e.severidad] || SEV.baja; const det = e.detalle || {};
                const resumen = Object.entries(det).filter(([k]) => k !== 'ruta' || e.tipo === 'sondeo_ruta').map(([k, v]) => `${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' · ');
                return (
                  <tr key={e.id} style={{ opacity: e.estado === 'descartado' ? 0.55 : 1 }}>
                    <td style={{ fontSize: 12 }}>{fHora(e.ts)}</td>
                    <td><span className="badge" style={{ background: s.f, color: s.c }}>{e.severidad}</span></td>
                    <td style={{ fontSize: 12.5 }}><strong>{etiquetaEvento(e.tipo)}</strong><div style={{ fontSize: 11.5, color: 'var(--slate)' }}>{[e.email, e.plantel, resumen].filter(Boolean).join(' · ')}</div></td>
                    <td style={{ fontSize: 12 }}>{e.ip ? <><code>{e.ip}</code>{e.bloqueada && <span className="badge" style={{ marginLeft: 6, background: 'var(--redL)', color: 'var(--red)' }}>bloqueada</span>}{e.usuarios_ip > 0 && <div style={{ fontSize: 11, color: e.usuarios_ip >= 3 ? 'var(--amberD)' : 'var(--slate)' }}>{e.usuarios_ip >= 3 ? `⚠ ${e.usuarios_ip} usuarios legítimos usan esta IP` : `${e.usuarios_ip} usuario(s) la han usado`}</div>}</> : '—'}</td>
                    <td style={{ fontSize: 12 }}>{e.estado}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {e.estado === 'nuevo' && <button className="btn btn-secondary btn-sm" onClick={() => marcar(e, 'revisado')}>Revisado</button>}{' '}
                      {e.estado !== 'descartado' && <button className="btn btn-ghost btn-sm" onClick={() => marcar(e, 'descartado')}>Descartar</button>}{' '}
                      {e.ip && !e.bloqueada && <button className="btn btn-danger btn-sm" onClick={() => setAccion(e)}>Bloquear IP</button>}{' '}
                      {e.ip && <button className="btn btn-ghost btn-sm" onClick={() => expediente(e.ip)}>Expediente</button>}
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </div>
      {accion && (
        <div className="modal-bg" onClick={() => setAccion(null)}>
          <div className="card" style={{ maxWidth: 440, margin: '10vh auto', padding: 18 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Bloquear {accion.ip}</h3>
            {accion.usuarios_ip >= 3 && <div style={{ padding: 10, borderRadius: 8, background: 'var(--amberL)', color: 'var(--amberD)', fontSize: 13, marginBottom: 10 }}>⚠ {accion.usuarios_ip} usuarios han ingresado desde esta IP: puede ser el internet de un plantel. Bloquearla les impediría guardar asistencia y notas.</div>}
            <label className="fl">Motivo</label><input className="fc" value={motivo} placeholder={etiquetaEvento(accion.tipo)} onChange={e => setMotivo(e.target.value)} />
            <label className="fl" style={{ marginTop: 10 }}>Duración</label>
            <select className="fc" value={horas} onChange={e => setHoras(e.target.value)}><option value="1">1 hora</option><option value="24">24 horas</option><option value="168">7 días</option><option value="siempre">Permanente</option></select>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}><button className="btn btn-secondary" onClick={() => setAccion(null)}>Cancelar</button><button className="btn btn-danger" onClick={confirmarBloqueo}>Bloquear</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Uso y hora pico ─────────────────────────
function Uso({ instituciones }) {
  const [dias, setDias] = useState(14); const [inst, setInst] = useState(''); const [d, setD] = useState(null); const [err, setErr] = useState('');
  useEffect(() => { setErr(''); fetchTicUso(dias, inst || null).then(setD).catch(e => setErr(e.message)); }, [dias, inst]);
  const pico = horaPico(d?.por_hora);
  const mapa = useMemo(() => { const m = {}; let max = 0; for (const c of d?.heatmap || []) { m[`${c.dow}-${c.hr}`] = c; max = Math.max(max, Number(c.usuarios)); } return { m, max }; }, [d]);
  const maxDia = Math.max(1, ...(d?.por_dia || []).map(x => Number(x.pico_usuarios)));
  const diaPico = (d?.por_dia || []).reduce((a, x) => (!a || x.pico_usuarios > a.pico_usuarios ? x : a), null);
  return (
    <div>
      <Err e={err} />
      <div className="card" style={{ padding: 12, marginBottom: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
        <div><label className="fl">Período</label><select className="fc" value={dias} onChange={e => setDias(Number(e.target.value))}>{[7, 14, 30, 60, 90].map(x => <option key={x} value={x}>Últimos {x} días</option>)}</select></div>
        <div style={{ flex: '1 1 260px' }}><label className="fl">Plantel</label><select className="fc" value={inst} onChange={e => setInst(e.target.value)}><option value="">Todo el sistema</option>{(instituciones || []).map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}</select></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 14 }}>
        <Kpi icono="ti ti-clock-bolt" titulo="Hora pico" valor={pico ? `${String(pico.hr).padStart(2, '0')}:00` : '—'} nota={pico ? `${pico.usuarios} usuarios en promedio (máx. ${pico.maximo})` : 'sin datos'} />
        <Kpi icono="ti ti-calendar-star" titulo="Día más cargado" valor={diaPico ? new Date(diaPico.dia + 'T12:00:00').toLocaleDateString('es-EC', { weekday: 'short', day: '2-digit', month: 'short' }) : '—'} nota={diaPico ? `${diaPico.pico_usuarios} usuarios simultáneos` : ''} />
        <Kpi icono="ti ti-login" titulo="Ingresos" valor={fmt(d?.sesiones?.total)} nota={`${fmt(d?.sesiones?.usuarios)} usuarios distintos`} />
        <Kpi icono="ti ti-hourglass" titulo="Tiempo medio por ingreso" valor={formatoDuracion(d?.sesiones?.promedio_min)} />
      </div>
      <div className="card" style={{ padding: 14, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Mapa de calor: usuarios promedio por día y hora (hora de Ecuador)</div>
        {(d?.heatmap || []).length ? (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '40px repeat(24, minmax(18px, 1fr))', gap: 2, minWidth: 560 }}>
              <div />{Array.from({ length: 24 }, (_, h) => <div key={h} style={{ fontSize: 9.5, textAlign: 'center', color: 'var(--slate)' }}>{h}</div>)}
              {DIAS_SEMANA.map((dn, i) => (
                <React.Fragment key={dn}>
                  <div style={{ fontSize: 11, color: 'var(--slate)', alignSelf: 'center' }}>{dn}</div>
                  {Array.from({ length: 24 }, (_, h) => { const c = mapa.m[`${i + 1}-${h}`]; const it = intensidadCalor(c?.usuarios, mapa.max); return <div key={h} title={c ? `${dn} ${h}:00 — ${c.usuarios} usuarios (máx. ${c.maximo})` : `${dn} ${h}:00 — sin actividad`} style={{ height: 22, borderRadius: 3, background: c ? `rgba(15,157,138,${0.12 + it * 0.88})` : 'var(--page)' }} />; })}
                </React.Fragment>
              ))}
            </div>
          </div>
        ) : <Vacio>Todavía no hay datos de uso. Se acumulan desde que los usuarios entran con esta versión; el resumen por hora se calcula cada 10 minutos.</Vacio>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        <div className="card" style={{ padding: 14, margin: 0 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Usuarios simultáneos por día (pico)</div>
          {(d?.por_dia || []).length ? <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 130 }}>{d.por_dia.map(x => <div key={x.dia} title={`${x.dia}: ${x.pico_usuarios} usuarios`} style={{ flex: 1, background: '#0f9d8a', borderRadius: '3px 3px 0 0', height: `${Math.max(3, (x.pico_usuarios / maxDia) * 100)}%` }} />)}</div> : <Vacio>Sin datos.</Vacio>}
        </div>
        <div className="card" style={{ padding: 14, margin: 0 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Las 8 horas más cargadas</div>
          {(d?.picos || []).length ? <table className="data" style={{ width: '100%' }}><thead><tr><th>Hora</th><th>Usuarios</th><th>Latencia p95</th></tr></thead><tbody>{d.picos.map(p => <tr key={p.hora}><td style={{ fontSize: 12.5 }}>{p.hora}</td><td>{p.usuarios}</td><td><Ms v={p.lat_p95} /></td></tr>)}</tbody></table> : <Vacio>Sin datos.</Vacio>}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── Red y latencia ─────────────────────────
function Red({ instituciones }) {
  const [dias, setDias] = useState(3); const [inst, setInst] = useState(''); const [filas, setFilas] = useState([]); const [diag, setDiag] = useState(null); const [soloProb, setSoloProb] = useState(true); const [err, setErr] = useState('');
  useEffect(() => {
    setErr('');
    Promise.all([fetchTicLatenciaUsuarios(dias, inst || null), fetchTicTiempoReal()]).then(([a, b]) => { setFilas(a); setDiag(b.diagnostico); }).catch(e => setErr(e.message));
  }, [dias, inst]);
  const conEstado = useMemo(() => filas.map(u => ({ ...u, ...usuarioConProblema(u) })), [filas]);
  const visibles = soloProb ? conEstado.filter(u => u.problema) : conEstado;
  function exportar() {
    descargarLibro(`latencia_usuarios_${new Date().toISOString().slice(0, 10)}.xlsx`, [{ nombre: 'Latencia por usuario', cols: ['Usuario', 'Correo', 'Rol', 'Plantel', 'Mediciones', 'BD mediana (ms)', 'BD p95 (ms)', 'Servidor p95 (ms)', '% respuestas lentas', 'Fallos', 'Segundos sin internet', 'Problema'], filas: visibles.map(u => ({ Usuario: u.nombre, Correo: u.email, Rol: ROL[u.rol] || u.rol, Plantel: u.plantel || '', Mediciones: u.latidos, 'BD mediana (ms)': u.db_p50, 'BD p95 (ms)': u.db_p95, 'Servidor p95 (ms)': u.api_p95, '% respuestas lentas': u.pct_lentos, Fallos: u.fallos, 'Segundos sin internet': u.offline_seg, Problema: u.motivos.join(', ') })) }]);
  }
  return (
    <div>
      <Err e={err} />
      <Banner diag={diag} />
      <div className="card" style={{ padding: 14, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>¿Cómo distingue una caída de internet de una saturación del sistema?</div>
        <div style={{ fontSize: 12.5, color: 'var(--slate)', lineHeight: 1.6 }}>
          <strong>Internet del plantel:</strong> sus usuarios dejan de reportar (o van lentos) mientras los demás planteles funcionan normal. · <strong>Saturación por flujo:</strong> la respuesta se vuelve lenta en varios planteles a la vez, o la base de datos se acerca a su límite de conexiones. · <strong>Caída del sistema o del proveedor:</strong> varios planteles dejan de reportar al mismo tiempo. · <strong>Internet de un usuario:</strong> solo su equipo tiene latencia alta o cortes (tabla de abajo). Un usuario sin internet no puede avisar: se ve como silencio y sus cortes se informan al reconectar.
        </div>
      </div>
      <div className="card" style={{ padding: 14, marginBottom: 14, overflow: 'hidden' }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Planteles activos ahora</div>
        <TablaPlanteles planteles={diag?.planteles} />
      </div>
      <div className="card" style={{ padding: 12, marginBottom: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
        <div><label className="fl">Período</label><select className="fc" value={dias} onChange={e => setDias(Number(e.target.value))}>{[1, 3, 7].map(x => <option key={x} value={x}>{x === 1 ? 'Último día' : `Últimos ${x} días`}</option>)}</select></div>
        <div style={{ flex: '1 1 240px' }}><label className="fl">Plantel</label><select className="fc" value={inst} onChange={e => setInst(e.target.value)}><option value="">Todos</option>{(instituciones || []).map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}</select></div>
        <label style={{ fontSize: 12.5, display: 'flex', gap: 6, alignItems: 'center', paddingBottom: 8 }}><input type="checkbox" checked={soloProb} onChange={e => setSoloProb(e.target.checked)} /> Solo con problemas</label>
        <button className="btn btn-secondary" onClick={exportar} disabled={!visibles.length}>⬇️ Excel</button>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {!visibles.length ? <Vacio>{soloProb ? '✓ Ningún usuario con problemas de conexión en este período (o aún hay pocas mediciones: se necesitan al menos 3 por usuario).' : 'Sin mediciones todavía.'}</Vacio> : (
          <div style={{ overflowX: 'auto', maxHeight: 520, overflowY: 'auto' }}>
            <table className="data" style={{ width: '100%' }}>
              <thead><tr><th>Usuario</th><th>Plantel</th><th>BD mediana</th><th>BD p95</th><th>Servidor p95</th><th>% lentas</th><th>Fallos</th><th>Sin internet</th><th>Problema</th></tr></thead>
              <tbody>{visibles.map(u => <tr key={u.user_id}><td style={{ fontSize: 12.5 }}><strong>{u.nombre || '—'}</strong><div style={{ fontSize: 11, color: 'var(--slate)' }}>{ROL[u.rol] || u.rol} · {u.email}</div></td><td style={{ fontSize: 12 }}>{u.plantel || '—'}</td><td><Ms v={u.db_p50} /></td><td><Ms v={u.db_p95} /></td><td><Ms v={u.api_p95} /></td><td>{u.pct_lentos}%</td><td>{u.fallos}</td><td>{u.offline_seg ? formatoDuracion(u.offline_seg / 60) : '—'}</td><td style={{ fontSize: 12, color: u.problema ? 'var(--red)' : 'var(--green)' }}>{u.problema ? u.motivos.join(', ') : 'Sin problema'}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ───────────────────────── Página ─────────────────────────
export default function SoporteTIC() {
  const { profile, instituciones } = useSession();
  const [tab, setTab] = useState('tiempo');
  const esSuper = profile?.rolDb === 'super_admin';
  const insts = useMemo(() => [...(instituciones || [])].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es')), [instituciones]);
  if (!esSuper) return <div><h2>Soporte TIC</h2><div className="card"><p className="muted">Esta pantalla es solo para el Super Administrador.</p></div></div>;
  const TABS = [['tiempo', 'Tiempo real', 'ti ti-activity'], ['accesos', 'Accesos', 'ti ti-login'], ['seguridad', 'Seguridad', 'ti ti-shield-lock'], ['uso', 'Uso y hora pico', 'ti ti-chart-bar'], ['red', 'Red y latencia', 'ti ti-wifi']];
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ margin: '0 0 4px' }}>Soporte TIC</h2>
        <div style={{ fontSize: 13, color: 'var(--slate)' }}>Accesos, seguridad, uso del sistema y calidad de conexión de todos los planteles</div>
      </div>
      <div className="tabs">{TABS.map(([id, l, ic]) => <button key={id} className={'tab' + (tab === id ? ' on' : '')} onClick={() => setTab(id)}><span className={ic} style={{ marginRight: 6 }} />{l}</button>)}</div>
      {tab === 'tiempo' && <TiempoReal />}
      {tab === 'accesos' && <Accesos instituciones={insts} />}
      {tab === 'seguridad' && <Seguridad />}
      {tab === 'uso' && <Uso instituciones={insts} />}
      {tab === 'red' && <Red instituciones={insts} />}
    </div>
  );
}
