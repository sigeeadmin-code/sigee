import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { useSession } from '../lib/SessionContext.jsx';
import {
  fetchGradosConParalelos, crearGrado, actualizarGrado, eliminarGrado,
  crearParalelo, actualizarParalelo, eliminarParalelo,
  fetchPeriodos, fetchDocentesSimple, fetchMaterias, crearMateria, eliminarMateria,
  crearPeriodo, activarPeriodo, eliminarPeriodo,
  fetchMateriasParalelo, crearMateriaParalelo, actualizarMateriaParalelo, eliminarMateriaParalelo,
  fetchEstudiantesParaleloDetalle, matricularEstudiante, actualizarAlumnoDetalle,
  darDeBajaEstudiante, trasladarEstudiante,
  fetchResumenAcademico, fetchTendenciaAsistencia, fetchPromedioPorMateria, fetchActividadReciente,
  fetchAlumnosParaExportar, fetchTodasCargas, fetchAsistenciaInstitucion
} from '../lib/data.js';

const JORNADAS = ['Matutina', 'Vespertina', 'Nocturna'];

// Validación de cédula ecuatoriana (algoritmo Módulo 10 del Registro Civil)
function validarCedula(cedula) {
  if (!/^\d{10}$/.test(cedula)) return false;
  const provincia = parseInt(cedula.substring(0, 2), 10);
  if (provincia < 1 || provincia > 24) return false;
  const digitos = cedula.split('').map(Number);
  const verificador = digitos[9];
  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let val = digitos[i] * (i % 2 === 0 ? 2 : 1);
    if (val > 9) val -= 9;
    suma += val;
  }
  const residuo = suma % 10;
  const digitoCalculado = residuo === 0 ? 0 : 10 - residuo;
  return digitoCalculado === verificador;
}

function linkWhatsapp(telefono, nombreAlumno) {
  const tel = (telefono || '').replace(/^0/, '');
  const msg = encodeURIComponent(`Estimado/a representante de ${nombreAlumno}`);
  return `https://wa.me/593${tel}?text=${msg}`;
}

export default function Academico() {
  const { profile } = useSession();
  const institucionId = profile.institucion_id;

  const [grados, setGrados] = useState([]);
  const [periodoActivo, setPeriodoActivo] = useState(null);
  const [docentes, setDocentes] = useState([]);
  const [materiasCatalogo, setMateriasCatalogo] = useState([]);
  const [loading, setLoading] = useState(true);

  const [gradoSelId, setGradoSelId] = useState(null);
  const [paraleloSelId, setParaleloSelId] = useState(null);
  const [tab, setTab] = useState('alumnos');

  const [materiasParalelo, setMateriasParalelo] = useState([]);
  const [alumnosParalelo, setAlumnosParalelo] = useState([]);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  const [toast, setToast] = useState(null);
  const showToast = (tipo, msg) => setToast({ tipo, msg });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const cargarBase = useCallback(async () => {
    setLoading(true);
    const [gr, per, doc, mat] = await Promise.all([
      fetchGradosConParalelos(institucionId),
      fetchPeriodos(institucionId),
      fetchDocentesSimple(institucionId),
      fetchMaterias(institucionId)
    ]);
    setGrados(gr);
    setPeriodoActivo(per.find(p => p.activo) || per[0] || null);
    setDocentes(doc);
    setMateriasCatalogo(mat);
    if (!gradoSelId && gr.length) {
      setGradoSelId(gr[0].id);
      setParaleloSelId(gr[0].paralelos[0]?.id || null);
    }
    setLoading(false);
  }, [institucionId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { cargarBase(); }, [cargarBase]);

  const gradoSel = useMemo(() => grados.find(g => g.id === gradoSelId) || null, [grados, gradoSelId]);
  const paraleloSel = useMemo(() => gradoSel?.paralelos.find(p => p.id === paraleloSelId) || null, [gradoSel, paraleloSelId]);

  const cargarDetalleParalelo = useCallback(async () => {
    if (!paraleloSel || !periodoActivo) { setMateriasParalelo([]); setAlumnosParalelo([]); return; }
    setLoadingDetalle(true);
    const [mats, als] = await Promise.all([
      fetchMateriasParalelo(paraleloSel.id, periodoActivo.id),
      fetchEstudiantesParaleloDetalle(paraleloSel.id, periodoActivo.id)
    ]);
    setMateriasParalelo(mats);
    setAlumnosParalelo(als);
    setLoadingDetalle(false);
  }, [paraleloSel, periodoActivo]);

  useEffect(() => { cargarDetalleParalelo(); }, [cargarDetalleParalelo]);

  function seleccionarGrado(id) {
    setGradoSelId(id);
    const g = grados.find(x => x.id === id);
    setParaleloSelId(g?.paralelos[0]?.id || null);
  }

  const totalParalelos = grados.reduce((a, g) => a + g.paralelos.length, 0);
  const [vista, setVista] = useState('resumen');

  if (loading) return <p style={{ fontSize: 13, color: 'var(--slate)' }}>Cargando…</p>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: '0 0 4px' }}>Gestión Académica</h2>
          <div style={{ fontSize: 13, color: 'var(--slate)' }}>
            Cursos, paralelos, materias y alumnos {periodoActivo ? `— ${periodoActivo.nombre}` : ''}
          </div>
        </div>
        <span className="badge b-info">{totalParalelos} paralelos</span>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <button className={'btn btn-sm ' + (vista === 'resumen' ? 'btn-primary' : 'btn-secondary')} onClick={() => setVista('resumen')}>Resumen</button>
        <button className={'btn btn-sm ' + (vista === 'gestion' ? 'btn-primary' : 'btn-secondary')} onClick={() => setVista('gestion')}>Gestión</button>
        <button className={'btn btn-sm ' + (vista === 'config' ? 'btn-primary' : 'btn-secondary')} onClick={() => setVista('config')}>Configuración</button>
      </div>

      {vista === 'config' ? (
        <ConfiguracionTab institucionId={institucionId} showToast={showToast} recargarPeriodos={cargarBase} />
      ) : vista === 'resumen' ? (
        <ResumenTab institucionId={institucionId} periodoActivo={periodoActivo} showToast={showToast} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 14, alignItems: 'start' }}>
          <CoursePanel
            grados={grados} gradoSelId={gradoSelId} onSelect={seleccionarGrado}
            institucionId={institucionId} recargar={cargarBase} showToast={showToast}
          />
          <ParallelPanel
            grado={gradoSel} paraleloSelId={paraleloSelId} onSelect={setParaleloSelId}
            docentes={docentes} recargar={cargarBase} showToast={showToast}
          />
          <SubjectStudentPanel
            paralelo={paraleloSel} grado={gradoSel} grados={grados} tab={tab} onTabChange={setTab}
            materias={materiasParalelo} alumnos={alumnosParalelo} loadingDetalle={loadingDetalle}
            materiasCatalogo={materiasCatalogo} docentes={docentes}
            institucionId={institucionId} periodoActivo={periodoActivo}
            recargarDetalle={cargarDetalleParalelo} recargarCatalogo={cargarBase} showToast={showToast}
          />
        </div>
      )}

      {toast && <div className={'toast ' + (toast.tipo === 'ok' ? 'ok' : 'err')}>{toast.msg}</div>}
    </div>
  );
}

// ─── Panel 1: Cursos (grados) ──────────────────────────────────────────
function CoursePanel({ grados, gradoSelId, onSelect, institucionId, recargar, showToast }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ nombre: '', nivel: '', orden: 0 });
  const [saving, setSaving] = useState(false);

  function abrirCrear() {
    setEditId(null);
    setForm({ nombre: '', nivel: '', orden: grados.length });
    setModalOpen(true);
  }
  function abrirEditar(g, e) {
    e.stopPropagation();
    setEditId(g.id);
    setForm({ nombre: g.nombre, nivel: g.nivel || '', orden: g.orden || 0 });
    setModalOpen(true);
  }
  async function guardar(e) {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    setSaving(true);
    try {
      if (editId) await actualizarGrado(editId, form);
      else await crearGrado(institucionId, form);
      setModalOpen(false);
      await recargar();
      showToast('ok', editId ? 'Curso actualizado.' : 'Curso creado.');
    } catch (err) {
      showToast('err', err.message || 'No se pudo guardar el curso.');
    }
    setSaving(false);
  }
  async function eliminar(g, e) {
    e.stopPropagation();
    if (!window.confirm(`¿Eliminar "${g.nombre}"? Debe no tener paralelos con alumnos.`)) return;
    try {
      await eliminarGrado(g.id);
      await recargar();
      showToast('ok', 'Curso eliminado.');
    } catch (err) {
      showToast('err', err.message || 'No se pudo eliminar (tiene paralelos o alumnos asociados).');
    }
  }

  return (
    <div className="card">
      <div className="ch" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 13 }}>Cursos</strong>
        <button className="btn btn-primary btn-sm" onClick={abrirCrear}><span className="ti ti-plus" /> Nuevo</button>
      </div>
      <div className="cb" style={{ padding: 0, maxHeight: 520, overflowY: 'auto' }}>
        {grados.length === 0 && <p style={{ fontSize: 12, color: 'var(--slate)', padding: 14 }}>Sin cursos todavía.</p>}
        {grados.map(g => (
          <div
            key={g.id}
            onClick={() => onSelect(g.id)}
            style={{
              padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--line)',
              background: g.id === gradoSelId ? 'var(--page)' : 'transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: g.id === gradoSelId ? 700 : 500 }}>{g.nombre}</div>
              <div style={{ fontSize: 11, color: 'var(--slate)' }}>{g.paralelos.length} paralelo{g.paralelos.length !== 1 ? 's' : ''}</div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn btn-ghost btn-sm" onClick={e => abrirEditar(g, e)}><span className="ti ti-pencil" /></button>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={e => eliminar(g, e)}><span className="ti ti-trash" /></button>
            </div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <form className="modal" onSubmit={guardar} style={{ maxWidth: 420 }}>
            <div className="modal-h"><h3>{editId ? 'Editar curso' : 'Nuevo curso'}</h3></div>
            <div className="modal-b">
              <div className="form-grid">
                <div className="full">
                  <label className="fl">Nombre</label>
                  <input className="fc" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: 1ro de Bachillerato" required />
                </div>
                <div>
                  <label className="fl">Nivel</label>
                  <input className="fc" value={form.nivel} onChange={e => setForm(f => ({ ...f, nivel: e.target.value }))} placeholder="EGB / Bachillerato" />
                </div>
                <div>
                  <label className="fl">Orden</label>
                  <input className="fc" type="number" value={form.orden} onChange={e => setForm(f => ({ ...f, orden: Number(e.target.value) }))} />
                </div>
              </div>
            </div>
            <div className="modal-f">
              <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ─── Panel 2: Paralelos del curso seleccionado ─────────────────────────
function ParallelPanel({ grado, paraleloSelId, onSelect, docentes, recargar, showToast }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ nombre: '', jornada: 'Matutina', tutor_docente_id: '' });
  const [saving, setSaving] = useState(false);

  function abrirCrear() {
    setEditId(null);
    setForm({ nombre: '', jornada: 'Matutina', tutor_docente_id: '' });
    setModalOpen(true);
  }
  function abrirEditar(p, e) {
    e.stopPropagation();
    setEditId(p.id);
    setForm({ nombre: p.nombre, jornada: p.jornada || 'Matutina', tutor_docente_id: p.tutor_docente_id || '' });
    setModalOpen(true);
  }
  async function guardar(e) {
    e.preventDefault();
    if (!grado || !form.nombre.trim()) return;
    setSaving(true);
    try {
      const payload = { nombre: form.nombre, jornada: form.jornada, tutor_docente_id: form.tutor_docente_id || null };
      if (editId) await actualizarParalelo(editId, payload);
      else await crearParalelo(grado.id, payload);
      setModalOpen(false);
      await recargar();
      showToast('ok', editId ? 'Paralelo actualizado.' : 'Paralelo creado.');
    } catch (err) {
      showToast('err', err.message || 'No se pudo guardar el paralelo.');
    }
    setSaving(false);
  }
  async function eliminar(p, e) {
    e.stopPropagation();
    if (!window.confirm(`¿Eliminar el paralelo "${p.nombre}"? Debe no tener alumnos matriculados.`)) return;
    try {
      await eliminarParalelo(p.id);
      await recargar();
      showToast('ok', 'Paralelo eliminado.');
    } catch (err) {
      showToast('err', err.message || 'No se pudo eliminar (tiene alumnos o cargas asociadas).');
    }
  }

  return (
    <div className="card">
      <div className="ch" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <strong style={{ fontSize: 13 }}>Paralelos</strong>
          <div style={{ fontSize: 11, color: 'var(--slate)' }}>{grado ? grado.nombre : 'Selecciona un curso'}</div>
        </div>
        {grado && <button className="btn btn-primary btn-sm" onClick={abrirCrear}><span className="ti ti-plus" /> Nuevo</button>}
      </div>
      <div className="cb" style={{ padding: 0, maxHeight: 520, overflowY: 'auto' }}>
        {!grado && <p style={{ fontSize: 12, color: 'var(--slate)', padding: 14 }}>Selecciona un curso para ver sus paralelos.</p>}
        {grado && grado.paralelos.length === 0 && <p style={{ fontSize: 12, color: 'var(--slate)', padding: 14 }}>Sin paralelos en este curso.</p>}
        {grado?.paralelos.map(p => {
          const tutor = docentes.find(d => d.id === p.tutor_docente_id);
          return (
            <div
              key={p.id}
              onClick={() => onSelect(p.id)}
              style={{
                padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--line)',
                background: p.id === paraleloSelId ? 'var(--page)' : 'transparent'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: p.id === paraleloSelId ? 700 : 500 }}>
                    {p.nombre} <span className="badge b-info" style={{ fontSize: 10, marginLeft: 4 }}>{p.jornada || 'Matutina'}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--slate)' }}>Tutor: {tutor ? tutor.nombre : 'Sin asignar'}</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-ghost btn-sm" onClick={e => abrirEditar(p, e)}><span className="ti ti-pencil" /></button>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={e => eliminar(p, e)}><span className="ti ti-trash" /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {modalOpen && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <form className="modal" onSubmit={guardar} style={{ maxWidth: 420 }}>
            <div className="modal-h"><h3>{editId ? 'Editar paralelo' : 'Nuevo paralelo'}</h3></div>
            <div className="modal-b">
              <div className="form-grid">
                <div className="full">
                  <label className="fl">Nombre</label>
                  <input className="fc" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: 1ro A" required />
                </div>
                <div>
                  <label className="fl">Jornada</label>
                  <select className="fc" value={form.jornada} onChange={e => setForm(f => ({ ...f, jornada: e.target.value }))}>
                    {JORNADAS.map(j => <option key={j} value={j}>{j}</option>)}
                  </select>
                </div>
                <div>
                  <label className="fl">Tutor/a</label>
                  <select className="fc" value={form.tutor_docente_id} onChange={e => setForm(f => ({ ...f, tutor_docente_id: e.target.value }))}>
                    <option value="">Sin asignar</option>
                    {docentes.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-f">
              <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ─── Panel 3: Materias / Alumnos del paralelo seleccionado ─────────────
function SubjectStudentPanel({
  paralelo, grado, grados, tab, onTabChange, materias, alumnos, loadingDetalle,
  materiasCatalogo, docentes, institucionId, periodoActivo, recargarDetalle, recargarCatalogo, showToast
}) {
  const [q, setQ] = useState('');
  const filtrados = alumnos.filter(a => {
    if (!q) return true;
    const texto = `${a.nombres} ${a.apellidos} ${a.cedula || ''}`.toLowerCase();
    return texto.includes(q.toLowerCase());
  });
  const totalHoras = materias.reduce((a, m) => a + (m.horasSemana || 0), 0);
  const pendientes = materias.filter(m => m.estado === 'pendiente').length;

  if (!paralelo) {
    return (
      <div className="card"><div className="cb" style={{ textAlign: 'center', padding: 40 }}>
        <span className="ti ti-book" style={{ fontSize: 28, color: 'var(--slate)' }} />
        <p style={{ fontSize: 13, color: 'var(--slate)', marginTop: 8 }}>Selecciona un paralelo para ver sus materias y alumnos.</p>
      </div></div>
    );
  }

  return (
    <div className="card">
      <div className="ch">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div>
            <strong style={{ fontSize: 13 }}>{paralelo.nombre} — {grado?.nombre}</strong>
            <div style={{ fontSize: 11, color: 'var(--slate)' }}>{paralelo.jornada || 'Matutina'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          <span className="badge b-info">{materias.length} materias · {totalHoras}h/sem</span>
          <span className="badge b-info">{alumnos.length} alumnos</span>
          {pendientes > 0 && <span className="badge b-muted">{pendientes} sin docente</span>}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className={'btn btn-sm ' + (tab === 'alumnos' ? 'btn-primary' : 'btn-secondary')} onClick={() => onTabChange('alumnos')}>Alumnos ({alumnos.length})</button>
          <button className={'btn btn-sm ' + (tab === 'materias' ? 'btn-primary' : 'btn-secondary')} onClick={() => onTabChange('materias')}>Materias ({materias.length})</button>
        </div>
      </div>

      <div className="cb" style={{ padding: 0 }}>
        {loadingDetalle ? (
          <p style={{ fontSize: 12, color: 'var(--slate)', padding: 14 }}>Cargando…</p>
        ) : tab === 'alumnos' ? (
          <AlumnosTab
            alumnos={filtrados} q={q} setQ={setQ} paralelo={paralelo} grado={grado} grados={grados}
            institucionId={institucionId} periodoActivo={periodoActivo} recargarDetalle={recargarDetalle} showToast={showToast}
          />
        ) : (
          <MateriasTab
            materias={materias} paralelo={paralelo} periodoActivo={periodoActivo}
            materiasCatalogo={materiasCatalogo} docentes={docentes} institucionId={institucionId}
            recargarDetalle={recargarDetalle} recargarCatalogo={recargarCatalogo} showToast={showToast}
          />
        )}
      </div>
    </div>
  );
}

// ── Sub-pestaña: Alumnos ──
function AlumnosTab({ alumnos, q, setQ, paralelo, grado, grados, institucionId, periodoActivo, recargarDetalle, showToast }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editAlumno, setEditAlumno] = useState(null);
  const [form, setForm] = useState({ nombres: '', apellidos: '', tipoDocumento: 'cedula', cedula: '', repNombre: '', repTelefono: '' });
  const [saving, setSaving] = useState(false);

  const [transferAlumno, setTransferAlumno] = useState(null);
  const [transferGradoId, setTransferGradoId] = useState('');
  const [transferParaleloId, setTransferParaleloId] = useState('');
  const [transferMotivo, setTransferMotivo] = useState('');

  const cedulaValida = form.tipoDocumento === 'cedula' ? (form.cedula.length === 10 ? validarCedula(form.cedula) : null) : (form.cedula.length >= 6 ? true : null);

  function abrirCrear() {
    setEditAlumno(null);
    setForm({ nombres: '', apellidos: '', tipoDocumento: 'cedula', cedula: '', repNombre: '', repTelefono: '' });
    setModalOpen(true);
  }
  function abrirEditar(a) {
    setEditAlumno(a);
    setForm({ nombres: a.nombres, apellidos: a.apellidos, tipoDocumento: a.tipoDocumento, cedula: a.cedula || '', repNombre: a.representante || '', repTelefono: a.telefonoRep || '' });
    setModalOpen(true);
  }
  async function guardar(e) {
    e.preventDefault();
    if (!form.nombres.trim() || !form.apellidos.trim()) return;
    setSaving(true);
    try {
      const datosEstudiante = { nombres: form.nombres.trim(), apellidos: form.apellidos.trim(), tipo_documento: form.tipoDocumento, cedula: form.cedula.trim() || null };
      const datosRepresentante = { nombres: form.repNombre.trim(), telefono: form.repTelefono.trim() };
      if (editAlumno) {
        await actualizarAlumnoDetalle(editAlumno.id, editAlumno.representanteId, datosEstudiante, editAlumno.representanteId ? datosRepresentante : null);
      } else {
        await matricularEstudiante(institucionId, periodoActivo.id, grado.id, paralelo.id, datosEstudiante, datosRepresentante);
      }
      setModalOpen(false);
      await recargarDetalle();
      showToast('ok', editAlumno ? 'Datos del alumno actualizados.' : 'Alumno matriculado.');
    } catch (err) {
      showToast('err', err.message || 'No se pudo guardar el alumno.');
    }
    setSaving(false);
  }
  async function darBaja(a) {
    if (!window.confirm(`¿Dar de baja a ${a.nombres} ${a.apellidos} de este paralelo?`)) return;
    try {
      await darDeBajaEstudiante(a.matriculaId, a.id);
      await recargarDetalle();
      showToast('ok', 'Alumno dado de baja.');
    } catch (err) {
      showToast('err', err.message || 'No se pudo dar de baja.');
    }
  }

  function abrirTraslado(a) {
    setTransferAlumno(a);
    setTransferGradoId('');
    setTransferParaleloId('');
    setTransferMotivo('');
  }
  async function confirmarTraslado() {
    if (!transferParaleloId || transferMotivo.trim().length < 10) {
      showToast('err', 'Selecciona el paralelo destino y escribe un motivo (mín. 10 caracteres).');
      return;
    }
    try {
      await trasladarEstudiante(transferAlumno.id, periodoActivo.id, transferGradoId, transferParaleloId, transferMotivo.trim());
      setTransferAlumno(null);
      await recargarDetalle();
      showToast('ok', `${transferAlumno.nombres} trasladado/a.`);
    } catch (err) {
      showToast('err', err.message || 'No se pudo trasladar al alumno.');
    }
  }

  return (
    <>
      <div style={{ padding: 12 }}>
        <input className="fc" placeholder="Buscar por nombre o cédula…" value={q} onChange={e => setQ(e.target.value)} style={{ marginBottom: 10 }} />
        <button className="btn btn-primary btn-sm" onClick={abrirCrear}><span className="ti ti-user-plus" /> Matricular alumno</button>
      </div>
      {alumnos.length === 0 ? (
        <div className="empty"><span className="ti ti-users" /><p>Sin alumnos matriculados en este paralelo.</p></div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data" style={{ width: '100%' }}>
            <thead><tr><th>Alumno</th><th>Documento</th><th>Representante</th><th>Hermanos</th><th /></tr></thead>
            <tbody>
              {alumnos.map(a => (
                <tr key={a.id}>
                  <td><strong>{a.apellidos}</strong><div style={{ fontSize: 11, color: 'var(--slate)' }}>{a.nombres}</div></td>
                  <td>
                    <span style={{ fontFamily: 'monospace' }}>{a.cedula || '—'}</span>
                    {a.cedula && (a.tipoDocumento === 'cedula' ? validarCedula(a.cedula) : a.cedula.length >= 6)
                      ? <span className="ti ti-shield-check" style={{ color: 'var(--green,#16a34a)', marginLeft: 4 }} title="Válido" />
                      : a.cedula ? <span className="ti ti-shield-x" style={{ color: 'var(--red)', marginLeft: 4 }} title="Inválido" /> : null}
                  </td>
                  <td>
                    {a.representante || '—'}
                    {a.telefonoRep && (
                      <div><a href={linkWhatsapp(a.telefonoRep, `${a.nombres} ${a.apellidos}`)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11 }}>
                        <span className="ti ti-brand-whatsapp" /> {a.telefonoRep}
                      </a></div>
                    )}
                  </td>
                  <td>{a.hermanos > 0 ? <span className="badge b-info">{a.hermanos}</span> : '—'}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => abrirTraslado(a)} title="Trasladar"><span className="ti ti-arrows-exchange" /></button>
                    <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(a)} title="Editar"><span className="ti ti-pencil" /></button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => darBaja(a)} title="Dar de baja"><span className="ti ti-user-x" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <form className="modal" onSubmit={guardar} style={{ maxWidth: 520 }}>
            <div className="modal-h"><h3>{editAlumno ? 'Editar alumno' : 'Matricular alumno'}</h3></div>
            <div className="modal-b">
              <div className="form-grid">
                <div><label className="fl">Nombres</label><input className="fc" value={form.nombres} onChange={e => setForm(f => ({ ...f, nombres: e.target.value }))} required /></div>
                <div><label className="fl">Apellidos</label><input className="fc" value={form.apellidos} onChange={e => setForm(f => ({ ...f, apellidos: e.target.value }))} required /></div>
                <div>
                  <label className="fl">Tipo de documento</label>
                  <select className="fc" value={form.tipoDocumento} onChange={e => setForm(f => ({ ...f, tipoDocumento: e.target.value, cedula: '' }))}>
                    <option value="cedula">Cédula ecuatoriana</option>
                    <option value="pasaporte">Pasaporte</option>
                  </select>
                </div>
                <div>
                  <label className="fl">{form.tipoDocumento === 'cedula' ? 'Cédula' : 'Pasaporte'}</label>
                  <input className="fc" style={{ fontFamily: 'monospace' }} value={form.cedula} onChange={e => setForm(f => ({ ...f, cedula: e.target.value }))} maxLength={form.tipoDocumento === 'cedula' ? 10 : 20} />
                  {cedulaValida === false && <p style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>Documento inválido.</p>}
                  {cedulaValida === true && <p style={{ fontSize: 11, color: 'var(--green,#16a34a)', marginTop: 4 }}>Documento válido.</p>}
                </div>
                <div><label className="fl">Representante</label><input className="fc" value={form.repNombre} onChange={e => setForm(f => ({ ...f, repNombre: e.target.value }))} /></div>
                <div><label className="fl">Teléfono representante</label><input className="fc" value={form.repTelefono} onChange={e => setForm(f => ({ ...f, repTelefono: e.target.value }))} placeholder="09XXXXXXXX" /></div>
              </div>
            </div>
            <div className="modal-f">
              <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : (editAlumno ? 'Guardar cambios' : 'Matricular')}</button>
            </div>
          </form>
        </div>
      )}

      {transferAlumno && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setTransferAlumno(null); }}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-h"><h3>Trasladar alumno</h3></div>
            <div className="modal-b">
              <p style={{ fontSize: 13, marginBottom: 12 }}>{transferAlumno.nombres} {transferAlumno.apellidos} — origen: {paralelo.nombre} ({grado.nombre})</p>
              <div className="form-grid">
                <div>
                  <label className="fl">Curso destino</label>
                  <select className="fc" value={transferGradoId} onChange={e => { setTransferGradoId(e.target.value); setTransferParaleloId(''); }}>
                    <option value="">Seleccionar…</option>
                    {grados.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="fl">Paralelo destino</label>
                  <select className="fc" value={transferParaleloId} onChange={e => setTransferParaleloId(e.target.value)} disabled={!transferGradoId}>
                    <option value="">Seleccionar…</option>
                    {grados.find(g => g.id === transferGradoId)?.paralelos.filter(p => p.id !== paralelo.id).map(p => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="full">
                  <label className="fl">Motivo</label>
                  <textarea className="fc" rows={3} value={transferMotivo} onChange={e => setTransferMotivo(e.target.value)} placeholder="Mínimo 10 caracteres" />
                </div>
              </div>
            </div>
            <div className="modal-f">
              <button type="button" className="btn btn-secondary" onClick={() => setTransferAlumno(null)}>Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={confirmarTraslado}>Confirmar traslado</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Sub-pestaña: Materias ──
function MateriasTab({ materias, paralelo, periodoActivo, materiasCatalogo, docentes, institucionId, recargarDetalle, recargarCatalogo, showToast }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ materiaId: '', materiaNueva: '', horasSemana: 4, docenteId: '' });
  const [saving, setSaving] = useState(false);

  function abrirCrear() {
    setEditItem(null);
    setForm({ materiaId: '', materiaNueva: '', horasSemana: 4, docenteId: '' });
    setModalOpen(true);
  }
  function abrirEditar(m) {
    setEditItem(m);
    setForm({ materiaId: m.materiaId, materiaNueva: '', horasSemana: m.horasSemana, docenteId: m.docenteId || '' });
    setModalOpen(true);
  }
  async function guardar(e) {
    e.preventDefault();
    setSaving(true);
    try {
      let materiaId = form.materiaId;
      if (!editItem && !materiaId && form.materiaNueva.trim()) {
        const nueva = await crearMateria(institucionId, { nombre: form.materiaNueva.trim() });
        materiaId = nueva.id;
        await recargarCatalogo();
      }
      if (editItem) {
        await actualizarMateriaParalelo(editItem.id, { horas_semana: form.horasSemana, docente_id: form.docenteId || null });
      } else {
        if (!materiaId) { showToast('err', 'Selecciona o escribe una materia.'); setSaving(false); return; }
        await crearMateriaParalelo({ materiaId, paraleloId: paralelo.id, periodoId: periodoActivo.id, docenteId: form.docenteId || null, horasSemana: form.horasSemana });
      }
      setModalOpen(false);
      await recargarDetalle();
      showToast('ok', editItem ? 'Materia actualizada.' : 'Materia agregada al paralelo.');
    } catch (err) {
      showToast('err', err.message || 'No se pudo guardar la materia.');
    }
    setSaving(false);
  }
  async function eliminar(m) {
    if (!window.confirm(`¿Quitar "${m.materiaNombre}" de este paralelo?`)) return;
    try {
      await eliminarMateriaParalelo(m.id);
      await recargarDetalle();
      showToast('ok', 'Materia quitada del paralelo.');
    } catch (err) {
      showToast('err', err.message || 'No se pudo quitar la materia.');
    }
  }

  const totalHoras = materias.reduce((a, m) => a + (m.horasSemana || 0), 0);

  return (
    <>
      <div style={{ padding: 12 }}>
        <button className="btn btn-primary btn-sm" onClick={abrirCrear}><span className="ti ti-plus" /> Agregar materia</button>
      </div>
      {materias.length === 0 ? (
        <div className="empty"><span className="ti ti-book" /><p>Sin materias asignadas a este paralelo.</p></div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data" style={{ width: '100%' }}>
            <thead><tr><th>Materia</th><th>Docente</th><th>H/sem</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {materias.map(m => (
                <tr key={m.id}>
                  <td><strong>{m.materiaNombre}</strong></td>
                  <td>{m.docenteNombre || <span style={{ color: 'var(--slate)', fontStyle: 'italic' }}>Sin asignar</span>}</td>
                  <td>{m.horasSemana}</td>
                  <td>
                    {m.estado === 'asignada'
                      ? <span className="badge b-ok">Asignada</span>
                      : <span className="badge b-muted">Pendiente</span>}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(m)}><span className="ti ti-pencil" /></button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => eliminar(m)}><span className="ti ti-trash" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan={2} style={{ fontWeight: 700 }}>Total horas/semana</td><td style={{ fontWeight: 700 }}>{totalHoras}</td><td colSpan={2} /></tr></tfoot>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <form className="modal" onSubmit={guardar} style={{ maxWidth: 460 }}>
            <div className="modal-h"><h3>{editItem ? 'Editar materia' : 'Agregar materia'}</h3></div>
            <div className="modal-b">
              <div className="form-grid">
                {!editItem && (
                  <div className="full">
                    <label className="fl">Materia (del catálogo)</label>
                    <select className="fc" value={form.materiaId} onChange={e => setForm(f => ({ ...f, materiaId: e.target.value, materiaNueva: '' }))}>
                      <option value="">— Elegir del catálogo —</option>
                      {materiasCatalogo.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                    </select>
                    <p style={{ fontSize: 11, color: 'var(--slate)', margin: '6px 0' }}>o crea una nueva:</p>
                    <input className="fc" value={form.materiaNueva} onChange={e => setForm(f => ({ ...f, materiaNueva: e.target.value, materiaId: '' }))} placeholder="Nombre de materia nueva" />
                  </div>
                )}
                <div>
                  <label className="fl">Horas semanales</label>
                  <input className="fc" type="number" min={1} max={10} value={form.horasSemana} onChange={e => setForm(f => ({ ...f, horasSemana: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="fl">Docente</label>
                  <select className="fc" value={form.docenteId} onChange={e => setForm(f => ({ ...f, docenteId: e.target.value }))}>
                    <option value="">Sin asignar (pendiente)</option>
                    {docentes.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-f">
              <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

// ─── Pestaña Resumen: KPIs + gráficos + actividad + reportes ───────────
const COLORS = { brand: '#1E6BB8', green: '#16A34A', red: '#DC2626', amber: '#D97706', slate: '#64748B' };

function ResumenTab({ institucionId, periodoActivo, showToast }) {
  const [resumen, setResumen] = useState(null);
  const [tendencia, setTendencia] = useState([]);
  const [promedios, setPromedios] = useState([]);
  const [actividad, setActividad] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroActividad, setFiltroActividad] = useState('Todo');
  const [exportando, setExportando] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    const [res, tend, prom, act] = await Promise.all([
      fetchResumenAcademico(institucionId, periodoActivo?.id),
      fetchTendenciaAsistencia(institucionId, 30),
      periodoActivo ? fetchPromedioPorMateria(institucionId, periodoActivo.id) : [],
      fetchActividadReciente(institucionId)
    ]);
    setResumen(res); setTendencia(tend); setPromedios(prom); setActividad(act);
    setLoading(false);
  }, [institucionId, periodoActivo]);

  useEffect(() => { cargar(); }, [cargar]);

  function descargarCSV(nombre, filas) {
    if (!filas.length) { showToast('err', 'No hay datos para exportar todavía.'); return; }
    const headers = Object.keys(filas[0]);
    const csv = [headers.join(','), ...filas.map(f => headers.map(h => `"${String(f[h] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${nombre}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  async function exportar(tipo) {
    setExportando(tipo);
    try {
      if (tipo === 'alumnos') {
        const filas = await fetchAlumnosParaExportar(institucionId, periodoActivo?.id);
        descargarCSV('matricula_alumnos', filas);
      } else if (tipo === 'docentes') {
        const filas = await fetchTodasCargas(institucionId);
        descargarCSV('nomina_docentes_cargas', filas);
      } else if (tipo === 'faltas') {
        const desde = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
        const filas = await fetchAsistenciaInstitucion(institucionId, desde);
        descargarCSV('asistencia_ultimos_30_dias', filas);
      }
      showToast('ok', 'Reporte descargado.');
    } catch (err) {
      showToast('err', err.message || 'No se pudo generar el reporte.');
    }
    setExportando(null);
  }

  if (loading || !resumen) return <p style={{ fontSize: 13, color: 'var(--slate)' }}>Cargando resumen…</p>;

  const kpis = [
    { label: 'Asistencia de hoy', value: resumen.tasaAsistencia !== null ? `${resumen.tasaAsistencia}%` : '—', sub: resumen.totalHoy ? `${resumen.presentesHoy}/${resumen.totalHoy} registros hoy` : 'Sin registros de asistencia hoy' },
    { label: 'Alumnos en riesgo', value: resumen.alumnosEnRiesgo, sub: 'Promedio < 7.0 (con calificaciones cargadas)' },
    { label: 'Cobertura docente', value: resumen.coberturaDocente !== null ? `${resumen.coberturaDocente}%` : '—', sub: `${resumen.materiasSinDocente} materia(s) sin asignar` },
    { label: 'Movimientos (30 días)', value: resumen.movimientosPeriodo, sub: 'Matrículas y traslados' },
    { label: 'Tareas por calificar', value: resumen.tareasPorCalificar, sub: 'Entregas sin nota' },
    { label: 'Notificaciones (30 días)', value: resumen.notificacionesActivas, sub: 'Enviadas al plantel' }
  ];

  const filtrosAct = ['Todo', 'Traslados', 'Ingresos', 'Alertas', 'Asignaciones'];
  const actividadFiltrada = filtroActividad === 'Todo' ? actividad : actividad.filter(a => {
    if (filtroActividad === 'Traslados') return a.tipo === 'traslado' || a.tipo === 'baja';
    if (filtroActividad === 'Ingresos') return a.tipo === 'ingreso';
    if (filtroActividad === 'Alertas') return a.tipo === 'alerta';
    if (filtroActividad === 'Asignaciones') return a.tipo === 'asignacion';
    return true;
  });

  const reportes = [
    { id: 'alumnos', label: 'Matrícula de alumnos', desc: 'Por curso y paralelo (CSV)' },
    { id: 'docentes', label: 'Nómina de docentes', desc: 'Con carga horaria (CSV)' },
    { id: 'faltas', label: 'Asistencia últimos 30 días', desc: 'Todos los registros (CSV)' }
  ];

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        {kpis.map((k, i) => (
          <div key={i} className="card"><div className="cb">
            <div style={{ fontSize: 11, color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: .3 }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, margin: '4px 0' }}>{k.value}</div>
            <div style={{ fontSize: 11, color: 'var(--slate)' }}>{k.sub}</div>
          </div></div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 14 }}>
        <div className="card">
          <div className="ch"><strong style={{ fontSize: 13 }}>Tendencia de asistencia</strong><div style={{ fontSize: 11, color: 'var(--slate)' }}>Últimos 30 días</div></div>
          <div className="cb">
            {tendencia.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--slate)' }}>Sin registros de asistencia en los últimos 30 días.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={tendencia} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="attendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.brand} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={COLORS.brand} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="fecha" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip formatter={v => `${v}%`} />
                  <Area type="monotone" dataKey="asistencia" stroke={COLORS.brand} strokeWidth={2.5} fill="url(#attendGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="card">
          <div className="ch"><strong style={{ fontSize: 13 }}>Promedio por materia</strong><div style={{ fontSize: 11, color: 'var(--slate)' }}>{periodoActivo?.nombre || ''}</div></div>
          <div className="cb">
            {promedios.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--slate)' }}>Sin calificaciones registradas todavía.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={promedios} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barSize={22}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="materia" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="promedio" radius={[4, 4, 0, 0]}>
                    {promedios.map((p, i) => (
                      <Cell key={i} fill={p.promedio >= 9 ? COLORS.green : p.promedio >= 7 ? COLORS.brand : COLORS.red} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
        <div className="card">
          <div className="ch" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong style={{ fontSize: 13 }}>Registro de actividad</strong>
              <div style={{ fontSize: 11, color: 'var(--slate)' }}>Movimientos y eventos recientes</div>
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {filtrosAct.map(f => (
                <button key={f} className={'btn btn-sm ' + (filtroActividad === f ? 'btn-primary' : 'btn-secondary')} onClick={() => setFiltroActividad(f)}>{f}</button>
              ))}
            </div>
          </div>
          <div className="cb" style={{ padding: 0 }}>
            {actividadFiltrada.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--slate)', padding: 14 }}>Sin actividad en esta categoría todavía.</p>
            ) : actividadFiltrada.map((a, i) => (
              <div key={i} style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)' }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{a.titulo}</div>
                <div style={{ fontSize: 12, color: 'var(--slate)' }}>{a.detalle}</div>
                <div style={{ fontSize: 11, color: 'var(--slate)', marginTop: 2 }}>{a.fecha}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="ch"><strong style={{ fontSize: 13 }}>Reportes</strong><div style={{ fontSize: 11, color: 'var(--slate)' }}>Exportar en CSV</div></div>
          <div className="cb" style={{ padding: 0 }}>
            {reportes.map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--line)' }}>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 500 }}>{r.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--slate)' }}>{r.desc}</div>
                </div>
                <button className="btn btn-secondary btn-sm" disabled={exportando === r.id} onClick={() => exportar(r.id)}>
                  {exportando === r.id ? '…' : <span className="ti ti-download" />}
                </button>
              </div>
            ))}
            <p style={{ fontSize: 11, color: 'var(--slate)', padding: '10px 14px' }}>
              Por ahora los reportes se descargan en CSV (abrible en Excel). PDF con membrete institucional queda pendiente para más adelante.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Pestaña Configuración: Períodos lectivos + catálogo de Materias ───
// (Idéntico a lo que ya tenías en tu Academico.jsx real, para no perder
// la gestión de períodos al reemplazar el archivo por el nuevo dashboard)
function ConfiguracionTab({ institucionId, showToast, recargarPeriodos }) {
  const [subtab, setSubtab] = useState('periodo');
  return (
    <div>
      <div className="tabs" style={{ marginBottom: 14 }}>
        {['periodo', 'materias'].map(t => (
          <button key={t} className={'tab' + (subtab === t ? ' on' : '')} onClick={() => setSubtab(t)}>
            {{ periodo: 'Período lectivo', materias: 'Materias (catálogo)' }[t]}
          </button>
        ))}
      </div>
      {subtab === 'periodo' && <Periodos institucionId={institucionId} onToast={m => { showToast(m.tipo, m.msg); recargarPeriodos(); }} />}
      {subtab === 'materias' && <MateriasCatalogo institucionId={institucionId} onToast={m => showToast(m.tipo, m.msg)} />}
    </div>
  );
}

function Periodos({ institucionId, onToast }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nombre: '', fecha_inicio: '', fecha_fin: '' });
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    setItems(await fetchPeriodos(institucionId));
    setLoading(false);
  }, [institucionId]);
  useEffect(() => { cargar(); }, [cargar]);

  async function agregar(e) {
    e.preventDefault();
    if (!form.nombre || !form.fecha_inicio || !form.fecha_fin) return;
    setSaving(true);
    try {
      await crearPeriodo(institucionId, form);
      setForm({ nombre: '', fecha_inicio: '', fecha_fin: '' });
      await cargar();
      onToast({ tipo: 'ok', msg: 'Período creado.' });
    } catch (err) {
      onToast({ tipo: 'err', msg: err.message });
    }
    setSaving(false);
  }

  async function activar(id) {
    try {
      await activarPeriodo(institucionId, id);
      await cargar();
      onToast({ tipo: 'ok', msg: 'Período activado.' });
    } catch (err) { onToast({ tipo: 'err', msg: err.message }); }
  }

  async function eliminar(p) {
    if (!window.confirm(`¿Eliminar el período "${p.nombre}"?`)) return;
    try {
      await eliminarPeriodo(p.id);
      await cargar();
      onToast({ tipo: 'ok', msg: 'Período eliminado.' });
    } catch (err) { onToast({ tipo: 'err', msg: err.message || 'No se pudo eliminar (tiene datos asociados).' }); }
  }

  return (
    <div>
      <div className="card">
        <div className="ch"><h3>Períodos lectivos</h3></div>
        <div className="cb" style={{ padding: 0 }}>
          {loading ? <p className="muted" style={{ padding: 16 }}>Cargando…</p> : (
            <table className="data" style={{ width: '100%' }}>
              <thead><tr><th>Nombre</th><th>Inicio</th><th>Fin</th><th>Estado</th><th /></tr></thead>
              <tbody>
                {items.map(p => (
                  <tr key={p.id}>
                    <td><strong>{p.nombre}</strong></td>
                    <td>{p.fecha_inicio}</td>
                    <td>{p.fecha_fin}</td>
                    <td>{p.activo ? <span className="badge b-ok">Activo</span> : <span className="badge b-muted">Inactivo</span>}</td>
                    <td style={{ textAlign: 'right', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      {!p.activo && <button className="btn btn-secondary btn-sm" onClick={() => activar(p.id)}>Activar</button>}
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => eliminar(p)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && <tr><td colSpan={5} className="muted" style={{ padding: 16 }}>Sin períodos registrados.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <div className="ch"><h3>Nuevo período</h3></div>
        <form className="cb" onSubmit={agregar}>
          <div className="form-grid">
            <div className="full"><label className="fl">Nombre</label>
              <input className="fc" placeholder="2027-2028" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} /></div>
            <div><label className="fl">Fecha de inicio</label>
              <input className="fc" type="date" value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} /></div>
            <div><label className="fl">Fecha de fin</label>
              <input className="fc" type="date" value={form.fecha_fin} onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))} /></div>
          </div>
          <button className="btn btn-primary" style={{ marginTop: 14 }} disabled={saving}>{saving ? 'Guardando…' : '+ Crear período'}</button>
        </form>
      </div>
    </div>
  );
}

function MateriasCatalogo({ institucionId, onToast }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nombre: '', area: '' });
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    setItems(await fetchMaterias(institucionId));
    setLoading(false);
  }, [institucionId]);
  useEffect(() => { cargar(); }, [cargar]);

  async function agregar(e) {
    e.preventDefault();
    if (!form.nombre) return;
    setSaving(true);
    try {
      await crearMateria(institucionId, form);
      setForm({ nombre: '', area: '' });
      await cargar();
      onToast({ tipo: 'ok', msg: 'Materia creada.' });
    } catch (err) { onToast({ tipo: 'err', msg: err.message }); }
    setSaving(false);
  }

  async function eliminar(m) {
    if (!window.confirm(`¿Eliminar la materia "${m.nombre}"?`)) return;
    try {
      await eliminarMateria(m.id);
      await cargar();
      onToast({ tipo: 'ok', msg: 'Materia eliminada.' });
    } catch (err) { onToast({ tipo: 'err', msg: err.message || 'No se pudo eliminar (tiene cargas horarias asociadas).' }); }
  }

  return (
    <div>
      <div className="card">
        <div className="ch"><h3>Materias</h3></div>
        <div className="cb" style={{ padding: 0 }}>
          {loading ? <p className="muted" style={{ padding: 16 }}>Cargando…</p> : (
            <table className="data" style={{ width: '100%' }}>
              <thead><tr><th>Nombre</th><th>Área</th><th>Estado</th><th /></tr></thead>
              <tbody>
                {items.map(m => (
                  <tr key={m.id}>
                    <td><strong>{m.nombre}</strong></td>
                    <td>{m.area || '—'}</td>
                    <td>{m.activo !== false ? <span className="badge b-ok">Activa</span> : <span className="badge b-muted">Inactiva</span>}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => eliminar(m)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && <tr><td colSpan={4} className="muted" style={{ padding: 16 }}>Sin materias registradas.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <div className="ch"><h3>Nueva materia</h3></div>
        <form className="cb" onSubmit={agregar}>
          <div className="form-grid">
            <div><label className="fl">Nombre</label>
              <input className="fc" placeholder="Educación Física" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} /></div>
            <div><label className="fl">Área</label>
              <input className="fc" placeholder="Cultura Física" value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))} /></div>
          </div>
          <button className="btn btn-primary" style={{ marginTop: 14 }} disabled={saving}>{saving ? 'Guardando…' : '+ Crear materia'}</button>
        </form>
      </div>
    </div>
  );
}
