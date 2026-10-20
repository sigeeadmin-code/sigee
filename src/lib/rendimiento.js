// Lógica pura del módulo "Análisis de calificaciones" (alertas tempranas de bajo rendimiento).
// Alerta = promedio entre 0,01 y 6,99 (por debajo de 7, la nota mínima para aprobar). Crítica = 4,00 o menos (escala NA).

export const ALERTA_MIN = 0.01;
export const ALERTA_MAX = 6.99;
export const CRITICA_MAX = 4;

export const BANDAS = [
  { id: 'da', sigla: 'DA', nombre: 'Domina los aprendizajes', rango: '9 – 10', color: '#15803d' },
  { id: 'aa', sigla: 'AA', nombre: 'Alcanza los aprendizajes', rango: '7 – 8,99', color: '#1d4ed8' },
  { id: 'pa', sigla: 'PA', nombre: 'Próximo a alcanzar', rango: '4,01 – 6,99', color: '#d97706' },
  { id: 'na', sigla: 'NA', nombre: 'No alcanza', rango: '0,01 – 4', color: '#dc2626' }
];

const num = v => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

export function enAlerta(p) { const n = num(p); return n !== null && n >= ALERTA_MIN && n <= ALERTA_MAX; }
export function esCritica(p) { const n = num(p); return n !== null && n >= ALERTA_MIN && n <= CRITICA_MAX; }
export function bandaDe(p) {
  const n = num(p); if (n === null || n < ALERTA_MIN) return null;
  return BANDAS.find(b => (b.id === 'da' ? n >= 9 : b.id === 'aa' ? n >= 7 : b.id === 'pa' ? n > 4 : true));
}
export const fmtNota = v => (num(v) === null ? '—' : num(v).toFixed(2).replace('.', ','));

/** Alertas que aplican a la ventana elegida: acumulado del trimestre, una semana o un mes (clave = fecha ISO de inicio). */
export function alertasDeVentana(alertas, modo, clave) {
  return (alertas || []).filter(a => {
    if (modo === 'semana') return enAlerta((a.semanas || []).find(([d]) => d === clave)?.[1]);
    if (modo === 'mes') return enAlerta((a.meses || []).find(([d]) => d === clave)?.[1]);
    return enAlerta(a.parcial);
  });
}
/** Promedio del estudiante en la ventana (para mostrarlo en la tabla). */
export function promedioDeVentana(a, modo, clave) {
  if (modo === 'semana') return num((a.semanas || []).find(([d]) => d === clave)?.[1]);
  if (modo === 'mes') return num((a.meses || []).find(([d]) => d === clave)?.[1]);
  return num(a.parcial);
}

/** Resumen por docente a partir de las cargas y las alertas (acumulado). */
export function resumenPorDocente(cargas, alertas) {
  const mapa = new Map();
  for (const c of cargas || []) {
    const d = mapa.get(c.docente_id) || { docente_id: c.docente_id, docente: c.docente || '—', cargas: 0, sin_notas: 0, estudiantes: 0, evaluados: 0, suma: 0, alertas: 0, criticas: 0, ultima: null };
    d.cargas += 1; d.estudiantes += Number(c.estudiantes || 0);
    const ev = Number(c.evaluados || 0); d.evaluados += ev;
    if (!ev) d.sin_notas += 1;
    if (num(c.promedio) !== null) d.suma += Number(c.promedio) * ev;
    if (c.ultima && (!d.ultima || c.ultima > d.ultima)) d.ultima = c.ultima;
    mapa.set(c.docente_id, d);
  }
  for (const a of alertas || []) {
    const d = mapa.get(a.docente_id); if (!d) continue;
    if (enAlerta(a.parcial)) { d.alertas += 1; if (esCritica(a.parcial)) d.criticas += 1; }
  }
  return [...mapa.values()].map(d => ({ ...d, promedio: d.evaluados ? Math.round((d.suma / d.evaluados) * 100) / 100 : null, pct_alerta: d.evaluados ? Math.round((d.alertas / d.evaluados) * 1000) / 10 : 0 }))
    .sort((a, b) => b.alertas - a.alertas || b.criticas - a.criticas || a.docente.localeCompare(b.docente, 'es'));
}

/** Resumen por curso (grado + paralelo) y por materia, a partir de las cargas. */
function agrupar(cargas, claveDe, etiquetaDe) {
  const mapa = new Map();
  for (const c of cargas || []) {
    const k = claveDe(c); const g = mapa.get(k) || { clave: k, etiqueta: etiquetaDe(c), orden: c.curso_orden ?? 0, evaluados: 0, suma: 0, na: 0, pa: 0, aa: 0, da: 0 };
    const ev = Number(c.evaluados || 0); g.evaluados += ev; if (num(c.promedio) !== null) g.suma += Number(c.promedio) * ev;
    for (const b of ['na', 'pa', 'aa', 'da']) g[b] += Number(c[b] || 0);
    mapa.set(k, g);
  }
  return [...mapa.values()].map(g => ({ ...g, promedio: g.evaluados ? Math.round((g.suma / g.evaluados) * 100) / 100 : null, alertas: g.na + g.pa, pct_alerta: g.evaluados ? Math.round(((g.na + g.pa) / g.evaluados) * 1000) / 10 : 0 }));
}
export const resumenPorCurso = cargas => agrupar(cargas, c => `${c.curso}|${c.paralelo}`, c => `${c.curso} ${c.paralelo}`).sort((a, b) => a.orden - b.orden || a.etiqueta.localeCompare(b.etiqueta, 'es'));
export const resumenPorMateria = cargas => agrupar(cargas, c => c.materia, c => c.materia).sort((a, b) => b.pct_alerta - a.pct_alerta || a.etiqueta.localeCompare(b.etiqueta, 'es'));

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const partes = iso => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return { y, m, d }; };
export function etiquetaSemana(iso) { const { m, d } = partes(iso); return `${d} ${MESES[m - 1]}`; }
export function etiquetaMes(iso) { const { y, m } = partes(iso); return `${MESES[m - 1]} ${String(y).slice(2)}`; }

/** Texto corto para el recordatorio del docente. */
export function textoRecordatorio({ est_alerta_semana = 0, est_alerta_mes = 0, est_alerta = 0 } = {}) {
  if (!est_alerta && !est_alerta_semana && !est_alerta_mes) return 'Sin estudiantes en alerta.';
  const p = [];
  if (est_alerta_semana) p.push(`${est_alerta_semana} esta semana`);
  if (est_alerta_mes) p.push(`${est_alerta_mes} este mes`);
  if (est_alerta) p.push(`${est_alerta} en el trimestre`);
  return p.join(' · ');
}

/**
 * Promedio parcial de una materia a partir de las actividades (misma fórmula que el servidor):
 * promedio de cada grupo → ponderado por el peso del grupo; formativa (ind+grp) pesa 70 %, sumativa (sum, con el proyecto) 30 %.
 * Si solo hay una de las dos se normaliza para no castigar lo que aún no se evaluó.
 */
export function parcialDesdeActividades(acts) {
  const grupos = new Map();
  for (const a of acts || []) {
    if (num(a.valor) === null) continue;
    const k = `${a.tipo}|${a.grupo}`; const g = grupos.get(k) || { tipo: a.tipo, peso: Number(a.peso || 0), suma: 0, n: 0 };
    g.suma += Number(a.valor); g.n += 1; grupos.set(k, g);
  }
  const pond = tipos => { let sw = 0, sp = 0; for (const g of grupos.values()) if (tipos.includes(g.tipo)) { sw += g.peso; sp += (g.suma / g.n) * g.peso; } return sw > 0 ? sp / sw : null; };
  const f = pond(['ind', 'grp']), s = pond(['sum']);
  const den = (f !== null ? 0.7 : 0) + (s !== null ? 0.3 : 0);
  if (!den) return { formativo: null, sumativo: null, parcial: null };
  const trunc2 = x => Math.trunc(x * 100 + 1e-9) / 100;
  return { formativo: f === null ? null : trunc2(f), sumativo: s === null ? null : trunc2(s), parcial: trunc2(((f ?? 0) * 0.7 + (s ?? 0) * 0.3) / den) };
}
