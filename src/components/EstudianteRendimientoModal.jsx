import React, { useEffect, useMemo, useState } from 'react';
import { fetchDetalleEstudianteCalificaciones, guardarSeguimientoAlerta } from '../lib/data.js';
import { parcialDesdeActividades, enAlerta, fmtNota, etiquetaSemana } from '../lib/rendimiento.js';
import GraficoLineas from './GraficoLineas.jsx';
import { ChipNota } from './GraficosRendimiento.jsx';

const overlay = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 500, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '4vh 12px', overflowY: 'auto', overscrollBehavior: 'contain' };
const caja = { background: 'var(--white, #fff)', borderRadius: 14, width: '100%', maxWidth: 940, boxShadow: '0 20px 50px rgba(0,0,0,.3)' };
export const ESTADOS_SEG = { pendiente: ['Pendiente', '#dc2626'], en_atencion: ['En atención', '#d97706'], resuelto: ['Resuelto', '#15803d'] };

export function ChipSeguimiento({ estado }) {
  const [t, c] = ESTADOS_SEG[estado] || ['Sin seguimiento', '#64748b'];
  return <span style={{ background: c + '1a', color: c, border: `1px solid ${c}44`, borderRadius: 999, padding: '1px 9px', fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{t}</span>;
}

function Seguimiento({ estudianteId, cargaId, trimestre, inicial, onGuardado }) {
  const [estado, setEstado] = useState(inicial?.estado || 'pendiente');
  const [nota, setNota] = useState(inicial?.nota || '');
  const [guardando, setGuardando] = useState(false); const [msg, setMsg] = useState('');
  async function guardar() {
    setGuardando(true); setMsg('');
    try { await guardarSeguimientoAlerta({ estudianteId, cargaId, trimestre, estado, nota }); setMsg('Guardado'); onGuardado?.({ cargaId, estado, nota }); }
    catch (e) { setMsg(e.message || 'No se pudo guardar'); }
    setGuardando(false);
  }
  return (
    <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: 'var(--page, #f1f5f9)', display: 'grid', gap: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 700 }}>Seguimiento de esta alerta</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {Object.entries(ESTADOS_SEG).map(([k, [t, c]]) => (
          <button key={k} type="button" onClick={() => setEstado(k)} className="chip" style={{ cursor: 'pointer', border: `1px solid ${estado === k ? c : 'var(--line)'}`, background: estado === k ? c + '1f' : 'var(--white)', color: estado === k ? c : 'var(--ink3)', fontWeight: estado === k ? 800 : 500 }}>{t}</button>
        ))}
      </div>
      <textarea className="fc" rows={2} value={nota} onChange={e => setNota(e.target.value)} placeholder="Acción tomada o plan de apoyo (tutoría, refuerzo, llamada al representante…)" maxLength={500} />
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button className="btn btn-primary btn-sm" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar seguimiento'}</button>
        {msg && <span style={{ fontSize: 12, color: msg === 'Guardado' ? 'var(--green)' : 'var(--red)' }}>{msg}</span>}
      </div>
    </div>
  );
}

export default function EstudianteRendimientoModal({ fila, trimestre, onClose, onSeguimiento, onFicha }) {
  const [datos, setDatos] = useState(null); const [error, setError] = useState('');
  useEffect(() => {
    let activo = true;
    fetchDetalleEstudianteCalificaciones(fila.estudiante_id, trimestre).then(d => { if (activo) setDatos(d); }).catch(e => { if (activo) setError(e.message || 'No se pudo cargar el detalle.'); });
    return () => { activo = false; };
  }, [fila.estudiante_id, trimestre]);
  useEffect(() => { const k = e => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);

  const materias = useMemo(() => (datos?.materias || []).map(m => ({ ...m, ...parcialDesdeActividades(m.actividades) })).sort((a, b) => (a.parcial ?? 99) - (b.parcial ?? 99)), [datos]);
  const segPorCarga = fila.seguimientos || {};

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={caja} role="dialog" aria-modal="true" aria-label="Rendimiento del estudiante">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{fila.apellidos} {fila.nombres}</div>
            <div style={{ fontSize: 12.5, color: 'var(--slate)' }}>{fila.cedula || 'Sin cédula'} · {fila.curso} {fila.paralelo} · Trimestre {trimestre.replace('T', '')}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-start', flexWrap: 'wrap' }}>
            {onFicha && <button className="btn btn-primary btn-sm" onClick={onFicha}>📄 Oficio / ficha de seguimiento</button>}
            <button className="btn btn-ghost btn-sm" onClick={onClose}>✕ Cerrar</button>
          </div>
        </div>
        <div style={{ padding: 20, display: 'grid', gap: 14 }}>
          {error && <div style={{ color: 'var(--red)' }}>{error}</div>}
          {!datos && !error && <div style={{ color: 'var(--slate)' }}>Cargando…</div>}
          {datos && !materias.length && <div style={{ color: 'var(--slate)' }}>Este estudiante no tiene materias con notas en este trimestre.</div>}
          {materias.map(m => {
            const alerta = enAlerta(m.parcial); const semanas = m.semanas || [];
            return (
              <div key={m.carga_id} className="card" style={{ margin: 0, padding: 14, borderLeft: `4px solid ${alerta ? '#dc2626' : m.parcial === null ? 'var(--line)' : '#15803d'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{m.materia}{m.area ? <span style={{ fontWeight: 500, color: 'var(--slate)', fontSize: 12 }}> · {m.area}</span> : null}</div>
                    <div style={{ fontSize: 12, color: 'var(--slate)' }}>Docente: {m.docente || '—'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <ChipNota valor={m.parcial} grande />
                    <div style={{ fontSize: 11, color: 'var(--slate)', marginTop: 3 }}>Formativa {fmtNota(m.formativo)} · Sumativa/proyecto {fmtNota(m.sumativo)}</div>
                  </div>
                </div>
                {m.actividades.length === 0 ? <div style={{ fontSize: 12.5, color: 'var(--slate)', marginTop: 8 }}>Aún sin actividades calificadas.</div> : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14, marginTop: 10 }}>
                    <div>
                      <table className="data" style={{ width: '100%' }}>
                        <thead><tr><th>Actividad</th><th>Notas</th></tr></thead>
                        <tbody>
                          {Object.values(m.actividades.reduce((acc, a) => { const k = `${a.tipo}|${a.grupo}`; (acc[k] = acc[k] || { nombre: a.nombre, tipo: a.tipo, notas: [] }).notas.push(a); return acc; }, {})).map(g => (
                            <tr key={g.nombre + g.tipo}>
                              <td style={{ fontSize: 12.5 }}>{g.nombre}{g.tipo === 'sum' ? <span style={{ marginLeft: 6, fontSize: 10.5, color: 'var(--brand)' }}>sumativa</span> : null}</td>
                              <td>{g.notas.map((a, i) => <span key={i} style={{ display: 'inline-block', margin: '1px 3px 1px 0', padding: '0 7px', borderRadius: 6, fontSize: 12, fontWeight: 700, background: enAlerta(a.valor) ? '#fee2e2' : '#dcfce7', color: enAlerta(a.valor) ? '#b91c1c' : '#15803d' }} title={a.fecha}>{fmtNota(a.valor)}</span>)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div>
                      <div style={{ fontSize: 11.5, color: 'var(--slate)', marginBottom: 2 }}>Promedio de lo calificado cada semana</div>
                      {semanas.length >= 2
                        ? <GraficoLineas titulo={`Evolución semanal de ${m.materia}`} alto={150} cadaX={Math.max(1, Math.ceil(semanas.length / 4))} umbral={70} umbralTexto="7" fmtY={g => String(g / 10)}
                            etiquetas={semanas.map(s => etiquetaSemana(s[0]))} series={[{ id: 's', label: 'Promedio', color: alerta ? '#dc2626' : '#15803d', puntos: semanas.map(s => ({ pct: Number(s[1]) * 10, texto: fmtNota(s[1]) })) }]} />
                        : <div style={{ fontSize: 12.5, color: 'var(--slate)', padding: '20px 0' }}>La tendencia aparece cuando haya notas de 2 semanas distintas.</div>}
                    </div>
                  </div>
                )}
                {alerta && <Seguimiento estudianteId={fila.estudiante_id} cargaId={m.carga_id} trimestre={trimestre} inicial={segPorCarga[m.carga_id]} onGuardado={onSeguimiento} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
