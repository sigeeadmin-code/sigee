import React, { useEffect, useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { fetchEstudiantePerfil } from '../lib/data.js';
import { cmpNombre } from '../lib/ordenar.js';

/**
 * Vista Estudiantes (restaurada + ajustes DECE).
 * DECE: solo consulta, botón Perfil, sin cargas masivas.
 * Multi-tenant por plantel de la sesión.
 */
export default function Estudiantes() {
  const { data, institucion, profile } = useSession();
  const esDece = profile.rol === 'dece' || profile.rolDb === 'dece';
  const puedeEscribir = ['super_admin', 'admin_plantel', 'secretario'].includes(profile.rolDb);
  const [estudiantes, setEstudiantes] = useState(data?.estudiantes || []);
  const [busqueda, setBusqueda] = useState('');
  const [fCurso, setFCurso] = useState('');
  const [modal, setModal] = useState(null);
  const [error, setError] = useState('');
  const [pagina, setPagina] = useState(1);
  const porPagina = 25;
  const global = !institucion?.id;

  useEffect(() => { setEstudiantes(data?.estudiantes || []); }, [data]);

  const filtrados = [...estudiantes].sort(cmpNombre).filter(e => {
    if (busqueda && !e.nombre?.toLowerCase().includes(busqueda.toLowerCase()) && !(e.cedula || '').includes(busqueda)) return false;
    if (fCurso && `${e.curso} ${e.paralelo}`.trim() !== fCurso) return false;
    return true;
  });
  const cursosDisponibles = [...new Set(estudiantes.map(e => `${e.curso} ${e.paralelo}`.trim()).filter(c => c && c !== '—'))].sort();
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtrados.slice((paginaActual - 1) * porPagina, paginaActual * porPagina);

  async function abrirEditar(id) {
    setError('');
    try {
      const e = await fetchEstudiantePerfil(id);
      if (!e) { setError('No se pudo cargar el estudiante.'); return; }
      setModal(e);
    } catch (err) {
      setError(err.message || 'Error al cargar perfil');
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Estudiantes</h2>
      </div>

      {esDece && (
        <p className="muted" style={{ margin: '0 0 12px' }}>
          Vista DECE: consulta de estudiantes y acceso al perfil. Use <strong>Informes Individuales</strong> para planes de intervención y seguimientos.
        </p>
      )}

      {!esDece && !global && puedeEscribir && (
        <p className="muted" style={{ margin: '0 0 12px' }}>
          Nota: alta y carga masiva se restaurarán en la siguiente actualización. Puede consultar y abrir perfiles.
        </p>
      )}

      <div className="search-bar">
        <input className="search" style={{ flex: 1 }} placeholder="Buscar por nombre o cédula…"
          value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        <select className="fc" value={fCurso} onChange={e => setFCurso(e.target.value)}>
          <option value="">Todos los cursos</option>
          {cursosDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="card" style={{ overflow: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Cédula</th>
              <th>Curso</th>
              <th>Estado matrícula</th>
              <th>Activo</th>
              <th>Representante</th>
              <th>Acceso</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map(e => (
              <tr key={e.id}>
                <td>
                  <strong style={{ cursor: 'pointer' }} onClick={() => abrirEditar(e.id)}>{e.nombre}</strong>
                </td>
                <td className="mono">{e.cedula || '—'}</td>
                <td>{e.curso} {e.paralelo}</td>
                <td>{e.estado || '—'}</td>
                <td>
                  <span className={'badge ' + (e.activo ? 'b-ok' : 'b-muted')}>{e.activo ? 'Activo' : 'Inactivo'}</span>
                </td>
                <td>{e.representante || '—'}</td>
                <td>
                  {e.acceso ? <span className="badge b-ok">Con acceso</span> : <span className="badge b-muted">Sin acceso</span>}
                </td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(e.id)}>
                    {esDece ? '👤 Perfil' : (puedeEscribir ? '✏️ Editar' : '👁️ Ver')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtrados.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 2px' }}>
          <span style={{ fontSize: 12, color: 'var(--slate)' }}>
            {filtrados.length} estudiante{filtrados.length === 1 ? '' : 's'} · página {paginaActual} de {totalPaginas}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-ghost btn-sm" disabled={paginaActual <= 1} onClick={() => setPagina(p => Math.max(1, p - 1))}>Anterior</button>
            <button className="btn btn-ghost btn-sm" disabled={paginaActual >= totalPaginas} onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}>Siguiente</button>
          </div>
        </div>
      )}
      {filtrados.length === 0 && <p className="muted">No hay estudiantes con los filtros actuales.</p>}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 560, width: '95%' }} onClick={ev => ev.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Perfil del estudiante</h3>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>✕</button>
            </div>
            <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
              <div><strong>Nombre:</strong> {modal.apellidos} {modal.nombres}</div>
              <div><strong>Cédula:</strong> {modal.cedula || '—'}</div>
              <div><strong>Fecha nacimiento:</strong> {modal.fecha_nacimiento || '—'}</div>
              <div><strong>Género:</strong> {modal.genero || '—'}</div>
              <div><strong>Teléfono:</strong> {modal.telefono || '—'}</div>
              <div><strong>Email:</strong> {modal.email || '—'}</div>
              <div><strong>Dirección:</strong> {modal.direccion || '—'}</div>
              {modal.representantes?.length > 0 && (
                <div>
                  <strong>Representantes:</strong>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                    {modal.representantes.map(r => (
                      <li key={r.id}>{r.apellidos} {r.nombres} ({r.rol_representante || '—'}) · {r.telefono || ''}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {esDece && (
              <div style={{ marginTop: 16 }}>
                <a className="btn btn-primary" href="/informes-dece">Ir a Informes Individuales DECE</a>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
