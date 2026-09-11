import React, { useEffect, useState, useCallback } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { fetchModulosSistema, fetchPermisosRol, setPermisoRol, copiarPermisosRol } from '../lib/data.js';

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

const ACCIONES = [
  { key: 'ver', label: 'Ver' },
  { key: 'crear', label: 'Crear' },
  { key: 'editar', label: 'Editar' },
  { key: 'eliminar', label: 'Eliminar' },
  { key: 'aprobar', label: 'Aprobar' },
  { key: 'administrar', label: 'Administrar' }
];

export default function RolesPermisos() {
  const { profile } = useSession();
  const esSuperAdmin = profile.rolDb === 'super_admin';

  const [rolSel, setRolSel] = useState('admin_plantel');
  const [modulos, setModulos] = useState([]);
  const [permisos, setPermisos] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');
  const [rolCopiaOrigen, setRolCopiaOrigen] = useState('');
  const [copiando, setCopiando] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!esSuperAdmin) return;
    fetchModulosSistema().then(setModulos);
  }, [esSuperAdmin]);

  const cargarPermisos = useCallback(async (rol) => {
    setLoading(true);
    const rows = await fetchPermisosRol(rol);
    const map = {};
    rows.forEach(r => { map[`${r.modulo_codigo}|${r.accion}`] = true; });
    setPermisos(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!esSuperAdmin) return;
    cargarPermisos(rolSel);
  }, [rolSel, cargarPermisos, esSuperAdmin]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  async function toggle(modulo_codigo, accion) {
    const key = `${modulo_codigo}|${accion}`;
    const actual = !!permisos[key];
    const nuevo = !actual;
    setSavingKey(key);
    setPermisos(p => ({ ...p, [key]: nuevo }));
    try {
      await setPermisoRol(rolSel, modulo_codigo, accion, nuevo);
    } catch (err) {
      setPermisos(p => ({ ...p, [key]: actual }));
      setToast({ tipo: 'err', msg: 'No se pudo guardar el cambio: ' + err.message });
    }
    setSavingKey('');
  }

  async function copiarDesde() {
    if (!rolCopiaOrigen || rolCopiaOrigen === rolSel) return;
    setCopiando(true);
    try {
      await copiarPermisosRol(rolCopiaOrigen, rolSel);
      await cargarPermisos(rolSel);
      setToast({ tipo: 'ok', msg: `Permisos de ${ROLE_LABEL[rolSel]} reemplazados por los de ${ROLE_LABEL[rolCopiaOrigen]}.` });
    } catch (err) {
      setToast({ tipo: 'err', msg: 'No se pudo copiar: ' + err.message });
    }
    setCopiando(false);
    setRolCopiaOrigen('');
  }

  if (!esSuperAdmin) {
    return (
      <div className="card"><div className="cb">
        <p style={{ fontSize: 13 }}>Solo el Super Administrador puede configurar Roles y Permisos.</p>
      </div></div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ margin: '0 0 4px' }}>Roles y Permisos</h2>
        <div style={{ fontSize: 13, color: 'var(--slate)' }}>
          Define qué puede ver, crear, editar, eliminar, aprobar o administrar cada rol en cada módulo del sistema. Los cambios se guardan al instante.
        </div>
      </div>

      <div className="search-bar">
        <select className="fc" style={{ maxWidth: 280 }} value={rolSel} onChange={e => setRolSel(e.target.value)}>
          {ROLES_TODOS.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
        <select className="fc" style={{ maxWidth: 260 }} value={rolCopiaOrigen} onChange={e => setRolCopiaOrigen(e.target.value)}>
          <option value="">Copiar permisos desde…</option>
          {ROLES_TODOS.filter(r => r !== rolSel).map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
        <button className="btn btn-secondary btn-sm" disabled={!rolCopiaOrigen || copiando} onClick={copiarDesde}>
          {copiando ? 'Copiando…' : 'Copiar a este rol'}
        </button>
      </div>

      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--slate)' }}>Cargando…</p>
      ) : (
        <div className="card">
          <div className="cb" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="data" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Módulo</th>
                  {ACCIONES.map(a => <th key={a.key} style={{ textAlign: 'center' }}>{a.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {modulos.map(m => (
                  <tr key={m.codigo}>
                    <td><strong>{m.nombre}</strong></td>
                    {ACCIONES.map(a => {
                      const key = `${m.codigo}|${a.key}`;
                      const activo = !!permisos[key];
                      return (
                        <td key={a.key} style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={activo}
                            disabled={savingKey === key}
                            onChange={() => toggle(m.codigo, a.key)}
                            style={{ width: 16, height: 16, cursor: 'pointer' }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {toast && <div className={'toast ' + (toast.tipo === 'ok' ? 'ok' : 'err')}>{toast.msg}</div>}
    </div>
  );
}
