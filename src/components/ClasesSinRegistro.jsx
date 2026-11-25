import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../lib/SessionContext.jsx';
import { fetchClasesSinAsistencia, fetchEstudiantesDeParalelo, registrarAsistenciaInspeccion } from '../lib/data.js';
import { agruparPorFecha, construirMarcas, rankingDocentes, resumenMarcas, validarMarcas } from '../lib/clasesSinRegistro.js';

const ROLES_REGISTRAN = ['super_admin', 'admin_plantel', 'secretario', 'inspector_general', 'supervisor_plantel'];
const hoyEC = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Guayaquil' }));
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fechaLarga = f => new Date(f + 'T12:00:00').toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' });

function ModalRegistrar({ clase, onClose, onGuardado }) {
  const [est, setEst] = useState(null);
  const [estados, setEstados] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { fetchEstudiantesDeParalelo(clase.paralelo_id).then(setEst).catch(e => setError(e.message)); }, [clase.paralelo_id]);
  const marcas = useMemo(() => construirMarcas(estados), [estados]);
  const { ausentes, atrasos } = resumenMarcas(marcas);
  const poner = (id, patch) => setEstados(s => ({ ...s, [id]: { ...(s[id] || { estado: 'presente' }), ...patch } }));

  async function guardar() {
    const v = validarMarcas(estados);
    if (v) { setError(v); return; }
    setGuardando(true); setError('');
    try { await registrarAsistenciaInspeccion(clase.docente_materia_id, clase.fecha, marcas); onGuardado(); }
    catch (e) { setError(e.message); setGuardando(false); }
  }

  return (
    <div className="modal-bg" onClick={() => !guardando && onClose()}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <h3>Registrar clase sin asistencia</h3>
        <p style={{ fontSize: 13, margin: '0 0 8px' }}>
          <strong>{clase.materia}</strong> · {clase.curso} «{clase.paralelo}» · {clase.docente}<br />
          {fechaLarga(clase.fecha)} · {clase.franjas}
        </p>
        <p style={{ fontSize: 12.5, background: 'var(--amberXL)', color: 'var(--amberD)', padding: '8px 10px', borderRadius: 8 }}>
          Se registra la clase completa dentro de esta materia: los estudiantes no marcados quedan <strong>presentes</strong>.
          Queda constancia de que lo registró Inspección. Las faltas justificadas se manejan desde Justificaciones.
        </p>
        {error && <p style={{ color: 'var(--red)', fontSize: 13 }}>{error}</p>}
        {!est ? <p style={{ fontSize: 13 }}>Cargando estudiantes…</p> : (
          <div style={{ maxHeight: 340, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            <table className="tbl"><thead><tr><th>Estudiante</th><th>Estado</th><th>Hora de llegada</th></tr></thead>
              <tbody>{est.map(e => {
                const v = estados[e.id] || { estado: 'presente' };
                return (
                  <tr key={e.id}>
                    <td>{e.apellidos} {e.nombres}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {[['presente', 'Presente'], ['ausente', 'Falta'], ['atraso', 'Atraso']].map(([k, lbl]) => (
                        <button key={k} type="button" className={'btn btn-sm ' + (v.estado === k ? (k === 'presente' ? 'btn-primary' : 'btn-secondary') : 'btn-ghost')}
                          style={v.estado === k && k !== 'presente' ? { borderColor: k === 'ausente' ? 'var(--red)' : 'var(--amber)', fontWeight: 700 } : undefined}
                          onClick={() => poner(e.id, { estado: k })}>{lbl}</button>
                      ))}
                    </td>
                    <td>{v.estado === 'atraso' && <input className="fc" type="time" style={{ width: 120 }} value={v.hora || ''} onChange={ev => poner(e.id, { hora: ev.target.value })} />}</td>
                  </tr>
                );
              })}</tbody></table>
          </div>
        )}
        <div className="modal-f" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12.5, color: 'var(--slate)' }}>{est ? `${est.length} estudiantes · ${ausentes} falta(s) · ${atrasos} atraso(s)` : ''}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" disabled={guardando} onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" disabled={guardando || !est || est.length === 0} onClick={guardar}>{guardando ? 'Guardando…' : 'Registrar clase'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Clases del horario que ya terminaron y no tienen asistencia. El docente ve las suyas; Inspección y administración ven todas y pueden registrarlas. */
export default function ClasesSinRegistro() {
  const { profile, institucion } = useSession();
  const puedeRegistrar = ROLES_REGISTRAN.includes(profile.rolDb);
  const [dias, setDias] = useState(7);
  const [clases, setClases] = useState(null);
  const [error, setError] = useState('');
  const [abrir, setAbrir] = useState(null);

  const cargar = useCallback(async () => {
    setError(''); setClases(null);
    const hoy = hoyEC(); const desde = new Date(hoy); desde.setDate(desde.getDate() - dias);
    try { setClases(await fetchClasesSinAsistencia(iso(desde), iso(hoy), institucion?.id || null)); }
    catch (e) { setError(e.message || 'No se pudo consultar.'); setClases([]); }
  }, [dias, institucion?.id]);
  useEffect(() => { cargar(); }, [cargar]);

  const grupos = useMemo(() => agruparPorFecha(clases || []), [clases]);
  const ranking = useMemo(() => rankingDocentes(clases || []), [clases]);

  if (!institucion?.id && profile.rolDb === 'super_admin') return <p style={{ fontSize: 13 }}>Entra a un plantel para ver sus clases sin asistencia.</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <div>
          <h3 style={{ margin: 0 }}>Clases sin registro de asistencia</h3>
          <div style={{ fontSize: 12.5, color: 'var(--slate)' }}>
            Clases del horario que ya terminaron (días lectivos del calendario) y no tienen ningún registro. La asistencia sigue siendo por materia.
          </div>
        </div>
        <select className="fc" style={{ width: 170 }} value={dias} onChange={e => setDias(Number(e.target.value))}>
          <option value={0}>Solo hoy</option><option value={3}>Últimos 3 días</option><option value={7}>Últimos 7 días</option><option value={14}>Últimos 14 días</option><option value={30}>Últimos 30 días</option>
        </select>
      </div>
      {profile.rolDb === 'docente' && (
        <p style={{ fontSize: 12.5, background: 'var(--brandL)', color: 'var(--brandD)', padding: '8px 10px', borderRadius: 8 }}>
          Estas son las clases de tu horario sin asistencia. Las de hoy puedes registrarlas en «Registro diario»; pasado el día ya no puedes modificarlas y debe hacerlo Inspección.
        </p>
      )}
      {error && <p style={{ color: 'var(--red)', fontSize: 13 }}>{error}</p>}
      {clases === null ? <p style={{ fontSize: 13 }}>Consultando…</p> : clases.length === 0 && !error ? (
        <div className="card"><div className="cb" style={{ fontSize: 13 }}>✅ No hay clases sin registro en este período.</div></div>
      ) : (
        <>
          <div style={{ fontSize: 13, margin: '0 0 10px' }}>
            <strong>{clases.length}</strong> clase{clases.length === 1 ? '' : 's'} sin registro
            {profile.rolDb !== 'docente' && ranking.length > 0 && <> · mayor pendiente: {ranking.slice(0, 3).map(r => `${r.docente} (${r.total})`).join(', ')}</>}
          </div>
          {grupos.map(g => (
            <div key={g.fecha} className="card" style={{ marginBottom: 10 }}>
              <div className="ch"><h3 style={{ textTransform: 'capitalize' }}>{fechaLarga(g.fecha)} · {g.items.length}</h3></div>
              <div className="cb" style={{ overflowX: 'auto' }}>
                <table className="tbl"><thead><tr><th>Curso</th><th>Materia</th><th>Docente</th><th>Horas</th><th>Estud.</th><th /></tr></thead>
                  <tbody>{g.items.map(c => (
                    <tr key={c.docente_materia_id + c.fecha}>
                      <td>{c.curso} «{c.paralelo}»</td><td>{c.materia}</td><td>{c.docente}</td><td style={{ fontSize: 12 }}>{c.franjas}</td><td>{c.estudiantes}</td>
                      <td style={{ textAlign: 'right' }}>{puedeRegistrar && <button className="btn btn-primary btn-sm" onClick={() => setAbrir(c)}>Registrar</button>}</td>
                    </tr>
                  ))}</tbody></table>
              </div>
            </div>
          ))}
        </>
      )}
      {abrir && <ModalRegistrar clase={abrir} onClose={() => setAbrir(null)} onGuardado={() => { setAbrir(null); cargar(); }} />}
    </div>
  );
}

/** Aviso para el panel del Inspector: cuántas clases de HOY ya terminaron sin asistencia. */
export function AvisoClasesSinRegistro() {
  const { institucion } = useSession();
  const [n, setN] = useState(null);
  useEffect(() => {
    const hoy = iso(hoyEC());
    fetchClasesSinAsistencia(hoy, hoy, institucion?.id || null).then(c => setN(c)).catch(() => setN(null));
  }, [institucion?.id]);
  if (n === null) return null;
  const docentes = new Set(n.map(c => c.docente)).size;
  return (
    <div className="card" style={{ margin: '8px 0 14px', borderLeft: `4px solid ${n.length ? 'var(--amber)' : 'var(--green)'}` }}>
      <div className="cb" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13.5 }}>
          {n.length === 0
            ? '✅ Todas las clases de hoy que ya terminaron tienen asistencia.'
            : <><strong>{n.length}</strong> clase{n.length === 1 ? '' : 's'} de hoy sin asistencia ({docentes} docente{docentes === 1 ? '' : 's'}).</>}
        </div>
        <Link to="/asistencia" className="btn btn-secondary btn-sm">Ver clases sin registro</Link>
      </div>
    </div>
  );
}
