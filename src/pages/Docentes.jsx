import React, { useEffect, useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import {
  fetchDocentePerfil, crearDocente, guardarDocentePerfil, subirArchivo,
  fetchCargasPorDocenteId, crearCargaDocente, eliminarCargaDocente,
  fetchMaterias, fetchGradosConParalelos, fetchPeriodos
} from '../lib/data.js';
import { descargarPlantillaExcel, leerExcel, normalizarFecha, validarCedulaEC } from '../lib/cargaMasiva.js';

const PLANTILLA_DOCENTES_COLS = [
  'Cédula', 'Nombres', 'Apellidos', 'Email', 'Teléfono', 'Título', 'Cargo',
  'Situación (NOMBRAMIENTO/CONTRATO/OCASIONAL/REEMPLAZO)', 'Especialidad', 'Área',
  'Fecha Ingreso (AAAA-MM-DD)', 'Género (Masculino/Femenino)'
];
const PLANTILLA_DOCENTES_EJEMPLO = [
  '0701234567', 'Juan Carlos', 'Pérez Gómez', 'juan.perez@ejemplo.com', '0991234567',
  'Licenciado en Educación Básica', 'Docente', 'NOMBRAMIENTO', 'Matemática', 'Ciencias Exactas',
  '2020-03-15', 'Masculino'
];

function filaAPayloadDocente(fila) {
  const cedula = String(fila['Cédula'] || '').trim();
  const nombres = String(fila['Nombres'] || '').trim();
  const apellidos = String(fila['Apellidos'] || '').trim();
  const errores = [];
  if (!cedula) errores.push('cédula vacía');
  else if (!validarCedulaEC(cedula)) errores.push('cédula inválida');
  if (!nombres) errores.push('nombres vacíos');
  if (!apellidos) errores.push('apellidos vacíos');
  const payload = {
    cedula, nombres, apellidos,
    email: String(fila['Email'] || '').trim() || null,
    telefono: String(fila['Teléfono'] || '').trim() || null,
    titulo: String(fila['Título'] || '').trim() || null,
    cargo: String(fila['Cargo'] || '').trim() || null,
    situacion: String(fila['Situación (NOMBRAMIENTO/CONTRATO/OCASIONAL/REEMPLAZO)'] || '').trim().toUpperCase() || 'NOMBRAMIENTO',
    especialidad: String(fila['Especialidad'] || '').trim() || null,
    area: String(fila['Área'] || '').trim() || null,
    fecha_ingreso: normalizarFecha(fila['Fecha Ingreso (AAAA-MM-DD)']),
    genero: String(fila['Género (Masculino/Femenino)'] || '').trim() || null,
  };
  return { payload, errores };
}

const SANGRE = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
const GENEROS = ['Masculino', 'Femenino'];
const SITUACIONES = ['NOMBRAMIENTO', 'CONTRATO', 'OCASIONAL', 'REEMPLAZO'];
const JORNADAS = ['Matutina', 'Vespertina', 'Nocturna', 'Completa'];

function anios(fechaIngreso) {
  if (!fechaIngreso) return '—';
  const dias = (Date.now() - new Date(fechaIngreso).getTime()) / 86400000;
  return Math.max(0, Math.floor(dias / 365)) + ' años';
}

export default function Docentes() {
  const { data, institucion, profile } = useSession();
  const [docentes, setDocentes] = useState(data?.docentes || []);
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const porPagina = 25;
  const [modal, setModal] = useState(null);
  const [tab, setTab] = useState('personales');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [cargas, setCargas] = useState([]);
  const [catalogo, setCatalogo] = useState({ materias: [], grados: [], periodos: [] });
  const [nuevaCarga, setNuevaCarga] = useState({ materiaId: '', gradoId: '', paraleloId: '', periodoId: '' });
  const [masivo, setMasivo] = useState(null); // { filas: [{payload, errores, fila}], subiendo, resultado }

  useEffect(() => { setDocentes(data?.docentes || []); }, [data]);

  useEffect(() => {
    if (!institucion?.id) return;
    (async () => {
      const [materias, gradosConParalelos, periodos] = await Promise.all([
        fetchMaterias(institucion.id), fetchGradosConParalelos(institucion.id), fetchPeriodos(institucion.id)
      ]);
      setCatalogo({ materias, grados: gradosConParalelos, periodos });
    })();
  }, [institucion?.id]);

  async function cargarCargasDocente(docenteId) {
    if (!docenteId) { setCargas([]); return; }
    setCargas(await fetchCargasPorDocenteId(docenteId, institucion.id));
  }

  const filtrados = docentes.filter(d =>
    !busqueda || d.nombre.toLowerCase().includes(busqueda.toLowerCase()) || (d.cedula || '').includes(busqueda)
  );

  useEffect(() => { setPagina(1); }, [busqueda]);
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtrados.slice((paginaActual - 1) * porPagina, paginaActual * porPagina);

  async function abrirNuevo() {
    setError('');
    setModal({
      id: null, cedula: '', nombres: '', apellidos: '', fecha_nacimiento: '', genero: '',
      tipo_sangre: '', direccion: '', residencia: '', telefono: '', email: '', foto_url: '',
      situacion: 'NOMBRAMIENTO', cargo: '', especialidad: '', area: '', accion_personal: '',
      categoria: '', rmu: 0, jornada: '', fecha_ingreso: '', incorporado: true,
      obs_laborales: [], titulos: [], documentos: []
    });
    setCargas([]);
    setTab('personales');
  }

  async function abrirEditar(id) {
    setError('');
    const d = await fetchDocentePerfil(id);
    if (!d) { setError('No se pudo cargar el docente.'); return; }
    setModal({
      ...d,
      obs_laborales: d.obs_laborales || [],
      titulos: d.titulos || [],
      documentos: d.documentos || []
    });
    cargarCargasDocente(id);
    setTab('personales');
  }

  function cerrar() { setModal(null); setError(''); }

  function upd(campo, valor) { setModal(m => ({ ...m, [campo]: valor })); }

  async function subirFoto(file) {
    try {
      const ext = file.name.split('.').pop();
      const path = `${modal.id || 'nuevo-' + Date.now()}/foto.${ext}`;
      const url = await subirArchivo('docentes-fotos', path, file);
      upd('foto_url', url);
    } catch (e) { setError('No se pudo subir la foto: ' + e.message); }
  }

  async function subirDocumento(file, nombreDoc) {
    try {
      const path = `${modal.id || 'nuevo-' + Date.now()}/${Date.now()}-${file.name}`;
      const url = await subirArchivo('docentes-documentos', path, file);
      upd('documentos', [...modal.documentos, { nombre: nombreDoc || file.name, url, fecha: new Date().toISOString().slice(0, 10) }]);
    } catch (e) { setError('No se pudo subir el documento: ' + e.message); }
  }

  function abrirCargaMasiva() {
    setMasivo({ filas: [], subiendo: false, resultado: null });
  }

  async function onArchivoMasivo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const filasCrudas = await leerExcel(file);
      const cedulasExistentes = new Set(docentes.map(d => d.cedula));
      const vistas = new Set();
      const filas = filasCrudas.map(fila => {
        const { payload, errores } = filaAPayloadDocente(fila);
        if (payload.cedula) {
          if (cedulasExistentes.has(payload.cedula)) errores.push('cédula ya existe en el sistema');
          else if (vistas.has(payload.cedula)) errores.push('cédula duplicada en el archivo');
          vistas.add(payload.cedula);
        }
        return { payload, errores };
      });
      setMasivo({ filas, subiendo: false, resultado: null });
    } catch (err) {
      setMasivo({ filas: [], subiendo: false, resultado: null });
      setError('No se pudo leer el archivo: ' + err.message);
    } finally {
      e.target.value = '';
    }
  }

  async function confirmarCargaMasiva() {
    const validas = masivo.filas.filter(f => f.errores.length === 0);
    if (validas.length === 0) return;
    setMasivo(m => ({ ...m, subiendo: true }));
    let creados = 0;
    const fallos = [];
    const nuevosLocales = [];
    for (const f of validas) {
      try {
        const nuevo = await crearDocente(institucion.id, f.payload);
        nuevosLocales.push({
          id: nuevo.id, nombre: `${f.payload.apellidos} ${f.payload.nombres}`.trim(), cedula: f.payload.cedula,
          situacion: f.payload.situacion, cargo: f.payload.cargo, materias: [], cursos: [], activo: true, acceso: false
        });
        creados++;
      } catch (err) {
        fallos.push({ cedula: f.payload.cedula, nombre: `${f.payload.nombres} ${f.payload.apellidos}`, motivo: err.message });
      }
    }
    if (nuevosLocales.length) setDocentes(ds => [...ds, ...nuevosLocales]);
    setMasivo(m => ({ ...m, subiendo: false, resultado: { creados, fallos } }));
  }

  async function guardar() {
    if (!modal.nombres || !modal.apellidos || !modal.cedula) {
      setError('Nombres, apellidos y cédula son obligatorios.'); setTab('personales'); return;
    }
    setGuardando(true); setError('');
    const payload = {
      cedula: modal.cedula, nombres: modal.nombres, apellidos: modal.apellidos,
      fecha_nacimiento: modal.fecha_nacimiento || null, genero: modal.genero || null,
      tipo_sangre: modal.tipo_sangre || null, direccion: modal.direccion || null,
      residencia: modal.residencia || null, telefono: modal.telefono || null,
      email: modal.email || null, foto_url: modal.foto_url || null,
      situacion: modal.situacion || null, cargo: modal.cargo || null,
      especialidad: modal.especialidad || null, area: modal.area || null,
      accion_personal: modal.accion_personal || null, categoria: modal.categoria || null,
      rmu: modal.rmu || 0, jornada: modal.jornada || null,
      fecha_ingreso: modal.fecha_ingreso || null, incorporado: !!modal.incorporado,
      obs_laborales: modal.obs_laborales, titulos: modal.titulos, documentos: modal.documentos
    };
    try {
      if (modal.id) {
        await guardarDocentePerfil(modal.id, payload);
        setDocentes(ds => ds.map(d => d.id === modal.id
          ? { ...d, nombre: `${payload.apellidos} ${payload.nombres}`.trim(), cedula: payload.cedula, situacion: payload.situacion, cargo: payload.cargo }
          : d));
      } else {
        const nuevo = await crearDocente(institucion.id, payload);
        setDocentes(ds => [...ds, {
          id: nuevo.id, nombre: `${payload.apellidos} ${payload.nombres}`.trim(), cedula: payload.cedula,
          situacion: payload.situacion, cargo: payload.cargo, materias: [], cursos: [], activo: true, acceso: false
        }]);
      }
      cerrar();
    } catch (e) {
      setError('No se pudo guardar: ' + e.message);
    } finally {
      setGuardando(false);
    }
  }

  async function asignarCarga() {
    if (!nuevaCarga.materiaId || !nuevaCarga.paraleloId || !nuevaCarga.periodoId) {
      setError('Selecciona materia, curso/paralelo y período.'); return;
    }
    try {
      await crearCargaDocente(modal.id, nuevaCarga.materiaId, nuevaCarga.paraleloId, nuevaCarga.periodoId);
      setNuevaCarga({ materiaId: '', gradoId: '', paraleloId: '', periodoId: '' });
      await cargarCargasDocente(modal.id);
    } catch (e) {
      setError('No se pudo asignar la carga: ' + e.message);
    }
  }

  async function quitarCarga(cargaId) {
    try {
      await eliminarCargaDocente(cargaId);
      await cargarCargasDocente(modal.id);
    } catch (e) {
      setError('No se pudo quitar la carga: ' + e.message);
    }
  }

  const gradoSeleccionado = catalogo.grados.find(g => g.id === nuevaCarga.gradoId);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Docentes</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={abrirCargaMasiva}>📥 Carga masiva (Excel)</button>
          <button className="btn btn-primary" onClick={abrirNuevo}>+ Nuevo docente</button>
        </div>
      </div>

      <input className="search" placeholder="Buscar por nombre o cédula…"
        value={busqueda} onChange={e => setBusqueda(e.target.value)} />

      <div className="card">
        <table className="data" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>#</th><th>Plantel</th><th>Cédula</th><th>Apellidos y Nombres</th>
              <th>Situación</th><th>Función</th><th>Acceso</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((d, i) => (
              <tr key={d.id}>
                <td>{(paginaActual - 1) * porPagina + i + 1}</td>
                <td>{institucion?.nombre || '—'}</td>
                <td className="mono">{d.cedula || '—'}</td>
                <td><strong style={{ cursor: 'pointer' }} onClick={() => abrirEditar(d.id)}>{d.nombre}</strong></td>
                <td>{d.situacion}</td>
                <td>{d.cargo}</td>
                <td>{d.acceso ? <span className="badge b-ok">Activo</span> : <span className="badge b-muted">Sin acceso</span>}</td>
                <td><button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(d.id)}>✏️ Editar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtrados.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 2px' }}>
          <span style={{ fontSize: 12, color: 'var(--slate)' }}>
            {filtrados.length} docente{filtrados.length === 1 ? '' : 's'} · página {paginaActual} de {totalPaginas}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-ghost btn-sm" disabled={paginaActual <= 1} onClick={() => setPagina(p => Math.max(1, p - 1))}>Anterior</button>
            <button className="btn btn-ghost btn-sm" disabled={paginaActual >= totalPaginas} onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}>Siguiente</button>
          </div>
        </div>
      )}
      {filtrados.length === 0 && <p className="muted">No hay docentes registrados en esta institución.</p>}

      {modal && (
        <div className="modal-bg" onClick={cerrar}>
          <div className="modal wide" onClick={e => e.stopPropagation()}>
            <div className="modal-h">
              <h3>{modal.id ? '✏️ Editar docente' : '➕ Nuevo docente'}{modal.nombre ? ' — ' + modal.nombres + ' ' + modal.apellidos : ''}</h3>
              <button className="btn btn-ghost btn-sm" onClick={cerrar}><span className="ti ti-x" /></button>
            </div>

            {error && <div className="lerr">{error}</div>}

            <div className="tabs">
              {['personales', 'laboral', 'titulos', 'documentos', 'cargas'].map(t => (
                <button key={t} className={'tab' + (tab === t ? ' on' : '')} onClick={() => setTab(t)}>
                  {{ personales: 'Personales', laboral: 'Laboral', titulos: 'Títulos', documentos: 'Documentos', cargas: 'Cargas' }[t]}
                </button>
              ))}
            </div>

            <div className="modal-b">
              {tab === 'personales' && (
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
                  <div><label className="fl">Cédula *</label>
                    <input className="fc mono" value={modal.cedula} onChange={e => upd('cedula', e.target.value)} /></div>
                  <div><label className="fl">Fecha de nacimiento</label>
                    <input className="fc" type="date" value={modal.fecha_nacimiento || ''} onChange={e => upd('fecha_nacimiento', e.target.value)} /></div>
                  <div><label className="fl">Género</label>
                    <select className="fc" value={modal.genero || ''} onChange={e => upd('genero', e.target.value)}>
                      <option value="">Seleccione…</option>
                      {GENEROS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select></div>
                  <div><label className="fl">Tipo de sangre</label>
                    <select className="fc" value={modal.tipo_sangre || ''} onChange={e => upd('tipo_sangre', e.target.value)}>
                      <option value="">Seleccione…</option>
                      {SANGRE.map(s => <option key={s} value={s}>{s}</option>)}
                    </select></div>
                  <div><label className="fl">Correo electrónico</label>
                    <input className="fc" type="email" value={modal.email || ''} onChange={e => upd('email', e.target.value)} /></div>
                  <div><label className="fl">Teléfono / celular</label>
                    <input className="fc" value={modal.telefono || ''} onChange={e => upd('telefono', e.target.value)} /></div>
                  <div className="full"><label className="fl">Dirección de domicilio</label>
                    <input className="fc" value={modal.direccion || ''} onChange={e => upd('direccion', e.target.value)} /></div>
                  <div className="full"><label className="fl">Lugar de residencia</label>
                    <input className="fc" value={modal.residencia || ''} onChange={e => upd('residencia', e.target.value)} /></div>
                </div>
              )}

              {tab === 'laboral' && (
                <div className="form-grid">
                  <div><label className="fl">Situación laboral</label>
                    <select className="fc" value={modal.situacion || ''} onChange={e => upd('situacion', e.target.value)}>
                      {SITUACIONES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select></div>
                  <div><label className="fl">Función / cargo</label>
                    <input className="fc" value={modal.cargo || ''} onChange={e => upd('cargo', e.target.value)} placeholder="DOCENTE" /></div>
                  <div><label className="fl">Especialidad</label>
                    <input className="fc" value={modal.especialidad || ''} onChange={e => upd('especialidad', e.target.value)} /></div>
                  <div><label className="fl">Área de trabajo</label>
                    <input className="fc" value={modal.area || ''} onChange={e => upd('area', e.target.value)} /></div>
                  <div><label className="fl">N° acción de personal</label>
                    <input className="fc" value={modal.accion_personal || ''} onChange={e => upd('accion_personal', e.target.value)} /></div>
                  <div><label className="fl">Categoría escalafón</label>
                    <input className="fc" value={modal.categoria || ''} onChange={e => upd('categoria', e.target.value)} /></div>
                  <div><label className="fl">RMU mensual (USD)</label>
                    <input className="fc" type="number" step="0.01" value={modal.rmu ?? 0} onChange={e => upd('rmu', +e.target.value)} /></div>
                  <div><label className="fl">Jornada</label>
                    <select className="fc" value={modal.jornada || ''} onChange={e => upd('jornada', e.target.value)}>
                      <option value="">Seleccione…</option>
                      {JORNADAS.map(j => <option key={j} value={j}>{j}</option>)}
                    </select></div>
                  <div><label className="fl">Fecha de ingreso</label>
                    <input className="fc" type="date" value={modal.fecha_ingreso || ''} onChange={e => upd('fecha_ingreso', e.target.value)} /></div>
                  <div><label className="fl">Años de servicio</label>
                    <input className="fc" disabled value={anios(modal.fecha_ingreso)} /></div>
                  <div className="full">
                    <label className="fl">Observaciones laborales</label>
                    {modal.obs_laborales.map((o, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                        <input className="fc" style={{ flex: 1 }} value={o}
                          onChange={e => { const arr = [...modal.obs_laborales]; arr[i] = e.target.value; upd('obs_laborales', arr); }} />
                        <button type="button" className="btn btn-danger btn-sm"
                          onClick={() => upd('obs_laborales', modal.obs_laborales.filter((_, j) => j !== i))}><span className="ti ti-x" /></button>
                      </div>
                    ))}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => upd('obs_laborales', [...modal.obs_laborales, ''])}>+ Agregar observación</button>
                  </div>
                </div>
              )}

              {tab === 'titulos' && (
                <div>
                  {modal.titulos.map((ti, i) => (
                    <div key={i} className="card" style={{ marginBottom: 12 }}>
                      <div className="form-grid">
                        <div className="full"><label className="fl">Título</label>
                          <input className="fc" value={ti.titulo || ''} placeholder="LIC. EN CIENCIAS DE LA EDUCACIÓN"
                            onChange={e => { const arr = [...modal.titulos]; arr[i] = { ...ti, titulo: e.target.value }; upd('titulos', arr); }} /></div>
                        <div><label className="fl">Institución de educación superior</label>
                          <input className="fc" value={ti.institucion || ''}
                            onChange={e => { const arr = [...modal.titulos]; arr[i] = { ...ti, institucion: e.target.value }; upd('titulos', arr); }} /></div>
                        <div><label className="fl">Número de registro (SENESCYT)</label>
                          <input className="fc mono" value={ti.nro_registro || ''}
                            onChange={e => { const arr = [...modal.titulos]; arr[i] = { ...ti, nro_registro: e.target.value }; upd('titulos', arr); }} /></div>
                        <div><label className="fl">Año de obtención</label>
                          <input className="fc" value={ti.anio || ''}
                            onChange={e => { const arr = [...modal.titulos]; arr[i] = { ...ti, anio: e.target.value }; upd('titulos', arr); }} /></div>
                      </div>
                      <button type="button" className="btn btn-danger btn-sm" style={{ marginTop: 8 }}
                        onClick={() => upd('titulos', modal.titulos.filter((_, j) => j !== i))}>🗑 Eliminar título</button>
                    </div>
                  ))}
                  <button type="button" className="btn btn-secondary"
                    onClick={() => upd('titulos', [...modal.titulos, { titulo: '', institucion: '', nro_registro: '', anio: '' }])}>+ Agregar título</button>
                </div>
              )}

              {tab === 'documentos' && (
                <div>
                  <label className="btn btn-secondary" style={{ marginBottom: 14, display: 'inline-block' }}>
                    📎 Subir documento
                    <input type="file" style={{ display: 'none' }}
                      onChange={e => e.target.files[0] && subirDocumento(e.target.files[0])} />
                  </label>
                  {modal.documentos.map((doc, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #eef1f8' }}>
                      <a href={doc.url} target="_blank" rel="noreferrer">{doc.nombre}</a>
                      <button type="button" className="btn btn-danger btn-sm"
                        onClick={() => upd('documentos', modal.documentos.filter((_, j) => j !== i))}><span className="ti ti-x" /></button>
                    </div>
                  ))}
                  {modal.documentos.length === 0 && <p className="muted">Sin documentos adjuntos.</p>}
                </div>
              )}

              {tab === 'cargas' && (
                <div>
                  {!modal.id ? (
                    <p className="muted">Guarde primero al docente para poder asignarle materias y cursos.</p>
                  ) : (
                    <>
                      {cargas.length === 0 && <p className="muted">Sin materias/cursos asignados.</p>}
                      {cargas.map(c => (
                        <div key={c.id} className="card" style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <strong>{c.materiaNombre}</strong> <span className="muted">— {c.gradoNombre} {c.paraleloNombre} · {c.periodoNombre}</span>
                          </div>
                          <button type="button" className="btn btn-danger btn-sm" onClick={() => quitarCarga(c.id)}>✕ Quitar</button>
                        </div>
                      ))}

                      <div className="card" style={{ marginTop: 14 }}>
                        <div className="ch"><h3>Asignar nueva carga</h3></div>
                        <div className="cb">
                          <div className="form-grid">
                            <div><label className="fl">Materia</label>
                              <select className="fc" value={nuevaCarga.materiaId} onChange={e => setNuevaCarga(n => ({ ...n, materiaId: e.target.value }))}>
                                <option value="">Seleccione…</option>
                                {catalogo.materias.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                              </select></div>
                            <div><label className="fl">Grado / curso</label>
                              <select className="fc" value={nuevaCarga.gradoId} onChange={e => setNuevaCarga(n => ({ ...n, gradoId: e.target.value, paraleloId: '' }))}>
                                <option value="">Seleccione…</option>
                                {catalogo.grados.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                              </select></div>
                            <div><label className="fl">Paralelo</label>
                              <select className="fc" value={nuevaCarga.paraleloId} onChange={e => setNuevaCarga(n => ({ ...n, paraleloId: e.target.value }))} disabled={!gradoSeleccionado}>
                                <option value="">Seleccione…</option>
                                {(gradoSeleccionado?.paralelos || []).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                              </select></div>
                            <div><label className="fl">Período lectivo</label>
                              <select className="fc" value={nuevaCarga.periodoId} onChange={e => setNuevaCarga(n => ({ ...n, periodoId: e.target.value }))}>
                                <option value="">Seleccione…</option>
                                {catalogo.periodos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                              </select></div>
                          </div>
                          <button type="button" className="btn btn-secondary" style={{ marginTop: 12 }} onClick={asignarCarga}>+ Asignar carga</button>
                        </div>
                      </div>
                    </>
                  )}
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
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
            <h3>📥 Carga masiva de docentes (Excel)</h3>
            <p style={{ color: 'var(--slate)', fontSize: 13 }}>
              Descarga la plantilla, complétala con los datos de los docentes y súbela aquí. Cédula, nombres y apellidos son obligatorios.
            </p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button className="btn btn-secondary" onClick={() => descargarPlantillaExcel('plantilla_docentes_sigee.xlsx', PLANTILLA_DOCENTES_COLS, PLANTILLA_DOCENTES_EJEMPLO)}>
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
                    <thead><tr><th>#</th><th>Cédula</th><th>Nombres</th><th>Apellidos</th><th>Estado</th></tr></thead>
                    <tbody>
                      {masivo.filas.map((f, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td className="mono">{f.payload.cedula || '—'}</td>
                          <td>{f.payload.nombres}</td>
                          <td>{f.payload.apellidos}</td>
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
                <p><strong>{masivo.resultado.creados}</strong> docente{masivo.resultado.creados === 1 ? '' : 's'} creado{masivo.resultado.creados === 1 ? '' : 's'} correctamente.</p>
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
                  onClick={confirmarCargaMasiva}
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
