import React, { useEffect, useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { fetchMetricasGlobales } from '../lib/data.js';

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

export default function Dashboard() {
  const { profile } = useSession();
  return profile.rolDb === 'super_admin' ? <DashboardGlobal /> : <DashboardInstitucion />;
}
