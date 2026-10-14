import React, { useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { guardarPermisoPlantel } from '../lib/data.js';

const FILAS = [
  ['docentes_editan_perfil', 'docentesEditanPerfil', 'Los docentes pueden editar su perfil',
    'Si está activado, todos los docentes del plantel pueden actualizar sus datos personales (teléfono, dirección, etc.) desde “Mi perfil”. Su cédula, función y situación laboral no se editan desde ahí.'],
  ['tutores_editan_estudiantes', 'tutoresEditanEstudiantes', 'El docente tutor puede editar a sus estudiantes',
    'Si está activado, el docente tutor de cada curso puede actualizar la ficha de contacto de SUS estudiantes desde “Mis estudiantes”. Solo ve y edita a los de su curso.']
];

// Interruptores que decide el ADMIN DEL PLANTEL (todo desactivado por defecto).
export default function PermisosPlantel() {
  const { profile, institucion, permisos, recargarPermisos } = useSession();
  const [guardando, setGuardando] = useState(null);
  const [error, setError] = useState('');
  const puede = profile.rolDb === 'admin_plantel';

  async function alternar(campo, clave) {
    setGuardando(campo); setError('');
    try {
      await guardarPermisoPlantel(institucion.id, campo, !permisos[clave], profile.id);
      await recargarPermisos();
    } catch (e) { setError('No se pudo guardar el permiso: ' + (e.message || e)); }
    setGuardando(null);
  }

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="ch"><h3>Permisos de edición</h3></div>
      <div className="cb">
        {error && <div className="lerr" style={{ display: 'flex', marginBottom: 10 }}>{error}</div>}
        {FILAS.map(([campo, clave, titulo, ayuda]) => (
          <div key={campo} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--line, #e2e8f0)' }}>
            <div style={{ flex: 1 }}>
              <strong style={{ fontSize: 14 }}>{titulo}</strong>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{ayuda}</div>
            </div>
            <button className={'btn btn-sm ' + (permisos[clave] ? 'btn-secondary' : 'btn-primary')} disabled={!puede || guardando === campo} onClick={() => alternar(campo, clave)}
              title={puede ? '' : 'Solo el administrador del plantel puede cambiarlo'}>
              {guardando === campo ? '…' : permisos[clave] ? '🟢 Activado · Desactivar' : '⚪ Desactivado · Activar'}
            </button>
          </div>
        ))}
        {!puede && <p className="muted" style={{ fontSize: 12, margin: '10px 0 0' }}>Solo el administrador del plantel puede cambiar estos permisos.</p>}
      </div>
    </div>
  );
}
