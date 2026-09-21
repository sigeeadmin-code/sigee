import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useSession } from '../lib/SessionContext.jsx';
import { fetchReporteInstitucional, fetchResumenAsistenciaPorDocente } from '../lib/data.js';

function haceDias(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
function hoyISO() { return new Date().toISOString().slice(0, 10); }

export default function ReportesAsistencia() {
  const { institucion } = useSession();
  const institucionId = institucion?.id;
  const navigate = useNavigate();

  const [periodo, setPeriodo] = useState('semana');
  const [filas, setFilas] = useState([]);
  const [porDocente, setPorDocente] = useState([]);
  const [loading, setLoading] = useState(true);
  const [soloAdvertencias, setSoloAdvertencias] = useState(true);
  const [buscarCurso, setBuscarCurso] = useState('');
  const [vista, setVista] = useState('estudiantes'); // estudiantes | docentes

  const { desde, hasta } = useMemo(() => ({
    desde: haceDias(periodo === 'semana' ? 7 : 30),
    hasta: hoyISO()
  }), [periodo]);

  const cargar = useCallback(async () => {
    if (!institucionId) return;
    setLoading(true);
    const [rows, pd] = await Promise.all([
      fetchReporteInstitucional(institucionId, desde, hasta),
      fetchResumenAsistenciaPorDocente(institucionId, desde, hasta)
    ]);
    setFilas(rows);
    setPorDocente(pd);
    setLoading(false);
  }, [institucionId, desde, hasta]);

  useEffect(() => { cargar(); }, [cargar]);

  const cursosDisponibles = [...new Set(filas.map(f => f.curso).filter(Boolean))].sort();
  const filtradas = filas.filter(f => (!soloAdvertencias || f.advertencia) && (!buscarCurso || f.curso === buscarCurso));

  const totalAdvertencias = filas.filter(f => f.advertencia).length;
  const totales = filas.reduce((acc, a) => ({
    presente: acc.presente + a.presente, atraso: acc.atraso + a.atraso, ausente: acc.ausente + a.ausente, justificado: acc.justificado + a.justificado
  }), { presente: 0, atraso: 0, ausente: 0, justificado: 0 });
  const datosGrafico = [
    { name: 'Presente', value: totales.presente, color: '#22c55e' },
    { name: 'Atraso', value: totales.atraso, color: '#f59e0b' },
    { name: 'Ausente', value: totales.ausente, color: '#ef4444' },
    { name: 'Justificado', value: totales.justificado, color: '#94a3b8' }
  ].filter(d => d.value > 0);

  function irAAvisar() { navigate('/inasistencias'); }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: '0 0 4px' }}>Reportes de asistencia</h2>
          <div style={{ fontSize: 13, color: 'var(--slate)' }}>{institucion?.nombre} · Toda la institución, todos los cursos</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={'btn btn-sm ' + (periodo === 'semana' ? 'btn-primary' : 'btn-secondary')} onClick={() => setPeriodo('semana')}>Reporte semanal</button>
          <button className={'btn btn-sm ' + (periodo === 'mes' ? 'btn-primary' : 'btn-secondary')} onClick={() => setPeriodo('mes')}>Reporte mensual</button>
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--slate)', marginBottom: 14 }}>Del {desde} al {hasta}</div>

      <div className="grid-4" style={{ marginBottom: 14 }}>
        <div className="metric m-green"><div className="m-lbl">Presente</div><div className="m-val">{totales.presente}</div></div>
        <div className="metric m-amber"><div className="m-lbl">Atraso</div><div className="m-val">{totales.atraso}</div></div>
        <div className="metric m-red"><div className="m-lbl">Ausente</div><div className="m-val">{totales.ausente}</div></div>
        <div className="metric m-red"><div className="m-lbl">⚠ Con advertencia</div><div className="m-val">{totalAdvertencias}</div></div>
      </div>

      {datosGrafico.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="ch"><h3>Distribución general del plantel</h3></div>
          <div className="cb" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={datosGrafico} dataKey="value" nameKey="name" outerRadius={80} label>
                  {datosGrafico.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="cb" style={{ fontSize: 13 }}>
          <strong>¿Qué es una "advertencia"?</strong> Un estudiante se marca automáticamente cuando, en el rango elegido,
          acumula <strong>3 o más ausencias</strong> o su asistencia cae <strong>bajo el 80%</strong>. Es un criterio de
          alerta temprana, no un reglamento — ajústalo con dirección si el plantel maneja otro umbral.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button className={'btn btn-sm ' + (vista === 'estudiantes' ? 'btn-primary' : 'btn-secondary')} onClick={() => setVista('estudiantes')}>Por estudiante</button>
        <button className={'btn btn-sm ' + (vista === 'docentes' ? 'btn-primary' : 'btn-secondary')} onClick={() => setVista('docentes')}>Por docente</button>
      </div>

      {vista === 'docentes' ? (
        loading ? <p style={{ fontSize: 13, color: 'var(--slate)' }}>Cargando…</p> : (
          <div className="card"><div className="cb" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="data" style={{ width: '100%' }}>
              <thead><tr><th>Docente</th><th>Presente</th><th>Atraso</th><th>Ausente</th><th>Justificado</th><th>% Asistencia en sus clases</th></tr></thead>
              <tbody>
                {porDocente.map((d, i) => (
                  <tr key={i}>
                    <td><strong>{d.nombre}</strong></td>
                    <td>{d.presente}</td><td>{d.atraso}</td><td>{d.ausente}</td><td>{d.justificado}</td>
                    <td>{d.pct === null ? '—' : <span className={'badge ' + (d.pct >= 90 ? 'b-ok' : d.pct >= 75 ? 'b-warn' : 'b-err')}>{d.pct}%</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div></div>
        )
      ) : (
        <>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={soloAdvertencias} onChange={e => setSoloAdvertencias(e.target.checked)} />
          Mostrar solo con advertencia
        </label>
        <select className="fc" value={buscarCurso} onChange={e => setBuscarCurso(e.target.value)} style={{ width: 200 }}>
          <option value="">Todos los cursos</option>
          {cursosDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--slate)' }}>Cargando…</p>
      ) : filtradas.length === 0 ? (
        <div className="empty"><span className="ti ti-mood-happy" /><p>{soloAdvertencias ? 'Sin estudiantes en alerta en este rango. 🎉' : 'Sin datos para este filtro.'}</p></div>
      ) : (
        <div className="card"><div className="cb" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="data" style={{ width: '100%' }}>
            <thead><tr><th>Estudiante</th><th>Curso</th><th>Presente</th><th>Atraso</th><th>Ausente</th><th>Justificado</th><th>% Asistencia</th><th></th></tr></thead>
            <tbody>
              {filtradas.map(a => (
                <tr key={a.id} style={a.advertencia ? { background: 'var(--redXL, #fef2f2)' } : undefined}>
                  <td><strong>{a.nombre}</strong> {a.advertencia && <span title="Advertencia">⚠️</span>}</td>
                  <td>{a.curso}</td>
                  <td>{a.presente}</td><td>{a.atraso}</td><td>{a.ausente}</td><td>{a.justificado}</td>
                  <td>{a.pct === null ? '—' : <span className={'badge ' + (a.pct >= 90 ? 'b-ok' : a.pct >= 75 ? 'b-warn' : 'b-err')}>{a.pct}%</span>}</td>
                  <td>
                    {a.advertencia && (
                      <button className="btn btn-secondary btn-sm" onClick={irAAvisar}>Ir a avisar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      )}
        </>
      )}
    </div>
  );
}
