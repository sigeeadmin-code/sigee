// Módulo de Notificaciones · lógica PURA (sin React ni base de datos) para poder probarla.
// Reglas de quién ve qué y quién envía qué las aplica la base de datos (RLS y funciones); aquí solo se refleja en pantalla.

export const TITULO_MAX = 140;
export const CUERPO_MAX = 4000;

// Grupos destinatarios (coinciden con los que entiende la base de datos en para_roles).
export const GRUPOS_DESTINO = [
  { id: 'docente', label: 'Docentes', icon: 'ti ti-chalkboard' },
  { id: 'alumno', label: 'Estudiantes', icon: 'ti ti-school' },
  { id: 'padre', label: 'Padres y representantes', icon: 'ti ti-users-group' },
  { id: 'secretario', label: 'Secretaría y administrativos', icon: 'ti ti-file-text' },
  { id: 'inspector', label: 'Inspección', icon: 'ti ti-shield-check' },
  { id: 'admin_plantel', label: 'Administración', icon: 'ti ti-building' }
];
export const ETIQUETA_GRUPO = Object.fromEntries(GRUPOS_DESTINO.map(g => [g.id, g.label]));

// Cómo se muestra quién envía cuando no se conoce su nombre (la familia no ve nombres del personal)
export const ETIQUETA_ROL = { super_admin: 'SIGEE', admin_plantel: 'Administración', supervisor_plantel: 'Administración', secretario: 'Secretaría', contador_plantel: 'Secretaría', administrativo: 'Secretaría', inspector_general: 'Inspección General', docente: 'Docente' };

export const PRIORIDADES = [
  { id: 'normal', label: 'Normal', color: '#64748b', fondo: '#f1f5f9', icon: 'ti ti-bell' },
  { id: 'importante', label: 'Importante', color: '#b45309', fondo: '#fef3c7', icon: 'ti ti-alert-circle' },
  { id: 'urgente', label: 'Urgente', color: '#b91c1c', fondo: '#fee2e2', icon: 'ti ti-alert-triangle' }
];
export const PRIORIDAD = Object.fromEntries(PRIORIDADES.map(p => [p.id, p]));

export const CATEGORIAS = [
  { id: 'general', label: 'General', icon: 'ti ti-speakerphone' },
  { id: 'academico', label: 'Académico', icon: 'ti ti-book' },
  { id: 'convivencia', label: 'Convivencia', icon: 'ti ti-heart-handshake' },
  { id: 'administrativo', label: 'Administrativo', icon: 'ti ti-clipboard-text' },
  { id: 'evento', label: 'Evento', icon: 'ti ti-calendar-event' },
  { id: 'emergencia', label: 'Emergencia', icon: 'ti ti-urgent' }
];
export const CATEGORIA = Object.fromEntries(CATEGORIAS.map(c => [c.id, c]));

// Plantillas rápidas para redactar (el usuario las edita antes de enviar)
export const PLANTILLAS = [
  { id: 'reunion', nombre: 'Reunión de padres', titulo: 'Reunión de padres de familia', categoria: 'evento', prioridad: 'importante', destinos: ['padre'],
    cuerpo: 'Se convoca a los padres de familia y representantes a la reunión que se realizará el día [fecha] a las [hora] en [lugar].\n\nSu asistencia es importante. Gracias por su apoyo.' },
  { id: 'suspension', nombre: 'Suspensión de clases', titulo: 'Suspensión de clases', categoria: 'emergencia', prioridad: 'urgente', destinos: ['docente', 'alumno', 'padre'],
    cuerpo: 'Se comunica que las clases presenciales quedan suspendidas el día [fecha] por [motivo].\n\nSe informará oportunamente cuándo se retoman las actividades.' },
  { id: 'calificaciones', nombre: 'Entrega de calificaciones', titulo: 'Entrega de calificaciones del trimestre', categoria: 'academico', prioridad: 'importante', destinos: ['padre', 'alumno'],
    cuerpo: 'Se informa que las calificaciones del trimestre se entregarán el día [fecha] a partir de las [hora].\n\nPueden revisarlas también en el sistema SIGEE.' },
  { id: 'tareas', nombre: 'Recordatorio de tareas', titulo: 'Recordatorio de entrega de tareas', categoria: 'academico', prioridad: 'normal', destinos: ['alumno'],
    cuerpo: 'Recordamos que el plazo de entrega de las tareas pendientes vence el día [fecha]. Revisa la sección de Tareas para ver el detalle.' },
  { id: 'inasistencias', nombre: 'Aviso de inasistencias', titulo: 'Justificación de inasistencias', categoria: 'convivencia', prioridad: 'importante', destinos: ['padre'],
    cuerpo: 'Se recuerda a los representantes que las inasistencias deben justificarse en un plazo máximo de [días] días, desde el módulo de Justificaciones o en Inspección.' },
  { id: 'personal', nombre: 'Aviso al personal', titulo: 'Comunicado al personal docente y administrativo', categoria: 'administrativo', prioridad: 'normal', destinos: ['docente', 'secretario', 'inspector'],
    cuerpo: 'Se comunica al personal que [mensaje].\n\nCualquier consulta, dirigirse a la dirección del plantel.' }
];

/* ── Permisos en pantalla (la base de datos los vuelve a exigir) ── */
const ENVIAN = ['super_admin', 'admin_plantel', 'secretario', 'inspector_general', 'docente'];
export const puedeEnviar = rolDb => ENVIAN.includes(rolDb);
export const puedeVerEstadisticas = rolDb => ENVIAN.includes(rolDb);
export const esDireccion = rolDb => ['super_admin', 'admin_plantel', 'secretario', 'inspector_general'].includes(rolDb);
// El docente solo avisa a estudiantes y padres de SUS cursos, sin urgencias.
export const gruposPermitidos = rolDb => (rolDb === 'docente' ? GRUPOS_DESTINO.filter(g => g.id === 'alumno' || g.id === 'padre') : GRUPOS_DESTINO);
export const prioridadesPermitidas = rolDb => (rolDb === 'docente' ? PRIORIDADES.filter(p => p.id !== 'urgente') : PRIORIDADES);
export const categoriasPermitidas = rolDb => (rolDb === 'docente' ? CATEGORIAS.filter(c => c.id !== 'emergencia') : CATEGORIAS);

// Grupo de notificación de un rol (igual que mi_grupo_notificacion() en la base)
export function grupoDeRol(rolDb) {
  switch (rolDb) {
    case 'admin_plantel': case 'supervisor_general': case 'contador_general': case 'supervisor_plantel': return 'admin_plantel';
    case 'secretario': case 'contador_plantel': case 'administrativo': return 'secretario';
    case 'inspector_general': return 'inspector';
    case 'docente': return 'docente';
    case 'estudiante': return 'alumno';
    case 'padre': return 'padre';
    case 'super_admin': return 'super_admin';
    default: return null;
  }
}
// ¿Una notificación está dirigida (por rol) a este grupo? Se usa para decidir si mostrar el aviso emergente.
export function esParaGrupo(paraRoles, grupo) {
  if (!Array.isArray(paraRoles) || !grupo || grupo === 'super_admin') return false;
  if (paraRoles.includes('all') || paraRoles.includes('todos')) return true;
  if (grupo === 'alumno') return paraRoles.includes('alumno') || paraRoles.includes('estudiante');
  if (grupo === 'padre') return paraRoles.includes('padre') || paraRoles.includes('representante');
  return paraRoles.includes(grupo);
}

/* ── Formulario de redacción ── */
export function formularioVacio() {
  return { titulo: '', cuerpo: '', destinos: [], todos: false, paralelos: [], categoria: 'general', prioridad: 'normal', fijada: false, expira: '' };
}
export function validarFormulario(f, { rolDb, paralelosPermitidos = null, ahora = Date.now() } = {}) {
  const errores = [];
  const titulo = (f.titulo || '').trim(); const cuerpo = (f.cuerpo || '').trim();
  if (titulo.length < 3) errores.push('Escribe un título (mínimo 3 letras).');
  if (titulo.length > TITULO_MAX) errores.push(`El título no puede pasar de ${TITULO_MAX} caracteres.`);
  if (cuerpo.length < 3) errores.push('Escribe el mensaje.');
  if (cuerpo.length > CUERPO_MAX) errores.push(`El mensaje no puede pasar de ${CUERPO_MAX} caracteres.`);
  const permitidos = gruposPermitidos(rolDb).map(g => g.id);
  const destinos = f.todos ? [] : (f.destinos || []);
  if (!f.todos && destinos.length === 0) errores.push('Elige a quién va dirigida.');
  if (destinos.some(d => !permitidos.includes(d))) errores.push('Elegiste un destinatario que no puedes usar.');
  if (f.todos && rolDb === 'docente') errores.push('Como docente solo puedes avisar a estudiantes y padres de tus cursos.');
  if (rolDb === 'docente') {
    if (!(f.paralelos || []).length) errores.push('Elige los cursos a los que enviarás el aviso.');
    if (paralelosPermitidos && (f.paralelos || []).some(p => !paralelosPermitidos.includes(p))) errores.push('Solo puedes avisar a los cursos donde enseñas o eres tutor.');
    if (f.prioridad === 'urgente' || f.categoria === 'emergencia') errores.push('Las urgencias y emergencias las envía la dirección del plantel.');
  }
  if (f.expira) {
    const t = new Date(`${f.expira}T23:59:59`).getTime();
    if (!Number.isFinite(t)) errores.push('La fecha de vigencia no es válida.');
    else if (t <= ahora) errores.push('La fecha de vigencia debe ser posterior a hoy.');
  }
  return errores;
}
// Fila lista para guardar
export function armarNotificacion(f, institucionId) {
  const para_roles = f.todos ? ['all'] : (f.destinos || []).slice();
  const conCursos = (f.paralelos || []).length > 0 && (f.todos || para_roles.some(r => ['docente', 'alumno', 'padre'].includes(r)));
  return {
    institucion_id: institucionId, titulo: (f.titulo || '').trim(), cuerpo: (f.cuerpo || '').trim(), para_roles,
    para_paralelos: conCursos ? f.paralelos.slice() : null, categoria: f.categoria || 'general', prioridad: f.prioridad || 'normal',
    fijada: !!f.fijada, expira_at: f.expira ? new Date(`${f.expira}T23:59:59`).toISOString() : null
  };
}
export function aplicarPlantilla(f, p) {
  return { ...f, titulo: p.titulo, cuerpo: p.cuerpo, categoria: p.categoria, prioridad: p.prioridad, destinos: p.destinos.slice(), todos: false };
}
// ¿Pide confirmación extra? (urgentes o mucha gente)
export function requiereConfirmacion(f, total) { return f.prioridad === 'urgente' || f.todos || Number(total) >= 100; }

/* ── Presentación ── */
export function etiquetaDestinatarios(paraRoles, nCursos = 0) {
  const roles = Array.isArray(paraRoles) ? paraRoles : [];
  if (roles.includes('all') || roles.includes('todos')) return nCursos ? `Todos · ${nCursos} curso${nCursos === 1 ? '' : 's'}` : 'Todos';
  const nombres = [];
  const vistos = new Set();
  roles.forEach(r => { const id = r === 'estudiante' ? 'alumno' : r === 'representante' ? 'padre' : r; if (!vistos.has(id) && ETIQUETA_GRUPO[id]) { vistos.add(id); nombres.push(ETIQUETA_GRUPO[id]); } });
  const base = nombres.join(', ') || 'Sin destinatarios';
  return nCursos ? `${base} · ${nCursos} curso${nCursos === 1 ? '' : 's'}` : base;
}
export function tiempoRelativo(iso, ahora = Date.now()) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, Math.round((ahora - t) / 1000));
  if (s < 60) return 'ahora';
  const m = Math.round(s / 60); if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60); if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24); if (d === 1) return 'ayer';
  if (d < 7) return `hace ${d} días`;
  return new Date(t).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: new Date(t).getFullYear() === new Date(ahora).getFullYear() ? undefined : 'numeric' });
}
// Inicio del día en la zona horaria de Ecuador (UTC-5, sin horario de verano)
const diaEc = ms => Math.floor((ms - 5 * 3600 * 1000) / 86400000);
export function seccionDeFecha(iso, ahora = Date.now()) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 'Anteriores';
  const d = diaEc(ahora) - diaEc(t);
  if (d <= 0) return 'Hoy'; if (d === 1) return 'Ayer'; if (d < 7) return 'Esta semana'; return 'Anteriores';
}
const ORDEN_SECCIONES = ['Fijadas', 'Hoy', 'Ayer', 'Esta semana', 'Anteriores'];
export function agruparBandeja(items, ahora = Date.now()) {
  const grupos = new Map();
  (items || []).forEach(n => { const s = n.fijada ? 'Fijadas' : seccionDeFecha(n.created_at, ahora); if (!grupos.has(s)) grupos.set(s, []); grupos.get(s).push(n); });
  return ORDEN_SECCIONES.filter(s => grupos.has(s)).map(s => ({ seccion: s, items: grupos.get(s) }));
}
const sinTildes = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function filtrarBandeja(items, { filtro = 'todas', q = '', categoria = '' } = {}) {
  const buscar = sinTildes(q).trim();
  return (items || []).filter(n => {
    if (filtro === 'no_leidas' && (n.leida || n.es_mia)) return false;
    if (filtro === 'importantes' && n.prioridad !== 'importante') return false;
    if (filtro === 'urgentes' && n.prioridad !== 'urgente') return false;
    if (filtro === 'mias' && !n.es_mia) return false;
    if (categoria && n.categoria !== categoria) return false;
    if (buscar && !sinTildes(n.titulo + ' ' + n.cuerpo).includes(buscar)) return false;
    return true;
  });
}
export function contarBandeja(items) {
  const lista = items || [];
  return {
    todas: lista.length,
    no_leidas: lista.filter(n => !n.leida && !n.es_mia).length,
    importantes: lista.filter(n => n.prioridad === 'importante').length,
    urgentes: lista.filter(n => n.prioridad === 'urgente').length,
    mias: lista.filter(n => n.es_mia).length
  };
}
// Semáforo de la tasa de lectura
export function estadoLectura(tasa) {
  if (tasa === null || tasa === undefined) return { id: 'sin_datos', color: '#94a3b8', texto: 'Sin destinatarios' };
  if (tasa >= 80) return { id: 'alta', color: '#0f9d8a', texto: 'Excelente lectura' };
  if (tasa >= 50) return { id: 'media', color: '#d97706', texto: 'Lectura media' };
  return { id: 'baja', color: '#dc2626', texto: 'Lectura baja' };
}
// Convierte texto plano en partes seguras: texto y enlaces http(s). Nunca genera HTML.
export function partirEnlaces(texto) {
  const partes = []; const re = /(https?:\/\/[^\s<>"']+)/gi; let ultimo = 0; let m;
  const s = String(texto || '');
  while ((m = re.exec(s)) !== null) {
    if (m.index > ultimo) partes.push({ t: 'texto', v: s.slice(ultimo, m.index) });
    const limpio = m[0].replace(/[.,;:!?)\]]+$/, '');
    partes.push({ t: 'enlace', v: limpio });
    if (limpio.length < m[0].length) partes.push({ t: 'texto', v: m[0].slice(limpio.length) });
    ultimo = m.index + m[0].length;
  }
  if (ultimo < s.length) partes.push({ t: 'texto', v: s.slice(ultimo) });
  return partes;
}
export const extracto = (texto, max = 140) => { const s = String(texto || '').replace(/\s+/g, ' ').trim(); return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s; };
