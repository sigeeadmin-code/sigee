export const NAV_BY_ROL = {
  super_admin: [
    { cat: 'Principal', items: [
      { to: '/', label: 'Dashboard', icon: 'ti ti-layout-dashboard' },
      { to: '/estadisticas-amie', label: 'Estadísticas AMIE', icon: 'ti ti-chart-pie' },
      { to: '/notificaciones', label: 'Notificaciones', icon: 'ti ti-bell' }
    ]},
    { cat: 'Personas', items: [
      { to: '/instituciones', label: 'Instituciones', icon: 'ti ti-building' },
      { to: '/docentes', label: 'Docentes', icon: 'ti ti-chalkboard' },
      { to: '/estudiantes', label: 'Estudiantes', icon: 'ti ti-users' },
      { to: '/encadenamiento', label: 'Encadenamiento', icon: 'ti ti-link' },
      { to: '/docentes-desvinculados', label: 'Docentes desvinculados', icon: 'ti ti-user-off' },
      { to: '/base-docentes', label: 'Base de docentes', icon: 'ti ti-database' },
      { to: '/estudiantes-desvinculados', label: 'Estudiantes desvinculados', icon: 'ti ti-user-minus' },
      { to: '/base-estudiantes', label: 'Base de estudiantes', icon: 'ti ti-database-import' },
      { to: '/usuarios', label: 'Usuarios', icon: 'ti ti-user-cog', soloRolDb: ['super_admin', 'admin_plantel'] }
    ]},
    { cat: 'Académico', items: [
      { to: '/academico', label: 'Materias y Cursos', icon: 'ti ti-books' },
      { to: '/matriculas', label: 'Promoción y traslados', icon: 'ti ti-arrow-up-circle' },
      { to: '/reportes-matriculas', label: 'Reportes de matrícula', icon: 'ti ti-report' },
      { to: '/egresados', label: 'Egresados', icon: 'ti ti-school' },
      { to: '/tareas', label: 'Tareas y avisos', icon: 'ti ti-clipboard-list' },
      { to: '/asistencia', label: 'Asistencia', icon: 'ti ti-calendar-check' },
      { to: '/justificaciones', label: 'Justificaciones', icon: 'ti ti-file-check' },
      { to: '/inasistencias', label: 'Inasistencias', icon: 'ti ti-message-circle' },
      { to: '/calendario', label: 'Calendario académico', icon: 'ti ti-calendar' },
      { to: '/aulas', label: 'Aulas', icon: 'ti ti-door' },
      { to: '/horario', label: 'Horario', icon: 'ti ti-clock' }
    ]},
    { cat: 'Finanzas', items: [
      { to: '/financiero', label: 'Financiero', icon: 'ti ti-cash' },
      { to: '/licencias', label: 'Licencias y activación', icon: 'ti ti-credit-card' }
    ]},
    { cat: 'Sistema', items: [
      { to: '/contenido-sitio', label: 'Contenido del sitio', icon: 'ti ti-edit' },
      { to: '/roles-permisos', label: 'Roles y Permisos', icon: 'ti ti-shield-lock' },
      { to: '/modulos-plantel', label: 'Módulos por plantel', icon: 'ti ti-toggle-right' },
      { to: '/diagnostico', label: 'Diagnóstico del sistema', icon: 'ti ti-activity-heartbeat' },
      { to: '/configuracion', label: 'Configuración', icon: 'ti ti-settings' }
    ]}
  ],
  admin_plantel: [
    { cat: 'Principal', items: [
      { to: '/', label: 'Dashboard', icon: 'ti ti-layout-dashboard' },
      { to: '/mi-plantel', label: 'Mi Plantel', icon: 'ti ti-school' },
      { to: '/notificaciones', label: 'Notificaciones', icon: 'ti ti-bell' }
    ]},
    { cat: 'Personas', items: [
      { to: '/docentes', label: 'Docentes', icon: 'ti ti-chalkboard' },
      { to: '/estudiantes', label: 'Estudiantes', icon: 'ti ti-users' },
      { to: '/base-docentes', label: 'Base de docentes', icon: 'ti ti-database', modulo: 'base_docentes' },
      { to: '/encadenamiento', label: 'Encadenamiento', icon: 'ti ti-link' },
      { to: '/usuarios', label: 'Usuarios', icon: 'ti ti-user-cog', soloRolDb: ['super_admin', 'admin_plantel'] }
    ]},
    { cat: 'Académico', items: [
      { to: '/academico', label: 'Materias y Cursos', icon: 'ti ti-books' },
      { to: '/matriculas', label: 'Promoción y traslados', icon: 'ti ti-arrow-up-circle' },
      { to: '/reportes-matriculas', label: 'Reportes de matrícula', icon: 'ti ti-report' },
      { to: '/egresados', label: 'Egresados', icon: 'ti ti-school' },
      { to: '/tareas', label: 'Tareas y avisos', icon: 'ti ti-clipboard-list' },
      { to: '/asistencia', label: 'Asistencia', icon: 'ti ti-calendar-check' },
      { to: '/analisis-asistencia', label: 'Análisis de asistencia', icon: 'ti ti-chart-dots' },
      { to: '/analisis-calificaciones', label: 'Análisis de calificaciones', icon: 'ti ti-chart-histogram', soloRolDb: ['admin_plantel', 'supervisor_plantel', 'supervisor_general'] },
      { to: '/boletas', label: 'Boletas', icon: 'ti ti-report-analytics' },
      { to: '/justificaciones', label: 'Justificaciones', icon: 'ti ti-file-check' },
      { to: '/inasistencias', label: 'Inasistencias', icon: 'ti ti-message-circle' },
      { to: '/calendario', label: 'Calendario académico', icon: 'ti ti-calendar' },
      { to: '/aulas', label: 'Aulas', icon: 'ti ti-door' },
      { to: '/horario', label: 'Horario', icon: 'ti ti-clock' }
    ]},
    { cat: 'Finanzas', items: [
      { to: '/financiero', label: 'Financiero', icon: 'ti ti-cash', wip: true },
      { to: '/licencias', label: 'Licencias y activación', icon: 'ti ti-credit-card' }
    ]},
    { cat: 'Sistema', items: [
      { to: '/configuracion', label: 'Configuración', icon: 'ti ti-settings' }
    ]}
  ],
  secretario: [
    { cat: 'Principal', items: [
      { to: '/', label: 'Dashboard', icon: 'ti ti-layout-dashboard' },
      { to: '/notificaciones', label: 'Notificaciones', icon: 'ti ti-bell' }
    ]},
    { cat: 'Académico', items: [
      { to: '/estudiantes', label: 'Estudiantes', icon: 'ti ti-users' },
      { to: '/encadenamiento', label: 'Encadenamiento', icon: 'ti ti-link' },
      { to: '/matriculas', label: 'Promoción y traslados', icon: 'ti ti-arrow-up-circle' },
      { to: '/reportes-matriculas', label: 'Reportes de matrícula', icon: 'ti ti-report' },
      { to: '/egresados', label: 'Egresados', icon: 'ti ti-school' },
      { to: '/tareas', label: 'Tareas y avisos', icon: 'ti ti-clipboard-list' },
      { to: '/asistencia', label: 'Asistencia', icon: 'ti ti-calendar-check' },
      { to: '/analisis-asistencia', label: 'Análisis de asistencia', icon: 'ti ti-chart-dots' },
      { to: '/boletas', label: 'Boletas', icon: 'ti ti-report-analytics' },
      { to: '/justificaciones', label: 'Justificaciones', icon: 'ti ti-file-check' },
      { to: '/calendario', label: 'Calendario académico', icon: 'ti ti-calendar' },
      { to: '/aulas', label: 'Aulas', icon: 'ti ti-door' },
      { to: '/horario', label: 'Horario', icon: 'ti ti-clock' }
    ]},
    { cat: 'Finanzas', items: [
      { to: '/licencias', label: 'Licencias y activación', icon: 'ti ti-credit-card' }
    ]},
    { cat: 'Sistema', items: [
      { to: '/configuracion', label: 'Configuración', icon: 'ti ti-settings' }
    ]}
  ],
  // Clave 'inspector': es el nombre de GRUPO (ver ROLE_GROUP en supabase.js),
  // no el rol crudo de la BD — el enum real es 'inspector_general', pero
  // Shell.jsx busca el menú por profile.rol (ya agrupado), no por rolDb.
  inspector: [
    { cat: 'Principal', items: [
      { to: '/', label: 'Dashboard', icon: 'ti ti-layout-dashboard' },
      { to: '/notificaciones', label: 'Notificaciones', icon: 'ti ti-bell' }
    ]},
    { cat: 'Convivencia y asistencia', items: [
      { to: '/estudiantes', label: 'Estudiantes', icon: 'ti ti-users' },
      { to: '/encadenamiento', label: 'Encadenamiento', icon: 'ti ti-link' },
      { to: '/reportes-asistencia', label: 'Reportes de asistencia', icon: 'ti ti-chart-bar' },
      { to: '/asistencia', label: 'Consultas de asistencia', icon: 'ti ti-calendar-check' },
      { to: '/analisis-asistencia', label: 'Análisis de asistencia', icon: 'ti ti-chart-dots' },
      { to: '/analisis-calificaciones', label: 'Análisis de calificaciones', icon: 'ti ti-chart-histogram' },
      { to: '/boletas', label: 'Boletas', icon: 'ti ti-report-analytics' },
      { to: '/justificaciones', label: 'Justificaciones', icon: 'ti ti-file-check' },
      { to: '/inasistencias', label: 'Inasistencias / WhatsApp', icon: 'ti ti-message-circle' },
      { to: '/calendario', label: 'Calendario académico', icon: 'ti ti-calendar' }
    ]},
    { cat: 'Sistema', items: [
      { to: '/configuracion', label: 'Configuración', icon: 'ti ti-settings' }
    ]}
  ],
  docente: [
    { cat: 'Principal', items: [
      { to: '/', label: 'Dashboard', icon: 'ti ti-layout-dashboard' },
      { to: '/anuncios', label: 'Anuncios', icon: 'ti ti-bell' },
      { to: '/mi-perfil', label: 'Mi perfil', icon: 'ti ti-user-circle' }
    ]},
    { cat: 'Académico', items: [
      { to: '/horario', label: 'Mi horario', icon: 'ti ti-clock' },
      { to: '/calificaciones', label: 'Calificaciones', icon: 'ti ti-report' },
      { to: '/analisis-calificaciones', label: 'Alertas de rendimiento', icon: 'ti ti-alert-triangle' },
      { to: '/curso-tutor', label: 'Mi curso como tutor', icon: 'ti ti-user-star', requiere: 'tutor' },
      { to: '/boletas', label: 'Boletas del curso', icon: 'ti ti-report-analytics', requiere: 'tutor' },
      { to: '/asistencia', label: 'Asistencia', icon: 'ti ti-calendar-check' },
      { to: '/mis-estudiantes', label: 'Mis estudiantes', icon: 'ti ti-users', requiere: 'tutor' },
      { to: '/tareas', label: 'Tareas y avisos', icon: 'ti ti-clipboard-list' }
    ]},
    { cat: 'Sistema', items: [
      { to: '/configuracion', label: 'Configuración', icon: 'ti ti-settings' }
    ]}
  ],
  // Clave 'alumno': nombre de GRUPO; el rol crudo real en la BD es 'estudiante'.
  alumno: [
    { cat: 'Principal', items: [
      { to: '/', label: 'Inicio', icon: 'ti ti-layout-dashboard' },
      { to: '/comunicados', label: 'Comunicados', icon: 'ti ti-speakerphone' }
    ]},
    { cat: 'Académico', items: [
      { to: '/horario', label: 'Horario', icon: 'ti ti-clock' },
      { to: '/calificaciones', label: 'Calificaciones', icon: 'ti ti-report' },
      { to: '/mi-asistencia', label: 'Asistencia y faltas', icon: 'ti ti-calendar-check' },
      { to: '/justificaciones', label: 'Justificaciones', icon: 'ti ti-file-check' },
      { to: '/tareas', label: 'Tareas', icon: 'ti ti-clipboard-list' }
    ]},
    { cat: 'Sistema', items: [
      { to: '/configuracion', label: 'Configuración', icon: 'ti ti-settings' }
    ]}
  ],
  padre: [
    { cat: 'Principal', items: [
      { to: '/', label: 'Inicio', icon: 'ti ti-layout-dashboard' },
      { to: '/comunicados', label: 'Comunicados', icon: 'ti ti-speakerphone' }
    ]},
    { cat: 'Académico', items: [
      { to: '/horario', label: 'Horario', icon: 'ti ti-clock' },
      { to: '/calificaciones', label: 'Calificaciones', icon: 'ti ti-report' },
      { to: '/mi-asistencia', label: 'Asistencia y faltas', icon: 'ti ti-calendar-check' },
      { to: '/justificaciones', label: 'Justificaciones', icon: 'ti ti-file-check' }
    ]},
    { cat: 'Sistema', items: [
      { to: '/configuracion', label: 'Configuración', icon: 'ti ti-settings' }
    ]}
  ]
  // supervisor_general, contador_general y supervisor_plantel se agrupan como
  // 'admin_plantel' (ROLE_GROUP en supabase.js); contador_plantel y
  // administrativo se agrupan como 'secretario'. Por eso no tienen una clave
  // propia aquí: ya heredan ese menú automáticamente vía profile.rol.
};

/**
 * Deriva, a partir del propio menú (NAV_BY_ROL), qué roles tienen acceso a
 * una ruta dada. Es intencional que sea el MISMO origen de datos que arma el
 * sidebar: si un rol no ve el link, tampoco debe poder entrar escribiendo la
 * URL a mano. Usado por el guardián de rutas en App.jsx.
 */
export function rolesConAcceso(path) {
  return Object.entries(NAV_BY_ROL)
    .filter(([, categorias]) => categorias.some(cat => cat.items.some(it => it.to === path)))
    .map(([rol]) => rol);
}

/**
 * Algunas pantallas (Usuarios) solo son para ciertos roles reales de la base de datos aunque el rol comparta el menú de su grupo
 * (por ejemplo, supervisor_plantel y contador_general usan el menú del administrador de plantel pero NO deben ver Usuarios).
 */
export function itemVisibleParaRolDb(item, rolDb) {
  return !item.soloRolDb || item.soloRolDb.includes(rolDb);
}
export function rutaPermitidaParaRolDb(path, rolGrupo, rolDb) {
  const items = (NAV_BY_ROL[rolGrupo] || []).flatMap(c => c.items).filter(it => it.to === path);
  return items.length > 0 && items.some(it => itemVisibleParaRolDb(it, rolDb));
}
