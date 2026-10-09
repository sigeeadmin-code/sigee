import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { construirLibro } from '../src/lib/exportLibro.js';

const wb = construirLibro([
  { nombre: 'Resumen', filas: [{ Indicador: 'Asistencia', Valor: 91.5 }] },
  { nombre: 'Por estudiante', filas: [{ Estudiante: 'Ana', Faltas: 2 }, { Estudiante: 'Beto', Faltas: 0 }], cols: ['Estudiante', 'Faltas'] },
  { nombre: 'Vacía', filas: [] },
  { nombre: 'Resumen', filas: [{ a: 1 }] },
  { nombre: 'Nombre con / caracteres ? raros y muy largo para excel', filas: [{ a: 1 }] }
]);
assert.deepEqual(wb.SheetNames.slice(0, 3), ['Resumen', 'Por estudiante', 'Vacía']);
assert.equal(new Set(wb.SheetNames.map(n => n.toLowerCase())).size, 5, 'nombres de hoja únicos');
assert.ok(wb.SheetNames.every(n => n.length <= 31 && !/[\\/?*[\]:]/.test(n)));
const filas = XLSX.utils.sheet_to_json(wb.Sheets['Por estudiante']);
assert.deepEqual(filas, [{ Estudiante: 'Ana', Faltas: 2 }, { Estudiante: 'Beto', Faltas: 0 }]);
console.log('OK exportLibro: todas las pruebas pasaron');
