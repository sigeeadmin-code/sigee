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

// ── Capacidad e infraestructura ─────────────────────────────────────────────
export const PLANES_SUPABASE = {
  free: { nombre: 'Free', db: 500 * 1024 ** 2, storage: 1024 ** 3 },
  pro: { nombre: 'Pro', db: 8 * 1024 ** 3, storage: 100 * 1024 ** 3 }
};
export function planDeLimites(db, storage) {
  for (const [id, p] of Object.entries(PLANES_SUPABASE)) if (Number(db) === p.db && Number(storage) === p.storage) return id;
  return 'otro';
}
export function porcentaje(usado, total) {
  if (!total || total <= 0 || usado == null) return null;
  return Math.max(0, Math.min(100, (usado / total) * 100));
}
/** Verde hasta 70 %, ámbar hasta 85 %, rojo después. */
export function colorCapacidad(pct) {
  if (pct == null) return 'var(--slate)';
  return pct >= 85 ? 'var(--red)' : pct >= 70 ? 'var(--amber)' : 'var(--green)';
}
export function formatearBytes(n) {
  if (n == null) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB']; let v = Number(n), i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toLocaleString('es-EC', { maximumFractionDigits: v >= 100 || i === 0 ? 0 : 1 })} ${u[i]}`;
}
/** Cada valor como % del máximo de la propia serie (0-100). Serie toda en cero → todo 0. */
export function comoPorcentajeDelPico(valores) {
  const max = Math.max(0, ...valores.map(v => Number(v) || 0));
  return valores.map(v => (max > 0 ? ((Number(v) || 0) / max) * 100 : 0));
}
/** Índices con flujo excesivo: más de `factor` veces la mediana de las horas con actividad (y al menos `minimo` operaciones). */
export function detectarPicos(valores, factor = 3, minimo = 20) {
  const activos = valores.filter(v => v > 0).sort((a, b) => a - b);
  if (!activos.length) return [];
  const mediana = activos[Math.floor(activos.length / 2)];
  return valores.map((v, i) => (v >= minimo && v > mediana * factor ? i : -1)).filter(i => i >= 0);
}
