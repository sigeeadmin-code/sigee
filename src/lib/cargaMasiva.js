import * as XLSX from 'xlsx';

import { validarCedulaEC } from './cedula.js';
export { validarCedulaEC };

// Genera y descarga un archivo .xlsx de plantilla con encabezados y una fila de ejemplo
export function descargarPlantillaExcel(nombreArchivo, columnas, filaEjemplo) {
  const ws = XLSX.utils.aoa_to_sheet([columnas, filaEjemplo]);
  ws['!cols'] = columnas.map(c => ({ wch: Math.max(14, String(c).length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
  XLSX.writeFile(wb, nombreArchivo);
}

// Exporta filas de datos (array de objetos) a un .xlsx, usando las claves del
// primer objeto como encabezados. Para reportes (ej. cambios de matrícula).
export function exportarFilasExcel(nombreArchivo, filas, columnas) {
  const cols = columnas || (filas[0] ? Object.keys(filas[0]) : []);
  const aoa = [cols, ...filas.map(f => cols.map(c => f[c] ?? ''))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = cols.map(c => ({ wch: Math.max(14, String(c).length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
  XLSX.writeFile(wb, nombreArchivo);
}

// Lee un archivo .xlsx/.xls/.csv subido por el usuario y devuelve un array de objetos
// (una fila = un objeto, usando la primera fila como encabezados)
export async function leerExcel(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
}

// Convierte una fecha de Excel/texto a formato AAAA-MM-DD, o null si no es válida/está vacía
export function normalizarFecha(valor) {
  if (!valor) return null;
  const s = String(valor).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}
