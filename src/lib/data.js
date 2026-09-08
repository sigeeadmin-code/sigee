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
      situacion: d.incorporado ? 'NOMBRAMIENTO' : 'CONTRATO', cargo: d.cargo || 'DOCENTE',
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
      if (prev.estado !== r.estado) aActualizar.push({ id: prev.id, estado: r.estado });
    } else {
      aInsertar.push({
        estudiante_id: r.estudiante_id, docente_materia_id: docenteMateriaId,
        fecha, estado: r.estado, registrado_por: registradoPor
      });
    }
  });
  if (aInsertar.length) {
    const { error } = await supabase.from('asistencia').insert(aInsertar);
    if (error) throw error;
  }
  for (const upd of aActualizar) {
    const { error } = await supabase.from('asistencia').update({ estado: upd.estado }).eq('id', upd.id);
    if (error) throw error;
  }
  return true;
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
export async function guardarBloqueHorario(bloque) {
  const { data, error } = await supabase.from('horario_bloques').upsert(bloque).select().single();
  if (error) throw error;
  return data;
}
export async function eliminarBloqueHorario(id) {
  const { error } = await supabase.from('horario_bloques').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchCalendario(institucionId) {
  return sel('calendario_eventos', '*', q => q.eq('institucion_id', institucionId).order('fecha_inicio'));
}
export async function crearEventoCalendario(institucionId, evento, creadoPor) {
  const { error } = await supabase.from('calendario_eventos').insert({ institucion_id: institucionId, created_by: creadoPor, ...evento });
  if (error) throw error;
}
export async function eliminarEventoCalendario(id) {
  const { error } = await supabase.from('calendario_eventos').delete().eq('id', id);
  if (error) throw error;
}

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
export async function registrarAviso(institucionId, estudianteId, mensaje, enviadoPor) {
  const { error } = await supabase.from('avisos_inasistencia').insert({ institucion_id: institucionId, estudiante_id: estudianteId, mensaje, enviado_por: enviadoPor });
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

  const matricula = (await sel('matriculas', '*', q => q.eq('estudiante_id', id).order('created_at', { ascending: false }).limit(1)))[0] || null;

  return { ...est, representantes, hermanos, matricula };
}

export async function crearEstudiante(institucionId, datos) {
  const { data, error } = await supabase.from('estudiantes')
    .insert({ institucion_id: institucionId, ...datos }).select().single();
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
    ? await sel('matriculas', 'id, estado, created_at', q => q.in('paralelo_id', paraleloIds).gte('fecha_matricula', hace30.slice(0, 10)))
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
  const { error } = await supabase.from('asistencia')
    .update({ estado: 'justificado' }).eq('estudiante_id', estudianteId).eq('fecha', fecha);
  if (error) throw error;
}
