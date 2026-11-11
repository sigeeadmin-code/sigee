// Estadística del plantel: matriz por curso/paralelo (género, edad, discapacidad, nacionalidad, jornada).
// Módulo puro: sin Supabase.

export const RANGOS_EDAD = [
  { id: '0-5', label: '0–5', min: 0, max: 5 },
  { id: '6-8', label: '6–8', min: 6, max: 8 },
  { id: '9-11', label: '9–11', min: 9, max: 11 },
  { id: '12-14', label: '12–14', min: 12, max: 14 },
  { id: '15-17', label: '15–17', min: 15, max: 17 },
  { id: '18+', label: '18+', min: 18, max: 120 },
];

export function edadDe(fechaNacimiento, ref = new Date()) {
  if (!fechaNacimiento) return null;
  const nac = new Date(String(fechaNacimiento).slice(0, 10) + 'T00:00:00');
  if (Number.isNaN(nac.getTime())) return null;
  let edad = ref.getFullYear() - nac.getFullYear();
  const m = ref.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < nac.getDate())) edad -= 1;
  return edad >= 0 ? edad : null;
}

export function rangoEdad(edad) {
  if (edad == null) return 'Sin dato';
  const r = RANGOS_EDAD.find(x => edad >= x.min && edad <= x.max);
  return r ? r.label : 'Sin dato';
}

export function generoNorm(g) {
  const s = String(g || '').trim().toLowerCase();
  if (s === 'masculino' || s === 'hombre' || s === 'h' || (s.startsWith('m') && !s.includes('uj') && s !== 'm')) return 'H';
  if (s === 'femenino' || s === 'mujer' || s === 'f' || s.includes('muj')) return 'M';
  if (s === 'm') return 'M';
  return 'S';
}

export function matrizPorParalelo(filas) {
  const map = new Map();
  for (const f of filas) {
    const curso = f.curso || '—';
    const paralelo = f.paralelo || '—';
    const jornada = f.jornada || 'Sin jornada';
    const key = `${curso}||${paralelo}||${jornada}`;
    if (!map.has(key)) {
      map.set(key, {
        curso, paralelo, jornada,
        total: 0, H: 0, M: 0, S: 0,
        conDiscapacidad: 0,
        edades: {},
        nacionalidades: {},
        discapacidades: {},
      });
    }
    const row = map.get(key);
    row.total += 1;
    const g = generoNorm(f.genero);
    row[g] += 1;
    const edad = edadDe(f.fecha_nacimiento);
    const re = rangoEdad(edad);
    row.edades[re] = (row.edades[re] || 0) + 1;
    const nac = (f.nacionalidad || '').trim() || 'Sin dato';
    row.nacionalidades[nac] = (row.nacionalidades[nac] || 0) + 1;
    const disc = (f.discapacidad || '').trim() || 'Sin dato';
    if (disc && disc !== 'Ninguna' && disc !== 'Sin dato') {
      row.conDiscapacidad += 1;
      row.discapacidades[disc] = (row.discapacidades[disc] || 0) + 1;
    } else {
      const k = disc === 'Ninguna' ? 'Ninguna' : 'Sin dato';
      row.discapacidades[k] = (row.discapacidades[k] || 0) + 1;
    }
  }
  return [...map.values()].sort((a, b) =>
    a.curso.localeCompare(b.curso, 'es') || a.paralelo.localeCompare(b.paralelo, 'es')
  );
}

export function resumenPorJornada(matriz) {
  const m = new Map();
  for (const r of matriz) {
    const j = r.jornada || 'Sin jornada';
    if (!m.has(j)) m.set(j, { jornada: j, total: 0, H: 0, M: 0, S: 0, conDiscapacidad: 0 });
    const t = m.get(j);
    t.total += r.total; t.H += r.H; t.M += r.M; t.S += r.S; t.conDiscapacidad += r.conDiscapacidad;
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}

export function resumenPorNivel(matriz, nivelDeCursoFn) {
  const m = new Map();
  for (const r of matriz) {
    const nivel = nivelDeCursoFn(r.curso) || 'Otro';
    if (!m.has(nivel)) m.set(nivel, { nivel, total: 0, H: 0, M: 0, S: 0, conDiscapacidad: 0 });
    const t = m.get(nivel);
    t.total += r.total; t.H += r.H; t.M += r.M; t.S += r.S; t.conDiscapacidad += r.conDiscapacidad;
  }
  return [...m.values()];
}

export function nivelDeCurso(nombre) {
  const s = String(nombre || '').toLowerCase();
  if (/inicial|preparatoria/.test(s)) return 'Inicial';
  if (/bachiller|bgu|1ro b|2do b|3ro b|1° b|2° b|3° b/.test(s)) return 'Bachillerato';
  const n = parseInt((s.match(/(\d+)/) || [])[1], 10);
  if (n >= 1 && n <= 4) return 'Básica elemental';
  if (n >= 5 && n <= 7) return 'Básica media';
  if (n >= 8 && n <= 10) return 'Básica superior';
  return 'Otro';
}

export function totalesMatriz(matriz) {
  return matriz.reduce((a, r) => ({
    total: a.total + r.total,
    H: a.H + r.H,
    M: a.M + r.M,
    S: a.S + r.S,
    conDiscapacidad: a.conDiscapacidad + r.conDiscapacidad,
  }), { total: 0, H: 0, M: 0, S: 0, conDiscapacidad: 0 });
}

export const NACIONALIDADES_COMUNES = [
  'Ecuatoriana', 'Colombiana', 'Peruana', 'Venezolana', 'Cubana',
  'Española', 'Estadounidense', 'China', 'Otra',
];
