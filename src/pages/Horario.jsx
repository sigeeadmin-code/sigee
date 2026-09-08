import React, { useEffect, useState, useCallback } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import {
  fetchGradosConParalelos, fetchMateriasParalelo, fetchHorario,
  guardarBloqueHorario, eliminarBloqueHorario, fetchAulas
} from '../lib/data.js';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const FRANJAS = ['07:00–07:40', '07:40–08:20', '08:20–09:00', '09:20–10:00', '10:00–10:40', '10:40–11:20', '11:20–12:00'];
const COLORES = ['#dbeafe', '#d1fae5', '#ede9fe', '#ffedd5', '#fce7f3', '#ccfbf1', '#fef9c3'];

export default function Horario() {
  const { institucion, data } = useSession();
  const institucionId = institucion?.id;
  const periodoActivo = data?.periodoActivo;

  const [grados, setGrados] = useState([]);
  const [gradoId, setGradoId] = useState('');
  const [paraleloId, setParaleloId] = useState('');
  const [cargas, setCargas] = useState([]);
  const [aulas, setAulas] = useState([]);
  const [aulaId, setAulaId] = useState('');
  const [bloques, setBloques] = useState([]);
  const [seleccion, setSeleccion] = useState(null); // docenteMateriaId elegido para asignar
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const cargarBase = useCallback(async () => {
    if (!institucionId) return;
    setLoading(true);
    const [gr, aul] = await Promise.all([fetchGradosConParalelos(institucionId), fetchAulas(institucionId)]);
    setGrados(gr);
    setAulas(aul);
    if (!gradoId && gr.length) {
      setGradoId(gr[0].id);
      setParaleloId(gr[0].paralelos[0]?.id || '');
    }
    setLoading(false);
  }, [institucionId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { cargarBase(); }, [cargarBase]);

  const gradoSel = grados.find(g => g.id === gradoId);

  const cargarDetalle = useCallback(async () => {
    if (!paraleloId || !periodoActivo || !institucionId) return;
    const [cargasParalelo, todosBloques] = await Promise.all([
      fetchMateriasParalelo(paraleloId, periodoActivo.id),
      fetchHorario(institucionId)
    ]);
    setCargas(cargasParalelo);
    setBloques(todosBloques.filter(b => b.paralelo_id === paraleloId));
  }, [paraleloId, periodoActivo, institucionId]);

  useEffect(() => { cargarDetalle(); }, [cargarDetalle]);

  function colorPara(docenteMateriaId) {
    const idx = cargas.findIndex(c => c.id === docenteMateriaId);
    return COLORES[(idx >= 0 ? idx : 0) % COLORES.length];
  }
  function bloqueEn(dia, franja) {
    return bloques.find(b => b.dia === dia && b.franja === franja);
  }

  async function onCellClick(dia, franja) {
    const existente = bloqueEn(dia, franja);
    if (existente) return; // usar el botón de la celda para quitar
    if (!seleccion) { setToast({ tipo: 'err', msg: 'Primero selecciona una materia de la lista.' }); return; }
    try {
      await guardarBloqueHorario({
        institucion_id: institucionId, docente_materia_id: seleccion, paralelo_id: paraleloId,
        aula_id: aulaId || null, dia, franja
      });
      await cargarDetalle();
    } catch (err) {
      setToast({ tipo: 'err', msg: err.message || 'No se pudo asignar.' });
    }
  }

  async function quitarBloque(e, id) {
    e.stopPropagation();
    try {
      await eliminarBloqueHorario(id);
      await cargarDetalle();
    } catch (err) {
      setToast({ tipo: 'err', msg: err.message || 'No se pudo quitar.' });
    }
  }

  if (loading) return <p style={{ fontSize: 13, color: 'var(--slate)' }}>Cargando…</p>;
  if (!periodoActivo) return <div className="card"><div className="cb"><p className="muted">No hay un período lectivo activo.</p></div></div>;

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ margin: '0 0 4px' }}>Horario semanal</h2>
        <div style={{ fontSize: 13, color: 'var(--slate)' }}>Clic en una materia y luego en una celda vacía para asignarla · {periodoActivo.nombre}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 14, alignItems: 'start' }}>
        <div>
          <div className="card">
            <div className="cb">
              <label className="fl">Curso</label>
              <select className="fc" value={gradoId} onChange={e => { setGradoId(e.target.value); const g = grados.find(x => x.id === e.target.value); setParaleloId(g?.paralelos[0]?.id || ''); setSeleccion(null); }}>
                {grados.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
              </select>
              <label className="fl" style={{ marginTop: 12 }}>Paralelo</label>
              <select className="fc" value={paraleloId} onChange={e => { setParaleloId(e.target.value); setSeleccion(null); }}>
                {(gradoSel?.paralelos || []).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              <label className="fl" style={{ marginTop: 12 }}>Aula (opcional)</label>
              <select className="fc" value={aulaId} onChange={e => setAulaId(e.target.value)}>
                <option value="">— Sin aula —</option>
                {aulas.map(a => <option key={a.id} value={a.id}>{a.codigo} · {a.nombre}</option>)}
              </select>
            </div>
          </div>
          <div className="card" style={{ marginTop: 12 }}>
            <div className="cb">
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate)', marginBottom: 10 }}>
                {seleccion ? '✓ Materia seleccionada — clic en una celda vacía' : 'Selecciona una materia'}
              </p>
              {cargas.length === 0 && <p className="muted">Sin materias asignadas a este paralelo todavía.</p>}
              {cargas.map(c => (
                <div
                  key={c.id}
                  onClick={() => setSeleccion(c.id)}
                  style={{
                    padding: '8px 10px', borderRadius: 8, marginBottom: 6, cursor: 'pointer',
                    background: colorPara(c.id), border: seleccion === c.id ? '2px solid var(--brand)' : '2px solid transparent'
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{c.materiaNombre}</div>
                  <div style={{ fontSize: 11, opacity: .75 }}>{c.docenteNombre || 'Sin docente'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="cb" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="data" style={{ width: '100%' }}>
              <thead><tr><th></th>{DIAS.map(d => <th key={d} style={{ textAlign: 'center' }}>{d}</th>)}</tr></thead>
              <tbody>
                {FRANJAS.map(fr => (
                  <tr key={fr}>
                    <td style={{ fontSize: 11, color: 'var(--slate)', whiteSpace: 'nowrap' }}>{fr}</td>
                    {DIAS.map(dia => {
                      const b = bloqueEn(dia, fr);
                      if (!b) {
                        return (
                          <td key={dia} style={{ padding: 4 }}>
                            <div onClick={() => onCellClick(dia, fr)} style={{ minHeight: 48, borderRadius: 8, border: '2px dashed var(--line)', cursor: 'pointer', background: '#fafbfc' }} />
                          </td>
                        );
                      }
                      const carga = cargas.find(c => c.id === b.docente_materia_id);
                      return (
                        <td key={dia} style={{ padding: 4 }}>
                          <div style={{ minHeight: 48, borderRadius: 8, padding: '6px 8px', background: colorPara(b.docente_materia_id), position: 'relative' }}>
                            <div style={{ fontWeight: 700, fontSize: 11 }}>{carga?.materiaNombre || 'Materia'}</div>
                            <div style={{ fontSize: 10, opacity: .75 }}>{carga?.docenteNombre || '—'}</div>
                            <button
                              type="button" onClick={e => quitarBloque(e, b.id)}
                              style={{ position: 'absolute', top: 2, right: 4, border: 'none', background: 'rgba(255,255,255,.85)', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', fontSize: 12, lineHeight: 1, color: 'var(--red)' }}
                            >×</button>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {toast && <div className={'toast ' + (toast.tipo === 'ok' ? 'ok' : 'err')}>{toast.msg}</div>}
    </div>
  );
}
