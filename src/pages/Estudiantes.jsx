import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { fetchEstudiantePerfil, guardarEstudiantePerfil } from '../lib/data.js';
import { cmpNombre } from '../lib/ordenar.js';
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

export default function Estudiantes() {
  const { data, institucion, profile, refrescarDatos } = useSession();
  const esDece = profile.rol === 'dece' || profile.rolDb === 'dece';
  const puedeEscribir = ['super_admin', 'admin_plantel', 'secretario'].includes(profile.rolDb);
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
        <span style={{
          fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 999,
          background: 'var(--brandL)', color: 'var(--brandD)', border: '1px solid var(--brandXL)',
        }}>
          {filtrados.length} registro{filtrados.length === 1 ? '' : 's'}
        </span>
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
                      border: form.extranjero ? '1.5px solid #fcd34d' : '1.5px solid var(--line)',
                      transition: 'background .15s, border-color .15s', marginBottom: 14,
                    }}
                  >
                    <div style={{
                      width: 44, height: 26, borderRadius: 999, padding: 3, flexShrink: 0,
                      background: form.extranjero ? 'var(--amber)' : 'var(--lineD)', transition: 'background .15s',
                    }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: 'var(--sh)',
                        transform: form.extranjero ? 'translateX(18px)' : 'translateX(0)', transition: 'transform .15s',
                      }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5, color: form.extranjero ? 'var(--amberD)' : 'var(--ink)' }}>
                        Estudiante extranjero
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 2 }}>
                        Sin cédula ecuatoriana · pasaporte o código único SIGEE
                      </div>
                    </div>
                    {form.extranjero && (
                      <span style={{
                        fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
                        padding: '4px 10px', borderRadius: 999, background: '#fff', color: 'var(--amberD)',
                        border: '1px solid #fcd34d',
                      }}>Extranjero</span>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <Field label="Nacionalidad" required={form.extranjero}>
                      <select className="fc" disabled={!puedeEscribir} value={form.nacionalidad} onChange={e => campo('nacionalidad', e.target.value)}>
                        <option value="">— Seleccione —</option>
                        {NACIONALIDADES_COMUNES.map(n => <option key={n} value={n}>{n}</option>)}
                        {form.nacionalidad && !NACIONALIDADES_COMUNES.includes(form.nacionalidad) && (
                          <option value={form.nacionalidad}>{form.nacionalidad}</option>
                        )}
                      </select>
                    </Field>
                    <Field label="Tipo de documento">
                      <select className="fc" disabled={!puedeEscribir} value={form.tipo_documento} onChange={e => campo('tipo_documento', e.target.value)}>
                        {!form.extranjero && <option value="cedula">Cédula ecuatoriana</option>}
                        <option value="pasaporte">Pasaporte</option>
                        {puedeCodigo && <option value="codigo_sigee">Código único SIGEE</option>}
                      </select>
                    </Field>
                  </div>

                  <Field label={
                    form.tipo_documento === 'codigo_sigee' ? 'Código único SIGEE'
                      : form.tipo_documento === 'pasaporte' || form.extranjero ? 'Pasaporte / documento'
                        : 'Cédula ecuatoriana'
                  }>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <input
                        className="fc"
                        style={{
                          flex: 1, minWidth: 180, fontFamily: "'DM Mono', monospace",
                          borderColor: docValido === false ? 'var(--red)' : docValido === true ? 'var(--green)' : undefined,
                        }}
                        value={form.cedula}
                        disabled={!puedeEscribir || form.tipo_documento === 'codigo_sigee'}
                        onChange={e => campo('cedula', e.target.value)}
                        maxLength={form.tipo_documento === 'cedula' && !form.extranjero ? 10 : 32}
                        placeholder={form.extranjero ? 'Nº de pasaporte o genere código' : '10 dígitos'}
                      />
                      {puedeEscribir && (
                        <button
                          type="button"
                          className="btn"
                          disabled={!puedeCodigo}
                          onClick={generarCodigo}
                          style={{
                            whiteSpace: 'nowrap',
                            background: puedeCodigo ? 'linear-gradient(135deg, #d97706, #b45309)' : undefined,
                            color: puedeCodigo ? '#fff' : undefined,
                            border: puedeCodigo ? 'none' : undefined,
                            boxShadow: puedeCodigo ? '0 4px 14px rgba(217,119,6,.35)' : undefined,
                            opacity: puedeCodigo ? 1 : 0.55,
                            cursor: puedeCodigo ? 'pointer' : 'not-allowed',
                          }}
                          title={puedeCodigo ? 'Generar identificador único EXT-…' : motivoCodigoOff}
                        >
                          <span className="ti ti-key" style={{ marginRight: 6 }} />
                          Generar código único
                        </button>
                      )}
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {docValido === true && <Hint ok>Documento válido</Hint>}
                      {docValido === false && (
                        <Hint error>
                          {form.tipo_documento === 'cedula' || !form.extranjero
                            ? 'Cédula ecuatoriana inválida (algoritmo Registro Civil).'
                            : 'Documento demasiado corto.'}
                        </Hint>
                      )}
                      {puedeEscribir && !puedeCodigo && (
                        <Hint>{motivoCodigoOff || 'Complete extranjero + nacionalidad para generar código SIGEE.'}</Hint>
                      )}
                      {puedeCodigo && form.tipo_documento !== 'codigo_sigee' && (
                        <Hint accent>Puede ingresar el pasaporte o generar un código único SIGEE si no lo tiene a mano.</Hint>
                      )}
                      {form.tipo_documento === 'codigo_sigee' && form.cedula && (
                        <Hint ok>Código asignado. Se usará como identificador del estudiante (no reemplaza un pasaporte oficial).</Hint>
                      )}
                    </div>
                  </Field>

                  {puedeCodigo && puedeEscribir && (
                    <div style={{
                      marginTop: 12, padding: '12px 14px', borderRadius: 'var(--r2)',
                      background: 'linear-gradient(135deg, #fffbeb, #fef3c7)',
                      border: '1px solid #fcd34d', fontSize: 12.5, color: 'var(--amberD)',
                      display: 'flex', gap: 10, alignItems: 'flex-start',
                    }}>
                      <span className="ti ti-info-circle" style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }} />
                      <div>
                        <strong>Código único SIGEE</strong>
                        <div style={{ marginTop: 2, lineHeight: 1.45 }}>
                          Formato <span className="mono">EXT-…-AÑO-…</span>. Solo para extranjeros con nacionalidad distinta de ecuatoriana.
                          La cédula EC sigue validándose con el algoritmo oficial cuando el estudiante no es extranjero.
                        </div>
                      </div>
                    </div>
                  )}
                </Section>

                <Section title="Contacto" icon="ti ti-phone">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field label="Teléfono">
                      <input className="fc" disabled={!puedeEscribir} value={form.telefono || ''} onChange={e => campo('telefono', e.target.value)} placeholder="09XXXXXXXX" />
                    </Field>
                    <Field label="Email">
                      <input className="fc" type="email" disabled={!puedeEscribir} value={form.email || ''} onChange={e => campo('email', e.target.value)} />
                    </Field>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <Field label="Dirección">
                        <input className="fc" disabled={!puedeEscribir} value={form.direccion || ''} onChange={e => campo('direccion', e.target.value)} />
                      </Field>
                    </div>
                  </div>
                </Section>

                {modal.representantes?.length > 0 && (
                  <Section title="Representantes" icon="ti ti-users">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {modal.representantes.map(r => (
                        <div key={r.id} style={{
                          display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
                          padding: '10px 12px', borderRadius: 'var(--r)', background: 'var(--page)', border: '1px solid var(--line)',
                        }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{r.apellidos} {r.nombres}</div>
                            <div style={{ fontSize: 12, color: 'var(--slate)' }}>{r.rol_representante || 'Representante'}</div>
                          </div>
                          <div style={{ fontSize: 12.5, color: 'var(--slate)' }}>{r.telefono || '—'}</div>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {esDece && (
                  <div style={{ marginBottom: 8 }}>
                    <a className="btn btn-primary" href="/informes-dece" style={{ textDecoration: 'none' }}>Ir a Informes Individuales DECE</a>
                  </div>
                )}
              </div>

              <div style={{
                display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap',
                padding: '14px 22px', borderTop: '1px solid var(--line)', background: 'var(--page)',
              }}>
                <button type="button" className="btn btn-secondary" onClick={cerrarModal}>
                  {puedeEscribir ? 'Cancelar' : 'Cerrar'}
                </button>
                {puedeEscribir && (
                  <button type="submit" className="btn btn-primary" disabled={guardando} style={{ minWidth: 140 }}>
                    {guardando ? 'Guardando…' : 'Guardar perfil'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className={'toast ' + (toast.tipo === 'ok' ? 'ok' : 'err')} style={{ zIndex: 9999 }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function Section({ title, icon, children, accent }) {
  return (
    <div style={{
      marginBottom: 16, padding: 16, borderRadius: 'var(--r2)',
      background: 'var(--white)',
      border: accent ? '1px solid var(--amberXL)' : '1px solid var(--line)',
      boxShadow: accent ? '0 0 0 3px rgba(217,119,6,.06)' : 'none',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
        fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
        color: accent ? 'var(--amberD)' : 'var(--brandD)',
      }}>
        {icon && <span className={icon} style={{ fontSize: 16 }} />}
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children, required }) {
  return (
    <div>
      <label className="fl" style={{ marginBottom: 4 }}>
        {label}{required && <span style={{ color: 'var(--red)', marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function Hint({ children, ok, error, accent }) {
  const style = ok
    ? { background: 'var(--greenL)', color: 'var(--greenD)', border: '1px solid #6ee7b7' }
    : error
      ? { background: 'var(--redL)', color: 'var(--redD)', border: '1px solid #fca5a5' }
      : accent
        ? { background: 'var(--blueL)', color: 'var(--blueD)', border: '1px solid #93c5fd' }
        : { background: 'var(--page)', color: 'var(--slate)', border: '1px solid var(--line)' };
  return (
    <div style={{ ...style, fontSize: 12, padding: '6px 10px', borderRadius: 8, lineHeight: 1.4 }}>
      {children}
    </div>
  );
}
