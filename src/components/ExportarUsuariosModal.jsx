import React, { useState } from 'react';
import BuscadorInstitucion from './BuscadorInstitucion.jsx';
import { exportarUsuariosGlobal, restablecerContrasenas } from '../lib/data.js';
import { generarClave } from '../lib/claves.js';
import { descargarLibro } from '../lib/exportLibro.js';

const overlay = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 500, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 12px', overflowY: 'auto' };
const caja = { background: 'var(--card, #fff)', borderRadius: 14, width: '100%', maxWidth: 560, boxShadow: '0 20px 50px rgba(0,0,0,.28)' };

const ROL = {
  super_admin: 'Super Administrador', supervisor_general: 'Supervisor General', contador_general: 'Contador General',
  admin_plantel: 'Administrador de Plantel', secretario: 'Secretario/a', supervisor_plantel: 'Supervisor de Plantel',
  contador_plantel: 'Contador de Plantel', administrativo: 'Administrativo', inspector_general: 'Inspector General',
  docente: 'Docente', estudiante: 'Estudiante', padre: 'Padre/Madre de familia'
};
const ROLES_SIGEE = ['super_admin', 'supervisor_general', 'contador_general'];
const fecha = v => (v ? new Date(v).toLocaleString('es-EC') : '');

/**
 * Exporta a Excel los usuarios (con cuenta) de un plantel o de todos, con sus cursos, para filtrarlos.
 * La contraseña real NO se puede leer (solo se guarda cifrada): como opción se generan contraseñas temporales
 * nuevas y se escriben en el archivo una sola vez.
 */
export default function ExportarUsuariosModal({ instituciones, instCargando, miId, onClose }) {
  const [instId, setInstId] = useState('');
  const [conClaves, setConClaves] = useState(false);
  const [tambienIngresaron, setTambienIngresaron] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [paso, setPaso] = useState('');
  const [error, setError] = useState('');
  const [resumen, setResumen] = useState(null);

  async function exportar() {
    setError(''); setResumen(null);
    if (conClaves && tambienIngresaron && !window.confirm('Vas a CAMBIAR la contraseña de cuentas que ya han ingresado: su contraseña actual dejará de funcionar.\n\n¿Continuar?')) return;
    if (conClaves && !tambienIngresaron && !window.confirm('Se generarán contraseñas temporales para las cuentas que nunca han ingresado. ¿Continuar?')) return;
    setTrabajando(true);
    try {
      setPaso('Leyendo usuarios y cursos…');
      const { usuarios, cargas } = await exportarUsuariosGlobal(instId || null);

      // Contraseñas temporales (opcional)
      const claves = {}; let fallidas = 0, intentadas = 0;
      if (conClaves) {
        const objetivo = usuarios.filter(u => !ROLES_SIGEE.includes(u.rol) && u.user_id !== miId && u.email && (tambienIngresaron || u.estado_cuenta === 'Nunca ingresó'));
        intentadas = objetivo.length;
        for (let i = 0; i < objetivo.length; i += 25) {
          setPaso(`Generando contraseñas temporales… ${Math.min(i + 25, objetivo.length)} de ${objetivo.length}`);
          const lote = objetivo.slice(i, i + 25).map(u => ({ user_id: u.user_id, password: generarClave() }));
          const pass = Object.fromEntries(lote.map(l => [l.user_id, l.password]));
          try {
            const r = await restablecerContrasenas(lote);
            for (const x of r) { if (x.ok) claves[x.user_id] = pass[x.user_id]; else fallidas++; }
            fallidas += lote.length - r.length;
          } catch (e) { fallidas += lote.length; }
        }
      }

      setPaso('Armando el Excel…');
      const porId = Object.fromEntries(usuarios.map(u => [u.user_id, u]));
      const filasUsuarios = usuarios.map(u => ({
        AMIE: u.amie || '', Colegio: u.colegio || '(sin plantel)', Rol: ROL[u.rol] || u.rol,
        Apellidos: u.apellidos || '', Nombres: u.nombres || '', Cédula: u.cedula || '', Correo: u.email || '', Teléfono: u.telefono || '',
        'Estado de la cuenta': u.estado_cuenta, 'Último ingreso': fecha(u.ultimo_ingreso), Activo: u.activo ? 'Sí' : 'No',
        'Cursos y paralelos': u.cursos || '', 'Tutor de': u.tutor_de || '', 'Horas/sem': Number(u.horas) || '',
        'Con carga horaria': u.rol === 'docente' ? (Number(u.horas) > 0 ? 'Sí' : 'No') : '',
        'Contraseña temporal': claves[u.user_id] || ''
      }));
      const filasCargas = cargas.map(c => {
        const u = porId[c.user_id] || {};
        return { AMIE: c.amie || '', Colegio: c.colegio || '', Docente: `${u.apellidos || ''} ${u.nombres || ''}`.trim(), Correo: u.email || '', Curso: c.curso, Paralelo: c.paralelo, Jornada: c.jornada || '', Materia: c.materia, 'Horas/sem': c.horas };
      });
      const colsU = ['AMIE', 'Colegio', 'Rol', 'Apellidos', 'Nombres', 'Cédula', 'Correo', 'Teléfono', 'Estado de la cuenta', 'Último ingreso', 'Activo', 'Cursos y paralelos', 'Tutor de', 'Horas/sem', 'Con carga horaria', 'Contraseña temporal'];
      const colsC = ['AMIE', 'Colegio', 'Docente', 'Correo', 'Curso', 'Paralelo', 'Jornada', 'Materia', 'Horas/sem'];
      const nombrePlantel = instId ? (instituciones.find(i => i.id === instId)?.amie || 'plantel') : 'todos_los_planteles';
      descargarLibro(`usuarios_${nombrePlantel}_${new Date().toISOString().slice(0, 10)}.xlsx`, [
        { nombre: 'Usuarios', filas: filasUsuarios, cols: colsU },
        { nombre: 'Cargas', filas: filasCargas, cols: colsC }
      ]);
      setResumen({ usuarios: usuarios.length, cargas: cargas.length, claves: Object.keys(claves).length, fallidas, intentadas });
    } catch (e) { setError(e.message || 'No se pudo exportar.'); }
    setTrabajando(false); setPaso('');
  }

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget && !trabajando) onClose(); }}>
      <div style={caja}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}><h3 style={{ margin: 0 }}>Exportar usuarios a Excel</h3></div>
        <div style={{ padding: 20, fontSize: 13 }}>
          <p style={{ margin: '0 0 12px' }}>
            El Excel trae todos los usuarios con cuenta (también los docentes sin carga horaria), con sus cursos y paralelos, en dos hojas: <strong>Usuarios</strong> y <strong>Cargas</strong> (una fila por docente, curso y materia), listas para filtrar.
          </p>
          <label className="fl">Colegio</label>
          <BuscadorInstitucion instituciones={instituciones} value={instId} onChange={id => setInstId(id)} cargando={instCargando} />
          <div style={{ margin: '4px 0 12px' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setInstId('')} disabled={!instId}>Todos los colegios</button>
            <span style={{ marginLeft: 8, color: 'var(--slate)' }}>{instId ? 'Solo el colegio elegido' : 'Se exportarán todos los colegios'}</span>
          </div>

          <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12 }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <input type="checkbox" checked={conClaves} onChange={e => setConClaves(e.target.checked)} disabled={trabajando} />
              <span><strong>Generar contraseñas temporales</strong> y ponerlas en el Excel<br />
                <span style={{ color: 'var(--slate)' }}>Las contraseñas actuales no se pueden leer (se guardan cifradas). Esto asigna una contraseña nueva por cuenta y la escribe en el archivo una sola vez; no queda guardada en ningún lado.</span></span>
            </label>
            {conClaves && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 10, marginLeft: 22 }}>
                <input type="checkbox" checked={tambienIngresaron} onChange={e => setTambienIngresaron(e.target.checked)} disabled={trabajando} />
                <span>Incluir también las cuentas que <strong>ya ingresaron</strong><br />
                  <span style={{ color: 'var(--red)' }}>Su contraseña actual dejará de funcionar. Sin marcar, solo se generan para cuentas que nunca ingresaron.</span></span>
              </label>
            )}
          </div>
          <p style={{ margin: '10px 0 0', color: 'var(--slate)' }}>El archivo con contraseñas es sensible: entrégalo solo por un canal seguro y bórralo después.</p>

          {paso && <div style={{ marginTop: 12 }}>⏳ {paso}</div>}
          {error && <div style={{ marginTop: 12, color: 'var(--red)' }}>{error}</div>}
          {resumen && (
            <div style={{ marginTop: 12, padding: 10, background: 'var(--bg, #f1f5f9)', borderRadius: 8 }}>
              ✅ Descargado: {resumen.usuarios} usuarios y {resumen.cargas} cargas.
              {conClaves && <> Contraseñas temporales: {resumen.claves} de {resumen.intentadas}{resumen.fallidas ? ` (${resumen.fallidas} fallaron; esas filas quedan sin contraseña)` : ''}.</>}
            </div>
          )}
        </div>
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={trabajando}>Cerrar</button>
          <button className="btn btn-primary" onClick={exportar} disabled={trabajando}>{trabajando ? 'Exportando…' : '⬇️ Exportar a Excel'}</button>
        </div>
      </div>
    </div>
  );
}
