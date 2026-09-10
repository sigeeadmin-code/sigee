import * as XLSX from 'xlsx';

// Validador de cédula ecuatoriana (algoritmo Módulo 10 del Registro Civil)
export function validarCedulaEC(cedula) {
  if (!/^\d{10}$/.test(cedula)) return false;
  const provincia = parseInt(cedula.substring(0, 2), 10);
  if (provincia < 1 || provincia > 24) return false;
  const digitos = cedula.split('').map(Number);
  const verificador = digitos[9];
  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let val = digitos[i] * (i % 2 === 0 ? 2 : 1);
    if (val > 9) val -= 9;
    suma += val;
  }
  const residuo = suma % 10;
  const digitoCalculado = residuo === 0 ? 0 : 10 - residuo;
  return digitoCalculado === verificador;
}

// Genera y descarga un archivo .xlsx de plantilla con encabezados y una fila de ejemplo
export function descargarPlantillaExcel(nombreArchivo, columnas, filaEjemplo) {
  const ws = XLSX.utils.aoa_to_sheet([columnas, filaEjemplo]);
  ws['!cols'] = columnas.map(c => ({ wch: Math.max(14, String(c).length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
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
