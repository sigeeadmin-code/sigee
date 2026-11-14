// Impresión de horarios en A4 HORIZONTAL con márgenes fijos. El documento vive en #hor-doc-root (fuera de #root) y solo se muestra al imprimir.
// @page no se puede limitar a una pantalla, por eso la regla se inserta justo antes de imprimir y se retira al terminar.
export function imprimirHorizontal() {
  const css = document.createElement('style');
  css.setAttribute('data-hor-print', '1');
  css.textContent = '@page{size:A4 landscape;margin:10mm 12mm}';
  document.head.appendChild(css);
  document.body.classList.add('imprimiendo-horario');
  const limpiar = () => { document.body.classList.remove('imprimiendo-horario'); css.remove(); window.removeEventListener('afterprint', limpiar); };
  window.addEventListener('afterprint', limpiar);
  setTimeout(() => window.print(), 60);   // deja que el navegador aplique la clase y la regla @page
}

/** Alto de fila (mm) para que la grilla semanal quepa en UNA hoja horizontal: más filas → filas más bajas. */
export function altoFilaMm(franjas) {
  const clases = franjas.filter(f => f.tipo === 'clase').length || 1;
  const recreos = franjas.length - clases;
  return Math.max(7, Math.min(11.5, Math.floor(((88 - 4.5 * recreos) / clases) * 10) / 10));
}

export const fechaEmision = (d = new Date()) => d.toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' });
