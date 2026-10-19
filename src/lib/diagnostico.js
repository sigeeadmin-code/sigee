// Puntaje de salud del diagnóstico: 100 menos el peso de cada control con hallazgos (alta 12, media 6, baja 2). Nunca baja de 0.
export const PESO_SEVERIDAD = { alta: 12, media: 6, baja: 2 };
export function calcularPuntaje(controles) {
  const resta = (controles || []).reduce((a, c) => a + (c.total > 0 ? (PESO_SEVERIDAD[c.severidad] || 0) : 0), 0);
  return Math.max(0, 100 - resta);
}
export function estadoPuntaje(p) {
  if (p >= 90) return { texto: 'Saludable', color: 'var(--green)' };
  if (p >= 70) return { texto: 'Requiere atención', color: 'var(--amber)' };
  return { texto: 'Crítico', color: 'var(--red)' };
}
