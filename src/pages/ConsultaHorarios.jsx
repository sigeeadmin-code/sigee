import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { fetchGradosConParalelos, fetchTodasCargas, fetchHorario, fetchAulas } from '../lib/data.js';
import { franjasParaBloques } from '../lib/horarioAuto.js';
import { colorDeMateria } from '../lib/horarioUI.js';
import { GrillaHorario, Leyenda, useFranjas } from './Horario.jsx';
import {
  DIAS, TIPO_LABEL, tipoBachillerato, agruparDocentes, buscarDocentes, horasUbicadas, bloquesDeCargas, cruces, cobertura, matrizDia
} from '../lib/consultaHorarios.js';

// Consulta de horarios para Rector, Vicerrector e Inspector General. SOLO LECTURA: el horario se edita en "Horario".
const TIPOS_FILTRO = [['todos', 'Todos'], ['ciencias', 'Ciencias'], ['tecnico', 'Técnico'], ['otro', 'Otros niveles']];
const COLOR_TIPO = { ciencias: { bg: '#ecfdf5', tx: '#065f46' }, tecnico: { bg: '#fff7ed', tx: '#9a3412' }, otro: { bg: '#f1f5f9', tx: '#475569' } };

function InsigniaTipo({ tipo }) {
  const c = COLOR_TIPO[tipo] || COLOR_TIPO.otro;
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: c.bg, color: c.tx, whiteSpace: 'nowrap' }}>{TIPO_LABEL[tipo] || tipo}</span>;
}
function FiltroTipo({ valor, onChange }) {
  return (
    <div>
      <label className="fl">Bachillerato</label>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TIPOS_FILTRO.map(([k, l]) => <button key={k} className={'btn btn-sm ' + (valor === k ? 'btn-primary' : 'btn-secondary')} onClick={() => onChange(k)}>{l}</button>)}
      </div>
    </div>
  );
}
function Encabezado({ titulo, sub, children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10, margin: '4px 0 12px' }}>
      <div><h3 style={{ margin: 0, fontSize: 16 }}>{titulo}</h3><div style={{ fontSize: 12.5, color: 'var(--slate)' }}>{sub}</div></div>
      <button className="btn btn-secondary btn-sm print-hide" onClick={() => window.print()}>🖨️ Imprimir</button>
      {children}
    </div>
  );
}

/* ───────────── Por docente: buscar → ver los cursos que dicta → elegir → ver el horario ───────────── */
function VistaDocente({ ctx, docenteInicial = null }) {
  const { docentes, cargaPorId, bloquesPer, horas, mapaFranjas, aulaNombre, subtitulo } = ctx;
  const [q, setQ] = useState('');
  const [docenteId, setDocenteId] = useState(docenteInicial);
  const [excluidas, setExcluidas] = useState(() => new Set());   // cargas desmarcadas; por defecto se ve TODO el horario personal
  const resultados = useMemo(() => buscarDocentes(docentes, q), [docentes, q]);
  const docente = docentes.find(d => d.id === docenteId) || null;

  const ids = useMemo(() => (docente ? docente.cargas.map(c => c.id) : []), [docente]);
  const todosBloques = useMemo(() => bloquesDeCargas(bloquesPer, ids), [bloquesPer, ids]);
  const elegidas = useMemo(() => ids.filter(id => !excluidas.has(id)), [ids, excluidas]);
  const bloques = useMemo(() => bloquesDeCargas(todosBloques, elegidas), [todosBloques, elegidas]);
  const franjas = useMemo(() => franjasParaBloques(mapaFranjas, todosBloques), [mapaFranjas, todosBloques]);   // filas fijas aunque se desmarquen cursos
  const choques = useMemo(() => cruces(todosBloques), [todosBloques]);
  const materias = useMemo(() => [...new Set(elegidas.map(id => cargaPorId[id]?.materiaNombre).filter(Boolean))], [elegidas, cargaPorId]);
  const alternar = id => setExcluidas(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const elegirDocente = id => { setDocenteId(id); setExcluidas(new Set()); };
  const etiquetaCarga = id => { const c = cargaPorId[id]; return c ? `${c.gradoNombre} "${c.paraleloNombre}" — ${c.materiaNombre}` : id; };

  return (
    <div>
      <div className="card print-hide" style={{ marginBottom: 14 }}><div className="cb">
        <label className="fl">Buscar docente</label>
        <input className="fc" value={q} onChange={e => setQ(e.target.value)} placeholder="Apellido, nombre, materia o curso (en cualquier orden, sin tildes)" autoFocus />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, maxHeight: 190, overflowY: 'auto' }}>
          {resultados.slice(0, 60).map(d => (
            <button key={d.id} className={'btn btn-sm ' + (d.id === docenteId ? 'btn-primary' : 'btn-secondary')} onClick={() => elegirDocente(d.id)}>
              {d.nombre} <span style={{ opacity: .7 }}>· {d.cargas.length} curso(s)</span>
            </button>
          ))}
          {!resultados.length && <span style={{ fontSize: 13, color: 'var(--slate)' }}>Ningún docente con carga horaria en este período coincide con «{q}».</span>}
          {resultados.length > 60 && <span style={{ fontSize: 12, color: 'var(--slate)' }}>Mostrando 60 de {resultados.length}: escribe más para acotar.</span>}
        </div>
      </div></div>

      {!docente && <div className="empty"><span className="ti ti-user-search" /><p>Busca un docente y selecciónalo para ver los cursos que dicta y su horario.</p></div>}

      {docente && (
        <>
          <div className="card print-hide" style={{ marginBottom: 14 }}><div className="cb">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              <div style={{ fontWeight: 700 }}>{docente.nombre} <span style={{ fontWeight: 400, color: 'var(--slate)', fontSize: 12.5 }}>· dicta en {docente.cargas.length} curso(s)</span></div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setExcluidas(new Set())}>Ver todo</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setExcluidas(new Set(ids))}>Quitar todo</button>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--slate)', marginBottom: 8 }}>Marca los cursos que quieres ver en el horario:</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 8 }}>
              {docente.cargas.map(c => {
                const on = !excluidas.has(c.id); const col = colorDeMateria(c.materiaNombre);
                const ub = horas[c.id] || 0;
                const incompleto = c.horasSemana != null && ub < c.horasSemana;
                return (
                  <label key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 10, cursor: 'pointer', border: '1px solid ' + (on ? col.bd : 'var(--line)'), background: on ? col.bg : 'var(--white)', opacity: on ? 1 : .6 }}>
                    <input type="checkbox" checked={on} onChange={() => alternar(c.id)} style={{ marginTop: 3 }} />
                    <span style={{ fontSize: 12.5, lineHeight: 1.35 }}>
                      <strong>{c.gradoNombre} "{c.paraleloNombre}"</strong><br />
                      {c.materiaNombre}<br />
                      <span style={{ color: incompleto ? '#b45309' : 'var(--slate)' }}>
                        {c.horasSemana != null ? `${ub} de ${c.horasSemana} h en el horario` : `${ub} h en el horario`}{incompleto ? ' ⚠' : ''}
                      </span>
                      {' '}<InsigniaTipo tipo={ctx.tipoDeCarga(c)} />
                    </span>
                  </label>
                );
              })}
            </div>
          </div></div>

          {choques.length > 0 && (
            <div className="card print-hide" style={{ marginBottom: 14, borderColor: 'var(--amber)' }}><div className="cb" style={{ fontSize: 12.5 }}>
              <strong style={{ color: '#b45309' }}>⚠ Cruce de horario:</strong> este docente figura en dos cursos a la misma hora.
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {choques.map((x, i) => <li key={i}>{x.dia} {x.franja}: {x.cargas.map(etiquetaCarga).join('  ↔  ')}</li>)}
              </ul>
            </div></div>
          )}

          <div className="print-area">
            <Encabezado titulo={`Horario de ${docente.nombre}`} sub={`${bloques.length} hora(s) de clase a la semana · ${elegidas.length} de ${ids.length} curso(s) · ${subtitulo}`} />
            <Leyenda items={materias} />
            {bloques.length === 0
              ? <div className="empty"><span className="ti ti-calendar-off" /><p>{elegidas.length ? 'Estos cursos todavía no tienen horas ubicadas en el horario.' : 'No hay cursos marcados.'}</p></div>
              : <GrillaHorario franjas={franjas} bloques={bloques} aulaEtiqueta={aulaNombre}
                resolverEtiqueta={b => { const c = cargaPorId[b.docente_materia_id]; return { materia: c?.materiaNombre || 'Materia', sub: `${c?.gradoNombre || ''} "${c?.paraleloNombre || ''}"` }; }} />}
          </div>
        </>
      )}
    </div>
  );
}

/* ───────────── Por curso / paralelo ───────────── */
function VistaCurso({ ctx }) {
  const { grados, cargas, cargaPorId, bloquesPer, horas, mapaFranjas, aulaNombre, subtitulo } = ctx;
  const [tipo, setTipo] = useState('todos');
  const [gradoId, setGradoId] = useState('');
  const [paraleloId, setParaleloId] = useState('');
  const gradosFiltrados = useMemo(() => grados.filter(g => g.paralelos.some(p => tipo === 'todos' || tipoBachillerato(g, p) === tipo)), [grados, tipo]);
  const grado = gradosFiltrados.find(g => g.id === gradoId) || gradosFiltrados[0] || null;
  const paralelos = grado ? grado.paralelos.filter(p => tipo === 'todos' || tipoBachillerato(grado, p) === tipo) : [];
  const par = paralelos.find(p => p.id === paraleloId) || paralelos[0] || null;

  const bloques = useMemo(() => (par ? bloquesPer.filter(b => b.paralelo_id === par.id) : []), [bloquesPer, par]);
  const cargasPar = useMemo(() => (par ? cargas.filter(c => c.paraleloId === par.id) : []), [cargas, par]);
  const franjas = useMemo(() => (bloques.length ? franjasParaBloques(mapaFranjas, bloques) : (mapaFranjas[par?.jornada || 'Matutina'] || mapaFranjas.Matutina)), [mapaFranjas, bloques, par]);
  const materias = useMemo(() => [...new Set(cargasPar.map(c => c.materiaNombre))], [cargasPar]);

  return (
    <div>
      <div className="card print-hide" style={{ marginBottom: 14 }}><div className="cb">
        <div className="form-grid">
          <FiltroTipo valor={tipo} onChange={setTipo} />
          <div><label className="fl">Curso</label>
            <select className="fc" value={grado?.id || ''} onChange={e => { setGradoId(e.target.value); setParaleloId(''); }}>
              {gradosFiltrados.length === 0 && <option value="">Sin cursos de este tipo</option>}
              {gradosFiltrados.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
            </select></div>
          <div><label className="fl">Paralelo</label>
            <select className="fc" value={par?.id || ''} onChange={e => setParaleloId(e.target.value)}>
              {paralelos.map(p => <option key={p.id} value={p.id}>{p.nombre}{p.especialidad ? ' · ' + p.especialidad : ''}</option>)}
            </select></div>
        </div>
      </div></div>

      {!par && <div className="empty"><span className="ti ti-school" /><p>No hay cursos para mostrar con este filtro.</p></div>}
      {par && (
        <div className="print-area">
          <Encabezado titulo={`${grado.nombre} "${par.nombre}"`} sub={`${TIPO_LABEL[tipoBachillerato(grado, par)]}${par.especialidad ? ' · ' + par.especialidad : ''} · ${par.jornada || 'Matutina'} · ${bloques.length} hora(s) a la semana · ${subtitulo}`} />
          <Leyenda items={materias} />
          {bloques.length === 0
            ? <div className="empty"><span className="ti ti-calendar-off" /><p>Este paralelo todavía no tiene horario cargado.</p></div>
            : <GrillaHorario franjas={franjas} bloques={bloques} aulaEtiqueta={aulaNombre}
              resolverEtiqueta={b => { const c = cargaPorId[b.docente_materia_id]; return { materia: c?.materiaNombre || 'Materia', sub: c?.docenteNombre || 'Sin docente' }; }} />}
          {cargasPar.length > 0 && (
            <div className="card" style={{ marginTop: 14 }}><div className="cb" style={{ padding: 0, overflowX: 'auto' }}>
              <table className="data" style={{ width: '100%' }}>
                <thead><tr><th>Materia</th><th>Docente</th><th style={{ textAlign: 'center' }}>Horas en el horario</th></tr></thead>
                <tbody>{cargasPar.slice().sort((a, b) => a.materiaNombre.localeCompare(b.materiaNombre, 'es')).map(c => {
                  const ub = horas[c.id] || 0; const falta = c.horasSemana != null && ub < c.horasSemana;
                  return <tr key={c.id}><td>{c.materiaNombre}</td><td>{c.docenteNombre || '—'}</td>
                    <td style={{ textAlign: 'center', color: falta ? '#b45309' : undefined }}>{c.horasSemana != null ? `${ub} de ${c.horasSemana}` : ub}{falta ? ' ⚠' : ''}</td></tr>;
                })}</tbody>
              </table>
            </div></div>
          )}
        </div>
      )}
    </div>
  );
}

/* ───────────── General: todos los cursos a la vez, por día ───────────── */
function VistaGeneral({ ctx }) {
  const { grados, cargaPorId, bloquesPer, mapaFranjas, subtitulo } = ctx;
  const [tipo, setTipo] = useState('todos');
  const [dia, setDia] = useState(DIAS[new Date().getDay() - 1] || 'Lunes');
  const filas = useMemo(() => grados.flatMap(g => g.paralelos.map(p => ({ g, p, t: tipoBachillerato(g, p) }))).filter(f => tipo === 'todos' || f.t === tipo), [grados, tipo]);
  const franjas = useMemo(() => franjasParaBloques(mapaFranjas, bloquesPer), [mapaFranjas, bloquesPer]);
  const clases = franjas.filter(f => f.tipo === 'clase');
  const mz = useMemo(() => matrizDia(bloquesPer, dia), [bloquesPer, dia]);
  const cob = useMemo(() => cobertura(filas.map(f => f.p.id), bloquesPer), [filas, bloquesPer]);

  return (
    <div>
      <div className="card print-hide" style={{ marginBottom: 14 }}><div className="cb">
        <div className="form-grid">
          <FiltroTipo valor={tipo} onChange={setTipo} />
          <div><label className="fl">Día</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {DIAS.map(d => <button key={d} className={'btn btn-sm ' + (dia === d ? 'btn-primary' : 'btn-secondary')} onClick={() => setDia(d)}>{d}</button>)}
            </div></div>
        </div>
      </div></div>

      <div className="print-area">
        <Encabezado titulo={`Horario general · ${dia}`} sub={`${cob.conHorario} de ${cob.total} paralelo(s) con horario cargado · ${subtitulo}`} />
        {filas.length === 0 ? <div className="empty"><span className="ti ti-school" /><p>No hay cursos con este filtro.</p></div> : (
          <div className="card"><div className="cb" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="data" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead><tr><th style={{ minWidth: 150 }}>Curso</th>{clases.map(f => <th key={f.label} style={{ textAlign: 'center', fontSize: 11, whiteSpace: 'nowrap' }}>{f.label}</th>)}</tr></thead>
              <tbody>{filas.map(({ g, p, t }) => (
                <tr key={p.id}>
                  <td style={{ verticalAlign: 'middle' }}>
                    <div style={{ fontWeight: 700, fontSize: 12.5 }}>{g.nombre} "{p.nombre}"</div>
                    <div style={{ marginTop: 2 }}><InsigniaTipo tipo={t} />{p.especialidad && <span style={{ fontSize: 10.5, color: 'var(--slate)', marginLeft: 6 }}>{p.especialidad}</span>}</div>
                  </td>
                  {clases.map(f => {
                    const b = (mz[p.id] || {})[f.label]; const c = b ? cargaPorId[b.docente_materia_id] : null; const col = c ? colorDeMateria(c.materiaNombre) : null;
                    return (
                      <td key={f.label} style={{ padding: 3, minWidth: 96 }}>
                        {c ? <div style={{ borderRadius: 8, padding: '5px 7px', background: col.bg, border: '1px solid ' + col.bd, color: col.tx }}>
                          <div style={{ fontWeight: 700, fontSize: 11 }}>{c.materiaNombre}</div>
                          <div style={{ fontSize: 10, opacity: .8 }}>{c.docenteNombre}</div>
                        </div> : <div style={{ minHeight: 34, borderRadius: 8, border: '1.5px dashed var(--line)' }} />}
                      </td>
                    );
                  })}
                </tr>
              ))}</tbody>
            </table>
          </div></div>
        )}
      </div>
    </div>
  );
}

export { VistaDocente, VistaCurso, VistaGeneral };
export default function ConsultaHorarios() {
  const { institucion, data } = useSession();
  const institucionId = institucion?.id;
  const periodoActivo = data?.periodoActivo;
  const [mapaFranjas] = useFranjas(institucionId);
  const [vista, setVista] = useState('docente');
  const [estado, setEstado] = useState({ cargando: true, error: null, grados: [], cargas: [], bloques: [], aulas: [] });

  useEffect(() => {
    if (!institucionId) return;
    let activo = true;
    (async () => {
      setEstado(s => ({ ...s, cargando: true, error: null }));
      try {
        const [grados, cargasTodas, bloques, aulas] = await Promise.all([
          fetchGradosConParalelos(institucionId), fetchTodasCargas(institucionId), fetchHorario(institucionId), fetchAulas(institucionId).catch(() => [])
        ]);
        if (!activo) return;
        const cargas = cargasTodas.filter(c => !periodoActivo || c.periodoId === periodoActivo.id);
        setEstado({ cargando: false, error: null, grados, cargas, bloques, aulas });
      } catch (e) { if (activo) setEstado(s => ({ ...s, cargando: false, error: e.message || 'No se pudo cargar el horario.' })); }
    })();
    return () => { activo = false; };
  }, [institucionId, periodoActivo?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const ctx = useMemo(() => {
    const { grados, cargas, bloques, aulas } = estado;
    const cargaPorId = Object.fromEntries(cargas.map(c => [c.id, c]));
    const bloquesPer = bloques.filter(b => cargaPorId[b.docente_materia_id]);   // solo las clases del período activo
    const infoPar = {}; grados.forEach(g => g.paralelos.forEach(p => { infoPar[p.id] = { g, p }; }));
    const aulaPorId = Object.fromEntries(aulas.map(a => [a.id, a]));
    return {
      grados, cargas, cargaPorId, bloquesPer, mapaFranjas, horas: horasUbicadas(bloquesPer), docentes: agruparDocentes(cargas),
      tipoDeCarga: c => { const i = infoPar[c.paraleloId]; return i ? tipoBachillerato(i.g, i.p) : 'otro'; },
      aulaNombre: id => { const a = aulaPorId[id]; return a ? (a.nombre || a.codigo || '') : ''; },
      subtitulo: `${institucion?.nombre || ''}${periodoActivo ? ' · ' + periodoActivo.nombre : ''}`
    };
  }, [estado, mapaFranjas, institucion?.nombre, periodoActivo]);

  if (!institucionId) return <div className="empty"><span className="ti ti-building" /><p>Selecciona un plantel para consultar sus horarios.</p></div>;
  if (estado.cargando) return <div className="card"><div className="cb"><p className="muted">Cargando horarios…</p></div></div>;
  if (estado.error) return <div className="card"><div className="cb" style={{ color: 'var(--red)' }}>{estado.error}</div></div>;

  return (
    <div>
      <div className="print-hide" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: '0 0 4px' }}>Consulta de horarios</h2>
          <div style={{ fontSize: 13, color: 'var(--slate)' }}>{ctx.subtitulo} · solo consulta</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[['docente', 'Por docente'], ['curso', 'Por curso'], ['general', 'General por día']].map(([k, l]) =>
            <button key={k} className={'btn btn-sm ' + (vista === k ? 'btn-primary' : 'btn-secondary')} onClick={() => setVista(k)}>{l}</button>)}
        </div>
      </div>
      {ctx.cargas.length === 0
        ? <div className="empty"><span className="ti ti-calendar-off" /><p>No hay cargas horarias en {periodoActivo?.nombre || 'el período activo'}.</p></div>
        : vista === 'docente' ? <VistaDocente ctx={ctx} /> : vista === 'curso' ? <VistaCurso ctx={ctx} /> : <VistaGeneral ctx={ctx} />}
    </div>
  );
}
