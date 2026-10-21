import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { fetchAnalisisCalificaciones } from '../lib/data.js';
import { descargarLibro } from '../lib/exportLibro.js';
import {
  BANDAS, enAlerta, esCritica, fmtNota, alertasDeVentana, promedioDeVentana, resumenPorDocente, resumenPorCurso, resumenPorMateria,
  etiquetaSemana, etiquetaMes, filtrarDocentes, colorJornada
} from '../lib/rendimiento.js';
import GraficoLineas from '../components/GraficoLineas.jsx';
import { ChipNota, Dona, BarrasH, Sparkline } from '../components/GraficosRendimiento.jsx';
import EstudianteRendimientoModal, { ChipSeguimiento, ESTADOS_SEG } from '../components/EstudianteRendimientoModal.jsx';
import FichaDocumentoModal from '../components/FichaDocumentoModal.jsx';
import FichasEmitidas from '../components/FichasEmitidas.jsx';
import { TIPOS_FICHA } from '../lib/fichasRendimiento.js';

const ROJO = '#dc2626', AMBAR = '#d97706', VERDE = '#15803d', AZUL = '#1d4ed8';
const colorPct = p => (p >= 40 ? ROJO : p >= 20 ? AMBAR : VERDE);
const diasDesde = f => (f ? Math.max(0, Math.round((Date.now() - new Date(f + 'T12:00:00').getTime()) / 86400000)) : null);
const por100 = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

function Kpi({ valor, etiqueta, sub, color, icono, activo, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} className="card" aria-pressed={onClick ? !!activo : undefined}
      style={{ margin: 0, padding: '12px 16px', textAlign: 'left', cursor: onClick ? 'pointer' : 'default', borderTop: `3px solid ${color}`, outline: activo ? `2px solid ${color}` : 'none', background: 'var(--white)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className={icono} style={{ color, fontSize: 18 }} /><span style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{valor}</span></div>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate)', marginTop: 4 }}>{etiqueta}</div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--slate)' }}>{sub}</div>}
    </Tag>
  );
}
const Seccion = ({ titulo, sub, children, derecha }) => (
  <div className="card" style={{ margin: 0, padding: 16 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
      <div><div style={{ fontWeight: 800 }}>{titulo}</div>{sub && <div style={{ fontSize: 12, color: 'var(--slate)' }}>{sub}</div>}</div>{derecha}
    </div>
    {children}
  </div>
);

const AUTORIDADES = ['super_admin', 'supervisor_general', 'admin_plantel', 'supervisor_plantel', 'inspector_general'];

export default function AnalisisCalificaciones({ ambito = 'propio' }) {
  const { institucion, profile } = useSession();
  const esTutor = ambito === 'tutor';
  const puedeRevisar = AUTORIDADES.includes(profile?.rolDb);
  const institucionId = institucion?.id;
  const [trim, setTrim] = useState(null);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [modo, setModo] = useState('acumulado');      // acumulado | semana | mes
  const [clave, setClave] = useState(null);           // inicio de la semana/mes elegido
  const [curso, setCurso] = useState(''); const [materia, setMateria] = useState(''); const [docente, setDocente] = useState('');
  const [segFiltro, setSegFiltro] = useState(''); const [busqueda, setBusqueda] = useState('');
  const [limite, setLimite] = useState(60);
  const [ficha, setFicha] = useState(null);
  const [jornada, setJornada] = useState(''); const [qDocente, setQDocente] = useState('');
  const [fichaDoc, setFichaDoc] = useState(null); const [recargaFichas, setRecargaFichas] = useState(0);

  const cargar = useCallback(async (t) => {
    if (!institucionId) return;
    setCargando(true); setError('');
    try { const d = await fetchAnalisisCalificaciones(institucionId, t ?? null, 12, 6, ambito); setDatos(d); setTrim(d.trimestre); }
    catch (e) { setError(e.message || 'No se pudo cargar el análisis.'); setDatos(null); }
    setCargando(false);
  }, [institucionId, ambito]);
  useEffect(() => { cargar(null); }, [cargar]);

  const soloDocente = !!datos?.solo_docente;
  const semanas = datos?.semanas || []; const meses = datos?.meses || [];
  // Al cambiar de modo se elige por defecto la semana / el mes actual
  useEffect(() => { if (!datos) return; setClave(modo === 'semana' ? datos.semana_actual : modo === 'mes' ? datos.mes_actual : null); }, [modo, datos]);

  const cargas = datos?.cargas || [];
  const cursosOpc = useMemo(() => [...new Set(cargas.map(c => `${c.curso} ${c.paralelo}`))], [cargas]);
  const jornadasOpc = useMemo(() => [...new Set(cargas.map(c => c.jornada).filter(Boolean))].sort(), [cargas]);
  const materiasOpc = useMemo(() => [...new Set(cargas.map(c => c.materia))].sort((a, b) => a.localeCompare(b, 'es')), [cargas]);
  const docentesOpc = useMemo(() => [...new Map(cargas.map(c => [c.docente_id, c.docente])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'es')), [cargas]);
  const cargasF = useMemo(() => cargas.filter(c => (!curso || `${c.curso} ${c.paralelo}` === curso) && (!materia || c.materia === materia) && (!docente || c.docente_id === docente) && (!jornada || c.jornada === jornada)), [cargas, curso, materia, docente, jornada]);
  const idsF = useMemo(() => new Set(cargasF.map(c => c.carga_id)), [cargasF]);
  const alertasF = useMemo(() => (datos?.alertas || []).filter(a => idsF.has(a.carga_id)), [datos, idsF]);

  // KPIs con los filtros aplicados
  const kpi = useMemo(() => {
    const distintos = lista => new Set(lista.map(a => a.estudiante_id)).size;
    const acum = alertasDeVentana(alertasF, 'acumulado');
    const ev = cargasF.reduce((a, c) => a + Number(c.evaluados || 0), 0);
    const suma = cargasF.reduce((a, c) => a + (c.promedio != null ? Number(c.promedio) * Number(c.evaluados || 0) : 0), 0);
    return {
      acum: distintos(acum), criticas: distintos(acum.filter(a => esCritica(a.parcial))),
      sem: distintos(alertasDeVentana(alertasF, 'semana', datos?.semana_actual)), mes: distintos(alertasDeVentana(alertasF, 'mes', datos?.mes_actual)),
      promedio: ev ? Math.round((suma / ev) * 100) / 100 : null, evaluados: ev, sinNotas: cargasF.filter(c => !Number(c.evaluados)).length, cargas: cargasF.length
    };
  }, [alertasF, cargasF, datos]);

  const bandas = useMemo(() => BANDAS.map(b => ({ ...b, label: `${b.sigla} · ${b.nombre}`, valor: cargasF.reduce((a, c) => a + Number(c[b.id] || 0), 0) })), [cargasF]);
  const totalBandas = bandas.reduce((a, b) => a + b.valor, 0);
  const porCurso = useMemo(() => resumenPorCurso(cargasF), [cargasF]);
  const porMateria = useMemo(() => resumenPorMateria(cargasF), [cargasF]);
  const porDocente = useMemo(() => resumenPorDocente(cargasF, alertasF), [cargasF, alertasF]);
  const porDocenteVis = useMemo(() => filtrarDocentes(porDocente, qDocente), [porDocente, qDocente]);

  // Tabla de alertas según la ventana elegida
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return alertasDeVentana(alertasF, modo, clave)
      .filter(a => (!segFiltro || (segFiltro === 'sin' ? !a.seg_estado : a.seg_estado === segFiltro)) && (!q || `${a.apellidos} ${a.nombres} ${a.cedula || ''} ${a.materia} ${a.docente}`.toLowerCase().includes(q)))
      .sort((x, y) => (promedioDeVentana(x, modo, clave) ?? 99) - (promedioDeVentana(y, modo, clave) ?? 99));
  }, [alertasF, modo, clave, segFiltro, busqueda]);
  useEffect(() => { setLimite(60); }, [modo, clave, curso, materia, docente, jornada, segFiltro, busqueda]);

  const serieVentana = modo === 'mes' ? meses : semanas;
  const etiq = serieVentana.map(w => (modo === 'mes' ? etiquetaMes(w.desde) : etiquetaSemana(w.desde)));
  const idxSel = clave ? serieVentana.findIndex(w => w.desde === clave) : null;
  const seriesTend = [
    { id: 'al', label: '% de registros en alerta', color: ROJO, puntos: serieVentana.map(w => { const p = por100(w.alertas, w.evaluados); return { pct: p, texto: w.evaluados ? `${p}% (${w.alertas} de ${w.evaluados})` : 'sin notas esa semana' }; }) },
    { id: 'pr', label: 'Promedio (sobre 10)', color: AZUL, puntos: serieVentana.map(w => ({ pct: w.promedio != null ? Number(w.promedio) * 10 : 0, texto: w.promedio != null ? fmtNota(w.promedio) : 'sin notas' })) }
  ];
  const hayTendencia = serieVentana.some(w => w.evaluados > 0);

  const seguimientosDe = useCallback(estId => Object.fromEntries((datos?.alertas || []).filter(a => a.estudiante_id === estId && a.seg_estado).map(a => [a.carga_id, { estado: a.seg_estado, nota: a.seg_nota }])), [datos]);
  function alGuardarSeguimiento(estId, { cargaId, estado, nota }) {
    setDatos(d => ({ ...d, alertas: d.alertas.map(a => (a.estudiante_id === estId && a.carga_id === cargaId ? { ...a, seg_estado: estado, seg_nota: nota } : a)) }));
  }

  function abrirDocumento(a) { setFichaDoc({ id: a.estudiante_id, apellidos: a.apellidos, nombres: a.nombres, cedula: a.cedula, curso: a.curso, paralelo: a.paralelo, jornada: a.jornada }); }

  function exportar() {
    const ventana = modo === 'semana' ? `semana ${etiquetaSemana(clave)}` : modo === 'mes' ? `mes ${etiquetaMes(clave)}` : 'acumulado';
    descargarLibro(`analisis_calificaciones_T${(trim || '').replace('T', '')}_${new Date().toISOString().slice(0, 10)}.xlsx`, [
      { nombre: 'Resumen', filas: [
        { Indicador: 'Plantel', Valor: institucion?.nombre || '' }, { Indicador: 'Trimestre', Valor: trim }, { Indicador: 'Alertas: rango', Valor: '0,01 a 6,99' },
        { Indicador: 'Estudiantes en alerta (acumulado)', Valor: kpi.acum }, { Indicador: 'En alerta crítica (≤ 4)', Valor: kpi.criticas }, { Indicador: 'En alerta esta semana', Valor: kpi.sem },
        { Indicador: 'En alerta este mes', Valor: kpi.mes }, { Indicador: 'Promedio general', Valor: kpi.promedio ?? '' }, { Indicador: 'Cursos sin notas registradas', Valor: kpi.sinNotas }
      ], cols: ['Indicador', 'Valor'] },
      { nombre: `Alertas (${ventana})`.slice(0, 31), filas: visibles.map(a => ({ Estudiante: `${a.apellidos} ${a.nombres}`, Cédula: a.cedula || '', Curso: `${a.curso} ${a.paralelo}`, Materia: a.materia, Docente: a.docente, 'Promedio acumulado': a.parcial, Formativa: a.formativo, 'Sumativa / proyecto': a.sumativo, 'Prom. semana actual': a.prom_sem ?? '', 'Prom. mes actual': a.prom_mes ?? '', Nivel: esCritica(a.parcial) ? 'Crítica' : 'Alerta', Seguimiento: (ESTADOS_SEG[a.seg_estado] || ['Sin seguimiento'])[0], 'Acción registrada': a.seg_nota || '' })),
        cols: ['Estudiante', 'Cédula', 'Curso', 'Materia', 'Docente', 'Promedio acumulado', 'Formativa', 'Sumativa / proyecto', 'Prom. semana actual', 'Prom. mes actual', 'Nivel', 'Seguimiento', 'Acción registrada'] },
      { nombre: 'Por docente', filas: porDocente.map(d => ({ Docente: d.docente, Cargas: d.cargas, 'Cargas sin notas': d.sin_notas, 'Estudiantes evaluados': d.evaluados, Promedio: d.promedio ?? '', 'En alerta': d.alertas, Críticas: d.criticas, '% en alerta': d.pct_alerta, 'Último registro': d.ultima || '' })), cols: ['Docente', 'Cargas', 'Cargas sin notas', 'Estudiantes evaluados', 'Promedio', 'En alerta', 'Críticas', '% en alerta', 'Último registro'] },
      { nombre: 'Por curso', filas: porCurso.map(c => ({ Curso: c.etiqueta, Evaluados: c.evaluados, Promedio: c.promedio ?? '', 'En alerta': c.alertas, '% en alerta': c.pct_alerta, DA: c.da, AA: c.aa, PA: c.pa, NA: c.na })), cols: ['Curso', 'Evaluados', 'Promedio', 'En alerta', '% en alerta', 'DA', 'AA', 'PA', 'NA'] },
      { nombre: 'Por materia', filas: porMateria.map(c => ({ Materia: c.etiqueta, Evaluados: c.evaluados, Promedio: c.promedio ?? '', 'En alerta': c.alertas, '% en alerta': c.pct_alerta })), cols: ['Materia', 'Evaluados', 'Promedio', 'En alerta', '% en alerta'] },
      { nombre: 'Semanas', filas: semanas.map(w => ({ 'Semana desde': w.desde, Registros: w.evaluados, 'En alerta': w.alertas, 'Promedio': w.promedio ?? '' })), cols: ['Semana desde', 'Registros', 'En alerta', 'Promedio'] },
      { nombre: 'Meses', filas: meses.map(w => ({ 'Mes desde': w.desde, Registros: w.evaluados, 'En alerta': w.alertas, 'Promedio': w.promedio ?? '' })), cols: ['Mes desde', 'Registros', 'En alerta', 'Promedio'] }
    ]);
  }

  if (!institucionId) return <div className="card cb">Selecciona una institución para ver el análisis de calificaciones.</div>;

  const ventanaTxt = modo === 'semana' ? `la semana del ${etiquetaSemana(clave || datos?.semana_actual || '2000-01-01')}` : modo === 'mes' ? `el mes de ${etiquetaMes(clave || datos?.mes_actual || '2000-01-01')}` : 'el trimestre (acumulado)';

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: '0 0 4px' }}>{esTutor ? 'Calificaciones de mi curso (tutoría)' : soloDocente ? 'Mis alertas de rendimiento' : 'Análisis de calificaciones'}</h2>
          <div style={{ fontSize: 13, color: 'var(--slate)' }}>{esTutor ? 'Todas las asignaturas del curso del que eres tutor, de todos sus docentes. ' : soloDocente ? 'Estudiantes de tus cursos con promedio bajo 7. ' : 'Alerta temprana de bajo rendimiento de todos los docentes del plantel. '}Se considera alerta un promedio de <strong>0,01 a 6,99</strong>.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['T1', 'T2', 'T3'].map(t => <button key={t} className={'btn btn-sm ' + (trim === t ? 'btn-primary' : 'btn-secondary')} onClick={() => cargar(t)} disabled={cargando}>Trimestre {t.slice(1)}</button>)}
          <button className="btn btn-secondary btn-sm" onClick={exportar} disabled={!datos}>⬇️ Excel</button>
          <button className="btn btn-secondary btn-sm" onClick={() => cargar(trim)} disabled={cargando}>{cargando ? 'Actualizando…' : '↻ Actualizar'}</button>
        </div>
      </div>

      {error && <div className="card" style={{ padding: 14, color: 'var(--red)' }}>{error}</div>}
      {!datos && cargando && <div className="card" style={{ padding: 20, color: 'var(--slate)' }}>Calculando alertas…</div>}

      {datos && <>
        {!soloDocente && (
          <div className="card" style={{ margin: 0, padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
            {jornadasOpc.length > 1 && <select className="fc" value={jornada} onChange={e => setJornada(e.target.value)} aria-label="Jornada"><option value="">Todas las jornadas</option>{jornadasOpc.map(j => <option key={j}>{j}</option>)}</select>}
            <select className="fc" value={curso} onChange={e => setCurso(e.target.value)} aria-label="Curso"><option value="">Todos los cursos</option>{cursosOpc.map(c => <option key={c}>{c}</option>)}</select>
            <select className="fc" value={materia} onChange={e => setMateria(e.target.value)} aria-label="Asignatura o módulo"><option value="">Todas las asignaturas / módulos</option>{materiasOpc.map(m => <option key={m}>{m}</option>)}</select>
            <select className="fc" value={docente} onChange={e => setDocente(e.target.value)} aria-label="Docente"><option value="">Todos los docentes</option>{docentesOpc.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
          </div>
        )}

        {kpi.sinNotas > 0 && kpi.sinNotas === kpi.cargas && (
          <div className="card" style={{ margin: 0, padding: 14, borderLeft: `4px solid ${AMBAR}` }}>Todavía no hay notas registradas en {trim === datos.trimestre ? `el trimestre ${trim.slice(1)}` : 'este trimestre'}. Las alertas aparecen apenas los docentes ingresen actividades y el proyecto en <strong>Calificaciones</strong>.</div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
          <Kpi valor={kpi.acum} etiqueta="En alerta (trimestre)" sub={`de ${kpi.evaluados} registros evaluados`} color={kpi.acum ? ROJO : VERDE} icono="ti ti-alert-triangle" activo={modo === 'acumulado'} onClick={() => setModo('acumulado')} />
          <Kpi valor={kpi.sem} etiqueta="En alerta esta semana" sub="promedio de la semana bajo 7" color={kpi.sem ? ROJO : VERDE} icono="ti ti-calendar-week" activo={modo === 'semana'} onClick={() => setModo('semana')} />
          <Kpi valor={kpi.mes} etiqueta="En alerta este mes" sub="promedio del mes bajo 7" color={kpi.mes ? AMBAR : VERDE} icono="ti ti-calendar-month" activo={modo === 'mes'} onClick={() => setModo('mes')} />
          <Kpi valor={kpi.criticas} etiqueta="Alerta crítica" sub="promedio de 4,00 o menos" color={kpi.criticas ? ROJO : VERDE} icono="ti ti-flame" />
          <Kpi valor={kpi.promedio == null ? '—' : fmtNota(kpi.promedio)} etiqueta="Promedio general" sub={kpi.promedio == null ? 'sin notas' : kpi.promedio >= 7 ? 'sobre el mínimo de 7' : 'bajo el mínimo de 7'} color={kpi.promedio == null ? '#64748b' : kpi.promedio >= 7 ? VERDE : ROJO} icono="ti ti-chart-line" />
          {!soloDocente && <Kpi valor={kpi.sinNotas} etiqueta="Cursos sin notas" sub={`de ${kpi.cargas} asignaturas/módulos`} color={kpi.sinNotas ? AMBAR : VERDE} icono="ti ti-pencil-off" />}
        </div>

        <Seccion titulo="Evolución del rendimiento" sub={modo === 'mes' ? 'Por mes (últimos 6). Haz clic en un mes para ver sus alertas.' : 'Por semana (últimas 12). Haz clic en una semana para ver sus alertas.'}
          derecha={<div style={{ display: 'flex', gap: 6 }}>{[['acumulado', 'Trimestre'], ['semana', 'Por semana'], ['mes', 'Por mes']].map(([k, t]) => <button key={k} className={'btn btn-sm ' + (modo === k ? 'btn-primary' : 'btn-secondary')} onClick={() => setModo(k)}>{t}</button>)}</div>}>
          {hayTendencia
            ? <>
                <GraficoLineas titulo="Evolución del rendimiento" series={seriesTend} etiquetas={etiq} cadaX={modo === 'mes' ? 1 : 2} seleccion={idxSel >= 0 ? idxSel : null}
                  onSeleccionar={modo === 'acumulado' ? null : i => setClave(serieVentana[i].desde)} />
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--slate)', marginTop: 4 }}>
                  <span><span style={{ color: ROJO }}>●</span> % de registros en alerta</span><span><span style={{ color: AZUL }}>●</span> Promedio (sobre 10, mostrado como %)</span>
                </div>
              </>
            : <div style={{ color: 'var(--slate)', padding: '24px 0', textAlign: 'center' }}>Aún no hay notas con fecha en este período para dibujar la tendencia.</div>}
        </Seccion>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
          <Seccion titulo="Rendimiento del curso total" sub="Reparto de los promedios (estudiante × asignatura)">
            <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
              <Dona partes={bandas} centro={kpi.promedio == null ? '—' : fmtNota(kpi.promedio)} subcentro="promedio" />
              <div style={{ display: 'grid', gap: 8, flex: 1, minWidth: 190 }}>
                {bandas.map(b => (
                  <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: b.color, flex: '0 0 auto' }} />
                    <span style={{ flex: 1 }}><strong>{b.sigla}</strong> <span style={{ color: 'var(--slate)' }}>{b.rango}</span></span>
                    <strong>{b.valor}</strong><span style={{ color: 'var(--slate)', minWidth: 42, textAlign: 'right' }}>{totalBandas ? `${por100(b.valor, totalBandas)}%` : '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          </Seccion>
          <Seccion titulo="Por curso" sub="% de estudiantes en alerta (mayor a menor)">
            <BarrasH vacio="Sin notas todavía." items={porCurso.filter(c => c.evaluados).sort((a, b) => b.pct_alerta - a.pct_alerta).slice(0, 8).map(c => ({ etiqueta: c.etiqueta, valor: c.pct_alerta, texto: `${c.pct_alerta}% · prom. ${fmtNota(c.promedio)}`, color: colorPct(c.pct_alerta), sub: `${c.alertas} de ${c.evaluados} en alerta` }))} />
          </Seccion>
          <Seccion titulo="Por asignatura / módulo" sub="% de estudiantes en alerta (mayor a menor)">
            <BarrasH vacio="Sin notas todavía." items={porMateria.filter(c => c.evaluados).slice(0, 8).map(c => ({ etiqueta: c.etiqueta, valor: c.pct_alerta, texto: `${c.pct_alerta}% · prom. ${fmtNota(c.promedio)}`, color: colorPct(c.pct_alerta), sub: `${c.alertas} de ${c.evaluados} en alerta` }))} />
          </Seccion>
        </div>

        {!soloDocente && (
          <Seccion titulo={esTutor ? 'Docentes de mi curso' : 'Resumen por docente'} sub="La suma de los reportes de cada docente, con su jornada. Un docente sin notas no puede generar alertas: conviene recordárselo."
            derecha={<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input className="fc" style={{ width: 230 }} placeholder="🔍 Buscar docente…" value={qDocente} onChange={e => setQDocente(e.target.value)} aria-label="Buscar docente" />
              {qDocente && <button className="btn btn-ghost btn-sm" onClick={() => setQDocente('')}>Limpiar</button>}
              <span style={{ fontSize: 12, color: 'var(--slate)' }}>{porDocenteVis.length} de {porDocente.length}</span>
            </div>}>
            <div style={{ overflowX: 'auto' }}>
              <table className="data" style={{ width: '100%' }}>
                <thead><tr><th>Docente</th><th>Jornada</th><th style={{ textAlign: 'center' }}>Asignaturas</th><th style={{ textAlign: 'center' }}>Evaluados</th><th style={{ textAlign: 'center' }}>Promedio</th><th style={{ textAlign: 'center' }}>En alerta</th><th style={{ textAlign: 'center' }}>Críticas</th><th>Último registro</th></tr></thead>
                <tbody>
                  {porDocenteVis.map(d => { const dias = diasDesde(d.ultima); return (
                    <tr key={d.docente_id} onClick={() => setDocente(docente === d.docente_id ? '' : d.docente_id)} style={{ cursor: 'pointer', background: docente === d.docente_id ? 'var(--brandXL, #ecfeff)' : undefined }} title="Clic para filtrar por este docente">
                      <td style={{ fontWeight: 600 }}>{d.docente}</td>
                      <td>{d.jornadas.length ? d.jornadas.map(j => <span key={j} style={{ display: 'inline-block', marginRight: 4, padding: '0 8px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: colorJornada(j) + '1a', color: colorJornada(j), border: `1px solid ${colorJornada(j)}44` }}>{j}</span>) : '—'}</td>
                      <td style={{ textAlign: 'center' }}>{d.cargas}{d.sin_notas > 0 && <span title={`${d.sin_notas} sin notas registradas`} style={{ marginLeft: 6, color: AMBAR, fontSize: 11.5 }}>({d.sin_notas} sin notas)</span>}</td>
                      <td style={{ textAlign: 'center' }}>{d.evaluados}</td>
                      <td style={{ textAlign: 'center' }}>{d.promedio == null ? '—' : <ChipNota valor={d.promedio} />}</td>
                      <td style={{ textAlign: 'center' }}>{d.alertas ? <strong style={{ color: colorPct(d.pct_alerta) }}>{d.alertas} <span style={{ fontWeight: 500, fontSize: 11.5 }}>({d.pct_alerta}%)</span></strong> : <span style={{ color: VERDE }}>0</span>}</td>
                      <td style={{ textAlign: 'center' }}>{d.criticas ? <strong style={{ color: ROJO }}>{d.criticas}</strong> : '0'}</td>
                      <td style={{ fontSize: 12.5, color: dias != null && dias > 14 ? AMBAR : 'var(--slate)' }}>{dias == null ? 'Nunca' : dias === 0 ? 'Hoy' : `hace ${dias} día${dias === 1 ? '' : 's'}`}</td>
                    </tr>); })}
                  {!porDocenteVis.length && <tr><td colSpan={8} style={{ color: 'var(--slate)', textAlign: 'center', padding: 16 }}>{porDocente.length ? 'Ningún docente coincide con la búsqueda.' : 'No hay asignaturas con docente en este plantel.'}</td></tr>}
                </tbody>
              </table>
            </div>
          </Seccion>
        )}

        <Seccion titulo={`Estudiantes en alerta · ${ventanaTxt}`} sub={`${visibles.length} registro${visibles.length === 1 ? '' : 's'} (estudiante × asignatura). Abre la ficha para ver actividades, proyecto y registrar el seguimiento.`}
          derecha={<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input className="fc" style={{ width: 190 }} placeholder="Buscar estudiante, materia…" value={busqueda} onChange={e => setBusqueda(e.target.value)} aria-label="Buscar" />
            <select className="fc" style={{ width: 'auto' }} value={segFiltro} onChange={e => setSegFiltro(e.target.value)} aria-label="Seguimiento"><option value="">Todo seguimiento</option><option value="sin">Sin seguimiento</option>{Object.entries(ESTADOS_SEG).map(([k, [t]]) => <option key={k} value={k}>{t}</option>)}</select>
          </div>}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data" style={{ width: '100%' }}>
              <thead><tr><th>Estudiante</th><th>Curso</th><th>Asignatura / módulo</th>{!soloDocente && <th>Docente</th>}<th style={{ textAlign: 'center' }}>{modo === 'acumulado' ? 'Promedio' : modo === 'semana' ? 'Prom. semana' : 'Prom. mes'}</th><th style={{ textAlign: 'center' }}>Tendencia</th><th>Seguimiento</th><th /></tr></thead>
              <tbody>
                {visibles.slice(0, limite).map(a => (
                  <tr key={a.estudiante_id + a.carga_id}>
                    <td style={{ fontWeight: 600 }}>{a.apellidos} {a.nombres}{esCritica(a.parcial) && <span title="Alerta crítica: promedio de 4,00 o menos" style={{ marginLeft: 6 }}>🔴</span>}</td>
                    <td style={{ fontSize: 12.5 }}>{a.curso} {a.paralelo}{a.jornada && jornadasOpc.length > 1 ? <div style={{ fontSize: 11, color: colorJornada(a.jornada), fontWeight: 700 }}>{a.jornada}</div> : null}</td>
                    <td style={{ fontSize: 12.5 }}>{a.materia}</td>
                    {!soloDocente && <td style={{ fontSize: 12.5 }}>{a.docente}</td>}
                    <td style={{ textAlign: 'center' }}><ChipNota valor={promedioDeVentana(a, modo, clave)} />{modo !== 'acumulado' && <div style={{ fontSize: 10.5, color: 'var(--slate)' }}>acum. {fmtNota(a.parcial)}</div>}</td>
                    <td style={{ textAlign: 'center' }}><Sparkline puntos={a.semanas} /></td>
                    <td><ChipSeguimiento estado={a.seg_estado} />{a.seg_nota && <div style={{ fontSize: 11, color: 'var(--slate)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.seg_nota}>{a.seg_nota}</div>}</td>
                    <td><button className="btn btn-secondary btn-sm" onClick={() => setFicha({ ...a, seguimientos: seguimientosDe(a.estudiante_id) })}>Ver ficha</button>{' '}<button className="btn btn-primary btn-sm" title="Oficio al representante, plan de refuerzo, acta o ficha del tutor" onClick={() => abrirDocumento(a)}>📄 Oficio / ficha</button></td>
                  </tr>
                ))}
                {!visibles.length && <tr><td colSpan={soloDocente ? 7 : 8} style={{ textAlign: 'center', color: 'var(--slate)', padding: 24 }}>🎉 No hay estudiantes en alerta para {ventanaTxt}.</td></tr>}
              </tbody>
            </table>
          </div>
          {visibles.length > limite && <div style={{ textAlign: 'center', marginTop: 10 }}><button className="btn btn-secondary btn-sm" onClick={() => setLimite(l => l + 100)}>Mostrar más ({visibles.length - limite} restantes)</button></div>}
        </Seccion>
      </>}

      {datos && <FichasEmitidas institucion={institucion} puedeRevisar={puedeRevisar} recargar={recargaFichas} titulo={esTutor ? 'Fichas y oficios de mi curso' : soloDocente ? 'Mis oficios y fichas emitidos' : 'Oficios y fichas de seguimiento emitidos'} />}

      {fichaDoc && <FichaDocumentoModal estudiante={fichaDoc} institucion={institucion} tutorNombreDefault={esTutor ? `${profile?.apellidos || ''} ${profile?.nombres || ''}`.trim() : ''} trimestre={trim || 'T1'} tipos={esTutor || !soloDocente ? Object.keys(TIPOS_FICHA) : Object.keys(TIPOS_FICHA).filter(k => k !== 'ficha_tutor')}
        onClose={() => setFichaDoc(null)} onGuardado={() => setRecargaFichas(n => n + 1)} />}
      {ficha && <EstudianteRendimientoModal fila={ficha} onFicha={() => { abrirDocumento(ficha); setFicha(null); }} trimestre={trim || 'T1'} onClose={() => setFicha(null)} onSeguimiento={g => { alGuardarSeguimiento(ficha.estudiante_id, g); setFicha(f => (f ? { ...f, seguimientos: { ...f.seguimientos, [g.cargaId]: { estado: g.estado, nota: g.nota } } } : f)); }} />}
    </div>
  );
}
