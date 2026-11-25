import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { fetchResumenPlantelGlobal, fetchAnalisisCalificaciones } from '../lib/data.js';
import { fetchMatrizEstadisticaPlantel } from '../lib/dataEstadisticaPlantel.js';
import { matrizPorParalelo, totalesMatriz, resumenPorJornada } from '../lib/estadisticaPlantel.js';
import { limpiar, pctAsist } from '../lib/plantelesReales.js';
import AccesoMasivoDocentes from './AccesoMasivoDocentes.jsx';

const fmtPct = v => (v === null || v === undefined ? '—' : `${String(v).replace('.', ',')} %`);

function Tendencia({ puntos }) {
  const validos = puntos.filter(p => p.pct !== null);
  if (!validos.length) return <p style={{ fontSize: 13, color: 'var(--slate)' }}>Sin registros de asistencia en los últimos 14 días.</p>;
  const w = 520, h = 120, pad = 16, minY = 60, maxY = 100;
  const coords = puntos.map((p, i) => ({
    x: pad + (i / (puntos.length - 1 || 1)) * (w - 2 * pad),
    y: p.pct === null ? null : pad + (1 - (Math.max(minY, Math.min(maxY, p.pct)) - minY) / (maxY - minY)) * (h - 2 * pad)
  }));
  let path = '';
  coords.forEach(c => { if (c.y !== null) path += (path ? ' L ' : 'M ') + c.x.toFixed(1) + ' ' + c.y.toFixed(1); });
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" role="img" aria-label="Tendencia de asistencia de los últimos 14 días">
        <path d={path} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((c, i) => c.y !== null && <circle key={i} cx={c.x} cy={c.y} r="3" fill="#2563eb" />)}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--slate)' }}>
        <span>{puntos[0].fecha}</span><span>{puntos[puntos.length - 1].fecha}</span>
      </div>
    </div>
  );
}

/** Selector de plantel para el Admin global: atajos a los colegios con datos + buscador por nombre o AMIE. */
export function SelectorPlantel({ atajos = [], onElegir }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState([]);
  useEffect(() => {
    const t = limpiar(q).replace(/[%,()]/g, ' ');
    if (t.length < 2) { setRes([]); return undefined; }
    const id = setTimeout(() => {
      supabase.from('instituciones').select('id, nombre, amie, canton').eq('activo', true).or(`nombre.ilike.%${t}%,amie.ilike.%${t}%`).order('nombre').limit(12)
        .then(({ data }) => setRes(data || []), () => setRes([]));
    }, 300);
    return () => clearTimeout(id);
  }, [q]);
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="ch"><h3>Ver un plantel en detalle</h3></div>
      <div className="cb" style={{ display: 'grid', gap: 10 }}>
        {atajos.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {atajos.map(p => (
              <button key={p.id} className="btn btn-secondary btn-sm" onClick={() => onElegir(p.id)} title={p.amie ? `AMIE ${p.amie}` : ''}>
                {limpiar(p.nombre)} · {p.docentes} doc. · {p.estudiantes} est.
              </button>
            ))}
          </div>
        )}
        <input className="fc" placeholder="Buscar otro plantel por nombre o AMIE (mínimo 2 letras)…" value={q} onChange={e => setQ(e.target.value)} />
        {res.length > 0 && (
          <div style={{ display: 'grid', gap: 4 }}>
            {res.map(r => (
              <button key={r.id} className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start', textAlign: 'left' }} onClick={() => onElegir(r.id)}>
                {r.amie ? `${r.amie} · ` : ''}{limpiar(r.nombre)}{r.canton ? ` — ${r.canton}` : ''}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ etiqueta, valor, sub, clase = 'm-blue' }) {
  return (
    <div className={`metric ${clase}`}>
      <div className="m-lbl">{etiqueta}</div>
      <div className="m-val">{valor}</div>
      <div className="m-sub">{sub}</div>
    </div>
  );
}

/** Panel de un plantel para el Admin global: plantilla de docentes, estudiantes por curso, estadísticas AMIE,
 *  asistencia y alertas de calificaciones. Solo lectura; todo se pide filtrado por el plantel elegido. */
export default function PanelPlantelGlobal({ plantelId, onVolver }) {
  const [r, setR] = useState(null);
  const [cal, setCal] = useState(null);
  const [amie, setAmie] = useState(null);
  const [errores, setErrores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busq, setBusq] = useState('');
  const [darAcceso, setDarAcceso] = useState(false);

  const cargar = async () => {
    setCargando(true); setErrores([]); setR(null); setCal(null); setAmie(null);
    const errs = [];
    const [res, calif, mat] = await Promise.all([
      fetchResumenPlantelGlobal(plantelId).catch(e => { errs.push(`Resumen del plantel: ${e.message}`); return null; }),
      fetchAnalisisCalificaciones(plantelId).catch(e => { errs.push(`Alertas de calificaciones: ${e.message}`); return null; }),
      fetchMatrizEstadisticaPlantel(plantelId).catch(e => { errs.push(`Estadísticas AMIE: ${e.message}`); return null; })
    ]);
    setR(res); setCal(calif); setAmie(mat); setErrores(errs); setCargando(false);
  };
  useEffect(() => { cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [plantelId]);

  const docentes = useMemo(() => {
    const t = limpiar(busq).toLowerCase();
    return (r?.docentes || []).filter(d => !t || `${d.nombre} ${d.cargo || ''} ${d.especialidad || ''}`.toLowerCase().includes(t));
  }, [r, busq]);

  const matriz = useMemo(() => (amie?.filas ? matrizPorParalelo(amie.filas) : []), [amie]);
  const totAmie = useMemo(() => totalesMatriz(matriz), [matriz]);
  const jornadas = useMemo(() => resumenPorJornada(matriz), [matriz]);

  const cabecera = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
      <div>
        <div style={{ fontSize: 12, color: 'var(--slate)' }}>Panel de dirección · plantel seleccionado</div>
        <h2 style={{ margin: '2px 0' }}>{r ? limpiar(r.plantel.nombre) : 'Cargando plantel…'}</h2>
        {r && <div style={{ fontSize: 13, color: 'var(--slate)' }}>
          {r.plantel.amie ? `AMIE ${r.plantel.amie}` : 'Sin AMIE'}{r.plantel.canton ? ` · ${r.plantel.canton}` : ''}{r.plantel.provincia ? `, ${r.plantel.provincia}` : ''}{r.plantel.sostenimiento ? ` · ${r.plantel.sostenimiento}` : ''}
          {!r.plantel.activo && ' · INACTIVO'}
        </div>}
      </div>
      <button className="btn btn-secondary" onClick={onVolver}>← Volver al panorama global</button>
    </div>
  );

  if (cargando) return <div>{cabecera}<p style={{ fontSize: 13, color: 'var(--slate)' }}>Cargando docentes, estudiantes, estadísticas, asistencia y alertas…</p></div>;
  if (!r) return (
    <div>{cabecera}
      <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--redL)', color: 'var(--redD)', fontSize: 13 }}>
        No se pudo cargar el plantel. {errores.join(' · ')} <button className="btn btn-secondary btn-sm" onClick={cargar}>Reintentar</button>
      </div>
    </div>
  );

  const t = r.totales;
  const a30 = r.asistencia?.ultimos_30 || {};
  const aHoy = r.asistencia?.hoy || {};
  const pct30 = pctAsist(a30.presente, a30.atraso, a30.ausente);
  const pctHoy = pctAsist(aHoy.presente, aHoy.atraso, aHoy.ausente);
  const puntos = (r.asistencia?.tendencia_14 || []).map(d => ({ fecha: d.fecha, pct: pctAsist(d.presente, d.atraso, d.ausente) }));
  const rc = cal?.resumen;
  const alertas = (cal?.alertas || []).slice(0, 10);

  return (
    <div>
      {cabecera}
      {errores.length > 0 && (
        <div style={{ margin: '0 0 12px', padding: '8px 12px', borderRadius: 8, background: 'var(--amberXL)', color: 'var(--amberD)', fontSize: 12.5 }}>
          No se pudo cargar una parte: {errores.join(' · ')} <button className="btn btn-secondary btn-sm" onClick={cargar}>Reintentar</button>
        </div>
      )}

      <div className="grid-4" style={{ marginBottom: 16 }}>
        <Kpi etiqueta="Docentes" valor={t.docentes} sub={`${t.docentes_con_acceso} con acceso · ${t.docentes_con_carga} con carga`} clase="m-blue" />
        <Kpi etiqueta="Estudiantes activos" valor={t.estudiantes_activos} sub={`${t.estudiantes_registrados} registrados`} clase="m-green" />
        <Kpi etiqueta="Cursos y paralelos" valor={`${t.grados} / ${t.paralelos}`} sub="grados / paralelos" clase="m-teal" />
        <Kpi etiqueta="Asistencia (30 días)" valor={fmtPct(pct30)} sub={r.asistencia?.ultimo_registro ? `último registro ${r.asistencia.ultimo_registro}` : 'sin registros'} clase="m-purple" />
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="ch"><h3>Asistencia</h3></div>
          <div className="cb" style={{ display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 13 }}>
              Hoy ({r.asistencia?.fecha_hoy}): {(aHoy.estudiantes_marcados || 0) > 0
                ? <><strong>{fmtPct(pctHoy)}</strong> · {aHoy.presente} presentes · {aHoy.atraso} atrasos · {aHoy.ausente} faltas · {aHoy.justificado} justificadas</>
                : <span style={{ color: 'var(--slate)' }}>aún sin registros</span>}
            </div>
            <div style={{ fontSize: 13 }}>
              Últimos 30 días: <strong>{fmtPct(pct30)}</strong> · {a30.presente || 0} presentes · {a30.atraso || 0} atrasos · {a30.ausente || 0} faltas · {a30.justificado || 0} justificadas
              {a30.estudiantes_con_registro ? ` · ${a30.estudiantes_con_registro} estudiantes con registro` : ''}
            </div>
            <Tendencia puntos={puntos} />
            <div style={{ fontSize: 11.5, color: 'var(--slate)' }}>Cuenta registros de clase; las justificadas no penalizan el porcentaje.</div>
          </div>
        </div>

        <div className="card">
          <div className="ch"><h3>Alertas de calificaciones</h3></div>
          <div className="cb" style={{ display: 'grid', gap: 8 }}>
            {!rc ? <p style={{ fontSize: 13, color: 'var(--slate)' }}>No se pudo leer el análisis de calificaciones.</p> : (
              <>
                <div style={{ fontSize: 13 }}>
                  Trimestre {cal.trimestre}: <strong>{rc.est_alerta}</strong> estudiante{rc.est_alerta === 1 ? '' : 's'} con nota menor a 7
                  {rc.promedio !== null && rc.promedio !== undefined && <> · promedio {String(rc.promedio).replace('.', ',')}</>}
                  {' '}· {rc.cargas_sin_notas} de {rc.cargas} cargas sin notas
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--slate)' }}>
                  Esta semana {rc.est_alerta_semana} · este mes {rc.est_alerta_mes} · bandas: DA {rc.bandas?.da ?? 0} · AA {rc.bandas?.aa ?? 0} · PA {rc.bandas?.pa ?? 0} · NA {rc.bandas?.na ?? 0}
                </div>
                {alertas.length === 0 ? <p style={{ fontSize: 13, color: 'var(--slate)', margin: 0 }}>Sin alertas con las notas registradas.</p> : (
                  <table className="tbl"><thead><tr><th>Estudiante</th><th>Curso</th><th>Materia</th><th>Parcial</th></tr></thead>
                    <tbody>{alertas.map((x, i) => (
                      <tr key={i}><td>{limpiar(`${x.apellidos || ''} ${x.nombres || ''}`)}</td><td>{x.curso} {x.paralelo}</td><td>{x.materia}</td><td><strong>{x.parcial}</strong></td></tr>
                    ))}</tbody></table>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="ch"><h3>Estadísticas AMIE (matrícula activa)</h3></div>
        <div className="cb">
          {!amie || !matriz.length ? <p style={{ fontSize: 13, color: 'var(--slate)' }}>Sin matrícula activa para calcular la estadística.</p> : (
            <>
              <div style={{ fontSize: 13, marginBottom: 8 }}>
                Matrícula: <strong>{totAmie.total}</strong> · hombres {totAmie.H} · mujeres {totAmie.M}{totAmie.S ? ` · sin dato ${totAmie.S}` : ''} · con discapacidad {totAmie.conDiscapacidad}
                {amie.plantilla && <> · plantilla: {amie.plantilla.docentes} docentes, {amie.plantilla.administrativos} administrativos</>}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {jornadas.map(j => <span key={j.jornada} className="badge b-ok">{j.jornada}: {j.total}</span>)}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="ch"><h3>Estudiantes por curso y paralelo</h3></div>
        <div className="cb" style={{ overflowX: 'auto' }}>
          {r.cursos.length === 0 ? <p style={{ fontSize: 13, color: 'var(--slate)' }}>El plantel aún no tiene cursos creados.</p> : (
            <table className="tbl"><thead><tr><th>Curso</th><th>Par.</th><th>Jornada</th><th>Estudiantes</th><th>H</th><th>M</th><th>Tutor</th></tr></thead>
              <tbody>{r.cursos.map((c, i) => (
                <tr key={i}><td>{c.curso}</td><td>{c.paralelo}</td><td>{c.jornada || '—'}</td><td><strong>{c.estudiantes}</strong></td><td>{c.hombres}</td><td>{c.mujeres}</td><td>{limpiar(c.tutor) || '—'}</td></tr>
              ))}</tbody></table>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="ch" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <h3>Plantilla de docentes ({r.docentes.length})</h3>
          {r.docentes.some(d => d.activo && !d.acceso) && !r.plantel.es_demo && (
            <button className="btn btn-primary btn-sm" onClick={() => setDarAcceso(true)} title="Crea el usuario y la contraseña temporal de los docentes que aún no tienen acceso y descarga el Excel">
              🔑 Dar acceso a los {r.docentes.filter(d => d.activo && !d.acceso).length} docentes sin cuenta
            </button>
          )}
        </div>
        <div className="cb">
          <input className="fc" style={{ marginBottom: 8 }} placeholder="Buscar por nombre, cargo o especialidad…" value={busq} onChange={e => setBusq(e.target.value)} />
          <div style={{ maxHeight: 420, overflow: 'auto' }}>
            <table className="tbl"><thead><tr><th>Docente</th><th>Cargo</th><th>Especialidad</th><th>Situación</th><th>Acceso</th><th>Cargas</th></tr></thead>
              <tbody>{docentes.map(d => (
                <tr key={d.id}>
                  <td>{d.nombre}</td><td>{d.cargo || '—'}</td><td>{d.especialidad || '—'}</td><td>{d.situacion || '—'}</td>
                  <td><span className={`badge ${d.acceso ? 'b-ok' : 'b-warn'}`}>{d.acceso ? 'Con acceso' : 'Sin acceso'}</span></td>
                  <td>{d.cargas}</td>
                </tr>
              ))}</tbody></table>
          </div>
          {docentes.length === 0 && <p style={{ fontSize: 13, color: 'var(--slate)' }}>Ningún docente coincide con la búsqueda.</p>}
        </div>
      </div>
      {darAcceso && (
        <AccesoMasivoDocentes
          institucion={{ id: r.plantel.id, nombre: limpiar(r.plantel.nombre), amie: r.plantel.amie }}
          onClose={() => setDarAcceso(false)}
          onDone={() => { fetchResumenPlantelGlobal(plantelId).then(setR).catch(() => {}); }}   // refresco silencioso: no cierra la ventana donde se descarga el Excel
        />
      )}
    </div>
  );
}
