import React, { useEffect, useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import {
  fetchMetricasGlobales, fetchEstudianteIdPorProfile, fetchHijosDeRepresentante, fetchProgramacionEstudiante,
  fetchCargasDocente, fetchHorarioDocente, fetchResumenAsistenciaDocente
} from '../lib/data.js';

const SOST_LABEL = { Fiscal: 'Fiscal', Particular: 'Particular', Fiscomisional: 'Fiscomisional', Municipal: 'Municipal' };

function DashboardGlobal() {
  const { profile } = useSession();
  const [m, setM] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => { setM(await fetchMetricasGlobales()); setLoading(false); })();
  }, []);

  if (loading) return <p style={{ fontSize: 13, color: 'var(--slate)' }}>Cargando panorama de la Zona 7…</p>;

  const planteles = m.planteles || [];
  const docentes = m.docentes || [];
  const estudiantes = m.estudiantes || [];
  const usuarios = m.usuarios || [];

  const plantelesActivos = planteles.filter(p => p.activo !== false).length;
  const docentesActivos = docentes.filter(d => d.activo !== false).length;
  const estudiantesActivos = estudiantes.filter(e => e.activo !== false).length;

  const porSostenimiento = {};
  planteles.forEach(p => {
    const key = p.sostenimiento || 'sin_dato';
    porSostenimiento[key] = (porSostenimiento[key] || 0) + 1;
  });

  const porProvincia = {};
  planteles.forEach(p => {
    const key = p.provincia || 'Sin provincia';
    porProvincia[key] = (porProvincia[key] || 0) + 1;
  });

  const porRol = {};
  usuarios.forEach(u => { porRol[u.rol] = (porRol[u.rol] || 0) + 1; });

  const docentesPorPlantel = {};
  docentes.forEach(d => { if (d.institucion_id) docentesPorPlantel[d.institucion_id] = (docentesPorPlantel[d.institucion_id] || 0) + 1; });
  const estudiantesPorPlantel = {};
  estudiantes.forEach(e => { if (e.institucion_id) estudiantesPorPlantel[e.institucion_id] = (estudiantesPorPlantel[e.institucion_id] || 0) + 1; });

  const ratioDocenteEstudiante = docentesActivos ? (estudiantesActivos / docentesActivos).toFixed(1) : '—';

  const topPlanteles = [...planteles]
    .map(p => ({ ...p, total: (estudiantesPorPlantel[p.id] || 0) + (docentesPorPlantel[p.id] || 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  return (
    <div>
      <div style={{ marginBottom: 4, fontSize: 12, color: 'var(--slate)' }}>Panel de dirección · alcance global</div>
      <h2 style={{ margin: '0 0 4px' }}>Panorama Zona 7 · El Oro</h2>
      <div style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 18 }}>
        {profile.nombres} {profile.apellidos} · Super Admin Global
      </div>

      <div className="grid-4">
        <div className="metric m-teal">
          <div className="m-lbl">Planteles</div>
          <div className="m-val">{planteles.length}</div>
          <div className="m-sub">{plantelesActivos} activos</div>
        </div>
        <div className="metric m-blue">
          <div className="m-lbl">Docentes</div>
          <div className="m-val">{docentes.length}</div>
          <div className="m-sub">{docentesActivos} activos</div>
        </div>
        <div className="metric m-green">
          <div className="m-lbl">Estudiantes</div>
          <div className="m-val">{estudiantes.length}</div>
          <div className="m-sub">{estudiantesActivos} activos</div>
        </div>
        <div className="metric m-purple">
          <div className="m-lbl">Ratio estudiante/docente</div>
          <div className="m-val">{ratioDocenteEstudiante}</div>
          <div className="m-sub">promedio de la zona</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="ch"><h3>Planteles por sostenimiento</h3></div>
          <div className="cb">
            {Object.entries(porSostenimiento).length === 0
              ? <p style={{ fontSize: 13, color: 'var(--slate)' }}>Sin datos.</p>
              : Object.entries(porSostenimiento).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                  <span style={{ fontSize: 13 }}>{SOST_LABEL[k] || 'Sin dato'}</span>
                  <span className="badge b-info">{v}</span>
                </div>
              ))}
          </div>
        </div>
        <div className="card">
          <div className="ch"><h3>Usuarios activos por rol</h3></div>
          <div className="cb">
            {Object.entries(porRol).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ fontSize: 12.5 }}>{k}</span>
                <span className="badge b-muted">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="ch"><h3>Planteles con mayor comunidad educativa</h3></div>
        <div className="cb">
          {topPlanteles.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--slate)' }}>Aún no hay planteles registrados.</p>
          ) : (
            <table className="data" style={{ width: '100%' }}>
              <thead><tr><th>Plantel</th><th>Sostenimiento</th><th>Docentes</th><th>Estudiantes</th></tr></thead>
              <tbody>
                {topPlanteles.map(p => (
                  <tr key={p.id}>
                    <td><strong>{p.nombre || p.id}</strong></td>
                    <td>{SOST_LABEL[p.sostenimiento] || '—'}</td>
                    <td>{docentesPorPlantel[p.id] || 0}</td>
                    <td>{estudiantesPorPlantel[p.id] || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <div className="ch"><h3>Distribución geográfica (provincia)</h3></div>
        <div className="cb">
          {Object.entries(porProvincia).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--line)', fontSize: 13 }}>
              <span>{k}</span><span>{v} plantel{v === 1 ? '' : 'es'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DashboardInstitucion() {
  const { institucion, data } = useSession();
  const docentes = data?.docentes || [];
  const estudiantes = data?.estudiantes || [];
  const tareas = data?.tareas || [];

  const conCarga = docentes.filter(d => d.cargas && d.cargas.length > 0).length;
  const coberturaDocente = docentes.length ? Math.round((conCarga / docentes.length) * 100) : 0;
  const tareasPorCalificar = tareas.filter(t => t.entregados < t.total).length;

  return (
    <div>
      <div style={{ marginBottom: 4, fontSize: 12, color: 'var(--slate)' }}>Panel de dirección</div>
      <h2 style={{ margin: '0 0 4px' }}>Dashboard</h2>
      <div style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 18 }}>
        {institucion ? `${institucion.nombre}${institucion.amie ? ' · AMIE ' + institucion.amie : ''}` : 'Sin institución asignada'}
      </div>

      <div className="grid-4">
        <div className="metric m-teal">
          <div style={{ fontSize: 12, color: 'var(--slate)', marginBottom: 8 }}>Docentes</div>
          <div className="m-val">{docentes.length}</div>
        </div>
        <div className="metric m-teal">
          <div style={{ fontSize: 12, color: 'var(--slate)', marginBottom: 8 }}>Estudiantes</div>
          <div className="m-val">{estudiantes.length}</div>
        </div>
        <div className="metric m-teal">
          <div style={{ fontSize: 12, color: 'var(--slate)', marginBottom: 8 }}>Cobertura docente</div>
          <div className="m-val">{coberturaDocente}%</div>
          <div style={{ fontSize: 11, color: 'var(--slate)', marginTop: 4 }}>{conCarga} de {docentes.length} con carga asignada</div>
        </div>
        <div className="metric m-teal">
          <div style={{ fontSize: 12, color: 'var(--slate)', marginBottom: 8 }}>Tareas por calificar</div>
          <div className="m-val">{tareasPorCalificar}</div>
        </div>
      </div>

      <div className="card">
        <div className="ch"><h3>Actividad reciente</h3></div>
        <div className="cb">
          {tareas.length === 0
            ? <p style={{ fontSize: 13, color: 'var(--slate)' }}>Sin tareas registradas todavía.</p>
            : (
              <table className="data" style={{ width: '100%' }}>
                <thead><tr><th>Tarea</th><th>Materia</th><th>Curso</th><th>Entregas</th></tr></thead>
                <tbody>
                  {tareas.slice(0, 6).map(t => (
                    <tr key={t.id}>
                      <td>{t.titulo}</td>
                      <td>{t.materia}</td>
                      <td>{t.curso}</td>
                      <td>{t.entregados}/{t.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      </div>
    </div>
  );
}

const ESTADO_LABEL = { presente: 'Presente', atraso: 'Atraso', ausente: 'Ausente', justificado: 'Justificado' };
const ESTADO_BADGE = { presente: 'b-ok', atraso: 'b-warn', ausente: 'b-err', justificado: 'b-muted' };

/**
 * Vista compartida por padre y estudiante: ambos ven exactamente lo mismo
 * respecto al hijo/a sí mismo — su curso, su asistencia y sus tareas
 * programadas. Nunca métricas de toda la institución.
 */
function DashboardEstudiante() {
  const { profile, institucion } = useSession();
  const esPadre = profile.rolDb === 'padre';
  const [hijos, setHijos] = useState([]);
  const [estudianteId, setEstudianteId] = useState(null);
  const [prog, setProg] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let activo = true;
    (async () => {
      setLoading(true);
      if (esPadre) {
        const h = await fetchHijosDeRepresentante(profile.id);
        if (!activo) return;
        setHijos(h);
        setEstudianteId(h[0]?.id || null);
      } else {
        const id = await fetchEstudianteIdPorProfile(profile.id);
        if (!activo) return;
        setEstudianteId(id);
      }
      setLoading(false);
    })();
    return () => { activo = false; };
  }, [esPadre, profile.id]);

  useEffect(() => {
    let activo = true;
    if (!estudianteId) { setProg(null); return; }
    fetchProgramacionEstudiante(estudianteId).then(p => { if (activo) setProg(p); });
    return () => { activo = false; };
  }, [estudianteId]);

  if (loading) return <p style={{ fontSize: 13, color: 'var(--slate)' }}>Cargando…</p>;

  if (esPadre && hijos.length === 0) {
    return <div className="empty"><span className="ti ti-users" /><p>No hay ningún estudiante vinculado a tu cuenta todavía. Contacta a la secretaría del plantel.</p></div>;
  }
  if (!prog) return <p style={{ fontSize: 13, color: 'var(--slate)' }}>No se encontró información del estudiante.</p>;

  return (
    <div>
      <div style={{ marginBottom: 4, fontSize: 12, color: 'var(--slate)' }}>{esPadre ? 'Panel de representante' : 'Mi panel'}</div>
      <h2 style={{ margin: '0 0 4px' }}>{prog.estudiante.nombres} {prog.estudiante.apellidos}</h2>
      <div style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 18 }}>
        {institucion?.nombre} · {prog.curso ? `${prog.curso.grado} "${prog.curso.paralelo}"` : 'Sin curso matriculado'}
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

      <div className="grid-4">
        <div className="metric m-green"><div className="m-lbl">Presente</div><div className="m-val">{prog.resumenAsistencia.presente}</div></div>
        <div className="metric m-amber"><div className="m-lbl">Atrasos</div><div className="m-val">{prog.resumenAsistencia.atraso}</div></div>
        <div className="metric m-red"><div className="m-lbl">Ausencias</div><div className="m-val">{prog.resumenAsistencia.ausente}</div></div>
        <div className="metric m-blue"><div className="m-lbl">Justificadas</div><div className="m-val">{prog.resumenAsistencia.justificado}</div></div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--slate)', marginTop: -8, marginBottom: 18 }}>Basado en los últimos {prog.asistenciaReciente.length} registros de asistencia.</div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="ch"><h3>Tareas programadas</h3></div>
        <div className="cb">
          {prog.tareas.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--slate)' }}>Sin tareas próximas registradas para este curso.</p>
          ) : (
            <table className="data" style={{ width: '100%' }}>
              <thead><tr><th>Tarea</th><th>Materia</th><th>Fecha límite</th></tr></thead>
              <tbody>
                {prog.tareas.map(t => (
                  <tr key={t.id}>
                    <td>{t.titulo}</td>
                    <td>{t.materias?.nombre || '—'}</td>
                    <td className="mono">{t.fecha_limite}{t.hora_limite ? ' · ' + t.hora_limite.slice(0, 5) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <div className="ch"><h3>Asistencia reciente</h3></div>
        <div className="cb">
          {prog.asistenciaReciente.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--slate)' }}>Sin registros de asistencia todavía.</p>
          ) : (
            <table className="data" style={{ width: '100%' }}>
              <thead><tr><th>Fecha</th><th>Estado</th></tr></thead>
              <tbody>
                {prog.asistenciaReciente.map((a, i) => (
                  <tr key={i}>
                    <td className="mono">{a.fecha}</td>
                    <td><span className={'badge ' + (ESTADO_BADGE[a.estado] || 'b-muted')}>{ESTADO_LABEL[a.estado] || a.estado}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
function haceDias(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
function minutosDesdeFranja(franja) { const [ini] = franja.split('–'); const [h, m] = ini.split(':').map(Number); return h * 60 + m; }

/** Dashboard propio de un docente: sus clases de hoy, próxima clase, y el
 * resumen general de asistencia de TODAS sus cargas — nunca métricas de
 * dirección de toda la institución (eso era lo que veía antes, por error). */
function DashboardDocente() {
  const { profile, institucion, data } = useSession();
  const institucionId = institucion?.id;
  const [cargas, setCargas] = useState([]);
  const [clasesHoy, setClasesHoy] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [loading, setLoading] = useState(true);
  const ahoraMin = new Date().getHours() * 60 + new Date().getMinutes();
  const hoyNombre = DIAS[new Date().getDay()];

  useEffect(() => {
    let activo = true;
    (async () => {
      if (!institucionId) return;
      setLoading(true);
      const cd = await fetchCargasDocente(profile.id, institucionId);
      if (!activo) return;
      setCargas(cd);
      const ids = cd.map(c => c.id);
      const [bloques, res] = await Promise.all([
        fetchHorarioDocente(ids),
        fetchResumenAsistenciaDocente(ids, haceDias(30), new Date().toISOString().slice(0, 10))
      ]);
      if (!activo) return;
      const cargaPorId = Object.fromEntries(cd.map(c => [c.id, c]));
      const deHoy = bloques
        .filter(b => b.dia === hoyNombre)
        .map(b => ({ ...b, carga: cargaPorId[b.docente_materia_id], inicioMin: minutosDesdeFranja(b.franja) }))
        .sort((a, b) => a.inicioMin - b.inicioMin);
      setClasesHoy(deHoy);
      setResumen(res);
      setLoading(false);
    })();
    return () => { activo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [institucionId, profile.id]);

  if (loading) return <p style={{ fontSize: 13, color: 'var(--slate)' }}>Cargando…</p>;

  const proximaIdx = clasesHoy.findIndex(c => c.inicioMin >= ahoraMin);

  return (
    <div>
      <div style={{ marginBottom: 4, fontSize: 12, color: 'var(--slate)' }}>Panel docente</div>
      <h2 style={{ margin: '0 0 4px' }}>{profile.nombres} {profile.apellidos}</h2>
      <div style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 18 }}>{institucion?.nombre} · {cargas.length} carga(s) asignada(s)</div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="ch"><h3>Clases de hoy ({hoyNombre})</h3></div>
        <div className="cb">
          {clasesHoy.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--slate)' }}>No tienes clases programadas hoy.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {clasesHoy.map((c, i) => {
                const esProxima = i === proximaIdx;
                const yaPaso = c.inicioMin < ahoraMin && !esProxima;
                return (
                  <div key={c.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 14px', borderRadius: 10,
                    background: esProxima ? 'var(--brandXL, #eef2ff)' : '#fafbfc',
                    border: esProxima ? '1.5px solid var(--brand)' : '1px solid var(--line)',
                    opacity: yaPaso ? .55 : 1
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{c.carga?.materiaNombre || 'Materia'}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--slate)' }}>{c.carga?.gradoNombre} "{c.carga?.paraleloNombre}"</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600 }}>{c.franja}</div>
                      {esProxima && <span className="badge b-ok" style={{ marginTop: 2 }}>Próxima clase</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 6, fontSize: 13, fontWeight: 700 }}>Asistencia de tus clases (últimos 30 días)</div>
      <div className="grid-4" style={{ marginBottom: 18 }}>
        <div className="metric m-green"><div className="m-lbl">Presente</div><div className="m-val">{resumen?.totales?.presente ?? 0}</div></div>
        <div className="metric m-amber"><div className="m-lbl">Atraso</div><div className="m-val">{resumen?.totales?.atraso ?? 0}</div></div>
        <div className="metric m-red"><div className="m-lbl">Ausente</div><div className="m-val">{resumen?.totales?.ausente ?? 0}</div></div>
        <div className="metric m-teal"><div className="m-lbl">% Asistencia</div><div className="m-val">{resumen?.totales?.pct ?? '—'}{resumen?.totales?.pct !== null ? '%' : ''}</div></div>
      </div>

      <div className="card">
        <div className="ch"><h3>Calificaciones</h3></div>
        <div className="cb">
          <p style={{ fontSize: 13, color: 'var(--slate)' }}>El módulo de calificaciones todavía no está habilitado en el sistema — en cuanto esté listo, aquí verás un resumen de notas pendientes por registrar.</p>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { profile } = useSession();
  if (profile.rolDb === 'super_admin') return <DashboardGlobal />;
  if (profile.rolDb === 'padre' || profile.rolDb === 'estudiante') return <DashboardEstudiante />;
  if (profile.rolDb === 'docente') return <DashboardDocente />;
  return <DashboardInstitucion />;
}
