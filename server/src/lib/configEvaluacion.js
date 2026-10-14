// Limpieza de la configuración de evaluación que llega del cliente. Módulo PURO.
export const TIPOS = ['ind', 'grp', 'sum'];
const MAX_RUBROS = 12;
// Limpia lo que llega del cliente: solo nombre (texto corto), n (entero) y peso (número con hasta 2 decimales).
export function sanitizarConfig(cfg) {
  const limpio = {};
  for (const tipo of TIPOS) {
    const lista = Array.isArray(cfg?.[tipo]) ? cfg[tipo] : null;
    if (!lista) return { error: `Falta la lista '${tipo}'.` };
    if (lista.length > MAX_RUBROS) return { error: `Máximo ${MAX_RUBROS} rubros por sección.` };
    limpio[tipo] = lista.map(g => ({
      nombre: String(g?.nombre ?? '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60),
      n: Number(g?.n),
      peso: Math.round(Number(g?.peso) * 100) / 100
    }));
  }
  const nombres = [...limpio.ind, ...limpio.grp, ...limpio.sum].map(g => g.nombre.toLowerCase());
  if (new Set(nombres).size !== nombres.length) return { error: 'Hay dos rubros con el mismo nombre; cada nombre debe ser distinto.' };
  if (limpio.ind.length + limpio.grp.length < 1) return { error: 'Debe haber al menos un aporte formativo (individual o grupal).' };
  if (limpio.sum.length < 1) return { error: 'Debe haber al menos una evaluación sumativa.' };
  return { config: limpio };
}

