import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { fetchPlanteles, fetchUsuarios, crearUsuario, actualizarUsuario } from '../lib/data.js';

const NIVEL_SIGEE = ['super_admin', 'supervisor_general', 'contador_general'];

const ROLE_LABEL = {
  super_admin: 'Super Administrador (SIGEE)',
  supervisor_general: 'Supervisor General (SIGEE)',
  contador_general: 'Contador General (SIGEE)',
  admin_plantel: 'Administrador de Plantel',
  secretario: 'Secretario/a',
  supervisor_plantel: 'Supervisor de Plantel',
  contador_plantel: 'Contador de Plantel',
  administrativo: 'Administrativo',
  inspector_general: 'Inspector General',
  docente: 'Docente',
  estudiante: 'Estudiante',
  padre: 'Padre/Madre de familia'
};

const ROLES_TODOS = Object.keys(ROLE_LABEL);
const ROLES_PLANTEL = ROLES_TODOS.filter(r => !NIVEL_SIGEE.includes(r));

function generarPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  return Array.from(arr, n => chars[n % chars.length]).join('');
}

const emptyForm = {
  nombres: '', apellidos: '', email: '', cedula: '', telefono: '',
  rol: 'docente', institucion_id: '', password: ''
};

export default function Usuarios() {
  const { profile } = useSession();
  const esSuperAdmin = profile.rolDb === 'super_admin';
  const esAdminPlantel = profile.rolDb === 'admin_plantel';
  const puedeGestionar = esSuperAdmin || esAdminPlantel;

  const [usuarios, setUsuarios] = useState([]);
  const [planteles, setPlanteles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [rolFiltro, setRolFiltro] = useState('');
  const [pagina, setPagina] = useState(1);
  const porPagina = 25;

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [toast, setToast] = useState(null);
  const [credencialesCreadas, setCredencialesCreadas] = useState(null);

  const rolesDisponibles = esSuperAdmin ? ROLES_TODOS : ROLES_PLANTEL;

  const cargar = useCallback(async () => {
    setLoading(true);
    setUsuarios(await fetchUsuarios(profile.institucion_id, esSuperAdmin));
    if (esSuperAdmin) setPlanteles(await fetchPlanteles());
    setLoading(false);
  }, [esSuperAdmin, profile.institucion_id]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const filtrados = useMemo(() => usuarios.filter(u => {
    if (rolFiltro && u.rol !== rolFiltro) return false;
    if (q) {
      const texto = `${u.nombres || ''} ${u.apellidos || ''} ${u.email || ''} ${u.cedula || ''}`.toLowerCase();
      if (!texto.includes(q.toLowerCase())) return false;
    }
    return true;
  }), [usuarios, q, rolFiltro]);

  useEffect(() => { setPagina(1); }, [q, rolFiltro]);
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = useMemo(
    () => filtrados.slice((paginaActual - 1) * porPagina, paginaActual * porPagina),
    [filtrados, paginaActual]
  );

  function abrirCrear() {
    setForm({
      ...emptyForm,
      rol: esSuperAdmin ? 'admin_plantel' : 'docente',
      institucion_id: esAdminPlantel ? profile.institucion_id : '',
      password: generarPassword()
    });
    setFormErr('');
    setCredencialesCreadas(null);
    setModalOpen(true);
  }
  function campo(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function toggleActivo(u) {
    try {
      await actualizarUsuario(u.id, { activo: !u.activo });
      setToast({ tipo: 'ok', msg: `${u.nombres} ${u.apellidos} ahora está ${!u.activo ? 'activo' : 'inactivo'}.` });
      await cargar();
    } catch (err) {
      setToast({ tipo: 'err', msg: 'No se pudo actualizar el estado: ' + err.message });
    }
  }

  async function crear(e) {
    e.preventDefault();
    setFormErr('');
    if (!form.nombres.trim() || !form.apellidos.trim() || !form.email.trim()) {
      setFormErr('Nombres, apellidos y correo son obligatorios.');
      return;
    }
    if (!form.password || form.password.length < 8) {
      setFormErr('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    const esRolSigee = NIVEL_SIGEE.includes(form.rol);
    if (!esRolSigee && !form.institucion_id) {
      setFormErr('Selecciona la institución para este rol.');
      return;
    }
    setSaving(true);
    try {
      await crearUsuario({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        nombres: form.nombres.trim(),
        apellidos: form.apellidos.trim(),
        rol: form.rol,
        institucion_id: esRolSigee ? undefined : form.institucion_id,
        cedula: form.cedula.trim() || undefined,
        telefono: form.telefono.trim() || undefined
      });
      setCredencialesCreadas({ email: form.email.trim().toLowerCase(), password: form.password });
      await cargar();
    } catch (err) {
      setFormErr(err.message || 'No se pudo crear el usuario.');
    }
    setSaving(false);
  }

  if (!puedeGestionar) {
    return (
      <div className="card"><div className="cb">
        <p style={{ fontSize: 13 }}>Solo el Super Admin o el Administrador de Plantel pueden gestionar usuarios.</p>
      </div></div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: '0 0 4px' }}>Usuarios</h2>
          <div style={{ fontSize: 13, color: 'var(--slate)' }}>
            {esSuperAdmin ? 'Cuentas de acceso de todos los planteles' : 'Cuentas de acceso de tu plantel'}
          </div>
        </div>
        <button className="btn btn-primary" onClick={abrirCrear}>
          <span className="ti ti-user-plus" /> Nuevo usuario
        </button>
      </div>

      <div className="search-bar">
        <input className="fc" placeholder="Buscar por nombre, correo o cédula…" value={q} onChange={e => setQ(e.target.value)} />
        <select className="fc" value={rolFiltro} onChange={e => setRolFiltro(e.target.value)}>
          <option value="">Todos los roles</option>
          {rolesDisponibles.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
      </div>

      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--slate)' }}>Cargando…</p>
      ) : filtrados.length === 0 ? (
        <div className="empty"><span className="ti ti-users" /><p>No hay usuarios que coincidan.</p></div>
      ) : (
        <div className="card">
          <div className="cb" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="data" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Rol</th>
                  {esSuperAdmin && <th>Institución</th>}
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visibles.map(u => (
                  <tr key={u.id}>
                    <td><strong>{u.nombres} {u.apellidos}</strong>{u.cedula ? <div style={{ fontSize: 11, color: 'var(--slate)' }}>{u.cedula}</div> : null}</td>
                    <td>{u.email}</td>
                    <td>{ROLE_LABEL[u.rol] || u.rol}</td>
                    {esSuperAdmin && <td>{u.instituciones?.nombre || '—'}</td>}
                    <td><span className={'badge ' + (u.activo ? 'b-ok' : 'b-muted')}>{u.activo ? 'Activo' : 'Inactivo'}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggleActivo(u)}>
                        {u.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: 12, color: 'var(--slate)' }}>
              {filtrados.length} usuario{filtrados.length === 1 ? '' : 's'} · página {paginaActual} de {totalPaginas}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-ghost btn-sm" disabled={paginaActual <= 1} onClick={() => setPagina(p => Math.max(1, p - 1))}>Anterior</button>
              <button className="btn btn-ghost btn-sm" disabled={paginaActual >= totalPaginas} onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}>Siguiente</button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && credencialesCreadas && (
        <div className="modal-bg open">
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-h"><h3>Usuario creado</h3></div>
            <div className="modal-b">
              <p style={{ fontSize: 13, marginBottom: 12 }}>
                Copia esta contraseña ahora y compártela por un canal seguro — no se puede volver a consultar desde aquí.
              </p>
              <div className="form-grid">
                <div className="full">
                  <label className="fl">Correo</label>
                  <input className="fc" readOnly value={credencialesCreadas.email} onFocus={e => e.target.select()} />
                </div>
                <div className="full">
                  <label className="fl">Contraseña</label>
                  <input className="fc" readOnly style={{ fontFamily: 'monospace' }} value={credencialesCreadas.password} onFocus={e => e.target.select()} />
                </div>
              </div>
            </div>
            <div className="modal-f">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  navigator.clipboard?.writeText(`Correo: ${credencialesCreadas.email}\nContraseña: ${credencialesCreadas.password}`);
                  setCredencialesCreadas(null);
                  setModalOpen(false);
                }}
              >
                Copiar y cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && !credencialesCreadas && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <form className="modal" onSubmit={crear} style={{ maxWidth: 560 }}>
            <div className="modal-h">
              <h3>Nuevo usuario</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModalOpen(false)}><span className="ti ti-x" /></button>
            </div>
            <div className="modal-b">
              {formErr && <div className="lerr" style={{ display: 'flex', background: 'var(--redXL)', color: 'var(--redD)', border: '1px solid #fca5a5' }}>{formErr}</div>}
              <div className="form-grid">
                <div>
                  <label className="fl">Nombres</label>
                  <input className="fc" value={form.nombres} onChange={e => campo('nombres', e.target.value)} />
                </div>
                <div>
                  <label className="fl">Apellidos</label>
                  <input className="fc" value={form.apellidos} onChange={e => campo('apellidos', e.target.value)} />
                </div>
                <div className="full">
                  <label className="fl">Correo</label>
                  <input className="fc" type="email" value={form.email} onChange={e => campo('email', e.target.value)} />
                </div>
                <div>
                  <label className="fl">Cédula</label>
                  <input className="fc" value={form.cedula} onChange={e => campo('cedula', e.target.value)} />
                </div>
                <div>
                  <label className="fl">Teléfono</label>
                  <input className="fc" value={form.telefono} onChange={e => campo('telefono', e.target.value)} />
                </div>
                <div>
                  <label className="fl">Rol</label>
                  <select className="fc" value={form.rol} onChange={e => campo('rol', e.target.value)}>
                    {rolesDisponibles.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                </div>
                {!NIVEL_SIGEE.includes(form.rol) && esSuperAdmin && (
                  <div>
                    <label className="fl">Institución</label>
                    <select className="fc" value={form.institucion_id} onChange={e => campo('institucion_id', e.target.value)}>
                      <option value="">Selecciona…</option>
                      {planteles.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </div>
                )}
                <div className="full">
                  <label className="fl">Contraseña temporal</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="fc" value={form.password} onChange={e => campo('password', e.target.value)} style={{ fontFamily: 'monospace' }} />
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => campo('password', generarPassword())}>Generar</button>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-f">
              <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creando…' : 'Crear usuario'}</button>
            </div>
          </form>
        </div>
      )}

      {toast && <div className={'toast ' + (toast.tipo === 'ok' ? 'ok' : 'err')}>{toast.msg}</div>}
    </div>
  );
}
