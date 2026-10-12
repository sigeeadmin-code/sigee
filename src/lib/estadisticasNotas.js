// Estadísticas de calificaciones (rector, supervisor, Admin global). Módulo PURO.
// Los datos salen de las vistas v_estadisticas_colegio / v_estadisticas_notas / v_evolucion_trimestres /
// v_notas_finales (todas con security_invoker: la base ya filtra por rol, aquí solo se agrega y se presenta).
// La regla de aprobación es la de calificaciones.js: >=7 aprobado · 4.01–6.99 supletorio · <4.01 reprobado.

export const ESCALAS = [
  { k: 'da', c: 'DA', label: 'Domina los aprendizajes', color: '#16a34a' },
  { k: 'aa', c: 'AA', label: 'Alcanza los aprendizajes', color: '#2563eb' },
  { k: 'pa', c: 'PA', label: 'Próximo a alcanzar', color: '#d97706' },
  { k: 'na', c: 'NA', label: 'No alcanza', color: '#dc2626' }
];
export const ETAPAS = ['EGB Superior', 'BGU'];

const num = v => (v === null || v === undefined || v === '' ? 0 : Number(v));
const r2 = x => Math.round(x * 100) / 100;

/** Registros evaluados (alumno × materia) que representa una fila agregada de las vistas. */
const pesoFila = f => num(f.aprobados) + num(f.supletorio) + num(f.reprobados) + num(f.en_curso);

/** Suma filas agregadas: contadores, promedio ponderado por registros y % de aprobación. */
export function sumar(filas) {
  const t = { registros: 0, aprobados: 0, supletorio: 0, reprobados: 0, en_curso: 0, da: 0, aa: 0, pa: 0, na: 0 };
  let suma = 0, wProm = 0;
  for (const f of filas) {
    const w = pesoFila(f);
    t.registros += w;
    for (const k of ['aprobados', 'supletorio', 'reprobados', 'en_curso', 'da', 'aa', 'pa', 'na']) t[k] += num(f[k]);
    if (f.promedio !== null && f.promedio !== undefined && w > 0) { suma += Number(f.promedio) * w; wProm += w; }
  }
  t.promedio = wProm ? r2(suma / wProm) : null;
  const evaluados = t.aprobados + t.supletorio + t.reprobados;
  t.pctAprobacion = evaluados ? Math.round((1000 * t.aprobados) / evaluados) / 10 : null;
  return t;
}

/** v_estadisticas_colegio (una fila por colegio y etapa) → una fila por colegio. */
export function agruparColegios(filas, etapa = '') {
  const mapa = new Map();
  for (const f of filas) {
    if (etapa && f.etapa !== etapa) continue;
    if (!mapa.has(f.institucion_id)) mapa.set(f.institucion_id, { id: f.institucion_id, nombre: f.institucion, filas: [], estudiantes: 0, paralelos: 0 });
    const g = mapa.get(f.institucion_id);
    g.filas.push(f); g.estudiantes += num(f.estudiantes); g.paralelos += num(f.paralelos);
  }
  return [...mapa.values()].map(({ filas: fs, ...g }) => ({ ...g, ...sumar(fs) }));
}

/** Total de estudiantes distintos de un conjunto de filas de v_estadisticas_notas (máximo por paralelo, sumado). */
function estudiantesDe(filas) {
  const porParalelo = new Map();
  for (const f of filas) porParalelo.set(f.paralelo_id, Math.max(porParalelo.get(f.paralelo_id) || 0, num(f.estudiantes)));
  let n = 0; porParalelo.forEach(v => { n += v; });
  return n;
}

/** v_estadisticas_notas → grupos por una clave (grado, materia, docente…). */
export function agruparDetalle(filas, claveFn, etiquetaFn = claveFn) {
  const mapa = new Map();
  for (const f of filas) {
    const k = claveFn(f);
    if (!mapa.has(k)) mapa.set(k, []);
    mapa.get(k).push(f);
  }
  return [...mapa.entries()].map(([k, fs]) => ({
    clave: k, etiqueta: etiquetaFn(fs[0]), estudiantes: estudiantesDe(fs),
    cargas: new Set(fs.map(f => `${f.paralelo_id}|${f.materia_id}`)).size, ...sumar(fs)
  }));
}

export const porGrado = filas => agruparDetalle(filas, f => f.grado_id, f => f.grado).sort((a, b) => {
  const oa = filas.find(f => f.grado_id === a.clave)?.grado_orden ?? 0;
  const ob = filas.find(f => f.grado_id === b.clave)?.grado_orden ?? 0;
  return oa - ob || String(a.etiqueta).localeCompare(String(b.etiqueta));
});
export const porMateria = filas => agruparDetalle(filas, f => f.materia_id, f => f.materia).sort((a, b) => String(a.etiqueta).localeCompare(String(b.etiqueta)));
export const porDocente = filas => agruparDetalle(filas, f => f.docente_id || 'sin_docente', f => f.docente || 'Sin docente asignado');

/** Porcentajes por escala (para barras apiladas). */
export function porcentajesEscala(t) {
  const total = ESCALAS.reduce((a, e) => a + num(t[e.k]), 0);
  return ESCALAS.map(e => ({ ...e, n: num(t[e.k]), pct: total ? Math.round((1000 * num(t[e.k])) / total) / 10 : 0 }));
}

export const ETIQUETA_ESTADO = { aprobado: 'Aprobado', supletorio: 'Supletorio', reprobado: 'Reprobado', en_curso: 'En curso' };

/** Condición de un alumno-materia de la lista de riesgo (estado final o alerta durante el año). */
export function condicionRiesgo(f) {
  if (f.estado === 'en_curso') return 'En riesgo (promedio < 7)';
  return ETIQUETA_ESTADO[f.estado] || f.estado;
}

export const pctTxt = v => (v === null || v === undefined ? '—' : `${String(v).replace('.', ',')}%`);
export const notaTxt = v => (v === null || v === undefined ? '—' : Number(v).toFixed(2).replace('.', ','));
