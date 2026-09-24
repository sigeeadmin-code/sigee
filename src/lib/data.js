import { supabase, ROLE_GROUP, ROLE_LABELS } from './supabase.js';

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
      activo: !!d.activo, acceso: !!d.profile_id
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

export async function guardarAsistencia(docenteMateriaId, fecha, registros, registradoPor) {
  const existentes = await fetchAsistencia(docenteMateriaId, fecha);
  const existentesPorEstudiante = Object.fromEntries(existentes.map(r => [r.estudiante_id, r]));
  const aInsertar = [];
  const aActualizar = [];
  registros.forEach(r => {
    const prev = existentesPorEstudiante[r.estudiante_id];
    if (prev) {
      const cambios = {};
      if (prev.estado !== r.estado) cambios.estado = r.estado;
      if ((prev.observacion || '') !== (r.observacion || '')) cambios.observacion = r.observacion || null;
      if (Object.keys(cambios).length) aActualizar.push({ id: prev.id, ...cambios });
    } else {
      aInsertar.push({
        estudiante_id: r.estudiante_id, docente_materia_id: docenteMateriaId,
        fecha, estado: r.estado, observacion: r.observacion || null, registrado_por: registradoPor
      });
    }
  });
  if (aInsertar.length) {
    const { error } = await supabase.from('asistencia').insert(aInsertar);
    if (error) throw error;
  }
  for (const upd of aActualizar) {
    const { id, ...cambios } = upd;
    const { error } = await supabase.from('asistencia').update(cambios).eq('id', id);
    if (error) throw error;
  }
  return true;
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
  if (error) throw error;
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

export async function agregarRepresentante(institucionId, estudianteId, datos) {
  const { data: rep, error: e1 } = await supabase.from('representantes')
    .insert({ institucion_id: institucionId, ...datos }).select().single();
  if (e1) throw e1;
  const { error: e2 } = await supabase.from('representantes_estudiantes')
    .insert({ representante_id: rep.id, estudiante_id: estudianteId });
  if (e2) throw e2;
  return rep;
}

export async function actualizarRepresentante(id, cambios) {
  const { error } = await supabase.from('representantes').update(cambios).eq('id', id);
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
  const activas = await sel('matriculas', '*', q => q.eq('estudiante_id', estudianteId).eq('periodo_id', periodoId).eq('estado', 'activa'));
  for (const m of activas) {
    const { error } = await supabase.from('matriculas').update({ estado: 'retirada' }).eq('id', m.id);
    if (error) throw error;
  }
  const { data, error } = await supabase.from('matriculas')
    .insert({ estudiante_id: estudianteId, periodo_id: periodoId, grado_id: gradoId, paralelo_id: paraleloId, estado: 'activa', observacion: observacion || null })
    .select().single();
  if (error) throw error;
  return data;
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
      paraleloId: c.paralelo_id, paraleloNombre: par?.nombre || '', gradoNombre: gr?.nombre || '',
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
