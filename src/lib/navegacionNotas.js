// Navegación con Enter en la cuadrícula de notas. Módulo PURO (se prueba sin navegador).
// `celdas`: lista de { r, c, ok } = fila (estudiante), columna y si la celda se puede escribir (no está bloqueada).
// Enter baja al estudiante siguiente de la MISMA columna; al terminar la columna, pasa al primer estudiante de la columna
// siguiente. Mayús+Enter hace lo contrario (sube; al llegar arriba, va al último de la columna anterior).
// Devuelve la celda destino ({ r, c }) o null si no hay a dónde ir (se queda donde está).
export function siguienteCelda(celdas, actual, atras = false) {
  const libres = (celdas || []).filter(x => x.ok);
  if (!libres.length || !actual) return null;
  // Orden de lectura "por columnas": primero por columna y dentro de ella por fila.
  libres.sort((a, b) => (a.c - b.c) || (a.r - b.r));
  const pos = libres.findIndex(x => x.c === actual.c && x.r === actual.r);
  if (pos === -1) {
    // La celda actual no está en la lista (p. ej. bloqueada): se toma la más cercana hacia adelante/atrás.
    const t = atras
      ? [...libres].reverse().find(x => x.c < actual.c || (x.c === actual.c && x.r < actual.r))
      : libres.find(x => x.c > actual.c || (x.c === actual.c && x.r > actual.r));
    return t ? { r: t.r, c: t.c } : null;
  }
  const dest = libres[pos + (atras ? -1 : 1)];
  return dest ? { r: dest.r, c: dest.c } : null;
}
