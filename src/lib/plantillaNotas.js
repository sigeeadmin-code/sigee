// Plantilla Excel de calificaciones: descargar con los estudiantes y casilleros actuales, llenarla fuera de línea y subirla de vuelta.
// Módulo PURO (sin React): la pantalla solo lo llama. NO guarda nada: devuelve los registros ya validados y la pantalla los guarda
// con el mismo guardado de siempre (guardarNotasTrimestre), que vuelve a validar permisos, calendario y rango en el servidor.
//
// Honestidad sobre la seguridad: el código y el hash de la hoja _META protegen contra plantillas viejas, de otra materia/curso/trimestre
// o con la lista de estudiantes cambiada. NO son una firma secreta (cualquiera podría recalcularlos); la autorización real es la del servidor.
import * as XLSX from 'xlsx';
import { esNotaValida } from './notaEntrada.js';
import { firmaCfg } from './borradorNotas.js';

const TIPOS = [['ind', 'I', 'Individual'], ['grp', 'G', 'Grupal'], ['sum', 'S', 'Sumativa']];
export const HOJA_NOTAS = 'Calificaciones';
export const HOJA_META = '_META';
const FILA_ENCABEZADO = 3;   // índice base 0 → fila 4 de Excel
const MAX_ERRORES = 40;

/** Columnas de notas según la configuración de la materia. Código estable: I1-1 = individual, aporte 1, casillero 1. */
export function columnasPlantilla(cfg) {
  const cols = [];
  TIPOS.forEach(([tipo, letra, etiqueta]) => {
    ((cfg && cfg[tipo]) || []).forEach((grupo, g) => {
      for (let a = 0; a < grupo.n; a++) {
        cols.push({ tipo, g, a, codigo: `${letra}${g + 1}-${a + 1}`, aporte: `${etiqueta}: ${grupo.nombre}`, casillero: a + 1 });
      }
    });
  });
  return cols;
}

export async function sha256(texto) {
  const datos = new TextEncoder().encode(String(texto));
  const buf = await globalThis.crypto.subtle.digest('SHA-256', datos);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function codigoPlantilla({ docenteId, cargaId, trim }) {
  return 'PL-' + (await sha256(`${docenteId}|${cargaId}|${trim}`)).slice(0, 8).toUpperCase();
}

// Huella de la estructura: quién es la plantilla + qué estudiantes + qué casilleros. Si cambia cualquiera, la plantilla ya no sirve.
export async function hashEstructura({ codigo, alumnosIds, cfg, cargaId, trim }) {
  return sha256(JSON.stringify([codigo, [...alumnosIds].sort(), firmaCfg(cfg), cargaId, trim]));
}

const slug = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

/** Genera el libro. `base` = notas tal como están en el servidor (no las ediciones sin guardar). Devuelve { datos: ArrayBuffer, nombreArchivo }. */
export async function generarPlantilla({ ctx, alumnos, base }) {
  const cols = columnasPlantilla(ctx.cfg);
  if (!cols.length) throw new Error('La materia no tiene casilleros configurados.');
  if (!alumnos.length) throw new Error('No hay estudiantes matriculados en este paralelo.');
  const codigo = await codigoPlantilla(ctx);
  const hash = await hashEstructura({ codigo, alumnosIds: alumnos.map(a => a.id), cfg: ctx.cfg, cargaId: ctx.cargaId, trim: ctx.trim });

  const filas = [
    ['CODIGO_PLANTILLA', codigo],
    ['Docente', ctx.docenteNombre, 'Materia', ctx.materia, 'Curso', ctx.curso, 'Paralelo', ctx.paralelo, 'Trimestre', ctx.trim],
    ['', 'Aporte →', ...cols.map(c => c.aporte)],
    ['ID_ESTUDIANTE', 'ESTUDIANTE', ...cols.map(c => c.codigo)]
  ];
  alumnos.forEach(al => {
    const reg = base && base[al.id];
    filas.push([al.id, al.nombre, ...cols.map(c => {
      const v = reg && reg[c.tipo] && reg[c.tipo][c.g] ? reg[c.tipo][c.g][c.a] : '';
      return v === '' || v === undefined || v === null ? '' : Number(v);
    })]);
  });

  const hoja = XLSX.utils.aoa_to_sheet(filas);
  hoja['!cols'] = [{ wch: 38 }, { wch: 34 }, ...cols.map(() => ({ wch: 12 }))];
  const meta = [
    ['CODIGO_PLANTILLA', codigo], ['DOCENTE_ID', ctx.docenteId], ['CARGA_ID', ctx.cargaId], ['PARALELO_ID', ctx.paraleloId],
    ['GRADO_ID', ctx.gradoId], ['TRIMESTRE', ctx.trim], ['HASH', hash], ['GENERADO', new Date().toISOString()]
  ];
  const hojaMeta = XLSX.utils.aoa_to_sheet(meta);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, HOJA_NOTAS);
  XLSX.utils.book_append_sheet(libro, hojaMeta, HOJA_META);
  libro.Workbook = { Sheets: [{ Hidden: 0 }, { Hidden: 2 }] };   // _META "muy oculta": no aparece ni en Mostrar hojas
  const datos = XLSX.write(libro, { type: 'array', bookType: 'xlsx' });
  const nombreArchivo = `Plantilla_${slug(ctx.materia)}_${slug(ctx.curso)}${slug(ctx.paralelo)}_${ctx.trim}.xlsx`;
  return { datos, nombreArchivo };
}

/** Lee el archivo subido. No valida nada: solo extrae. */
export function leerPlantilla(datos) {
  let libro;
  try { libro = XLSX.read(datos, { type: 'array' }); } catch { return null; }
  if (!libro.SheetNames.includes(HOJA_NOTAS) || !libro.SheetNames.includes(HOJA_META)) return null;
  const meta = {};
  XLSX.utils.sheet_to_json(libro.Sheets[HOJA_META], { header: 1, defval: '' }).forEach(([k, v]) => { if (k) meta[String(k)] = String(v); });
  const filas = XLSX.utils.sheet_to_json(libro.Sheets[HOJA_NOTAS], { header: 1, defval: '', raw: true });
  return { meta, filas };
}

// Normaliza una celda de Excel a texto de nota. Devuelve null si no es válida.
function normalizarCelda(v) {
  if (v === '' || v === null || v === undefined) return '';
  let t = typeof v === 'number' ? String(Number(v.toFixed(6))) : String(v).trim().replace(',', '.');
  if (t === '') return '';
  if (!esNotaValida(t)) return null;
  return t;
}

const copiaFila = f => ({ ind: f.ind.map(x => [...x]), grp: f.grp.map(x => [...x]), sum: f.sum.map(x => [...x]), mejora: { ...f.mejora } });

/**
 * Valida la plantilla contra la pantalla y arma los registros a guardar.
 * ctx: { docenteId, cargaId, paraleloId, gradoId, trim, cfg, alumnos:[{id,nombre}], base:{ [estId]: fila } }
 * Una celda vacía NO borra una nota ya guardada (borrar notas se hace en pantalla, a propósito).
 */
export async function validarPlantilla(parsed, ctx) {
  const falla = (...errores) => ({ ok: false, errores });
  if (!parsed) return falla('El archivo no es una plantilla de SIGEE (falta la hoja de Calificaciones o la hoja interna _META). Descarga la plantilla desde esta pantalla y no cambies su estructura.');
  const { meta, filas } = parsed;

  if (meta.DOCENTE_ID !== ctx.docenteId) return falla('Esta plantilla fue generada por otra cuenta. Descarga tu propia plantilla.');
  const difiere = [];
  if (meta.CARGA_ID !== ctx.cargaId) difiere.push('materia');
  if (meta.PARALELO_ID !== ctx.paraleloId) difiere.push('paralelo');
  if (meta.GRADO_ID !== ctx.gradoId) difiere.push('curso');
  if (meta.TRIMESTRE !== ctx.trim) difiere.push('trimestre');
  if (difiere.length) return falla(`La plantilla es de otro ${difiere.join(' / ')}. Selecciona en pantalla los mismos filtros con los que la descargaste.`);

  const codigo = await codigoPlantilla(ctx);
  if (meta.CODIGO_PLANTILLA !== codigo || String((filas[0] || [])[1] || '') !== codigo) return falla('El código de la plantilla no es válido. Descarga una plantilla nueva.');
  const hash = await hashEstructura({ codigo, alumnosIds: ctx.alumnos.map(a => a.id), cfg: ctx.cfg, cargaId: ctx.cargaId, trim: ctx.trim });
  if (meta.HASH !== hash) return falla('La plantilla ya no coincide con el curso: cambió la lista de estudiantes o los casilleros desde que la descargaste. Descarga una plantilla nueva.');

  const cols = columnasPlantilla(ctx.cfg);
  const enc = filas[FILA_ENCABEZADO] || [];
  const esperado = ['ID_ESTUDIANTE', 'ESTUDIANTE', ...cols.map(c => c.codigo)];
  if (esperado.some((e, i) => String(enc[i] || '') !== e) || enc.slice(esperado.length).some(x => String(x || '').trim() !== '')) {
    return falla('Los encabezados de la plantilla fueron modificados (fila 4). No agregues, borres ni cambies columnas.');
  }

  const porId = new Map(ctx.alumnos.map(a => [a.id, a]));
  const vistos = new Set();
  const errores = [];
  const registros = [];
  let celdas = 0;
  const err = t => { if (errores.length < MAX_ERRORES) errores.push(t); };

  filas.slice(FILA_ENCABEZADO + 1).forEach((fila, i) => {
    const nFila = FILA_ENCABEZADO + 2 + i;   // número de fila real en Excel
    const id = String(fila[0] || '').trim();
    if (!id && fila.every(x => String(x).trim() === '')) return;   // fila en blanco al final
    const alumno = porId.get(id);
    if (!alumno) { err(`Fila ${nFila}: el ID de estudiante no pertenece a este paralelo. No se pueden cambiar los ID.`); return; }
    if (vistos.has(id)) { err(`Fila ${nFila}: el estudiante «${alumno.nombre}» aparece repetido.`); return; }
    vistos.add(id);
    if (String(fila[1] || '').trim() !== alumno.nombre) { err(`Fila ${nFila}: el nombre no corresponde al ID (esperado «${alumno.nombre}»). No cambies los ID ni los nombres.`); return; }

    const actual = ctx.base[id];
    if (!actual) { err(`Fila ${nFila}: no hay una fila de notas cargada para «${alumno.nombre}». Recarga la pantalla.`); return; }
    const nueva = copiaFila(actual);
    let cambio = false;
    cols.forEach((c, k) => {
      const v = normalizarCelda(fila[2 + k]);
      if (v === null) { err(`Fila ${nFila} · ${c.codigo} (${alumno.nombre}): «${String(fila[2 + k])}» no es una nota válida (número de 0 a 10, hasta 2 decimales).`); return; }
      if (v === '') return;
      const previo = nueva[c.tipo][c.g][c.a];
      if (previo !== '' && Number(previo) === Number(v)) return;
      nueva[c.tipo][c.g][c.a] = v; cambio = true; celdas++;
    });
    if (cambio) registros.push({ estudiante_id: id, aportes: nueva, mejora: nueva.mejora });
  });

  if (errores.length) return { ok: false, errores };
  return { ok: true, errores: [], registros, resumen: { estudiantes: registros.length, celdas } };
}
