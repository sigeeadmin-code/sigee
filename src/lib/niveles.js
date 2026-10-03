// Niveles educativos del sistema ecuatoriano, años de cada nivel y plan de materias sugerido por defecto.
// Módulo puro. `grados.nivel` es texto libre en SIGEE (hay 'BGU', 'BACHILLERATO', 'EGB'…): aquí se normaliza.

export const NIVELES = ['INICIAL', 'PREPARATORIA', 'ELEMENTAL', 'MEDIA', 'SUPERIOR', 'BACHILLERATO'];

export const NIVEL_LABEL = {
  INICIAL: 'Educación Inicial', PREPARATORIA: 'Preparatoria', ELEMENTAL: 'Elemental',
  MEDIA: 'Media', SUPERIOR: 'Superior', BACHILLERATO: 'Bachillerato'
};

export const ANIOS_NIVEL = {
  INICIAL: ['Inicial 1', 'Inicial 2'],
  PREPARATORIA: ['1er Año EGB'],
  ELEMENTAL: ['2do Año EGB', '3er Año EGB', '4to Año EGB'],
  MEDIA: ['5to Año EGB', '6to Año EGB', '7mo Año EGB'],
  SUPERIOR: ['8vo EGB', '9no EGB', '10mo EGB'],
  BACHILLERATO: ['1ro Bachillerato', '2do Bachillerato', '3ro Bachillerato']
};

const BASICAS = ['Lengua y Literatura', 'Matemática', 'Ciencias Naturales', 'Estudios Sociales', 'Inglés', 'Educación Física', 'Educación Cultural y Artística'];
export const ASIGNATURAS_NIVEL = {
  INICIAL: ['Expresión Artística', 'Comprensión del Lenguaje', 'Identidad y Autonomía', 'Convivencia', 'Relación con el Medio Natural', 'Relación Lógico-Matemática', 'Motricidad'],
  PREPARATORIA: [...BASICAS],
  ELEMENTAL: [...BASICAS],
  MEDIA: [...BASICAS],
  SUPERIOR: [...BASICAS],
  BACHILLERATO: ['Lengua y Literatura', 'Matemática', 'Física', 'Química', 'Biología', 'Historia', 'Filosofía', 'Educación para la Ciudadanía', 'Inglés', 'Educación Física', 'Educación Cultural y Artística', 'Emprendimiento y Gestión']
};

export const sinTildes = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
export const clave = t => sinTildes(t).replace(/\s+/g, ' ');

/**
 * Nivel canónico de un curso a partir de su texto libre `nivel` y de su nombre. Devuelve uno de NIVELES o null.
 * Primero manda el campo nivel; si no alcanza, se deduce por el nombre ("8vo EGB", "Inicial 2", "1ro Bachillerato"…).
 */
export function nivelCanonico(grado) {
  const nivel = sinTildes(grado?.nivel);
  const nombre = sinTildes(grado?.nombre);
  if (NIVELES.includes(nivel)) return nivel;
  if (/\bBGU\b|BACHILLERATO/.test(nivel) || /BACHILLERATO|\bBGU\b/.test(nombre)) return 'BACHILLERATO';
  if (/INICIAL/.test(nivel) || /INICIAL/.test(nombre)) return 'INICIAL';
  if (/PREPARATORIA/.test(nivel) || /PREPARATORIA/.test(nombre)) return 'PREPARATORIA';
  if (/ELEMENTAL/.test(nivel)) return 'ELEMENTAL';
  if (/MEDIA/.test(nivel)) return 'MEDIA';
  if (/SUPERIOR/.test(nivel)) return 'SUPERIOR';
  // por el nombre del año (solo EGB: el Bachillerato ya se resolvió arriba)
  const m = nombre.match(/(^|[^0-9A-Z])(\d{1,2})\s*(RO|ER|DO|TO|MO|VO|NO|ER)?\b/);
  const palabras = { PRIMERO: 1, SEGUNDO: 2, TERCERO: 3, CUARTO: 4, QUINTO: 5, SEXTO: 6, SEPTIMO: 7, OCTAVO: 8, NOVENO: 9, DECIMO: 10 };
  let n = null;
  for (const [w, v] of Object.entries(palabras)) if (new RegExp(`\\b${w}\\b`).test(nombre)) n = v;
  if (n === null && m) n = Number(m[2]);
  if (n === null) return null;
  if (n === 1) return 'PREPARATORIA';
  if (n >= 2 && n <= 4) return 'ELEMENTAL';
  if (n >= 5 && n <= 7) return 'MEDIA';
  if (n >= 8 && n <= 10) return 'SUPERIOR';
  return null;
}

/** Combina lo guardado por la institución con los valores por defecto: si un nivel no tiene filas, se usa el plan por defecto. */
export function combinarCatalogo(filas) {
  const out = {};
  for (const niv of NIVELES) {
    const propias = (filas || []).filter(f => f.nivel === niv).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)).map(f => f.nombre);
    out[niv] = { nombres: propias.length ? propias : [...ASIGNATURAS_NIVEL[niv]], personalizado: propias.length > 0 };
  }
  return out;
}

/** Ordena materias según el catálogo del nivel (las que no están en él van al final, en su orden original). */
export function ordenarPorCatalogo(items, nombres, getNombre = x => x.materiaNombre || x.nombre) {
  const pos = new Map((nombres || []).map((n, i) => [clave(n), i]));
  return items.map((x, i) => ({ x, i, p: pos.has(clave(getNombre(x))) ? pos.get(clave(getNombre(x))) : 1e6 }))
    .sort((a, b) => a.p - b.p || a.i - b.i).map(o => o.x);
}
