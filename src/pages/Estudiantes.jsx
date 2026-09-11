import React, { useEffect, useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import {
  fetchEstudiantePerfil, crearEstudiante, guardarEstudiantePerfil, subirArchivo,
  agregarRepresentante, actualizarRepresentante, quitarRepresentanteDeEstudiante,
  crearMatricula, fetchGradosConParalelos, fetchPeriodos
} from '../lib/data.js';
import { descargarPlantillaExcel, leerExcel, normalizarFecha, validarCedulaEC } from '../lib/cargaMasiva.js';

const PLANTILLA_ESTUDIANTES_COLS = [
  'Cédula', 'Nombres', 'Apellidos', 'Fecha Nacimiento (AAAA-MM-DD)', 'Género (Masculino/Femenino)', 'Dirección',
  'Curso (ej: Primero de Básica)', 'Paralelo (ej: A)',
  'Representante Nombres', 'Representante Apellidos', 'Representante Cédula', 'Representante Teléfono',
  'Representante Email', 'Parentesco (Padre/Madre/Tutor/Otro)'
];
const PLANTILLA_ESTUDIANTES_EJEMPLO = [
  '0712345678', 'María José', 'López Torres', '2015-06-20', 'Femenino', 'Av. Las Palmeras 123',
  'Segundo de Básica', 'A',
  'Carlos', 'López Vera', '0798765432', '0987654321', 'carlos.lopez@ejemplo.com', 'Padre'
];

const GENEROS = ['Masculino', 'Femenino'];
const ROLES_REP = ['Padre', 'Madre', 'Tutor', 'Otro'];
const ETNIAS = ['Mestizo', 'Indígena', 'Afroecuatoriano', 'Montubio', 'Blanco', 'Mulato', 'Negro', 'Otro'];
const DISCAPACIDADES = ['Ninguna', 'Física', 'Visual', 'Auditiva', 'Intelectual', 'Psicosocial', 'Múltiple'];

function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const nac = new Date(fechaNacimiento + 'T00:00:00');
  if (Number.isNaN(nac.getTime())) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - nac.getFullYear();
  const aunNoCumple = hoy.getMonth() < nac.getMonth() || (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate());
  if (aunNoCumple) edad -= 1;
  return edad >= 0 ? edad : null;
}

export default function Estudiantes() {
  const { data, institucion, refrescarDatos } = useSession();
  const [estudiantes, setEstudiantes] = useState(data?.estudiantes || []);
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const porPagina = 25;
  const [modal, setModal] = useState(null);
  const [tab, setTab] = useState('alumno');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [nuevoRep, setNuevoRep] = useState({ nombres: '', apellidos: '', cedula: '', telefono: '', email: '', rol_representante: 'Padre' });
  const [catalogo, setCatalogo] = useState({ grados: [], periodos: [] });
  const [nuevaMatricula, setNuevaMatricula] = useState({ periodoId: '', gradoId: '', paraleloId: '' });
  const [matriculando, setMatriculando] = useState(false);
  const [masivo, setMasivo] = useState(null);

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

  function filaAPayloadEstudiante(fila) {
    const cedula = String(fila['Cédula'] || '').trim();
    const nombres = String(fila['Nombres'] || '').trim();
    const apellidos = String(fila['Apellidos'] || '').trim();
    const cursoTxt = String(fila['Curso (ej: Primero de Básica)'] || '').trim();
    const paraleloTxt = String(fila['Paralelo (ej: A)'] || '').trim();
    const errores = [];
    if (!nombres) errores.push('nombres vacíos');
    if (!apellidos) errores.push('apellidos vacíos');
    if (cedula && !validarCedulaEC(cedula)) errores.push('cédula inválida');

    let gradoId = null, paraleloId = null;
    if (cursoTxt) {
      const grado = catalogo.grados.find(g => g.nombre.toLowerCase().trim() === cursoTxt.toLowerCase());
      if (!grado) errores.push(`curso "${cursoTxt}" no existe en este plantel`);
      else {
        gradoId = grado.id;
        if (paraleloTxt) {
          const par = (grado.paralelos || []).find(p => p.nombre.toLowerCase().trim() === paraleloTxt.toLowerCase());
          if (!par) errores.push(`paralelo "${paraleloTxt}" no existe en ${cursoTxt}`);
          else paraleloId = par.id;
        }
      }
    }

    const repNombres = String(fila['Representante Nombres'] || '').trim();
    const repApellidos = String(fila['Representante Apellidos'] || '').trim();
    const tieneRepresentante = !!(repNombres || repApellidos);

    return {
      payload: {
        cedula: cedula || null, nombres, apellidos,
        fecha_nacimiento: normalizarFecha(fila['Fecha Nacimiento (AAAA-MM-DD)']),
        genero: String(fila['Género (Masculino/Femenino)'] || '').trim() || null,
        direccion: String(fila['Dirección'] || '').trim() || null,
      },
      gradoId, paraleloId, cursoTxt, paraleloTxt,
      representante: tieneRepresentante ? {
        nombres: repNombres, apellidos: repApellidos,
        cedula: String(fila['Representante Cédula'] || '').trim() || null,
        telefono: String(fila['Representante Teléfono'] || '').trim() || null,
        email: String(fila['Representante Email'] || '').trim() || null,
        rol_representante: String(fila['Parentesco (Padre/Madre/Tutor/Otro)'] || '').trim() || 'Padre',
      } : null,
      errores,
    };
  }

  function abrirCargaMasiva() {
    setMasivo({ filas: [], subiendo: false, resultado: null });
  }

  async function onArchivoMasivo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const filasCrudas = await leerExcel(file);
      const cedulasExistentes = new Set(estudiantes.map(x => x.cedula).filter(Boolean));
      const vistas = new Set();
      const filas = filasCrudas.map(fila => {
        const r = filaAPayloadEstudiante(fila);
        if (r.payload.cedula) {
          if (cedulasExistentes.has(r.payload.cedula)) r.errores.push('cédula ya existe en el sistema');
          else if (vistas.has(r.payload.cedula)) r.errores.push('cédula duplicada en el archivo');
          vistas.add(r.payload.cedula);
        }
        return r;
      });
      setMasivo({ filas, subiendo: false, resultado: null });
    } catch (err) {
      setMasivo({ filas: [], subiendo: false, resultado: null });
      setError('No se pudo leer el archivo: ' + err.message);
    } finally {
      e.target.value = '';
    }
  }

  async function confirmarCargaMasivaEstudiantes() {
    const validas = masivo.filas.filter(f => f.errores.length === 0);
    if (validas.length === 0) return;
    setMasivo(m => ({ ...m, subiendo: true }));
    const periodoActivo = catalogo.periodos.find(p => p.activo) || catalogo.periodos[0] || null;
    let creados = 0;
    const fallos = [];
    const nuevosLocales = [];
    for (const f of validas) {
      try {
        const nuevo = await crearEstudiante(institucion.id, f.payload);
        let curso = '—', paralelo = '', estado = 'Sin matrícula', representanteTxto = '';
        if (f.gradoId && f.paraleloId && periodoActivo) {
          await crearMatricula(nuevo.id, periodoActivo.id, f.gradoId, f.paraleloId);
          curso = f.cursoTxt; paralelo = f.paraleloTxt; estado = 'Activa';
        }
        if (f.representante) {
          await agregarRepresentante(institucion.id, nuevo.id, f.representante);
          representanteTxto = `${f.representante.apellidos} ${f.representante.nombres}`.trim();
        }
        nuevosLocales.push({
          id: nuevo.id, nombre: `${f.payload.apellidos} ${f.payload.nombres}`.trim(), cedula: f.payload.cedula,
          curso, paralelo, estado, representante: representanteTxto, activo: true, acceso: false
        });
        creados++;
      } catch (err) {
        fallos.push({ cedula: f.payload.cedula, nombre: `${f.payload.nombres} ${f.payload.apellidos}`, motivo: err.message });
      }
    }
    if (nuevosLocales.length) { setEstudiantes(es => [...es, ...nuevosLocales]); refrescarDatos(); }
    setMasivo(m => ({ ...m, subiendo: false, resultado: { creados, fallos } }));
  }

  useEffect(() => { setPagina(1); }, [busqueda]);
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtrados.slice((paginaActual - 1) * porPagina, paginaActual * porPagina);

  function abrirNuevo() {
    setError('');
    setModal({
      id: null, cedula: '', nombres: '', apellidos: '', fecha_nacimiento: '', genero: '',
      etnia: '', discapacidad: '', telefono: '', email: '',
      direccion: '', provincia: institucion?.provincia || '', canton: institucion?.canton || '',
      observaciones: '', foto_url: '', activo: true, representantes: [], hermanos: [], matricula: null
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
      etnia: modal.etnia || null, discapacidad: modal.discapacidad || null,
      telefono: modal.telefono || null, email: modal.email || null,
      direccion: modal.direccion || null, provincia: modal.provincia || null, canton: modal.canton || null,
      observaciones: modal.observaciones || null, foto_url: modal.foto_url || null
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
      refrescarDatos();
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
      refrescarDatos();
    } catch (e) { setError('No se pudo agregar el representante: ' + e.message); }
  }

  async function quitarRep(repId) {
    try {
      await quitarRepresentanteDeEstudiante(repId, modal.id);
      upd('representantes', modal.representantes.filter(r => r.id !== repId));
      refrescarDatos();
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
      refrescarDatos();
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
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={abrirCargaMasiva}>📥 Carga masiva (Excel)</button>
          <button className="btn btn-primary" onClick={abrirNuevo}>+ Nuevo estudiante</button>
        </div>
      </div>

      <input className="search" placeholder="Buscar por nombre o cédula…"
        value={busqueda} onChange={e => setBusqueda(e.target.value)} />

      <div className="card">
        <table className="data" style={{ width: '100%' }}>
          <thead><tr><th>Nombre</th><th>Cédula</th><th>Curso</th><th>Estado</th><th>Representante</th><th>Acciones</th></tr></thead>
          <tbody>
            {visibles.map(e => (
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
                  <div><label className="fl">Cédula de identidad</label>
                    <input className="fc mono" value={modal.cedula || ''} onChange={e => upd('cedula', e.target.value)} /></div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}><label className="fl">Fecha de nacimiento</label>
                      <input className="fc" type="date" value={modal.fecha_nacimiento || ''} onChange={e => upd('fecha_nacimiento', e.target.value)} /></div>
                    <div style={{ width: 90 }}><label className="fl">Edad</label>
                      <input className="fc" value={calcularEdad(modal.fecha_nacimiento) ?? '—'} disabled /></div>
                  </div>
                  <div><label className="fl">Género</label>
                    <select className="fc" value={modal.genero || ''} onChange={e => upd('genero', e.target.value)}>
                      <option value="">Seleccione…</option>
                      {GENEROS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select></div>
                  <div><label className="fl">Etnia / Nacionalidad</label>
                    <select className="fc" value={modal.etnia || ''} onChange={e => upd('etnia', e.target.value)}>
                      <option value="">—</option>
                      {ETNIAS.map(x => <option key={x} value={x}>{x}</option>)}
                    </select></div>
                  <div><label className="fl">Discapacidad</label>
                    <select className="fc" value={modal.discapacidad || ''} onChange={e => upd('discapacidad', e.target.value)}>
                      {DISCAPACIDADES.map(x => <option key={x} value={x}>{x}</option>)}
                    </select></div>
                  <div><label className="fl">Teléfono / Celular</label>
                    <input className="fc" value={modal.telefono || ''} onChange={e => upd('telefono', e.target.value)} /></div>
                  <div className="full"><label className="fl">Correo electrónico</label>
                    <input className="fc" type="email" value={modal.email || ''} onChange={e => upd('email', e.target.value)} /></div>
                  <div className="full"><label className="fl">Dirección de domicilio</label>
                    <input className="fc" placeholder="Calle, número, sector, cantón" value={modal.direccion || ''} onChange={e => upd('direccion', e.target.value)} /></div>
                  <div><label className="fl">Provincia</label>
                    <input className="fc" value={modal.provincia || ''} onChange={e => upd('provincia', e.target.value)} /></div>
                  <div><label className="fl">Cantón</label>
                    <input className="fc" value={modal.canton || ''} onChange={e => upd('canton', e.target.value)} /></div>
                  <div className="full"><label className="fl">Observaciones</label>
                    <textarea className="fc" rows={3} value={modal.observaciones || ''} onChange={e => upd('observaciones', e.target.value)} /></div>
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
                      <input className="fc" disabled value={(() => {
                        if (!modal.matricula) return '—';
                        const grado = catalogo.grados.find(g => g.id === modal.matricula.grado_id);
                        if (!grado) return '—';
                        const paralelo = (grado.paralelos || []).find(p => p.id === modal.matricula.paralelo_id);
                        return `${grado.nombre}${paralelo ? ' ' + paralelo.nombre : ''}`;
                      })()} /></div>
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

      {masivo && (
        <div className="modal-bg" onClick={() => !masivo.subiendo && setMasivo(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 820 }}>
            <h3>📥 Carga masiva de estudiantes (Excel)</h3>
            <p style={{ color: 'var(--slate)', fontSize: 13 }}>
              Descarga la plantilla y complétala. Nombres y apellidos son obligatorios; curso/paralelo y representante son opcionales,
              pero si los llenas deben coincidir con los cursos/paralelos ya creados en este plantel.
            </p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button className="btn btn-secondary" onClick={() => descargarPlantillaExcel('plantilla_estudiantes_sigee.xlsx', PLANTILLA_ESTUDIANTES_COLS, PLANTILLA_ESTUDIANTES_EJEMPLO)}>
                ⬇️ Descargar plantilla
              </button>
              <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
                📂 Elegir archivo
                <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={onArchivoMasivo} />
              </label>
            </div>

            {masivo.filas.length > 0 && !masivo.resultado && (
              <>
                <div style={{ maxHeight: 320, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <table className="tbl">
                    <thead><tr><th>#</th><th>Nombres</th><th>Apellidos</th><th>Curso/Paralelo</th><th>Representante</th><th>Estado</th></tr></thead>
                    <tbody>
                      {masivo.filas.map((f, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td>{f.payload.nombres}</td>
                          <td>{f.payload.apellidos}</td>
                          <td>{f.cursoTxt ? `${f.cursoTxt} ${f.paraleloTxt}` : '—'}</td>
                          <td>{f.representante ? `${f.representante.nombres} ${f.representante.apellidos}` : '—'}</td>
                          <td>
                            {f.errores.length === 0
                              ? <span className="badge b-ok">Listo</span>
                              : <span className="badge b-err" title={f.errores.join(', ')}>⚠️ {f.errores.join(', ')}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p style={{ fontSize: 12, color: 'var(--slate)', margin: '8px 0' }}>
                  {masivo.filas.filter(f => f.errores.length === 0).length} de {masivo.filas.length} filas listas para cargar.
                </p>
              </>
            )}

            {masivo.resultado && (
              <div style={{ padding: 12, background: 'var(--bg-soft)', borderRadius: 8, marginBottom: 12 }}>
                <p><strong>{masivo.resultado.creados}</strong> estudiante{masivo.resultado.creados === 1 ? '' : 's'} creado{masivo.resultado.creados === 1 ? '' : 's'} correctamente.</p>
                {masivo.resultado.fallos.length > 0 && (
                  <>
                    <p style={{ color: 'var(--red)' }}>{masivo.resultado.fallos.length} fila(s) fallaron:</p>
                    <ul style={{ fontSize: 12, color: 'var(--red)' }}>
                      {masivo.resultado.fallos.map((f, i) => <li key={i}>{f.nombre} ({f.cedula}): {f.motivo}</li>)}
                    </ul>
                  </>
                )}
              </div>
            )}

            <div className="modal-f">
              <button className="btn btn-secondary" disabled={masivo.subiendo} onClick={() => setMasivo(null)}>
                {masivo.resultado ? 'Cerrar' : 'Cancelar'}
              </button>
              {!masivo.resultado && (
                <button
                  className="btn btn-primary"
                  disabled={masivo.subiendo || masivo.filas.filter(f => f.errores.length === 0).length === 0}
                  onClick={confirmarCargaMasivaEstudiantes}
                >
                  {masivo.subiendo ? 'Cargando…' : `✅ Confirmar carga (${masivo.filas.filter(f => f.errores.length === 0).length})`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
