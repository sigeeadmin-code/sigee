import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { leerLibro } from '../src/lib/leerHojas.js';
import { analizarHoja, convertirFilas } from '../src/lib/importacionInteligente.js';

function cedula(p) { const d = String(p).padStart(9, '0').split('').map(Number); let s = 0; for (let i = 0; i < 9; i++) { let v = d[i] * (i % 2 ? 1 : 2); if (v > 9) v -= 9; s += v; } return d.join('') + ((10 - (s % 10)) % 10); }
const C1 = cedula(70467467), C2 = cedula(70123456);

// Libro como lo haría un colegio: título arriba, fechas reales de Excel, cédula como NÚMERO (pierde el cero) y como TEXTO, celular como número
const ws = XLSX.utils.aoa_to_sheet([
  ['COLEGIO DE PRUEBA — NÓMINA'],
  [],
  ['Celular', 'Apellidos y Nombres', 'Cédula', 'Fecha de ingreso', 'Sexo'],
  [991234567, 'VIVAR CARLOS', Number(C1), new Date(Date.UTC(2018, 2, 15)), 'M'],
  [987654321, 'MORA PRISCILA', C2, new Date(Date.UTC(2020, 7, 1)), 'F']
], { cellDates: true });
ws['D4'].z = 'dd/mm/yyyy'; ws['D5'].z = 'dd/mm/yyyy';
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Nómina');
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[]]), 'Vacía');
const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellDates: true });

const hojas = leerLibro(buf);
assert.deepEqual(hojas.map(h => h.nombre), ['Nómina'], 'las hojas vacías se ignoran');
const an = analizarHoja(hojas[0].matriz, 'docentes');
assert.equal(an.filaEncabezado, 2);
const conv = convertirFilas(an.filas, an.mapeo, 'docentes', { orden: an.orden });
assert.equal(conv.length, 2);
assert.deepEqual([conv[0].datos.apellidos, conv[0].datos.nombres, conv[0].datos.cedula, conv[0].datos.telefono, conv[0].datos.fecha_ingreso, conv[0].datos.genero],
  ['VIVAR', 'CARLOS', C1, '0991234567', '2018-03-15', 'Masculino']);
assert.deepEqual([conv[1].datos.cedula, conv[1].datos.telefono, conv[1].datos.fecha_ingreso], [C2, '0987654321', '2020-08-01']);

// CSV con punto y coma o coma
const csv = new TextEncoder().encode('Apellidos,Nombres,Cédula\nVivar,Carlos,' + C1 + '\nMora,Priscila,\n');
const h2 = leerLibro(csv);
const a2 = analizarHoja(h2[0].matriz, 'docentes');
const c2 = convertirFilas(a2.filas, a2.mapeo, 'docentes');
assert.equal(c2.length, 2); assert.equal(c2[0].datos.cedula, C1); assert.equal(c2[1].datos.cedula, null); assert.equal(c2[1].error, null);
// CSV con tildes y punto y coma (Excel en español), con la fecha 03/05/2018 = 3 de mayo, NO 5 de marzo
const csv2 = new TextEncoder().encode('Apellidos;Nombres;Cédula;Fecha de ingreso;Celular\nVivar;Carlos;' + C1 + ';03/05/2018;0991234567\nMora;Priscila;;;\n');
const a3 = analizarHoja(leerLibro(csv2)[0].matriz, 'docentes');
const c3 = convertirFilas(a3.filas, a3.mapeo, 'docentes');
assert.equal(c3[0].datos.cedula, C1); assert.equal(c3[0].datos.fecha_ingreso, '2018-05-03'); assert.equal(c3[0].datos.telefono, '0991234567');
// CSV guardado en Windows-1252 (acentos en un byte)
const bytes = Uint8Array.from([...'Apellidos,Nombres,C'].map(c => c.charCodeAt(0)).concat([0xE9], [...'dula\nP\u00e9rez,Ana,'].map(c => c.charCodeAt(0) & 255)));
const a4 = analizarHoja(leerLibro(bytes)[0].matriz, 'docentes');
assert.equal(a4.mapeo.find(m => m.campo === 'cedula')?.indice, 2);
console.log('OK leerHojas: todas las pruebas pasaron');
