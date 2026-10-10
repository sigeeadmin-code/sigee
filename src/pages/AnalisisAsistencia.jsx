import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { fetchAnalisisAsistencia, registrarOficiosEmitidos } from '../lib/data.js';
import FichaAsistenciaModal from '../components/FichaAsistenciaModal.jsx';
import OficioFaltasModal from '../components/OficioFaltasModal.jsx';
import { descargarLibro, descargarCsv } from '../lib/exportLibro.js';
import {
  UMBRALES_DEFECTO, ETIQUETA_CLASE, RACHA_ALERTA, rangoPeriodo, analizarEstudiantes, diasHabiles, coberturaPorCurso,
  resumenPorCurso, totalesGenerales, umbralesValidos, diaSemana, ymd
} from '../lib/asistenciaAnalisis.js';
import { candidatosOficio, fechaCorta } from '../lib/oficioFaltas.js';

const COLOR = { excelente: ['#dcfce7', '#15803d'], buena: ['#dbeafe', '#1d4ed8'], en_riesgo: ['#fef3c7', '#b45309'], critica: ['#fee2e2', '#b91c1c'], sin_datos: ['#e2e8f0', '#475569'] };
const CLAVE_UMBRALES = 'sigee_umbrales_asistencia';
const PERIODOS = [['todo', 'Todo'], ['semana', 'Semana'], ['mes', 'Mes'], ['mes_anterior', 'Mes anterior'], ['custom', 'Personalizado']];

const Chip = ({ clase }) => <span style={{ background: COLOR[clase][0], color: COLOR[clase][1], borderRadius: 999, padding: '2px 10px', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}>{ETIQUETA_CLASE[clase]}</span>;
const Tarjeta = ({ valor, etiqueta, sub, color }) => (
  <div className="card" style={{ margin: 0, padding: '12px 16px', minWidth: 150, flex: '1 1 150px', borderTop: `3px solid ${color || 'var(--brand, #0891b2)'}` }}>
    <div style={{ fontSize: 26, fontWeight: 800, color }}>{valor}</div>
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate)' }}>{etiqueta}</div>
    {sub && <div style={{ fontSize: 11.5, color: 'var(--slate)' }}>{sub}</div>}
  </div>
);
const pct = v => (v === null || v === undefined ? '—' : `${String(v).replace('.', ',')}%`);

export default function AnalisisAsistencia() {
  const { institucion, profile } = useSession();
  const institucionId = institucion?.id;
  const [periodo, setPeriodo] = useState('mes');
  const [custom, setCustom] = useState({ desde: '', hasta: '' });
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [curso, setCurso] = useState('');
  const [clase, setClase] = useState('');
  const [soloFaltas, setSoloFaltas] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [umbrales, setUmbrales] = useState(() => {
    try { const u = JSON.parse(localStorage.getItem(CLAVE_UMBRALES) || 'null'); if (umbralesValidos(u)) return u; } catch { /* sin almacenamiento */ }
    return UMBRALES_DEFECTO;
  });
  const [editU, setEditU] = useState(false);
  const [oficio, setOficio] = useState(null);
  const [fichaDe, setFichaDe] = useState(null);

  const { desde, hasta } = useMemo(() => (periodo === 'custom' ? custom : rangoPeriodo(periodo)), [periodo, custom]);
  const rangoOk = !!desde && !!hasta && desde <= hasta;

  const cargar = useCallback(async () => {
    if (!institucionId || !rangoOk) return;
    setCargando(true); setError('');
    try { setDatos(await fetchAnalisisAsistencia(institucionId, desde, hasta)); }
    catch (e) { setError(e.message || 'No se pudo cargar la asistencia.'); setDatos(null); }
    setCargando(false);
  }, [institucionId, desde, hasta, rangoOk]);
  useEffect(() => { cargar(); }, [cargar]);

  const filas = useMemo(() => (datos ? analizarEstudiantes(datos.alumnos, datos.registros, umbrales) : []), [datos, umbrales]);
  const cursos = useMemo(() => [...new Set(filas.map(f => f.curso))].filter(Boolean).sort(), [filas]);
  const visibles = useMemo(() => filas.filter(f =>
    (!curso || f.curso === curso) && (!clase || f.clase === clase) && (!soloFaltas || f.faltas > 0) &&
    (!busqueda || `${f.nombre} ${f.cedula}`.toLowerCase().includes(busqueda.toLowerCase()))), [filas, curso, clase, soloFaltas, busqueda]);

  // cobertura: 'Todo' se mide desde el primer día con asistencia (no desde hace un año)
  const habiles = useMemo(() => {
    if (!datos || !rangoOk) return [];
    const hoy = ymd(new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 12)));
    const ini = periodo === 'todo' ? (datos.registros.map(r => r.fecha).sort()[0] || desde) : desde;
    return diasHabiles(ini, hasta < hoy ? hasta : hoy, datos.eventos);
  }, [datos, periodo, desde, hasta, rangoOk]);
  const cobertura = useMemo(() => (datos ? coberturaPorCurso(datos.alumnos.filter(a => !curso || a.curso === curso), datos.registros, habiles) : []), [datos, habiles, curso]);
  const porCurso = useMemo(() => resumenPorCurso(filas.filter(f => !curso || f.curso === curso)), [filas, curso]);
  const totales = useMemo(() => totalesGenerales(filas.filter(f => !curso || f.curso === curso), cobertura), [filas, curso, cobertura]);
  const conRacha = useMemo(() => visibles.filter(f => f.rachaMax >= RACHA_ALERTA).sort((a, b) => b.rachaMax - a.rachaMax), [visibles]);
  const conOficio = useMemo(() => candidatosOficio(visibles, 1), [visibles]);

  function guardarUmbrales(u) {
    if (!umbralesValidos(u)) return false;
    setUmbrales(u);
    try { localStorage.setItem(CLAVE_UMBRALES, JSON.stringify(u)); } catch { /* sin almacenamiento */ }
    return true;
  }

  // ── exportar ──
  const nombreBase = `asistencia_${desde}_a_${hasta}`;
  const filasEstudiante = () => visibles.map(f => ({
    Estudiante: f.nombre, Cédula: f.cedula, Curso: f.curso, 'Días con registro': f.dias, Presentes: f.presentes, Atrasos: f.atrasos,
    'Faltas injustificadas': f.faltas, Justificadas: f.justificadas, '% asistencia': f.pctAsistencia ?? '', '% faltas injustificadas': f.pctFaltas ?? '',
    'Faltas consecutivas (máx.)': f.rachaMax, 'Clasificación': ETIQUETA_CLASE[f.clase],
    Representante: f.representante ? `${f.representante.nombres} ${f.representante.apellidos}`.trim() : '', 'Teléfono representante': f.representante?.telefono || ''
  }));
  function exportarExcel() {
    descargarLibro(`${nombreBase}.xlsx`, [
      { nombre: 'Resumen', filas: [
        { Indicador: 'Período', Valor: `${fechaCorta(desde)} al ${fechaCorta(hasta)}` },
        { Indicador: 'Estudiantes', Valor: totales.estudiantes }, { Indicador: '% de asistencia', Valor: totales.pctAsistencia ?? '' },
        { Indicador: 'Estudiantes en riesgo', Valor: totales.enRiesgo }, { Indicador: 'Estudiantes en situación crítica', Valor: totales.criticos },
        { Indicador: `Con ${RACHA_ALERTA}+ faltas consecutivas`, Valor: totales.conRacha }, { Indicador: 'Cobertura de registro (%)', Valor: totales.pctCobertura ?? '' },
        { Indicador: 'Umbrales (% faltas injustificadas)', Valor: `Excelente ≤ ${umbrales.excelente} · Buena ≤ ${umbrales.buena} · En riesgo ≤ ${umbrales.riesgo} · Crítica > ${umbrales.riesgo}` }
      ] },
      { nombre: 'Por estudiante', filas: filasEstudiante() },
      { nombre: 'Por curso', filas: porCurso.map(c => ({ Curso: c.curso, Estudiantes: c.estudiantes, '% asistencia': c.pctAsistencia ?? '', 'Faltas injustificadas': c.faltas, Justificadas: c.justificadas, 'En riesgo': c.enRiesgo, Críticos: c.criticos, [`Con ${RACHA_ALERTA}+ faltas seguidas`]: c.conRacha })) },
      { nombre: 'Faltas por fecha', filas: visibles.flatMap(f => f.fechasFaltas.map(x => ({ Estudiante: f.nombre, Curso: f.curso, Fecha: fechaCorta(x.fecha), Día: diaSemana(x.fecha), Tipo: x.tipo === 'injustificada' ? 'Injustificada' : 'Justificada' }))) },
      { nombre: 'Cobertura de registro', filas: cobertura.map(c => ({ Curso: c.curso, Estudiantes: c.estudiantes, 'Días hábiles': c.diasHabiles, 'Días con asistencia': c.diasConRegistro, '% cobertura': c.pctCobertura ?? '', 'Últimos días sin registro': c.ultimosSinRegistro.map(fechaCorta).join(', ') })) }
    ]);
  }
  const exportarCsv = () => descargarCsv(`${nombreBase}.csv`, filasEstudiante());

  if (!institucionId) return <div className="card cb">Selecciona una institución para ver el análisis de asistencia.</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}><span className="ti ti-chart-dots" /> Análisis de asistencia</h2>
          <p style={{ color: 'var(--slate)', margin: '4px 0 0', fontSize: 13 }}>Riesgo por estudiante, faltas consecutivas, cobertura de registro y oficios para los representantes</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={exportarExcel} disabled={!datos || !filas.length}>⬇️ Excel (5 hojas)</button>
          <button className="btn btn-secondary" onClick={exportarCsv} disabled={!datos || !visibles.length}>⬇️ CSV</button>
          <button className="btn btn-primary" onClick={() => setOficio(conOficio)} disabled={!conOficio.length} title="Un oficio por cada estudiante con faltas injustificadas en la lista actual">📄 Oficios ({conOficio.length})</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="cb" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <div className="fl">Período</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PERIODOS.map(([k, t]) => <button key={k} className={'btn btn-sm ' + (periodo === k ? 'btn-primary' : 'btn-secondary')} onClick={() => setPeriodo(k)}>{t}</button>)}
            </div>
          </div>
          {periodo === 'custom' && (
            <>
              <div><div className="fl">Desde</div><input className="fc" type="date" value={custom.desde} onChange={e => setCustom(c => ({ ...c, desde: e.target.value }))} /></div>
              <div><div className="fl">Hasta</div><input className="fc" type="date" value={custom.hasta} onChange={e => setCustom(c => ({ ...c, hasta: e.target.value }))} /></div>
            </>
          )}
          <div><div className="fl">Curso</div>
            <select className="fc" value={curso} onChange={e => setCurso(e.target.value)}><option value="">Todos los cursos</option>{cursos.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          <div><div className="fl">Clasificación</div>
            <select className="fc" value={clase} onChange={e => setClase(e.target.value)}><option value="">Todas</option>{['critica', 'en_riesgo', 'buena', 'excelente'].map(c => <option key={c} value={c}>{ETIQUETA_CLASE[c]}</option>)}</select></div>
          <div style={{ flex: '1 1 180px' }}><div className="fl">Buscar</div><input className="fc" placeholder="Nombre o cédula…" value={busqueda} onChange={e => setBusqueda(e.target.value)} /></div>
          <label style={{ fontSize: 12.5, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={soloFaltas} onChange={e => setSoloFaltas(e.target.checked)} /> Solo con faltas</label>
        </div>
        <div style={{ padding: '0 16px 12px', fontSize: 12, color: 'var(--slate)' }}>
          {rangoOk ? <>Del <strong>{fechaCorta(desde)}</strong> al <strong>{fechaCorta(hasta)}</strong>. </> : 'Elige un rango de fechas válido. '}
          Clasificación según el % de faltas injustificadas: Excelente ≤ {umbrales.excelente}% · Buena ≤ {umbrales.buena}% · En riesgo ≤ {umbrales.riesgo}% · Crítica &gt; {umbrales.riesgo}%.{' '}
          <button className="btn btn-ghost btn-sm" onClick={() => setEditU(v => !v)}>Cambiar umbrales</button>
          {editU && <UmbralesForm umbrales={umbrales} onGuardar={u => { if (guardarUmbrales(u)) setEditU(false); }} onRestaurar={() => { guardarUmbrales(UMBRALES_DEFECTO); setEditU(false); }} />}
        </div>
      </div>

      {error && <div className="lerr" style={{ display: 'flex', marginBottom: 10 }}>{error}</div>}
      {cargando && <div className="card cb">Cargando asistencia…</div>}

      {datos && !cargando && (
        <>
          {!datos.registros.length && <div className="card cb" style={{ marginBottom: 12 }}>No hay asistencia registrada en este período.</div>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <Tarjeta valor={pct(totales.pctAsistencia)} etiqueta="Asistencia general" sub={`${totales.estudiantes} estudiantes`} color="#2563eb" />
            <Tarjeta valor={totales.criticos} etiqueta="En situación crítica" sub={`${totales.enRiesgo} más en riesgo`} color="#dc2626" />
            <Tarjeta valor={totales.conRacha} etiqueta={`Con ${RACHA_ALERTA}+ faltas seguidas`} sub={totales.rachaMax ? `máximo ${totales.rachaMax} días seguidos` : 'ninguno'} color="#d97706" />
            <Tarjeta valor={pct(totales.pctCobertura)} etiqueta="Cobertura de registro" sub={`${habiles.length} días hábiles${totales.cursosSinRegistro ? ` · ${totales.cursosSinRegistro} curso(s) sin registro` : ''}`} color="#7c3aed" />
          </div>

          {conRacha.length > 0 && (
            <div className="card" style={{ marginBottom: 12, borderLeft: '4px solid #d97706' }}>
              <div className="ch"><h3>⚠️ Faltas consecutivas ({conRacha.length})</h3></div>
              <div className="cb" style={{ fontSize: 13 }}>
                {conRacha.slice(0, 12).map(f => (
                  <div key={f.id} style={{ display: 'flex', gap: 10, justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--line, #eee)' }}>
                    <span><strong>{f.nombre}</strong> · {f.curso}</span>
                    <span>{f.rachaMax} días seguidos ({fechaCorta(f.rachaIni)} al {fechaCorta(f.rachaFin)}){f.rachaActual > 0 ? ' · sigue ausente' : ''}</span>
                  </div>
                ))}
                {conRacha.length > 12 && <div style={{ color: 'var(--slate)', marginTop: 4 }}>… y {conRacha.length - 12} más (están en la tabla y en el Excel).</div>}
              </div>
            </div>
          )}

          <div className="card" style={{ marginBottom: 12 }}>
            <div className="ch"><h3>Estudiantes ({visibles.length})</h3></div>
            <div className="cb" style={{ overflowX: 'auto' }}>
              <table className="tbl" style={{ width: '100%' }}>
                <thead><tr><th>#</th><th>Estudiante</th><th>Curso</th><th>Días</th><th>Faltas inj.</th><th>Justif.</th><th>% asist.</th><th>Seguidas</th><th>Clasificación</th><th /></tr></thead>
                <tbody>
                  {visibles.length === 0 && <tr><td colSpan={10} style={{ textAlign: 'center', padding: 22, color: 'var(--slate)' }}>Sin estudiantes con esos filtros.</td></tr>}
                  {visibles.slice(0, 300).map((f, i) => (
                    <tr key={f.id}>
                      <td>{i + 1}</td>
                      <td><div style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--brand, #0891b2)' }} onClick={() => setFichaDe({ id: f.id, nombre: f.nombre, cedula: f.cedula, curso: f.curso })} title="Ver ficha de asistencia">{f.nombre}</div><div style={{ fontSize: 11.5, color: 'var(--slate)' }}>{f.cedula}</div></td>
                      <td>{f.curso}</td><td>{f.dias}</td>
                      <td style={{ fontWeight: 700, color: f.faltas ? '#b91c1c' : undefined }}>{f.faltas}</td><td>{f.justificadas}</td>
                      <td>{pct(f.pctAsistencia)}</td>
                      <td style={{ fontWeight: f.rachaMax >= RACHA_ALERTA ? 800 : 400, color: f.rachaMax >= RACHA_ALERTA ? '#b45309' : undefined }}>{f.rachaMax || '—'}</td>
                      <td><Chip clase={f.clase} /></td>
                      <td>{f.faltas > 0 && <button className="btn btn-secondary btn-sm" onClick={() => setOficio([f])}>📄 Oficio</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visibles.length > 300 && <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 8 }}>Se muestran 300 de {visibles.length}; filtra por curso o descarga el Excel para ver todos.</div>}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 12 }}>
            <div className="card">
              <div className="ch"><h3>Por curso</h3></div>
              <div className="cb" style={{ overflowX: 'auto' }}>
                <table className="tbl" style={{ width: '100%' }}>
                  <thead><tr><th>Curso</th><th>Estud.</th><th>% asist.</th><th>Faltas inj.</th><th>En riesgo</th><th>Críticos</th></tr></thead>
                  <tbody>{porCurso.map(c => <tr key={c.curso}><td>{c.curso}</td><td>{c.estudiantes}</td><td>{pct(c.pctAsistencia)}</td><td>{c.faltas}</td><td>{c.enRiesgo}</td><td>{c.criticos}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
            <div className="card">
              <div className="ch"><h3>Cobertura de registro</h3></div>
              <div className="cb" style={{ overflowX: 'auto' }}>
                <p style={{ fontSize: 12, color: 'var(--slate)', marginTop: 0 }}>Días hábiles (lunes a viernes, sin los feriados cargados en el calendario) en que se tomó asistencia. Un curso con poca cobertura tiene un % de asistencia poco confiable.</p>
                <table className="tbl" style={{ width: '100%' }}>
                  <thead><tr><th>Curso</th><th>Con registro</th><th>Cobertura</th><th>Últimos días sin registro</th></tr></thead>
                  <tbody>{cobertura.map(c => (
                    <tr key={c.cursoId}>
                      <td>{c.curso}</td><td>{c.diasConRegistro} de {c.diasHabiles}</td>
                      <td style={{ fontWeight: 700, color: c.pctCobertura !== null && c.pctCobertura < 70 ? '#b91c1c' : '#15803d' }}>{pct(c.pctCobertura)}</td>
                      <td style={{ fontSize: 12 }}>{c.ultimosSinRegistro.map(fechaCorta).join(', ') || '—'}</td>
                    </tr>))}</tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {oficio && <OficioFaltasModal alumnos={oficio} institucion={institucion} periodo={{ desde, hasta }} onClose={() => setOficio(null)} onRegistrar={items => registrarOficiosEmitidos(institucionId, items, profile.id)} />}
      {fichaDe && <FichaAsistenciaModal estudiante={fichaDe} onClose={() => setFichaDe(null)} />}
    </div>
  );
}

function UmbralesForm({ umbrales, onGuardar, onRestaurar }) {
  const [u, setU] = useState({ ...umbrales });
  const campo = (k, t) => (
    <label style={{ display: 'inline-flex', flexDirection: 'column', fontSize: 12, marginRight: 10 }}>{t}
      <input className="fc" type="number" min="0" max="100" step="0.5" style={{ width: 90 }} value={u[k]} onChange={e => setU(x => ({ ...x, [k]: e.target.value === '' ? '' : Number(e.target.value) }))} />
    </label>);
  const ok = umbralesValidos(u);
  return (
    <div style={{ marginTop: 8, display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap', gap: 4 }}>
      {campo('excelente', 'Excelente hasta (%)')}{campo('buena', 'Buena hasta (%)')}{campo('riesgo', 'En riesgo hasta (%)')}
      <button className="btn btn-primary btn-sm" disabled={!ok} onClick={() => onGuardar(u)}>Guardar</button>
      <button className="btn btn-ghost btn-sm" onClick={onRestaurar}>Restaurar</button>
      {!ok && <span style={{ color: '#b91c1c' }}>Deben ir de menor a mayor, entre 0 y 100.</span>}
    </div>
  );
}
