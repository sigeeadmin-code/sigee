import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { fetchReporteCargaHoraria, fetchConfigCargaHoraria, guardarConfigCargaHoraria, fetchMinutosPeriodo } from '../lib/data.js';
import { exportarFilasExcel } from '../lib/cargaMasiva.js';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const DIA_C = { Lunes: 'L', Martes: 'M', Miércoles: 'X', Jueves: 'J', Viernes: 'V' };

function estadoDe(d, cfg) {
  const cargo = String(d.cargo || '').trim();
  const conCargo = cargo && cargo.toUpperCase() !== 'DOCENTE';
  if (d.horas === 0) return conCargo ? { k: 'cargo', txt: `Sin carga · cargo: ${cargo}`, cls: 'b-info' } : { k: 'sin', txt: 'Sin carga', cls: 'b-err' };
  if (d.horas < cfg.minima_semana) return { k: 'baja', txt: 'Carga baja', cls: 'b-warn' };
  if (d.horas > cfg.maxima_semana) return { k: 'excede', txt: 'Excede el máximo', cls: 'b-err' };
  return { k: 'normal', txt: 'Normal', cls: 'b-ok' };
}

// Reporte de carga horaria de los docentes: materias, cursos y paralelos, horas por día / semana / mes,
// mayor carga, y docentes sin carga o con carga baja (los que tienen un cargo, como inspector, salen como justificados).
export default function CargaDocente({ institucionId, periodoActivo, showToast }) {
  const { profile } = useSession();
  const puedeConfig = ['super_admin', 'admin_plantel'].includes(profile.rolDb);
  const [filas, setFilas] = useState(null);
  const [cfg, setCfg] = useState({ maxima_semana: 30, minima_semana: 20, semanas_mes: 4 });
  const [cfgForm, setCfgForm] = useState(null);
  const [minutos, setMinutos] = useState(40);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [q, setQ] = useState('');
  const [orden, setOrden] = useState('apellidos');
  const [abierto, setAbierto] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vivo = true;
    Promise.all([fetchReporteCargaHoraria(institucionId), fetchConfigCargaHoraria(institucionId), fetchMinutosPeriodo(institucionId)])
      .then(([f, c, m]) => { if (!vivo) return; setFilas(f); setCfg(c); setCfgForm(c); setMinutos(m); })
      .catch(e => vivo && setError(e.message || 'No se pudo cargar el reporte.'));
    return () => { vivo = false; };
  }, [institucionId, periodoActivo?.id]);

  const datos = useMemo(() => (filas || []).map(d => ({ ...d, estado: estadoDe(d, cfg), mes: d.horas * cfg.semanas_mes })), [filas, cfg]);
  const cuenta = k => datos.filter(d => d.estado.k === k).length;
  const conCarga = datos.filter(d => d.horas > 0).length;
  const mayor = useMemo(() => [...datos].sort((a, b) => b.horas - a.horas)[0], [datos]);
  const top = useMemo(() => [...datos].sort((a, b) => b.horas - a.horas).slice(0, 5), [datos]);

  const visibles = useMemo(() => {
    const ql = q.trim().toLowerCase();
    let r = datos.filter(d => (filtro === 'todos' || d.estado.k === filtro || (filtro === 'sin_todos' && ['sin', 'cargo'].includes(d.estado.k)))
      && (!ql || `${d.apellidos} ${d.nombres} ${d.cedula}`.toLowerCase().includes(ql)));
    r = [...r].sort((a, b) => orden === 'mayor' ? b.horas - a.horas : orden === 'menor' ? a.horas - b.horas : `${a.apellidos} ${a.nombres}`.localeCompare(`${b.apellidos} ${b.nombres}`));
    return r;
  }, [datos, filtro, q, orden]);

  async function guardarCfg() {
    const m = { maxima_semana: Number(cfgForm.maxima_semana), minima_semana: Number(cfgForm.minima_semana), semanas_mes: Number(cfgForm.semanas_mes) };
    if (!(m.maxima_semana >= 1) || !(m.minima_semana >= 0) || m.minima_semana > m.maxima_semana) { showToast?.('err', 'La carga mínima no puede ser mayor que la máxima.'); return; }
    setGuardando(true);
    try { await guardarConfigCargaHoraria(institucionId, m, profile.id); setCfg(m); showToast?.('ok', 'Parámetros de carga guardados.'); }
    catch (e) { showToast?.('err', e.message || 'No se pudo guardar.'); }
    setGuardando(false);
  }

  const nombreDe = d => `${d.apellidos} ${d.nombres}`.trim();
  const horasReloj = h => Math.round((h * minutos / 60) * 10) / 10;
  function exportarResumen() {
    exportarFilasExcel(`carga_horaria_docentes_${new Date().toISOString().slice(0, 10)}.xlsx`, visibles.map(d => ({
      'Cédula': d.cedula, 'Docente': nombreDe(d), 'Cargo/Función': d.cargo || '', 'Materias': d.n_materias, 'Paralelos': d.n_paralelos,
      'Horas/semana': d.horas, ...Object.fromEntries(DIAS.map(x => [x, d.por_dia?.[x] || 0])), [`Horas/mes (≈${cfg.semanas_mes} sem.)`]: d.mes,
      [`Horas reloj/semana (${minutos} min)`]: horasReloj(d.horas), 'Períodos sin ubicar en el horario': Math.max(0, d.horas - d.bloques), 'Estado': d.estado.txt })));
  }
  function exportarDetalle() {
    const out = [];
    visibles.forEach(d => (d.detalle || []).forEach(x => out.push({ 'Cédula': d.cedula, 'Docente': nombreDe(d), 'Curso': x.curso, 'Paralelo': x.paralelo, 'Materia': x.materia, 'Horas/semana': x.horas, 'Períodos en el horario': x.bloques })));
    exportarFilasExcel(`carga_horaria_detalle_${new Date().toISOString().slice(0, 10)}.xlsx`, out);
  }

  if (error) return <div className="lerr" style={{ display: 'flex' }}>{error}</div>;
  if (!filas) return <p className="muted">Calculando carga horaria…</p>;

  const kpi = (titulo, valor, sub, color) => (
    <div className="card" style={{ padding: 12, flex: '1 1 150px' }}>
      <div style={{ fontSize: 11.5, color: 'var(--slate)' }}>{titulo}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || 'inherit' }}>{valor}</div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--slate)' }}>{sub}</div>}
    </div>);
  const sinTodos = cuenta('sin') + cuenta('cargo');

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        {kpi('Docentes activos', datos.length)}
        {kpi('Con carga', conCarga)}
        {kpi('Sin carga', sinTodos, `${cuenta('cargo')} con cargo · ${cuenta('sin')} por revisar`, cuenta('sin') ? 'var(--red)' : undefined)}
        {kpi('Carga baja', cuenta('baja'), `menos de ${cfg.minima_semana} h/sem`, cuenta('baja') ? '#d97706' : undefined)}
        {kpi('Exceden el máximo', cuenta('excede'), `más de ${cfg.maxima_semana} h/sem`, cuenta('excede') ? 'var(--red)' : undefined)}
        {mayor && mayor.horas > 0 && kpi('Mayor carga', `${mayor.horas} h`, nombreDe(mayor))}
      </div>

      <div className="card" style={{ padding: 14, marginBottom: 14 }}>
        <strong style={{ fontSize: 14 }}>Parámetros de carga horaria</strong>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 8 }}>
          {[['maxima_semana', 'Carga máxima (h/semana)'], ['minima_semana', 'Carga mínima (h/semana)'], ['semanas_mes', 'Semanas por mes']].map(([k, et]) => (
            <div key={k}><label className="fl">{et}</label>
              <input className="fc" type="number" min="0" style={{ width: 150 }} disabled={!puedeConfig} value={cfgForm?.[k] ?? ''} onChange={e => setCfgForm(f => ({ ...f, [k]: e.target.value }))} /></div>))}
          {puedeConfig && <button className="btn btn-primary" disabled={guardando} onClick={guardarCfg}>{guardando ? 'Guardando…' : 'Guardar'}</button>}
        </div>
        <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>Una hora es un período de clase de {minutos} min. Los valores 30 y 20 son iniciales: ajústalos a la normativa de tu institución. Horas/mes = horas por semana × semanas por mes.</p>
      </div>

      {top.length > 0 && top[0].horas > 0 && (
        <div className="card" style={{ padding: 14, marginBottom: 14 }}>
          <strong style={{ fontSize: 14 }}>Docentes con mayor carga horaria</strong>
          {top.map(d => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, fontSize: 13 }}>
              <div style={{ width: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombreDe(d)}</div>
              <div style={{ flex: 1, height: 10, background: 'var(--line)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, (d.horas / Math.max(cfg.maxima_semana, top[0].horas)) * 100)}%`, height: '100%', background: d.horas > cfg.maxima_semana ? 'var(--red)' : 'var(--blue, #2563eb)' }} /></div>
              <div style={{ width: 70, textAlign: 'right' }}><strong>{d.horas} h</strong></div>
            </div>))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <input className="fc" style={{ width: 240 }} placeholder="Buscar docente o cédula…" value={q} onChange={e => setQ(e.target.value)} />
        <select className="fc" style={{ width: 200 }} value={filtro} onChange={e => setFiltro(e.target.value)}>
          <option value="todos">Todos ({datos.length})</option>
          <option value="sin_todos">Sin carga ({sinTodos})</option>
          <option value="sin">Sin carga y sin cargo ({cuenta('sin')})</option>
          <option value="cargo">Sin carga con cargo ({cuenta('cargo')})</option>
          <option value="baja">Carga baja ({cuenta('baja')})</option>
          <option value="normal">Normal ({cuenta('normal')})</option>
          <option value="excede">Exceden el máximo ({cuenta('excede')})</option>
        </select>
        <select className="fc" style={{ width: 170 }} value={orden} onChange={e => setOrden(e.target.value)}>
          <option value="apellidos">Orden: apellidos</option><option value="mayor">Mayor carga primero</option><option value="menor">Menor carga primero</option>
        </select>
        <button className="btn btn-secondary btn-sm" onClick={exportarResumen}>⬇️ Excel resumen</button>
        <button className="btn btn-secondary btn-sm" onClick={exportarDetalle}>⬇️ Excel detalle (materia por materia)</button>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="data" style={{ width: '100%' }}>
          <thead><tr>
            <th>#</th><th>Docente</th><th>Cargo</th><th>Mat.</th><th>Paral.</th><th>H/sem</th>
            {DIAS.map(x => <th key={x} title={x}>{DIA_C[x]}</th>)}
            <th title={`≈ ${cfg.semanas_mes} semanas`}>H/mes</th><th title={`Horas reloj de ${minutos} min`}>H reloj/sem</th><th>Estado</th><th></th>
          </tr></thead>
          <tbody>
            {visibles.length === 0 && <tr><td colSpan={14} className="muted" style={{ textAlign: 'center', padding: 16 }}>Sin docentes con ese filtro.</td></tr>}
            {visibles.map((d, i) => (
              <React.Fragment key={d.id}>
                <tr>
                  <td>{i + 1}</td>
                  <td><strong>{nombreDe(d)}</strong><div className="mono muted" style={{ fontSize: 11 }}>{d.cedula}</div></td>
                  <td>{d.cargo || '—'}</td><td>{d.n_materias}</td><td>{d.n_paralelos}</td>
                  <td><strong>{d.horas}</strong>{d.horas > d.bloques && <span title={`Faltan ${d.horas - d.bloques} períodos por ubicar en el horario`} style={{ color: '#d97706', marginLeft: 4 }}>⚠</span>}</td>
                  {DIAS.map(x => <td key={x}>{d.por_dia?.[x] || '·'}</td>)}
                  <td>{d.mes}</td><td>{horasReloj(d.horas)}</td>
                  <td><span className={'badge ' + d.estado.cls}>{d.estado.txt}</span></td>
                  <td>{d.n_materias > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setAbierto(abierto === d.id ? '' : d.id)}>{abierto === d.id ? '▲' : '▼'}</button>}</td>
                </tr>
                {abierto === d.id && (
                  <tr><td colSpan={14} style={{ background: 'var(--bg, #f8fafc)' }}>
                    <table className="data" style={{ width: '100%', margin: '4px 0' }}>
                      <thead><tr><th>Curso</th><th>Paralelo</th><th>Materia</th><th>Horas/sem</th><th>En el horario</th></tr></thead>
                      <tbody>{(d.detalle || []).map((x, j) => <tr key={j}><td>{x.curso}</td><td>{x.paralelo}</td><td>{x.materia}</td><td>{x.horas}</td><td>{x.bloques}</td></tr>)}</tbody>
                    </table>
                  </td></tr>)}
              </React.Fragment>))}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        L, M, X, J, V = períodos por día según el horario cargado. ⚠ = hay horas asignadas que aún no están ubicadas en el horario.
        Los docentes sin carga que tienen un cargo en su ficha (por ejemplo, Inspector) aparecen como justificados; edita el campo «Función / Cargo» de la ficha para registrarlo.
      </p>
    </div>
  );
}
