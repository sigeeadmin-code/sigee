import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useSession } from '../lib/SessionContext.jsx';
import {
  fetchGradosConParalelos, fetchMateriasParalelo, fetchEstudiantesParaleloDetalle,
  fetchAsistencia, guardarAsistencia, fetchCargasDocente, fetchAsistenciaReciente,
  fetchEstadisticasCurso, fetchHistorialEstudiante
} from '../lib/data.js';
import { mensajeAsistencia } from '../lib/calendario.js';

const ESTADOS = [
  { v: 'presente', label: 'Presente' },
  { v: 'atraso', label: 'Atraso' },
  { v: 'ausente', label: 'Ausente' },
  { v: 'justificado', label: 'Justificado' }
];

function hoyISO() { return new Date().toISOString().slice(0, 10); }
function haceDias(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }

function linkWhatsapp(telefono, nombreAlumno) {
  const tel = (telefono || '').replace(/^0/, '');
  const msg = encodeURIComponent(`Estimado/a representante de ${nombreAlumno}: registramos una inasistencia.`);
  return `https://wa.me/593${tel}?text=${msg}`;
}

function RegistroDiario() {
  const { profile, institucion, data } = useSession();
  const esDocente = profile.rolDb === 'docente';
  const institucionId = institucion?.id;
  const periodoActivo = data?.periodoActivo;

  const [grados, setGrados] = useState([]);
  const [cargasDocente, setCargasDocente] = useState([]);
  const [gradoId, setGradoId] = useState('');
  const [paraleloId, setParaleloId] = useState('');
  const [cargas, setCargas] = useState([]);
  const [docenteMateriaId, setDocenteMateriaId] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [alumnos, setAlumnos] = useState([]);
  const [registros, setRegistros] = useState({});
  const [registrosOriginales, setRegistrosOriginales] = useState({});
  const [obs, setObs] = useState({});
  const [reciente, setReciente] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState(null);
  const [gate, setGate] = useState({ ok: true, msg: '' });

  useEffect(() => {
    let activo = true;
    if (!institucionId || !fecha) return;
    mensajeAsistencia(institucionId, fecha, periodoActivo, paraleloId || null).then(g => { if (activo) setGate(g); });
    return () => { activo = false; };
  }, [institucionId, fecha, periodoActivo, paraleloId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const cargarBase = useCallback(async () => {
    if (!institucionId) return;
    setLoading(true);
    const gr = await fetchGradosConParalelos(institucionId);
    setGrados(gr);
    let cd = [];
    if (esDocente) { cd = await fetchCargasDocente(profile.id, institucionId); setCargasDocente(cd); }
    if (!gradoId) {
      if (esDocente) {
        const primerParaleloId = cd[0]?.paraleloId;
        const gradoDeEsePar = gr.find(g => g.paralelos.some(p => p.id === primerParaleloId));
        if (gradoDeEsePar) { setGradoId(gradoDeEsePar.id); setParaleloId(primerParaleloId); }
      } else if (gr.length) {
        setGradoId(gr[0].id);
        setParaleloId(gr[0].paralelos[0]?.id || '');
      }
    }
    setLoading(false);
  }, [institucionId, esDocente, profile.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { cargarBase(); }, [cargarBase]);

  // gradosVisibles: un docente NUNCA debe poder elegir un curso/paralelo donde no
  // tiene una carga asignada — eso rompería la relación real de datos (vería alumnos ajenos).
  const paralelosPermitidos = useMemo(
    () => esDocente ? new Set(cargasDocente.map(c => c.paraleloId)) : null,
    [esDocente, cargasDocente]
  );
  const gradosVisibles = useMemo(() => {
    if (!paralelosPermitidos) return grados;
    return grados
      .map(g => ({ ...g, paralelos: g.paralelos.filter(p => paralelosPermitidos.has(p.id)) }))
      .filter(g => g.paralelos.length > 0);
  }, [grados, paralelosPermitidos]);
  const gradoSel = gradosVisibles.find(g => g.id === gradoId);

  const cargarCargasParalelo = useCallback(async () => {
    if (!paraleloId || !periodoActivo) { setCargas([]); return; }
    let lista = await fetchMateriasParalelo(paraleloId, periodoActivo.id);
    if (esDocente) {
      const misCargasIds = new Set(cargasDocente.filter(c => c.paraleloId === paraleloId).map(c => c.materiaId));
      lista = lista.filter(c => misCargasIds.has(c.materiaId));
    }
    setCargas(lista);
    setDocenteMateriaId(lista[0]?.id || '');
  }, [paraleloId, periodoActivo, esDocente, cargasDocente]);

  useEffect(() => { cargarCargasParalelo(); }, [cargarCargasParalelo]);

  const cargarAlumnosYAsistencia = useCallback(async () => {
    if (!paraleloId || !periodoActivo) { setAlumnos([]); return; }
    const [als, asis, rec] = await Promise.all([
      fetchEstudiantesParaleloDetalle(paraleloId, periodoActivo.id),
      docenteMateriaId ? fetchAsistencia(docenteMateriaId, fecha) : Promise.resolve([]),
      fetchAsistenciaReciente(docenteMateriaId, 7)
    ]);
    setAlumnos(als);
    const map = {}; const om = {};
    asis.forEach(a => { map[a.estudiante_id] = a.estado; om[a.estudiante_id] = a.observacion || ''; });
    setRegistros(map);
    setRegistrosOriginales(map);
    setObs(om);
    setReciente(rec.filter(r => r.fecha !== fecha)); // el día actual ya se ve arriba, no lo dupliques
  }, [paraleloId, periodoActivo, docenteMateriaId, fecha]);

  useEffect(() => { cargarAlumnosYAsistencia(); }, [cargarAlumnosYAsistencia]);

  function marcar(estId, estado) { setRegistros(r => ({ ...r, [estId]: estado })); }
  function marcarTodos(estado) {
    const nuevo = {};
    alumnos.forEach(a => { nuevo[a.id] = estado; });
    setRegistros(nuevo);
  }

  async function guardar() {
    if (!docenteMateriaId) { setToast({ tipo: 'err', msg: 'Selecciona una materia/carga.' }); return; }
    if (!gate.ok) { setToast({ tipo: 'err', msg: 'No se puede guardar: ' + gate.msg }); return; }
    setGuardando(true);
    try {
      const lista = alumnos.filter(a => registros[a.id]).map(a => ({ estudiante_id: a.id, estado: registros[a.id], observacion: obs[a.id] || '' }));
      await guardarAsistencia(docenteMateriaId, fecha, lista, profile.id);

      // Nota: el aviso a representantes se registra manualmente desde
      // Inasistencias (ahí se envía el WhatsApp y luego se confirma el envío),
      // no automáticamente aquí — avisos_inasistencia representa avisos YA
      // enviados (canal, enviado_at), no una cola de pendientes.
      const nuevasAusencias = alumnos.filter(a => registros[a.id] === 'ausente' && registrosOriginales[a.id] !== 'ausente');

      setRegistrosOriginales(registros);
      setToast({ tipo: 'ok', msg: 'Asistencia guardada.' + (nuevasAusencias.length ? ` ${nuevasAusencias.length} nueva(s) ausencia(s) — revísalas en Inasistencias.` : '') });
    } catch (err) {
      setToast({ tipo: 'err', msg: err.message || 'No se pudo guardar.' });
    }
    setGuardando(false);
  }

  const conteo = useMemo(() => {
    const c = { presente: 0, atraso: 0, ausente: 0, justificado: 0, sin: 0 };
    alumnos.forEach(a => {
      const st = registros[a.id];
      if (st) c[st] = (c[st] || 0) + 1; else c.sin++;
    });
    return c;
  }, [alumnos, registros]);

  if (loading) return <p style={{ fontSize: 13, color: 'var(--slate)' }}>Cargando…</p>;
  if (!periodoActivo) return <div className="card"><div className="cb"><p className="muted">No hay un período lectivo activo. Actívalo primero en Académico → Configuración.</p></div></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: '0 0 4px' }}>Asistencia diaria</h2>
          <div style={{ fontSize: 13, color: 'var(--slate)' }}>{institucion?.nombre} · {periodoActivo.nombre}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-success btn-sm" disabled={!gate.ok} onClick={() => marcarTodos('presente')}>✓ Todos presentes</button>
          <button className="btn btn-primary btn-sm" disabled={guardando || !gate.ok} onClick={guardar}>{guardando ? 'Guardando…' : '💾 Guardar día'}</button>
        </div>
      </div>

      <div className={'card'} style={{ marginBottom: 14, borderColor: gate.ok ? 'var(--green)' : 'var(--red)' }}>
        <div className="cb" style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={'badge ' + (gate.ok ? 'b-ok' : 'b-err')}>{gate.ok ? 'Día lectivo' : 'No lectivo'}</span>
          {gate.msg}
        </div>
      </div>

      <div className="card"><div className="cb">
        <div className="form-grid">
          <div>
            <label className="fl">Curso</label>
            <select className="fc" value={gradoId} onChange={e => { setGradoId(e.target.value); const g = gradosVisibles.find(x => x.id === e.target.value); setParaleloId(g?.paralelos[0]?.id || ''); }}>
              {gradosVisibles.length === 0 && <option value="">Sin cursos asignados</option>}
              {gradosVisibles.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="fl">Paralelo</label>
            <select className="fc" value={paraleloId} onChange={e => setParaleloId(e.target.value)}>
              {(gradoSel?.paralelos || []).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="fl">Materia (carga)</label>
            <select className="fc" value={docenteMateriaId} onChange={e => setDocenteMateriaId(e.target.value)}>
              {cargas.length === 0 && <option value="">Sin materias asignadas aquí</option>}
              {cargas.map(c => <option key={c.id} value={c.id}>{c.materiaNombre}{c.docenteNombre ? ' — ' + c.docenteNombre : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="fl">Fecha</label>
            <input className="fc" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
        </div>
      </div></div>

      <div className="grid-4">
        <div className="metric m-green"><div className="m-lbl">Presentes</div><div className="m-val">{conteo.presente}</div></div>
        <div className="metric m-amber"><div className="m-lbl">Atrasos</div><div className="m-val">{conteo.atraso}</div></div>
        <div className="metric m-red"><div className="m-lbl">Ausentes</div><div className="m-val">{conteo.ausente}</div></div>
        <div className="metric m-blue"><div className="m-lbl">Sin marcar / Justif.</div><div className="m-val" style={{ fontSize: 18 }}>{conteo.sin} / {conteo.justificado}</div></div>
      </div>

      {!docenteMateriaId ? (
        <div className="empty"><span className="ti ti-calendar-check" /><p>Selecciona una materia/carga para tomar asistencia.</p></div>
      ) : alumnos.length === 0 ? (
        <div className="empty"><span className="ti ti-users" /><p>Sin alumnos matriculados en este paralelo.</p></div>
      ) : (
        <div className="card"><div className="cb" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="data" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>#</th><th>Estudiante</th><th>Representante</th>
                {ESTADOS.map(e => <th key={e.v} style={{ textAlign: 'center' }}>{e.label}</th>)}
                <th>Observación</th>
              </tr>
            </thead>
            <tbody>
              {alumnos.map((a, i) => (
                <tr key={a.id}>
                  <td>{i + 1}</td>
                  <td><strong>{a.apellidos} {a.nombres}</strong><div style={{ fontSize: 11, color: 'var(--slate)' }}>{a.cedula}</div></td>
                  <td style={{ fontSize: 12 }}>
                    {a.representante || '—'}
                    {registros[a.id] === 'ausente' && a.telefonoRep && (
                      <div><a href={linkWhatsapp(a.telefonoRep, `${a.nombres} ${a.apellidos}`)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11 }}>
                        <span className="ti ti-brand-whatsapp" /> Avisar
                      </a></div>
                    )}
                  </td>
                  {ESTADOS.map(e => (
                    <td key={e.v} style={{ textAlign: 'center' }}>
                      <input type="radio" name={'as_' + a.id} checked={registros[a.id] === e.v} onChange={() => marcar(a.id, e.v)} />
                    </td>
                  ))}
                  <td>
                    <input className="fc" style={{ minWidth: 120, padding: '4px 8px', fontSize: 12 }}
                      value={obs[a.id] || ''} onChange={ev => setObs(o => ({ ...o, [a.id]: ev.target.value }))}
                      placeholder="—" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      )}

      {docenteMateriaId && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="ch"><h3>Resumen reciente (últimos 7 días)</h3></div>
          <div className="cb" style={{ padding: 0 }}>
            {reciente.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--slate)', padding: 14 }}>Sin registros anteriores en esta carga.</p>
            ) : (
              <table className="data" style={{ width: '100%' }}>
                <thead><tr><th>Fecha</th><th>Estudiante</th><th>Estado</th><th>Observación</th></tr></thead>
                <tbody>
                  {reciente.map((r, i) => (
                    <tr key={i}>
                      <td className="mono">{r.fecha}</td>
                      <td>{r.estudiantes?.apellidos} {r.estudiantes?.nombres}</td>
                      <td><span className={'badge ' + (r.estado === 'presente' ? 'b-ok' : r.estado === 'ausente' ? 'b-err' : r.estado === 'atraso' ? 'b-warn' : 'b-muted')}>{ESTADOS.find(e => e.v === r.estado)?.label || r.estado}</span></td>
                      <td style={{ fontSize: 12 }}>{r.observacion || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {toast && <div className={'toast ' + (toast.tipo === 'ok' ? 'ok' : 'err')}>{toast.msg}</div>}
    </div>
  );
}

const ROLES_VISTA_AMPLIA = ['super_admin', 'admin_plantel', 'secretario', 'inspector_general', 'supervisor_plantel'];

function ConsultasEstadisticas() {
  const { profile, institucion, data } = useSession();
  const esDocente = profile.rolDb === 'docente';
  const vistaAmplia = ROLES_VISTA_AMPLIA.includes(profile.rolDb); // ve todas las materias del curso, no solo una
  const institucionId = institucion?.id;
  const periodoActivo = data?.periodoActivo;

  const [modo, setModo] = useState('curso'); // curso | estudiante
  const [grados, setGrados] = useState([]);
  const [cargasDocente, setCargasDocente] = useState([]);
  const [gradoId, setGradoId] = useState('');
  const [paraleloId, setParaleloId] = useState('');
  const [cargasParalelo, setCargasParalelo] = useState([]); // todas las materias/docentes de ese paralelo (vista amplia)
  const [desde, setDesde] = useState(haceDias(30));
  const [hasta, setHasta] = useState(hoyISO());
  const [filaEstudiantes, setFilaEstudiantes] = useState([]);
  const [estudianteId, setEstudianteId] = useState('');
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let activo = true;
    (async () => {
      if (!institucionId) return;
      setLoading(true);
      const gr = await fetchGradosConParalelos(institucionId);
      if (!activo) return;
      setGrados(gr);
      let cd = [];
      if (esDocente) { cd = await fetchCargasDocente(profile.id, institucionId); setCargasDocente(cd); }
      const primerParalelo = esDocente ? cd[0]?.paraleloId : gr[0]?.paralelos[0]?.id;
      const gradoDelPrimero = gr.find(g => g.paralelos.some(p => p.id === primerParalelo));
      if (gradoDelPrimero) { setGradoId(gradoDelPrimero.id); setParaleloId(primerParalelo); }
      setLoading(false);
    })();
    return () => { activo = false; };
  }, [institucionId, esDocente, profile.id]);

  const gradosVisibles = useMemo(() => {
    if (!esDocente) return grados;
    const paralelosPermitidos = new Set(cargasDocente.map(c => c.paraleloId));
    return grados.map(g => ({ ...g, paralelos: g.paralelos.filter(p => paralelosPermitidos.has(p.id)) })).filter(g => g.paralelos.length);
  }, [grados, esDocente, cargasDocente]);
  const gradoSel = gradosVisibles.find(g => g.id === gradoId);

  // Qué docente_materia_id(s) cuentan para las estadísticas de este paralelo.
  useEffect(() => {
    let activo = true;
    (async () => {
      if (!paraleloId || !periodoActivo) return;
      if (esDocente && !vistaAmplia) {
        const ids = cargasDocente.filter(c => c.paraleloId === paraleloId).map(c => c.id);
        if (activo) setCargasParalelo(ids.map(id => ({ id })));
      } else {
        const todas = await fetchMateriasParalelo(paraleloId, periodoActivo.id);
        if (activo) setCargasParalelo(todas);
      }
    })();
    return () => { activo = false; };
  }, [paraleloId, periodoActivo, esDocente, vistaAmplia, cargasDocente]);

  const docenteMateriaIds = cargasParalelo.map(c => c.id).filter(Boolean);

  useEffect(() => {
    let activo = true;
    (async () => {
      if (!paraleloId || !docenteMateriaIds.length) { setFilaEstudiantes([]); return; }
      setLoading(true);
      const rows = await fetchEstadisticasCurso(paraleloId, docenteMateriaIds, desde, hasta);
      if (activo) { setFilaEstudiantes(rows.sort((a, b) => (a.pct ?? 999) - (b.pct ?? 999))); setLoading(false); }
    })();
    return () => { activo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paraleloId, desde, hasta, JSON.stringify(docenteMateriaIds)]);

  useEffect(() => {
    let activo = true;
    (async () => {
      if (!estudianteId || !docenteMateriaIds.length) { setHistorial([]); return; }
      const rows = await fetchHistorialEstudiante(estudianteId, docenteMateriaIds, desde, hasta);
      if (activo) setHistorial(rows);
    })();
    return () => { activo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estudianteId, desde, hasta, JSON.stringify(docenteMateriaIds)]);

  const totales = filaEstudiantes.reduce((acc, a) => ({
    presente: acc.presente + a.presente, atraso: acc.atraso + a.atraso, ausente: acc.ausente + a.ausente, justificado: acc.justificado + a.justificado
  }), { presente: 0, atraso: 0, ausente: 0, justificado: 0 });
  const datosGrafico = [
    { name: 'Presente', value: totales.presente, color: '#22c55e' },
    { name: 'Atraso', value: totales.atraso, color: '#f59e0b' },
    { name: 'Ausente', value: totales.ausente, color: '#ef4444' },
    { name: 'Justificado', value: totales.justificado, color: '#94a3b8' }
  ].filter(d => d.value > 0);

  const estudianteSel = filaEstudiantes.find(a => a.id === estudianteId);

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14, alignItems: 'flex-end' }}>
        <div>
          <label className="fl">Curso</label>
          <select className="fc" value={gradoId} onChange={e => { setGradoId(e.target.value); const g = gradosVisibles.find(x => x.id === e.target.value); setParaleloId(g?.paralelos[0]?.id || ''); setEstudianteId(''); }}>
            {gradosVisibles.length === 0 && <option value="">Sin cursos asignados</option>}
            {gradosVisibles.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="fl">Paralelo</label>
          <select className="fc" value={paraleloId} onChange={e => { setParaleloId(e.target.value); setEstudianteId(''); }}>
            {gradoSel?.paralelos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <div><label className="fl">Desde</label><input className="fc" type="date" value={desde} onChange={e => setDesde(e.target.value)} /></div>
        <div><label className="fl">Hasta</label><input className="fc" type="date" value={hasta} onChange={e => setHasta(e.target.value)} /></div>
        {esDocente && !vistaAmplia && (
          <div style={{ fontSize: 11, color: 'var(--slate)', maxWidth: 220 }}>Solo se cuentan tus propias clases en este curso.</div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button className={'btn btn-sm ' + (modo === 'curso' ? 'btn-primary' : 'btn-secondary')} onClick={() => setModo('curso')}>Por curso</button>
        <button className={'btn btn-sm ' + (modo === 'estudiante' ? 'btn-primary' : 'btn-secondary')} onClick={() => setModo('estudiante')}>Por estudiante</button>
      </div>

      {loading ? <p style={{ fontSize: 13, color: 'var(--slate)' }}>Cargando…</p> : modo === 'curso' ? (
        <>
          {datosGrafico.length > 0 && (
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="ch"><h3>Distribución general</h3></div>
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
          <div className="card"><div className="cb" style={{ padding: 0, overflowX: 'auto' }}>
            {filaEstudiantes.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--slate)', padding: 14 }}>Sin datos para este curso en el rango elegido.</p>
            ) : (
              <table className="data" style={{ width: '100%' }}>
                <thead><tr><th>Estudiante</th><th>Presente</th><th>Atraso</th><th>Ausente</th><th>Justificado</th><th>Total</th><th>% Asistencia</th></tr></thead>
                <tbody>
                  {filaEstudiantes.map(a => (
                    <tr key={a.id} style={{ cursor: 'pointer' }} onClick={() => { setEstudianteId(a.id); setModo('estudiante'); }}>
                      <td><strong>{a.nombre}</strong></td>
                      <td>{a.presente}</td><td>{a.atraso}</td><td>{a.ausente}</td><td>{a.justificado}</td><td>{a.total}</td>
                      <td>{a.pct === null ? '—' : <span className={'badge ' + (a.pct >= 90 ? 'b-ok' : a.pct >= 75 ? 'b-warn' : 'b-err')}>{a.pct}%</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div></div>
        </>
      ) : (
        <div className="card">
          <div className="cb">
            <label className="fl">Estudiante</label>
            <select className="fc" value={estudianteId} onChange={e => setEstudianteId(e.target.value)} style={{ maxWidth: 320, marginBottom: 14 }}>
              <option value="">Selecciona un estudiante…</option>
              {filaEstudiantes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>

            {estudianteSel && (
              <div className="grid-4" style={{ marginBottom: 14 }}>
                <div className="metric m-green"><div className="m-lbl">Presente</div><div className="m-val">{estudianteSel.presente}</div></div>
                <div className="metric m-amber"><div className="m-lbl">Atraso</div><div className="m-val">{estudianteSel.atraso}</div></div>
                <div className="metric m-red"><div className="m-lbl">Ausente</div><div className="m-val">{estudianteSel.ausente}</div></div>
                <div className="metric m-blue"><div className="m-lbl">Justificado</div><div className="m-val">{estudianteSel.justificado}</div></div>
              </div>
            )}

            {!estudianteId ? (
              <p style={{ fontSize: 13, color: 'var(--slate)' }}>Elige un estudiante para ver su historial detallado.</p>
            ) : historial.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--slate)' }}>Sin registros en el rango elegido.</p>
            ) : (
              <table className="data" style={{ width: '100%' }}>
                <thead><tr><th>Fecha</th><th>Materia</th><th>Estado</th><th>Observación</th></tr></thead>
                <tbody>
                  {historial.map((r, i) => (
                    <tr key={i}>
                      <td className="mono">{r.fecha}</td>
                      <td>{r.materia}</td>
                      <td><span className={'badge ' + (r.estado === 'presente' ? 'b-ok' : r.estado === 'ausente' ? 'b-err' : r.estado === 'atraso' ? 'b-warn' : 'b-muted')}>{ESTADOS.find(e => e.v === r.estado)?.label || r.estado}</span></td>
                      <td style={{ fontSize: 12 }}>{r.observacion || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Asistencia() {
  const [tab, setTab] = useState('registro');
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className={'btn btn-sm ' + (tab === 'registro' ? 'btn-primary' : 'btn-secondary')} onClick={() => setTab('registro')}>Registro diario</button>
        <button className={'btn btn-sm ' + (tab === 'consultas' ? 'btn-primary' : 'btn-secondary')} onClick={() => setTab('consultas')}>Consultas y estadísticas</button>
      </div>
      {tab === 'registro' ? <RegistroDiario /> : <ConsultasEstadisticas />}
    </div>
  );
}
