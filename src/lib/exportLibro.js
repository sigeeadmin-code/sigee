import * as XLSX from 'xlsx';

/** hojas: [{ nombre, filas: [objeto], cols?: [encabezados] }] → libro de Excel (una hoja por elemento). */
export function construirLibro(hojas) {
  const wb = XLSX.utils.book_new();
  const usados = new Set();
  for (const h of hojas) {
    const cols = h.cols || (h.filas[0] ? Object.keys(h.filas[0]) : ['Sin datos']);
    const aoa = [cols, ...h.filas.map(f => cols.map(c => f[c] ?? ''))];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = cols.map(c => ({ wch: Math.max(12, Math.min(40, String(c).length + 4)) }));
    let nombre = String(h.nombre).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Hoja';
    for (let i = 2; usados.has(nombre.toLowerCase()); i++) nombre = nombre.slice(0, 28) + ' ' + i;
    usados.add(nombre.toLowerCase());
    XLSX.utils.book_append_sheet(wb, ws, nombre);
  }
  return wb;
}
export function descargarLibro(nombreArchivo, hojas) {
  XLSX.writeFile(construirLibro(hojas), nombreArchivo);
}
/** CSV con BOM para que Excel respete las tildes. */
export function descargarCsv(nombreArchivo, filas, cols) {
  const columnas = cols || (filas[0] ? Object.keys(filas[0]) : []);
  const ws = XLSX.utils.aoa_to_sheet([columnas, ...filas.map(f => columnas.map(c => f[c] ?? ''))]);
  const blob = new Blob(['\ufeff' + XLSX.utils.sheet_to_csv(ws)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nombreArchivo; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
