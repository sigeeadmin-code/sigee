// Búsqueda de instituciones por nombre o código AMIE. Módulo PURO.
// Ignora tildes, mayúsculas y espacios de más; todas las palabras escritas deben aparecer (en cualquier orden).
// Ejemplos: "13 abril" encuentra "13 DE ABRIL"; "07h01141" encuentra esa institución por su AMIE.

export const normalizar = t =>
  String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

export function buscarInstituciones(lista, texto, limite = 30) {
  const q = normalizar(texto);
  if (!q) return [];
  const palabras = q.split(' ');
  const out = [];
  for (const inst of lista || []) {
    const nombre = normalizar(inst.nombre);
    const amie = normalizar(inst.amie);
    const resto = normalizar(`${inst.canton || ''} ${inst.provincia || ''}`);
    const todo = `${nombre} ${amie} ${resto}`;
    if (!palabras.every(p => todo.includes(p))) continue;
    // Prioridad: AMIE exacto > AMIE que empieza igual > nombre que empieza igual > el resto
    let rango = 4;
    if (amie && amie === q) rango = 0;
    else if (amie && amie.startsWith(q)) rango = 1;
    else if (nombre.startsWith(q)) rango = 2;
    else if (nombre.includes(q) || amie.includes(q)) rango = 3;
    out.push({ inst, rango, nombre });
  }
  out.sort((a, b) => a.rango - b.rango || a.nombre.localeCompare(b.nombre, 'es') || String(a.inst.amie).localeCompare(String(b.inst.amie)));
  return out.slice(0, limite).map(o => o.inst);
}
