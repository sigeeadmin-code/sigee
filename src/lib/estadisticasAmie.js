// Estadísticas AMIE de la Zona 7 (catálogo de planteles). Módulo PURO: sin Supabase ni navegador.
// Los datos salen de la vista v_amie_planteles (cantón normalizado en mayúsculas).

const num = v => Number(v) || 0;

/** Cuenta filas por un campo → [{ clave, n, pct }] ordenado de mayor a menor. */
export function contar(filas, campo) {
  const m = new Map();
  for (const f of filas) { const k = f[campo] || 'Sin dato'; m.set(k, (m.get(k) || 0) + 1); }
  const total = filas.length;
  return [...m.entries()].map(([clave, n]) => ({ clave, n, pct: total ? Math.round((1000 * n) / total) / 10 : 0 }))
    .sort((a, b) => b.n - a.n || String(a.clave).localeCompare(String(b.clave)));
}

/** Totales de un conjunto de planteles. Los *_ref vienen del catálogo AMIE (0 = aún no cargado); los *_sistema, de SIGEE. */
export function totales(filas) {
  const t = { planteles: filas.length, estudiantesRef: 0, docentesRef: 0, estudiantesSistema: 0, docentesSistema: 0, administrativosSistema: 0, conFinanzas: 0 };
  for (const f of filas) {
    t.estudiantesRef += num(f.estudiantes_ref); t.docentesRef += num(f.docentes_ref);
    t.estudiantesSistema += num(f.estudiantes_sistema); t.docentesSistema += num(f.docentes_sistema);
    t.administrativosSistema += num(f.administrativos_sistema);
    if (f.finanzas_habilitado) t.conFinanzas += 1;
  }
  t.planteles && (t.promEstudiantesRef = t.estudiantesRef ? Math.round(t.estudiantesRef / t.planteles) : 0);
  return t;
}

/** Una fila por cantón con sus totales y la mezcla de sostenimientos. */
export function agruparCantones(filas) {
  const m = new Map();
  for (const f of filas) { const k = f.canton || 'SIN CANTÓN'; if (!m.has(k)) m.set(k, []); m.get(k).push(f); }
  return [...m.entries()].map(([canton, fs]) => ({
    canton, ...totales(fs),
    sostenimientos: Object.fromEntries(contar(fs, 'sostenimiento').map(x => [x.clave, x.n])),
    parroquias: new Set(fs.map(f => f.parroquia)).size
  })).sort((a, b) => b.planteles - a.planteles || a.canton.localeCompare(b.canton));
}

/** Filtros combinables sobre el catálogo (todos opcionales). */
export function filtrar(filas, { canton = '', sostenimiento = '', nivel = '', jornada = '', parroquia = '', texto = '' } = {}) {
  const q = texto.trim().toLowerCase();
  return filas.filter(f => (!canton || f.canton === canton) && (!sostenimiento || f.sostenimiento === sostenimiento)
    && (!nivel || f.nivel_educativo === nivel) && (!jornada || f.jornada === jornada) && (!parroquia || f.parroquia === parroquia)
    && (!q || `${f.nombre} ${f.amie}`.toLowerCase().includes(q)));
}

export const nivelCorto = (s, max = 34) => (s && s.length > max ? s.slice(0, max) + '…' : s || 'Sin dato');
export const miles = v => Number(v || 0).toLocaleString('es-EC');
