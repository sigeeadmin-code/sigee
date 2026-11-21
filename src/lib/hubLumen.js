// Hub de Colegio Lumen (pruebas de roles del Admin Global). Módulo puro: no importa Supabase.
export const LUMEN_ID = '3327421a-ccdb-4db0-823d-92615d451d61';
export const HUB_KEY = 'sigee_hub';              // { active, institutionId, adminEmail }
export const HUB_ADMIN_KEY = 'sigee_hub_admin';  // sesión del Admin Global guardada mientras prueba un usuario demo (solo esta pestaña)
export const HUB_IR_KEY = 'sigee_ir_hub';        // pide llevar al Hub después de un inicio de sesión del Super Admin
export const HUB_RUTA = '/hub-colegio-lumen';

// Los 9 roles del Hub, en orden. `id` coincide con las claves de CUENTAS_HUB del servidor.
// NO hay contraseñas aquí: el servidor entrega un acceso de un solo uso para cada cuenta (ver /hub/entrar).
export const HUB_ROLES = [
  { id: 'admin_plantel', nombre: 'Admin Plantel', icono: 'ti-building', desc: 'Gestiona el plantel completo: cursos, docentes, estudiantes y configuración.' },
  { id: 'coordinador', nombre: 'Coordinador', icono: 'ti-users-group', desc: 'Supervisa el plantel: asistencia, rendimiento y reportes de todos los cursos.' },
  { id: 'inspector', nombre: 'Inspector', icono: 'ti-shield-check', desc: 'Controla la asistencia, las justificaciones y los oficios por faltas.' },
  { id: 'docente', nombre: 'Docente', icono: 'ti-chalkboard', desc: 'Registra asistencia y notas de sus materias y consulta su horario.' },
  // TODO: no existe una cuenta demo de secretaría en Colegio Lumen. Crearla y ponerla en CUENTAS_HUB (servidor) y quitar `pendiente`.
  { id: 'secretaria', nombre: 'Secretaria', icono: 'ti-file-text', desc: 'Matrículas, estudiantes y trámites administrativos del plantel.', pendiente: true },
  { id: 'tutor', nombre: 'Tutor', icono: 'ti-school', desc: 'Docente tutor de 1.º de Bachillerato: ve su curso completo y justifica faltas.' },
  { id: 'psicologo', nombre: 'Psicólogo (DECE)', icono: 'ti-heart', desc: 'Seguimiento de casos del Departamento de Consejería Estudiantil.' },
  { id: 'estudiante', nombre: 'Estudiante', icono: 'ti-backpack', desc: 'Su resumen, calificaciones, tareas, horario y asistencia.' },
  { id: 'representante', nombre: 'Representante', icono: 'ti-users', desc: 'Sigue a su representado: notas, asistencia y avisos.' }
];

export function leerHub(storage = (typeof sessionStorage !== 'undefined' ? sessionStorage : null)) {
  try { return JSON.parse(storage?.getItem(HUB_KEY) || 'null'); } catch { return null; }
}
export function limpiarHub(storage = (typeof sessionStorage !== 'undefined' ? sessionStorage : null)) {
  try { storage?.removeItem(HUB_KEY); storage?.removeItem(HUB_ADMIN_KEY); } catch { /* sin storage */ }
}

// ¿Al cerrar sesión hay que volver al Hub? Solo si el Hub está activo y quien cierra es un usuario de Colegio Lumen
// (nunca el propio Super Admin: ese cierre es completo).
export function decidirLogout({ hub, rolDb, institucionId }) {
  if (hub?.active === true && rolDb !== 'super_admin' && institucionId && institucionId === hub.institutionId) return 'volver_hub';
  return 'normal';
}
