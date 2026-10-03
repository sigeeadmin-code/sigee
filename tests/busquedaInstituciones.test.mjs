import assert from 'node:assert/strict';
import { buscarInstituciones, normalizar } from '../src/lib/busquedaInstituciones.js';

const L = [
  { id: '1', nombre: '13 DE ABRIL', amie: '07H00987', canton: 'MACHALA', provincia: 'EL ORO' },
  { id: '2', nombre: '13 DE ABRIL', amie: '07H01141', canton: 'PASAJE', provincia: 'EL ORO' },
  { id: '3', nombre: 'COLEGIO LUMEN', amie: '07H01222', canton: 'MACHALA', provincia: 'EL ORO' },
  { id: '4', nombre: 'SAN JOSÉ OBRERO', amie: '07H00500', canton: 'MACHALA', provincia: 'EL ORO' },
  { id: '5', nombre: 'UNIDAD EDUCATIVA CIUDAD DE MACHALA', amie: '07H00001', canton: 'MACHALA', provincia: 'EL ORO' },
  { id: '6', nombre: 'SIN AMIE', amie: null }
];
const ids = (t, lim) => buscarInstituciones(L, t, lim).map(i => i.id);

assert.equal(normalizar('  Educación   Física '), 'EDUCACION FISICA');
// por nombre, sin importar tildes ni mayúsculas
assert.deepEqual(ids('san jose'), ['4']);
assert.deepEqual(ids('SAN JOSÉ'), ['4']);
assert.deepEqual(ids('lumen'), ['3']);
// palabras en cualquier orden y sin la "de"
assert.deepEqual(ids('abril 13').sort(), ['1', '2']);
assert.deepEqual(ids('ciudad machala'), ['5']);
// por AMIE (completo, parcial, en minúscula)
assert.deepEqual(ids('07h01141'), ['2']);
assert.deepEqual(ids('07H01222'), ['3']);
assert.deepEqual(ids('07h011'), ['2']);
// dos instituciones con el mismo nombre se distinguen por AMIE y se ordenan de forma estable
assert.deepEqual(ids('13 de abril'), ['1', '2']);
// por cantón
assert.ok(ids('pasaje').includes('2') && !ids('pasaje').includes('1'));
// AMIE exacto primero
assert.equal(ids('07H00987')[0], '1');
// vacío o sin coincidencias
assert.deepEqual(ids(''), []); assert.deepEqual(ids('   '), []); assert.deepEqual(ids('zzzz'), []);
// límite y datos incompletos
assert.equal(buscarInstituciones(L, 'machala', 2).length, 2);
assert.deepEqual(buscarInstituciones(null, 'x'), []);
assert.deepEqual(ids('sin amie'), ['6']);
console.log('OK busquedaInstituciones: todas las pruebas pasaron');
