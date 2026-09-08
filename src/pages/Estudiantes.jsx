import React, { useEffect, useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import {
  fetchEstudiantePerfil, crearEstudiante, guardarEstudiantePerfil, subirArchivo,
  agregarRepresentante, actualizarRepresentante, quitarRepresentanteDeEstudiante,
  crearMatricula, fetchGradosConParalelos, fetchPeriodos
} from '../lib/data.js';

const GENEROS = ['Masculino', 'Femenino'];
const ROLES_REP = ['Padre', 'Madre', 'Tutor', 'Otro'];

export default function Estudiantes() {
  const { data, institucion } = useSession();
  const [estudiantes, setEstudiantes] = useState(data?.estudiantes || []);
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal] = useState(null);
  const [tab, setTab] = useState('alumno');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [nuevoRep, setNuevoRep] = useState({ nombres: '', apellidos: '', cedula: '', telefono: '', email: '', rol_representante: 'Padre' });
  const [catalogo, setCatalogo] = useState({ grados: [], periodos: [] });
  const [nuevaMatricula, setNuevaMatricula] = useState({ periodoId: '', gradoId: '', paraleloId: '' });
  const [matriculando, setMatriculando] = useState(false);

  useEffect(() => { setEstudiantes(data?.estudiantes || []); }, [data]);

  useEffect(() => {
    if (!institucion?.id) return;
    (async () => {
      const [gradosConParalelos, periodos] = await Promise.all([
        fetchGradosConParalelos(institucion.id), fetchPeriodos(institucion.id)
      ]);
      setCatalogo({ grados: gradosConParalelos, periodos });
    })();
  }, [institucion?.id]);

  const filtrados = estudiantes.filter(e =>
    !busqueda || e.nombre.toLowerCase().includes(busqueda.toLowerCase()) || (e.cedula || '').includes(busqueda)
  );

  function abrirNuevo() {
    setError('');
    setModal({
      id: null, cedula: '', nombres: '', apellidos: '', fecha_nacimiento: '', genero: '',
      direccion: '', foto_url: '', activo: true, representantes: [], hermanos: [], matricula: null
    });
    setTab('alumno');
  }

  async function abrirEditar(id) {
    setError('');
    const e = await fetchEstudiantePerfil(id);
    if (!e) { setError('No se pudo cargar el estudiante.'); return; }
    setModal(e);
    setTab('alumno');
  }

  function cerrar() { setModal(null); setError(''); }
  function upd(campo, valor) { setModal(m => ({ ...m, [campo]: valor })); }

  async function subirFoto(file) {
    try {
      const ext = file.name.split('.').pop();
      const path = `${modal.id || 'nuevo-' + Date.now()}/foto.${ext}`;
      const url = await subirArchivo('estudiantes-fotos', path, file);
      upd('foto_url', url);
    } catch (e) { setError('No se pudo subir la foto: ' + e.message); }
  }

  async function guardar() {
    if (!modal.nombres || !modal.apellidos) { setError('Nombres y apellidos son obligatorios.'); setTab('alumno'); return; }
    setGuardando(true); setError('');
    const payload = {
      cedula: modal.cedula || null, nombres: modal.nombres, apellidos: modal.apellidos,
      fecha_nacimiento: modal.fecha_nacimiento || null, genero: modal.genero || null,
      direccion: modal.direccion || null, foto_url: modal.foto_url || null
    };
    try {
      if (modal.id) {
        await guardarEstudiantePerfil(modal.id, payload);
        setEstudiantes(es => es.map(e => e.id === modal.id
          ? { ...e, nombre: `${payload.apellidos} ${payload.nombres}`.trim(), cedula: payload.cedula, genero: payload.genero }
          : e));
      } else {
        const nuevo = await crearEstudiante(institucion.id, payload);
        setEstudiantes(es => [...es, {
          id: nuevo.id, nombre: `${payload.apellidos} ${payload.nombres}`.trim(), cedula: payload.cedula,
          curso: '—', paralelo: '', estado: 'Sin matrícula', representante: '', activo: true, acceso: false
        }]);
      }
      cerrar();
    } catch (e) {
      setError('No se pudo guardar: ' + e.message);
    } finally {
      setGuardando(false);
    }
  }

  async function agregarRep() {
    if (!modal.id) { setError('Primero guarde al estudiante antes de agregar representantes.'); return; }
    if (!nuevoRep.nombres || !nuevoRep.apellidos) { setError('Nombre y apellido del representante son obligatorios.'); return; }
    try {
      const rep = await agregarRepresentante(institucion.id, modal.id, nuevoRep);
      upd('representantes', [...modal.representantes, rep]);
      setNuevoRep({ nombres: '', apellidos: '', cedula: '', telefono: '', email: '', rol_representante: 'Padre' });
    } catch (e) { setError('No se pudo agregar el representante: ' + e.message); }
  }

  async function quitarRep(repId) {
    try {
      await quitarRepresentanteDeEstudiante(repId, modal.id);
      upd('representantes', modal.representantes.filter(r => r.id !== repId));
    } catch (e) { setError('No se pudo quitar el representante: ' + e.message); }
  }

  async function matricular() {
    if (!nuevaMatricula.paraleloId || !nuevaMatricula.periodoId) {
      setError('Selecciona período y curso/paralelo.'); return;
    }
    setMatriculando(true);
    try {
      await crearMatricula(modal.id, nuevaMatricula.periodoId, nuevaMatricula.gradoId, nuevaMatricula.paraleloId);
      const actualizado = await fetchEstudiantePerfil(modal.id);
      setModal(actualizado);
      setNuevaMatricula({ periodoId: '', gradoId: '', paraleloId: '' });
    } catch (e) {
      setError('No se pudo matricular: ' + e.message);
    }
    setMatriculando(false);
  }

  const gradoSeleccionadoMat = catalogo.grados.find(g => g.id === nuevaMatricula.gradoId);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Estudiantes</h2>
        <button className="btn btn-primary" onClick={abrirNuevo}>+ Nuevo estudiante</button>
      </div>

      <input className="search" placeholder="Buscar por nombre o cédula…"
        value={busqueda} onChange={e => setBusqueda(e.target.value)} />

      <div className="card">
        <table className="data" style={{ width: '100%' }}>
          <thead><tr><th>Nombre</th><th>Cédula</th><th>Curso</th><th>Estado</th><th>Representante</th><th>Acciones</th></tr></thead>
          <tbody>
            {filtrados.map(e => (
              <tr key={e.id}>
                <td><strong style={{ cursor: 'pointer' }} onClick={() => abrirEditar(e.id)}>{e.nombre}</strong></td>
                <td className="mono">{e.cedula || '—'}</td>
                <td>{e.curso} {e.paralelo}</td><td>{e.estado}</td>
                <td>{e.representante || '—'}</td>
                <td><button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(e.id)}>✏️ Editar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtrados.length === 0 && <p className="muted">No hay estudiantes matriculados en esta institución todavía.</p>}

      {modal && (
        <div className="modal-bg" onClick={cerrar}>
          <div className="modal wide" onClick={e => e.stopPropagation()}>
            <div className="modal-h">
              <h3>{modal.id ? '✏️ Editar estudiante' : '➕ Nuevo estudiante'}{modal.nombres ? ' — ' + modal.nombres + ' ' + modal.apellidos : ''}</h3>
              <button className="btn btn-ghost btn-sm" onClick={cerrar}><span className="ti ti-x" /></button>
            </div>

            {error && <div className="lerr">{error}</div>}

            <div className="tabs">
              {['alumno', 'representantes', 'academico', 'hermanos'].map(t => (
                <button key={t} className={'tab' + (tab === t ? ' on' : '')} onClick={() => setTab(t)}>
                  {{ alumno: 'Alumno', representantes: 'Representantes', academico: 'Académico', hermanos: 'Hermanos' }[t]}
                </button>
              ))}
            </div>

            <div className="modal-b">
              {tab === 'alumno' && (
                <div className="form-grid">
                  <div className="full" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <div className="avatar-lg">{modal.foto_url ? <img src={modal.foto_url} alt="" /> : '👤'}</div>
                    <label className="btn btn-ghost btn-sm">
                      📷 Subir foto
                      <input type="file" accept="image/*" style={{ display: 'none' }}
                        onChange={e => e.target.files[0] && subirFoto(e.target.files[0])} />
                    </label>
                  </div>
                  <div className="full"><label className="fl">Apellidos *</label>
                    <input className="fc" value={modal.apellidos} onChange={e => upd('apellidos', e.target.value)} /></div>
                  <div className="full"><label className="fl">Nombres *</label>
                    <input className="fc" value={modal.nombres} onChange={e => upd('nombres', e.target.value)} /></div>
                  <div><label className="fl">Cédula</label>
                    <input className="fc mono" value={modal.cedula || ''} onChange={e => upd('cedula', e.target.value)} /></div>
                  <div><label className="fl">Fecha de nacimiento</label>
                    <input className="fc" type="date" value={modal.fecha_nacimiento || ''} onChange={e => upd('fecha_nacimiento', e.target.value)} /></div>
                  <div><label className="fl">Género</label>
                    <select className="fc" value={modal.genero || ''} onChange={e => upd('genero', e.target.value)}>
                      <option value="">Seleccione…</option>
                      {GENEROS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select></div>
                  <div className="full"><label className="fl">Dirección de domicilio</label>
                    <input className="fc" value={modal.direccion || ''} onChange={e => upd('direccion', e.target.value)} /></div>
                </div>
              )}

              {tab === 'representantes' && (
                <div>
                  {modal.representantes.length === 0 && <p className="muted">Sin representantes registrados.</p>}
                  {modal.representantes.map(r => (
                    <div key={r.id} className="card" style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>{r.apellidos} {r.nombres}</strong> <span className="muted">— {r.rol_representante}</span><br />
                        <span className="muted">{r.cedula || '—'} · {r.telefono || '—'} · {r.email || '—'}</span>
                      </div>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => quitarRep(r.id)}>✕ Quitar</button>
                    </div>
                  ))}

                  {modal.id ? (
                    <div className="card" style={{ marginTop: 14 }}>
                      <div className="form-grid">
                        <div><label className="fl">Rol</label>
                          <select className="fc" value={nuevoRep.rol_representante}
                            onChange={e => setNuevoRep(r => ({ ...r, rol_representante: e.target.value }))}>
                            {ROLES_REP.map(r => <option key={r} value={r}>{r}</option>)}
                          </select></div>
                        <div><label className="fl">Apellidos</label>
                          <input className="fc" value={nuevoRep.apellidos} onChange={e => setNuevoRep(r => ({ ...r, apellidos: e.target.value }))} /></div>
                        <div><label className="fl">Nombres</label>
                          <input className="fc" value={nuevoRep.nombres} onChange={e => setNuevoRep(r => ({ ...r, nombres: e.target.value }))} /></div>
                        <div><label className="fl">Cédula</label>
                          <input className="fc mono" value={nuevoRep.cedula} onChange={e => setNuevoRep(r => ({ ...r, cedula: e.target.value }))} /></div>
                        <div><label className="fl">Teléfono</label>
                          <input className="fc" value={nuevoRep.telefono} onChange={e => setNuevoRep(r => ({ ...r, telefono: e.target.value }))} /></div>
                        <div><label className="fl">Correo</label>
                          <input className="fc" type="email" value={nuevoRep.email} onChange={e => setNuevoRep(r => ({ ...r, email: e.target.value }))} /></div>
                      </div>
                      <button type="button" className="btn btn-secondary" style={{ marginTop: 8 }} onClick={agregarRep}>+ Agregar representante</button>
                    </div>
                  ) : <p className="muted">Guarde primero al estudiante para poder agregar representantes.</p>}
                </div>
              )}

              {tab === 'academico' && (
                <div>
                  <div className="form-grid" style={{ marginBottom: 14 }}>
                    <div><label className="fl">Curso actual</label>
                      <input className="fc" disabled value={modal.curso || (modal.matricula ? `${modal.matricula.grado_id ? '' : ''}` : '') || '—'} /></div>
                    <div><label className="fl">Estado de matrícula</label>
                      <input className="fc" disabled value={modal.matricula?.estado || modal.estado || 'Sin matrícula'} /></div>
                    <div className="full"><label className="fl">Plantel</label>
                      <input className="fc" disabled value={institucion?.nombre || '—'} /></div>
                  </div>

                  {!modal.id ? (
                    <p className="muted">Guarde primero al estudiante para poder matricularlo.</p>
                  ) : (
                    <div className="card">
                      <div className="ch"><h3>{modal.matricula ? 'Cambiar de curso / re-matricular' : 'Matricular'}</h3></div>
                      <div className="cb">
                        <div className="form-grid">
                          <div><label className="fl">Período lectivo</label>
                            <select className="fc" value={nuevaMatricula.periodoId} onChange={e => setNuevaMatricula(n => ({ ...n, periodoId: e.target.value }))}>
                              <option value="">Seleccione…</option>
                              {catalogo.periodos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                            </select></div>
                          <div><label className="fl">Grado / curso</label>
                            <select className="fc" value={nuevaMatricula.gradoId} onChange={e => setNuevaMatricula(n => ({ ...n, gradoId: e.target.value, paraleloId: '' }))}>
                              <option value="">Seleccione…</option>
                              {catalogo.grados.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                            </select></div>
                          <div><label className="fl">Paralelo</label>
                            <select className="fc" value={nuevaMatricula.paraleloId} onChange={e => setNuevaMatricula(n => ({ ...n, paraleloId: e.target.value }))} disabled={!gradoSeleccionadoMat}>
                              <option value="">Seleccione…</option>
                              {(gradoSeleccionadoMat?.paralelos || []).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                            </select></div>
                        </div>
                        <button type="button" className="btn btn-secondary" style={{ marginTop: 12 }} disabled={matriculando} onClick={matricular}>
                          {matriculando ? 'Matriculando…' : '+ Matricular'}
                        </button>
                      </div>
                    </div>
                  )}
                  <p className="muted" style={{ marginTop: 10 }}>Matricular en un nuevo curso retira automáticamente la matrícula anterior del mismo período.</p>
                </div>
              )}

              {tab === 'hermanos' && (
                <div>
                  {modal.hermanos.length === 0 && <p className="muted">No se encontraron hermanos vinculados por representante.</p>}
                  {modal.hermanos.map(h => (
                    <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eef1f8' }}>
                      <span>{h.nombre}</span><span className="muted mono">{h.cedula || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-f">
              <button className="btn btn-secondary" onClick={cerrar}>Cancelar</button>
              <button className="btn btn-primary" disabled={guardando} onClick={guardar}>
                {guardando ? 'Guardando…' : '💾 Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
