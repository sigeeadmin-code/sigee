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
  inspector: [
    { cat: 'Principal', items: [
      { to: '/', label: 'Dashboard', icon: 'ti ti-layout-dashboard' },
      { to: '/notificaciones', label: 'Notificaciones', icon: 'ti ti-bell' }
    ]},
    { cat: 'Académico', items: [
      { to: '/estudiantes', label: 'Estudiantes', icon: 'ti ti-users' },
      { to: '/asistencia', label: 'Asistencia', icon: 'ti ti-calendar-check' },
      { to: '/justificaciones', label: 'Justificaciones', icon: 'ti ti-file-check' },
      { to: '/inasistencias', label: 'Inasistencias / WhatsApp', icon: 'ti ti-message-circle' }
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
  alumno: [
    { cat: 'Principal', items: [
      { to: '/', label: 'Inicio', icon: 'ti ti-layout-dashboard' },
      { to: '/comunicados', label: 'Comunicados', icon: 'ti ti-speakerphone' }
    ]},
    { cat: 'Académico', items: [
      { to: '/horario', label: 'Horario', icon: 'ti ti-clock', wip: true },
      { to: '/calificaciones', label: 'Calificaciones', icon: 'ti ti-report' },
      { to: '/asistencia', label: 'Asistencia', icon: 'ti ti-calendar-check' },
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
      { to: '/asistencia', label: 'Asistencia', icon: 'ti ti-calendar-check' }
    ]},
    { cat: 'Sistema', items: [
      { to: '/configuracion', label: 'Configuración', icon: 'ti ti-settings' }
    ]}
  ]
};
