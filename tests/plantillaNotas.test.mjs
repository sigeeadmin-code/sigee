import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { columnasPlantilla, generarPlantilla, leerPlantilla, validarPlantilla, HOJA_NOTAS, HOJA_META } from '../src/lib/plantillaNotas.js';

const cfg = { ind: [{ nombre: 'Tareas', n: 2, peso: 10 }], grp: [{ nombre: 'Talleres', n: 1, peso: 5 }], sum: [{ nombre: 'Examen', n: 1, peso: 30 }] };
const vacio = () => ({ ind: [['', '']], grp: [['']], sum: [['']], mejora: { mejora_directa: '', refuerzo: '', mejora_refuerzo: '' } });
const alumnos = [{ id: 'e1', nombre: 'ANA PEREZ' }, { id: 'e2', nombre: 'LUIS SOTO' }];
const base = { e1: { ...vacio(), ind: [['8', '']] }, e2: vacio() };
const ctx = { docenteId: 'd1', docenteNombre: 'Doc', cargaId: 'c1', paraleloId: 'p1', gradoId: 'g1', trim: 'T1', cfg, materia: 'Matemática', curso: '1ro BGU', paralelo: 'A', alumnos, base };

assert.deepEqual(columnasPlantilla(cfg).map(c => c.codigo), ['I1-1', 'I1-2', 'G1-1', 'S1-1']);

// Genera y vuelve a leer: nombre, hoja oculta, notas actuales incluidas
const { datos, nombreArchivo } = await generarPlantilla({ ctx, alumnos, base });
assert.equal(nombreArchivo, 'Plantilla_Matematica_1ro_BGUA_T1.xlsx');
const libro = XLSX.read(datos, { type: 'array' });
assert.equal(libro.Workbook.Sheets[1].Hidden, 2);
const filas = XLSX.utils.sheet_to_json(libro.Sheets[HOJA_NOTAS], { header: 1, defval: '' });
assert.equal(filas[4][2], 8);   // la nota ya guardada de ANA viene precargada

// Plantilla sin tocar → válida, sin cambios
let r = await validarPlantilla(leerPlantilla(datos), ctx);
assert.equal(r.ok, true); assert.equal(r.registros.length, 0);

// Helper: modifica el libro y lo vuelve a empaquetar
const editar = fn => { const l = XLSX.read(datos, { type: 'array' }); fn(l); return XLSX.write(l, { type: 'array', bookType: 'xlsx' }); };
const cel = (l, ref, v) => { l.Sheets[HOJA_NOTAS][ref] = { t: typeof v === 'number' ? 'n' : 's', v }; };

// Notas nuevas (con coma como texto) → registros solo de quien cambió; vacío no borra
let d = editar(l => { cel(l, 'D5', 9.5); cel(l, 'C6', '7,25'); });
r = await validarPlantilla(leerPlantilla(d), ctx);
assert.equal(r.ok, true); assert.equal(r.registros.length, 2); assert.equal(r.resumen.celdas, 2);
assert.equal(r.registros.find(x => x.estudiante_id === 'e2').aportes.ind[0][0], '7.25');
assert.equal(r.registros.find(x => x.estudiante_id === 'e1').aportes.ind[0][0], '8');   // lo ya guardado se conserva

// Notas inválidas
for (const malo of [11, -1, 'abc', 8.123]) {
  r = await validarPlantilla(leerPlantilla(editar(l => cel(l, 'E5', malo))), ctx);
  assert.equal(r.ok, false, String(malo)); assert.match(r.errores[0], /E?5|Fila 5/);
}

// Manipulación: ID cambiado, nombre cambiado, encabezado cambiado, fila repetida
r = await validarPlantilla(leerPlantilla(editar(l => cel(l, 'A5', 'e999'))), ctx);
assert.match(r.errores[0], /no pertenece/);
r = await validarPlantilla(leerPlantilla(editar(l => cel(l, 'B5', 'OTRO NOMBRE'))), ctx);
assert.match(r.errores[0], /nombre no corresponde/);
r = await validarPlantilla(leerPlantilla(editar(l => cel(l, 'C4', 'I9-9'))), ctx);
assert.match(r.errores[0], /encabezados/);
r = await validarPlantilla(leerPlantilla(editar(l => cel(l, 'A6', 'e1'))), ctx);
assert.match(r.errores.join(' '), /repetido|nombre no corresponde/);

// Contexto equivocado
r = await validarPlantilla(leerPlantilla(datos), { ...ctx, trim: 'T2' });
assert.match(r.errores[0], /trimestre/);
r = await validarPlantilla(leerPlantilla(datos), { ...ctx, cargaId: 'c2' });
assert.match(r.errores[0], /materia/);
r = await validarPlantilla(leerPlantilla(datos), { ...ctx, docenteId: 'otro' });
assert.match(r.errores[0], /otra cuenta/);

// Estructura cambiada después de descargar: llegó un estudiante nuevo / cambió un casillero
r = await validarPlantilla(leerPlantilla(datos), { ...ctx, alumnos: [...alumnos, { id: 'e3', nombre: 'NUEVO' }], base: { ...base, e3: vacio() } });
assert.match(r.errores[0], /ya no coincide/);
r = await validarPlantilla(leerPlantilla(datos), { ...ctx, cfg: { ...cfg, ind: [{ nombre: 'Tareas', n: 3, peso: 10 }] } });
assert.match(r.errores[0], /ya no coincide/);

// Código/hash adulterados en _META
r = await validarPlantilla(leerPlantilla(editar(l => { l.Sheets[HOJA_META].B7 = { t: 's', v: 'x'.repeat(64) }; })), ctx);
assert.match(r.errores[0], /ya no coincide/);

// Archivos que no son plantilla
assert.equal(leerPlantilla(new TextEncoder().encode('hola')), null);
r = await validarPlantilla(null, ctx); assert.match(r.errores[0], /no es una plantilla/);
console.log('plantillaNotas: OK');
