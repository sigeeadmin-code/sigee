import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import {
  guardarHorarioConfig, eliminarBloquesHorario, fetchCargasHorario, actualizarHorasCarga, aplicarHorario
} from '../lib/data.js';
import { construirFranjas, validarJornada, generarHorario, moverEnPropuesta, destinosValidos, DIAS } from '../lib/horarioAuto.js';
import { colorDeMateria } from '../lib/horarioUI.js';

/** Deduce los parámetros del constructor a partir de las franjas vigentes (para precargar el formulario). */
function parametrosDesde(franjas) {
  const aMin = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  const clases = franjas.filter(f => f.tipo === 'clase');
  const primera = clases[0];
  const recreos = [];
  let n = 0;
  franjas.forEach(f => {
    if (f.tipo === 'clase') n++;
    else if (n > 0 && n < clases.length) recreos.push({ despuesDe: n, minutos: aMin(f.fin) - aMin(f.inicio) });
  });
  return {
    inicio: primera?.inicio || '07:00',
    duracion: primera ? aMin(primera.fin) - aMin(primera.inicio) : 40,
    clases: clases.length || 7,
    recreos
  };
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 60, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '4vh 12px', overflowY: 'auto' };
const caja = { background: 'var(--card, #fff)', borderRadius: 14, width: '100%', boxShadow: '0 20px 50px rgba(0,0,0,.25)' };

/* ───────────────────────────── Jornada y recreos ───────────────────────────── */
export function JornadaModal({ franjas, bloquesInst, institucionId, onClose, onSaved }) {
  const { profile } = useSession();
  const [p, setP] = useState(() => parametrosDesde(franjas));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const errores = useMemo(() => validarJornada({ ...p, duracion: Number(p.duracion), clases: Number(p.clases), recreos: p.recreos.map(r => ({ despuesDe: Number(r.despuesDe), minutos: Number(r.minutos) })) }), [p]);
  const vista = useMemo(() => {
    if (errores.length) return [];
    return construirFranjas({ ...p, duracion: Number(p.duracion), clases: Number(p.clases), recreos: p.recreos.map(r => ({ despuesDe: Number(r.despuesDe), minutos: Number(r.minutos) })) });
  }, [p, errores]);

  const etiquetasClase = new Set(vista.filter(f => f.tipo === 'clase').map(f => f.label));
  const huerfanos = bloquesInst.filter(b => !etiquetasClase.has(b.franja));

  const setRecreo = (i, campo, v) => setP(x => ({ ...x, recreos: x.recreos.map((r, k) => (k === i ? { ...r, [campo]: v } : r)) }));
  const agregarRecreo = () => {
    const usados = new Set(p.recreos.map(r => Number(r.despuesDe)));
    let pos = 1;
    while (usados.has(pos) && pos < Number(p.clases)) pos++;
    setP(x => ({ ...x, recreos: [...x.recreos, { despuesDe: pos, minutos: 20 }] }));
  };

  async function guardar() {
    if (errores.length) return;
    if (huerfanos.length && !window.confirm(`Con esta jornada, ${huerfanos.length} clase(s) ya asignadas quedan en horas que dejan de existir y se ELIMINARÁN del horario. ¿Continuar?`)) return;
    setGuardando(true); setError('');
    try {
      await guardarHorarioConfig(institucionId, vista.map(({ inicio, fin, tipo }) => ({ inicio, fin, tipo })), profile.id);
      if (huerfanos.length) await eliminarBloquesHorario(huerfanos.map(b => b.id));
      onSaved();
    } catch (e) { setError(e.message || 'No se pudo guardar la jornada.'); }
    setGuardando(false);
  }

  const num = { width: 74, textAlign: 'center' };
  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget && !guardando) onClose(); }}>
      <div style={{ ...caja, maxWidth: 640 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Jornada y recreos</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={guardando}>✕</button>
        </div>
        <div style={{ padding: 20 }}>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--slate)' }}>
            Define a qué hora empieza la jornada, cuánto dura cada clase y dónde van los recreos (puedes poner varios). Vale para todo el plantel.
          </p>
          <div className="form-grid">
            <div><label className="fl">Hora de inicio</label><input className="fc" type="time" value={p.inicio} onChange={e => setP({ ...p, inicio: e.target.value })} /></div>
            <div><label className="fl">Duración de cada clase (min)</label><input className="fc" type="number" min="20" max="120" value={p.duracion} onChange={e => setP({ ...p, duracion: e.target.value })} /></div>
            <div><label className="fl">Cantidad de clases al día</label><input className="fc" type="number" min="1" max="12" value={p.clases} onChange={e => setP({ ...p, clases: e.target.value })} /></div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <strong style={{ fontSize: 13 }}>☕ Recreos</strong>
              <button className="btn btn-secondary btn-sm" onClick={agregarRecreo}>+ Agregar recreo</button>
            </div>
            {p.recreos.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--slate)', margin: 0 }}>Sin recreos. Agrega uno con el botón.</p>}
            {p.recreos.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8, fontSize: 13, flexWrap: 'wrap' }}>
                <span>Después de la clase</span>
                <input className="fc" type="number" min="1" max={Math.max(1, Number(p.clases) - 1)} style={num} value={r.despuesDe} onChange={e => setRecreo(i, 'despuesDe', e.target.value)} />
                <span>dura</span>
                <input className="fc" type="number" min="5" max="60" style={num} value={r.minutos} onChange={e => setRecreo(i, 'minutos', e.target.value)} />
                <span>min</span>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => setP(x => ({ ...x, recreos: x.recreos.filter((_, k) => k !== i) }))}>Quitar</button>
              </div>
            ))}
          </div>

          {errores.length > 0 && <div style={{ marginTop: 12, fontSize: 13, color: 'var(--red)' }}>{errores.map(e => <div key={e}>• {e}</div>)}</div>}

          {vista.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <strong style={{ fontSize: 13 }}>Así quedará el día</strong>
              <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                {vista.map(f => (
                  <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '5px 10px', borderRadius: 8, background: f.tipo === 'recreo' ? '#fff7ed' : 'var(--page, #f5f7fc)', border: '1px solid ' + (f.tipo === 'recreo' ? '#fed7aa' : 'var(--line)') }}>
                    <span>{f.label}</span><strong>{f.tipo === 'recreo' ? '☕ Recreo' : 'Clase'}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {huerfanos.length > 0 && !errores.length && (
            <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 12.5, color: '#991b1b' }}>
              ⚠ {huerfanos.length} clase(s) ya asignadas caen en horas que no existen con esta jornada y se eliminarán al guardar.
            </div>
          )}
          {error && <div style={{ marginTop: 12, fontSize: 13, color: 'var(--red)' }}>{error}</div>}
        </div>
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button className="btn btn-primary" onClick={guardar} disabled={guardando || errores.length > 0}>{guardando ? 'Guardando…' : 'Guardar jornada'}</button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────── Generación automática ───────────────────────────── */
function GrillaPropuesta({ franjas, bloques, cargaPorId, tomado, setTomado, validos, onMover, motivoUltimo }) {
  const en = (dia, fr) => bloques.find(b => b.dia === dia && b.franja === fr);
  const esValido = (dia, fr) => !!tomado && validos.has(`${dia}|${fr}`);
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data" style={{ width: '100%' }}>
        <thead><tr><th style={{ width: 92 }}></th>{DIAS.map(d => <th key={d} style={{ textAlign: 'center' }}>{d}</th>)}</tr></thead>
        <tbody>
          {franjas.map(f => f.tipo === 'recreo' ? (
            <tr key={f.label}>
              <td style={{ fontSize: 11, color: 'var(--slate)', whiteSpace: 'nowrap' }}>{f.label}</td>
              <td colSpan={DIAS.length} style={{ textAlign: 'center', fontSize: 12, background: '#fff7ed', color: '#9a3412', fontWeight: 700 }}>☕ Recreo</td>
            </tr>
          ) : (
            <tr key={f.label}>
              <td style={{ fontSize: 11, color: 'var(--slate)', whiteSpace: 'nowrap' }}>{f.label}</td>
              {DIAS.map(dia => {
                const b = en(dia, f.label);
                const c = b ? cargaPorId[b.docente_materia_id] : null;
                const cl = c ? colorDeMateria(c.materiaNombre) : null;
                const esOrigen = !!tomado && tomado.dia === dia && tomado.franja === f.label;
                const destino = esValido(dia, f.label);
                const soltar = () => { if (tomado && !esOrigen) onMover(tomado, { dia, franja: f.label }); setTomado(null); };
                return (
                  <td key={dia} style={{ padding: 3 }}
                    onDragOver={e => { if (destino) e.preventDefault(); }}
                    onDrop={e => { e.preventDefault(); soltar(); }}
                    onClick={() => { if (tomado && !esOrigen) soltar(); }}>
                    {c ? (
                      <div
                        draggable={!b.fijo}
                        onDragStart={e => { if (b.fijo) return; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'clase'); setTomado({ dia, franja: f.label }); }}
                        onDragEnd={() => setTomado(null)}
                        onClick={e => { if (b.fijo) return; e.stopPropagation(); if (esOrigen) setTomado(null); else if (tomado) soltar(); else setTomado({ dia, franja: f.label }); }}
                        title={b.fijo ? 'Clase ya guardada: bloqueada en esta propuesta' : 'Arrástrala a otra celda (o haz clic y luego clic en el destino)'}
                        style={{
                          minHeight: 44, borderRadius: 8, padding: '5px 8px', background: cl.bg, cursor: b.fijo ? 'default' : 'grab',
                          border: (esOrigen ? '2px solid var(--brand, #4f46e5)' : '1px solid ' + cl.bd),
                          outline: destino ? '2px dashed #16a34a' : 'none', opacity: esOrigen ? .55 : 1, userSelect: 'none'
                        }}>
                        <div style={{ fontWeight: 700, fontSize: 11.5, color: cl.tx }}>{b.fijo ? '🔒 ' : ''}{c.materiaNombre}</div>
                        <div style={{ fontSize: 10, color: cl.tx, opacity: .8 }}>{c.docenteNombre || '—'}</div>
                      </div>
                    ) : (
                      <div style={{ minHeight: 44, borderRadius: 8, border: '1.5px dashed ' + (destino ? '#16a34a' : 'var(--line)'), background: destino ? 'rgba(22,163,74,.10)' : undefined }} />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {motivoUltimo && <div style={{ marginTop: 8, fontSize: 12.5, color: '#b45309' }}>⚠ {motivoUltimo}</div>}
    </div>
  );
}

export function GeneradorModal({ institucionId, periodoActivo, grados, paraleloActualId, franjas, bloquesInst, onClose, onApplied }) {
  const [alcance, setAlcance] = useState('paralelo'); // 'paralelo' | 'todos'
  const [conservar, setConservar] = useState(true);
  const [cargas, setCargas] = useState([]);
  const [horas, setHoras] = useState({});
  const [cargando, setCargando] = useState(true);
  const [propuesta, setPropuesta] = useState(null);   // { bloques, faltantes, paralelos:[ids], intento }
  const [verParalelo, setVerParalelo] = useState(paraleloActualId);
  const [aplicando, setAplicando] = useState(false);
  const [error, setError] = useState('');
  const [tomado, setTomado] = useState(null);          // clase que se está arrastrando { dia, franja }
  const [historial, setHistorial] = useState([]);      // para deshacer los movimientos manuales
  const [motivo, setMotivo] = useState('');
  const [editadas, setEditadas] = useState(0);

  const clases = franjas.filter(f => f.tipo === 'clase').map(f => f.label);
  const paralelosAll = useMemo(
    () => grados.flatMap(g => g.paralelos.map(p => ({ id: p.id, nombre: `${g.nombre} "${p.nombre}"` }))),
    [grados]
  );
  const nombrePar = Object.fromEntries(paralelosAll.map(p => [p.id, p.nombre]));

  useEffect(() => {
    let activo = true;
    (async () => {
      setCargando(true);
      const cs = await fetchCargasHorario(institucionId, periodoActivo.id, paralelosAll.map(p => p.id));
      if (!activo) return;
      setCargas(cs);
      const slots = clases.length * DIAS.length;
      const porPar = {};
      cs.forEach(c => { porPar[c.paraleloId] = (porPar[c.paraleloId] || 0) + 1; });
      const h = {};
      cs.forEach(c => { h[c.id] = c.horasSemana > 0 ? c.horasSemana : Math.min(5, Math.floor(slots / (porPar[c.paraleloId] || 1))); });
      setHoras(h);
      setCargando(false);
    })();
    return () => { activo = false; };
  }, [institucionId, periodoActivo.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const enAlcance = useMemo(
    () => (alcance === 'paralelo' ? [paraleloActualId] : paralelosAll.map(p => p.id)).filter(id => cargas.some(c => c.paraleloId === id)),
    [alcance, paraleloActualId, paralelosAll, cargas]
  );
  const cargaPorId = useMemo(() => Object.fromEntries(cargas.map(c => [c.id, c])), [cargas]);
  const bloquesValidos = bloquesInst.filter(b => clases.includes(b.franja));
  const existentesEnAlcance = bloquesInst.filter(b => enAlcance.includes(b.paralelo_id));

  useEffect(() => { setPropuesta(null); setHistorial([]); setEditadas(0); setMotivo(''); setTomado(null); }, [alcance, conservar]);

  function generar() {
    if (propuesta && editadas > 0 && !window.confirm('Al generar otra vez se pierden los ajustes que hiciste a mano en esta propuesta. ¿Continuar?')) return;
    setError('');
    const paralelos = enAlcance.map(id => ({
      id,
      cargas: cargas.filter(c => c.paraleloId === id).map(c => ({ id: c.id, docenteId: c.docenteId, horas: Number(horas[c.id]) || 0 }))
    }));
    const fijos = conservar ? bloquesValidos.filter(b => enAlcance.includes(b.paralelo_id)).map(b => ({ paralelo_id: b.paralelo_id, docente_materia_id: b.docente_materia_id, dia: b.dia, franja: b.franja })) : [];
    const ocupadosDocente = bloquesValidos
      .filter(b => !enAlcance.includes(b.paralelo_id))
      .map(b => ({ docenteId: cargaPorId[b.docente_materia_id]?.docenteId, dia: b.dia, franja: b.franja }))
      .filter(o => o.docenteId);
    const res = generarHorario({ franjas: clases, paralelos, fijos, ocupadosDocente, seed: Math.floor(Math.random() * 1e9) });
    setPropuesta({ ...res, paralelos: enAlcance, fijos, ocupadosDocente, intento: (propuesta?.intento || 0) + 1 });
    setHistorial([]); setEditadas(0); setMotivo(''); setTomado(null);
    if (!enAlcance.includes(verParalelo)) setVerParalelo(enAlcance[0]);
  }

  const docDeCarga = useMemo(() => Object.fromEntries(cargas.map(c => [c.id, c.docenteId])), [cargas]);
  const validos = useMemo(() => {
    if (!propuesta || !tomado) return new Set();
    return destinosValidos({ bloques: propuesta.bloques, fijos: propuesta.fijos, ocupadosFuera: propuesta.ocupadosDocente, docDeCarga, paraleloId: verParalelo, desde: tomado, franjas: clases });
  }, [propuesta, tomado, docDeCarga, verParalelo]); // eslint-disable-line react-hooks/exhaustive-deps

  function moverClase(desde, hacia) {
    const r = moverEnPropuesta({ bloques: propuesta.bloques, fijos: propuesta.fijos, ocupadosFuera: propuesta.ocupadosDocente, docDeCarga, paraleloId: verParalelo, desde, hacia });
    if (!r.ok) { setMotivo(r.motivo); return; }
    if (r.tipo === 'sin_cambios') return;
    setMotivo('');
    setHistorial(h => [...h, propuesta.bloques]);
    setEditadas(n => n + 1);
    setPropuesta(p => ({ ...p, bloques: r.bloques }));
  }
  function deshacer() {
    if (!historial.length) return;
    const previo = historial[historial.length - 1];
    setHistorial(h => h.slice(0, -1));
    setEditadas(n => Math.max(0, n - 1));
    setPropuesta(p => ({ ...p, bloques: previo }));
    setMotivo('');
  }

  // Si hay una propuesta sin guardar, pide confirmación antes de cerrar (así no se pierde por un clic de más)
  function cerrar() {
    if (propuesta && !aplicando && !window.confirm('Tienes una propuesta sin guardar. ¿Cerrar y descartarla?')) return;
    onClose();
  }

  async function aplicar() {
    if (!propuesta) return;
    const faltan = propuesta.faltantes.reduce((a, f) => a + f.faltan, 0);
    if (!conservar && existentesEnAlcance.length && !window.confirm(`Se reemplazarán las ${existentesEnAlcance.length} clase(s) actuales de ${enAlcance.length} paralelo(s) por este horario. ¿Continuar?`)) return;
    if (faltan && !window.confirm(`Quedan ${faltan} hora(s) sin ubicar (no hay huecos libres sin cruces de docente). ¿Aplicar de todos modos?`)) return;
    setAplicando(true); setError('');
    try {
      await aplicarHorario(enAlcance, propuesta.bloques, !conservar);
      // recuerda las horas por semana que ajustaste (no es crítico: si falla, el horario ya quedó aplicado)
      await Promise.allSettled(cargas
        .filter(c => enAlcance.includes(c.paraleloId) && (Number(horas[c.id]) || 0) !== c.horasSemana)
        .map(c => actualizarHorasCarga(c.id, Number(horas[c.id]) || 0)));
      onApplied();
    } catch (e) {
      setError('No se aplicó nada: ' + (e.message || 'error desconocido') + '. El horario anterior sigue intacto.');
    }
    setAplicando(false);
  }

  const capacidad = clases.length * DIAS.length;
  const totalFaltan = propuesta ? propuesta.faltantes.reduce((a, f) => a + f.faltan, 0) : 0;
  const bloquesVista = propuesta ? [...propuesta.fijos.map(f => ({ ...f, fijo: true })), ...propuesta.bloques].filter(b => b.paralelo_id === verParalelo) : [];

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget && !aplicando) cerrar(); }}>
      <div style={{ ...caja, maxWidth: 980 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>✨ Generar horario automáticamente</h3>
          <button className="btn btn-ghost btn-sm" onClick={cerrar} disabled={aplicando}>✕</button>
        </div>
        <div style={{ padding: 20 }}>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--slate)' }}>
            Arma una propuesta sin cruces de docente, repartiendo cada materia en distintos días y respetando los recreos. No se guarda nada hasta que pulses <strong>Aplicar</strong>; puedes generar tantas veces como quieras y quedarte con la que más te guste.
          </p>
          {cargando ? <p style={{ fontSize: 13, color: 'var(--slate)' }}>Cargando materias…</p> : (
            <>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14, fontSize: 13 }}>
                <label><input type="radio" checked={alcance === 'paralelo'} onChange={() => setAlcance('paralelo')} /> Solo este paralelo ({nombrePar[paraleloActualId] || '—'})</label>
                <label><input type="radio" checked={alcance === 'todos'} onChange={() => setAlcance('todos')} /> Todos los paralelos del colegio</label>
                <label title="Las clases ya asignadas no se tocan: solo se llenan los huecos">
                  <input type="checkbox" checked={conservar} onChange={e => setConservar(e.target.checked)} /> Conservar las clases ya asignadas
                </label>
              </div>

              {enAlcance.length === 0 ? (
                <div className="empty"><span className="ti ti-calendar-off" /><p>No hay materias asignadas en {alcance === 'paralelo' ? 'este paralelo' : 'ningún paralelo'} para este período (Académico → Cargas).</p></div>
              ) : (
                <div style={{ border: '1px solid var(--line)', borderRadius: 10, maxHeight: 260, overflowY: 'auto', marginBottom: 14 }}>
                  <table className="data" style={{ width: '100%' }}>
                    <thead><tr><th>Paralelo</th><th>Materia</th><th>Docente</th><th style={{ textAlign: 'center', width: 130 }}>Horas por semana</th></tr></thead>
                    <tbody>
                      {enAlcance.flatMap(id => cargas.filter(c => c.paraleloId === id).map(c => (
                        <tr key={c.id}>
                          <td style={{ fontSize: 12 }}>{nombrePar[id]}</td>
                          <td>{c.materiaNombre}</td>
                          <td style={{ fontSize: 12, color: c.docenteNombre ? undefined : 'var(--slate)' }}>{c.docenteNombre || 'Sin docente'}</td>
                          <td style={{ textAlign: 'center' }}>
                            <input type="number" min="0" max={capacidad} value={horas[c.id] ?? 0} onChange={e => setHoras(h => ({ ...h, [c.id]: e.target.value }))}
                              style={{ width: 64, textAlign: 'center', padding: '4px 2px', border: '1px solid var(--line)', borderRadius: 6 }} />
                          </td>
                        </tr>
                      )))}
                    </tbody>
                  </table>
                </div>
              )}

              {enAlcance.map(id => {
                const total = cargas.filter(c => c.paraleloId === id).reduce((a, c) => a + (Number(horas[c.id]) || 0), 0);
                const fijas = conservar ? existentesEnAlcance.filter(b => b.paralelo_id === id).length : 0;
                // con "conservar", las horas ya asignadas cuentan dentro del total de cada materia
                return total > capacidad ? (
                  <div key={id} style={{ fontSize: 12.5, color: '#b45309', marginBottom: 6 }}>⚠ {nombrePar[id]}: {total} horas pedidas pero solo hay {capacidad} períodos a la semana{fijas ? ` (${fijas} ya asignados)` : ''}.</div>
                ) : null;
              })}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
                <button className="btn btn-primary" onClick={generar} disabled={!enAlcance.length || aplicando}>
                  {propuesta ? '🔄 Generar otra vez' : '✨ Generar propuesta'}
                </button>
                {propuesta && <span style={{ fontSize: 12.5, color: 'var(--slate)' }}>Propuesta #{propuesta.intento} · {propuesta.bloques.length} clase(s) nuevas</span>}
              </div>

              {propuesta && (
                <div>
                  {totalFaltan > 0 && (
                    <div style={{ marginBottom: 10, padding: '10px 12px', borderRadius: 10, background: '#fffbeb', border: '1px solid #fde68a', fontSize: 12.5, color: '#92400e' }}>
                      ⚠ No se pudieron ubicar {totalFaltan} hora(s): {propuesta.faltantes.slice(0, 6).map(f => `${cargaPorId[f.cargaId]?.materiaNombre} (${nombrePar[f.paraleloId]}, faltan ${f.faltan})`).join(' · ')}{propuesta.faltantes.length > 6 ? ' …' : ''}.
                      Prueba con “Generar otra vez”, baja las horas por semana o agrega más clases en “Jornada y recreos”.
                    </div>
                  )}
                  {propuesta.paralelos.length > 1 && (
                    <div style={{ marginBottom: 10 }}>
                      <label className="fl">Ver el horario de</label>
                      <select className="fc" style={{ maxWidth: 280 }} value={verParalelo} onChange={e => setVerParalelo(e.target.value)}>
                        {propuesta.paralelos.map(id => <option key={id} value={id}>{nombrePar[id]}</option>)}
                      </select>
                    </div>
                  )}
                  <div style={{ marginBottom: 10, padding: '9px 12px', borderRadius: 10, background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: 12.5, color: '#1e40af', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <span>
                      <strong>Vista previa — todavía no está guardado.</strong> Arrastra una clase a otra celda para moverla (si ya hay una, se intercambian). Para guardar, pulsa <strong>💾 Guardar horario</strong> abajo.
                      {editadas > 0 && <> · {editadas} ajuste(s) a mano</>}
                    </span>
                    <button className="btn btn-secondary btn-sm" onClick={deshacer} disabled={!historial.length}>↩ Deshacer</button>
                  </div>
                  <GrillaPropuesta franjas={franjas} bloques={bloquesVista} cargaPorId={cargaPorId}
                    tomado={tomado} setTomado={setTomado} validos={validos} onMover={moverClase} motivoUltimo={motivo} />
                </div>
              )}
              {error && <div style={{ marginTop: 12, fontSize: 13, color: 'var(--red)' }}>{error}</div>}
            </>
          )}
        </div>
        <div style={{ position: 'sticky', bottom: 0, background: 'var(--card, #fff)', borderRadius: '0 0 14px 14px', padding: '14px 20px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', boxShadow: '0 -6px 14px rgba(0,0,0,.06)' }}>
          <span style={{ fontSize: 12.5, color: propuesta ? '#1e40af' : 'var(--slate)' }}>
            {propuesta ? 'Sin guardar: nada cambia en el horario hasta que pulses Guardar.' : 'Genera una propuesta para poder guardarla.'}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={cerrar} disabled={aplicando}>Cancelar</button>
            <button className="btn btn-success" onClick={aplicar} disabled={!propuesta || aplicando}>{aplicando ? 'Guardando…' : '💾 Guardar horario'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
