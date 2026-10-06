import assert from 'node:assert/strict';
import { docenteDesdeBase, planAsignacion, planCruce } from '../src/lib/asignarDocentes.js';

const base = [
  { id: 'a', cedula: '0700807365', nombre: 'JARAMILLO FREIRE ALBERTO ENRIQUE', especialidad: 'PRIMARIA', titulos: [{ titulo: 'LICENCIADO EN CIENCIAS' }] },
  { id: 'b', cedula: '0913131702', nombre: 'VEGA CORDOVA CARMEN ARACELY', titulos: [] },
  { id: 'c', cedula: '0702806712', nombre: 'IZQUIERDO GUALAN LAURA', titulos: [] },      // 3 palabras → nombre dudoso
  { id: 'd', cedula: '', nombre: 'SIN CEDULA PERSONA', titulos: [] },
  { id: 'e', cedula: '0700807365', nombre: 'JARAMILLO FREIRE ALBERTO ENRIQUE', titulos: [] }   // repetido
];

// ficha: 2 apellidos + resto nombres, con título y especialidad
const f = docenteDesdeBase(base[0], 'inst1');
assert.deepEqual(f.fila, { institucion_id: 'inst1', cedula: '0700807365', apellidos: 'JARAMILLO FREIRE', nombres: 'ALBERTO ENRIQUE', titulo: 'LICENCIADO EN CIENCIAS', especialidad: 'PRIMARIA' });
assert.equal(f.dudoso, false);
assert.equal(docenteDesdeBase(base[1], 'x').fila.titulo, undefined, 'sin título no se manda la columna');

// plan: lo que ya está en el plantel no se duplica (aunque la cédula esté sin el cero inicial)
const p = planAsignacion(base, ['913131702'], 'inst1');
assert.deepEqual(p.aIncorporar.map(x => x.id), ['a', 'c']);
assert.deepEqual(p.yaEstaban, ['b']);
assert.deepEqual(p.sinCedula, ['d']);
assert.equal(p.dudosos.length, 1);
assert.equal(p.dudosos[0].cedula, '0702806712');
assert.equal(planAsignacion([], [], 'x').aIncorporar.length, 0);

// cruce con activos
const c = planCruce(
  [{ id: 'a', cedula: '0700807365' }, { id: 'b', cedula: '0913131702' }, { id: 'c', cedula: '0702806712' }, { id: 'd', cedula: '0000000001' }],
  [
    { cedula: '700807365', institucion_id: 'P1' },       // sin cero inicial
    { cedula: '0913131702', institucion_id: 'P1' }, { cedula: '0913131702', institucion_id: 'P2' },   // en dos planteles
    { cedula: '0702806712', institucion_id: 'P2' }
  ]
);
assert.deepEqual(c.asignar.get('P1'), ['a']);
assert.deepEqual(c.asignar.get('P2'), ['c']);
assert.equal(c.total, 2);
assert.equal(c.ambiguos, 1);
assert.equal(c.sinCoincidencia, 1);
console.log('OK asignarDocentes: todas las pruebas pasaron');
