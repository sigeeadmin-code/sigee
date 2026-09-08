import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import {
  fetchGradosConParalelos, fetchMateriasParalelo, fetchEstudiantesParaleloDetalle,
  fetchAsistencia, guardarAsistencia, fetchCargasDocente
} from '../lib/data.js';

const ESTADOS = [
  { v: 'presente', label: 'Presente' },
  { v: 'tarde', label: 'Tarde' },
  { v: 'ausente', label: 'Ausente' },
  { v: 'justificado', label: 'Justificado' }
];

function hoyISO() { return new Date().toISOString().slice(0, 10); }

function linkWhatsapp(telefono, nombreAlumno) {
  const tel = (telefono || '').replace(/^0/, '');
  const msg = encodeURIComponent(`Estimado/a representante de ${nombreAlumno}: registramos una inasistencia.`);
  return `https://wa.me/593${tel}?text=${msg}`;
}

export default function Asistencia() {
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
  const [obs, setObs] = useState({});
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState(null);

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
    if (esDocente) setCargasDocente(await fetchCargasDocente(profile.id, institucionId));
    if (!gradoId && gr.length) {
      setGradoId(gr[0].id);
      setParaleloId(gr[0].paralelos[0]?.id || '');
    }
    setLoading(false);
  }, [institucionId, esDocente, profile.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { cargarBase(); }, [cargarBase]);

  const gradoSel = grados.find(g => g.id === gradoId);

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
    const [als, asis] = await Promise.all([
      fetchEstudiantesParaleloDetalle(paraleloId, periodoActivo.id),
      docenteMateriaId ? fetchAsistencia(docenteMateriaId, fecha) : Promise.resolve([])
    ]);
    setAlumnos(als);
    const map = {}; const om = {};
    asis.forEach(a => { map[a.estudiante_id] = a.estado; });
    setRegistros(map);
    setObs(om);
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
    setGuardando(true);
    try {
      const lista = alumnos.filter(a => registros[a.id]).map(a => ({ estudiante_id: a.id, estado: registros[a.id] }));
      await guardarAsistencia(docenteMateriaId, fecha, lista, profile.id);
      setToast({ tipo: 'ok', msg: 'Asistencia guardada.' });
    } catch (err) {
      setToast({ tipo: 'err', msg: err.message || 'No se pudo guardar.' });
    }
    setGuardando(false);
  }

  const conteo = useMemo(() => {
    const c = { presente: 0, tarde: 0, ausente: 0, justificado: 0, sin: 0 };
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
          <button className="btn btn-success btn-sm" onClick={() => marcarTodos('presente')}>✓ Todos presentes</button>
          <button className="btn btn-primary btn-sm" disabled={guardando} onClick={guardar}>{guardando ? 'Guardando…' : '💾 Guardar día'}</button>
        </div>
      </div>

      <div className="card"><div className="cb">
        <div className="form-grid">
          <div>
            <label className="fl">Curso</label>
            <select className="fc" value={gradoId} onChange={e => { setGradoId(e.target.value); const g = grados.find(x => x.id === e.target.value); setParaleloId(g?.paralelos[0]?.id || ''); }}>
              {grados.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
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
        <div className="metric m-amber"><div className="m-lbl">Tardanzas</div><div className="m-val">{conteo.tarde}</div></div>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      )}

      {toast && <div className={'toast ' + (toast.tipo === 'ok' ? 'ok' : 'err')}>{toast.msg}</div>}
    </div>
  );
}
