import { supabase } from './supabase.js';

/**
 * Matriz estadística del plantel: una fila por estudiante con matrícula activa
 * del periodo lectivo activo, con jornada del paralelo y datos demográficos.
 */
export async function fetchMatrizEstadisticaPlantel(institucionId) {
  if (!institucionId) return [];

  const { data: periodos, error: ePer } = await supabase
    .from('periodos_lectivos')
    .select('id, activo')
    .eq('institucion_id', institucionId);
  if (ePer) throw new Error(ePer.message);
  const periodoActivo = (periodos || []).find(p => p.activo) || (periodos || [])[0];
  if (!periodoActivo) return [];

  const { data: grados, error: eGr } = await supabase
    .from('grados')
    .select('id, nombre, nivel')
    .eq('institucion_id', institucionId);
  if (eGr) throw new Error(eGr.message);
  const gradoIds = (grados || []).map(g => g.id);
  if (!gradoIds.length) return [];
  const gradoById = Object.fromEntries((grados || []).map(g => [g.id, g]));

  const { data: paralelos, error: ePar } = await supabase
    .from('paralelos')
    .select('id, nombre, grado_id, jornada')
    .in('grado_id', gradoIds);
  if (ePar) throw new Error(ePar.message);
  const paraleloById = Object.fromEntries((paralelos || []).map(p => [p.id, p]));
  const paraleloIds = (paralelos || []).map(p => p.id);
  if (!paraleloIds.length) return [];

  const { data: matriculas, error: eMat } = await supabase
    .from('matriculas')
    .select('id, estudiante_id, grado_id, paralelo_id, estado')
    .eq('periodo_id', periodoActivo.id)
    .eq('estado', 'activa')
    .in('paralelo_id', paraleloIds);
  if (eMat) throw new Error(eMat.message);
  if (!(matriculas || []).length) return [];

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

  return matriculas.map(m => {
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
}
