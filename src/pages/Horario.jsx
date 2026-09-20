import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import {
  fetchGradosConParalelos, fetchMateriasParalelo, fetchHorario, fetchHorarioDocente, fetchHorarioParalelo,
  guardarBloqueHorario, eliminarBloqueHorario, fetchAulas, fetchCargasDocente,
  fetchEstudianteIdPorProfile, fetchHijosDeRepresentante, fetchProgramacionEstudiante
} from '../lib/data.js';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const FRANJAS = ['07:00–07:40', '07:40–08:20', '08:20–09:00', '09:20–10:00', '10:00–10:40', '10:40–11:20', '11:20–12:00'];
const HOY_NOMBRE = DIAS[new Date().getDay() - 1] || null; // domingo/sábado -> null, no resalta ningún día

// Paleta fija y determinística por materia (por nombre, no por índice de lista)
// — así el color de "Matemática" no cambia si se reordena el arreglo de cargas.
const PALETA = [
  { bg: '#eef2ff', bd: '#c7d2fe', tx: '#3730a3' }, // índigo
  { bg: '#ecfdf5', bd: '#a7f3d0', tx: '#065f46' }, // esmeralda
  { bg: '#fff7ed', bd: '#fed7aa', tx: '#9a3412' }, // ámbar
  { bg: '#fdf2f8', bd: '#fbcfe8', tx: '#9d174d' }, // rosa
  { bg: '#f0f9ff', bd: '#bae6fd', tx: '#075985' }, // celeste
  { bg: '#f7fee7', bd: '#d9f99d', tx: '#3f6212' }, // lima
  { bg: '#faf5ff', bd: '#e9d5ff', tx: '#6b21a8' }, // violeta
];
function colorDeMateria(nombre) {
  let h = 0;
  for (let i = 0; i < (nombre || '').length; i++) h = (h * 31 + nombre.charCodeAt(i)) % PALETA.length;
  return PALETA[h];
}

function GrillaHorario({ bloques, resolverEtiqueta, aulaEtiqueta, alto = 56 }) {
  const bloqueEn = (dia, franja) => bloques.find(b => b.dia === dia && b.franja === franja);
  return (
    <div className="card"><div className="cb" style={{ padding: 0, overflowX: 'auto' }}>
      <table className="data" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
        <thead>
          <tr>
            <th style={{ width: 92 }}></th>
            {DIAS.map(d => (
              <th key={d} style={{ textAlign: 'center', background: d === HOY_NOMBRE ? 'var(--brandXL, #eef2ff)' : undefined }}>
                {d}{d === HOY_NOMBRE && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: 'var(--brand)' }}>HOY</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FRANJAS.map(fr => (
            <tr key={fr}>
              <td style={{ fontSize: 11, color: 'var(--slate)', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>{fr}</td>
              {DIAS.map(dia => {
                const b = bloqueEn(dia, fr);
                const info = b ? resolverEtiqueta(b) : null;
                const c = info ? colorDeMateria(info.materia) : null;
                return (
                  <td key={dia} style={{ padding: 3, background: dia === HOY_NOMBRE ? 'rgba(99,102,241,.035)' : undefined }}>
                    {info ? (
                      <div style={{ minHeight: alto, borderRadius: 10, padding: '7px 9px', background: c.bg, border: '1px solid ' + c.bd }}>
                        <div style={{ fontWeight: 700, fontSize: 12, color: c.tx }}>{info.materia}</div>
                        <div style={{ fontSize: 10.5, color: c.tx, opacity: .8 }}>{info.sub}</div>
                        {b.aula_id && <div style={{ fontSize: 10, color: c.tx, opacity: .65, marginTop: 2 }}>📍 {aulaEtiqueta(b.aula_id)}</div>}
                      </div>
                    ) : (
                      <div style={{ minHeight: alto, borderRadius: 10, border: '1.5px dashed var(--line)' }} />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div></div>
  );
}

function Leyenda({ items }) {
  if (!items.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
      {items.map(nombre => {
        const c = colorDeMateria(nombre);
        return (
          <span key={nombre} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, padding: '4px 10px', borderRadius: 999, background: c.bg, border: '1px solid ' + c.bd, color: c.tx }}>
            {nombre}
          </span>
        );
      })}
    </div>
  );
}

/** Vista de SOLO LECTURA — un docente ve exclusivamente sus propias clases. */
function MiHorarioDocente() {
  const { profile, institucion, data } = useSession();
  const institucionId = institucion?.id;
  const [cargas, setCargas] = useState([]);
  const [bloques, setBloques] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let activo = true;
    (async () => {
      if (!institucionId) return;
      setLoading(true);
      const cd = await fetchCargasDocente(profile.id, institucionId);
      if (!activo) return;
      setCargas(cd);
      const b = await fetchHorarioDocente(cd.map(c => c.id));
      if (activo) { setBloques(b); setLoading(false); }
    })();
    return () => { activo = false; };
  }, [institucionId, profile.id]);

  const cargaPorId = useMemo(() => Object.fromEntries(cargas.map(c => [c.id, c])), [cargas]);
  const materiasUnicas = useMemo(() => [...new Set(cargas.map(c => c.materiaNombre))], [cargas]);
  const totalHoras = bloques.length;

  if (loading) return <p style={{ fontSize: 13, color: 'var(--slate)' }}>Cargando…</p>;
  if (!cargas.length) return <div className="empty"><span className="ti ti-clock" /><p>Todavía no tienes materias asignadas en {data?.periodoActivo?.nombre || 'el período activo'}.</p></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: 'var(--slate)' }}>{totalHoras} hora(s) de clase a la semana · {data?.periodoActivo?.nombre}</div>
        <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>🖨️ Imprimir</button>
      </div>
      <Leyenda items={materiasUnicas} />
      <GrillaHorario
        bloques={bloques}
        resolverEtiqueta={b => { const c = cargaPorId[b.docente_materia_id]; return { materia: c?.materiaNombre || 'Materia', sub: `${c?.gradoNombre || ''} "${c?.paraleloNombre || ''}"`.trim() }; }}
        aulaEtiqueta={() => ''}
      />
    </div>
  );
}

/** Vista de SOLO LECTURA — estudiante o padre ven el horario completo de SU curso, nada más. */
function MiHorarioCurso() {
  const { profile, institucion, data } = useSession();
  const esPadre = profile.rolDb === 'padre';
  const [hijos, setHijos] = useState([]);
  const [estudianteId, setEstudianteId] = useState(null);
  const [prog, setProg] = useState(null);
  const [bloques, setBloques] = useState([]);
  const [materias, setMaterias] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let activo = true;
    (async () => {
      setLoading(true);
      if (esPadre) {
        const h = await fetchHijosDeRepresentante(profile.id);
        if (!activo) return;
        setHijos(h); setEstudianteId(h[0]?.id || null);
      } else {
        const id = await fetchEstudianteIdPorProfile(profile.id);
        if (activo) setEstudianteId(id);
      }
    })();
    return () => { activo = false; };
  }, [esPadre, profile.id]);

  useEffect(() => {
    let activo = true;
    (async () => {
      if (!estudianteId) { setLoading(false); return; }
      setLoading(true);
      const p = await fetchProgramacionEstudiante(estudianteId);
      if (!activo) return;
      setProg(p);
      if (p?.matricula?.paralelo_id) {
        const [b, m] = await Promise.all([
          fetchHorarioParalelo(p.matricula.paralelo_id),
          fetchMateriasParalelo(p.matricula.paralelo_id, data?.periodoActivo?.id)
        ]);
        if (activo) { setBloques(b); setMaterias(m); }
      }
      if (activo) setLoading(false);
    })();
    return () => { activo = false; };
  }, [estudianteId, data?.periodoActivo?.id]);

  const materiaPorDocenteMateria = useMemo(() => Object.fromEntries(materias.map(m => [m.id, m])), [materias]);
  const materiasUnicas = useMemo(() => [...new Set(materias.map(m => m.materiaNombre))], [materias]);

  if (loading) return <p style={{ fontSize: 13, color: 'var(--slate)' }}>Cargando…</p>;
  if (esPadre && hijos.length === 0) return <div className="empty"><span className="ti ti-users" /><p>No hay ningún estudiante vinculado a tu cuenta todavía.</p></div>;
  if (!prog?.matricula) return <div className="empty"><span className="ti ti-clock" /><p>Sin matrícula activa en el período actual.</p></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: '0 0 4px' }}>{prog.estudiante.nombres} {prog.estudiante.apellidos}</h2>
          <div style={{ fontSize: 13, color: 'var(--slate)' }}>{prog.curso?.grado} "{prog.curso?.paralelo}" · {data?.periodoActivo?.nombre}</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>🖨️ Imprimir</button>
      </div>

      {esPadre && hijos.length > 1 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="cb" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label className="fl" style={{ margin: 0 }}>Hijo/a:</label>
            <select className="fc" value={estudianteId} onChange={e => setEstudianteId(e.target.value)} style={{ maxWidth: 260 }}>
              {hijos.map(h => <option key={h.id} value={h.id}>{h.nombre}</option>)}
            </select>
          </div>
        </div>
      )}

      <Leyenda items={materiasUnicas} />
      <GrillaHorario
        bloques={bloques}
        resolverEtiqueta={b => { const m = materiaPorDocenteMateria[b.docente_materia_id]; return { materia: m?.materiaNombre || 'Materia', sub: m?.docenteNombre || '' }; }}
        aulaEtiqueta={() => ''}
      />
    </div>
  );
}

/** Editor completo — solo admin_plantel / secretario / supervisor_plantel / super_admin. */
function EditorHorario() {
  const { institucion, data, refrescarDatos } = useSession();
  const institucionId = institucion?.id;
  const periodoActivo = data?.periodoActivo;

  const [grados, setGrados] = useState([]);
  const [gradoId, setGradoId] = useState('');
  const [paraleloId, setParaleloId] = useState('');
  const [cargas, setCargas] = useState([]);
  const [aulas, setAulas] = useState([]);
  const [aulaId, setAulaId] = useState('');
  const [bloques, setBloques] = useState([]);
  const [seleccion, setSeleccion] = useState(null);
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
    if (!gradoId && gr.length) { setGradoId(gr[0].id); setParaleloId(gr[0].paralelos[0]?.id || ''); }
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

  const cargaPorId = useMemo(() => Object.fromEntries(cargas.map(c => [c.id, c])), [cargas]);
  const materiasUnicas = useMemo(() => [...new Set(cargas.map(c => c.materiaNombre))], [cargas]);

  function bloqueEn(dia, franja) { return bloques.find(b => b.dia === dia && b.franja === franja); }

  async function onCellClick(dia, franja) {
    if (bloqueEn(dia, franja)) return;
    if (!seleccion) { setToast({ tipo: 'err', msg: 'Primero selecciona una materia de la lista.' }); return; }
    try {
      await guardarBloqueHorario({ institucion_id: institucionId, docente_materia_id: seleccion, paralelo_id: paraleloId, aula_id: aulaId || null, dia, franja });
      await cargarDetalle();
      refrescarDatos();
    } catch (err) {
      setToast({ tipo: 'err', msg: err.message || 'No se pudo asignar.' });
    }
  }
  async function quitarBloque(id) {
    try { await eliminarBloqueHorario(id); await cargarDetalle(); refrescarDatos(); }
    catch (err) { setToast({ tipo: 'err', msg: err.message || 'No se pudo quitar.' }); }
  }

  if (loading) return <p style={{ fontSize: 13, color: 'var(--slate)' }}>Cargando…</p>;
  if (!periodoActivo) return <div className="empty"><span className="ti ti-calendar-off" /><p>No hay un período lectivo activo — crea uno en Académico → Períodos.</p></div>;

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ margin: '0 0 4px' }}>Horario semanal</h2>
        <div style={{ fontSize: 13, color: 'var(--slate)' }}>Elige una materia de la izquierda y haz clic en una celda vacía para asignarla · {periodoActivo.nombre}</div>
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
                {seleccion ? '✓ Materia lista — haz clic en una celda vacía' : 'Elige qué materia asignar'}
              </p>
              {cargas.length === 0 && <p style={{ fontSize: 13, color: 'var(--slate)' }}>Este paralelo todavía no tiene materias asignadas (ve a Académico → Cargas).</p>}
              {cargas.map(c => {
                const cl = colorDeMateria(c.materiaNombre);
                return (
                  <div key={c.id} onClick={() => setSeleccion(c.id)}
                    style={{ padding: '8px 10px', borderRadius: 10, marginBottom: 6, cursor: 'pointer', background: cl.bg, border: '1.5px solid ' + (seleccion === c.id ? 'var(--brand)' : cl.bd) }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: cl.tx }}>{c.materiaNombre}</div>
                    <div style={{ fontSize: 11, color: cl.tx, opacity: .75 }}>{c.docenteNombre || 'Sin docente asignado'}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <Leyenda items={materiasUnicas} />
          <div className="card"><div className="cb" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="data" style={{ width: '100%' }}>
              <thead><tr><th style={{ width: 92 }}></th>{DIAS.map(d => <th key={d} style={{ textAlign: 'center' }}>{d}</th>)}</tr></thead>
              <tbody>
                {FRANJAS.map(fr => (
                  <tr key={fr}>
                    <td style={{ fontSize: 11, color: 'var(--slate)', whiteSpace: 'nowrap' }}>{fr}</td>
                    {DIAS.map(dia => {
                      const b = bloqueEn(dia, fr);
                      if (!b) return <td key={dia} style={{ padding: 3 }}><div onClick={() => onCellClick(dia, fr)} style={{ minHeight: 52, borderRadius: 10, border: '1.5px dashed var(--line)', cursor: 'pointer' }} /></td>;
                      const carga = cargaPorId[b.docente_materia_id];
                      const cl = colorDeMateria(carga?.materiaNombre);
                      return (
                        <td key={dia} style={{ padding: 3 }}>
                          <div style={{ minHeight: 52, borderRadius: 10, padding: '7px 9px', background: cl.bg, border: '1px solid ' + cl.bd, position: 'relative' }}>
                            <div style={{ fontWeight: 700, fontSize: 11.5, color: cl.tx }}>{carga?.materiaNombre || 'Materia'}</div>
                            <div style={{ fontSize: 10, color: cl.tx, opacity: .8 }}>{carga?.docenteNombre || '—'}</div>
                            <button type="button" onClick={() => quitarBloque(b.id)}
                              style={{ position: 'absolute', top: 3, right: 4, border: 'none', background: 'rgba(255,255,255,.85)', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', fontSize: 12, lineHeight: 1, color: 'var(--red)' }}>×</button>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div></div>
        </div>
      </div>

      {toast && <div className={'toast ' + (toast.tipo === 'ok' ? 'ok' : 'err')}>{toast.msg}</div>}
    </div>
  );
}

const ROLES_EDITOR = ['super_admin', 'admin_plantel', 'secretario', 'supervisor_plantel'];

export default function Horario() {
  const { profile } = useSession();
  if (ROLES_EDITOR.includes(profile.rolDb)) return <EditorHorario />;
  if (profile.rolDb === 'docente') return <MiHorarioDocente />;
  if (profile.rolDb === 'padre' || profile.rolDb === 'estudiante') return <MiHorarioCurso />;
  return <div className="empty"><span className="ti ti-lock" /><p>Tu rol no tiene una vista de horario configurada.</p></div>;
}
