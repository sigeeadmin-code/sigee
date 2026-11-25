// Lógica pura de "Clases sin registro": agrupación para el panel y armado de lo que se manda a registrar_asistencia_inspeccion.
// La asistencia SIEMPRE va ligada a una carga (docente_materia) y a una fecha; Inspección registra dentro de esa misma materia.

/** Estados que Inspección puede marcar; todo lo no marcado queda 'presente'. */
export const ESTADOS_MARCA = ['ausente', 'atraso'];

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Arma el arreglo de excepciones. estados = { [estudianteId]: { estado, hora, observacion } } (los 'presente' no se mandan). */
export function construirMarcas(estados) {
  return Object.entries(estados || {})
    .filter(([, v]) => v && ESTADOS_MARCA.includes(v.estado))
    .map(([id, v]) => {
      const m = { estudiante_id: id, estado: v.estado };
      if (v.estado === 'atraso') m.hora_llegada = v.hora;
      if (v.observacion && String(v.observacion).trim()) m.observacion = String(v.observacion).trim();
      return m;
    });
}

/** Devuelve un texto de error si falta algo (hora del atraso), o null si todo está bien. */
export function validarMarcas(estados) {
  for (const v of Object.values(estados || {})) {
    if (v?.estado === 'atraso' && !HORA.test(String(v.hora || ''))) return 'Cada atraso necesita la hora de llegada (HH:MM).';
  }
  return null;
}

/** Cuántas clases sin registro tiene cada docente, de más a menos. */
export function rankingDocentes(clases) {
  const m = new Map();
  for (const c of clases || []) m.set(c.docente, (m.get(c.docente) || 0) + 1);
  return [...m.entries()].map(([docente, total]) => ({ docente, total })).sort((a, b) => b.total - a.total || a.docente.localeCompare(b.docente, 'es'));
}

/** Agrupa por fecha (más reciente primero), conservando el orden recibido dentro de cada día. */
export function agruparPorFecha(clases) {
  const m = new Map();
  for (const c of clases || []) { if (!m.has(c.fecha)) m.set(c.fecha, []); m.get(c.fecha).push(c); }
  return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([fecha, items]) => ({ fecha, items }));
}

export const resumenMarcas = marcas => ({
  ausentes: marcas.filter(m => m.estado === 'ausente').length,
  atrasos: marcas.filter(m => m.estado === 'atraso').length
});
