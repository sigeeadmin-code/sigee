import React, { useEffect, useMemo, useState } from 'react';
import { fetchHistorialAsistenciaEstudiante } from '../lib/data.js';
import { historialDesdeInicio } from '../lib/historialAsistencia.js';
import { fechaCorta } from '../lib/fichaAsistencia.js';

const COLOR_DIA = { falta: ['#fee2e2', '#b91c1c', 'Falta'], justificada: ['#dbeafe', '#1d4ed8', 'Justificada'], atraso: ['#fef3c7', '#b45309', 'Atraso'], presente: ['#dcfce7', '#15803d', 'Presente'] };
const COLOR_ESTADO = { ausente: '#b91c1c', justificado: '#1d4ed8', atraso: '#b45309', presente: '#15803d' };
const NOMBRE_ESTADO = { ausente: 'falta', justificado: 'justificada', atraso: 'atraso', presente: 'presente' };
const pct = v => (v === null || v === undefined ? '—' : `${String(v).replace('.', ',')}%`);
const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

const Tarjeta = ({ valor, etiqueta, sub, color }) => (
  <div className="card" style={{ margin: 0, padding: '10px 14px', flex: '1 1 130px', borderTop: `3px solid ${color}` }}>
    <div style={{ fontSize: 22, fontWeight: 800, color }}>{valor}</div>
    <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate)' }}>{etiqueta}</div>
    {sub && <div style={{ fontSize: 11, color: 'var(--slate)' }}>{sub}</div>}
  </div>
);

/**
 * Reporte e historial de asistencia de un estudiante, solo lectura, desde el inicio de clases.
 * Se usa en las cuentas de estudiante y de representante (la visibilidad la limita la RLS de Supabase).
 */
export default function HistorialAsistencia({ estudianteId, institucionId, titulo = 'Asistencia y faltas' }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState('dias');
  const [soloNovedad, setSoloNovedad] = useState(true);

  useEffect(() => {
    let activo = true;
    if (!estudianteId) { setDatos(null); setCargando(false); return undefined; }
    setCargando(true); setError('');
    fetchHistorialAsistenciaEstudiante(institucionId, estudianteId)
      .then(d => { if (activo) setDatos(d); })
      .catch(e => { if (activo) { setError(e.message || 'No se pudo cargar el historial.'); setDatos(null); } })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [estudianteId, institucionId]);

  const h = useMemo(() => (datos ? historialDesdeInicio(datos.registros, datos.eventos, hoyISO()) : null), [datos]);
  const diasMostrados = h ? (soloNovedad ? h.dias.filter(d => d.estado !== 'presente') : h.dias) : [];

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="ch"><h3>{titulo}</h3></div>
      <div className="cb">
        {cargando && <p style={{ fontSize: 13, color: 'var(--slate)', margin: 0 }}>Cargando historial…</p>}
        {error && <div className="lerr" style={{ display: 'flex' }}>{error}</div>}
        {h && !cargando && (
          <>
            <div style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 10 }}>
              {h.inicio ? <>Desde el inicio de clases ({fechaCorta(h.inicio)}): <strong style={{ color: 'var(--ink, inherit)' }}>{h.comparativo.texto}</strong></> : 'Aún no hay asistencia registrada.'}
              {h.comparativo.sinRegistro > 0 && <> · {h.comparativo.sinRegistro} {h.comparativo.sinRegistro === 1 ? 'día lectivo' : 'días lectivos'} sin asistencia registrada</>}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              <Tarjeta valor={pct(h.resumen.pctAsistencia)} etiqueta="Asistencia" sub={`${h.resumen.dias} días con registro`} color="#2563eb" />
              <Tarjeta valor={h.resumen.faltas} etiqueta="Faltas" sub={`${pct(h.resumen.pctFaltas)} · injustificadas`} color="#dc2626" />
              <Tarjeta valor={h.resumen.justificadas} etiqueta="Justificadas" sub="días" color="#1d4ed8" />
              <Tarjeta valor={h.resumen.atrasos} etiqueta="Atrasos" sub="días" color="#d97706" />
              <Tarjeta valor={h.comparativo.diasLectivos} etiqueta="Días lectivos" sub="desde el inicio" color="#475569" />
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {[['dias', `Historial (${h.dias.length})`], ['materias', `Por materia (${h.porMateria.length})`], ['justificaciones', `Justificaciones (${datos.justificaciones.length})`]].map(([k, t]) =>
                <button key={k} className={'btn btn-sm ' + (tab === k ? 'btn-primary' : 'btn-secondary')} onClick={() => setTab(k)}>{t}</button>)}
            </div>

            {tab === 'dias' && (
              <div style={{ overflowX: 'auto' }}>
                <label style={{ fontSize: 12.5, display: 'flex', gap: 6, marginBottom: 8 }}><input type="checkbox" checked={soloNovedad} onChange={e => setSoloNovedad(e.target.checked)} /> Solo días con falta, justificación o atraso</label>
                <table className="tbl" style={{ width: '100%' }}>
                  <thead><tr><th>Fecha</th><th>Día</th><th>Estado</th><th>Detalle por materia</th></tr></thead>
                  <tbody>
                    {diasMostrados.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20, color: 'var(--slate)' }}>{h.dias.length ? 'Sin días con novedad.' : 'Sin asistencia registrada.'}</td></tr>}
                    {diasMostrados.map(d => (
                      <tr key={d.fecha}>
                        <td className="mono">{fechaCorta(d.fecha)}</td><td>{d.dia}</td>
                        <td><span style={{ background: COLOR_DIA[d.estado][0], color: COLOR_DIA[d.estado][1], borderRadius: 999, padding: '2px 10px', fontWeight: 700, fontSize: 12 }}>{COLOR_DIA[d.estado][2]}</span></td>
                        <td style={{ fontSize: 12.5 }}>
                          {d.estado === 'presente' ? `Presente en las ${d.detalle.length} clases` : d.detalle.filter(x => x.estado !== 'presente').map((x, i) => (
                            <span key={i} style={{ marginRight: 10, color: COLOR_ESTADO[x.estado] }}>{x.materia} <em>({NOMBRE_ESTADO[x.estado] || x.estado})</em>{x.observacion ? ` — ${x.observacion}` : ''}</span>))}
                        </td>
                      </tr>))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === 'materias' && (
              <div style={{ overflowX: 'auto' }}>
                <table className="tbl" style={{ width: '100%' }}>
                  <thead><tr><th>Materia</th><th>Clases</th><th>Presente</th><th>Atraso</th><th>Faltas</th><th>Justif.</th><th>% asist.</th></tr></thead>
                  <tbody>
                    {h.porMateria.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 20, color: 'var(--slate)' }}>Sin clases registradas.</td></tr>}
                    {h.porMateria.map(m => (
                      <tr key={m.materia}>
                        <td><strong>{m.materia}</strong></td><td>{m.clases}</td><td>{m.presentes}</td><td>{m.atrasos}</td>
                        <td style={{ fontWeight: 700, color: m.faltas ? '#b91c1c' : undefined }}>{m.faltas}</td><td>{m.justificadas}</td><td>{pct(m.pct)}</td>
                      </tr>))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === 'justificaciones' && (
              <div style={{ overflowX: 'auto' }}>
                <table className="tbl" style={{ width: '100%' }}>
                  <thead><tr><th>Fecha de la falta</th><th>Motivo</th><th>Estado</th></tr></thead>
                  <tbody>
                    {datos.justificaciones.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', padding: 20, color: 'var(--slate)' }}>Aún no hay justificaciones.</td></tr>}
                    {datos.justificaciones.map(j => <tr key={j.id}><td className="mono">{fechaCorta(j.fecha)}</td><td style={{ fontSize: 12.5 }}>{j.motivo || '—'}</td><td>{j.estado}</td></tr>)}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
