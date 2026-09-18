export const NAV_BY_ROL = {
  super_admin: [
    { cat: 'Principal', items: [
      { to: '/', label: 'Dashboard', icon: 'ti ti-layout-dashboard' },
      { to: '/notificaciones', label: 'Notificaciones', icon: 'ti ti-bell' }
    ]},
    { cat: 'Personas', items: [
      { to: '/instituciones', label: 'Instituciones', icon: 'ti ti-building' },
      { to: '/docentes', label: 'Docentes', icon: 'ti ti-chalkboard' },
      { to: '/estudiantes', label: 'Estudiantes', icon: 'ti ti-users' },
      { to: '/usuarios', label: 'Usuarios', icon: 'ti ti-user-cog' }
    ]},
    { cat: 'Académico', items: [
      { to: '/academico', label: 'Materias y Cursos', icon: 'ti ti-books' },
      { to: '/tareas', label: 'Tareas y avisos', icon: 'ti ti-clipboard-list' },
      { to: '/asistencia', label: 'Asistencia', icon: 'ti ti-calendar-check' },
      { to: '/justificaciones', label: 'Justificaciones', icon: 'ti ti-file-check' },
      { to: '/inasistencias', label: 'Inasistencias', icon: 'ti ti-message-circle' },
      { to: '/calendario', label: 'Calendario académico', icon: 'ti ti-calendar' },
      { to: '/aulas', label: 'Aulas', icon: 'ti ti-door' },
      { to: '/horario', label: 'Horario', icon: 'ti ti-clock' }
    ]},
    { cat: 'Finanzas', items: [
      { to: '/financiero', label: 'Financiero', icon: 'ti ti-cash', wip: true }
    ]},
    { cat: 'Sistema', items: [
      { to: '/roles-permisos', label: 'Roles y Permisos', icon: 'ti ti-shield-lock' },
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
      { to: '/usuarios', label: 'Usuarios', icon: 'ti ti-user-cog' }
    ]},
    { cat: 'Académico', items: [
      { to: '/academico', label: 'Materias y Cursos', icon: 'ti ti-books' },
      { to: '/tareas', label: 'Tareas y avisos', icon: 'ti ti-clipboard-list' },
      { to: '/asistencia', label: 'Asistencia', icon: 'ti ti-calendar-check' },
      { to: '/justificaciones', label: 'Justificaciones', icon: 'ti ti-file-check' },
      { to: '/inasistencias', label: 'Inasistencias', icon: 'ti ti-message-circle' },
      { to: '/calendario', label: 'Calendario académico', icon: 'ti ti-calendar' },
      { to: '/aulas', label: 'Aulas', icon: 'ti ti-door' },
      { to: '/horario', label: 'Horario', icon: 'ti ti-clock' }
    ]},
    { cat: 'Finanzas', items: [
      { to: '/financiero', label: 'Financiero', icon: 'ti ti-cash', wip: true }
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
      { to: '/tareas', label: 'Tareas y avisos', icon: 'ti ti-clipboard-list' },
      { to: '/asistencia', label: 'Asistencia', icon: 'ti ti-calendar-check' },
      { to: '/justificaciones', label: 'Justificaciones', icon: 'ti ti-file-check' },
      { to: '/calendario', label: 'Calendario académico', icon: 'ti ti-calendar' },
      { to: '/aulas', label: 'Aulas', icon: 'ti ti-door' },
      { to: '/horario', label: 'Horario', icon: 'ti ti-clock' }
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
      { to: '/reportes-asistencia', label: 'Reportes de asistencia', icon: 'ti ti-chart-bar' },
      { to: '/asistencia', label: 'Consultas de asistencia', icon: 'ti ti-calendar-check' },
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
      { to: '/anuncios', label: 'Anuncios', icon: 'ti ti-bell' }
    ]},
    { cat: 'Académico', items: [
      { to: '/horario', label: 'Mi horario', icon: 'ti ti-clock' },
      { to: '/calificaciones', label: 'Calificaciones', icon: 'ti ti-report' },
      { to: '/asistencia', label: 'Asistencia', icon: 'ti ti-calendar-check' },
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
      { to: '/horario', label: 'Horario', icon: 'ti ti-clock', wip: true },
      { to: '/calificaciones', label: 'Calificaciones', icon: 'ti ti-report' },
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
      { to: '/calificaciones', label: 'Calificaciones', icon: 'ti ti-report' },
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
