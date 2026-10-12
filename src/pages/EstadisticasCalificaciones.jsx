import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useSession } from '../lib/SessionContext.jsx';
import { fetchEstadisticasColegios, fetchEstadisticasColegio } from '../lib/data.js';
import BuscadorInstitucion from '../components/BuscadorInstitucion.jsx';
import { descargarLibro } from '../lib/exportLibro.js';
import {
  ESCALAS, ETAPAS, ETIQUETA_ESTADO, sumar, agruparColegios, porGrado, porMateria, porDocente,
  porcentajesEscala, condicionRiesgo, pctTxt, notaTxt
} from '../lib/estadisticasNotas.js';

const ROLES_GLOBALES = ['super_admin', 'supervisor_general'];
const COLOR_ESTADO = { aprobado: ['#dcfce7', '#15803d'], supletorio: ['#fef3c7', '#b45309'], reprobado: ['#fee2e2', '#b91c1c'], en_curso: ['#e2e8f0', '#475569'] };

const Tarjeta = ({ valor, etiqueta, sub, color }) => (
  <div className="card" style={{ margin: 0, padding: '12px 16px', minWidth: 150, flex: '1 1 150px', borderTop: `3px solid ${color || 'var(--brand, #0891b2)'}` }}>
    <div style={{ fontSize: 26, fontWeight: 800, color }}>{valor}</div>
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate)' }}>{etiqueta}</div>
    {sub && <div style={{ fontSize: 11.5, color: 'var(--slate)' }}>{sub}</div>}
  </div>
);

const Chip = ({ estado, texto }) => {
  const [bg, fg] = COLOR_ESTADO[estado] || COLOR_ESTADO.en_curso;
  return <span style={{ background: bg, color: fg, borderRadius: 999, padding: '2px 10px', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}>{texto || ETIQUETA_ESTADO[estado] || estado}</span>;
};

/** Barra apilada DA / AA / PA / NA */
function BarraEscala({ t }) {
  const p = porcentajesEscala(t);
  const hay = p.some(e => e.n > 0);
  return (
    <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', background: '#e2e8f0', minWidth: 110 }}
      title={p.map(e => `${e.c}: ${e.n} (${pctTxt(e.pct)})`).join(' · ')}>
      {hay && p.map(e => e.pct > 0 && <div key={e.k} style={{ width: `${e.pct}%`, background: e.color }} />)}
    </div>
  );
}

function Leyenda() {
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11.5, color: 'var(--slate)' }}>
      {ESCALAS.map(e => <span key={e.k}><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: e.color, marginRight: 5 }} />{e.c} · {e.label}</span>)}
    </div>
  );
}

function TablaResumen({ filas, titulo, onFila, extra }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data">
        <thead><tr>
          <th>{titulo}</th>{extra && <th>{extra.titulo}</th>}<th>Est.</th><th>Promedio</th><th>Aprobados</th><th>Supletorio</th><th>Reprobados</th><th>En curso</th><th>% aprob.</th><th>Escala</th>
        </tr></thead>
        <tbody>
          {filas.map(f => (
            <tr key={f.clave ?? f.id} onClick={onFila ? () => onFila(f) : undefined} style={onFila ? { cursor: 'pointer' } : undefined}>
              <td><strong>{f.etiqueta ?? f.nombre}</strong></td>
              {extra && <td style={{ fontSize: 12, color: 'var(--slate)' }}>{extra.valor(f)}</td>}
              <td>{f.estudiantes}</td><td><strong>{notaTxt(f.promedio)}</strong></td>
              <td>{f.aprobados}</td><td>{f.supletorio}</td><td>{f.reprobados}</td><td>{f.en_curso}</td>
              <td><strong>{pctTxt(f.pctAprobacion)}</strong></td><td style={{ minWidth: 130 }}><BarraEscala t={f} /></td>
            </tr>
          ))}
          {!filas.length && <tr><td colSpan={extra ? 10 : 9} style={{ textAlign: 'center', color: 'var(--slate)', padding: 18 }}>Sin datos.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function KPIs({ t, estudiantes, colegios }) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
      {colegios !== undefined && <Tarjeta valor={colegios} etiqueta="Colegios con notas" color="#0891b2" />}
      <Tarjeta valor={estudiantes} etiqueta="Estudiantes" sub={`${t.registros} registros alumno-materia`} color="#2563eb" />
      <Tarjeta valor={notaTxt(t.promedio)} etiqueta="Promedio general" color="#7c3aed" />
      <Tarjeta valor={pctTxt(t.pctAprobacion)} etiqueta="Aprobación" sub={`${t.aprobados} aprobados`} color="#16a34a" />
      <Tarjeta valor={t.supletorio} etiqueta="En supletorio" sub="promedio 4,01 a 6,99" color="#d97706" />
      <Tarjeta valor={t.reprobados} etiqueta="Reprobados" sub="promedio menor a 4,01" color="#dc2626" />
    </div>
  );
}

export default function EstadisticasCalificaciones() {
  const { profile, institucion, instituciones } = useSession();
  const esGlobal = ROLES_GLOBALES.includes(profile?.rolDb);

  const [colegios, setColegios] = useState([]);        // v_estadisticas_colegio
  const [cargandoGlobal, setCargandoGlobal] = useState(true);
  const [colegioId, setColegioId] = useState(esGlobal ? '' : (institucion?.id || ''));
  const [detalle, setDetalle] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [etapa, setEtapa] = useState('');
  const [tab, setTab] = useState('resumen');
  const [busqueda, setBusqueda] = useState('');
  const [filtroRiesgo, setFiltroRiesgo] = useState('');
  const [verTodos, setVerTodos] = useState(false);

  // Panel global (también sirve para el rector: devuelve solo su colegio por RLS).
  useEffect(() => {
    let vivo = true;
    (async () => {
      try { const f = await fetchEstadisticasColegios(); if (vivo) setColegios(f); }
      catch (e) { if (vivo) setError(e.message || 'No se pudieron cargar las estadísticas.'); }
      if (vivo) setCargandoGlobal(false);
    })();
    return () => { vivo = false; };
  }, []);

  // Rector / supervisor de plantel: su colegio queda elegido solo.
  useEffect(() => { if (!esGlobal && institucion?.id) setColegioId(institucion.id); }, [esGlobal, institucion?.id]);

  const cargarDetalle = useCallback(async () => {
    if (!colegioId) { setDetalle(null); return; }
    setCargando(true); setError('');
    try { setDetalle(await fetchEstadisticasColegio(colegioId)); }
    catch (e) { setError(e.message || 'No se pudo cargar el colegio.'); setDetalle(null); }
    setCargando(false);
  }, [colegioId]);
  useEffect(() => { cargarDetalle(); setTab('resumen'); setBusqueda(''); setFiltroRiesgo(''); }, [cargarDetalle]);

  const lista = useMemo(() => agruparColegios(colegios, etapa), [colegios, etapa]);
  const totalGlobal = useMemo(() => sumar(lista), [lista]);
  const estudiantesGlobal = useMemo(() => lista.reduce((a, c) => a + c.estudiantes, 0), [lista]);
  const opcionesColegio = useMemo(() => {
    if (instituciones && instituciones.length > 1) return instituciones;
    const m = new Map(); colegios.forEach(c => m.set(c.institucion_id, { id: c.institucion_id, nombre: c.institucion, amie: '' }));
    return [...m.values()];
  }, [instituciones, colegios]);
  const nombreColegio = useMemo(() => opcionesColegio.find(c => c.id === colegioId)?.nombre || institucion?.nombre || '', [opcionesColegio, colegioId, institucion]);

  const filasDetalle = useMemo(() => (detalle ? detalle.detalle.filter(f => !etapa || f.etapa === etapa) : []), [detalle, etapa]);
  const totalColegio = useMemo(() => sumar(filasDetalle), [filasDetalle]);
  const estudiantesColegio = useMemo(() => porGrado(filasDetalle).reduce((a, g) => a + g.estudiantes, 0), [filasDetalle]);
  const grados = useMemo(() => porGrado(filasDetalle), [filasDetalle]);
  const materias = useMemo(() => porMateria(filasDetalle), [filasDetalle]);
  const docentes = useMemo(() => porDocente(filasDetalle).sort((a, b) => (a.promedio ?? 99) - (b.promedio ?? 99)), [filasDetalle]);
  const cargasFilas = useMemo(() => filasDetalle.map(f => ({ ...f, ...sumar([f]), etiqueta: `${f.grado} ${f.paralelo}`, clave: `${f.paralelo_id}|${f.materia_id}` })), [filasDetalle]);
  const evolucion = useMemo(() => (detalle ? detalle.evolucion.filter(f => !etapa || f.etapa === etapa) : []), [detalle, etapa]);
  const riesgo = useMemo(() => {
    if (!detalle) return [];
    const q = busqueda.trim().toLowerCase();
    return detalle.riesgo.filter(f => (!etapa || f.etapa === etapa)
      && (!filtroRiesgo || f.estado === filtroRiesgo)
      && (!q || `${f.apellidos} ${f.nombres} ${f.materia} ${f.grado} ${f.docente}`.toLowerCase().includes(q)));
  }, [detalle, etapa, busqueda, filtroRiesgo]);

  const datosEscala = grados.map(g => ({ curso: g.etiqueta, ...Object.fromEntries(porcentajesEscala(g).map(e => [e.c, e.n])) }));
  const datosEvol = evolucion.map(e => ({ curso: e.grado, 'Trimestre 1': e.t1 === null ? null : Number(e.t1), 'Trimestre 2': e.t2 === null ? null : Number(e.t2), 'Trimestre 3': e.t3 === null ? null : Number(e.t3) }));

  function exportar() {
    const f2 = t => ({ Estudiantes: t.estudiantes ?? '', Promedio: t.promedio ?? '', Aprobados: t.aprobados, Supletorio: t.supletorio, Reprobados: t.reprobados, 'En curso': t.en_curso, '% aprobación': t.pctAprobacion ?? '', DA: t.da, AA: t.aa, PA: t.pa, NA: t.na });
    if (!colegioId) {
      descargarLibro('estadisticas-calificaciones-colegios.xlsx', [
        { nombre: 'Colegios', filas: lista.map(c => ({ Colegio: c.nombre, ...f2(c), Paralelos: c.paralelos })) }
      ]);
      return;
    }
    const base = `estadisticas-calificaciones-${(nombreColegio || 'colegio').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`;
    descargarLibro(`${base}.xlsx`, [
      { nombre: 'Resumen', filas: [{ Colegio: nombreColegio, ...f2({ ...totalColegio, estudiantes: estudiantesColegio }) }] },
      { nombre: 'Por curso', filas: grados.map(g => ({ Curso: g.etiqueta, ...f2(g) })) },
      { nombre: 'Por materia', filas: materias.map(m => ({ Materia: m.etiqueta, ...f2(m) })) },
      { nombre: 'Por docente', filas: docentes.map(d => ({ Docente: d.etiqueta, Cargas: d.cargas, ...f2(d) })) },
      { nombre: 'Curso y materia', filas: cargasFilas.map(f => ({ Curso: f.grado, Paralelo: f.paralelo, Materia: f.materia, Docente: f.docente || '', ...f2(f) })) },
      { nombre: 'En riesgo', filas: riesgo.map(f => ({ Estudiante: `${f.apellidos} ${f.nombres}`, Curso: `${f.grado} ${f.paralelo}`, Materia: f.materia, Docente: f.docente || '', T1: f.t1 ?? '', T2: f.t2 ?? '', T3: f.t3 ?? '', Promedio: f.promedio ?? '', Condición: condicionRiesgo(f) })) }
    ]);
  }

  const titulo = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
      <div>
        <h2 style={{ margin: 0 }}><span className="ti ti-chart-bar" /> Estadísticas de calificaciones</h2>
        <p style={{ color: 'var(--slate)', margin: '4px 0 0', fontSize: 13 }}>
          {colegioId ? <>Colegio: <strong>{nombreColegio}</strong> · EGB Superior (8vo a 10mo) y Bachillerato</> : 'Panorama de todos los colegios · EGB Superior (8vo a 10mo) y Bachillerato'}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {esGlobal && colegioId && <button className="btn btn-secondary" onClick={() => setColegioId('')}>← Todos los colegios</button>}
        <button className="btn btn-secondary" onClick={exportar} disabled={colegioId ? !detalle : !lista.length}>⬇️ Excel</button>
      </div>
    </div>
  );

  const filtros = (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="cb" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {esGlobal && (
          <div style={{ flex: '1 1 280px', maxWidth: 420 }}>
            <div className="fl">Colegio</div>
            <BuscadorInstitucion instituciones={opcionesColegio} value={colegioId} onChange={id => setColegioId(id || '')} cargando={cargandoGlobal} />
          </div>
        )}
        <div>
          <div className="fl">Etapa</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['', ...ETAPAS].map(e => <button key={e || 'todas'} className={'btn btn-sm ' + (etapa === e ? 'btn-primary' : 'btn-secondary')} onClick={() => setEtapa(e)}>{e || 'Todas'}</button>)}
          </div>
        </div>
        <div style={{ flex: '1 1 260px' }}><Leyenda /></div>
      </div>
      <div style={{ padding: '0 16px 12px', fontSize: 12, color: 'var(--slate)' }}>
        Regla: promedio de los 3 trimestres · aprobado ≥ 7 · supletorio de 4,01 a 6,99 (se aprueba con 7 o más) · reprobado &lt; 4,01. Las materias con menos de 3 trimestres figuran “En curso”.
      </div>
    </div>
  );

  if (!esGlobal && !institucion?.id && !cargandoGlobal) return <div className="card cb">Tu usuario no tiene un plantel asignado.</div>;

  // ── Panel global: todos los colegios ──
  if (esGlobal && !colegioId) {
    const q = busqueda.trim().toLowerCase();
    const filtrados = lista.filter(c => !q || c.nombre.toLowerCase().includes(q)).sort((a, b) => (b.promedio ?? -1) - (a.promedio ?? -1));
    const visibles = verTodos ? filtrados : filtrados.slice(0, 30);
    return (
      <div>
        {titulo}{filtros}
        {error && <div className="lerr" style={{ display: 'flex', marginBottom: 10 }}>{error}</div>}
        {cargandoGlobal ? <div className="card cb">Cargando estadísticas de los colegios…</div> : !lista.length ? (
          <div className="card cb">Todavía no hay calificaciones registradas en ningún colegio.</div>
        ) : (
          <>
            <KPIs t={totalGlobal} estudiantes={estudiantesGlobal} colegios={lista.length} />
            <div className="card">
              <div className="ch" style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <h3>Colegios ({filtrados.length})</h3>
                <input className="fc" style={{ maxWidth: 260 }} placeholder="Filtrar por nombre…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
              </div>
              <div className="cb" style={{ padding: 0 }}>
                <TablaResumen filas={visibles} titulo="Colegio" onFila={c => setColegioId(c.id)} />
                {filtrados.length > 30 && <div style={{ padding: 10, textAlign: 'center' }}><button className="btn btn-ghost btn-sm" onClick={() => setVerTodos(v => !v)}>{verTodos ? 'Ver solo los 30 primeros' : `Ver los ${filtrados.length} colegios`}</button></div>}
              </div>
              <div style={{ padding: '0 16px 12px', fontSize: 12, color: 'var(--slate)' }}>Toca un colegio para ver su detalle por curso, materia y docente.</div>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Detalle de un colegio ──
  const TABS = [['resumen', 'Resumen'], ['cursos', 'Cursos y materias'], ['docentes', 'Docentes'], ['riesgo', `Estudiantes en riesgo${detalle ? ` (${detalle.riesgo.filter(f => !etapa || f.etapa === etapa).length})` : ''}`]];
  return (
    <div>
      {titulo}{filtros}
      {error && <div className="lerr" style={{ display: 'flex', marginBottom: 10 }}>{error}</div>}
      {cargando && <div className="card cb">Cargando calificaciones del colegio…</div>}
      {detalle && !cargando && (!filasDetalle.length ? (
        <div className="card cb">Este colegio todavía no tiene calificaciones registradas{etapa ? ` en ${etapa}` : ''}.</div>
      ) : (
        <>
          <KPIs t={totalColegio} estudiantes={estudiantesColegio} />
          <div className="tabs">{TABS.map(([k, t]) => <button key={k} className={'tab' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{t}</button>)}</div>

          {tab === 'resumen' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12, marginBottom: 12 }}>
                <div className="card"><div className="ch"><h3>Escala por curso (registros alumno-materia)</h3></div>
                  <div className="cb" style={{ height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={datosEscala}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="curso" fontSize={11} /><YAxis fontSize={11} allowDecimals={false} /><Tooltip /><Legend />
                        {ESCALAS.map(e => <Bar key={e.c} dataKey={e.c} stackId="a" fill={e.color} />)}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="card"><div className="ch"><h3>Promedio por trimestre y curso</h3></div>
                  <div className="cb" style={{ height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={datosEvol}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="curso" fontSize={11} /><YAxis domain={[0, 10]} fontSize={11} /><Tooltip /><Legend />
                        <Bar dataKey="Trimestre 1" fill="#93c5fd" /><Bar dataKey="Trimestre 2" fill="#3b82f6" /><Bar dataKey="Trimestre 3" fill="#1d4ed8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
              <div className="card"><div className="ch"><h3>Por curso</h3></div><div className="cb" style={{ padding: 0 }}><TablaResumen filas={grados} titulo="Curso" /></div></div>
              <div className="card" style={{ marginTop: 12 }}><div className="ch"><h3>Por materia</h3></div><div className="cb" style={{ padding: 0 }}><TablaResumen filas={materias} titulo="Materia" /></div></div>
            </>
          )}

          {tab === 'cursos' && (
            <div className="card"><div className="ch"><h3>Curso, paralelo y materia</h3></div>
              <div className="cb" style={{ padding: 0 }}>
                <TablaResumen filas={cargasFilas.map(f => ({ ...f, etiqueta: `${f.grado} ${f.paralelo} · ${f.materia}` }))} titulo="Curso · materia" extra={{ titulo: 'Docente', valor: f => f.docente || '—' }} />
              </div>
            </div>
          )}

          {tab === 'docentes' && (
            <div className="card"><div className="ch"><h3>Rendimiento por docente</h3></div>
              <div className="cb" style={{ padding: 0 }}>
                <TablaResumen filas={docentes} titulo="Docente" extra={{ titulo: 'Cargas', valor: f => `${f.cargas} materia(s)/paralelo(s)` }} />
              </div>
              <div style={{ padding: '0 16px 12px', fontSize: 12, color: 'var(--slate)' }}>Ordenado del promedio más bajo al más alto, para priorizar el acompañamiento académico.</div>
            </div>
          )}

          {tab === 'riesgo' && (
            <div className="card">
              <div className="ch" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                <h3>Estudiantes en riesgo ({riesgo.length})</h3>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <select className="fc" value={filtroRiesgo} onChange={e => setFiltroRiesgo(e.target.value)}>
                    <option value="">Todos</option><option value="reprobado">Reprobados</option><option value="supletorio">Supletorio</option><option value="en_curso">En riesgo durante el año</option>
                  </select>
                  <input className="fc" placeholder="Estudiante, materia, docente…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
                </div>
              </div>
              <div className="cb" style={{ padding: 0, overflowX: 'auto' }}>
                <table className="data">
                  <thead><tr><th>Estudiante</th><th>Curso</th><th>Materia</th><th>Docente</th><th>T1</th><th>T2</th><th>T3</th><th>Promedio</th><th>Condición</th></tr></thead>
                  <tbody>
                    {riesgo.slice(0, 300).map((f, i) => (
                      <tr key={`${f.estudiante_id}-${f.materia}-${i}`}>
                        <td><strong>{f.apellidos} {f.nombres}</strong></td><td>{f.grado} {f.paralelo}</td><td>{f.materia}</td><td style={{ fontSize: 12, color: 'var(--slate)' }}>{f.docente || '—'}</td>
                        <td>{notaTxt(f.t1)}</td><td>{notaTxt(f.t2)}</td><td>{notaTxt(f.t3)}</td><td><strong>{notaTxt(f.promedio)}</strong></td>
                        <td><Chip estado={f.estado} texto={condicionRiesgo(f)} /></td>
                      </tr>
                    ))}
                    {!riesgo.length && <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--slate)', padding: 18 }}>No hay estudiantes en esta condición.</td></tr>}
                  </tbody>
                </table>
                {riesgo.length > 300 && <div style={{ padding: 10, fontSize: 12, color: 'var(--slate)' }}>Se muestran los 300 con promedio más bajo; descarga el Excel para ver los {riesgo.length}.</div>}
              </div>
            </div>
          )}
        </>
      ))}
    </div>
  );
}
