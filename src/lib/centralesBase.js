// Configuración de las 4 bases centrales (docentes/estudiantes desvinculados y
// bases de docentes/estudiantes). Solo el Super Admin global.
// Archivo puro (sin Supabase) para poder probarlo en Node.

export const ROLES_CENTRALES = ['super_admin'];
export const puedeVerCentrales = rolDb => ROLES_CENTRALES.includes(rolDb);

const MOTIVOS_DOC = ['renuncia', 'jubilacion', 'traslado', 'destitucion', 'fallecimiento', 'otro'];
const MOTIVOS_EST = ['traslado', 'desercion', 'graduado', 'fallecimiento', 'otro'];

export const CENTRALES = {
  'docentes-desvinculados': {
    ruta: '/docentes-desvinculados', tabla: 'docentes_desvinculados', icono: 'ti ti-user-off',
    titulo: 'Docentes desvinculados', sub: 'Docentes retirados del sistema · su historial se conserva',
    orden: 'fecha_desvinculacion', plantelCol: 'ultima_institucion_id', autor: 'desvinculado_por',
    buscar: ['cedula', 'apellidos', 'nombres'], etiquetaPlantel: 'Último plantel',
    columnas: [
      { k: 'cedula', t: 'Cédula', mono: true },
      { k: 'nombre', t: 'Apellidos y nombres', calc: r => `${r.apellidos || ''} ${r.nombres || ''}`.trim() },
      { k: 'ultima_situacion', t: 'Última situación' },
      { k: 'funcion', t: 'Función' },
      { k: 'fecha_desvinculacion', t: 'Desvinculado' },
      { k: 'motivo', t: 'Motivo' }
    ],
    campos: [
      { k: 'cedula', t: 'Cédula', req: true },
      { k: 'apellidos', t: 'Apellidos' }, { k: 'nombres', t: 'Nombres' },
      { k: 'ultima_situacion', t: 'Última situación laboral' }, { k: 'funcion', t: 'Función / cargo' },
      { k: 'fecha_desvinculacion', t: 'Fecha de desvinculación', tipo: 'date' },
      { k: 'motivo', t: 'Motivo', opciones: MOTIVOS_DOC },
      { k: 'observaciones', t: 'Observaciones', largo: true }
    ]
  },
  'base-docentes': {
    ruta: '/base-docentes', tabla: 'base_docentes', icono: 'ti ti-database',
    titulo: 'Base de docentes', sub: 'Registro central de docentes · se asigna un plantel para incorporarlos al sistema activo',
    orden: 'nombre', plantelCol: 'institucion_id', etiquetaPlantel: 'Plantel asignado',
    buscar: ['cedula', 'nombre'], filtroPlantel: true, asignable: true, filtroCanton: true,
    columnas: [
      { k: 'cedula', t: 'Cédula', mono: true }, { k: 'nombre', t: 'Apellidos y nombres' },
      { k: 'canton', t: 'Cantón' }, { k: 'categoria', t: 'Categoría' }, { k: 'especialidad', t: 'Especialidad' },
      { k: 'titulos', t: 'Títulos', calc: r => (Array.isArray(r.titulos) ? r.titulos.length : 0) }
    ],
    campos: [
      { k: 'cedula', t: 'Cédula', req: true }, { k: 'nombre', t: 'Apellidos y nombres', req: true },
      { k: 'provincia', t: 'Provincia' }, { k: 'canton', t: 'Cantón' },
      { k: 'categoria', t: 'Categoría' }, { k: 'especialidad', t: 'Especialidad' },
      { k: 'observaciones', t: 'Observaciones', largo: true }
    ]
  },
  'estudiantes-desvinculados': {
    ruta: '/estudiantes-desvinculados', tabla: 'estudiantes_desvinculados', icono: 'ti ti-user-minus',
    titulo: 'Estudiantes desvinculados', sub: 'Estudiantes retirados · su ficha se conserva íntegra',
    orden: 'fecha_retiro', plantelCol: 'ultima_institucion_id', autor: 'retirado_por',
    buscar: ['cedula', 'apellidos', 'nombres'], etiquetaPlantel: 'Último plantel',
    columnas: [
      { k: 'cedula', t: 'Cédula', mono: true },
      { k: 'nombre', t: 'Apellidos y nombres', calc: r => `${r.apellidos || ''} ${r.nombres || ''}`.trim() },
      { k: 'curso_paralelo', t: 'Curso / paralelo' }, { k: 'fecha_retiro', t: 'Retiro' }, { k: 'motivo', t: 'Motivo' }
    ],
    campos: [
      { k: 'cedula', t: 'Cédula' }, { k: 'apellidos', t: 'Apellidos', req: true }, { k: 'nombres', t: 'Nombres', req: true },
      { k: 'curso_paralelo', t: 'Curso / paralelo' },
      { k: 'fecha_retiro', t: 'Fecha de retiro', tipo: 'date' },
      { k: 'motivo', t: 'Motivo', opciones: MOTIVOS_EST },
      { k: 'observaciones', t: 'Observaciones', largo: true }
    ]
  },
  'base-estudiantes': {
    ruta: '/base-estudiantes', tabla: 'base_estudiantes', icono: 'ti ti-database-import',
    titulo: 'Base de estudiantes', sub: 'Registro central de estudiantes · se asigna un plantel para incorporarlos al sistema activo',
    orden: 'apellidos', plantelCol: 'institucion_id', etiquetaPlantel: 'Plantel asignado',
    buscar: ['cedula', 'apellidos', 'nombres'], filtroPlantel: true,
    columnas: [
      { k: 'cedula', t: 'Cédula', mono: true },
      { k: 'nombre', t: 'Apellidos y nombres', calc: r => `${r.apellidos || ''} ${r.nombres || ''}`.trim() },
      { k: 'genero', t: 'Género' }, { k: 'fecha_nacimiento', t: 'Nacimiento' }, { k: 'canton', t: 'Cantón' }
    ],
    campos: [
      { k: 'cedula', t: 'Cédula', req: true }, { k: 'apellidos', t: 'Apellidos', req: true }, { k: 'nombres', t: 'Nombres', req: true },
      { k: 'fecha_nacimiento', t: 'Fecha de nacimiento', tipo: 'date' },
      { k: 'genero', t: 'Género', opciones: ['Masculino', 'Femenino', 'Otro'] },
      { k: 'provincia', t: 'Provincia' }, { k: 'canton', t: 'Cantón' },
      { k: 'observaciones', t: 'Observaciones', largo: true }
    ]
  }
};

// Quita los caracteres que rompen el filtro .or() de PostgREST y los comodines.
export function sanitizarBusqueda(t) {
  return String(t ?? '').replace(/[,()%*\\"'`;]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}

export function filtroOr(cfg, texto) {
  const t = sanitizarBusqueda(texto);
  if (!t) return null;
  return cfg.buscar.map(c => `${c}.ilike.%${t}%`).join(',');
}

// Convierte el formulario en la fila a insertar: vacíos → null, fechas válidas.
export function filaDesdeForm(cfg, form, autorId) {
  const fila = {};
  for (const c of cfg.campos) {
    const v = String(form[c.k] ?? '').trim();
    if (c.req && !v) throw new Error(`Falta: ${c.t}`);
    fila[c.k] = v || null;
  }
  if (cfg.autor && autorId) fila[cfg.autor] = autorId;
  // las columnas con valor por defecto no deben mandarse como null
  if (cfg.tabla === 'docentes_desvinculados' && !fila.fecha_desvinculacion) delete fila.fecha_desvinculacion;
  if (cfg.tabla === 'estudiantes_desvinculados' && !fila.fecha_retiro) delete fila.fecha_retiro;
  return fila;
}

export const TAM_PAGINA = 50;
