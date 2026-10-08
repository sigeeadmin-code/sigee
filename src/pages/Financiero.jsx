import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useSession } from '../lib/SessionContext.jsx';
import { fetchFinancieroDatos, fetchLibroCobros, guardarTramosTarifa, guardarConfigLicencias, aplicarTarifasLicencias, revisarPagoLicencia } from '../lib/data.js';
import { exportarFilasExcel } from '../lib/cargaMasiva.js';
import { MESES, validarTramos, totalMarginal, totalPlano, planTarifas, construirEstadoCuenta, indicadoresMes, filasEstadoCuenta, filasLibro } from '../lib/financieroBase.js';

const COLOR = { pagado: '#16a34a', en_revision: '#d97706', rechazado: '#dc2626', mora: '#dc2626', por_vencer: '#0891b2', futuro: '#cbd5e1' };
const ETIQUETA_MES = { pagado: 'Pagado', en_revision: 'En revisión', rechazado: 'Rechazado', mora: 'En mora', por_vencer: 'Por vencer', futuro: 'Futuro' };
const ETIQUETA_PLANTEL = { al_dia: 'Al día', mora: 'En mora', en_revision: 'Pago en revisión' };
const COLOR_PLANTEL = { al_dia: '#16a34a', mora: '#dc2626', en_revision: '#d97706' };
const usd = v => `$${(Number(v) || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Kpi({ titulo, valor, sub, color }) {
  return (
    <div className="card" style={{ margin: 0, padding: '12px 16px', borderTop: `3px solid ${color || 'var(--line, #e2e8f0)'}`, minWidth: 170, flex: '1 1 170px' }}>
      <div style={{ fontSize: 11, color: 'var(--slate)', fontWeight: 700, textTransform: 'uppercase' }}>{titulo}</div>
      <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.2 }}>{valor}</div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--slate)' }}>{sub}</div>}
    </div>
  );
}
const Insignia = ({ texto, color }) => <span style={{ background: color + '22', color, borderRadius: 999, padding: '2px 10px', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}>{texto}</span>;

export default function Financiero() {
  const { profile } = useSession();
  const hoy = useMemo(() => new Date(), []);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [pestana, setPestana] = useState('resumen');
  const [datos, setDatos] = useState(null);
  const [libro, setLibro] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true); setError('');
    try { setDatos(await fetchFinancieroDatos(anio)); setLibro(null); }
    catch (e) { setError(e.message || 'No se pudo cargar el financiero.'); }
    setCargando(false);
  }, [anio]);
  useEffect(() => { if (profile.rolDb === 'super_admin') cargar(); }, [cargar, profile.rolDb]);

  if (profile.rolDb !== 'super_admin') {
    return <div className="empty" style={{ padding: '60px 20px' }}><span className="ti ti-lock" style={{ fontSize: 32 }} /><h3>El financiero de SIGEE es solo para el Super Admin</h3></div>;
  }

  const diaVenc = datos?.config?.dia_vencimiento || 10;
  const costo = datos?.config?.costo_infraestructura_mensual || 0;
  const ec = datos ? construirEstadoCuenta({ licencias: datos.licencias, pagos: datos.pagos, anio, hoy, diaVenc }) : null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0 }}><span className="ti ti-cash" /> Financiero</h2>
          <p style={{ color: 'var(--slate)', margin: '4px 0 0', fontSize: 13 }}>Cobro a los planteles por paralelo activado · estado de cuenta, cobranza y control de pendientes</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="fc" value={anio} onChange={e => setAnio(Number(e.target.value))}>
            {[hoy.getFullYear() + 1, hoy.getFullYear(), hoy.getFullYear() - 1].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button className="btn btn-secondary" onClick={cargar} disabled={cargando}>↻ Actualizar</button>
          <Link className="btn btn-primary" to="/licencias">Revisar comprobantes</Link>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {[['resumen', 'Resumen'], ['planteles', 'Planteles'], ['libro', 'Libro de cobros'], ['tarifas', 'Tarifas y parámetros']].map(([k, t]) => (
          <button key={k} className={'btn btn-sm ' + (pestana === k ? 'btn-primary' : 'btn-secondary')} onClick={() => setPestana(k)}>{t}</button>
        ))}
      </div>

      {error && <div className="lerr" style={{ display: 'flex', marginBottom: 12 }}>{error}</div>}
      {cargando && !datos && <div className="card cb">Cargando…</div>}

      {datos && ec && pestana === 'resumen' && <Resumen ec={ec} anio={anio} mes={mes} setMes={setMes} costo={costo} />}
      {datos && ec && pestana === 'planteles' && <Planteles ec={ec} anio={anio} />}
      {datos && pestana === 'libro' && <Libro anio={anio} libro={libro} setLibro={setLibro} profile={profile} onCambio={cargar} />}
      {datos && pestana === 'tarifas' && <Tarifas datos={datos} onCambio={cargar} />}
    </div>
  );
}

/* ───────── Resumen ───────── */
function Resumen({ ec, anio, mes, setMes, costo }) {
  const ind = indicadoresMes(ec, mes, costo);
  const t = ec.totales;
  const datosGrafico = ec.serie.map((m, i) => ({
    mes: MESES[i], Cobrado: m.pagado, 'En revisión': m.en_revision, 'Por cobrar': m.mora + m.rechazado, 'Por vencer / futuro': m.por_vencer + m.futuro
  }));
  const morosos = ec.planteles.filter(p => p.porCobrar > 0).slice(0, 6);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <strong style={{ fontSize: 13 }}>Mes:</strong>
        <select className="fc" style={{ maxWidth: 120 }} value={mes} onChange={e => setMes(Number(e.target.value))}>
          {MESES.map((m, i) => <option key={m} value={i + 1}>{m} {anio}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <Kpi titulo="Cobrado del mes" valor={usd(ind.cobrado)} sub={`de ${usd(ind.esperado)} esperados`} color={COLOR.pagado} />
        <Kpi titulo="En revisión" valor={usd(ind.enRevision)} sub="comprobantes por aprobar" color={COLOR.en_revision} />
        <Kpi titulo="Por cobrar" valor={usd(ind.porCobrar)} sub="mora y rechazados" color={COLOR.mora} />
        <Kpi titulo="Paralelos activos" valor={`${ind.paralelosActivos} / ${ind.paralelosFacturables}`} sub="pagados / facturables" color="#0891b2" />
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <Kpi titulo={`Cobrado en ${anio}`} valor={usd(t.cobrado)} sub={t.cobranza === null ? 'sin cobros exigibles' : `${t.cobranza}% de cobranza`} color={COLOR.pagado} />
        <Kpi titulo="Planteles" valor={`${t.alDia} al día`} sub={`${t.enMora} en mora · ${t.enRevisionN} con pago en revisión`} color={t.enMora ? COLOR.mora : COLOR.pagado} />
        <Kpi titulo="Margen del mes" valor={usd(ind.margen)} sub={`cobrado − ${usd(ind.costo)} de costo de operación`} color={ind.margen >= 0 ? COLOR.pagado : COLOR.mora} />
        <Kpi titulo="Punto de equilibrio" valor={ind.paralelosEquilibrio ? `${ind.paralelosEquilibrio} paralelos` : '—'} sub="para cubrir el costo de operación" color="#6366f1" />
      </div>

      <div className="card">
        <div className="ch"><h3>Cobrado vs esperado por mes · {anio}</h3></div>
        <div className="cb" style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={datosGrafico}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mes" /><YAxis tickFormatter={v => `$${v}`} width={60} />
              <Tooltip formatter={v => usd(v)} /><Legend />
              <Bar dataKey="Cobrado" stackId="a" fill={COLOR.pagado} />
              <Bar dataKey="En revisión" stackId="a" fill={COLOR.en_revision} />
              <Bar dataKey="Por cobrar" stackId="a" fill={COLOR.mora} />
              <Bar dataKey="Por vencer / futuro" stackId="a" fill={COLOR.futuro} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="ch"><h3>Planteles con saldo pendiente</h3></div>
        <div className="cb">
          {morosos.length === 0 ? <p style={{ fontSize: 13, color: 'var(--slate)', margin: 0 }}>Ningún plantel tiene meses vencidos sin pagar. ✅</p> : (
            <table className="tbl" style={{ width: '100%' }}>
              <thead><tr><th>Plantel</th><th>Paralelos</th><th>Por cobrar</th><th>Cobranza</th></tr></thead>
              <tbody>{morosos.map(p => <tr key={p.institucion_id}><td>{p.nombre}</td><td>{p.paralelos}</td><td style={{ color: COLOR.mora, fontWeight: 700 }}>{usd(p.porCobrar)}</td><td>{p.cobranza === null ? '—' : `${p.cobranza}%`}</td></tr>)}</tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────── Planteles (estado de cuenta) ───────── */
function Planteles({ ec, anio }) {
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState('');
  const [abierto, setAbierto] = useState(null);
  const lista = ec.planteles.filter(p => (!estado || p.estado === estado) && (!texto || p.nombre.toLowerCase().includes(texto.toLowerCase())));
  return (
    <div className="card">
      <div className="cb">
        <div className="search-bar" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <input className="fc" style={{ maxWidth: 300 }} placeholder="Buscar plantel…" value={texto} onChange={e => setTexto(e.target.value)} />
          <select className="fc" value={estado} onChange={e => setEstado(e.target.value)}>
            <option value="">Todos los estados</option><option value="mora">En mora</option><option value="en_revision">Pago en revisión</option><option value="al_dia">Al día</option>
          </select>
          <button className="btn btn-secondary" disabled={!lista.length} onClick={() => exportarFilasExcel(`estado_de_cuenta_${anio}.xlsx`, filasEstadoCuenta({ ...ec, planteles: lista }, anio))}>⬇️ Exportar Excel</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl" style={{ width: '100%' }}>
            <thead><tr><th>Plantel</th><th>Paralelos</th><th>Mensual</th><th>Cobrado</th><th>En revisión</th><th>Por cobrar</th><th>Cobranza</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {lista.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--slate)' }}>{ec.planteles.length ? 'Sin resultados.' : `Aún no hay paralelos con licencia en ${anio}.`}</td></tr>}
              {lista.map(p => (
                <React.Fragment key={p.institucion_id}>
                  <tr>
                    <td><strong>{p.nombre}</strong></td><td>{p.paralelos}</td><td>{usd(p.tarifaMensual)}</td>
                    <td style={{ color: COLOR.pagado }}>{usd(p.cobrado)}</td><td style={{ color: COLOR.en_revision }}>{usd(p.enRevision)}</td>
                    <td style={{ color: p.porCobrar ? COLOR.mora : undefined, fontWeight: p.porCobrar ? 700 : 400 }}>{usd(p.porCobrar)}</td>
                    <td>{p.cobranza === null ? '—' : `${p.cobranza}%`}</td>
                    <td><Insignia texto={ETIQUETA_PLANTEL[p.estado]} color={COLOR_PLANTEL[p.estado]} /></td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => setAbierto(abierto === p.institucion_id ? null : p.institucion_id)}>{abierto === p.institucion_id ? '▲' : '▼'}</button></td>
                  </tr>
                  {abierto === p.institucion_id && (
                    <tr><td colSpan={9} style={{ background: 'rgba(148,163,184,.08)' }}>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ borderCollapse: 'separate', borderSpacing: 3, fontSize: 12 }}>
                          <thead><tr><th style={{ textAlign: 'left', paddingRight: 10 }}>Paralelo</th>{MESES.map(m => <th key={m} style={{ minWidth: 44 }}>{m}</th>)}</tr></thead>
                          <tbody>{p.licencias.map(({ lic, celdas }) => (
                            <tr key={lic.id}>
                              <td style={{ paddingRight: 10, whiteSpace: 'nowrap' }}>{lic.grado_nombre} {lic.paralelo_nombre} <span style={{ color: 'var(--slate)' }}>· {usd(lic.tarifa_mensual)}</span></td>
                              {celdas.map(c => (
                                <td key={c.mes} title={c.estado ? `${ETIQUETA_MES[c.estado]} · ${usd(c.monto)}${c.pago?.comprobante_num ? ' · comp. ' + c.pago.comprobante_num : ''}` : 'No facturado'}
                                  style={{ textAlign: 'center', borderRadius: 5, padding: '4px 0', background: c.estado ? COLOR[c.estado] + (c.estado === 'futuro' ? '' : '33') : 'transparent', color: c.estado ? (c.estado === 'futuro' ? '#64748b' : COLOR[c.estado]) : '#cbd5e1', fontWeight: 700 }}>
                                  {c.estado ? { pagado: '✓', en_revision: '⏳', rechazado: '✕', mora: '!', por_vencer: '•', futuro: '·' }[c.estado] : '–'}
                                </td>
                              ))}
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--slate)', marginTop: 6 }}>✓ pagado · ⏳ en revisión · ✕ rechazado · ! en mora · • por vencer · · futuro</div>
                    </td></tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ───────── Libro de cobros (contable) ───────── */
function Libro({ anio, libro, setLibro, profile, onCambio }) {
  const [error, setError] = useState('');
  const [revisando, setRevisando] = useState(null);   // id del pago que se está procesando
  const [rechazando, setRechazando] = useState(null); // pago que se va a rechazar
  const [nota, setNota] = useState('');
  const [aviso, setAviso] = useState('');
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState('');
  const [mes, setMes] = useState('');
  useEffect(() => {
    if (libro) return;
    let vivo = true;
    fetchLibroCobros(anio).then(l => { if (vivo) setLibro(l); }).catch(e => { if (vivo) setError(e.message || 'No se pudo cargar el libro.'); });
    return () => { vivo = false; };
  }, [anio, libro, setLibro]);
  if (error) return <div className="lerr" style={{ display: 'flex' }}>{error}</div>;
  if (!libro) return <div className="card cb">Cargando…</div>;

  // aprobar o rechazar un comprobante pendiente (el mes solo cuenta como activo cuando queda aprobado)
  async function revisar(pago, aprobado, notas) {
    setRevisando(pago.id); setAviso('');
    try {
      await revisarPagoLicencia(pago.id, aprobado, profile.id, notas);
      setAviso(aprobado ? 'Pago aprobado: el paralelo queda activo ese mes.' : 'Pago rechazado.');
      setRechazando(null); setNota('');
      await onCambio();
    } catch (e) { setAviso('No se pudo procesar: ' + (e.message || e)); }
    setRevisando(null);
  }
  const t = texto.toLowerCase();
  const lista = libro.filter(p => (!estado || p.estado === estado) && (!mes || p.mes === Number(mes))
    && (!t || (p.licencias_paralelo?.institucion?.nombre || '').toLowerCase().includes(t) || (p.comprobante_num || '').toLowerCase().includes(t)))
    .sort((a, b) => String(b.fecha_reporte).localeCompare(String(a.fecha_reporte)));
  const suma = e => lista.filter(p => p.estado === e).reduce((s, p) => s + Number(p.monto || 0), 0);
  return (
    <div className="card">
      <div className="cb">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <input className="fc" style={{ maxWidth: 280 }} placeholder="Buscar por plantel o comprobante…" value={texto} onChange={e => setTexto(e.target.value)} />
          <select className="fc" value={estado} onChange={e => setEstado(e.target.value)}>
            <option value="">Todos los estados</option><option value="aprobado">Aprobado</option><option value="pendiente_revision">Pendiente de revisión</option><option value="rechazado">Rechazado</option>
          </select>
          <select className="fc" value={mes} onChange={e => setMes(e.target.value)}>
            <option value="">Todos los meses</option>{MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <button className="btn btn-secondary" disabled={!lista.length} onClick={() => exportarFilasExcel(`libro_de_cobros_${anio}.xlsx`, filasLibro(lista))}>⬇️ Exportar Excel</button>
        </div>
        {aviso && <div className="card" style={{ margin: '0 0 10px', padding: '8px 12px', fontSize: 13 }}>{aviso}</div>}
        <div style={{ display: 'flex', gap: 16, fontSize: 13, marginBottom: 10, flexWrap: 'wrap' }}>
          <span>Aprobado: <strong style={{ color: COLOR.pagado }}>{usd(suma('aprobado'))}</strong></span>
          <span>En revisión: <strong style={{ color: COLOR.en_revision }}>{usd(suma('pendiente_revision'))}</strong></span>
          <span>Rechazado: <strong style={{ color: COLOR.mora }}>{usd(suma('rechazado'))}</strong></span>
          <span style={{ color: 'var(--slate)' }}>{lista.length} movimientos</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl" style={{ width: '100%' }}>
            <thead><tr><th>Reportado</th><th>Plantel</th><th>Paralelo</th><th>Período</th><th>Monto</th><th>Comprobante</th><th>Estado</th><th>Revisado</th><th /></tr></thead>
            <tbody>
              {lista.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--slate)' }}>Sin movimientos.</td></tr>}
              {lista.map(p => (
                <tr key={p.id}>
                  <td>{String(p.fecha_reporte || '').slice(0, 10)}</td>
                  <td>{p.licencias_paralelo?.institucion?.nombre || '—'}</td>
                  <td>{p.licencias_paralelo?.grado?.nombre} {p.licencias_paralelo?.paralelo?.nombre}</td>
                  <td>{MESES[p.mes - 1]} {p.anio}</td><td>{usd(p.monto)}</td><td className="mono">{p.comprobante_num || '—'}</td>
                  <td><Insignia texto={{ aprobado: 'Aprobado', pendiente_revision: 'En revisión', rechazado: 'Rechazado' }[p.estado] || p.estado} color={{ aprobado: COLOR.pagado, pendiente_revision: COLOR.en_revision, rechazado: COLOR.mora }[p.estado] || '#64748b'} /></td>
                  <td>{String(p.fecha_revision || '').slice(0, 10) || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {p.estado === 'pendiente_revision' && (
                      <>
                        <button className="btn btn-primary btn-sm" disabled={revisando === p.id} onClick={() => revisar(p, true)}>Aprobar</button>{' '}
                        <button className="btn btn-secondary btn-sm" disabled={revisando === p.id} onClick={() => { setRechazando(p); setNota(''); }}>Rechazar</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {rechazando && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setRechazando(null); }}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="ch"><h3>Rechazar comprobante</h3></div>
            <div className="cb">
              <p style={{ fontSize: 13, marginTop: 0 }}>{rechazando.licencias_paralelo?.institucion?.nombre} · {MESES[rechazando.mes - 1]} {rechazando.anio} · {usd(rechazando.monto)} · comprobante {rechazando.comprobante_num || '—'}</p>
              <label className="fl">Motivo (lo verá el plantel)</label>
              <textarea className="fc" rows={3} value={nota} onChange={e => setNota(e.target.value)} placeholder="Ej.: el comprobante no coincide con el monto" />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button className="btn btn-secondary" onClick={() => setRechazando(null)}>Cancelar</button>
                <button className="btn btn-primary" disabled={revisando === rechazando.id} onClick={() => revisar(rechazando, false, nota.trim() || null)}>Rechazar pago</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────── Tarifas y parámetros ───────── */
function Tarifas({ datos, onCambio }) {
  const [tramos, setTramos] = useState(() => datos.tramos.map(t => ({ ...t })));
  const [cfg, setCfg] = useState({ costo: datos.config.costo_infraestructura_mensual ?? 50, venc: datos.config.dia_vencimiento ?? 10 });
  const [msg, setMsg] = useState('');
  const [confirma, setConfirma] = useState(false);
  const [trabajando, setTrabajando] = useState(false);

  const normales = tramos.map(t => ({ ...t, desde: Number(t.desde), hasta: t.hasta === '' || t.hasta == null ? null : Number(t.hasta), tarifa: Number(t.tarifa) }));
  const errorTramos = validarTramos(normales);
  const guardados = JSON.stringify(datos.tramos.map(t => [t.desde, t.hasta, Number(t.tarifa)])) === JSON.stringify([...normales].sort((a, b) => a.desde - b.desde).map(t => [t.desde, t.hasta, t.tarifa]));

  const plan = useMemo(() => (errorTramos ? [] : planTarifas(datos.licencias, normales)), [datos.licencias, errorTramos, tramos]); // eslint-disable-line react-hooks/exhaustive-deps
  const porPlantel = useMemo(() => {
    const m = new Map();
    plan.forEach(p => {
      if (!m.has(p.institucion_id)) m.set(p.institucion_id, { nombre: p.institucion_nombre, n: 0, actual: 0 });
      const x = m.get(p.institucion_id); x.n += 1; x.actual += p.actual;
    });
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [plan]);
  const cambios = plan.filter(p => Number(p.actual) !== Number(p.propuesta)).length;

  const setT = (i, k, v) => { setTramos(ts => ts.map((t, j) => (j === i ? { ...t, [k]: v } : t))); setMsg(''); };

  async function guardarTramos() {
    setTrabajando(true); setMsg('');
    try { await guardarTramosTarifa(normales, datos.tramos); setMsg('Tramos guardados.'); await onCambio(); }
    catch (e) { setMsg('No se pudo guardar: ' + (e.message || e)); }
    setTrabajando(false);
  }
  async function guardarParametros() {
    setTrabajando(true); setMsg('');
    try { await guardarConfigLicencias({ costo_infraestructura_mensual: cfg.costo, dia_vencimiento: cfg.venc }); setMsg('Parámetros guardados.'); await onCambio(); }
    catch (e) { setMsg('No se pudo guardar: ' + (e.message || e)); }
    setTrabajando(false);
  }
  async function aplicar() {
    setConfirma(false); setTrabajando(true); setMsg('');
    try { const n = await aplicarTarifasLicencias(plan); setMsg(`Tarifa por tramos aplicada a ${n} paralelo${n === 1 ? '' : 's'}.`); await onCambio(); }
    catch (e) { setMsg('No se pudo aplicar: ' + (e.message || e)); }
    setTrabajando(false);
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {msg && <div className="card" style={{ margin: 0, padding: '10px 14px', fontSize: 13 }}>{msg}</div>}

      <div className="card">
        <div className="ch"><h3>Tarifa por paralelo, por tramos</h3></div>
        <div className="cb">
          <p style={{ fontSize: 13, marginTop: 0 }}>Cada paralelo paga la tarifa del tramo en el que cae dentro de su plantel (tarifa marginal): con los tramos de abajo, los 10 primeros pagan $5 y el 11.º ya paga $4, sin que un plantel más grande llegue a pagar menos en total.</p>
          <table className="tbl" style={{ width: '100%', maxWidth: 520 }}>
            <thead><tr><th>Desde (paralelo n.º)</th><th>Hasta</th><th>Tarifa mensual (USD)</th><th /></tr></thead>
            <tbody>
              {tramos.map((t, i) => (
                <tr key={t.id || 'n' + i}>
                  <td><input className="fc" type="number" min="1" value={t.desde} onChange={e => setT(i, 'desde', e.target.value)} /></td>
                  <td><input className="fc" type="number" min="1" value={t.hasta ?? ''} placeholder="sin tope" onChange={e => setT(i, 'hasta', e.target.value)} /></td>
                  <td><input className="fc" type="number" min="0" step="0.01" value={t.tarifa} onChange={e => setT(i, 'tarifa', e.target.value)} /></td>
                  <td>{tramos.length > 1 && <button className="btn btn-ghost btn-sm" onClick={() => setTramos(ts => ts.filter((_, j) => j !== i))}>✕</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {errorTramos && <div className="lerr" style={{ display: 'flex', marginTop: 8 }}>{errorTramos}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setTramos(ts => { const u = ts[ts.length - 1]; return [...ts.map((t, j) => (j === ts.length - 1 ? { ...t, hasta: Number(t.desde) + 9 } : t)), { desde: Number(u.desde) + 10, hasta: '', tarifa: u.tarifa }]; })}>+ Agregar tramo</button>
            <button className="btn btn-primary btn-sm" disabled={!!errorTramos || guardados || trabajando} onClick={guardarTramos}>{guardados ? 'Tramos guardados' : 'Guardar tramos'}</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="ch"><h3>Qué pasaría con cada plantel</h3></div>
        <div className="cb">
          {errorTramos ? <p style={{ fontSize: 13, color: 'var(--slate)', margin: 0 }}>Corrige los tramos para ver la comparación.</p> : porPlantel.length === 0 ? <p style={{ fontSize: 13, color: 'var(--slate)', margin: 0 }}>Todavía no hay paralelos con licencia.</p> : (
            <>
              <table className="tbl" style={{ width: '100%' }}>
                <thead><tr><th>Plantel</th><th>Paralelos</th><th>Hoy cobras</th><th>Por tramos (marginal)</th><th>Tarifa plana del tramo</th></tr></thead>
                <tbody>{porPlantel.map(p => {
                  const marg = totalMarginal(normales, p.n), plano = totalPlano(normales, p.n);
                  return <tr key={p.nombre}><td>{p.nombre}</td><td>{p.n}</td><td>{usd(p.actual)}</td><td><strong>{usd(marg)}</strong></td><td style={{ color: plano < marg ? COLOR.mora : 'var(--slate)' }}>{usd(plano)}{plano < marg ? ' ⚠' : ''}</td></tr>;
                })}</tbody>
              </table>
              <p style={{ fontSize: 12, color: 'var(--slate)' }}>⚠ La tarifa plana (todo el plantel a la tarifa de su tramo) haría pagar menos a un plantel de 11 paralelos que a uno de 10; por eso se usa la marginal.</p>
              <button className="btn btn-primary" disabled={!cambios || trabajando} onClick={() => setConfirma(true)}>{cambios ? `Aplicar tarifa por tramos a ${cambios} paralelo${cambios === 1 ? '' : 's'}` : 'Las tarifas ya coinciden con los tramos'}</button>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <div className="ch"><h3>Parámetros</h3></div>
        <div className="cb" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div><label className="fl">Costo mensual de operar SIGEE (USD)</label><input className="fc" type="number" min="0" step="0.01" value={cfg.costo} onChange={e => setCfg(c => ({ ...c, costo: e.target.value }))} /></div>
          <div><label className="fl">Día del mes en que vence el pago</label><input className="fc" type="number" min="1" max="28" value={cfg.venc} onChange={e => setCfg(c => ({ ...c, venc: e.target.value }))} /></div>
          <button className="btn btn-primary" disabled={trabajando} onClick={guardarParametros}>Guardar parámetros</button>
        </div>
      </div>

      {confirma && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setConfirma(false); }}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="ch"><h3>Aplicar tarifa por tramos</h3></div>
            <div className="cb">
              <p style={{ fontSize: 13 }}>Se cambiará la tarifa mensual de <strong>{cambios}</strong> paralelo{cambios === 1 ? '' : 's'}. Lo que ya está pagado o en revisión <strong>conserva su monto</strong>; el cambio afecta a los meses que aún no tienen pago.</p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button className="btn btn-secondary" onClick={() => setConfirma(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={aplicar}>Aplicar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
