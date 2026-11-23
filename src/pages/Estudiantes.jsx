import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { fetchEstudiantePerfil, guardarEstudiantePerfil } from '../lib/data.js';
import { cmpNombre } from '../lib/ordenar.js';
import ListadosEstudiantesModal from '../components/ListadosEstudiantesModal.jsx';
import {
  validarCedulaEcuador,
  puedeGenerarCodigoExtranjero,
  generarCodigoExtranjero,
  validarDocumento,
  esNacionalidadEcuador,
  NACIONALIDADES_COMUNES,
} from '../lib/documentoEstudiante.js';

const GENEROS = ['Masculino', 'Femenino'];

function iniciales(apellidos, nombres) {
  const a = String(apellidos || '').trim().split(/\s+/)[0] || '';
  const n = String(nombres || '').trim().split(/\s+/)[0] || '';
  return ((a[0] || '') + (n[0] || '')).toUpperCase() || '?';
}

function DocBadge({ tipo, valor }) {
  if (!valor) return <span style={{ color: 'var(--slateL)' }}>—</span>;
  const t = tipo || (String(valor).startsWith('EXT-') ? 'codigo_sigee' : 'cedula');
  const meta = {
    cedula: { label: 'Cédula', bg: 'var(--blueL)', color: 'var(--blueD)', border: '#93c5fd' },
    pasaporte: { label: 'Pasaporte', bg: 'var(--purpleL)', color: 'var(--purple)', border: '#c4b5fd' },
    codigo_sigee: { label: 'Código SIGEE', bg: 'var(--amberL)', color: 'var(--amberD)', border: '#fcd34d' },
  }[t] || { label: 'Doc.', bg: 'var(--page)', color: 'var(--slate)', border: 'var(--line)' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: 220 }}>
      <span style={{
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
        padding: '2px 7px', borderRadius: 20, background: meta.bg, color: meta.color,
        border: `1px solid ${meta.border}`, flexShrink: 0,
      }}>{meta.label}</span>
      <span className="mono" style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis' }} title={valor}>{valor}</span>
    </span>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="fl">{label}</label>
      {children}
    </div>
  );
}

function Section({ title, icon, children, accent }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: accent ? 'var(--amberD)' : 'var(--ink)' }}>
        <span className={icon} style={{ fontSize: 16 }} />
        <span style={{ fontWeight: 800, fontSize: 13.5 }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

export default function Estudiantes() {
  const { data, institucion, profile, refrescarDatos } = useSession();
  const esDece = profile.rol === 'dece' || profile.rolDb === 'dece';
  const puedeEscribir = ['super_admin', 'admin_plantel', 'secretario'].includes(profile.rolDb);
  const puedeListados = ['super_admin', 'admin_plantel', 'secretario', 'inspector_general', 'supervisor_plantel', 'docente'].includes(profile.rolDb || profile.rol);
  const [estudiantes, setEstudiantes] = useState(data?.estudiantes || []);
  const [busqueda, setBusqueda] = useState('');
  const [fCurso, setFCurso] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [pagina, setPagina] = useState(1);
  const [cargandoPerfil, setCargandoPerfil] = useState(false);
  const [modalListados, setModalListados] = useState(false);
  const porPagina = 25;

  useEffect(() => { setEstudiantes(data?.estudiantes || []); }, [data]);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const filtrados = useMemo(() => [...estudiantes].sort(cmpNombre).filter(e => {
    if (busqueda) {
      const q = busqueda.toLowerCase();
      if (!e.nombre?.toLowerCase().includes(q) && !(e.cedula || '').toLowerCase().includes(q)) return false;
    }
    if (fCurso && `${e.curso} ${e.paralelo}`.trim() !== fCurso) return false;
    return true;
  }), [estudiantes, busqueda, fCurso]);

  const cursosDisponibles = useMemo(
    () => [...new Set(estudiantes.map(e => `${e.curso} ${e.paralelo}`.trim()).filter(c => c && c !== '—'))].sort(),
    [estudiantes]
  );
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtrados.slice((paginaActual - 1) * porPagina, paginaActual * porPagina);

  function campo(k, v) {
    setForm(f => {
      const next = { ...f, [k]: v };
      if (k === 'extranjero' || k === 'nacionalidad') {
        const ext = k === 'extranjero' ? v : next.extranjero;
        const nac = k === 'nacionalidad' ? v : next.nacionalidad;
        if (ext && !esNacionalidadEcuador(nac)) {
          if (next.tipo_documento === 'cedula') next.tipo_documento = 'pasaporte';
        } else if (k === 'extranjero' && !v) {
          next.tipo_documento = 'cedula';
        }
      }
      return next;
    });
  }

  async function abrirEditar(id) {
    setError('');
    setCargandoPerfil(true);
    try {
      const e = await fetchEstudiantePerfil(id);
      if (!e) { setError('No se pudo cargar el estudiante.'); setCargandoPerfil(false); return; }
      const nacionalidad = e.nacionalidad || (e.tipo_documento === 'cedula' || !e.tipo_documento ? 'Ecuatoriana' : '');
      const extranjero = e.tipo_documento === 'pasaporte' || e.tipo_documento === 'codigo_sigee'
        || (!!nacionalidad && !esNacionalidadEcuador(nacionalidad));
      setModal(e);
      setForm({
        nombres: e.nombres || '',
        apellidos: e.apellidos || '',
        cedula: e.cedula || '',
        tipo_documento: e.tipo_documento || (extranjero ? 'pasaporte' : 'cedula'),
        extranjero,
        nacionalidad: nacionalidad || '',
        fecha_nacimiento: e.fecha_nacimiento || '',
        genero: e.genero || '',
        telefono: e.telefono || '',
        email: e.email || '',
        direccion: e.direccion || '',
        discapacidad: e.discapacidad || '',
        etnia: e.etnia || '',
      });
    } catch (err) {
      setError(err.message || 'Error al cargar perfil');
    }
    setCargandoPerfil(false);
  }

  function cerrarModal() {
    setModal(null);
    setForm(null);
    setError('');
  }

  function generarCodigo() {
    if (!form || !puedeGenerarCodigoExtranjero(form)) return;
    const pref = (institucion?.amie || institucion?.nombre || '').slice(0, 4);
    const codigo = generarCodigoExtranjero(pref);
    setForm(f => ({ ...f, cedula: codigo, tipo_documento: 'codigo_sigee' }));
  }

  async function guardarPerfil(ev) {
    ev.preventDefault();
    if (!form || !modal || !puedeEscribir) return;
    setError('');
    const val = validarDocumento(form);
    if (!val.ok) { setError(val.msg); return; }
    if (!form.extranjero && form.cedula && !validarCedulaEcuador(form.cedula)) {
      setError('Cédula ecuatoriana inválida.');
      return;
    }
    setGuardando(true);
    try {
      await guardarEstudiantePerfil(modal.id, {
        nombres: form.nombres.trim(),
        apellidos: form.apellidos.trim(),
        cedula: form.cedula.trim() || null,
        tipo_documento: form.tipo_documento || (form.extranjero ? 'pasaporte' : 'cedula'),
        nacionalidad: form.nacionalidad.trim() || null,
        fecha_nacimiento: form.fecha_nacimiento || null,
        genero: form.genero || null,
        telefono: form.telefono || null,
        email: form.email || null,
        direccion: form.direccion || null,
        discapacidad: form.discapacidad || null,
        etnia: form.etnia || null,
      });
      setToast({ tipo: 'ok', msg: 'Perfil actualizado correctamente.' });
      cerrarModal();
      if (typeof refrescarDatos === 'function') await refrescarDatos();
    } catch (err) {
      setError(err.message || 'No se pudo guardar el perfil.');
    }
    setGuardando(false);
  }

  const puedeCodigo = form && puedeGenerarCodigoExtranjero(form);
  const docValido = form
    ? (form.tipo_documento === 'cedula' || !form.extranjero
      ? (form.cedula.length === 10 ? validarCedulaEcuador(form.cedula) : null)
      : (form.cedula.length >= 6 ? true : null))
    : null;

  const motivoCodigoOff = !form ? ''
    : !form.extranjero ? 'Marque «Estudiante extranjero» para habilitar.'
      : !form.nacionalidad ? 'Seleccione la nacionalidad.'
        : esNacionalidadEcuador(form.nacionalidad) ? 'La nacionalidad debe ser distinta de ecuatoriana.'
          : '';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>Estudiantes</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--slate)', fontSize: 13 }}>
            {institucion?.nombre || 'Todos los planteles'} · Matrícula y perfil documental
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {puedeListados && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setModalListados(true)}>
              <span className="ti ti-printer" /> Imprimir / Exportar listados
            </button>
          )}
          <span style={{
            fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 999,
            background: 'var(--brandL)', color: 'var(--brandD)', border: '1px solid var(--brandXL)',
          }}>
            {filtrados.length} registro{filtrados.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {esDece && (
        <div style={{
          marginBottom: 14, padding: '12px 14px', borderRadius: 'var(--r2)',
          background: 'var(--tealL)', border: '1px solid var(--tealXL)', color: 'var(--tealD)', fontSize: 13,
        }}>
          Vista <strong>DECE</strong>: consulta de estudiantes. Use <strong>Informes Individuales</strong> para planes y seguimientos.
        </div>
      )}

      <div className="card" style={{ marginBottom: 14, padding: '12px 14px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 220px', position: 'relative' }}>
            <span className="ti ti-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--slateL)', fontSize: 16 }} />
            <input
              className="fc"
              style={{ paddingLeft: 36, width: '100%' }}
              placeholder="Buscar por nombre o documento…"
              value={busqueda}
              onChange={e => { setBusqueda(e.target.value); setPagina(1); }}
            />
          </div>
          <select className="fc" style={{ minWidth: 180 }} value={fCurso} onChange={e => { setFCurso(e.target.value); setPagina(1); }}>
            <option value="">Todos los cursos</option>
            {cursosDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {error && !modal && (
        <div className="lerr" style={{ display: 'flex', marginBottom: 12, background: 'var(--redL)', color: 'var(--redD)', border: '1px solid #fca5a5' }}>
          <span className="ti ti-alert-circle" /> {error}
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ paddingLeft: 16 }}>Estudiante</th>
                <th>Documento</th>
                <th>Curso</th>
                <th>Matrícula</th>
                <th>Estado</th>
                <th>Representante</th>
                <th style={{ textAlign: 'right', paddingRight: 16 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map(e => (
                <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => abrirEditar(e.id)}>
                  <td style={{ paddingLeft: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                        background: 'linear-gradient(135deg, #0891b2, #6366f1)',
                        color: '#fff', fontWeight: 800, fontSize: 12,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {iniciales(e.nombre?.split(' ').slice(0, 1).join(''), e.nombre?.split(' ').slice(-1).join(''))}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13.5 }}>{e.nombre}</div>
                        {e.acceso
                          ? <span style={{ fontSize: 11, color: 'var(--green)' }}>Con acceso</span>
                          : <span style={{ fontSize: 11, color: 'var(--slateL)' }}>Sin acceso al portal</span>}
                      </div>
                    </div>
                  </td>
                  <td onClick={ev => ev.stopPropagation()}><DocBadge valor={e.cedula} /></td>
                  <td>{e.curso} {e.paralelo}</td>
                  <td style={{ fontSize: 12.5 }}>{e.estado || '—'}</td>
                  <td>
                    <span className={'badge ' + (e.activo ? 'b-ok' : 'b-muted')}>{e.activo ? 'Activo' : 'Inactivo'}</span>
                  </td>
                  <td style={{ fontSize: 12.5, color: 'var(--slate)' }}>{e.representante || '—'}</td>
                  <td style={{ textAlign: 'right', paddingRight: 16 }} onClick={ev => ev.stopPropagation()}>
                    <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(e.id)}>
                      {esDece ? 'Perfil' : (puedeEscribir ? 'Editar' : 'Ver')}
                    </button>
                  </td>
                </tr>
              ))}
              {!visibles.length && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--slate)' }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>👤</div>
                    No hay estudiantes con los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filtrados.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 16px', borderTop: '1px solid var(--line)', background: 'var(--page)',
          }}>
            <span style={{ fontSize: 12, color: 'var(--slate)' }}>Página {paginaActual} de {totalPaginas}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-ghost btn-sm" disabled={paginaActual <= 1} onClick={() => setPagina(p => Math.max(1, p - 1))}>Anterior</button>
              <button className="btn btn-ghost btn-sm" disabled={paginaActual >= totalPaginas} onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}>Siguiente</button>
            </div>
          </div>
        )}
      </div>

      {cargandoPerfil && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ padding: 24 }}>Cargando perfil…</div>
        </div>
      )}

      {modalListados && <ListadosEstudiantesModal onClose={() => setModalListados(false)} />}

      {modal && form && (
        <div className="modal-overlay" onClick={cerrarModal} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 12px', overflowY: 'auto' }}>
          <div
            className="modal"
            style={{ maxWidth: 720, width: '100%', margin: '0 auto', borderRadius: 'var(--r3)', boxShadow: 'var(--sh3)', overflow: 'hidden' }}
            onClick={ev => ev.stopPropagation()}
          >
            <div style={{
              background: 'linear-gradient(135deg, #0c1c30 0%, #112540 50%, #0e7490 100%)',
              color: '#fff', padding: '20px 22px', display: 'flex', gap: 14, alignItems: 'center',
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 18,
              }}>
                {iniciales(form.apellidos, form.nombres)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.25 }}>
                  {form.apellidos} {form.nombres}
                </div>
                <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
                  Perfil documental · {puedeEscribir ? 'Edición' : 'Solo lectura'}
                </div>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={cerrarModal} style={{ color: '#fff', borderColor: 'rgba(255,255,255,.25)' }}>
                <span className="ti ti-x" />
              </button>
            </div>

            <form onSubmit={guardarPerfil}>
              <div style={{ padding: '18px 22px 8px', maxHeight: 'min(70vh, 640px)', overflowY: 'auto' }}>
                {error && (
                  <div style={{
                    display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14,
                    padding: '10px 12px', borderRadius: 'var(--r)', background: 'var(--redL)',
                    color: 'var(--redD)', border: '1px solid #fca5a5', fontSize: 13,
                  }}>
                    <span className="ti ti-alert-circle" /> {error}
                  </div>
                )}

                <Section title="Identidad" icon="ti ti-user">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field label="Apellidos">
                      <input className="fc" value={form.apellidos} disabled={!puedeEscribir} onChange={e => campo('apellidos', e.target.value)} required />
                    </Field>
                    <Field label="Nombres">
                      <input className="fc" value={form.nombres} disabled={!puedeEscribir} onChange={e => campo('nombres', e.target.value)} required />
                    </Field>
                    <Field label="Fecha de nacimiento">
                      <input className="fc" type="date" disabled={!puedeEscribir} value={form.fecha_nacimiento || ''} onChange={e => campo('fecha_nacimiento', e.target.value)} />
                    </Field>
                    <Field label="Género">
                      <select className="fc" disabled={!puedeEscribir} value={form.genero || ''} onChange={e => campo('genero', e.target.value)}>
                        <option value="">— Seleccione —</option>
                        {GENEROS.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </Field>
                  </div>
                </Section>

                <Section title="Documento de identidad" icon="ti ti-id" accent>
                  <div
                    role="button"
                    tabIndex={puedeEscribir ? 0 : -1}
                    onClick={() => puedeEscribir && campo('extranjero', !form.extranjero)}
                    onKeyDown={e => { if (puedeEscribir && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); campo('extranjero', !form.extranjero); } }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                      borderRadius: 'var(--r2)', cursor: puedeEscribir ? 'pointer' : 'default',
                      background: form.extranjero ? 'var(--amberL)' : 'var(--page)',
                      border: form.extranjero ? '1px solid #fcd34d' : '1px solid var(--line)',
                      marginBottom: 12,
                    }}
                  >
                    <div style={{
                      width: 22, height: 22, borderRadius: 6, border: form.extranjero ? '2px solid var(--amberD)' : '2px solid var(--line)',
                      background: form.extranjero ? 'var(--amberD)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {form.extranjero && <span className="ti ti-check" style={{ color: '#fff', fontSize: 14 }} />}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>Estudiante extranjero</div>
                      <div style={{ fontSize: 12, color: 'var(--slate)' }}>Permite pasaporte o código SIGEE en lugar de cédula</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field label="Tipo de documento">
                      <select className="fc" disabled={!puedeEscribir} value={form.tipo_documento || 'cedula'} onChange={e => campo('tipo_documento', e.target.value)}>
                        <option value="cedula">Cédula</option>
                        <option value="pasaporte">Pasaporte</option>
                        <option value="codigo_sigee">Código SIGEE</option>
                      </select>
                    </Field>
                    <Field label="Número / Código">
                      <input className="fc" value={form.cedula} disabled={!puedeEscribir} onChange={e => campo('cedula', e.target.value)} />
                    </Field>
                    <Field label="Nacionalidad">
                      <select className="fc" disabled={!puedeEscribir} value={form.nacionalidad || ''} onChange={e => campo('nacionalidad', e.target.value)}>
                        <option value="">— Seleccione —</option>
                        {NACIONALIDADES_COMUNES.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </Field>
                    {puedeEscribir && (
                      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <button type="button" className="btn btn-secondary btn-sm" disabled={!puedeCodigo} title={motivoCodigoOff} onClick={generarCodigo}>
                          Generar código SIGEE
                        </button>
                      </div>
                    )}
                  </div>
                </Section>

                <Section title="Contacto" icon="ti ti-phone">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field label="Teléfono">
                      <input className="fc" value={form.telefono || ''} disabled={!puedeEscribir} onChange={e => campo('telefono', e.target.value)} />
                    </Field>
                    <Field label="Correo">
                      <input className="fc" type="email" value={form.email || ''} disabled={!puedeEscribir} onChange={e => campo('email', e.target.value)} />
                    </Field>
                    <Field label="Dirección">
                      <input className="fc" value={form.direccion || ''} disabled={!puedeEscribir} onChange={e => campo('direccion', e.target.value)} style={{ gridColumn: '1 / -1' }} />
                    </Field>
                  </div>
                </Section>

                <Section title="Datos adicionales" icon="ti ti-notes">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field label="Discapacidad">
                      <input className="fc" value={form.discapacidad || ''} disabled={!puedeEscribir} onChange={e => campo('discapacidad', e.target.value)} />
                    </Field>
                    <Field label="Etnia">
                      <input className="fc" value={form.etnia || ''} disabled={!puedeEscribir} onChange={e => campo('etnia', e.target.value)} />
                    </Field>
                  </div>
                </Section>
              </div>

              <div style={{ padding: '12px 22px 18px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={cerrarModal}>Cerrar</button>
                {puedeEscribir && (
                  <button type="submit" className="btn btn-primary" disabled={guardando}>
                    {guardando ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
          padding: '12px 16px', borderRadius: 'var(--r2)', boxShadow: 'var(--sh2)',
          background: toast.tipo === 'ok' ? 'var(--greenL)' : 'var(--redL)',
          color: toast.tipo === 'ok' ? 'var(--greenD)' : 'var(--redD)',
          border: `1px solid ${toast.tipo === 'ok' ? '#86efac' : '#fca5a5'}`,
          fontSize: 13, fontWeight: 600,
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
