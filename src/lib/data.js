import { supabase, ROLE_GROUP, ROLE_LABELS } from './supabase.js';
import { crearClienteBackend } from './backend.js';
import { combinarCatalogo, clave } from './niveles.js';
import { filtroOr } from './centralesBase.js';
import { filaParaGuardar, agruparPorColumnas, cedulaCentral } from './importCentral.js';
import { planAsignacion, planCruce } from './asignarDocentes.js';

const API_URL = import.meta.env.VITE_API_URL || 'https://sigee-backend-production.up.railway.app';


async function sel(table, cols, build) {
  let q = supabase.from(table).select(cols);
  if (build) q = build(q);
  const { data, error } = await q;
  if (error) { console.error('[Supabase]', table, error.message); return []; }
  return data || [];
}

export async function fetchInstituciones(institucionId, isSuperAdmin) {
  return isSuperAdmin
    ? sel('instituciones', '*')
    : sel('instituciones', '*', q => q.eq('id', institucionId));
}

export async function fetchInstitucionData(institucionId) {
  const [periodos, grados, paralelos, materias, docentesRows, estudiantesRows,
    matriculas, docenteMateria, profilesRows, representantes, repEst] = await Promise.all([
    sel('periodos_lectivos', '*', q => q.eq('institucion_id', institucionId)),
    sel('grados', '*', q => q.eq('institucion_id', institucionId)),
    sel('paralelos', '*'),
    sel('materias', '*', q => q.eq('institucion_id', institucionId)),
    sel('docentes', '*', q => q.eq('institucion_id', institucionId)),
    sel('estudiantes', '*', q => q.eq('institucion_id', institucionId)),
    sel('matriculas', '*'),
    sel('docente_materia', '*'),
    sel('profiles', '*', q => q.eq('institucion_id', institucionId)),
    sel('representantes', '*', q => q.eq('institucion_id', institucionId)),
    sel('representantes_estudiantes', '*')
  ]);

  const gradosById = Object.fromEntries(grados.map(g => [g.id, g]));
  const paralelosById = Object.fromEntries(paralelos.map(p => [p.id, p]));
  const materiasById = Object.fromEntries(materias.map(m => [m.id, m]));
  const periodoActivo = periodos.find(p => p.activo) || periodos[0] || null;

  const dmByDocente = {};
  docenteMateria.forEach(dm => { (dmByDocente[dm.docente_id] ||= []).push(dm); });

  const docentes = docentesRows.map(d => {
    const materiasSet = new Set(), cursosSet = new Set();
    const cargas = (dmByDocente[d.id] || []).map(dm => {
      const mat = materiasById[dm.materia_id];
      const par = paralelosById[dm.paralelo_id];
      const gr = par ? gradosById[par.grado_id] : null;
      if (mat) materiasSet.add(mat.nombre);
      if (gr && par) cursosSet.add(gr.nombre + ' ' + par.nombre);
      return {
        id: dm.id, materiaId: dm.materia_id, materiaNombre: mat ? mat.nombre : '',
        paraleloId: dm.paralelo_id, paraleloNombre: par ? par.nombre : '',
        gradoNombre: gr ? gr.nombre : '', periodoId: dm.periodo_id
      };
    });
    return {
      id: d.id, profileId: d.profile_id, nombre: `${d.apellidos || ''} ${d.nombres || ''}`.trim(),
      cedula: d.cedula, email: d.email, telefono: d.telefono,
      situacion: d.situacion || (d.incorporado ? 'NOMBRAMIENTO' : 'CONTRATO'), cargo: d.cargo || 'DOCENTE',
      especialidad: d.especialidad || '', area: d.area || '',
      fechaIngreso: d.fecha_ingreso || null,
      titulo: d.titulo, materias: [...materiasSet], cursos: [...cursosSet], cargas,
      activo: !!d.activo, acceso: !!d.profile_id, profile_id: d.profile_id || null
    };
  });

  const matById = {};
  matriculas.filter(m => !periodoActivo || m.periodo_id === periodoActivo.id)
    .forEach(m => { matById[m.estudiante_id] = m; });

  const repByEst = {};
  repEst.forEach(re => { (repByEst[re.estudiante_id] ||= []).push(re.representante_id); });
  const repById = Object.fromEntries(representantes.map(r => [r.id, r]));

  const estudiantes = estudiantesRows.map(e => {
    const mat = matById[e.id];
    const gr = mat ? gradosById[mat.grado_id] : null;
    const par = mat ? paralelosById[mat.paralelo_id] : null;
    const repIds = repByEst[e.id] || [];
    const rep = repIds.length ? repById[repIds[0]] : null;
    return {
      id: e.id, nombre: `${e.apellidos || ''} ${e.nombres || ''}`.trim(),
      cedula: e.cedula, curso: gr ? gr.nombre : '—', paralelo: par ? par.nombre : '',
      gradoId: mat ? mat.grado_id : null, paraleloId: mat ? mat.paralelo_id : null,
      matriculaId: mat ? mat.id : null,
      genero: e.genero || '', estado: mat ? mat.estado : 'Sin matrícula',
      representante: rep ? `${rep.apellidos || ''} ${rep.nombres || ''}`.trim() : '',
      rep_tel: rep ? rep.telefono : '', activo: !!e.activo, acceso: !!e.profile_id
    };
  });

  const usuarios = profilesRows.map(p => ({
    id: p.id, nombre: `${p.nombres || ''} ${p.apellidos || ''}`.trim() || p.email,
    email: p.email, rolDb: p.rol, rol: ROLE_GROUP[p.rol] || p.rol,
    rolLabel: ROLE_LABELS[ROLE_GROUP[p.rol]] || p.rol, activo: p.activo !== false
  }));

  const administrativos = usuarios.filter(u => !['docente', 'alumno', 'padre'].includes(u.rol));

  const [tareasRows, entregasRows, horarioRows] = await Promise.all([
    sel('tareas', '*', q => q.eq('institucion_id', institucionId)),
    sel('tarea_entregas', '*', q => q.eq('institucion_id', institucionId)),
    sel('horario_bloques', '*', q => q.eq('institucion_id', institucionId))
  ]);

  const entregasByTarea = {};
  entregasRows.forEach(en => { (entregasByTarea[en.tarea_id] ||= []).push(en); });

  const tareas = tareasRows.map(t => {
    const mat = materiasById[t.materia_id];
    const par = paralelosById[t.paralelo_id];
    const gr = par ? gradosById[par.grado_id] : null;
    const entregas = entregasByTarea[t.id] || [];
    return {
      id: t.id, titulo: t.titulo, descripcion: t.descripcion,
      materia: mat ? mat.nombre : '', curso: gr && par ? `${gr.nombre} ${par.nombre}` : '',
      fechaLimite: t.fecha_limite, horaLimite: t.hora_limite, bloqueado: t.bloqueado,
      entregados: entregas.filter(e => e.estado !== 'pendiente').length,
      total: entregas.length
    };
  });

  return { docentes, estudiantes, usuarios, administrativos, tareas, horario: horarioRows, periodoActivo, grados, paralelos, materias };
}

export async function fetchAsistencia(docenteMateriaId, fecha) {
  return sel('asistencia', '*', q => q.eq('docente_materia_id', docenteMateriaId).eq('fecha', fecha));
}

// Guarda asistencia de un curso completo en UNA sola petición al backend de
// Railway (antes: hasta N peticiones sueltas directo a Supabase, una por
// alumno). El backend revalida el calendario académico y la pertenencia de
// la carga — nunca confía en lo que ya validó el navegador.
export async function guardarAsistencia(docenteMateriaId, fecha, registros, registradoPor, paraleloId) {
  const { data: sesion } = await supabase.auth.getSession();
  const token = sesion?.session?.access_token;
  if (!token) throw new Error('Sesión expirada. Vuelve a iniciar sesión.');

  const opciones = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ docente_materia_id: docenteMateriaId, fecha, paralelo_id: paraleloId || null, registros })
  };

  // El backend (plan gratuito de Railway) se duerme si no hay uso; la primera
  // petición tras dormir puede fallar o tardar mientras despierta. El guardado
  // es un upsert (idempotente: repetirlo no duplica nada), así que es seguro
  // reintentar automáticamente ante caídas de red o 502/503/504.
  const ESPERAS_MS = [0, 2500, 5000];
  let ultimoError = null;
  for (const espera of ESPERAS_MS) {
    if (espera) await new Promise(r => setTimeout(r, espera));
    try {
      const resp = await fetch(`${API_URL}/asistencia`, opciones);
      if ([502, 503, 504].includes(resp.status)) { ultimoError = new Error('El servidor está iniciando.'); continue; }
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) throw Object.assign(new Error(body.error || `Error del servidor (${resp.status}) al guardar asistencia.`), { definitivo: true });
      return body;
    } catch (err) {
      if (err.definitivo) throw err; // 400/401/403/422/429: reintentar no lo arregla
      ultimoError = err;
    }
  }
  throw new Error('No se pudo conectar con el servidor de asistencia. Revisa tu internet e inténtalo de nuevo en unos segundos.' +
    (ultimoError?.message ? ` (${ultimoError.message})` : ''));
}

export async function fetchAsistenciaReciente(docenteMateriaId, dias = 7) {
  if (!docenteMateriaId) return [];
  const desde = new Date();
  desde.setDate(desde.getDate() - dias);
  const desdeStr = desde.toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('asistencia')
    .select('fecha, estado, observacion, estudiantes(nombres, apellidos)')
    .eq('docente_materia_id', docenteMateriaId)
    .gte('fecha', desdeStr)
    .order('fecha', { ascending: false });
  if (error) { console.error('[Supabase] asistencia reciente', error.message); return []; }
  return data || [];
}

/**
 * Todas las ausencias ('estado'='ausente') de la institución desde `desde`,
 * cruzadas con avisos_inasistencia para saber cuáles YA se avisaron al
 * representante y cuáles siguen pendientes. Incluye el teléfono del
 * representante para armar el link de WhatsApp.
 */
export async function fetchInasistencias(institucionId, desde) {
  const dm = await sel('docente_materia', 'id, docentes!inner(institucion_id)', q => q.eq('docentes.institucion_id', institucionId));
  const dmIds = dm.map(d => d.id);
  if (!dmIds.length) return [];

  const [{ data: ausencias, error: e1 }, avisos] = await Promise.all([
    supabase.from('asistencia')
      .select('id, fecha, estudiante_id, estudiantes(nombres, apellidos, cedula)')
      .in('docente_materia_id', dmIds).eq('estado', 'ausente').gte('fecha', desde)
      .order('fecha', { ascending: false }),
    sel('avisos_inasistencia', '*', q => q.eq('institucion_id', institucionId).gte('fecha', desde))
  ]);
  if (e1) { console.error('[Supabase] inasistencias', e1.message); return []; }
  if (!ausencias?.length) return [];

  const estudianteIds = [...new Set(ausencias.map(a => a.estudiante_id))];
  const matriculas = await sel('matriculas', 'estudiante_id, paralelo_id, grados(nombre), paralelos(nombre)', q => q.in('estudiante_id', estudianteIds));
  const cursoPorEstudiante = Object.fromEntries(matriculas.map(m => [m.estudiante_id, `${m.grados?.nombre || ''} ${m.paralelos?.nombre || ''}`.trim()]));

  const vinculos = await sel('representantes_estudiantes', 'estudiante_id, representante_id', q => q.in('estudiante_id', estudianteIds));
  const repIds = [...new Set(vinculos.map(v => v.representante_id))];
  const reps = repIds.length ? await sel('representantes', 'id, nombres, apellidos, telefono', q => q.in('id', repIds)) : [];
  const repPorId = Object.fromEntries(reps.map(r => [r.id, r]));
  const repPorEstudiante = {};
  vinculos.forEach(v => { repPorEstudiante[v.estudiante_id] = repPorId[v.representante_id]; });

  const avisadoKey = (estId, fecha) => estId + '|' + fecha;
  const avisadosSet = new Set((avisos || []).map(av => avisadoKey(av.estudiante_id, av.fecha)));

  return ausencias.map(a => {
    const rep = repPorEstudiante[a.estudiante_id];
    return {
      asistenciaId: a.id, fecha: a.fecha, estudianteId: a.estudiante_id,
      nombre: `${a.estudiantes?.apellidos || ''} ${a.estudiantes?.nombres || ''}`.trim(),
      curso: cursoPorEstudiante[a.estudiante_id] || '—',
      representante: rep ? `${rep.nombres} ${rep.apellidos}`.trim() : null,
      telefonoRep: rep?.telefono || null,
      avisado: avisadosSet.has(avisadoKey(a.estudiante_id, a.fecha))
    };
  });
}

/**
 * Estadísticas de asistencia para un paralelo en un rango de fechas.
 * docenteMateriaIds acota qué registros contar: un docente solo debe ver
 * SU propia materia (evita que vea inasistencias de una clase que no dicta);
 * un rol administrativo puede pasar todas las cargas del paralelo para ver
 * el cuadro completo. Incluye a TODOS los matriculados, incluso sin ningún
 * registro todavía (para no inflar el % de asistencia por omisión).
 */
export async function fetchEstadisticasCurso(paraleloId, docenteMateriaIds, desde, hasta) {
  const matriculas = await sel('matriculas', 'estudiante_id, estudiantes(id, nombres, apellidos)', q => q.eq('paralelo_id', paraleloId).eq('estado', 'activa'));
  const alumnos = matriculas.map(m => ({ id: m.estudiante_id, nombre: `${m.estudiantes?.apellidos || ''} ${m.estudiantes?.nombres || ''}`.trim() }));
  if (!alumnos.length || !docenteMateriaIds?.length) return alumnos.map(a => ({ ...a, presente: 0, atraso: 0, ausente: 0, justificado: 0, total: 0, pct: null }));

  const { data: registros, error } = await supabase.from('asistencia')
    .select('estudiante_id, estado')
    .in('docente_materia_id', docenteMateriaIds)
    .gte('fecha', desde).lte('fecha', hasta);
  if (error) { console.error('[Supabase] estadisticas curso', error.message); return []; }

  const porAlumno = {};
  alumnos.forEach(a => { porAlumno[a.id] = { presente: 0, atraso: 0, ausente: 0, justificado: 0 }; });
  (registros || []).forEach(r => { if (porAlumno[r.estudiante_id] && porAlumno[r.estudiante_id][r.estado] !== undefined) porAlumno[r.estudiante_id][r.estado]++; });

  return alumnos.map(a => {
    const c = porAlumno[a.id];
    const total = c.presente + c.atraso + c.ausente + c.justificado;
    // Una falta ya JUSTIFICADA no debe penalizar el % de asistencia — de lo
    // contrario, justificar no serviría de nada (seguiría contando en contra).
    const totalContable = c.presente + c.atraso + c.ausente;
    const pct = totalContable > 0 ? Math.round(((c.presente + c.atraso) / totalContable) * 100) : null;
    return { ...a, ...c, total, pct };
  });
}

/** Historial día a día de un estudiante puntual, dentro de las cargas indicadas. */
export async function fetchHistorialEstudiante(estudianteId, docenteMateriaIds, desde, hasta) {
  if (!docenteMateriaIds?.length) return [];
  const { data, error } = await supabase.from('asistencia')
    .select('fecha, estado, observacion, docente_materia_id, docente_materia(materias(nombre))')
    .eq('estudiante_id', estudianteId)
    .in('docente_materia_id', docenteMateriaIds)
    .gte('fecha', desde).lte('fecha', hasta)
    .order('fecha', { ascending: false });
  if (error) { console.error('[Supabase] historial estudiante', error.message); return []; }
  return (data || []).map(r => ({ ...r, materia: r.docente_materia?.materias?.nombre || '—' }));
}

/**
 * Reporte de asistencia de TODA la institución (todos los cursos a la vez),
 * pensado para inspección/dirección — a diferencia de fetchEstadisticasCurso
 * (un curso puntual). Marca 'advertencia' cuando un estudiante tiene 3 o más
 * ausencias en el rango, o su % de asistencia cae bajo 80.
 */
export async function fetchReporteInstitucional(institucionId, desde, hasta) {
  const dm = await sel('docente_materia', 'id, docentes!inner(institucion_id)', q => q.eq('docentes.institucion_id', institucionId));
  const dmIds = dm.map(d => d.id);

  const matriculasInst = await sel(
    'matriculas',
    'estudiante_id, paralelo_id, estudiantes!inner(nombres, apellidos, institucion_id), grados(nombre), paralelos(nombre)',
    q => q.eq('estado', 'activa').eq('estudiantes.institucion_id', institucionId)
  );

  let registros = [];
  if (dmIds.length) {
    const { data, error } = await supabase.from('asistencia').select('estudiante_id, estado')
      .in('docente_materia_id', dmIds).gte('fecha', desde).lte('fecha', hasta);
    if (error) console.error('[Supabase] reporte institucional', error.message);
    registros = data || [];
  }

  const porAlumno = {};
  matriculasInst.forEach(m => {
    porAlumno[m.estudiante_id] = {
      id: m.estudiante_id,
      nombre: `${m.estudiantes?.apellidos || ''} ${m.estudiantes?.nombres || ''}`.trim(),
      curso: `${m.grados?.nombre || ''} ${m.paralelos?.nombre || ''}`.trim(),
      paraleloId: m.paralelo_id,
      presente: 0, atraso: 0, ausente: 0, justificado: 0
    };
  });
  registros.forEach(r => { if (porAlumno[r.estudiante_id] && porAlumno[r.estudiante_id][r.estado] !== undefined) porAlumno[r.estudiante_id][r.estado]++; });

  return Object.values(porAlumno).map(a => {
    const total = a.presente + a.atraso + a.ausente + a.justificado;
    const totalContable = a.presente + a.atraso + a.ausente; // justificado no penaliza el %
    const pct = totalContable > 0 ? Math.round(((a.presente + a.atraso) / totalContable) * 100) : null;
    const advertencia = a.ausente >= 3 || (pct !== null && pct < 80);
    return { ...a, total, pct, advertencia };
  }).sort((x, y) => (x.pct ?? 999) - (y.pct ?? 999));
}

/**
 * Resumen de asistencia de TODAS las cargas de un docente juntas (no una por
 * una) — para su propio Dashboard. Incluye el desglose por materia/curso.
 */
export async function fetchResumenAsistenciaDocente(docenteMateriaIds, desde, hasta) {
  if (!docenteMateriaIds?.length) return { totales: null, porCarga: [] };
  const { data, error } = await supabase.from('asistencia')
    .select('docente_materia_id, estado')
    .in('docente_materia_id', docenteMateriaIds).gte('fecha', desde).lte('fecha', hasta);
  if (error) { console.error('[Supabase] resumen docente', error.message); return { totales: null, porCarga: [] }; }

  const vacios = () => ({ presente: 0, atraso: 0, ausente: 0, justificado: 0 });
  const totales = vacios();
  const porId = {};
  docenteMateriaIds.forEach(id => { porId[id] = vacios(); });
  (data || []).forEach(r => {
    if (porId[r.docente_materia_id]?.[r.estado] !== undefined) { porId[r.docente_materia_id][r.estado]++; totales[r.estado]++; }
  });
  const contable = c => c.presente + c.atraso + c.ausente;
  const pct = c => contable(c) > 0 ? Math.round(((c.presente + c.atraso) / contable(c)) * 100) : null;
  return {
    totales: { ...totales, pct: pct(totales) },
    porCarga: Object.entries(porId).map(([id, c]) => ({ docenteMateriaId: id, ...c, pct: pct(c) }))
  };
}

/** Lo mismo que arriba, pero agrupado por CADA docente de la institución — vista del inspector. */
export async function fetchResumenAsistenciaPorDocente(institucionId, desde, hasta) {
  const docentes = await sel('docentes', 'id, nombres, apellidos', q => q.eq('institucion_id', institucionId).eq('activo', true));
  const cargas = await sel('docente_materia', 'id, docente_id', q => q.in('docente_id', docentes.map(d => d.id)));
  if (!cargas.length) return [];

  const { data, error } = await supabase.from('asistencia').select('docente_materia_id, estado')
    .in('docente_materia_id', cargas.map(c => c.id)).gte('fecha', desde).lte('fecha', hasta);
  if (error) { console.error('[Supabase] resumen por docente', error.message); return []; }

  const dmToDocente = Object.fromEntries(cargas.map(c => [c.id, c.docente_id]));
  const vacios = () => ({ presente: 0, atraso: 0, ausente: 0, justificado: 0 });
  const porDocente = {};
  docentes.forEach(d => { porDocente[d.id] = { ...vacios(), nombre: `${d.nombres} ${d.apellidos}`.trim() }; });
  (data || []).forEach(r => {
    const docId = dmToDocente[r.docente_materia_id];
    if (porDocente[docId]?.[r.estado] !== undefined) porDocente[docId][r.estado]++;
  });
  return Object.values(porDocente).map(d => {
    const contable = d.presente + d.atraso + d.ausente;
    const pct = contable > 0 ? Math.round(((d.presente + d.atraso) / contable) * 100) : null;
    return { ...d, total: contable + d.justificado, pct };
  }).sort((a, b) => (a.pct ?? 999) - (b.pct ?? 999));
}

export async function fetchAulas(institucionId) {
  return sel('aulas', '*', q => q.eq('institucion_id', institucionId).order('codigo'));
}
export async function crearAula(institucionId, aula) {
  const { data, error } = await supabase.from('aulas').insert({ institucion_id: institucionId, ...aula }).select().single();
  if (error) throw error;
  return data;
}
export async function actualizarAula(id, cambios) {
  const { error } = await supabase.from('aulas').update(cambios).eq('id', id);
  if (error) throw error;
}
export async function eliminarAula(id) {
  const { error } = await supabase.from('aulas').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchHorario(institucionId) {
  return sel('horario_bloques', '*', q => q.eq('institucion_id', institucionId));
}
/** Solo los bloques de las cargas que el docente realmente dicta — nunca todo el plantel. */
export async function fetchHorarioDocente(docenteMateriaIds) {
  if (!docenteMateriaIds?.length) return [];
  return sel('horario_bloques', '*', q => q.in('docente_materia_id', docenteMateriaIds));
}
/** El horario completo (todas las materias) de un único paralelo — para la vista de estudiante/padre. */
export async function fetchHorarioParalelo(paraleloId) {
  if (!paraleloId) return [];
  return sel('horario_bloques', '*', q => q.eq('paralelo_id', paraleloId));
}
export async function guardarBloqueHorario(bloque) {
  const { data, error } = await supabase.from('horario_bloques').upsert(bloque).select().single();
  if (error) throw error;
  return data;
}
export async function eliminarBloqueHorario(id) {
  const { error } = await supabase.from('horario_bloques').delete().eq('id', id);
  if (error) throw error;
}

export { fetchCalendario, crearEventoCalendario, eliminarEventoCalendario, mensajeAsistencia, evaluarDia } from './calendario.js';

export async function fetchNotificaciones(institucionId) {
  return sel('notificaciones', '*', q => q.eq('institucion_id', institucionId).order('created_at', { ascending: false }));
}
export async function crearNotificacion(institucionId, notif, creadoPor) {
  const { error } = await supabase.from('notificaciones').insert({ institucion_id: institucionId, created_by: creadoPor, ...notif });
  if (error) throw error;
}
export async function eliminarNotificacion(id) {
  const { error } = await supabase.from('notificaciones').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchJustificaciones(institucionId) {
  return sel('justificaciones', '*', q => q.eq('institucion_id', institucionId).order('fecha', { ascending: false }));
}
export async function crearJustificacion(institucionId, just, creadoPor) {
  const { error } = await supabase.from('justificaciones').insert({ institucion_id: institucionId, created_by: creadoPor, ...just });
  if (error) throw error;
}
export async function revisarJustificacion(id, estado, revisadoPor) {
  const { error } = await supabase.from('justificaciones')
    .update({ estado, revisado_por: revisadoPor, revisado_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function fetchAsistenciaInstitucion(institucionId, desde) {
  const dm = await sel('docente_materia', 'id, docentes!inner(institucion_id)', q => q.eq('docentes.institucion_id', institucionId));
  const ids = dm.map(d => d.id);
  if (!ids.length) return [];
  return sel('asistencia', '*', q => q.in('docente_materia_id', ids).gte('fecha', desde));
}
export async function fetchAvisosInasistencia(institucionId) {
  return sel('avisos_inasistencia', '*', q => q.eq('institucion_id', institucionId).order('enviado_at', { ascending: false }));
}
export async function registrarAviso(institucionId, estudianteId, mensaje, enviadoPor, fecha) {
  const payload = { institucion_id: institucionId, estudiante_id: estudianteId, mensaje, enviado_por: enviadoPor };
  if (fecha) payload.fecha = fecha;
  const { error } = await supabase.from('avisos_inasistencia').insert(payload);
  if (error) throw error;
}

export async function actualizarInstitucion(id, cambios) {
  const { error } = await supabase.from('instituciones').update(cambios).eq('id', id);
  if (error) throw error;
}

export async function guardarPreferencias(profileId, preferencias) {
  const { error } = await supabase.from('profiles').update({ preferencias }).eq('id', profileId);
  if (error) throw error;
}

export async function subirArchivo(bucket, path, file) {
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, cacheControl: '3600' });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function fetchDocentePerfil(id) {
  const { data, error } = await supabase.from('docentes').select('*').eq('id', id).single();
  if (error) { console.error('[Supabase] docentes', error.message); return null; }
  return data;
}

export async function crearDocente(institucionId, datos) {
  const { data, error } = await supabase.from('docentes')
    .insert({ institucion_id: institucionId, ...datos }).select().single();
  if (error) throw error;
  return data;
}

export async function guardarDocentePerfil(id, cambios) {
  const { data, error } = await supabase.from('docentes')
    .update({ ...cambios, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function eliminarDocente(id) {
  const { error } = await supabase.from('docentes').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchEstudiantePerfil(id) {
  const { data: est, error } = await supabase.from('estudiantes').select('*').eq('id', id).single();
  if (error) { console.error('[Supabase] estudiantes', error.message); return null; }

  const vinculos = await sel('representantes_estudiantes', '*', q => q.eq('estudiante_id', id));
  const repIds = vinculos.map(v => v.representante_id);
  const representantes = repIds.length
    ? await sel('representantes', '*', q => q.in('id', repIds))
    : [];

  let hermanos = [];
  if (repIds.length) {
    const otrosVinculos = await sel('representantes_estudiantes', '*', q => q.in('representante_id', repIds).neq('estudiante_id', id));
    const idsHermanos = [...new Set(otrosVinculos.map(v => v.estudiante_id))];
    if (idsHermanos.length) {
      const hermanosRows = await sel('estudiantes', 'id, nombres, apellidos, cedula', q => q.in('id', idsHermanos));
      hermanos = hermanosRows.map(h => ({ id: h.id, nombre: `${h.apellidos || ''} ${h.nombres || ''}`.trim(), cedula: h.cedula }));
    }
  }

  const matricula = (await sel('matriculas', '*', q => q.eq('estudiante_id', id).order('fecha_matricula', { ascending: false }).limit(1)))[0] || null;

  return { ...est, representantes, hermanos, matricula };
}

export async function fetchEstudianteIdPorProfile(profileId) {
  const rows = await sel('estudiantes', 'id', q => q.eq('profile_id', profileId));
  return rows[0]?.id || null;
}

export async function fetchHijosDeRepresentante(profileId) {
  const reps = await sel('representantes', 'id', q => q.eq('profile_id', profileId));
  if (!reps.length) return [];
  const vinculos = await sel('representantes_estudiantes', 'estudiante_id', q => q.eq('representante_id', reps[0].id));
  const ids = vinculos.map(v => v.estudiante_id);
  if (!ids.length) return [];
  const estudiantes = await sel('estudiantes', 'id, nombres, apellidos', q => q.in('id', ids));
  return estudiantes.map(e => ({ id: e.id, nombre: `${e.nombres} ${e.apellidos}`.trim() }));
}

/**
 * Todo lo "programado" visible para un estudiante puntual: su matrícula/curso,
 * el resumen de su propia asistencia, y las tareas vigentes de su paralelo.
 * Padre y estudiante ven exactamente lo mismo — se llama con el mismo estudianteId.
 */
export async function fetchProgramacionEstudiante(estudianteId) {
  const { data: est, error: e1 } = await supabase.from('estudiantes').select('*').eq('id', estudianteId).single();
  if (e1 || !est) return null;

  const matricula = (await sel('matriculas', '*', q => q.eq('estudiante_id', estudianteId).order('fecha_matricula', { ascending: false }).limit(1)))[0] || null;

  let curso = null, tareas = [], asistenciaReciente = [], resumenAsistencia = { presente: 0, atraso: 0, ausente: 0, justificado: 0 };

  if (matricula?.paralelo_id) {
    const [{ data: paralelo }, { data: grado }] = await Promise.all([
      supabase.from('paralelos').select('*').eq('id', matricula.paralelo_id).single(),
      matricula.grado_id ? supabase.from('grados').select('*').eq('id', matricula.grado_id).single() : Promise.resolve({ data: null })
    ]);
    curso = { paralelo: paralelo?.nombre, grado: grado?.nombre };

    const hoy = new Date().toISOString().slice(0, 10);
    const { data: tareasRows } = await supabase.from('tareas').select('*, materias(nombre)')
      .eq('paralelo_id', matricula.paralelo_id).gte('fecha_limite', hoy).order('fecha_limite');
    tareas = tareasRows || [];
  }

  const { data: asis } = await supabase.from('asistencia').select('fecha, estado')
    .eq('estudiante_id', estudianteId).order('fecha', { ascending: false }).limit(15);
  asistenciaReciente = asis || [];
  asistenciaReciente.forEach(a => { if (resumenAsistencia[a.estado] !== undefined) resumenAsistencia[a.estado]++; });

  return { estudiante: est, matricula, curso, tareas, asistenciaReciente, resumenAsistencia };
}


export async function crearEstudiante(institucionId, datos) {
  const { data, error } = await supabase.from('estudiantes')
    .insert({ institucion_id: institucionId, ...datos }).select().single();
  if (error) throw error;
  // Protección: si por cualquier motivo no vuelve el registro creado, se avisa con un error normal
  // (antes la pantalla intentaba leer `nuevo.id` mientras se dibujaba y quedaba en blanco).
  if (!data?.id) throw new Error('El estudiante no se pudo crear. Inténtalo de nuevo.');
  return data;
}

export async function guardarEstudiantePerfil(id, cambios) {
  const { data, error } = await supabase.from('estudiantes')
    .update({ ...cambios, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function eliminarEstudiante(id) {
  const { error } = await supabase.from('estudiantes').delete().eq('id', id);
  if (error) throw error;
}

/** La base de datos solo admite 'padre' | 'madre' | 'tutor' (minúscula). Cualquier otro parentesco (abuelo, tío, "Otro"…) se guarda como 'tutor'. */
export function normalizarParentesco(v) {
  const t = String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  if (/^(padre|papa|father)\b/.test(t)) return 'padre';
  if (/^(madre|mama|mother)\b/.test(t)) return 'madre';
  return 'tutor';
}

export async function agregarRepresentante(institucionId, estudianteId, datos) {
  const { data: rep, error: e1 } = await supabase.from('representantes')
    .insert({ institucion_id: institucionId, ...datos, rol_representante: normalizarParentesco(datos?.rol_representante) }).select().single();
  if (e1) throw e1;
  const { error: e2 } = await supabase.from('representantes_estudiantes')
    .insert({ representante_id: rep.id, estudiante_id: estudianteId });
  if (e2) throw e2;
  return rep;
}

export async function actualizarRepresentante(id, cambios) {
  const c = cambios && 'rol_representante' in cambios ? { ...cambios, rol_representante: normalizarParentesco(cambios.rol_representante) } : cambios;
  const { error } = await supabase.from('representantes').update(c).eq('id', id);
  if (error) throw error;
}

export async function quitarRepresentanteDeEstudiante(representanteId, estudianteId) {
  const { error } = await supabase.from('representantes_estudiantes')
    .delete().eq('representante_id', representanteId).eq('estudiante_id', estudianteId);
  if (error) throw error;
}

export async function fetchPlanteles() {
  return sel('instituciones', '*');
}
export async function crearPlantel(datos) {
  const { data, error } = await supabase.from('instituciones').insert(datos).select().single();
  if (error) throw error;
  return data;
}
export async function actualizarPlantel(id, cambios) {
  const { error } = await supabase.from('instituciones').update(cambios).eq('id', id);
  if (error) throw error;
}
export async function eliminarPlantel(id) {
  const { error } = await supabase.from('instituciones').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchMetricasGlobales() {
  const [planteles, docentes, estudiantes, usuarios] = await Promise.all([
    sel('instituciones', '*'),
    sel('docentes', 'id, institucion_id, activo'),
    sel('estudiantes', 'id, institucion_id, activo'),
    sel('profiles', 'id, rol, activo')
  ]);
  return {
    planteles,
    docentes,
    estudiantes,
    usuarios: usuarios.map(u => ({ ...u, rol: ROLE_GROUP[u.rol] || u.rol }))
  };
}

export async function fetchPeriodos(institucionId) {
  return sel('periodos_lectivos', '*', q => q.eq('institucion_id', institucionId).order('fecha_inicio', { ascending: false }));
}
export async function crearPeriodo(institucionId, datos) {
  const { data, error } = await supabase.from('periodos_lectivos')
    .insert({ institucion_id: institucionId, ...datos }).select().single();
  if (error) throw error;
  return data;
}
export async function actualizarPeriodo(id, cambios) {
  const { error } = await supabase.from('periodos_lectivos').update(cambios).eq('id', id);
  if (error) throw error;
}
export async function activarPeriodo(institucionId, id) {
  const { error: e1 } = await supabase.from('periodos_lectivos').update({ activo: false }).eq('institucion_id', institucionId);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from('periodos_lectivos').update({ activo: true }).eq('id', id);
  if (e2) throw e2;
}
export async function eliminarPeriodo(id) {
  const { error } = await supabase.from('periodos_lectivos').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchMaterias(institucionId) {
  return sel('materias', '*', q => q.eq('institucion_id', institucionId).order('nombre'));
}
export async function crearMateria(institucionId, datos) {
  const { data, error } = await supabase.from('materias')
    .insert({ institucion_id: institucionId, ...datos }).select().single();
  if (error) throw error;
  return data;
}
export async function actualizarMateria(id, cambios) {
  const { error } = await supabase.from('materias').update(cambios).eq('id', id);
  if (error) throw error;
}
export async function eliminarMateria(id) {
  const { error } = await supabase.from('materias').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchGradosConParalelos(institucionId) {
  const grados = await sel('grados', '*', q => q.eq('institucion_id', institucionId).order('orden'));
  const ids = grados.map(g => g.id);
  const paralelos = ids.length ? await sel('paralelos', '*', q => q.in('grado_id', ids).order('nombre')) : [];
  return grados.map(g => ({ ...g, paralelos: paralelos.filter(p => p.grado_id === g.id) }));
}
export async function crearGrado(institucionId, datos) {
  const { data, error } = await supabase.from('grados')
    .insert({ institucion_id: institucionId, ...datos }).select().single();
  if (error) throw error;
  return data;
}
export async function actualizarGrado(id, cambios) {
  const { error } = await supabase.from('grados').update(cambios).eq('id', id);
  if (error) throw error;
}
export async function eliminarGrado(id) {
  const { error } = await supabase.from('grados').delete().eq('id', id);
  if (error) throw error;
}

// crearParalelo: firma NUEVA (gradoId, {nombre, jornada, tutor_docente_id}) — antes era (gradoId, nombreString)
export async function crearParalelo(gradoId, datos) {
  const { data, error } = await supabase.from('paralelos')
    .insert({ grado_id: gradoId, nombre: datos.nombre, jornada: datos.jornada || 'Matutina', tutor_docente_id: datos.tutor_docente_id || null })
    .select().single();
  if (error) throw error;
  return data;
}
export async function actualizarParalelo(id, cambios) {
  const { error } = await supabase.from('paralelos').update(cambios).eq('id', id);
  if (error) throw error;
}
export async function eliminarParalelo(id) {
  const { error } = await supabase.from('paralelos').delete().eq('id', id);
  if (error) throw error;
}

// crearMatricula: agrega parámetro opcional "observacion" (para traslados) al final
export async function crearMatricula(estudianteId, periodoId, gradoId, paraleloId, observacion) {
  const existentes = await sel('matriculas', '*', q => q.eq('estudiante_id', estudianteId).eq('periodo_id', periodoId));
  const previa = existentes[0];
  if (previa) {
    // Ya tiene matrícula en este período (la base solo permite una): se mueve de curso/paralelo y queda ACTIVA.
    // Si estaba retirada, esto también la reactiva. Nunca se deja al estudiante sin matrícula activa.
    const cambios = {
      grado_id: gradoId, paralelo_id: paraleloId, estado: 'activa',
      fecha_salida: null, motivo_cambio: null, institucion_destino_id: null, institucion_destino_externa: null
    };
    if (observacion) cambios.observacion = observacion;
    const { data, error } = await supabase.from('matriculas').update(cambios).eq('id', previa.id).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from('matriculas')
    .insert({ estudiante_id: estudianteId, periodo_id: periodoId, grado_id: gradoId, paralelo_id: paraleloId, estado: 'activa', observacion: observacion || null })
    .select().single();
  if (error) throw error;
  return data;
}

/** Quita el retiro: la matrícula vuelve a estar ACTIVA en su mismo curso y paralelo (y la ficha del estudiante, activa). */
export async function reactivarMatricula(matriculaId, estudianteId) {
  const { error } = await supabase.from('matriculas')
    .update({ estado: 'activa', fecha_salida: null, motivo_cambio: null, institucion_destino_id: null, institucion_destino_externa: null })
    .eq('id', matriculaId).eq('estado', 'retirada');
  if (error) throw error;
  if (estudianteId) {
    const { error: e2 } = await supabase.from('estudiantes').update({ activo: true }).eq('id', estudianteId);
    if (e2) throw e2;
  }
}
export async function actualizarMatricula(id, cambios) {
  const { error } = await supabase.from('matriculas').update(cambios).eq('id', id);
  if (error) throw error;
}

// --- Promoción / repitencia / traslados (individual o masivo) ---------------

// Catálogo de instituciones activas (incluye las de toda la Zona 7) para elegir
// destino de un traslado. Búsqueda opcional por nombre.
export async function fetchInstitucionesCatalogo(busqueda) {
  let q = supabase.from('instituciones').select('id, nombre, amie, canton, provincia').eq('activo', true).order('nombre').limit(30);
  if (busqueda) q = q.ilike('nombre', `%${busqueda}%`);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// Cierra la matrícula activa de un estudiante con el resultado indicado
// (promovida | repite | trasladada | egresada | retirada) y, si corresponde
// (promovida/repite), abre la matrícula nueva en el grado/paralelo/período
// destino. loteId agrupa los cambios hechos en una misma corrida masiva.
export async function cambiarEstadoMatricula(estudianteId, matriculaId, tipo, opciones = {}) {
  const { motivo, loteId, institucionDestinoId, institucionDestinoExterna,
    gradoDestinoId, paraleloDestinoId, periodoDestinoId } = opciones;
  const fechaSalida = new Date().toISOString().slice(0, 10);
  const cambios = { estado: tipo, motivo_cambio: motivo || null, lote_id: loteId || null, fecha_salida: fechaSalida };
  if (tipo === 'trasladada') {
    cambios.institucion_destino_id = institucionDestinoId || null;
    cambios.institucion_destino_externa = institucionDestinoExterna || null;
  }
  const { error } = await supabase.from('matriculas').update(cambios).eq('id', matriculaId);
  if (error) throw error;

  if ((tipo === 'promovida' || tipo === 'repite') && gradoDestinoId && paraleloDestinoId && periodoDestinoId) {
    const { error: err2 } = await supabase.from('matriculas').insert({
      estudiante_id: estudianteId, periodo_id: periodoDestinoId,
      grado_id: gradoDestinoId, paralelo_id: paraleloDestinoId,
      estado: 'activa', lote_id: loteId || null
    });
    if (err2) throw err2;
  }
}

// Historial/reporte de cambios de matrícula (promociones, repitencias y
// traslados). Se lee directo de la tabla auditoria, que ya registra por
// trigger cada INSERT/UPDATE de matriculas — no hace falta tabla nueva.
export async function fetchReporteCambiosMatricula(institucionId, filtros = {}) {
  let q = supabase.from('auditoria').select('*')
    .eq('entidad', 'matriculas').eq('institucion_id', institucionId)
    .in('accion', ['INSERT', 'UPDATE'])
    .order('created_at', { ascending: false }).limit(500);
  if (filtros.desde) q = q.gte('created_at', filtros.desde);
  if (filtros.hasta) q = q.lte('created_at', filtros.hasta + 'T23:59:59');
  const { data, error } = await q;
  if (error) throw error;
  return (data || [])
    .map(r => ({ ...r, estadoNuevo: r.cambios?.new?.estado, estudianteId: r.cambios?.new?.estudiante_id || r.cambios?.old?.estudiante_id }))
    .filter(r => r.estadoNuevo && r.estadoNuevo !== 'activa' && (!filtros.tipo || r.estadoNuevo === filtros.tipo));
}

// Egresados: estudiantes cuya matrícula quedó en estado 'egresada' (graduados
// del último año). Se agrupan en pantalla por promoción (el período lectivo en
// que egresaron) y, si el paralelo tiene especialidad (Bach. Técnico), por esa.
export async function fetchEgresados(institucionId) {
  const estudiantesInst = await sel('estudiantes', 'id, nombres, apellidos, cedula', q => q.eq('institucion_id', institucionId));
  const idsEst = estudiantesInst.map(e => e.id);
  if (!idsEst.length) return [];
  const estById = Object.fromEntries(estudiantesInst.map(e => [e.id, e]));
  const [matriculas, grados, paralelos, periodos] = await Promise.all([
    sel('matriculas', '*', q => q.eq('estado', 'egresada').in('estudiante_id', idsEst)),
    sel('grados', '*', q => q.eq('institucion_id', institucionId)),
    sel('paralelos', '*'),
    sel('periodos_lectivos', '*', q => q.eq('institucion_id', institucionId))
  ]);
  const gradosById = Object.fromEntries(grados.map(g => [g.id, g]));
  const paralelosById = Object.fromEntries(paralelos.map(p => [p.id, p]));
  const periodosById = Object.fromEntries(periodos.map(p => [p.id, p]));
  return matriculas
    .map(m => {
      const est = estById[m.estudiante_id];
      const par = paralelosById[m.paralelo_id];
      return {
        matriculaId: m.id, estudianteId: m.estudiante_id,
        nombre: est ? `${est.apellidos || ''} ${est.nombres || ''}`.trim() : '—',
        cedula: est?.cedula || '',
        grado: gradosById[m.grado_id]?.nombre || '',
        paralelo: par?.nombre || '',
        especialidad: par?.especialidad || '',
        promocion: periodosById[m.periodo_id]?.nombre || '',
        fechaEgreso: m.fecha_salida,
        observacion: m.motivo_cambio || ''
      };
    })
    .sort((a, b) => (b.fechaEgreso || '').localeCompare(a.fechaEgreso || ''));
}

export async function fetchCargasDocente(profileId, institucionId) {
  const docentesRows = await sel('docentes', 'id', q => q.eq('profile_id', profileId).eq('institucion_id', institucionId));
  if (!docentesRows.length) return [];
  return fetchCargasPorDocenteId(docentesRows[0].id, institucionId);
}
export async function fetchCargasPorDocenteId(docenteId, institucionId) {
  const [cargas, materias, grados, paralelos, periodos] = await Promise.all([
    sel('docente_materia', '*', q => q.eq('docente_id', docenteId)),
    sel('materias', '*', q => q.eq('institucion_id', institucionId)),
    sel('grados', '*', q => q.eq('institucion_id', institucionId)),
    sel('paralelos', '*'),
    sel('periodos_lectivos', '*', q => q.eq('institucion_id', institucionId))
  ]);
  const matById = Object.fromEntries(materias.map(m => [m.id, m]));
  const gradoById = Object.fromEntries(grados.map(g => [g.id, g]));
  const parById = Object.fromEntries(paralelos.map(p => [p.id, p]));
  const perById = Object.fromEntries(periodos.map(p => [p.id, p]));
  return cargas.map(c => {
    const par = parById[c.paralelo_id];
    const gr = par ? gradoById[par.grado_id] : null;
    return {
      id: c.id, materiaId: c.materia_id, materiaNombre: matById[c.materia_id]?.nombre || '',
      paraleloId: c.paralelo_id, paraleloNombre: par?.nombre || '', gradoNombre: gr?.nombre || '', gradoNivel: gr?.nivel || '',
      periodoId: c.periodo_id, periodoNombre: perById[c.periodo_id]?.nombre || ''
    };
  });
}
export async function crearCargaDocente(docenteId, materiaId, paraleloId, periodoId) {
  const { data, error } = await supabase.from('docente_materia')
    .insert({ docente_id: docenteId, materia_id: materiaId, paralelo_id: paraleloId, periodo_id: periodoId })
    .select().single();
  if (error) throw error;
  return data;
}
export async function eliminarCargaDocente(id) {
  const { error } = await supabase.from('docente_materia').delete().eq('id', id);
  if (error) throw error;
}
export async function fetchTodasCargas(institucionId) {
  const docentesRows = await sel('docentes', 'id, nombres, apellidos', q => q.eq('institucion_id', institucionId));
  const [materias, grados, paralelos, periodos] = await Promise.all([
    sel('materias', '*', q => q.eq('institucion_id', institucionId)),
    sel('grados', '*', q => q.eq('institucion_id', institucionId)),
    sel('paralelos', '*'),
    sel('periodos_lectivos', '*', q => q.eq('institucion_id', institucionId))
  ]);
  const docIds = docentesRows.map(d => d.id);
  const cargas = docIds.length ? await sel('docente_materia', '*', q => q.in('docente_id', docIds)) : [];
  const matById = Object.fromEntries(materias.map(m => [m.id, m]));
  const gradoById = Object.fromEntries(grados.map(g => [g.id, g]));
  const parById = Object.fromEntries(paralelos.map(p => [p.id, p]));
  const perById = Object.fromEntries(periodos.map(p => [p.id, p]));
  const docById = Object.fromEntries(docentesRows.map(d => [d.id, d]));
  return cargas.map(c => {
    const par = parById[c.paralelo_id];
    const gr = par ? gradoById[par.grado_id] : null;
    const doc = docById[c.docente_id];
    return {
      id: c.id, docenteNombre: doc ? `${doc.apellidos || ''} ${doc.nombres || ''}`.trim() : '',
      materiaNombre: matById[c.materia_id]?.nombre || '', paraleloId: c.paralelo_id,
      paraleloNombre: par?.nombre || '', gradoNombre: gr?.nombre || '',
      periodoId: c.periodo_id, periodoNombre: perById[c.periodo_id]?.nombre || ''
    };
  });
}
export async function fetchEstudiantesParalelo(paraleloId, periodoId) {
  const matriculas = await sel('matriculas', '*', q => q.eq('paralelo_id', paraleloId).eq('periodo_id', periodoId).eq('estado', 'activa'));
  const ids = matriculas.map(m => m.estudiante_id);
  if (!ids.length) return [];
  const estRows = await sel('estudiantes', 'id, nombres, apellidos', q => q.in('id', ids));
  return estRows.map(e => ({ id: e.id, nombre: `${e.apellidos || ''} ${e.nombres || ''}`.trim() }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export async function fetchCalificaciones(docenteMateriaId, periodoEvaluativo) {
  return sel('calificaciones', '*', q => q.eq('docente_materia_id', docenteMateriaId).eq('periodo_evaluativo', periodoEvaluativo));
}
export async function guardarCalificaciones(docenteMateriaId, periodoEvaluativo, registros, registradoPor) {
  const existentes = await fetchCalificaciones(docenteMateriaId, periodoEvaluativo);
  const existentesPorEstudiante = Object.fromEntries(existentes.map(r => [r.estudiante_id, r]));
  const aInsertar = [];
  const aActualizar = [];
  registros.forEach(r => {
    const prev = existentesPorEstudiante[r.estudiante_id];
    if (prev) {
      if (Number(prev.nota) !== Number(r.nota)) aActualizar.push({ id: prev.id, nota: r.nota });
    } else {
      aInsertar.push({
        estudiante_id: r.estudiante_id, docente_materia_id: docenteMateriaId,
        periodo_evaluativo: periodoEvaluativo, nota: r.nota, registrado_por: registradoPor
      });
    }
  });
  if (aInsertar.length) {
    const { error } = await supabase.from('calificaciones').insert(aInsertar);
    if (error) throw error;
  }
  for (const upd of aActualizar) {
    const { error } = await supabase.from('calificaciones').update({ nota: upd.nota }).eq('id', upd.id);
    if (error) throw error;
  }
  return true;
}

// ── Usuarios (módulo Usuarios.jsx) ──────────────────────────────────────
export async function fetchUsuarios(institucionId, isSuperAdmin) {
  const cols = 'id, institucion_id, rol, nombres, apellidos, cedula, telefono, email, activo, created_at, instituciones(nombre)';
  return isSuperAdmin
    ? sel('profiles', cols, q => q.order('created_at', { ascending: false }))
    : sel('profiles', cols, q => q.eq('institucion_id', institucionId).order('created_at', { ascending: false }));
}
export async function actualizarUsuario(id, cambios) {
  const { error } = await supabase.from('profiles').update(cambios).eq('id', id);
  if (error) throw error;
}
/**
 * Restablece la contraseña (y opcionalmente corrige el correo) de una o varias cuentas. Solo Super Admin y Administrador de Plantel.
 * resets: [{ user_id, password, email? }] → [{ user_id, ok, error? }]
 */
export async function restablecerContrasenas(resets) {
  const { data, error } = await supabase.functions.invoke('admin-reset-password', { body: { resets } });
  if (error) {
    let msg = error.message;
    try { const j = await error.context?.json?.(); if (j?.error) msg = j.error; } catch (_) { /* se queda el mensaje genérico */ }
    throw new Error(msg);
  }
  return data?.resultados || [];
}

export async function crearUsuario(datos) {
  const { data, error } = await supabase.functions.invoke('admin-create-user', { body: datos });
  if (error) throw error;
  return data;
}

// ── Académico: docentes simples + materias por paralelo + alumnos detalle ──
export async function fetchDocentesSimple(institucionId) {
  const rows = await sel('docentes', 'id, nombres, apellidos, cedula', q => q.eq('institucion_id', institucionId).eq('activo', true));
  return rows.map(d => ({ id: d.id, nombre: `${d.apellidos || ''} ${d.nombres || ''}`.trim(), cedula: d.cedula }));
}
export async function fetchMateriasParalelo(paraleloId, periodoId) {
  const [cargas, materias, docentes] = await Promise.all([
    sel('docente_materia', '*', q => q.eq('paralelo_id', paraleloId).eq('periodo_id', periodoId)),
    sel('materias', '*'),
    sel('docentes', 'id, nombres, apellidos, cedula')
  ]);
  const matById = Object.fromEntries(materias.map(m => [m.id, m]));
  const docById = Object.fromEntries(docentes.map(d => [d.id, d]));
  return cargas.map(c => {
    const doc = c.docente_id ? docById[c.docente_id] : null;
    return {
      id: c.id, materiaId: c.materia_id, materiaNombre: matById[c.materia_id]?.nombre || '',
      horasSemana: c.horas_semana || 0, docenteId: c.docente_id || null,
      docenteNombre: doc ? `${doc.apellidos || ''} ${doc.nombres || ''}`.trim() : null,
      docenteCedula: doc ? doc.cedula : null, estado: c.docente_id ? 'asignada' : 'pendiente'
    };
  });
}
export async function crearMateriaParalelo({ materiaId, paraleloId, periodoId, docenteId, horasSemana }) {
  const { data, error } = await supabase.from('docente_materia')
    .insert({ materia_id: materiaId, paralelo_id: paraleloId, periodo_id: periodoId, docente_id: docenteId || null, horas_semana: horasSemana || 0 })
    .select().single();
  if (error) throw error;
  return data;
}
export async function actualizarMateriaParalelo(id, cambios) {
  const { error } = await supabase.from('docente_materia').update(cambios).eq('id', id);
  if (error) throw error;
}
export async function eliminarMateriaParalelo(id) {
  const { error } = await supabase.from('docente_materia').delete().eq('id', id);
  if (error) throw error;
}
export async function fetchEstudiantesParaleloDetalle(paraleloId, periodoId) {
  const matriculas = await sel('matriculas', '*', q => q.eq('paralelo_id', paraleloId).eq('periodo_id', periodoId).eq('estado', 'activa'));
  const estIds = matriculas.map(m => m.estudiante_id);
  if (!estIds.length) return [];
  const matByEst = Object.fromEntries(matriculas.map(m => [m.estudiante_id, m]));
  const [estudiantes, vinculos] = await Promise.all([
    sel('estudiantes', '*', q => q.in('id', estIds)),
    sel('representantes_estudiantes', '*', q => q.in('estudiante_id', estIds))
  ]);
  const repIdsPorEst = {};
  vinculos.forEach(v => { (repIdsPorEst[v.estudiante_id] ||= []).push(v.representante_id); });
  const todosRepIds = [...new Set(vinculos.map(v => v.representante_id))];
  const representantes = todosRepIds.length ? await sel('representantes', '*', q => q.in('id', todosRepIds)) : [];
  const repById = Object.fromEntries(representantes.map(r => [r.id, r]));
  const hermanosCount = {};
  if (todosRepIds.length) {
    const otros = await sel('representantes_estudiantes', '*', q => q.in('representante_id', todosRepIds));
    const porRep = {};
    otros.forEach(o => { (porRep[o.representante_id] ||= new Set()).add(o.estudiante_id); });
    estIds.forEach(id => {
      const set = new Set();
      (repIdsPorEst[id] || []).forEach(repId => (porRep[repId] || new Set()).forEach(e => { if (e !== id) set.add(e); }));
      hermanosCount[id] = set.size;
    });
  }
  return estudiantes.map(e => {
    const repId = (repIdsPorEst[e.id] || [])[0] || null;
    const rep = repId ? repById[repId] : null;
    const mat = matByEst[e.id];
    return {
      id: e.id, nombres: e.nombres, apellidos: e.apellidos, cedula: e.cedula,
      tipoDocumento: e.tipo_documento || 'cedula', genero: e.genero, activo: !!e.activo,
      matriculaId: mat?.id, estadoMatricula: mat?.estado,
      representanteId: repId, representante: rep ? `${rep.apellidos || ''} ${rep.nombres || ''}`.trim() : '',
      telefonoRep: rep?.telefono || '', hermanos: hermanosCount[e.id] || 0
    };
  });
}
export async function matricularEstudiante(institucionId, periodoId, gradoId, paraleloId, datosEstudiante, datosRepresentante) {
  const estudiante = await crearEstudiante(institucionId, datosEstudiante);
  if (datosRepresentante?.nombres || datosRepresentante?.telefono) {
    await agregarRepresentante(institucionId, estudiante.id, datosRepresentante);
  }
  await crearMatricula(estudiante.id, periodoId, gradoId, paraleloId);
  return estudiante;
}
export async function actualizarAlumnoDetalle(estudianteId, representanteId, datosEstudiante, datosRepresentante) {
  if (Object.keys(datosEstudiante || {}).length) await guardarEstudiantePerfil(estudianteId, datosEstudiante);
  if (representanteId && datosRepresentante) await actualizarRepresentante(representanteId, datosRepresentante);
}
export async function darDeBajaEstudiante(matriculaId, estudianteId) {
  const { error: e1 } = await supabase.from('matriculas').update({ estado: 'retirada' }).eq('id', matriculaId);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from('estudiantes').update({ activo: false }).eq('id', estudianteId);
  if (e2) throw e2;
}
export async function trasladarEstudiante(estudianteId, periodoId, gradoId, paraleloId, observacion) {
  return crearMatricula(estudianteId, periodoId, gradoId, paraleloId, observacion);
}

// ── Dashboard Académico: KPIs, tendencia, promedios, actividad, export ──
export async function fetchResumenAcademico(institucionId, periodoId) {
  const grados = await sel('grados', 'id', q => q.eq('institucion_id', institucionId));
  const gradoIds = grados.map(g => g.id);
  const paralelos = gradoIds.length ? await sel('paralelos', 'id', q => q.in('grado_id', gradoIds)) : [];
  const paraleloIds = paralelos.map(p => p.id);

  const cargas = paraleloIds.length && periodoId
    ? await sel('docente_materia', 'id, docente_id', q => q.in('paralelo_id', paraleloIds).eq('periodo_id', periodoId))
    : [];
  const conDocente = cargas.filter(c => c.docente_id).length;

  const hoy = new Date().toISOString().slice(0, 10);
  const asistenciaHoy = await fetchAsistenciaInstitucion(institucionId, hoy);
  const presentesHoy = asistenciaHoy.filter(a => a.estado === 'presente').length;
  const tasaAsistencia = asistenciaHoy.length ? Math.round((presentesHoy / asistenciaHoy.length) * 1000) / 10 : null;

  const cargaIds = cargas.map(c => c.id);
  const calif = cargaIds.length ? await sel('calificaciones', 'estudiante_id, nota', q => q.in('docente_materia_id', cargaIds)) : [];
  const notasPorEst = {};
  calif.forEach(c => { (notasPorEst[c.estudiante_id] ||= []).push(Number(c.nota)); });
  const enRiesgo = Object.values(notasPorEst).filter(notas => (notas.reduce((a, b) => a + b, 0) / notas.length) < 7).length;

  const hace30 = new Date(Date.now() - 30 * 86400000).toISOString();
  const movimientos = paraleloIds.length
    ? await sel('matriculas', 'id, estado, fecha_matricula', q => q.in('paralelo_id', paraleloIds).gte('fecha_matricula', hace30.slice(0, 10)))
    : [];

  const tareaIds = (await sel('tareas', 'id', q => q.eq('institucion_id', institucionId))).map(t => t.id);
  const entregasPorCalificar = tareaIds.length
    ? await sel('tarea_entregas', 'id', q => q.in('tarea_id', tareaIds).in('estado', ['entregado', 'tardio']).is('nota', null))
    : [];

  const notifs = await sel('notificaciones', 'id', q => q.eq('institucion_id', institucionId).gte('created_at', hace30));

  return {
    tasaAsistencia, presentesHoy, totalHoy: asistenciaHoy.length,
    alumnosEnRiesgo: enRiesgo,
    coberturaDocente: cargas.length ? Math.round((conDocente / cargas.length) * 1000) / 10 : null,
    materiasSinDocente: cargas.length - conDocente,
    movimientosPeriodo: movimientos.length,
    tareasPorCalificar: entregasPorCalificar.length,
    notificacionesActivas: notifs.length
  };
}
export async function fetchTendenciaAsistencia(institucionId, dias = 30) {
  const desde = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
  const registros = await fetchAsistenciaInstitucion(institucionId, desde);
  const porDia = {};
  registros.forEach(r => {
    (porDia[r.fecha] ||= { total: 0, presentes: 0 });
    porDia[r.fecha].total++;
    if (r.estado === 'presente') porDia[r.fecha].presentes++;
  });
  return Object.entries(porDia)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, v]) => ({ fecha, asistencia: Math.round((v.presentes / v.total) * 1000) / 10 }));
}
export async function fetchPromedioPorMateria(institucionId, periodoId) {
  const grados = await sel('grados', 'id', q => q.eq('institucion_id', institucionId));
  const paralelos = grados.length ? await sel('paralelos', 'id', q => q.in('grado_id', grados.map(g => g.id))) : [];
  const paraleloIds = paralelos.map(p => p.id);
  if (!paraleloIds.length) return [];
  const cargas = await sel('docente_materia', 'id, materia_id', q => q.in('paralelo_id', paraleloIds).eq('periodo_id', periodoId));
  if (!cargas.length) return [];
  const materiaIdPorCarga = Object.fromEntries(cargas.map(c => [c.id, c.materia_id]));
  const materias = await sel('materias', 'id, nombre', q => q.in('id', [...new Set(cargas.map(c => c.materia_id))]));
  const nombreMateria = Object.fromEntries(materias.map(m => [m.id, m.nombre]));
  const calif = await sel('calificaciones', 'docente_materia_id, nota', q => q.in('docente_materia_id', cargas.map(c => c.id)));
  const porMateria = {};
  calif.forEach(c => {
    const matId = materiaIdPorCarga[c.docente_materia_id];
    (porMateria[matId] ||= []).push(Number(c.nota));
  });
  return Object.entries(porMateria).map(([matId, notas]) => ({
    materia: nombreMateria[matId] || '—',
    promedio: Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10
  }));
}
export async function fetchActividadReciente(institucionId, limite = 12) {
  const grados = await sel('grados', 'id', q => q.eq('institucion_id', institucionId));
  const paralelos = grados.length ? await sel('paralelos', 'id, nombre', q => q.in('grado_id', grados.map(g => g.id))) : [];
  const paraleloIds = paralelos.map(p => p.id);
  const parNombre = Object.fromEntries(paralelos.map(p => [p.id, p.nombre]));
  const [matriculasRecientes, justRecientes, cargasSinDocente] = await Promise.all([
    paraleloIds.length ? sel('matriculas', '*', q => q.in('paralelo_id', paraleloIds).order('fecha_matricula', { ascending: false }).limit(limite)) : [],
    sel('justificaciones', '*', q => q.eq('institucion_id', institucionId).order('fecha', { ascending: false }).limit(limite)),
    paraleloIds.length ? sel('docente_materia', 'id, paralelo_id, materia_id', q => q.in('paralelo_id', paraleloIds).is('docente_id', null)) : []
  ]);
  const estIds = [...new Set(matriculasRecientes.map(m => m.estudiante_id))];
  const estudiantes = estIds.length ? await sel('estudiantes', 'id, nombres, apellidos', q => q.in('id', estIds)) : [];
  const nombreEst = Object.fromEntries(estudiantes.map(e => [e.id, `${e.nombres || ''} ${e.apellidos || ''}`.trim()]));
  const eventos = [];
  matriculasRecientes.forEach(m => {
    eventos.push({
      tipo: m.estado === 'retirada' ? 'baja' : (m.observacion ? 'traslado' : 'ingreso'),
      titulo: m.estado === 'retirada' ? 'Baja / traslado registrado' : (m.observacion ? 'Traslado de paralelo' : 'Nuevo alumno matriculado'),
      detalle: `${nombreEst[m.estudiante_id] || 'Alumno'} — ${parNombre[m.paralelo_id] || ''}${m.observacion ? ' · ' + m.observacion : ''}`,
      fecha: m.fecha_matricula
    });
  });
  justRecientes.forEach(j => {
    eventos.push({ tipo: 'alerta', titulo: 'Justificación registrada', detalle: j.motivo || 'Justificación de inasistencia', fecha: j.fecha });
  });
  if (cargasSinDocente.length) {
    eventos.push({ tipo: 'asignacion', titulo: `${cargasSinDocente.length} materia(s) sin docente`, detalle: 'Pendientes de asignación', fecha: new Date().toISOString().slice(0, 10) });
  }
  return eventos.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).slice(0, limite);
}
export async function fetchAlumnosParaExportar(institucionId, periodoId) {
  const grados = await fetchGradosConParalelos(institucionId);
  const filas = [];
  for (const g of grados) {
    for (const p of g.paralelos) {
      const als = await fetchEstudiantesParaleloDetalle(p.id, periodoId);
      als.forEach(a => filas.push({ curso: g.nombre, paralelo: p.nombre, ...a }));
    }
  }
  return filas;
}

// ── Justificaciones: al aprobar, marca también la asistencia del día ──
export async function marcarAsistenciaJustificada(estudianteId, fecha) {
  // Solo se justifican las faltas reales (estado 'ausente') de ese día — nunca se debe
  // sobrescribir un registro donde el estudiante sí asistió a otra materia/hora la misma fecha.
  const { error } = await supabase.from('asistencia')
    .update({ estado: 'justificado' }).eq('estudiante_id', estudianteId).eq('fecha', fecha).eq('estado', 'ausente');
  if (error) throw error;
}

// ── Roles y Permisos: matriz módulo × acción por rol (tablas modulos_sistema/permisos_rol) ──
export async function fetchModulosSistema() {
  return sel('modulos_sistema', '*', q => q.eq('activo', true).order('orden'));
}
export async function fetchPermisosRol(rol) {
  return sel('permisos_rol', 'modulo_codigo, accion', q => q.eq('rol', rol));
}
export async function setPermisoRol(rol, modulo_codigo, accion, permitido) {
  if (permitido) {
    const { error } = await supabase
      .from('permisos_rol')
      .upsert({ rol, modulo_codigo, accion, permitido: true }, { onConflict: 'rol,modulo_codigo,accion' });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('permisos_rol')
      .delete()
      .eq('rol', rol).eq('modulo_codigo', modulo_codigo).eq('accion', accion);
    if (error) throw error;
  }
}
/* ── Encadenamiento de hermanos ──────────────────────────────────
 * Dos fuentes: detección automática (representante compartido, vista
 * hermanos_automaticos) y vínculos manuales (tabla hermanos_manual)
 * para casos que la detección automática no cubre. */
export async function fetchHermanosAutomaticos(institucionId) {
  return sel('hermanos_automaticos', '*', q => institucionId ? q.eq('institucion_id', institucionId) : q);
}
export async function fetchHermanosManual(institucionId) {
  return sel('hermanos_manual', '*', q => {
    const qq = institucionId ? q.eq('institucion_id', institucionId) : q;
    return qq.order('created_at', { ascending: false });
  });
}
export async function crearHermanoManual(institucionId, estudianteA, estudianteB, motivo, creadoPor) {
  const { error } = await supabase.from('hermanos_manual').insert({
    institucion_id: institucionId, estudiante_a: estudianteA, estudiante_b: estudianteB,
    motivo: motivo || null, creado_por: creadoPor
  });
  if (error) throw error;
}
export async function eliminarHermanoManual(id) {
  const { error } = await supabase.from('hermanos_manual').delete().eq('id', id);
  if (error) throw error;
}

/* ── Licencias por paralelo (activación y pago) ──────────────────
 * Un paralelo facturable = institución + grado + paralelo. Se activa
 * mes a mes solo cuando un pago con comprobante queda aprobado. */
export async function fetchLicenciasParalelo(institucionId) {
  return sel('licencias_paralelo_resumen', '*', q => institucionId ? q.eq('institucion_id', institucionId) : q);
}
export async function crearLicenciaParalelo(institucionId, gradoId, paraleloId, tarifaMensual, creadoPor) {
  const { data, error } = await supabase.from('licencias_paralelo')
    .insert({ institucion_id: institucionId, grado_id: gradoId, paralelo_id: paraleloId, tarifa_mensual: tarifaMensual, creado_por: creadoPor })
    .select().single();
  if (error) throw error;
  return data;
}
export async function actualizarTarifaLicencia(id, tarifaMensual) {
  const { error } = await supabase.from('licencias_paralelo').update({ tarifa_mensual: tarifaMensual }).eq('id', id);
  if (error) throw error;
}
export async function fetchPagosLicencia(licenciaId) {
  return sel('licencias_paralelo_pagos', '*', q => q.eq('licencia_paralelo_id', licenciaId).order('anio').order('mes'));
}
export async function fetchPagosPendientesGlobal() {
  return sel('licencias_paralelo_pagos', '*, licencias_paralelo!inner(institucion_id, grado_id, paralelo_id, tarifa_mensual, institucion:instituciones(nombre), grado:grados(nombre), paralelo:paralelos(nombre))',
    q => q.eq('estado', 'pendiente_revision').order('fecha_reporte'));
}
export async function reportarPagoMeses(licenciaId, meses, anio, montoPorMes, comprobanteNum, reportadoPor) {
  const filas = meses.map(mes => ({
    licencia_paralelo_id: licenciaId, anio, mes, monto: montoPorMes,
    comprobante_num: comprobanteNum, reportado_por: reportadoPor
  }));
  const { error } = await supabase.from('licencias_paralelo_pagos').insert(filas);
  if (error) throw error;
}
export async function revisarPagoLicencia(pagoId, aprobado, revisadoPor, notas) {
  const { error } = await supabase.from('licencias_paralelo_pagos').update({
    estado: aprobado ? 'aprobado' : 'rechazado',
    revisado_por: revisadoPor, fecha_revision: new Date().toISOString(),
    notas_revision: notas || null
  }).eq('id', pagoId);
  if (error) throw error;
}

/* ── Tareas y avisos (docente crea/califica, alumno ve/entrega) ── */
export async function fetchTareasDocente(docenteId) {
  const tareas = await sel(
    'tareas',
    '*, materias(nombre), paralelos(nombre, grado_id, grados(nombre))',
    q => q.eq('docente_id', docenteId).order('fecha_limite', { ascending: false })
  );
  const tareaIds = tareas.map(t => t.id);
  const entregas = tareaIds.length
    ? await sel('tarea_entregas', '*, estudiantes(nombres, apellidos)', q => q.in('tarea_id', tareaIds))
    : [];
  const entregasPorTarea = {};
  entregas.forEach(e => (entregasPorTarea[e.tarea_id] ||= []).push(e));
  return tareas.map(t => ({ ...t, entregas: entregasPorTarea[t.id] || [] }));
}
export async function crearTarea(institucionId, payload, creadoPor) {
  const { data, error } = await supabase.from('tareas')
    .insert({ institucion_id: institucionId, ...payload, created_by: creadoPor })
    .select().single();
  if (error) throw error;
  return data;
}
export async function actualizarTarea(id, cambios) {
  const { error } = await supabase.from('tareas').update(cambios).eq('id', id);
  if (error) throw error;
}
export async function eliminarTarea(id) {
  const { error } = await supabase.from('tareas').delete().eq('id', id);
  if (error) throw error;
}
export async function calificarEntrega(entregaId, nota, comentario, calificadoPor) {
  const { error } = await supabase.from('tarea_entregas').update({
    nota: nota === '' || nota === null ? null : Number(nota),
    comentario: comentario || null, calificado_por: calificadoPor
  }).eq('id', entregaId);
  if (error) throw error;
}

export async function fetchTareasAlumno(estudianteId) {
  const matricula = (await sel('matriculas', '*', q => q.eq('estudiante_id', estudianteId).order('fecha_matricula', { ascending: false }).limit(1)))[0];
  if (!matricula?.paralelo_id) return [];
  const tareas = await sel(
    'tareas', '*, materias(nombre)',
    q => q.eq('paralelo_id', matricula.paralelo_id).order('fecha_limite', { ascending: false })
  );
  const tareaIds = tareas.map(t => t.id);
  const misEntregas = tareaIds.length
    ? await sel('tarea_entregas', '*', q => q.eq('estudiante_id', estudianteId).in('tarea_id', tareaIds))
    : [];
  const entregaPorTarea = Object.fromEntries(misEntregas.map(e => [e.tarea_id, e]));
  return tareas.map(t => ({ ...t, miEntrega: entregaPorTarea[t.id] || null }));
}
export async function entregarTarea(tareaId, institucionId, estudianteId, { archivoUrl, archivoNombre, comentario, tardio }) {
  const { error } = await supabase.from('tarea_entregas').upsert({
    tarea_id: tareaId, institucion_id: institucionId, estudiante_id: estudianteId,
    estado: tardio ? 'tardio' : 'entregado',
    archivo_url: archivoUrl || null, archivo_nombre: archivoNombre || null,
    comentario: comentario || null, fecha_entrega: new Date().toISOString()
  }, { onConflict: 'tarea_id,estudiante_id' });
  if (error) throw error;
}

/* ── Panel de Inspectoría (KPIs de asistencia/calificaciones/notificaciones) ── */
export async function fetchPanelInspector(institucionId, estudianteIds) {
  const hoy = new Date().toISOString().slice(0, 10);
  const hace14 = new Date(Date.now() - 13 * 86400000).toISOString().slice(0, 10);
  const ids = estudianteIds.length ? estudianteIds : ['00000000-0000-0000-0000-000000000000'];
  const [asisHoy, asis14, califs, notificaciones] = await Promise.all([
    sel('asistencia', 'estado', q => q.in('estudiante_id', ids).eq('fecha', hoy)),
    sel('asistencia', 'fecha, estado', q => q.in('estudiante_id', ids).gte('fecha', hace14)),
    sel('calificaciones', 'estudiante_id, nota, docente_materia_id', q => q.in('estudiante_id', ids)),
    sel('notificaciones', '*', q => q.eq('institucion_id', institucionId).order('created_at', { ascending: false }).limit(8))
  ]);
  const presentesHoy = asisHoy.filter(a => a.estado === 'presente' || a.estado === 'atraso').length;
  const asistenciaHoy = { total: ids.length, marcados: asisHoy.length, presentes: presentesHoy, pct: asisHoy.length ? Math.round(1000 * presentesHoy / asisHoy.length) / 10 : null };

  const porDia = {};
  asis14.forEach(a => { (porDia[a.fecha] ||= { ok: 0, tot: 0 }); porDia[a.fecha].tot++; if (a.estado === 'presente' || a.estado === 'atraso') porDia[a.fecha].ok++; });
  const tendencia14 = Object.entries(porDia).sort((a, b) => a[0] < b[0] ? -1 : 1).map(([fecha, v]) => ({ fecha, pct: v.tot ? Math.round(1000 * v.ok / v.tot) / 10 : null }));

  const porEst = {};
  califs.forEach(c => { (porEst[c.estudiante_id] ||= []).push(Number(c.nota)); });
  const alumnosRiesgo = Object.values(porEst).filter(arr => arr.length && (arr.reduce((s, n) => s + n, 0) / arr.length) < 7).length;

  return { asistenciaHoy, tendencia14, alumnosRiesgo, calificacionesRaw: califs, notificaciones };
}

/* ── Resumen académico y horario del propio estudiante ── */
export async function fetchResumenAcademicoEstudiante(estudianteId, paraleloId, periodoId) {
  const [misCalifs, companeros] = await Promise.all([
    sel('calificaciones', '*, docente_materia(materia_id, materias(nombre))', q => q.eq('estudiante_id', estudianteId)),
    paraleloId ? sel('matriculas', 'estudiante_id', q => q.eq('paralelo_id', paraleloId).eq('periodo_id', periodoId)) : Promise.resolve([])
  ]);
  const porMateria = {};
  misCalifs.forEach(c => { const nombre = c.docente_materia?.materias?.nombre || '—'; (porMateria[nombre] ||= []).push(Number(c.nota)); });
  const materias = Object.entries(porMateria).map(([nombre, arr]) => ({ nombre, promedio: arr.reduce((s, n) => s + n, 0) / arr.length }));
  const promedioGeneral = materias.length ? materias.reduce((s, m) => s + m.promedio, 0) / materias.length : null;

  let posicion = null, totalCurso = 0;
  if (companeros.length) {
    const ids = companeros.map(c => c.estudiante_id);
    const notasCurso = await sel('calificaciones', 'estudiante_id, nota', q => q.in('estudiante_id', ids));
    const porEst = {};
    notasCurso.forEach(c => { (porEst[c.estudiante_id] ||= []).push(Number(c.nota)); });
    const promedios = Object.entries(porEst).map(([id, arr]) => ({ id, prom: arr.reduce((s, n) => s + n, 0) / arr.length })).sort((a, b) => b.prom - a.prom);
    totalCurso = promedios.length;
    const idx = promedios.findIndex(p => p.id === estudianteId);
    posicion = idx >= 0 ? idx + 1 : null;
  }
  return { materias, promedioGeneral, posicion, totalCurso };
}
export async function fetchHorarioAlumno(paraleloId) {
  if (!paraleloId) return [];
  const dm = await sel('docente_materia', 'id, materia_id, materias(nombre)', q => q.eq('paralelo_id', paraleloId));
  const dmIds = dm.map(d => d.id);
  if (!dmIds.length) return [];
  const bloques = await sel('horario_bloques', '*', q => q.in('docente_materia_id', dmIds));
  const dmMap = Object.fromEntries(dm.map(d => [d.id, d.materias?.nombre || '—']));
  return bloques.map(b => ({ ...b, materia: dmMap[b.docente_materia_id] || '—' }));
}

export async function copiarPermisosRol(rolOrigen, rolDestino) {
  const origen = await sel('permisos_rol', 'modulo_codigo, accion', q => q.eq('rol', rolOrigen));
  const { error: delErr } = await supabase.from('permisos_rol').delete().eq('rol', rolDestino);
  if (delErr) throw delErr;
  if (origen.length) {
    const filas = origen.map(p => ({ rol: rolDestino, modulo_codigo: p.modulo_codigo, accion: p.accion, permitido: true }));
    const { error: insErr } = await supabase.from('permisos_rol').insert(filas);
    if (insErr) throw insErr;
  }
}

const llamarBackend = crearClienteBackend({
  apiUrl: API_URL,
  getSession: () => supabase.auth.getSession(),
  refreshSession: () => supabase.auth.refreshSession()
});

/* ── Calificaciones BGU (aportes por trimestre; la nota la recalcula el backend) ── */
export async function fetchAportesCarga(docenteMateriaId, periodoEvaluativo) {
  const [aportes, mejoras] = await Promise.all([
    sel('calificaciones_aportes', '*', q => q.eq('docente_materia_id', docenteMateriaId).eq('periodo_evaluativo', periodoEvaluativo)),
    sel('calificaciones_mejoras', '*', q => q.eq('docente_materia_id', docenteMateriaId).eq('periodo_evaluativo', periodoEvaluativo))
  ]);
  return { aportes, mejoras };
}
export async function fetchConfigEvaluacion(institucionId, paraleloId, docenteMateriaId = null) {
  const rows = await sel('config_evaluacion', 'paralelo_id, docente_materia_id, config', q => q.eq('institucion_id', institucionId));
  const deCarga = docenteMateriaId && rows.find(r => r.docente_materia_id === docenteMateriaId);
  const deParalelo = rows.find(r => !r.docente_materia_id && r.paralelo_id === paraleloId);
  const general = rows.find(r => !r.docente_materia_id && r.paralelo_id === null);
  return (deCarga || deParalelo || general)?.config || null;
}
export async function fetchNotasParalelo(cargaIds) {
  if (!cargaIds.length) return { notas: [], mejoras: [] };
  const [notas, mejoras] = await Promise.all([
    sel('calificaciones', 'estudiante_id, docente_materia_id, periodo_evaluativo, nota', q => q.in('docente_materia_id', cargaIds)),
    sel('calificaciones_mejoras', 'estudiante_id, docente_materia_id, periodo_evaluativo, supletorio', q => q.in('docente_materia_id', cargaIds))
  ]);
  return { notas, mejoras };
}
export async function guardarNotasTrimestre(docenteMateriaId, periodoEvaluativo, registros) {
  // Upsert idempotente: reintentar ante servidor dormido o renovar la sesión es seguro.
  return llamarBackend('POST', '/calificaciones', { docente_materia_id: docenteMateriaId, periodo_evaluativo: periodoEvaluativo, registros });
}

export async function guardarSupletorios(docenteMateriaId, registros) {
  return llamarBackend('POST', '/calificaciones/supletorio', { docente_materia_id: docenteMateriaId, registros });
}

export async function guardarCasilleros(docenteMateriaId, casilleros) {
  return llamarBackend('PUT', '/calificaciones/config-carga', { docente_materia_id: docenteMateriaId, casilleros });
}

/* ── Boletas: datos extra (solo lectura) ── */
export async function fetchCedulasEstudiantes(ids) {
  if (!ids.length) return {};
  const rows = await sel('estudiantes', 'id, cedula', q => q.in('id', ids));
  return Object.fromEntries(rows.map(r => [r.id, r.cedula || '']));
}
export async function fetchNombreDocente(docenteId) {
  if (!docenteId) return '';
  const rows = await sel('docentes', 'id, nombres, apellidos', q => q.eq('id', docenteId));
  const r = rows[0];
  return r ? `${r.nombres || ''} ${r.apellidos || ''}`.trim() : '';
}

/* ── Vista de estudiante / representante: sus propias notas y datos para la boleta ── */
export async function fetchBoletaEstudiante(estudianteId, periodoId) {
  const { data: est } = await supabase.from('estudiantes').select('id, nombres, apellidos, cedula').eq('id', estudianteId).single();
  if (!est) return null;
  const matricula = (await sel('matriculas', '*', q => q.eq('estudiante_id', estudianteId).eq('periodo_id', periodoId).eq('estado', 'activa').limit(1)))[0] || null;
  if (!matricula?.paralelo_id) return { estudiante: est, matricula: null };
  const [{ data: paralelo }, { data: grado }, cargas] = await Promise.all([
    supabase.from('paralelos').select('id, nombre, tutor_docente_id').eq('id', matricula.paralelo_id).single(),
    matricula.grado_id ? supabase.from('grados').select('id, nombre, nivel').eq('id', matricula.grado_id).single() : Promise.resolve({ data: null }),
    fetchMateriasParalelo(matricula.paralelo_id, periodoId)
  ]);
  const ids = cargas.map(c => c.id);
  const [notas, mejoras] = ids.length ? await Promise.all([
    sel('calificaciones', 'docente_materia_id, periodo_evaluativo, nota', q => q.eq('estudiante_id', estudianteId).in('docente_materia_id', ids)),
    sel('calificaciones_mejoras', 'docente_materia_id, periodo_evaluativo, supletorio', q => q.eq('estudiante_id', estudianteId).eq('periodo_evaluativo', 'SUP').in('docente_materia_id', ids))
  ]) : [[], []];
  return { estudiante: est, matricula, paralelo, grado, cargas, notas, mejoras };
}

/* ── Horario: jornada (franjas y recreos), cargas para el generador y aplicación atómica ── */
export async function fetchHorarioConfig(institucionId) {
  if (!institucionId) return null;
  const rows = await sel('horario_config', 'franjas', q => q.eq('institucion_id', institucionId));
  return rows[0]?.franjas || null;
}
export async function guardarHorarioConfig(institucionId, franjas, profileId) {
  const { error } = await supabase.from('horario_config')
    .upsert({ institucion_id: institucionId, franjas, updated_by: profileId || null, updated_at: new Date().toISOString() });
  if (error) throw error;
}
export async function eliminarBloquesHorario(ids) {
  if (!ids.length) return;
  const { error } = await supabase.from('horario_bloques').delete().in('id', ids);
  if (error) throw error;
}
/** Todas las cargas (con o sin docente) de los paralelos indicados en el período, con horas por semana. */
export async function fetchCargasHorario(institucionId, periodoId, paraleloIds) {
  if (!paraleloIds.length) return [];
  const [cargas, materias, docentes] = await Promise.all([
    sel('docente_materia', '*', q => q.in('paralelo_id', paraleloIds).eq('periodo_id', periodoId)),
    sel('materias', 'id, nombre', q => q.eq('institucion_id', institucionId)),
    sel('docentes', 'id, nombres, apellidos', q => q.eq('institucion_id', institucionId))
  ]);
  const matById = Object.fromEntries(materias.map(m => [m.id, m]));
  const docById = Object.fromEntries(docentes.map(d => [d.id, d]));
  return cargas.map(c => ({
    id: c.id, paraleloId: c.paralelo_id, materiaNombre: matById[c.materia_id]?.nombre || 'Materia',
    docenteId: c.docente_id || null,
    docenteNombre: c.docente_id && docById[c.docente_id] ? `${docById[c.docente_id].apellidos || ''} ${docById[c.docente_id].nombres || ''}`.trim() : '',
    horasSemana: c.horas_semana || 0
  }));
}
export async function actualizarHorasCarga(id, horas) {
  const { error } = await supabase.from('docente_materia').update({ horas_semana: horas }).eq('id', id);
  if (error) throw error;
}
/** Borra (si se pide) y crea los bloques en UNA transacción: si algo choca, no cambia nada. */
export async function aplicarHorario(paraleloIds, bloques, reemplazar) {
  const { data, error } = await supabase.rpc('aplicar_horario', { p_paralelos: paraleloIds, p_bloques: bloques, p_reemplazar: !!reemplazar });
  if (error) throw error;
  return data;
}

/** Mueve una clase a otra celda del mismo paralelo (o intercambia si está ocupada). Devuelve 'movido' | 'intercambiado' | 'sin_cambio'. */
export async function moverBloqueHorario(id, dia, franja) {
  const { data, error } = await supabase.rpc('mover_bloque_horario', { p_id: id, p_dia: dia, p_franja: franja });
  if (error) throw error;
  return data;
}

/**
 * Resumen de notas para el panel del docente: por cada carga evaluable, cuántos estudiantes ya tienen la nota
 * DEFINITIVA de cada trimestre, cuántos faltan y el promedio del curso en ese trimestre.
 */
export async function fetchResumenCalificacionesDocente(cargas) {
  const ids = cargas.map(c => c.id);
  if (!ids.length) return {};
  const paraleloIds = [...new Set(cargas.map(c => c.paraleloId))];
  const periodoIds = [...new Set(cargas.map(c => c.periodoId).filter(Boolean))];
  const [notas, matriculas] = await Promise.all([
    sel('calificaciones', 'estudiante_id, docente_materia_id, periodo_evaluativo, nota', q => q.in('docente_materia_id', ids)),
    sel('matriculas', 'estudiante_id, paralelo_id, periodo_id', q => q.in('paralelo_id', paraleloIds).in('periodo_id', periodoIds).eq('estado', 'activa'))
  ]);
  const out = {};
  cargas.forEach(c => {
    const total = matriculas.filter(m => m.paralelo_id === c.paraleloId && m.periodo_id === c.periodoId).length;
    const porTrim = {};
    ['T1', 'T2', 'T3'].forEach(t => {
      const delTrim = notas.filter(n => n.docente_materia_id === c.id && n.periodo_evaluativo === t);
      const vals = delTrim.map(n => Number(n.nota));
      porTrim[t] = {
        definitivas: delTrim.length,
        promedio: vals.length ? Math.trunc((vals.reduce((a, b) => a + b, 0) / vals.length) * 100 + 1e-9) / 100 : null
      };
    });
    out[c.id] = { total, porTrim };
  });
  return out;
}

/* ── Catálogo de materias por nivel (plan de estudios sugerido, editable por plantel) ── */
export async function fetchCatalogoNivel(institucionId) {
  if (!institucionId) return combinarCatalogo([]);
  try {
    return combinarCatalogo(await sel('materias_catalogo_nivel', 'nivel, nombre, orden', q => q.eq('institucion_id', institucionId)));
  } catch (e) { return combinarCatalogo([]); }
}
/** Reemplaza el catálogo de un nivel (transacción única). Una lista vacía vuelve al plan por defecto. */
export async function guardarCatalogoNivel(institucionId, nivel, nombres) {
  const { error } = await supabase.rpc('guardar_catalogo_nivel', { p_institucion: institucionId, p_nivel: nivel, p_nombres: nombres });
  if (error) throw error;
}
/**
 * Carga al paralelo las materias del catálogo del nivel que todavía no tiene (sin docente; se asigna después).
 * Reutiliza las materias ya creadas en la institución (sin importar tildes ni mayúsculas) y crea las que falten.
 */
export async function cargarMateriasDelNivel({ institucionId, paraleloId, periodoId, nombres, horasSemana = 4 }) {
  const [materias, cargas] = await Promise.all([
    fetchMaterias(institucionId),
    sel('docente_materia', 'materia_id', q => q.eq('paralelo_id', paraleloId).eq('periodo_id', periodoId))
  ]);
  const porClave = new Map(materias.map(m => [clave(m.nombre), m]));
  const yaCargadas = new Set(cargas.map(c => c.materia_id));
  let agregadas = 0, yaExistian = 0, creadasEnCatalogo = 0;
  for (const nombre of nombres) {
    let m = porClave.get(clave(nombre));
    if (!m) { m = await crearMateria(institucionId, { nombre }); porClave.set(clave(nombre), m); creadasEnCatalogo++; }
    if (yaCargadas.has(m.id)) { yaExistian++; continue; }
    await crearMateriaParalelo({ materiaId: m.id, paraleloId, periodoId, docenteId: null, horasSemana });
    yaCargadas.add(m.id); agregadas++;
  }
  return { agregadas, yaExistian, creadasEnCatalogo };
}

/** Instituciones activas para los buscadores (nombre, AMIE, cantón, provincia). Pagina de 1000 en 1000 para no truncar. */
export async function fetchInstitucionesBusqueda() {
  const todas = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase.from('instituciones')
      .select('id, nombre, amie, canton, provincia').eq('activo', true).order('nombre').range(desde, desde + 999);
    if (error) throw error;
    todas.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return todas;
}

/* ── Vincular cuentas de acceso existentes con fichas de docente (sin crear usuario ni contraseña nueva) ── */
export async function fetchCuentasDocenteSinFicha(institucionId) {
  const [cuentas, fichas] = await Promise.all([
    sel('profiles', 'id, nombres, apellidos, email, cedula, activo', q => q.eq('institucion_id', institucionId).eq('rol', 'docente')),
    sel('docentes', 'profile_id', q => q.eq('institucion_id', institucionId).not('profile_id', 'is', null))
  ]);
  const usadas = new Set(fichas.map(f => f.profile_id));
  return cuentas.filter(c => !usadas.has(c.id)).map(c => ({
    id: c.id, nombre: `${c.apellidos || ''} ${c.nombres || ''}`.trim(), email: c.email, cedula: c.cedula, activo: c.activo !== false
  }));
}
export async function fetchFichasSinCuenta(institucionId) {
  const rows = await sel('docentes', 'id, nombres, apellidos, cedula, email', q => q.eq('institucion_id', institucionId).eq('activo', true).is('profile_id', null));
  return rows.map(d => ({ id: d.id, nombre: `${d.apellidos || ''} ${d.nombres || ''}`.trim(), cedula: d.cedula, email: d.email }));
}
export async function vincularCuentaDocente(docenteId, profileId) {
  const { error } = await supabase.rpc('vincular_cuenta_docente', { p_docente_id: docenteId, p_profile_id: profileId });
  if (error) throw error;
}

/* ───────────── Carga masiva inteligente: lectura de existentes y escritura por lotes ───────────── */
async function selTodo(table, cols, build) {
  const todas = [];
  for (let desde = 0; ; desde += 1000) {
    let q = supabase.from(table).select(cols);
    if (build) q = build(q);
    const { data, error } = await q.range(desde, desde + 999);
    if (error) throw error;
    todas.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return todas;
}
export const fetchDocentesParaCarga = institucionId => selTodo('docentes', '*', q => q.eq('institucion_id', institucionId).order('id'));
export const fetchEstudiantesParaCarga = institucionId => selTodo('estudiantes', '*', q => q.eq('institucion_id', institucionId).order('id'));

const trozos = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const sinNulos = obj => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined));

/**
 * Inserta en lotes de 50. Si un lote falla (p. ej. una cédula repetida que apareció mientras tanto) reintenta fila por fila
 * para saber exactamente cuáles fallaron. Devuelve { creados: [{ i, row }], fallos: [{ i, motivo }] } (i = posición en `filas`).
 */
async function insertarPorLotes(tabla, filas, onProgreso) {
  const creados = [], fallos = [];
  let hecho = 0;
  for (const [k, lote] of trozos(filas, 50).entries()) {
    const base = k * 50;
    const { data, error } = await supabase.from(tabla).insert(lote).select();
    if (!error && data && data.length === lote.length) {
      data.forEach((row, j) => creados.push({ i: base + j, row }));
    } else {
      for (const [j, fila] of lote.entries()) {
        const r = await supabase.from(tabla).insert(fila).select().single();
        if (r.error) fallos.push({ i: base + j, motivo: r.error.message });
        else creados.push({ i: base + j, row: r.data });
      }
    }
    hecho += lote.length;
    onProgreso?.(hecho, filas.length);
  }
  return { creados, fallos };
}

/**
 * nuevos: [{ fila, datos }] · completar: [{ fila, id, cambios }]
 * Devuelve { creados: n, completados: n, fallos: [{ fila, motivo }] }
 */
export async function cargarDocentesLote(institucionId, nuevos, completar, onProgreso) {
  const { creados, fallos } = await insertarPorLotes('docentes', nuevos.map(n => ({ institucion_id: institucionId, ...n.datos })), (h, t) => onProgreso?.({ fase: 'Creando docentes', hecho: h, total: t + completar.length }));
  const out = { creados: creados.length, completados: 0, fallos: fallos.map(f => ({ fila: nuevos[f.i].fila, motivo: f.motivo })) };
  for (const [k, c] of completar.entries()) {
    try { await guardarDocentePerfil(c.id, c.cambios); out.completados++; }
    catch (e) { out.fallos.push({ fila: c.fila, motivo: e.message }); }
    onProgreso?.({ fase: 'Completando datos', hecho: nuevos.length + k + 1, total: nuevos.length + completar.length });
  }
  return out;
}

/**
 * nuevos: [{ fila, datos, gradoId, paraleloId, representante }] · completar: [{ fila, id, cambios }]
 * Crea estudiantes, sus matrículas (si el curso y el paralelo se resolvieron) y sus representantes (reutilizando los que ya existen por cédula).
 * Un fallo en matrícula o representante NO deshace al estudiante: se informa como aviso.
 */
export async function cargarEstudiantesLote(institucionId, periodoId, nuevos, completar, onProgreso) {
  const total = nuevos.length + completar.length;
  const { creados, fallos } = await insertarPorLotes('estudiantes', nuevos.map(n => ({ institucion_id: institucionId, ...n.datos })), (h) => onProgreso?.({ fase: 'Creando estudiantes', hecho: h, total }));
  const out = { creados: creados.length, completados: 0, matriculas: 0, representantes: 0, fallos: fallos.map(f => ({ fila: nuevos[f.i].fila, motivo: f.motivo })), avisos: [] };

  // matrículas
  const mat = creados.filter(c => nuevos[c.i].gradoId && nuevos[c.i].paraleloId && periodoId)
    .map(c => ({ estudiante_id: c.row.id, periodo_id: periodoId, grado_id: nuevos[c.i].gradoId, paralelo_id: nuevos[c.i].paraleloId, estado: 'activa' }));
  const idxMat = creados.filter(c => nuevos[c.i].gradoId && nuevos[c.i].paraleloId && periodoId);
  onProgreso?.({ fase: 'Matriculando', hecho: creados.length, total });
  for (const [k, lote] of trozos(mat, 100).entries()) {
    const { error } = await supabase.from('matriculas').insert(lote);
    if (error) idxMat.slice(k * 100, k * 100 + lote.length).forEach(c => out.avisos.push({ fila: nuevos[c.i].fila, motivo: 'no se pudo matricular: ' + error.message }));
    else out.matriculas += lote.length;
  }

  // representantes: se reutilizan los que ya existen por cédula (hermanos comparten representante)
  const conRep = creados.filter(c => nuevos[c.i].representante);
  if (conRep.length) {
    onProgreso?.({ fase: 'Registrando representantes', hecho: creados.length, total });
    const cedulas = [...new Set(conRep.map(c => nuevos[c.i].representante.cedula))];
    const existentes = {};
    for (const lote of trozos(cedulas, 100)) {
      const rows = await sel('representantes', 'id, cedula', q => q.eq('institucion_id', institucionId).in('cedula', lote));
      rows.forEach(r => { existentes[r.cedula] = r.id; });
    }
    const porCrear = [];
    conRep.forEach(c => { const r = nuevos[c.i].representante; if (!existentes[r.cedula] && !porCrear.some(x => x.cedula === r.cedula)) porCrear.push({ institucion_id: institucionId, ...r }); });
    const nuevosReps = await insertarPorLotes('representantes', porCrear);
    nuevosReps.creados.forEach(c => { existentes[c.row.cedula] = c.row.id; out.representantes++; });
    nuevosReps.fallos.forEach(f => out.avisos.push({ fila: null, motivo: `representante ${porCrear[f.i].cedula}: ${f.motivo}` }));
    const vinculos = conRep.filter(c => existentes[nuevos[c.i].representante.cedula]).map(c => ({ representante_id: existentes[nuevos[c.i].representante.cedula], estudiante_id: c.row.id }));
    for (const lote of trozos(vinculos, 100)) {
      const { error } = await supabase.from('representantes_estudiantes').insert(lote);
      if (error) out.avisos.push({ fila: null, motivo: 'no se pudieron vincular algunos representantes: ' + error.message });
    }
  }

  for (const [k, c] of completar.entries()) {
    try { await guardarEstudiantePerfil(c.id, c.cambios); out.completados++; }
    catch (e) { out.fallos.push({ fila: c.fila, motivo: e.message }); }
    onProgreso?.({ fase: 'Completando datos', hecho: nuevos.length + k + 1, total });
  }
  return out;
}

// ── Contenido editable del frontend (portada del login) ──────────────────────
// La lectura es pública (la portada se ve antes de iniciar sesión); solo el
// Super Admin puede escribir (RLS en contenido_frontend).
export async function fetchContenidoFrontend() {
  const { data, error } = await supabase.from('contenido_frontend').select('clave, valor');
  if (error) { console.error('[Supabase] contenido_frontend', error.message); return []; }
  return data || [];
}
export async function guardarContenidoFrontend(cambios, userId) {
  if (!cambios.length) return;
  const filas = cambios.map(c => ({ clave: c.clave, valor: c.valor, updated_by: userId || null, updated_at: new Date().toISOString() }));
  const { error } = await supabase.from('contenido_frontend').upsert(filas, { onConflict: 'clave' });
  if (error) throw error;
}

// ── Bases centrales (desvinculados y bases de docentes/estudiantes) ──────────
export async function listarCentral(cfg, { texto, pagina = 0, tam = 50, plantel = '', canton = '' } = {}) {
  let q = supabase.from(cfg.tabla)
    .select(`*, plantel:instituciones!${cfg.plantelCol}(nombre, amie)`, { count: 'exact' })
    .order(cfg.orden, { ascending: cfg.orden === 'nombre' || cfg.orden === 'apellidos' })
    .range(pagina * tam, pagina * tam + tam - 1);
  const or = filtroOr(cfg, texto);
  if (or) q = q.or(or);
  if (plantel === 'sin') q = q.is(cfg.plantelCol, null);
  else if (plantel === 'con') q = q.not(cfg.plantelCol, 'is', null);
  if (canton) q = q.eq('canton', canton);
  const { data, error, count } = await q;
  if (error) throw error;
  return { filas: data || [], total: count || 0 };
}
export async function contarCentral(cfg) {
  const total = await supabase.from(cfg.tabla).select('*', { count: 'exact', head: true });
  const con = cfg.filtroPlantel
    ? await supabase.from(cfg.tabla).select('*', { count: 'exact', head: true }).not(cfg.plantelCol, 'is', null)
    : null;
  let conTitulos = null;
  if (cfg.tabla === 'base_docentes') {
    const t = await supabase.from(cfg.tabla).select('*', { count: 'exact', head: true }).neq('titulos', '[]');
    conTitulos = t.error ? null : (t.count || 0);
  }
  return { total: total.count || 0, conPlantel: con ? (con.count || 0) : null, conTitulos };
}
export async function crearRegistroCentral(cfg, fila) {
  const { error } = await supabase.from(cfg.tabla).insert(fila);
  if (error) throw error;
}
export async function eliminarRegistroCentral(cfg, id) {
  const { error } = await supabase.from(cfg.tabla).delete().eq('id', id);
  if (error) throw error;
}

// ── Importar / exportar las bases centrales (solo Super Admin; la RLS también lo exige) ──
export async function cedulasExistentesCentral(cfg) {
  const set = new Set();
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase.from(cfg.tabla).select('cedula').not('cedula', 'is', null).order('cedula').range(desde, desde + 999);
    if (error) throw error;
    (data || []).forEach(r => set.add(r.cedula));
    if (!data || data.length < 1000) break;
  }
  return set;
}

// Bases (base_*): se guarda por cédula; si ya existe, solo se completan los datos que trae el archivo
// (una celda vacía no borra lo ya guardado y no se toca el plantel asignado).
// Desvinculados: se agregan los que no estén ya por cédula.
export async function importarCentral(cfg, filas, { existentes, autorId, onProgreso } = {}) {
  const esBase = cfg.tabla.startsWith('base_');
  const out = { nuevos: 0, actualizados: 0, omitidos: 0, fallos: [] };
  const ya = existentes || new Set();
  let aGuardar = filas;
  if (!esBase) {
    aGuardar = filas.filter(f => !(f.cedula && ya.has(f.cedula)));
    out.omitidos = filas.length - aGuardar.length;
  }
  const ahora = new Date().toISOString();
  const limpias = aGuardar.map(f => {
    const o = filaParaGuardar(f);
    if (esBase) o.updated_at = ahora;
    else if (cfg.autor && autorId) o[cfg.autor] = autorId;
    return o;
  });
  const lotes = agruparPorColumnas(limpias).flatMap(g => trozos(g, 500));
  let hecho = 0;
  for (const lote of lotes) {
    const q = esBase
      ? supabase.from(cfg.tabla).upsert(lote, { onConflict: 'cedula' })
      : supabase.from(cfg.tabla).insert(lote);
    const { error } = await q;
    if (error) out.fallos.push({ filas: lote.length, motivo: error.message });
    else lote.forEach(f => { if (esBase && ya.has(f.cedula)) out.actualizados++; else out.nuevos++; });
    hecho += lote.length;
    onProgreso?.({ hecho, total: limpias.length });
  }
  return out;
}

export async function todasCentral(cfg, onProgreso) {
  const todas = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error, count } = await supabase.from(cfg.tabla)
      .select(`*, plantel:instituciones!${cfg.plantelCol}(nombre, amie)`, { count: 'exact' })
      .order(cfg.orden, { ascending: cfg.orden === 'nombre' || cfg.orden === 'apellidos' })
      .order('id').range(desde, desde + 999);
    if (error) throw error;
    todas.push(...(data || []));
    onProgreso?.({ hecho: todas.length, total: count || todas.length });
    if (!data || data.length < 1000) break;
  }
  return todas;
}

// ── Asignar docentes de la base a un plantel ─────────────────────────────────
async function todasLasFilas(tabla, cols, build) {
  const out = [];
  for (let desde = 0; ; desde += 1000) {
    let q = supabase.from(tabla).select(cols).order('id').range(desde, desde + 999);
    if (build) q = build(q);
    const { data, error } = await q;
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function cantonesCentral(cfg) {
  const filas = await todasLasFilas(cfg.tabla, 'id, canton');
  return [...new Set(filas.map(f => f.canton).filter(Boolean))].sort();
}

// Todas las filas que cumplen los filtros (para "seleccionar los N resultados"), hasta `max`.
export async function registrosParaAsignar(cfg, { texto, plantel = '', canton = '' } = {}, max = 5000) {
  let q = supabase.from(cfg.tabla).select('id, cedula, nombre, titulos, especialidad, canton, institucion_id').order('nombre').limit(max);
  const or = filtroOr(cfg, texto);
  if (or) q = q.or(or);
  if (plantel === 'sin') q = q.is(cfg.plantelCol, null);
  else if (plantel === 'con') q = q.not(cfg.plantelCol, 'is', null);
  if (canton) q = q.eq('canton', canton);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// Incorpora a los docentes elegidos al plantel (crea su ficha en `docentes`, sin duplicar) y los marca como asignados en la base.
export async function asignarBaseDocentes(institucionId, registros, onProgreso) {
  const cedulas = [...new Set(registros.map(r => cedulaCentral(r.cedula)).filter(Boolean))];
  const variantes = c => (c.startsWith('0') ? [c, c.slice(1)] : [c]);
  const enPlantel = new Set();
  for (const lote of trozos(cedulas, 120)) {
    const { data, error } = await supabase.from('docentes').select('cedula').eq('institucion_id', institucionId).in('cedula', lote.flatMap(variantes));
    if (error) throw error;
    (data || []).forEach(d => enPlantel.add(d.cedula));
  }
  const plan = planAsignacion(registros, enPlantel, institucionId);
  const total = plan.aIncorporar.length + plan.yaEstaban.length;
  const out = { incorporados: 0, yaEstaban: plan.yaEstaban.length, dudosos: plan.dudosos, sinCedula: plan.sinCedula.length, fallos: [] };
  const marcar = [...plan.yaEstaban];
  let hecho = 0;
  for (const lote of trozos(plan.aIncorporar, 100)) {
    const { error } = await supabase.from('docentes').insert(lote.map(x => x.fila));
    if (!error) { out.incorporados += lote.length; marcar.push(...lote.map(x => x.id)); }
    else {
      for (const x of lote) {   // un registro con problema no debe frenar al resto
        const r = await supabase.from('docentes').insert(x.fila);
        if (r.error) out.fallos.push({ cedula: x.fila.cedula, motivo: r.error.message });
        else { out.incorporados++; marcar.push(x.id); }
      }
    }
    hecho += lote.length;
    onProgreso?.({ hecho, total });
  }
  const ahora = new Date().toISOString();
  for (const lote of trozos(marcar, 200)) {
    const { error } = await supabase.from('base_docentes').update({ institucion_id: institucionId, asignado_en: ahora, updated_at: ahora }).in('id', lote);
    if (error) out.fallos.push({ cedula: null, motivo: 'no se pudo marcar como asignados: ' + error.message });
  }
  return out;
}

// Los de la base que ya están activos en un plantel quedan asignados a ese plantel.
export async function cruzarBaseConActivos(onProgreso) {
  const base = await todasLasFilas('base_docentes', 'id, cedula', q => q.is('institucion_id', null));
  onProgreso?.({ fase: 'Leyendo docentes activos' });
  const activos = await todasLasFilas('docentes', 'id, cedula, institucion_id');
  const plan = planCruce(base, activos);
  const ahora = new Date().toISOString();
  const fallos = [];
  for (const [inst, ids] of plan.asignar) {
    for (const lote of trozos(ids, 200)) {
      const { error } = await supabase.from('base_docentes').update({ institucion_id: inst, asignado_en: ahora, updated_at: ahora }).in('id', lote);
      if (error) fallos.push(error.message);
    }
  }
  return { revisados: base.length, cruzados: plan.total, ambiguos: plan.ambiguos, sinCoincidencia: plan.sinCoincidencia, fallos };
}

/* ── Financiero de SIGEE (cobro a los planteles por paralelo) ─────────────── */
export async function fetchTramosTarifa() {
  const { data, error } = await supabase.from('licencias_tarifas_tramos').select('*').order('desde');
  if (error) throw error;
  return data || [];
}
export async function fetchConfigLicencias() {
  const { data, error } = await supabase.from('licencias_config').select('clave, valor');
  if (error) throw error;
  return Object.fromEntries((data || []).map(r => [r.clave, Number(r.valor)]));
}
export async function guardarConfigLicencias(cfg) {
  const filas = Object.entries(cfg).map(([clave, valor]) => ({ clave, valor: Number(valor), updated_at: new Date().toISOString() }));
  const { error } = await supabase.from('licencias_config').upsert(filas, { onConflict: 'clave' });
  if (error) throw error;
}
// Guarda los tramos comparando con los que ya había: agrega, cambia y quita solo lo necesario.
export async function guardarTramosTarifa(nuevos, previos) {
  const quitar = previos.filter(p => !nuevos.some(n => n.id === p.id)).map(p => p.id);
  const agregar = nuevos.filter(n => !n.id).map(n => ({ desde: Number(n.desde), hasta: n.hasta === '' || n.hasta == null ? null : Number(n.hasta), tarifa: Number(n.tarifa) }));
  if (agregar.length) { const { error } = await supabase.from('licencias_tarifas_tramos').insert(agregar); if (error) throw error; }
  for (const n of nuevos.filter(x => x.id)) {
    const { error } = await supabase.from('licencias_tarifas_tramos').update({ desde: Number(n.desde), hasta: n.hasta === '' || n.hasta == null ? null : Number(n.hasta), tarifa: Number(n.tarifa) }).eq('id', n.id);
    if (error) throw error;
  }
  if (quitar.length) { const { error } = await supabase.from('licencias_tarifas_tramos').delete().in('id', quitar); if (error) throw error; }
}
export async function fetchFinancieroDatos(anio) {
  const [licencias, pagos, tramos, config] = await Promise.all([
    todasLasFilas('licencias_paralelo_resumen', '*'),
    todasLasFilas('licencias_paralelo_pagos', '*', q => q.eq('anio', anio)),
    fetchTramosTarifa(), fetchConfigLicencias()
  ]);
  return { licencias, pagos, tramos, config };
}
export async function fetchLibroCobros(anio) {
  return todasLasFilas('licencias_paralelo_pagos',
    '*, licencias_paralelo!inner(institucion:instituciones(nombre, amie), grado:grados(nombre), paralelo:paralelos(nombre))',
    q => q.eq('anio', anio));
}
// Cambia la tarifa mensual de los paralelos indicados (agrupa por tarifa). Lo ya pagado conserva su monto.
export async function aplicarTarifasLicencias(plan) {
  const cambios = plan.filter(p => Number(p.actual) !== Number(p.propuesta));
  const porTarifa = new Map();
  cambios.forEach(p => { if (!porTarifa.has(p.propuesta)) porTarifa.set(p.propuesta, []); porTarifa.get(p.propuesta).push(p.id); });
  for (const [tarifa, ids] of porTarifa) {
    for (const lote of trozos(ids, 200)) {
      const { error } = await supabase.from('licencias_paralelo').update({ tarifa_mensual: tarifa }).in('id', lote);
      if (error) throw error;
    }
  }
  return cambios.length;
}
