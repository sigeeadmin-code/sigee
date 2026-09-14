import { supabase } from './supabase.js';

// Tipos válidos en la BD real (constraint de calendario_eventos.tipo).
// OJO: no usar 'Vacaciones'/'Festivo'/etc — esos valores no pasan el CHECK y el insert falla.
export const TIPOS_EVENTO = ['feriado', 'vacacion', 'excepcion', 'recuperacion', 'evento'];
export const TIPO_LABEL = {
  feriado: 'Feriado', vacacion: 'Vacación', excepcion: 'Excepción',
  recuperacion: 'Recuperación (lectivo forzado)', evento: 'Evento institucional'
};
export const TIPO_BADGE = {
  feriado: 'b-err', vacacion: 'b-info', excepcion: 'b-warn', recuperacion: 'b-ok', evento: 'b-muted'
};

export function hoyISO() { return new Date().toISOString().slice(0, 10); }
function enRango(fecha, ini, fin) { return fecha >= ini && fecha <= fin; }

export async function fetchCalendario(institucionId) {
  const { data, error } = await supabase
    .from('calendario_eventos')
    .select('*')
    .eq('institucion_id', institucionId)
    .order('fecha_inicio');
  if (error) { console.error('[Supabase] calendario_eventos', error.message); return []; }
  return data || [];
}

export async function crearEventoCalendario(institucionId, evento, creadoPor) {
  if (!TIPOS_EVENTO.includes(evento.tipo)) throw new Error('Tipo de evento inválido: ' + evento.tipo);
  if (evento.fecha_inicio > evento.fecha_fin) throw new Error('La fecha de inicio no puede ser posterior a la de fin.');
  const { error } = await supabase.from('calendario_eventos')
    .insert({ institucion_id: institucionId, created_by: creadoPor, ...evento });
  if (error) throw error;
  return true;
}

export async function eliminarEventoCalendario(id) {
  const { error } = await supabase.from('calendario_eventos').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Evalúa si `fecha` es un día lectivo para una institución, opcionalmente
 * acotado a un curso (paraleloId). Reglas, en orden de prioridad:
 *  1. Un evento 'recuperacion' en esa fecha fuerza día lectivo (aunque sea fin de semana/vacación).
 *  2. Un evento 'feriado' / 'vacacion' / 'excepcion' en esa fecha bloquea el día — pero solo si
 *     aplica a este curso (paralelo_id null = toda la institución, o paralelo_id === paraleloId).
 *  3. Fuera del rango del período lectivo activo → no lectivo.
 *  4. Sábado/domingo → no lectivo.
 *  5. Caso contrario → lectivo.
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

/** Trae los eventos ya filtrados a la fecha dada, para no traer toda la tabla en cada validación. */
export async function mensajeAsistencia(institucionId, fecha, periodoActivo, paraleloId) {
  const { data, error } = await supabase
    .from('calendario_eventos')
    .select('*')
    .eq('institucion_id', institucionId)
    .lte('fecha_inicio', fecha)
    .gte('fecha_fin', fecha);
  if (error) { console.error('[Supabase] calendario_eventos', error.message); return { ok: true, msg: 'No se pudo validar el calendario, se permite por defecto.' }; }
  return evaluarDia(fecha, data || [], periodoActivo, paraleloId);
}
