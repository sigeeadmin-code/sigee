import { supabase } from './supabase.js';

export const TIPOS_EVENTO = ['feriado', 'vacacion', 'excepcion', 'recuperacion', 'evento'];
export const TIPO_LABEL = {
  feriado: 'Feriado', vacacion: 'Vacación', excepcion: 'Excepción',
  recuperacion: 'Recuperación (lectivo forzado)', evento: 'Evento institucional'
};

function enRango(fecha, ini, fin) { return fecha >= ini && fecha <= fin; }

/**
 * Misma regla usada en el frontend (src/lib/calendario.js del repo React),
 * duplicada aquí a propósito: el backend NO debe confiar en lo que el
 * cliente afirme sobre si un día es lectivo, debe volver a evaluarlo.
 */
export function evaluarDia(fecha, eventos, periodoActivo, paraleloId) {
  const relevantes = (eventos || []).filter(ev => {
    if (fecha < ev.fecha_inicio || fecha > ev.fecha_fin) return false;
    if (ev.paralelo_id && ev.paralelo_id !== paraleloId) return false;
    return true;
  });

  const recuperacion = relevantes.find(ev => ev.tipo === 'recuperacion');
  if (recuperacion) return { ok: true, msg: 'Recuperación de clases — ' + (recuperacion.descripcion || 'lectivo forzado') };

  const bloqueante = relevantes.find(ev => ev.tipo === 'feriado' || ev.tipo === 'vacacion' || ev.tipo === 'excepcion');
  if (bloqueante) return { ok: false, msg: TIPO_LABEL[bloqueante.tipo] + ' — ' + (bloqueante.descripcion || 'no lectivo') };

  if (periodoActivo?.fecha_inicio && periodoActivo?.fecha_fin && !enRango(fecha, periodoActivo.fecha_inicio, periodoActivo.fecha_fin)) {
    return { ok: false, msg: 'Fuera del período lectivo activo (' + periodoActivo.fecha_inicio + ' a ' + periodoActivo.fecha_fin + ')' };
  }

  const dow = new Date(fecha + 'T12:00:00').getDay();
  if (dow === 0 || dow === 6) return { ok: false, msg: 'Fin de semana' };

  return { ok: true, msg: 'Día lectivo' };
}

export async function evaluarDiaInstitucion(institucionId, fecha, paraleloId) {
  const [{ data: eventos, error: e1 }, { data: periodos, error: e2 }] = await Promise.all([
    supabase.from('calendario_eventos').select('*')
      .eq('institucion_id', institucionId).lte('fecha_inicio', fecha).gte('fecha_fin', fecha),
    supabase.from('periodos_lectivos').select('*').eq('institucion_id', institucionId).eq('activo', true).limit(1)
  ]);
  if (e1) throw new Error('Error leyendo calendario_eventos: ' + e1.message);
  if (e2) throw new Error('Error leyendo periodos_lectivos: ' + e2.message);
  const periodoActivo = periodos?.[0] || null;
  return evaluarDia(fecha, eventos || [], periodoActivo, paraleloId || null);
}
