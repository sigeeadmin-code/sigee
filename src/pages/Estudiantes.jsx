import React, { useEffect, useState } from 'react';
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

/**
 * Estudiantes + perfil con documento para extranjeros.
 * - Cédula EC: validación Módulo 10.
 * - Extranjero + nacionalidad no ecuatoriana: habilita Generar código único SIGEE.
 */
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
  const porPagina = 25;

  useEffect(() => { setEstudiantes(data?.estudiantes || []); }, [data]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const filtrados = [...estudiantes].sort(cmpNombre).filter(e => {
    if (busqueda && !e.nombre?.toLowerCase().includes(busqueda.toLowerCase()) && !(e.cedula || '').includes(busqueda)) return false;
    if (fCurso && `${e.curso} ${e.paralelo}`.trim() !== fCurso) return false;
    return true;
  });
  const cursosDisponibles = [...new Set(estudiantes.map(e => `${e.curso} ${e.paralelo}`.trim()).filter(c => c && c !== '—'))].sort();
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
    try {
      const e = await fetchEstudiantePerfil(id);
      if (!e) { setError('No se pudo cargar el estudiante.'); return; }
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
      setToast({ tipo: 'ok', msg: 'Perfil actualizado.' });
      setModal(null);
      setForm(null);
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

      <div className="search-bar">
        <input className="search" style={{ flex: 1 }} placeholder="Buscar por nombre o cédula…"
          value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        <select className="fc" value={fCurso} onChange={e => setFCurso(e.target.value)}>
          <option value="">Todos los cursos</option>
          {cursosDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {error && !modal && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="card" style={{ overflow: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Documento</th>
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

      {modal && form && (
        <div className="modal-overlay" onClick={() => { setModal(null); setForm(null); setError(''); }}>
          <div className="modal" style={{ maxWidth: 640, width: '95%' }} onClick={ev => ev.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Perfil del estudiante</h3>
              <button type="button" className="btn btn-ghost" onClick={() => { setModal(null); setForm(null); setError(''); }}>✕</button>
            </div>

            {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

            <form onSubmit={guardarPerfil}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="fl">Apellidos</label>
                  <input className="fc" value={form.apellidos} disabled={!puedeEscribir} onChange={e => campo('apellidos', e.target.value)} required />
                </div>
                <div>
                  <label className="fl">Nombres</label>
                  <input className="fc" value={form.nombres} disabled={!puedeEscribir} onChange={e => campo('nombres', e.target.value)} required />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: puedeEscribir ? 'pointer' : 'default' }}>
                    <input
                      type="checkbox"
                      disabled={!puedeEscribir}
                      checked={!!form.extranjero}
                      onChange={e => campo('extranjero', e.target.checked)}
                    />
                    Estudiante extranjero (sin cédula ecuatoriana)
                  </label>
                </div>

                <div>
                  <label className="fl">Nacionalidad</label>
                  <select
                    className="fc"
                    disabled={!puedeEscribir}
                    value={form.nacionalidad}
                    onChange={e => campo('nacionalidad', e.target.value)}
                  >
                    <option value="">— Seleccione —</option>
                    {NACIONALIDADES_COMUNES.map(n => <option key={n} value={n}>{n}</option>)}
                    {form.nacionalidad && !NACIONALIDADES_COMUNES.includes(form.nacionalidad) && (
                      <option value={form.nacionalidad}>{form.nacionalidad}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="fl">Tipo de documento</label>
                  <select
                    className="fc"
                    disabled={!puedeEscribir}
                    value={form.tipo_documento}
                    onChange={e => campo('tipo_documento', e.target.value)}
                  >
                    {!form.extranjero && <option value="cedula">Cédula ecuatoriana</option>}
                    <option value="pasaporte">Pasaporte</option>
                    {puedeCodigo && <option value="codigo_sigee">Código único SIGEE</option>}
                  </select>
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="fl">
                    {form.tipo_documento === 'cedula' && !form.extranjero ? 'Cédula' :
                      form.tipo_documento === 'codigo_sigee' ? 'Código único SIGEE' : 'Pasaporte / documento'}
                  </label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input
                      className="fc"
                      style={{ fontFamily: 'monospace', flex: 1, minWidth: 180 }}
                      value={form.cedula}
                      disabled={!puedeEscribir || form.tipo_documento === 'codigo_sigee'}
                      onChange={e => campo('cedula', e.target.value)}
                      maxLength={form.tipo_documento === 'cedula' && !form.extranjero ? 10 : 32}
                      placeholder={form.extranjero ? 'Pasaporte o genere código SIGEE' : '10 dígitos'}
                    />
                    {puedeEscribir && (
                      <button
                        type="button"
                        className={'btn ' + (puedeCodigo ? 'btn-primary' : 'btn-secondary')}
                        disabled={!puedeCodigo}
                        title={
                          !form.extranjero
                            ? 'Solo disponible para estudiantes extranjeros'
                            : !form.nacionalidad
                              ? 'Seleccione primero la nacionalidad'
                              : esNacionalidadEcuador(form.nacionalidad)
                                ? 'La nacionalidad debe ser distinta de ecuatoriana'
                                : 'Genera un código único EXT-… para este estudiante'
                        }
                        onClick={generarCodigo}
                      >
                        Generar código único
                      </button>
                    )}
                  </div>
                  {docValido === false && (
                    <p style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>Documento inválido.</p>
                  )}
                  {docValido === true && (
                    <p style={{ fontSize: 11, color: '#16a34a', marginTop: 4 }}>Documento válido.</p>
                  )}
                  {!puedeCodigo && puedeEscribir && (
                    <p style={{ fontSize: 11, color: 'var(--slate)', marginTop: 4 }}>
                      El botón <strong>Generar código único</strong> se habilita solo si marca extranjero y elige una nacionalidad distinta de ecuatoriana.
                    </p>
                  )}
                  {puedeCodigo && (
                    <p style={{ fontSize: 11, color: 'var(--slate)', marginTop: 4 }}>
                      Use el código SIGEE cuando no tenga pasaporte a mano. Queda como identificador del estudiante (no es cédula EC).
                    </p>
                  )}
                </div>

                <div>
                  <label className="fl">Fecha de nacimiento</label>
                  <input className="fc" type="date" disabled={!puedeEscribir} value={form.fecha_nacimiento || ''} onChange={e => campo('fecha_nacimiento', e.target.value)} />
                </div>
                <div>
                  <label className="fl">Género</label>
                  <select className="fc" disabled={!puedeEscribir} value={form.genero || ''} onChange={e => campo('genero', e.target.value)}>
                    <option value="">—</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                  </select>
                </div>
                <div>
                  <label className="fl">Teléfono</label>
                  <input className="fc" disabled={!puedeEscribir} value={form.telefono || ''} onChange={e => campo('telefono', e.target.value)} />
                </div>
                <div>
                  <label className="fl">Email</label>
                  <input className="fc" type="email" disabled={!puedeEscribir} value={form.email || ''} onChange={e => campo('email', e.target.value)} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="fl">Dirección</label>
                  <input className="fc" disabled={!puedeEscribir} value={form.direccion || ''} onChange={e => campo('direccion', e.target.value)} />
                </div>
              </div>

              {modal.representantes?.length > 0 && (
                <div style={{ marginTop: 12, fontSize: 13 }}>
                  <strong>Representantes:</strong>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                    {modal.representantes.map(r => (
                      <li key={r.id}>{r.apellidos} {r.nombres} ({r.rol_representante || '—'}) · {r.telefono || ''}</li>
                    ))}
                  </ul>
                </div>
              )}

              {esDece && (
                <div style={{ marginTop: 16 }}>
                  <a className="btn btn-primary" href="/informes-dece">Ir a Informes Individuales DECE</a>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setModal(null); setForm(null); setError(''); }}>
                  {puedeEscribir ? 'Cancelar' : 'Cerrar'}
                </button>
                {puedeEscribir && (
                  <button type="submit" className="btn btn-primary" disabled={guardando}>
                    {guardando ? 'Guardando…' : 'Guardar perfil'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <div className={'toast ' + (toast.tipo === 'ok' ? 'ok' : 'err')}>{toast.msg}</div>}
    </div>
  );
}
