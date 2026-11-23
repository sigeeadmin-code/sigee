import * as XLSX from 'xlsx';

/**
 * hojas: [{
 *   nombre,
 *   filas: [objeto],
 *   cols?: [encabezados de columnas],
 *   encabezado?: string[]   // filas de título institucionales (antes de la tabla)
 * }]
 */
export function construirLibro(hojas) {
  const wb = XLSX.utils.book_new();
  const usados = new Set();
  for (const h of hojas) {
    const cols = h.cols || (h.filas[0] ? Object.keys(h.filas[0]) : ['Sin datos']);
    const encabezado = Array.isArray(h.encabezado) ? h.encabezado.filter(Boolean) : [];
    const aoa = [
      ...encabezado.map(linea => [String(linea)]),
      cols,
      ...h.filas.map(f => cols.map(c => f[c] ?? '')),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Ancho de columnas según contenido
    ws['!cols'] = cols.map((c, idx) => {
      let max = String(c).length;
      for (const f of h.filas) {
        const v = f[c];
        if (v != null) max = Math.max(max, String(v).length);
      }
      // También considerar líneas de encabezado en la primera columna
      if (idx === 0) {
        for (const linea of encabezado) max = Math.max(max, String(linea).length);
      }
      return { wch: Math.max(10, Math.min(48, max + 2)) };
    });

    // Combinar celdas del encabezado institucional (toda la fila de título)
    if (encabezado.length && cols.length > 1) {
      ws['!merges'] = encabezado.map((_, i) => ({
        s: { r: i, c: 0 },
        e: { r: i, c: cols.length - 1 },
      }));
    }

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
