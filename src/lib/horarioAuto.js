// Jornada (franjas y recreos) y generador automático de horarios. Módulo PURO, sin imports.
// Las franjas se guardan como texto "HH:MM–HH:MM" (guion largo), igual que los bloques ya existentes.

export const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

const dos = n => String(n).padStart(2, '0');
const hhmm = min => `${dos(Math.floor(min / 60))}:${dos(min % 60)}`;
const aMin = s => { const [h, m] = String(s).split(':').map(Number); return h * 60 + m; };
export const etiquetaFranja = (ini, fin) => `${ini}–${fin}`;

/**
 * Construye la jornada: `clases` períodos de `duracion` minutos desde `inicio`; después de la clase N
 * se intercala cada recreo con despuesDe === N (se pueden poner varios recreos, en los horarios que se elijan).
 * Devuelve [{ inicio, fin, tipo: 'clase' | 'recreo', label }]
 */
export function construirFranjas({ inicio = '07:00', duracion = 40, clases = 7, recreos = [] }) {
  const errores = validarJornada({ inicio, duracion, clases, recreos });
  if (errores.length) throw new Error(errores.join(' '));
  const out = [];
  let t = aMin(inicio);
  for (let i = 1; i <= clases; i++) {
    out.push({ inicio: hhmm(t), fin: hhmm(t + duracion), tipo: 'clase', label: etiquetaFranja(hhmm(t), hhmm(t + duracion)) });
    t += duracion;
    if (i < clases) {
      recreos.filter(r => Number(r.despuesDe) === i).forEach(r => {
        out.push({ inicio: hhmm(t), fin: hhmm(t + Number(r.minutos)), tipo: 'recreo', label: etiquetaFranja(hhmm(t), hhmm(t + Number(r.minutos))) });
        t += Number(r.minutos);
      });
    }
  }
  return out;
}

export function validarJornada({ inicio, duracion, clases, recreos = [] }) {
  const e = [];
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(inicio))) e.push('La hora de inicio debe ser HH:MM (ej. 07:00).');
  if (!Number.isInteger(Number(duracion)) || duracion < 20 || duracion > 120) e.push('La duración de cada clase debe estar entre 20 y 120 minutos.');
  if (!Number.isInteger(Number(clases)) || clases < 1 || clases > 12) e.push('La cantidad de clases debe estar entre 1 y 12.');
  recreos.forEach((r, i) => {
    if (!Number.isInteger(Number(r.despuesDe)) || r.despuesDe < 1 || r.despuesDe >= clases) e.push(`Recreo ${i + 1}: debe ir después de una clase entre 1 y ${Math.max(1, clases - 1)}.`);
    if (!Number.isInteger(Number(r.minutos)) || r.minutos < 5 || r.minutos > 60) e.push(`Recreo ${i + 1}: la duración debe estar entre 5 y 60 minutos.`);
  });
  const pos = recreos.map(r => Number(r.despuesDe));
  if (new Set(pos).size !== pos.length) e.push('Hay dos recreos en el mismo lugar; deja uno por posición.');
  if (!e.length) {
    const total = aMin(inicio) + clases * duracion + recreos.reduce((a, r) => a + Number(r.minutos), 0);
    if (total > 23 * 60 + 59) e.push('La jornada se pasa de la medianoche.');
  }
  return e;
}

// Jornada por defecto: 7 clases de 40 min desde 07:00 con recreo de 20 min tras la tercera.
// Las 7 etiquetas de clase coinciden EXACTAMENTE con las que ya usan los horarios guardados.
export const FRANJAS_DEFAULT = construirFranjas({ inicio: '07:00', duracion: 40, clases: 7, recreos: [{ despuesDe: 3, minutos: 20 }] });

/** Acepta lo guardado en BD y devuelve franjas válidas; si algo no cuadra, cae a la jornada por defecto. */
export function normalizarFranjas(guardadas) {
  if (!Array.isArray(guardadas) || !guardadas.length) return FRANJAS_DEFAULT;
  const out = [];
  for (const f of guardadas) {
    if (!f || !/^\d\d:\d\d$/.test(f.inicio || '') || !/^\d\d:\d\d$/.test(f.fin || '') || !['clase', 'recreo'].includes(f.tipo)) return FRANJAS_DEFAULT;
    out.push({ inicio: f.inicio, fin: f.fin, tipo: f.tipo, label: etiquetaFranja(f.inicio, f.fin) });
  }
  return out.some(f => f.tipo === 'clase') ? out : FRANJAS_DEFAULT;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Genera una PROPUESTA de horario (no guarda nada).
 *  franjas: etiquetas de las franjas de CLASE, en orden (los recreos no entran)
 *  paralelos: [{ id, cargas: [{ id, docenteId|null, horas }] }]   ← los que se van a generar
 *  fijos: [{ paralelo_id, docente_materia_id, dia, franja }]       ← clases ya asignadas que se conservan
 *  ocupadosDocente: [{ docenteId, dia, franja }]                   ← clases de OTROS paralelos (fuera del alcance)
 * Reglas duras: un solo bloque por paralelo/día/franja; un docente nunca en dos paralelos a la misma hora.
 * Preferencias: repartir cada materia en distintos días, equilibrar la carga diaria y, si una materia
 * repite en el mismo día, que sean clases seguidas.
 */
export function generarHorario({ dias = DIAS, franjas, paralelos, fijos = [], ocupadosDocente = [], seed = 1, intentos = 30 }) {
  const idxFranja = Object.fromEntries(franjas.map((f, i) => [f, i]));
  const docDeCarga = {};
  paralelos.forEach(p => p.cargas.forEach(c => { docDeCarga[c.id] = c.docenteId || null; }));

  let mejor = null;
  const rnd = mulberry32(seed);

  for (let intento = 0; intento < intentos; intento++) {
    const ocupDoc = new Set(ocupadosDocente.filter(o => o.docenteId).map(o => `${o.docenteId}|${o.dia}|${o.franja}`));
    const usado = new Map(paralelos.map(p => [p.id, new Set()]));
    const porDia = new Map(paralelos.map(p => [p.id, Object.fromEntries(dias.map(d => [d, 0]))]));
    const cargaDia = {};     // cargaId -> { dia: [idxFranja,...] }
    const falta = {};        // cargaId -> horas por colocar
    const nuevos = [];
    let penalidad = 0;

    const registrar = (parId, cargaId, dia, franja) => {
      usado.get(parId).add(`${dia}|${franja}`);
      porDia.get(parId)[dia]++;
      ((cargaDia[cargaId] ||= {})[dia] ||= []).push(idxFranja[franja]);
      const doc = docDeCarga[cargaId];
      if (doc) ocupDoc.add(`${doc}|${dia}|${franja}`);
    };

    // lo ya asignado que se conserva
    fijos.forEach(f => { if (usado.has(f.paralelo_id)) registrar(f.paralelo_id, f.docente_materia_id, f.dia, f.franja); });
    paralelos.forEach(p => p.cargas.forEach(c => {
      const yaFijas = fijos.filter(f => f.docente_materia_id === c.id).length;
      falta[c.id] = Math.max(0, (Number(c.horas) || 0) - yaFijas);
    }));

    const orden = arr => arr.map(x => [rnd(), x]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    let progreso = true;
    while (progreso) {                                   // una hora por materia en cada ronda: reparte mejor
      progreso = false;
      for (const p of orden(paralelos)) {
        for (const c of orden(p.cargas)) {
          if (!(falta[c.id] > 0)) continue;
          let elegido = null, mejorScore = Infinity;
          for (const dia of dias) {
            const delDia = (cargaDia[c.id] || {})[dia] || [];
            for (let fi = 0; fi < franjas.length; fi++) {
              const fr = franjas[fi];
              if (usado.get(p.id).has(`${dia}|${fr}`)) continue;
              if (c.docenteId && ocupDoc.has(`${c.docenteId}|${dia}|${fr}`)) continue;
              let score = delDia.length * 12 + (delDia.length >= 2 ? 30 : 0) + porDia.get(p.id)[dia] * 1.5 + rnd() * 3;
              if (delDia.length && delDia.some(x => Math.abs(x - fi) === 1)) score -= 6;
              if (score < mejorScore) { mejorScore = score; elegido = { dia, fr }; }
            }
          }
          if (!elegido) continue;                        // sin hueco: quedará como faltante
          registrar(p.id, c.id, elegido.dia, elegido.fr);
          nuevos.push({ paralelo_id: p.id, docente_materia_id: c.id, dia: elegido.dia, franja: elegido.fr });
          penalidad += mejorScore;
          falta[c.id]--;
          progreso = true;
        }
      }
    }
    // lo que no se pudo colocar en esta ronda
    let sinColocar = 0;
    const faltantes = [];
    paralelos.forEach(p => p.cargas.forEach(c => {
      if (falta[c.id] > 0) { sinColocar += falta[c.id]; faltantes.push({ paraleloId: p.id, cargaId: c.id, faltan: falta[c.id] }); }
    }));
    if (!mejor || sinColocar < mejor.sinColocar || (sinColocar === mejor.sinColocar && penalidad < mejor.penalidad)) {
      mejor = { bloques: nuevos, faltantes, sinColocar, penalidad };
    }
    if (sinColocar === 0 && intento >= 4 && penalidad < 1) break;
  }
  return { bloques: mejor.bloques, faltantes: mejor.faltantes };
}

/**
 * Mueve (o intercambia) una clase DENTRO de una propuesta, sin tocar nada guardado.
 *  bloques: clases propuestas, movibles   [{ paralelo_id, docente_materia_id, dia, franja }]
 *  fijos:   clases ya guardadas que se conservan (bloqueadas)
 *  ocupadosFuera: [{ docenteId, dia, franja }] clases de paralelos fuera del alcance
 *  docDeCarga: { cargaId: docenteId|null }
 * Devuelve { ok, bloques, tipo: 'movido'|'intercambiado'|'sin_cambios', motivo }
 */
export function moverEnPropuesta({ bloques, fijos = [], ocupadosFuera = [], docDeCarga, paraleloId, desde, hacia }) {
  const igual = (b, c) => b.paralelo_id === paraleloId && b.dia === c.dia && b.franja === c.franja;
  const A = bloques.find(b => igual(b, desde));
  if (!A) {
    return { ok: false, bloques, motivo: fijos.some(f => igual(f, desde)) ? 'Esa clase ya estaba guardada y está bloqueada en la propuesta.' : 'No hay una clase en la celda de origen.' };
  }
  if (desde.dia === hacia.dia && desde.franja === hacia.franja) return { ok: true, bloques, tipo: 'sin_cambios' };
  if (fijos.some(f => igual(f, hacia))) return { ok: false, bloques, motivo: 'Esa celda tiene una clase ya guardada que se conserva.' };
  const B = bloques.find(b => igual(b, hacia)) || null;

  // quién está ocupado y cuándo, SIN contar las clases que se están moviendo
  const ocup = new Set(ocupadosFuera.filter(o => o.docenteId).map(o => `${o.docenteId}|${o.dia}|${o.franja}`));
  fijos.forEach(f => { const d = docDeCarga[f.docente_materia_id]; if (d) ocup.add(`${d}|${f.dia}|${f.franja}`); });
  bloques.forEach(b => { if (b === A || b === B) return; const d = docDeCarga[b.docente_materia_id]; if (d) ocup.add(`${d}|${b.dia}|${b.franja}`); });

  const docA = docDeCarga[A.docente_materia_id];
  if (docA && ocup.has(`${docA}|${hacia.dia}|${hacia.franja}`)) {
    return { ok: false, bloques, motivo: 'El docente de esa materia ya tiene clase a esa hora en otro paralelo.' };
  }
  if (B) {
    const docB = docDeCarga[B.docente_materia_id];
    if (docB && ocup.has(`${docB}|${desde.dia}|${desde.franja}`)) {
      return { ok: false, bloques, motivo: 'El docente de la otra materia ya tiene clase a la hora de origen en otro paralelo.' };
    }
  }
  const nuevos = bloques.map(b => {
    if (b === A) return { ...b, dia: hacia.dia, franja: hacia.franja };
    if (B && b === B) return { ...b, dia: desde.dia, franja: desde.franja };
    return b;
  });
  return { ok: true, bloques: nuevos, tipo: B ? 'intercambiado' : 'movido' };
}

/** Celdas (dia|franja) a las que la clase de `desde` puede ir — para resaltarlas mientras se arrastra. */
export function destinosValidos({ bloques, fijos = [], ocupadosFuera = [], docDeCarga, paraleloId, desde, franjas, dias = DIAS }) {
  const ok = new Set();
  for (const dia of dias) {
    for (const franja of franjas) {
      if (dia === desde.dia && franja === desde.franja) continue;
      const r = moverEnPropuesta({ bloques, fijos, ocupadosFuera, docDeCarga, paraleloId, desde, hacia: { dia, franja } });
      if (r.ok) ok.add(`${dia}|${franja}`);
    }
  }
  return ok;
}
