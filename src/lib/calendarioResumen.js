// Resumen del año lectivo a partir de los eventos del calendario (los períodos académicos oficiales
// vienen como eventos "… período académico"). Módulo PURO: sin Supabase ni navegador.
// Reglas de día lectivo = las de evaluarDia (calendario.js) sin el rango del período activo:
// recuperación fuerza lectivo; feriado/vacación/excepción bloquean; sábado y domingo no son lectivos.

const dia = f => new Date(f + 'T12:00:00Z');
const siguiente = d => new Date(d.getTime() + 86400000);
const ymd = d => d.toISOString().slice(0, 10);

export function esDiaLectivo(fecha, eventos) {
  const del = (eventos || []).filter(e => !e.paralelo_id && fecha >= e.fecha_inicio && fecha <= e.fecha_fin);
  if (del.some(e => e.tipo === 'recuperacion')) return true;
  if (del.some(e => e.tipo === 'feriado' || e.tipo === 'vacacion' || e.tipo === 'excepcion')) return false;
  const w = dia(fecha).getUTCDay();
  return w !== 0 && w !== 6;
}

/** Días lectivos entre dos fechas (incluidas). */
export function contarDiasLectivos(desde, hasta, eventos) {
  let n = 0;
  if (!desde || !hasta || desde > hasta) return 0;
  for (let d = dia(desde); d <= dia(hasta); d = siguiente(d)) if (esDiaLectivo(ymd(d), eventos)) n++;
  return n;
}

const ES_PERIODO = e => e.tipo === 'evento' && /per[ií]odo acad[eé]mico/i.test(e.descripcion || '');

/**
 * Períodos académicos del calendario con sus días lectivos, cuántos ya pasaron y cuántos faltan (a la fecha `hoy`).
 * Devuelve null si el calendario no trae períodos.
 */
export function resumenAnioLectivo(eventos, hoy) {
  const periodos = (eventos || []).filter(ES_PERIODO).sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio));
  if (!periodos.length) return null;
  const lista = periodos.map(p => {
    const total = contarDiasLectivos(p.fecha_inicio, p.fecha_fin, eventos);
    const transcurridos = hoy < p.fecha_inicio ? 0 : contarDiasLectivos(p.fecha_inicio, hoy > p.fecha_fin ? p.fecha_fin : hoy, eventos);
    return { nombre: p.descripcion, inicio: p.fecha_inicio, fin: p.fecha_fin, total, transcurridos, restantes: total - transcurridos, actual: hoy >= p.fecha_inicio && hoy <= p.fecha_fin };
  });
  const total = lista.reduce((s, p) => s + p.total, 0);
  const transcurridos = lista.reduce((s, p) => s + p.transcurridos, 0);
  const proximo = (eventos || []).filter(e => e.fecha_inicio >= hoy && (e.tipo === 'feriado' || e.tipo === 'vacacion'))
    .sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio))[0] || null;
  return {
    periodos: lista, total, transcurridos, restantes: total - transcurridos,
    inicio: lista[0].inicio, fin: lista[lista.length - 1].fin,
    proximoNoLectivo: proximo ? { tipo: proximo.tipo, descripcion: proximo.descripcion, desde: proximo.fecha_inicio, hasta: proximo.fecha_fin } : null
  };
}
