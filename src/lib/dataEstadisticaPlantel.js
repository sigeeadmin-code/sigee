import { supabase } from './supabase.js';

/**
 * Datos AMIE del plantel: matrícula activa + demografía + plantilla (docentes/admin)
 * + ficha referencial del plantel (num_*_ref, AMIE, sostenimiento).
 */
export async function fetchMatrizEstadisticaPlantel(institucionId) {
  if (!institucionId) return { filas: [], meta: null, plantilla: { docentes: 0, administrativos: 0 } };

  const { data: plantel, error: ePl } = await supabase
    .from('instituciones')
    .select('id, nombre, amie, sostenimiento, canton, parroquia, provincia, zona, regimen, nivel_educativo, jornada, jornadas, num_estudiantes_ref, num_docentes_ref, rector')
    .eq('id', institucionId)
    .maybeSingle();
  if (ePl) throw new Error(ePl.message);

  const { data: periodos, error: ePer } = await supabase
    .from('periodos_lectivos')
    .select('id, nombre, activo')
    .eq('institucion_id', institucionId);
  if (ePer) throw new Error(ePer.message);
  const periodoActivo = (periodos || []).find(p => p.activo) || (periodos || [])[0] || null;

  const { count: nDoc, error: eDoc } = await supabase
    .from('docentes')
    .select('id', { count: 'exact', head: true })
    .eq('institucion_id', institucionId)
    .eq('activo', true);
  if (eDoc) throw new Error(eDoc.message);

  const { data: profiles, error: ePr } = await supabase
    .from('profiles')
    .select('id, rol, activo')
    .eq('institucion_id', institucionId)
    .eq('activo', true);
  if (ePr) throw new Error(ePr.message);
  const rolesAdmin = new Set(['admin_plantel', 'secretario', 'inspector', 'dece', 'administrativo', 'contador_plantel', 'supervisor_plantel']);
  const nAdm = (profiles || []).filter(p => rolesAdmin.has(p.rol) || (!['alumno', 'padre', 'docente'].includes(p.rol))).length;

  if (!periodoActivo) {
    return {
      filas: [],
      meta: plantel ? { ...plantel, periodo: null } : null,
      plantilla: { docentes: nDoc || 0, administrativos: nAdm },
    };
  }

  const { data: grados, error: eGr } = await supabase
    .from('grados')
    .select('id, nombre, nivel')
    .eq('institucion_id', institucionId);
  if (eGr) throw new Error(eGr.message);
  const gradoIds = (grados || []).map(g => g.id);
  const gradoById = Object.fromEntries((grados || []).map(g => [g.id, g]));

  if (!gradoIds.length) {
    return {
      filas: [],
      meta: { ...plantel, periodo: periodoActivo },
      plantilla: { docentes: nDoc || 0, administrativos: nAdm },
    };
  }

  const { data: paralelos, error: ePar } = await supabase
    .from('paralelos')
    .select('id, nombre, grado_id, jornada')
    .in('grado_id', gradoIds);
  if (ePar) throw new Error(ePar.message);
  const paraleloById = Object.fromEntries((paralelos || []).map(p => [p.id, p]));
  const paraleloIds = (paralelos || []).map(p => p.id);

  if (!paraleloIds.length) {
    return {
      filas: [],
      meta: { ...plantel, periodo: periodoActivo },
      plantilla: { docentes: nDoc || 0, administrativos: nAdm },
    };
  }

  const { data: matriculas, error: eMat } = await supabase
    .from('matriculas')
    .select('id, estudiante_id, grado_id, paralelo_id, estado')
    .eq('periodo_id', periodoActivo.id)
    .eq('estado', 'activa')
    .in('paralelo_id', paraleloIds);
  if (eMat) throw new Error(eMat.message);

  if (!(matriculas || []).length) {
    return {
      filas: [],
      meta: { ...plantel, periodo: periodoActivo },
      plantilla: { docentes: nDoc || 0, administrativos: nAdm },
    };
  }

  const estIds = [...new Set(matriculas.map(m => m.estudiante_id))];
  let estudiantes = [];
  const { data: estData, error: eEst } = await supabase
    .from('estudiantes')
    .select('id, genero, fecha_nacimiento, discapacidad, nacionalidad, nombres, apellidos, activo')
    .in('id', estIds);
  if (eEst) {
    if (/nacionalidad/i.test(eEst.message || '')) {
      const { data: est2, error: e2 } = await supabase
        .from('estudiantes')
        .select('id, genero, fecha_nacimiento, discapacidad, nombres, apellidos, activo')
        .in('id', estIds);
      if (e2) throw new Error(e2.message);
      estudiantes = (est2 || []).map(e => ({ ...e, nacionalidad: null }));
    } else {
      throw new Error(eEst.message);
    }
  } else {
    estudiantes = estData || [];
  }
  const estById = Object.fromEntries(estudiantes.map(e => [e.id, e]));

  const filas = matriculas.map(m => {
    const est = estById[m.estudiante_id] || {};
    const par = paraleloById[m.paralelo_id] || {};
    const gr = gradoById[m.grado_id] || gradoById[par.grado_id] || {};
    return {
      estudiante_id: m.estudiante_id,
      curso: gr.nombre || '—',
      paralelo: par.nombre || '—',
      jornada: par.jornada || 'Sin jornada',
      genero: est.genero || '',
      fecha_nacimiento: est.fecha_nacimiento || null,
      discapacidad: est.discapacidad || '',
      nacionalidad: est.nacionalidad || '',
      estado: m.estado,
    };
  });

  return {
    filas,
    meta: { ...plantel, periodo: periodoActivo },
    plantilla: { docentes: nDoc || 0, administrativos: nAdm },
  };
}
