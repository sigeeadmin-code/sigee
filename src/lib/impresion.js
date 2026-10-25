// Márgenes de impresión de los documentos formales (oficios y fichas). Se aplican a CADA hoja impresa (no solo a la primera):
// el margen lo pone la página (@page), no un relleno de la hoja, así que si el texto pasa a la siguiente hoja, las dos mantienen
// los mismos márgenes. Solo vale mientras se imprime: se pone al empezar y se quita al terminar (no afecta a otras impresiones).
export const MARGEN_A4 = '14mm 20mm';   // arriba/abajo 14 mm, izquierda/derecha 20 mm

export function reglaPagina(margen = MARGEN_A4) { return `@page{size:A4;margin:${margen}}`; }

// Devuelve la función que quita la regla. Segura si no hay documento (pruebas, servidor).
export function usarMargenesA4(margen = MARGEN_A4, doc = (typeof document !== 'undefined' ? document : null)) {
  if (!doc || !doc.head) return () => {};
  const st = doc.createElement('style');
  st.setAttribute('data-sigee-pagina', 'a4');
  st.textContent = reglaPagina(margen);
  doc.head.appendChild(st);
  return () => { try { if (st.parentNode) st.parentNode.removeChild(st); } catch { /* ya no está */ } };
}
