// Lee un libro de Excel / CSV y entrega cada hoja como matriz de celdas (filas × columnas), sin suponer encabezados.
// Las fechas de Excel se convierten a AAAA-MM-DD sin errores de zona horaria y los números largos (cédulas) no pierden dígitos.
import * as XLSX from 'xlsx';

export const MAX_FILAS = 5000;

function valorCelda(cell) {
  if (!cell || cell.v === undefined || cell.v === null) return '';
  if (cell.t === 'd' && cell.v instanceof Date) return cell.v.toISOString().slice(0, 10);
  if (cell.t === 'n') {
    if (cell.z && XLSX.SSF.is_date(cell.z)) {
      const p = XLSX.SSF.parse_date_code(cell.v);
      if (p && p.y >= 1900) return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
    }
    return String(cell.v);
  }
  if (cell.t === 'e') return '';
  if (cell.t === 'b') return cell.v ? 'Sí' : 'No';
  return String(cell.v);
}

export function hojaAMatriz(ws) {
  if (!ws || !ws['!ref']) return [];
  const r = XLSX.utils.decode_range(ws['!ref']);
  const out = [];
  for (let R = r.s.r; R <= r.e.r; R++) {
    const fila = [];
    for (let C = r.s.c; C <= r.e.c; C++) fila.push(valorCelda(ws[XLSX.utils.encode_cell({ r: R, c: C })]));
    out.push(fila);
  }
  return out;
}

const esLibroBinario = u8 => u8.length > 4 && ((u8[0] === 0x50 && u8[1] === 0x4B) || (u8[0] === 0xD0 && u8[1] === 0xCF));   // .xlsx (zip) o .xls (OLE)

/** buf: ArrayBuffer | Uint8Array. Devuelve [{ nombre, matriz }] solo de las hojas que tienen datos. */
export function leerLibro(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let wb;
  if (esLibroBinario(u8)) {
    wb = XLSX.read(u8, { type: 'array' });
  } else {
    // CSV / texto: se decodifica como UTF-8 (o Windows-1252 si no lo es) y NO se interpretan valores, para que
    // "03/05/2018" no se convierta en mayo (formato de EE. UU.) ni se pierdan ceros iniciales.
    let texto;
    try { texto = new TextDecoder('utf-8', { fatal: true }).decode(u8); }
    catch (e) { texto = new TextDecoder('windows-1252').decode(u8); }
    wb = XLSX.read(texto.replace(/^\uFEFF/, ''), { type: 'string', raw: true });
  }
  return wb.SheetNames
    .map(nombre => ({ nombre, matriz: hojaAMatriz(wb.Sheets[nombre]) }))
    .filter(h => h.matriz.some(f => f.some(c => String(c).trim() !== '')));
}

export async function leerArchivo(file) {
  return leerLibro(await file.arrayBuffer());
}
