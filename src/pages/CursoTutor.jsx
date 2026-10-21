import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { fetchDocenteIdDePerfil, fetchCursosComoTutor, fetchAsistenciaParalelos } from '../lib/data.js';
import { analizarEstudiantes, rangoPeriodo, ETIQUETA_CLASE, RACHA_ALERTA, UMBRALES_DEFECTO } from '../lib/asistenciaAnalisis.js';
import { fechaCorta } from '../lib/oficioFaltas.js';
import { normalizar } from '../lib/rendimiento.js';
import { descargarLibro } from '../lib/exportLibro.js';
import AnalisisCalificaciones from './AnalisisCalificaciones.jsx';
import FichasEmitidas from '../components/FichasEmitidas.jsx';
import FichaDocumentoModal from '../components/FichaDocumentoModal.jsx';
import { Dona, BarrasH } from '../components/GraficosRendimiento.jsx';

const COLOR_CLASE = { excelente: '#15803d', buena: '#1d4ed8', en_riesgo: '#d97706', critica: '#dc2626', sin_datos: '#94a3b8' };
const PERIODOS = [['semana', 'Últimos 7 días'], ['mes', 'Este mes'], ['mes_anterior', 'Mes anterior'], ['todo', 'Año lectivo']];

function ChipClase({ clase }) { const c = COLOR_CLASE[clase] || '#64748b'; return <span style={{ background: c + '1a', color: c, border: `1px solid ${c}44`, borderRadius: 999, padding: '1px 9px', fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{ETIQUETA_CLASE[clase] || clase}</span>; }

function Pestanas({ valor, onCambio, items }) {
  return (
    <div role="tablist" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
      {items.map(([k, t, icono]) => (
        <button key={k} role="tab" aria-selected={valor === k} onClick={() => onCambio(k)} className={'btn btn-sm ' + (valor === k ? 'btn-primary' : 'btn-secondary')}><span className={icono} /> {t}</button>
      ))}
    </div>
  );
}

/** Asistencia de los cursos de los que el docente es TUTOR (aparte de sus propias clases). */
function AsistenciaCurso({ institucion, paraleloIds, nombreCurso, onFicha }) {
  const [periodo, setPeriodo] = useState('mes');
  const { desde, hasta } = useMemo(() => rangoPeriodo(periodo), [periodo]);
  const [datos, setDatos] = useState(null); const [error, setError] = useState(''); const [cargando, setCargando] = useState(false);
  const [q, setQ] = useState(''); const [clase, setClase] = useState('');
  const cargar = useCallback(async () => {
    if (!paraleloIds.length) return;
    setCargando(true); setError('');
    try { setDatos(await fetchAsistenciaParalelos(institucion.id, paraleloIds, desde, hasta)); } catch (e) { setError(e.message || 'No se pudo cargar la asistencia del curso.'); setDatos(null); }
    setCargando(false);
  }, [institucion.id, paraleloIds, desde, hasta]);
  useEffect(() => { cargar(); }, [cargar]);

  const filas = useMemo(() => (datos ? analizarEstudiantes(datos.alumnos, datos.registros, UMBRALES_DEFECTO) : []), [datos]);
  const vis = useMemo(() => filas.filter(f => (!clase || f.clase === clase) && (!q.trim() || normalizar(`${f.nombre} ${f.cedula}`).includes(normalizar(q)))), [filas, clase, q]);
  const resumen = useMemo(() => {
    const con = filas.filter(f => f.pctAsistencia !== null && f.pctAsistencia !== undefined);
    const prom = con.length ? Math.round((con.reduce((a, f) => a + f.pctAsistencia, 0) / con.length) * 10) / 10 : null;
    const porClase = Object.fromEntries(['excelente', 'buena', 'en_riesgo', 'critica', 'sin_datos'].map(c => [c, filas.filter(f => f.clase === c).length]));
    return { prom, porClase, racha: filas.filter(f => f.rachaMax >= RACHA_ALERTA).length, faltas: filas.reduce((a, f) => a + (f.faltas || 0), 0), just: filas.reduce((a, f) => a + (f.justificadas || 0), 0), atrasos: filas.reduce((a, f) => a + (f.atrasos || 0), 0) };
  }, [filas]);

  function exportar() {
    descargarLibro(`asistencia_mi_curso_${desde}_a_${hasta}.xlsx`, [{ nombre: 'Asistencia', filas: vis.map(f => ({ Estudiante: f.nombre, Cédula: f.cedula, Curso: f.curso, 'Días con registro': f.dias, Presentes: f.presentes, Atrasos: f.atrasos, 'Faltas injustificadas': f.faltas, Justificadas: f.justificadas, '% asistencia': f.pctAsistencia ?? '', 'Faltas consecutivas (máx.)': f.rachaMax, Clasificación: ETIQUETA_CLASE[f.clase] })), cols: ['Estudiante', 'Cédula', 'Curso', 'Días con registro', 'Presentes', 'Atrasos', 'Faltas injustificadas', 'Justificadas', '% asistencia', 'Faltas consecutivas (máx.)', 'Clasificación'] }]);
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Asistencia de mi curso · {nombreCurso}</div>
          <div style={{ fontSize: 12.5, color: 'var(--slate)' }}>Del {fechaCorta(desde)} al {fechaCorta(hasta)}. Es la asistencia de TODO el curso del que eres tutor, distinta de la que registras en tus propias clases. Las faltas y su justificación se rigen por el reglamento del Ministerio de Educación.</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {PERIODOS.map(([k, t]) => <button key={k} className={'btn btn-sm ' + (periodo === k ? 'btn-primary' : 'btn-secondary')} onClick={() => setPeriodo(k)}>{t}</button>)}
          <button className="btn btn-secondary btn-sm" onClick={exportar} disabled={!filas.length}>⬇️ Excel</button>
        </div>
      </div>
      {error && <div className="card" style={{ padding: 12, color: 'var(--red)' }}>{error}</div>}
      {cargando && !datos && <div className="card" style={{ padding: 18, color: 'var(--slate)' }}>Cargando asistencia…</div>}
      {datos && <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
          {[['Asistencia promedio', resumen.prom === null ? '—' : `${resumen.prom}%`, resumen.prom !== null && resumen.prom < 90 ? '#d97706' : '#15803d'], ['Estudiantes del curso', filas.length, '#1d4ed8'], ['Faltas injustificadas', resumen.faltas, resumen.faltas ? '#dc2626' : '#15803d'], ['Justificadas', resumen.just, '#0369a1'], ['Atrasos', resumen.atrasos, '#d97706'], [`Con ${RACHA_ALERTA}+ faltas seguidas`, resumen.racha, resumen.racha ? '#dc2626' : '#15803d']].map(([t, v, c]) => (
            <div key={t} className="card" style={{ margin: 0, padding: '10px 14px', borderTop: `3px solid ${c}` }}><div style={{ fontSize: 24, fontWeight: 800, color: c }}>{v}</div><div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate)' }}>{t}</div></div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
          <div className="card" style={{ margin: 0, padding: 16 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Situación de asistencia del curso</div>
            <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
              <Dona partes={['excelente', 'buena', 'en_riesgo', 'critica', 'sin_datos'].map(c => ({ id: c, label: ETIQUETA_CLASE[c], valor: resumen.porClase[c], color: COLOR_CLASE[c] }))} centro={resumen.prom === null ? '—' : `${resumen.prom}%`} subcentro="asistencia" />
              <div style={{ display: 'grid', gap: 6, fontSize: 12.5 }}>{['excelente', 'buena', 'en_riesgo', 'critica', 'sin_datos'].map(c => <div key={c}><span style={{ color: COLOR_CLASE[c] }}>●</span> {ETIQUETA_CLASE[c]}: <strong>{resumen.porClase[c]}</strong></div>)}</div>
            </div>
          </div>
          <div className="card" style={{ margin: 0, padding: 16 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Estudiantes con más faltas injustificadas</div>
            <BarrasH vacio="Sin faltas injustificadas en este período." items={[...filas].filter(f => f.faltas > 0).sort((a, b) => b.faltas - a.faltas).slice(0, 7).map(f => ({ etiqueta: f.nombre, valor: Math.min(100, f.pctFaltas ?? 0), texto: `${f.faltas} falta${f.faltas === 1 ? '' : 's'}${f.pctFaltas != null ? ` · ${f.pctFaltas}%` : ''}`, color: COLOR_CLASE[f.clase] }))} />
          </div>
        </div>
        <div className="card" style={{ margin: 0, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <div style={{ fontWeight: 800 }}>Estudiantes del curso</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="fc" style={{ width: 190 }} placeholder="Buscar estudiante…" value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar estudiante" />
              <select className="fc" style={{ width: 'auto' }} value={clase} onChange={e => setClase(e.target.value)} aria-label="Clasificación"><option value="">Todas</option>{['critica', 'en_riesgo', 'buena', 'excelente', 'sin_datos'].map(c => <option key={c} value={c}>{ETIQUETA_CLASE[c]}</option>)}</select>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data" style={{ width: '100%' }}>
              <thead><tr><th>Estudiante</th><th style={{ textAlign: 'center' }}>Días</th><th style={{ textAlign: 'center' }}>Faltas inj.</th><th style={{ textAlign: 'center' }}>Justif.</th><th style={{ textAlign: 'center' }}>Atrasos</th><th style={{ textAlign: 'center' }}>% asist.</th><th>Situación</th><th /></tr></thead>
              <tbody>
                {vis.map(f => (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 600 }}>{f.nombre}<div style={{ fontWeight: 400, fontSize: 11.5, color: 'var(--slate)' }}>{f.cedula}</div></td>
                    <td style={{ textAlign: 'center' }}>{f.dias}</td><td style={{ textAlign: 'center', fontWeight: f.faltas ? 800 : 400, color: f.faltas ? '#dc2626' : undefined }}>{f.faltas}</td>
                    <td style={{ textAlign: 'center' }}>{f.justificadas}</td><td style={{ textAlign: 'center' }}>{f.atrasos}</td><td style={{ textAlign: 'center' }}>{f.pctAsistencia === null || f.pctAsistencia === undefined ? '—' : `${f.pctAsistencia}%`}</td>
                    <td><ChipClase clase={f.clase} />{f.rachaMax >= RACHA_ALERTA && <div style={{ fontSize: 11, color: '#dc2626' }}>{f.rachaMax} faltas seguidas</div>}</td>
                    <td><button className="btn btn-primary btn-sm" onClick={() => onFicha(f, { desde, hasta })}>📄 Fichas y oficios</button></td>
                  </tr>
                ))}
                {!vis.length && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--slate)', padding: 20 }}>{filas.length ? 'Ningún estudiante coincide.' : 'No hay estudiantes matriculados en tu curso.'}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </>}
    </div>
  );
}

export default function CursoTutor() {
  const { institucion, profile, esTutor } = useSession();
  const [tab, setTab] = useState('calificaciones');
  const [cursos, setCursos] = useState(null); const [error, setError] = useState('');
  const [trim, setTrim] = useState('T1');
  const [ficha, setFicha] = useState(null); const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const did = await fetchDocenteIdDePerfil(profile.id);
        const c = did ? await fetchCursosComoTutor(did) : [];
        if (activo) setCursos(c);
      } catch (e) { if (activo) setError(e.message || 'No se pudieron cargar tus cursos.'); }
    })();
    return () => { activo = false; };
  }, [profile?.id]);

  const paraleloIds = useMemo(() => (cursos || []).map(c => c.id), [cursos]);
  const nombreCurso = (cursos || []).map(c => `${c.grados?.nombre || ''} ${c.nombre}${c.jornada ? ' (' + c.jornada + ')' : ''}`.trim()).join(' · ');
  const tutorNombre = `${profile?.apellidos || ''} ${profile?.nombres || ''}`.trim();

  if (!institucion?.id) return <div className="card cb">Selecciona una institución.</div>;
  if (error) return <div className="card" style={{ padding: 16, color: 'var(--red)' }}>{error}</div>;
  if (cursos && !cursos.length) return <div className="card" style={{ padding: 20 }}><h3 style={{ marginTop: 0 }}>Curso tutorado</h3><p style={{ color: 'var(--slate)' }}>No tienes un curso asignado como tutor. Si debería tenerlo, pide a la administración que te asigne como tutor del paralelo.</p></div>;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div>
        <h2 style={{ margin: '0 0 4px' }}>Mi curso como tutor</h2>
        <div style={{ fontSize: 13, color: 'var(--slate)' }}>{cursos ? <>Curso tutorado: <strong>{nombreCurso}</strong>. Aquí ves las estadísticas, la asistencia y las fichas de TODO tu curso; tus propias clases siguen en "Alertas de rendimiento".</> : 'Cargando…'}</div>
      </div>
      <Pestanas valor={tab} onCambio={setTab} items={[['calificaciones', 'Calificaciones del curso', 'ti ti-chart-histogram'], ['asistencia', 'Asistencia del curso', 'ti ti-calendar-check'], ['fichas', 'Fichas emitidas', 'ti ti-clipboard-check']]} />
      {tab === 'calificaciones' && <AnalisisCalificaciones ambito="tutor" />}
      {tab === 'asistencia' && cursos && (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5 }}>
            <span>Trimestre de las notas que irán en la ficha:</span>
            {['T1', 'T2', 'T3'].map(t => <button key={t} className={'btn btn-sm ' + (trim === t ? 'btn-primary' : 'btn-secondary')} onClick={() => setTrim(t)}>{t.slice(1)}</button>)}
          </div>
          <AsistenciaCurso institucion={institucion} paraleloIds={paraleloIds} nombreCurso={nombreCurso} onFicha={(f, rango) => setFicha({ f, rango })} />
        </>
      )}
      {tab === 'fichas' && <FichasEmitidas institucion={institucion} puedeRevisar={false} recargar={recarga} titulo="Fichas y oficios de mi curso" />}
      {ficha && (
        <FichaDocumentoModal institucion={institucion} trimestre={trim} tipoInicial="ficha_tutor"
          estudiante={{ id: ficha.f.id, apellidos: ficha.f.apellidos, nombres: ficha.f.nombres, cedula: ficha.f.cedula, curso: ficha.f.curso, paralelo: '', jornada: ficha.f.jornada }} tutorNombreDefault={tutorNombre}
          asistencia={{ dias: ficha.f.dias, presentes: ficha.f.presentes, faltas: ficha.f.faltas, justificadas: ficha.f.justificadas, atrasos: ficha.f.atrasos, pctAsistencia: ficha.f.pctAsistencia, rachaMax: ficha.f.rachaMax }}
          periodoAsistencia={`${fechaCorta(ficha.rango.desde)} al ${fechaCorta(ficha.rango.hasta)}`}
          onClose={() => setFicha(null)} onGuardado={() => setRecarga(n => n + 1)} />
      )}
    </div>
  );
}
