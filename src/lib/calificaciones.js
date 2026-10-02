// Lógica de calificaciones de Bachillerato (BGU). Módulo PURO (sin imports): se
// copia tal cual en server/src/lib/calificaciones.js — mismo patrón que calendario.js.
// Si cambias una fórmula aquí, cámbiala también allá (hay un test que compara ambos).

export const TRIMESTRES = ['T1', 'T2', 'T3'];
export const NOTA_MINIMA_APROBAR = 7;
export const NOTA_MINIMA_PA = 4.01;          // límite inferior de la escala PA (DA/AA/PA/NA)
// Normativa vigente (reforma al Reglamento LOEI de feb-2023 e Instructivo de Evaluación): el supletorio lo rinde
// quien tiene promedio final entre 4.01 y 6.99 en una asignatura (EGB Media, Superior y Bachillerato). Los exámenes
// remedial y de gracia fueron ELIMINADOS desde el año lectivo 2023-2024: quien no aprueba el supletorio reprueba.
export const NOTA_MINIMA_SUPLETORIO = 4.01;

// Modo de aproximación a 2 decimales. El mockup institucional usa TRUNCAR (8.999 -> 8.99).
// Si el reglamento pide redondear, cambiar solo esta constante.
export const MODO_DECIMALES = 'truncar'; // 'truncar' | 'redondear'

export function aDos(x) {
  if (x === null || x === undefined || Number.isNaN(x)) return null;
  // 1e-9 evita errores de coma flotante (0.29*100 = 28.999999...)
  return MODO_DECIMALES === 'truncar'
    ? Math.trunc(x * 100 + 1e-9) / 100
    : Math.round((x + Number.EPSILON) * 100) / 100;
}

// Configuración por defecto (MAQUETA institucional): ind+grp = 70 (formativa), sum = 30 (sumativa)
export function configPorDefecto() {
  return {
    ind: [
      { nombre: 'Lección Oral', n: 3, peso: 5 },
      { nombre: 'Lección Escrita', n: 3, peso: 5 },
      { nombre: 'Tareas', n: 3, peso: 10 },
      { nombre: 'Exposiciones', n: 3, peso: 10 },
      { nombre: 'Investigaciones', n: 3, peso: 2 },
      { nombre: 'Refuerzo', n: 2, peso: 3 }
    ],
    grp: [
      { nombre: 'Talleres', n: 3, peso: 10 },
      { nombre: 'Exposiciones Grupales', n: 3, peso: 10 },
      { nombre: 'Proyectos en Clase', n: 3, peso: 10 },
      { nombre: 'Otros', n: 2, peso: 5 }
    ],
    sum: [
      { nombre: 'Proyecto Interdisciplinar', n: 3, peso: 15 },
      { nombre: 'Evaluación de Trimestre', n: 1, peso: 15 }
    ]
  };
}

export function pesosConfig(cfg) {
  const f = [...cfg.ind, ...cfg.grp].reduce((a, g) => a + Number(g.peso || 0), 0);
  const s = cfg.sum.reduce((a, g) => a + Number(g.peso || 0), 0);
  return { formativo: f, sumativo: s, total: f + s };
}

// Una config es válida si formativo = 70 y sumativo = 30 (total 100)
export function validarConfig(cfg) {
  const errores = [];
  if (!cfg || !Array.isArray(cfg.ind) || !Array.isArray(cfg.grp) || !Array.isArray(cfg.sum)) {
    return ['Configuración incompleta (faltan ind/grp/sum).'];
  }
  for (const tipo of ['ind', 'grp', 'sum']) {
    cfg[tipo].forEach((g, i) => {
      if (!g.nombre) errores.push(`${tipo}[${i}] sin nombre.`);
      if (!Number.isInteger(g.n) || g.n < 1 || g.n > 10) errores.push(`${g.nombre || tipo + i}: n debe ser entero 1-10.`);
      if (!(Number(g.peso) >= 0)) errores.push(`${g.nombre || tipo + i}: peso inválido.`);
    });
  }
  const p = pesosConfig(cfg);
  if (p.formativo !== 70 || p.sumativo !== 30) errores.push(`Pesos deben ser 70 formativo + 30 sumativo (hay ${p.formativo} + ${p.sumativo}).`);
  return errores;
}

const esNum = v => v !== '' && v !== null && v !== undefined && !Number.isNaN(Number(v));

// Promedio de una lista de notas (ignora vacíos). null si no hay ninguna.
export function promGrupo(arr) {
  const vals = (arr || []).filter(esNum).map(Number);
  if (!vals.length) return null;
  return aDos(vals.reduce((a, b) => a + b, 0) / vals.length);
}

/**
 * aportes: { ind: [[...],[...]], grp: [[...]], sum: [[...]] } (un arreglo por grupo de la config)
 * Devuelve { formativo, sumativo, formativo70, sumativo30, nota, completo }
 *  - formativo: promedio PONDERADO de los grupos ind+grp que ya tienen datos
 *  - sumativo: promedio PONDERADO de los grupos sum que ya tienen datos (el mockup ignoraba sus pesos)
 *  - nota: formativo*0.7 + sumativo*0.3. `completo` = hay formativa Y sumativa; solo entonces
 *    la nota es definitiva y se guarda en la tabla calificaciones.
 */
export function calcTrimestre(aportes, cfg = configPorDefecto()) {
  const ponderar = (grupos, valores) => {
    let sw = 0, swp = 0;
    grupos.forEach((g, i) => {
      const pr = promGrupo(valores?.[i]);
      if (pr !== null) { sw += Number(g.peso || 0); swp += pr * Number(g.peso || 0); }
    });
    return sw > 0 ? aDos(swp / sw) : null;
  };
  const formativo = ponderar(
    [...cfg.ind, ...cfg.grp],
    [...cfg.ind.map((_, i) => aportes?.ind?.[i]), ...cfg.grp.map((_, i) => aportes?.grp?.[i])]
  );
  const sumativo = ponderar(cfg.sum, aportes?.sum);
  const formativo70 = formativo !== null ? aDos(formativo * 0.7) : null;
  const sumativo30 = sumativo !== null ? aDos(sumativo * 0.3) : null;
  let nota = null;
  if (formativo70 !== null && sumativo30 !== null) nota = aDos(formativo70 + sumativo30);
  else if (formativo70 !== null) nota = formativo70;
  else if (sumativo30 !== null) nota = sumativo30;
  return { formativo, sumativo, formativo70, sumativo30, nota, completo: formativo70 !== null && sumativo30 !== null };
}

/**
 * Mejora del trimestre (igual que el mockup):
 *  - base entre 7.01 y 8.99 con mejora directa -> (base + mejora)/2 si supera la base
 *  - base menor a 7 con refuerzo + mejora      -> (base + refuerzo + mejora)/3 si supera la base
 */
export function aplicarMejora(base, m = {}) {
  if (base === null || base === undefined) return null;
  if (base > 7 && base < 9 && esNum(m.mejora_directa)) {
    const nuevo = aDos((base + Number(m.mejora_directa)) / 2);
    return nuevo > base ? nuevo : base;
  }
  if (base > 0 && base < 7 && esNum(m.refuerzo) && esNum(m.mejora_refuerzo)) {
    const nuevo = aDos((base + Number(m.refuerzo) + Number(m.mejora_refuerzo)) / 3);
    return nuevo > base ? nuevo : base;
  }
  return base;
}

export function escalaDAAPA(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return { c: 'NE', label: 'No evaluado', cls: 'b-muted' };
  if (n >= 9) return { c: 'DA', label: 'Domina los Aprendizajes', cls: 'b-ok' };
  if (n >= 7) return { c: 'AA', label: 'Alcanza los Aprendizajes', cls: 'b-info' };
  if (n >= NOTA_MINIMA_PA) return { c: 'PA', label: 'Próximo a Alcanzar', cls: 'b-warn' };
  return { c: 'NA', label: 'No Alcanza los Aprendizajes', cls: 'b-err' };
}

/**
 * Promedio anual de una materia. notasTrim = [t1,t2,t3] (notas ya con mejora, null si falta);
 * supletorio = nota del examen supletorio o null.
 * Devuelve { promedio, final, estado } con estado:
 *   'pendiente' (faltan trimestres) | 'aprobado' | 'supletorio' (puede rendirlo, aún sin nota) | 'reprobado'
 * El supletorio solo sube la nota a 7.00 si el estudiante sacó >= 7 (el mockup lo daba por aprobado con cualquier nota).
 * Promedio <= 4.00 reprueba directamente (no hay supletorio, remedial ni gracia).
 */
export function calcAnual(notasTrim, supletorio = null) {
  const vals = (notasTrim || []).filter(n => n !== null && n !== undefined);
  if (!vals.length) return { promedio: null, final: null, estado: 'pendiente' };
  const promedio = aDos(vals.reduce((a, b) => a + b, 0) / vals.length);
  if (vals.length < TRIMESTRES.length) return { promedio, final: promedio, estado: 'pendiente' };
  if (promedio >= NOTA_MINIMA_APROBAR) return { promedio, final: promedio, estado: 'aprobado' };
  if (promedio < NOTA_MINIMA_SUPLETORIO) return { promedio, final: promedio, estado: 'reprobado' };
  if (!esNum(supletorio)) return { promedio, final: promedio, estado: 'supletorio' };
  return Number(supletorio) >= NOTA_MINIMA_APROBAR
    ? { promedio, final: NOTA_MINIMA_APROBAR, estado: 'aprobado' }
    : { promedio, final: promedio, estado: 'reprobado' };
}

/**
 * ¿Este curso usa el sistema de evaluación 70/30 con escala DA/AA/PA/NA y supletorio?
 * Aplica a EGB Superior (8vo, 9no, 10mo) y Bachillerato (1ro–3ro BGU). `grados.nivel` es texto libre en SIGEE
 * ('BGU', 'BACHILLERATO', 'EGB'…), así que se reconoce por el nivel Y por el nombre del curso.
 * Devuelve 'BGU' | 'SUPERIOR' | null.
 */
export function claseNivelEvaluacion(grado) {
  const sinTildes = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const nivel = sinTildes(grado?.nivel);
  const nombre = sinTildes(grado?.nombre);
  if (/\bBGU\b|BACHILLERATO/.test(nivel) || /BACHILLERATO|\bBGU\b/.test(nombre)) return 'BGU';
  if (/SUPERIOR/.test(nivel) || /(^|[^0-9A-Z])(8VO|9NO|10MO|OCTAVO|NOVENO|DECIMO)([^A-Z]|$)/.test(nombre)) return 'SUPERIOR';
  return null;
}
export const usaEvaluacionNumerica = grado => claseNivelEvaluacion(grado) !== null;
