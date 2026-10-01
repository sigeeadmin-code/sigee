import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import {
  fetchGradosConParalelos, fetchCargasDocente, fetchTodasCargas, fetchEstudiantesParalelo,
  fetchAportesCarga, fetchConfigEvaluacion, fetchNotasParalelo, guardarNotasTrimestre, guardarSupletorios, guardarCasilleros
} from '../lib/data.js';
import {
  TRIMESTRES, configPorDefecto, validarConfig, calcTrimestre, aplicarMejora, escalaDAAPA, calcAnual, aDos
} from '../lib/calificaciones.js';
import Placeholder from './Placeholder.jsx';

const ROLES_EDITAN = ['super_admin', 'admin_plantel', 'secretario', 'docente'];
const ROLES_CONSULTA = ['inspector_general', 'supervisor_plantel', 'supervisor_general', 'contador_general', 'contador_plantel', 'administrativo'];
const TRIM_LABEL = { T1: 'Trimestre 1', T2: 'Trimestre 2', T3: 'Trimestre 3' };
const ESTADO_BADGE = { aprobado: 'b-ok', supletorio: 'b-warn', remedial: 'b-err', pendiente: 'b-muted' };
const ESTADO_LABEL = { aprobado: 'Aprobado', supletorio: 'Supletorio', remedial: 'Remedial', pendiente: 'En curso' };
const fmt = n => (n === null || n === undefined ? '—' : Number(n).toFixed(2));

function gridVacio(cfg) {
  return {
    ind: cfg.ind.map(g => Array(g.n).fill('')),
    grp: cfg.grp.map(g => Array(g.n).fill('')),
    sum: cfg.sum.map(g => Array(g.n).fill('')),
    mejora: { mejora_directa: '', refuerzo: '', mejora_refuerzo: '' }
  };
}
const celdaValida = v => v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 10);
const aNum = v => (v === '' || v === null || v === undefined ? null : Number(v));

export default function Calificaciones() {
  const { profile } = useSession();
  const rolDb = profile?.rolDb;
  if (!ROLES_EDITAN.includes(rolDb) && !ROLES_CONSULTA.includes(rolDb)) {
    return <Placeholder title="Calificaciones — vista de estudiantes y representantes (próxima fase)" />;
  }
  return <CuadroCalificaciones />;
}

function CuadroCalificaciones() {
  const { profile, institucion, data } = useSession();
  const rolDb = profile.rolDb;
  const esDocente = rolDb === 'docente';
  const puedeEditar = ROLES_EDITAN.includes(rolDb);
  const institucionId = institucion?.id;
  const periodoActivo = data?.periodoActivo;

  const [vista, setVista] = useState('registro'); // 'registro' | 'cuadro'
  const [grados, setGrados] = useState([]);
  const [cargasTodas, setCargasTodas] = useState([]);
  const [gradoId, setGradoId] = useState('');
  const [paraleloId, setParaleloId] = useState('');
  const [cargaId, setCargaId] = useState('');
  const [trim, setTrim] = useState('T1');
  const [cfg, setCfg] = useState(configPorDefecto());
  const [alumnos, setAlumnos] = useState([]);
  const [grid, setGrid] = useState({});
  const [sucios, setSucios] = useState({});
  const [loading, setLoading] = useState(true);
  const [cargandoNotas, setCargandoNotas] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState(null);
  const [panelCas, setPanelCas] = useState(false);
  const [casEdit, setCasEdit] = useState(null);
  const [guardandoCas, setGuardandoCas] = useState(false);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }, [toast]);

  // Base: solo cursos BGU (1ro, 2do y 3ro de Bachillerato). Otros niveles llegan en fases siguientes.
  useEffect(() => {
    if (!institucionId) return;
    let activo = true;
    (async () => {
      setLoading(true);
      const gr = (await fetchGradosConParalelos(institucionId)).filter(g => g.nivel === 'BGU');
      const cs = esDocente ? await fetchCargasDocente(profile.id, institucionId) : await fetchTodasCargas(institucionId);
      if (!activo) return;
      const delPeriodo = cs.filter(c => !periodoActivo || c.periodoId === periodoActivo.id);
      setGrados(gr); setCargasTodas(delPeriodo);
      const visibles = esDocente ? gr.filter(g => g.paralelos.some(p => delPeriodo.some(c => c.paraleloId === p.id))) : gr;
      const g0 = visibles[0];
      if (g0) {
        setGradoId(g0.id);
        const p0 = esDocente ? g0.paralelos.find(p => delPeriodo.some(c => c.paraleloId === p.id)) : g0.paralelos[0];
        setParaleloId(p0?.id || '');
      }
      setLoading(false);
    })();
    return () => { activo = false; };
  }, [institucionId, esDocente, profile.id, periodoActivo?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const gradosVisibles = useMemo(
    () => (esDocente ? grados.filter(g => g.paralelos.some(p => cargasTodas.some(c => c.paraleloId === p.id))) : grados),
    [grados, cargasTodas, esDocente]
  );
  const gradoSel = gradosVisibles.find(g => g.id === gradoId);
  const paralelosVisibles = (gradoSel?.paralelos || []).filter(p => !esDocente || cargasTodas.some(c => c.paraleloId === p.id));
  const cargasParalelo = useMemo(() => cargasTodas.filter(c => c.paraleloId === paraleloId), [cargasTodas, paraleloId]);

  useEffect(() => { setCargaId(cargasParalelo[0]?.id || ''); }, [cargasParalelo]);
  useEffect(() => { setPanelCas(false); }, [cargaId, vista]);

  // Configuración de evaluación del paralelo (o la general de la institución, o la de MAQUETA)
  useEffect(() => {
    if (!institucionId || !paraleloId) return;
    fetchConfigEvaluacion(institucionId, paraleloId, cargaId || null).then(c => setCfg(c && validarConfig(c).length === 0 ? c : configPorDefecto()));
  }, [institucionId, paraleloId, cargaId]);

  // Notas guardadas de la carga + trimestre
  const cargarNotas = useCallback(async () => {
    if (!cargaId || !paraleloId || !periodoActivo) { setAlumnos([]); setGrid({}); return; }
    setCargandoNotas(true);
    const [al, { aportes, mejoras }] = await Promise.all([
      fetchEstudiantesParalelo(paraleloId, periodoActivo.id), fetchAportesCarga(cargaId, trim)
    ]);
    const g = {};
    al.forEach(a => { g[a.id] = gridVacio(cfg); });
    aportes.forEach(r => {
      const reg = g[r.estudiante_id];
      if (reg && reg[r.tipo]?.[r.grupo] && r.actividad < reg[r.tipo][r.grupo].length) reg[r.tipo][r.grupo][r.actividad] = String(Number(r.valor));
    });
    mejoras.forEach(m => {
      const reg = g[m.estudiante_id];
      if (reg) reg.mejora = {
        mejora_directa: m.mejora_directa == null ? '' : String(Number(m.mejora_directa)),
        refuerzo: m.refuerzo == null ? '' : String(Number(m.refuerzo)),
        mejora_refuerzo: m.mejora_refuerzo == null ? '' : String(Number(m.mejora_refuerzo))
      };
    });
    setAlumnos(al); setGrid(g); setSucios({}); setCargandoNotas(false);
  }, [cargaId, paraleloId, trim, periodoActivo?.id, cfg]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (vista === 'registro') cargarNotas(); }, [cargarNotas, vista]);

  const hayCambios = Object.keys(sucios).length > 0;
  const confirmarDescarte = () => !hayCambios || window.confirm('Tienes notas sin guardar. ¿Descartarlas?');

  const setCelda = (estId, tipo, g, a, valor) => {
    const limpio = valor.replace(',', '.');
    setGrid(prev => {
      const copia = { ...prev, [estId]: { ...prev[estId], [tipo]: prev[estId][tipo].map(arr => [...arr]) } };
      copia[estId][tipo][g][a] = limpio;
      return copia;
    });
    setSucios(s => ({ ...s, [estId]: true }));
  };
  const setMejora = (estId, campo, valor) => {
    setGrid(prev => ({ ...prev, [estId]: { ...prev[estId], mejora: { ...prev[estId].mejora, [campo]: valor.replace(',', '.') } } }));
    setSucios(s => ({ ...s, [estId]: true }));
  };

  const calculos = useMemo(() => {
    const out = {};
    alumnos.forEach(a => {
      const r = grid[a.id];
      if (!r) return;
      const num = tipo => r[tipo].map(arr => arr.map(aNum));
      const c = calcTrimestre({ ind: num('ind'), grp: num('grp'), sum: num('sum') }, cfg);
      const mj = Object.fromEntries(Object.entries(r.mejora).map(([k, v]) => [k, aNum(v)]));
      out[a.id] = { ...c, final: c.completo ? aplicarMejora(c.nota, mj) : null };
    });
    return out;
  }, [alumnos, grid, cfg]);

  const hayInvalidas = useMemo(() => Object.values(grid).some(r =>
    ['ind', 'grp', 'sum'].some(t => r[t].some(arr => arr.some(v => !celdaValida(v)))) ||
    Object.values(r.mejora).some(v => !celdaValida(v))), [grid]);

  const abrirCasilleros = () => {
    if (hayCambios) { setToast({ ok: false, t: 'Primero guarda las notas pendientes y luego cambia los casilleros.' }); return; }
    setCasEdit({ ind: cfg.ind.map(g => String(g.n)), grp: cfg.grp.map(g => String(g.n)), sum: cfg.sum.map(g => String(g.n)) });
    setPanelCas(true);
  };
  const guardarCas = async () => {
    const todos = [...casEdit.ind, ...casEdit.grp, ...casEdit.sum];
    if (todos.some(v => !(Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 10))) {
      setToast({ ok: false, t: 'Cada rubro debe tener entre 1 y 10 casilleros.' }); return;
    }
    setGuardandoCas(true);
    try {
      const r = await guardarCasilleros(cargaId, { ind: casEdit.ind.map(Number), grp: casEdit.grp.map(Number), sum: casEdit.sum.map(Number) });
      setCfg(r.config); setPanelCas(false);
      setToast({ ok: true, t: 'Casilleros actualizados para esta materia. Las notas ya guardadas no cambian.' });
    } catch (e) { setToast({ ok: false, t: e.message }); }
    setGuardandoCas(false);
  };

  const guardar = async () => {
    if (hayInvalidas) { setToast({ ok: false, t: 'Hay notas fuera de rango (0 a 10). Corrígelas antes de guardar.' }); return; }
    const registros = alumnos.filter(a => sucios[a.id]).map(a => ({ estudiante_id: a.id, aportes: grid[a.id], mejora: grid[a.id].mejora }));
    if (!registros.length) { setToast({ ok: true, t: 'No hay cambios por guardar.' }); return; }
    setGuardando(true);
    try {
      const r = await guardarNotasTrimestre(cargaId, trim, registros);
      setToast({ ok: true, t: `Guardado: ${r.estudiantes} estudiante(s). ${r.notas_definitivas} nota(s) definitiva(s), ${r.notas_pendientes} pendiente(s) de sumativa.` });
      setSucios({});
    } catch (e) { setToast({ ok: false, t: e.message }); }
    setGuardando(false);
  };

  if (loading) return <div className="card"><div className="cb"><p className="muted">Cargando…</p></div></div>;
  if (!periodoActivo) return <div className="card"><div className="cb"><p className="muted">No hay un período lectivo activo. Actívalo primero en Académico → Configuración.</p></div></div>;

  const editable = puedeEditar && !!cargasParalelo.find(c => c.id === cargaId);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: '0 0 4px' }}>Cuadro de calificaciones · Bachillerato</h2>
          <div style={{ fontSize: 13, color: 'var(--slate)' }}>{institucion?.nombre} · {periodoActivo.nombre}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className={'btn btn-sm ' + (vista === 'registro' ? 'btn-primary' : 'btn-secondary')} onClick={() => { if (confirmarDescarte()) setVista('registro'); }}>Registro de notas</button>
          <button className={'btn btn-sm ' + (vista === 'cuadro' ? 'btn-primary' : 'btn-secondary')} onClick={() => { if (confirmarDescarte()) setVista('cuadro'); }}>Cuadro del paralelo</button>
          {vista === 'registro' && editable && (
            <button className="btn btn-secondary btn-sm" onClick={() => (panelCas ? setPanelCas(false) : abrirCasilleros())}>⚙ Casilleros</button>
          )}
          {vista === 'registro' && editable && (
            <button className="btn btn-success btn-sm" disabled={guardando || !hayCambios} onClick={guardar}>{guardando ? 'Guardando…' : '💾 Guardar trimestre'}</button>
          )}
        </div>
      </div>

      {toast && <div className="card" style={{ marginBottom: 12, borderColor: toast.ok ? 'var(--green)' : 'var(--red)' }}>
        <div className="cb" style={{ fontSize: 13, color: toast.ok ? 'var(--green)' : 'var(--red)' }}>{toast.t}</div></div>}

      <div className="card" style={{ marginBottom: 14 }}><div className="cb">
        <div className="form-grid">
          <div>
            <label className="fl">Curso</label>
            <select className="fc" value={gradoId} onChange={e => {
              if (!confirmarDescarte()) return;
              setGradoId(e.target.value);
              const g = gradosVisibles.find(x => x.id === e.target.value);
              setParaleloId((g?.paralelos.find(p => !esDocente || cargasTodas.some(c => c.paraleloId === p.id)))?.id || '');
            }}>
              {gradosVisibles.length === 0 && <option value="">Sin cursos de Bachillerato</option>}
              {gradosVisibles.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="fl">Paralelo</label>
            <select className="fc" value={paraleloId} onChange={e => { if (confirmarDescarte()) setParaleloId(e.target.value); }}>
              {paralelosVisibles.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          {vista === 'registro' && <div>
            <label className="fl">Materia</label>
            <select className="fc" value={cargaId} onChange={e => { if (confirmarDescarte()) setCargaId(e.target.value); }}>
              {cargasParalelo.length === 0 && <option value="">Sin materias asignadas aquí</option>}
              {cargasParalelo.map(c => <option key={c.id} value={c.id}>{c.materiaNombre}{c.docenteNombre ? ' — ' + c.docenteNombre : ''}</option>)}
            </select>
          </div>}
          {vista === 'registro' && <div>
            <label className="fl">Trimestre</label>
            <select className="fc" value={trim} onChange={e => { if (confirmarDescarte()) setTrim(e.target.value); }}>
              {TRIMESTRES.map(t => <option key={t} value={t}>{TRIM_LABEL[t]}</option>)}
            </select>
          </div>}
        </div>
      </div></div>

      {vista === 'registro' && panelCas && casEdit && (
        <div className="card" style={{ marginBottom: 14 }}><div className="cb">
          <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Casilleros por rubro · esta materia</h3>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--slate)' }}>
            Elige cuántas notas vas a registrar en cada rubro (de 1 a 10). El peso de cada rubro lo define la administración y no cambia.
            No puedes quitar casilleros que ya tengan notas guardadas.
          </p>
          {[['ind', 'Individuales'], ['grp', 'Grupales'], ['sum', 'Sumativas']].map(([tipo, titulo]) => (
            <div key={tipo} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--slate)', textTransform: 'uppercase', marginBottom: 6 }}>{titulo}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {cfg[tipo].map((g, i) => (
                  <label key={g.nombre} style={{ fontSize: 12 }}>
                    <div style={{ marginBottom: 3 }}>{g.nombre} <span style={{ color: 'var(--slate)' }}>(peso {g.peso})</span></div>
                    <input type="number" min="1" max="10" value={casEdit[tipo][i]}
                      onChange={e => setCasEdit(p => ({ ...p, [tipo]: p[tipo].map((v, k) => (k === i ? e.target.value : v)) }))}
                      style={{ width: 64, textAlign: 'center', padding: '5px 4px', border: '1px solid var(--line)', borderRadius: 6 }} />
                  </label>
                ))}
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button className="btn btn-success btn-sm" disabled={guardandoCas} onClick={guardarCas}>{guardandoCas ? 'Guardando…' : 'Aplicar casilleros'}</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setPanelCas(false)}>Cancelar</button>
          </div>
        </div></div>
      )}

      {vista === 'registro'
        ? <RegistroNotas {...{ cfg, alumnos, grid, calculos, editable, cargandoNotas, sucios, setCelda, setMejora }} />
        : <CuadroParalelo paraleloId={paraleloId} cargas={cargasParalelo} periodoActivo={periodoActivo} puedeEditar={puedeEditar} />}
    </div>
  );
}

function RegistroNotas({ cfg, alumnos, grid, calculos, editable, cargandoNotas, sucios, setCelda, setMejora }) {
  if (cargandoNotas) return <div className="card"><div className="cb"><p className="muted">Cargando notas…</p></div></div>;
  if (!alumnos.length) return <div className="card"><div className="cb"><p className="muted">No hay estudiantes matriculados (activos) en este paralelo.</p></div></div>;

  const grupos = [
    ...cfg.ind.map((g, i) => ({ tipo: 'ind', idx: i, ...g, etq: 'Individual' })),
    ...cfg.grp.map((g, i) => ({ tipo: 'grp', idx: i, ...g, etq: 'Grupal' })),
    ...cfg.sum.map((g, i) => ({ tipo: 'sum', idx: i, ...g, etq: 'Sumativa' }))
  ];
  const th = { whiteSpace: 'nowrap', textAlign: 'center', padding: '8px 4px', fontSize: 10 };
  const stick = { position: 'sticky', left: 0, background: 'var(--card, #fff)', zIndex: 1, minWidth: 190 };
  const inp = ok => ({ width: 44, textAlign: 'center', padding: '4px 2px', fontSize: 12, border: '1px solid ' + (ok ? 'var(--line)' : 'var(--red)'), borderRadius: 6 });

  return (
    <div className="card"><div className="cb" style={{ padding: 0, overflowX: 'auto' }}>
      <table className="data" style={{ minWidth: 900 }}>
        <thead>
          <tr>
            <th style={stick} rowSpan={2}>Estudiante</th>
            {grupos.map(g => <th key={g.tipo + g.idx} colSpan={g.n} style={th} title={`${g.etq} · peso ${g.peso}`}>{g.nombre}<br /><span style={{ fontWeight: 400 }}>{g.etq} · {g.peso}</span></th>)}
            <th colSpan={4} style={th}>Trimestre</th>
            <th colSpan={3} style={th}>Mejora (opcional)</th>
            <th style={th} rowSpan={2}>Final</th>
            <th style={th} rowSpan={2}>Escala</th>
          </tr>
          <tr>
            {grupos.flatMap(g => Array.from({ length: g.n }, (_, a) => <th key={g.tipo + g.idx + '-' + a} style={th}>{a + 1}</th>))}
            <th style={th}>Form.</th><th style={th}>70%</th><th style={th}>Sum.</th><th style={th}>30%</th>
            <th style={th}>Directa</th><th style={th}>Refuerzo</th><th style={th}>Mejora</th>
          </tr>
        </thead>
        <tbody>
          {alumnos.map(a => {
            const r = grid[a.id]; const c = calculos[a.id];
            if (!r || !c) return null;
            const esc = escalaDAAPA(c.final);
            return (
              <tr key={a.id}>
                <td style={stick}>{a.nombre}{sucios[a.id] && <span title="Cambios sin guardar" style={{ color: '#d97706', marginLeft: 6 }}>●</span>}</td>
                {grupos.flatMap(g => r[g.tipo][g.idx].map((v, k) => (
                  <td key={g.tipo + g.idx + '-' + k} style={{ padding: 3, textAlign: 'center' }}>
                    <input inputMode="decimal" style={inp(celdaValida(v))} value={v} disabled={!editable}
                      onChange={e => setCelda(a.id, g.tipo, g.idx, k, e.target.value)} />
                  </td>
                )))}
                <td style={{ textAlign: 'center' }}>{fmt(c.formativo)}</td>
                <td style={{ textAlign: 'center' }}>{fmt(c.formativo70)}</td>
                <td style={{ textAlign: 'center' }}>{fmt(c.sumativo)}</td>
                <td style={{ textAlign: 'center' }}>{fmt(c.sumativo30)}</td>
                {['mejora_directa', 'refuerzo', 'mejora_refuerzo'].map(k => (
                  <td key={k} style={{ padding: 3, textAlign: 'center' }}>
                    <input inputMode="decimal" style={inp(celdaValida(r.mejora[k]))} value={r.mejora[k]} disabled={!editable}
                      onChange={e => setMejora(a.id, k, e.target.value)} />
                  </td>
                ))}
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{c.completo ? fmt(c.final) : <span title="Falta nota formativa o sumativa" className="muted">{fmt(c.nota)}*</span>}</td>
                <td style={{ textAlign: 'center' }}>{c.completo ? <span className={'badge ' + esc.cls} title={esc.label}>{esc.c}</span> : <span className="badge b-muted">—</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--slate)' }}>
        * La nota solo es definitiva (y se guarda para boletas y paneles) cuando el estudiante tiene al menos una nota formativa y una sumativa. Escala: DA 9–10 · AA 7–8.99 · PA 4.01–6.99 · NA ≤ 4.
      </div>
    </div></div>
  );
}

function CuadroParalelo({ paraleloId, cargas, periodoActivo, puedeEditar }) {
  const [alumnos, setAlumnos] = useState([]);
  const [datos, setDatos] = useState({ notas: [], mejoras: [] });
  const [cargando, setCargando] = useState(false);
  const [modo, setModo] = useState('anual'); // 'T1' | 'T2' | 'T3' | 'anual'
  const [recarga, setRecarga] = useState(0);
  const [supEdit, setSupEdit] = useState({});   // { 'cargaId|estId': 'texto' }
  const [guardandoSup, setGuardandoSup] = useState(null);
  const [aviso, setAviso] = useState(null);
  const idsCargas = cargas.map(c => c.id).join(',');

  useEffect(() => {
    if (!paraleloId || !periodoActivo) return;
    let activo = true;
    setCargando(true);
    Promise.all([fetchEstudiantesParalelo(paraleloId, periodoActivo.id), fetchNotasParalelo(idsCargas ? idsCargas.split(',') : [])]).then(([al, d]) => {
      if (!activo) return;
      setAlumnos(al); setDatos(d); setSupEdit({}); setCargando(false);
    });
    return () => { activo = false; };
  }, [paraleloId, periodoActivo?.id, idsCargas, recarga]); // eslint-disable-line react-hooks/exhaustive-deps

  const guardarSup = async carga => {
    const regs = Object.entries(supEdit)
      .filter(([k]) => k.startsWith(carga.id + '|'))
      .map(([k, v]) => ({ estudiante_id: k.split('|')[1], supletorio: v.replace(',', '.').trim() }));
    if (regs.some(r => r.supletorio !== '' && !(Number.isFinite(Number(r.supletorio)) && Number(r.supletorio) >= 0 && Number(r.supletorio) <= 10))) {
      setAviso({ ok: false, t: 'Hay notas de supletorio fuera de rango (0 a 10).' }); return;
    }
    if (!regs.length) { setAviso({ ok: true, t: 'No hay cambios por guardar.' }); return; }
    setGuardandoSup(carga.id);
    try {
      const r = await guardarSupletorios(carga.id, regs);
      setAviso({ ok: true, t: `Supletorio guardado en ${carga.materiaNombre}: ${r.guardados} nota(s).` });
      setRecarga(x => x + 1);
    } catch (e) { setAviso({ ok: false, t: e.message }); }
    setGuardandoSup(null);
  };

  const filas = useMemo(() => {
    const notaDe = (est, carga, t) => {
      const n = datos.notas.find(x => x.estudiante_id === est && x.docente_materia_id === carga && x.periodo_evaluativo === t);
      return n ? Number(n.nota) : null;
    };
    return alumnos.map(a => {
      const porMateria = cargas.map(c => {
        const trims = TRIMESTRES.map(t => notaDe(a.id, c.id, t));
        const sup = datos.mejoras.find(m => m.estudiante_id === a.id && m.docente_materia_id === c.id && m.periodo_evaluativo === 'SUP');
        const anual = calcAnual(trims, sup?.supletorio == null ? null : Number(sup.supletorio));
        return { carga: c, trims, anual };
      });
      const valor = m => (modo === 'anual' ? m.anual.final : m.trims[TRIMESTRES.indexOf(modo)]);
      const vals = porMateria.map(valor).filter(v => v !== null);
      const general = vals.length ? aDos(vals.reduce((x, y) => x + y, 0) / vals.length) : null;
      const estados = porMateria.map(m => m.anual.estado);
      const estado = estados.includes('remedial') ? 'remedial'
        : estados.includes('supletorio') ? 'supletorio'
        : estados.length && estados.every(e => e === 'aprobado') ? 'aprobado' : 'pendiente';
      return { a, porMateria, valor, general, estado };
    });
  }, [alumnos, datos, cargas, modo]);

  if (cargando) return <div className="card"><div className="cb"><p className="muted">Cargando cuadro…</p></div></div>;
  if (!cargas.length) return <div className="card"><div className="cb"><p className="muted">Este paralelo no tiene materias asignadas.</p></div></div>;
  if (!alumnos.length) return <div className="card"><div className="cb"><p className="muted">No hay estudiantes matriculados (activos) en este paralelo.</p></div></div>;

  return (
    <div className="card">
      <div className="cb" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {['T1', 'T2', 'T3', 'anual'].map(m => (
          <button key={m} className={'btn btn-sm ' + (modo === m ? 'btn-primary' : 'btn-secondary')} onClick={() => setModo(m)}>{m === 'anual' ? 'Promedio anual' : TRIM_LABEL[m]}</button>
        ))}
      </div>
      <div className="cb" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="data">
          <thead><tr>
            <th style={{ position: 'sticky', left: 0, background: 'var(--page)', minWidth: 190 }}>Estudiante</th>
            {cargas.map(c => <th key={c.id} style={{ textAlign: 'center' }}>{c.materiaNombre}</th>)}
            <th style={{ textAlign: 'center' }}>Promedio</th>
            <th style={{ textAlign: 'center' }}>Estado</th>
          </tr></thead>
          <tbody>
            {filas.map(f => (
              <tr key={f.a.id}>
                <td style={{ position: 'sticky', left: 0, background: 'var(--card, #fff)' }}>{f.a.nombre}</td>
                {f.porMateria.map(m => {
                  const v = f.valor(m);
                  const bajo = v !== null && v < 7;
                  return <td key={m.carga.id} style={{ textAlign: 'center', color: bajo ? 'var(--red)' : undefined, fontWeight: bajo ? 700 : 400 }}>{fmt(v)}</td>;
                })}
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{fmt(f.general)}</td>
                <td style={{ textAlign: 'center' }}><span className={'badge ' + ESTADO_BADGE[f.estado]}>{ESTADO_LABEL[f.estado]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modo === 'anual' && (() => {
        const tieneSup = (estId, cargaId) => datos.mejoras.some(x => x.estudiante_id === estId && x.docente_materia_id === cargaId && x.periodo_evaluativo === 'SUP' && x.supletorio != null);
        const bloques = cargas.map(c => ({
          carga: c,
          filas: filas.map(f => ({ f, m: f.porMateria.find(x => x.carga.id === c.id) }))
            .filter(({ f, m }) => m.anual.estado === 'supletorio' || tieneSup(f.a.id, c.id))
        })).filter(b => b.filas.length);
        return (
          <div className="cb" style={{ borderTop: '1px solid var(--line)' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>Examen supletorio</h3>
            <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--slate)' }}>
              Pueden rendirlo los estudiantes con promedio anual de 5.00 a 6.99 y los 3 trimestres cerrados. Con 7 o más aprueban con 7.00; con menos pasan a remedial.
            </p>
            {aviso && <div style={{ marginBottom: 10, fontSize: 13, color: aviso.ok ? 'var(--green)' : 'var(--red)' }}>{aviso.t}</div>}
            {bloques.length === 0 && <p className="muted" style={{ margin: 0 }}>Ningún estudiante de este paralelo está en supletorio por ahora.</p>}
            {bloques.map(({ carga, filas: fs }) => (
              <div key={carga.id} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <strong style={{ fontSize: 13 }}>{carga.materiaNombre}</strong>
                  {puedeEditar && <button className="btn btn-success btn-sm" disabled={guardandoSup === carga.id} onClick={() => guardarSup(carga)}>{guardandoSup === carga.id ? 'Guardando…' : '💾 Guardar supletorio'}</button>}
                </div>
                <table className="data"><thead><tr><th>Estudiante</th><th style={{ textAlign: 'center' }}>Promedio anual</th><th style={{ textAlign: 'center' }}>Supletorio</th><th style={{ textAlign: 'center' }}>Resultado</th></tr></thead>
                  <tbody>{fs.map(({ f, m }) => {
                    const llave = carga.id + '|' + f.a.id;
                    const guardado = datos.mejoras.find(x => x.estudiante_id === f.a.id && x.docente_materia_id === carga.id && x.periodo_evaluativo === 'SUP');
                    const valor = supEdit[llave] ?? (guardado?.supletorio == null ? '' : String(Number(guardado.supletorio)));
                    const ok = valor === '' || (Number.isFinite(Number(valor)) && Number(valor) >= 0 && Number(valor) <= 10);
                    return (
                      <tr key={f.a.id}>
                        <td>{f.a.nombre}</td>
                        <td style={{ textAlign: 'center' }}>{fmt(m.anual.promedio)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <input inputMode="decimal" disabled={!puedeEditar} value={valor}
                            onChange={e => setSupEdit(p => ({ ...p, [llave]: e.target.value }))}
                            style={{ width: 54, textAlign: 'center', padding: '4px 2px', fontSize: 12, border: '1px solid ' + (ok ? 'var(--line)' : 'var(--red)'), borderRadius: 6 }} />
                        </td>
                        <td style={{ textAlign: 'center' }}><span className={'badge ' + ESTADO_BADGE[m.anual.estado]}>{ESTADO_LABEL[m.anual.estado]}</span></td>
                      </tr>
                    );
                  })}</tbody></table>
              </div>
            ))}
          </div>
        );
      })()}
      <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--slate)' }}>
        Solo se muestran notas definitivas del trimestre. La boleta imprimible y el remedial se agregan en la siguiente fase.
      </div>
    </div>
  );
}
