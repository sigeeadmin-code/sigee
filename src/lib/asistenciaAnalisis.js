// Análisis de asistencia: clasificación de riesgo, faltas consecutivas y cobertura de registro.
// Módulo PURO (sin Supabase ni navegador). Las fechas viajan como texto 'AAAA-MM-DD'.
//
// Reglas (se cuentan DÍAS, no horas de clase):
//  · Un día es "falta" (injustificada) si el estudiante tiene al menos un registro 'ausente' ese día;
//    es "justificada" si solo tiene ausencias justificadas; "atraso" si solo tiene atrasos.
//  · El % de asistencia no se penaliza por días justificados (igual que el resto del sistema).
//  · La clasificación mira el % de faltas injustificadas sobre los días con registro.

export const UMBRALES_DEFECTO = { excelente: 2, buena: 5, riesgo: 10 };   // % de faltas injustificadas
export const CLASES = ['excelente', 'buena', 'en_riesgo', 'critica'];
export const ETIQUETA_CLASE = { excelente: 'Excelente', buena: 'Buena', en_riesgo: 'En riesgo', critica: 'Crítica', sin_datos: 'Sin datos' };
export const RACHA_ALERTA = 3;   // faltas consecutivas que disparan alerta

const redondear1 = n => Math.round(n * 10) / 10;

export function clasificar(pctFaltas, dias, umbrales = UMBRALES_DEFECTO) {
  if (!dias || pctFaltas === null || pctFaltas === undefined) return 'sin_datos';
  if (pctFaltas <= umbrales.excelente) return 'excelente';
  if (pctFaltas <= umbrales.buena) return 'buena';
  if (pctFaltas <= umbrales.riesgo) return 'en_riesgo';
  return 'critica';
}

export function umbralesValidos(u) {
  const { excelente, buena, riesgo } = u || {};
  return [excelente, buena, riesgo].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100) && excelente <= buena && buena <= riesgo;
}

/** Estado de un día a partir de los estados de todos sus registros (varias materias el mismo día). */
export function estadoDia(estados) {
  if (estados.includes('ausente')) return 'falta';
  if (estados.includes('justificado')) return 'justificada';
  if (estados.includes('atraso')) return 'atraso';
  return 'presente';
}

const dia = f => new Date(f + 'T12:00:00Z');
export const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const diaSemana = f => DIAS_SEMANA[dia(f).getUTCDay()];

/**
 * registros: [{ fecha, estado }] de UN estudiante · fechasCurso: fechas en que se tomó asistencia en su curso.
 * Devuelve conteos de días, porcentajes, la racha de faltas y las fechas de falta.
 */
export function analizarAlumno(registros, fechasCurso, umbrales = UMBRALES_DEFECTO) {
  const porFecha = new Map();
  for (const r of registros) {
    if (!porFecha.has(r.fecha)) porFecha.set(r.fecha, []);
    porFecha.get(r.fecha).push(r.estado);
  }
  const calendario = [...new Set([...(fechasCurso || []), ...porFecha.keys()])].sort();
  const estados = new Map([...porFecha].map(([f, e]) => [f, estadoDia(e)]));

  let presentes = 0, atrasos = 0, faltas = 0, justificadas = 0;
  const fechasFaltas = [];
  for (const f of [...estados.keys()].sort()) {
    const e = estados.get(f);
    if (e === 'presente') presentes++;
    else if (e === 'atraso') atrasos++;
    else if (e === 'falta') { faltas++; fechasFaltas.push({ fecha: f, tipo: 'injustificada' }); }
    else { justificadas++; fechasFaltas.push({ fecha: f, tipo: 'justificada' }); }
  }
  const dias = presentes + atrasos + faltas + justificadas;
  const contable = dias - justificadas;

  // racha de faltas injustificadas seguidas, sobre los días en que el curso tomó asistencia
  let max = 0, maxIni = null, maxFin = null, actual = 0, ini = null, ultimo = null;
  for (const f of calendario) {
    if (estados.get(f) === 'falta') {
      if (actual === 0) ini = f;
      actual++; ultimo = f;
      if (actual > max) { max = actual; maxIni = ini; maxFin = ultimo; }
    } else actual = 0;
  }
  const pctFaltas = dias ? redondear1((faltas / dias) * 100) : null;
  return {
    dias, presentes, atrasos, faltas, justificadas, fechasFaltas,
    pctAsistencia: contable > 0 ? redondear1(((presentes + atrasos) / contable) * 100) : null,
    pctFaltas,
    rachaMax: max, rachaIni: maxIni, rachaFin: maxFin,
    rachaActual: actual,                       // faltas seguidas que siguen vigentes al último día registrado
    clase: clasificar(pctFaltas, dias, umbrales)
  };
}

/**
 * alumnos: [{ id, nombre, cedula, curso, paraleloId, ... }] · registros: [{ estudiante_id, fecha, estado }]
 * Devuelve una fila por estudiante ya analizada, ordenada de peor a mejor situación.
 */
export function analizarEstudiantes(alumnos, registros, umbrales = UMBRALES_DEFECTO) {
  const porAlumno = new Map();
  const fechasPorCurso = new Map();
  const cursoDe = new Map(alumnos.map(a => [a.id, a.paraleloId || a.curso]));
  for (const r of registros) {
    if (!porAlumno.has(r.estudiante_id)) porAlumno.set(r.estudiante_id, []);
    porAlumno.get(r.estudiante_id).push(r);
    const c = cursoDe.get(r.estudiante_id);
    if (c === undefined) continue;
    if (!fechasPorCurso.has(c)) fechasPorCurso.set(c, new Set());
    fechasPorCurso.get(c).add(r.fecha);
  }
  const orden = { critica: 0, en_riesgo: 1, buena: 2, excelente: 3, sin_datos: 4 };
  return alumnos.map(a => ({
    ...a,
    ...analizarAlumno(porAlumno.get(a.id) || [], [...(fechasPorCurso.get(a.paraleloId || a.curso) || [])], umbrales)
  })).sort((x, y) => (orden[x.clase] - orden[y.clase]) || (y.faltas - x.faltas) || String(x.nombre).localeCompare(String(y.nombre)));
}

// ───────────── días hábiles y cobertura de registro ─────────────
const NO_LECTIVO = /feriad|vacac|receso|recess|suspens|no.?lectiv/i;

/** Días lunes a viernes entre dos fechas (incluidas), sin los de eventos no lectivos del calendario. */
export function diasHabiles(desde, hasta, eventos = []) {
  const bloqueados = new Set();
  for (const e of eventos) {
    if (!NO_LECTIVO.test(e.tipo || '')) continue;
    const fin = e.fecha_fin || e.fecha_inicio;
    for (let d = dia(e.fecha_inicio); d <= dia(fin); d = new Date(d.getTime() + 86400000)) bloqueados.add(d.toISOString().slice(0, 10));
  }
  const out = [];
  if (!desde || !hasta || desde > hasta) return out;
  for (let d = dia(desde); d <= dia(hasta); d = new Date(d.getTime() + 86400000)) {
    const w = d.getUTCDay();
    const f = d.toISOString().slice(0, 10);
    if (w !== 0 && w !== 6 && !bloqueados.has(f)) out.push(f);
  }
  return out;
}

/**
 * Cobertura de registro por curso: de los días hábiles del período, en cuántos se tomó asistencia.
 * Sin esto el % de asistencia solo refleja lo registrado, y un curso donde no se toma lista no se nota.
 */
export function coberturaPorCurso(alumnos, registros, habiles) {
  const cursoDe = new Map(alumnos.map(a => [a.id, a.paraleloId || a.curso]));
  const nombreDe = new Map(alumnos.map(a => [a.paraleloId || a.curso, a.curso]));
  const total = new Map();
  for (const a of alumnos) { const c = a.paraleloId || a.curso; total.set(c, (total.get(c) || 0) + 1); }
  const fechas = new Map();
  const permitidas = new Set(habiles);
  for (const r of registros) {
    const c = cursoDe.get(r.estudiante_id);
    if (c === undefined || !permitidas.has(r.fecha)) continue;
    if (!fechas.has(c)) fechas.set(c, new Set());
    fechas.get(c).add(r.fecha);
  }
  return [...total.keys()].map(c => {
    const conRegistro = fechas.get(c)?.size || 0;
    const sinRegistro = habiles.filter(f => !fechas.get(c)?.has(f));
    return {
      curso: nombreDe.get(c), cursoId: c, estudiantes: total.get(c), diasHabiles: habiles.length,
      diasConRegistro: conRegistro, pctCobertura: habiles.length ? redondear1((conRegistro / habiles.length) * 100) : null,
      ultimosSinRegistro: sinRegistro.slice(-5)
    };
  }).sort((a, b) => (a.pctCobertura ?? 101) - (b.pctCobertura ?? 101) || String(a.curso).localeCompare(String(b.curso)));
}

/** Totales por curso a partir de las filas ya analizadas. */
export function resumenPorCurso(filas) {
  const m = new Map();
  for (const f of filas) {
    const k = f.paraleloId || f.curso;
    if (!m.has(k)) m.set(k, { curso: f.curso, estudiantes: 0, presentes: 0, atrasos: 0, faltas: 0, justificadas: 0, criticos: 0, enRiesgo: 0, conRacha: 0 });
    const c = m.get(k);
    c.estudiantes++; c.presentes += f.presentes; c.atrasos += f.atrasos; c.faltas += f.faltas; c.justificadas += f.justificadas;
    if (f.clase === 'critica') c.criticos++;
    if (f.clase === 'en_riesgo') c.enRiesgo++;
    if (f.rachaMax >= RACHA_ALERTA) c.conRacha++;
  }
  return [...m.values()].map(c => {
    const contable = c.presentes + c.atrasos + c.faltas;
    return { ...c, pctAsistencia: contable ? redondear1(((c.presentes + c.atrasos) / contable) * 100) : null };
  }).sort((a, b) => (a.pctAsistencia ?? 101) - (b.pctAsistencia ?? 101));
}

export function totalesGenerales(filas, cobertura) {
  const t = filas.reduce((a, f) => ({
    presentes: a.presentes + f.presentes, atrasos: a.atrasos + f.atrasos, faltas: a.faltas + f.faltas, justificadas: a.justificadas + f.justificadas,
    criticos: a.criticos + (f.clase === 'critica' ? 1 : 0), enRiesgo: a.enRiesgo + (f.clase === 'en_riesgo' ? 1 : 0),
    conRacha: a.conRacha + (f.rachaMax >= RACHA_ALERTA ? 1 : 0), rachaMax: Math.max(a.rachaMax, f.rachaMax)
  }), { presentes: 0, atrasos: 0, faltas: 0, justificadas: 0, criticos: 0, enRiesgo: 0, conRacha: 0, rachaMax: 0 });
  const contable = t.presentes + t.atrasos + t.faltas;
  const diasHab = cobertura.length ? cobertura[0].diasHabiles : 0;
  const conReg = cobertura.reduce((s, c) => s + c.diasConRegistro, 0);
  return {
    ...t, estudiantes: filas.length,
    pctAsistencia: contable ? redondear1(((t.presentes + t.atrasos) / contable) * 100) : null,
    pctCobertura: cobertura.length && diasHab ? redondear1((conReg / (diasHab * cobertura.length)) * 100) : null,
    cursosSinRegistro: cobertura.filter(c => c.diasConRegistro === 0).length
  };
}

// ───────────── períodos ─────────────
export const ymd = d => d.toISOString().slice(0, 10);
export function rangoPeriodo(clave, hoy = new Date()) {
  const h = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 12));
  const hasta = ymd(h);
  if (clave === 'semana') { const d = new Date(h); d.setUTCDate(d.getUTCDate() - 6); return { desde: ymd(d), hasta }; }
  if (clave === 'mes') return { desde: ymd(new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth(), 1, 12))), hasta };
  if (clave === 'mes_anterior') {
    const ini = new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth() - 1, 1, 12));
    const fin = new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth(), 0, 12));
    return { desde: ymd(ini), hasta: ymd(fin) };
  }
  return { desde: ymd(new Date(Date.UTC(h.getUTCFullYear() - 1, 0, 1, 12))), hasta };   // 'todo': hasta 1 año atrás (cubre el año lectivo)
}
