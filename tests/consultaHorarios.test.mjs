import assert from 'node:assert/strict';
import { tipoBachillerato, agruparDocentes, buscarDocentes, horasUbicadas, bloquesDeCargas, cruces, cobertura, matrizDia } from '../src/lib/consultaHorarios.js';

// Ciencias vs Técnico: dato explícito, deducción y niveles que no son bachillerato
assert.equal(tipoBachillerato({ tipo_bachillerato: 'tecnico', nombre: '1ro' }, {}), 'tecnico');
assert.equal(tipoBachillerato({ tipo_bachillerato: 'ciencias', nombre: '1er Año BT X' }, {}), 'ciencias');   // lo cargado manda
assert.equal(tipoBachillerato({ tipo_bachillerato: null, nombre: '1er Año BT Gestión Administrativa', nivel: 'BACHILLERATO' }, {}), 'tecnico');
assert.equal(tipoBachillerato({ nombre: '2do Bachillerato', nivel: 'BACHILLERATO' }, { especialidad: 'Informática' }), 'tecnico');
assert.equal(tipoBachillerato({ nombre: '3ro Bachillerato', nivel: 'BGU' }, {}), 'ciencias');
assert.equal(tipoBachillerato({ nombre: '9no EGB', nivel: 'EGB' }, {}), 'otro');
assert.equal(tipoBachillerato(null, null), 'otro');
// Casos reales de la base (Ismael Pérez Pazmiño y demo): el tipo casi siempre viene vacío
const real = (nombre, extra = {}) => tipoBachillerato({ nombre, nivel: 'BACHILLERATO', tipo_bachillerato: null, ...extra }, {});
assert.equal(real('2DO Contabilidad'), 'tecnico');
assert.equal(real('1RO Gestión Financiera y Contable'), 'tecnico');
assert.equal(real('1RO Soporte Informático'), 'tecnico');
assert.equal(real('3RO Comercialización y Ventas'), 'tecnico');
assert.equal(real('1ro Bachillerato'), 'ciencias');
assert.equal(real('1ro de BACHILLERATO'), 'ciencias');
assert.equal(real('2do Bachillerato'), 'ciencias');
assert.equal(real('1RO Ciencias'), 'ciencias');
assert.equal(real('2DO Cualquier cosa', { figura_id: 'f1' }), 'tecnico');
assert.equal(tipoBachillerato({ nombre: '9no EGB', nivel: 'EGB' }, {}), 'otro');

const cargas = [
  { id: 'c1', docenteId: 'd1', docenteNombre: 'YUNGA ALVARADO JESSENIA', materiaNombre: 'Historia', gradoNombre: '1er Año BT Gestión', paraleloNombre: 'D' },
  { id: 'c2', docenteId: 'd1', docenteNombre: 'YUNGA ALVARADO JESSENIA', materiaNombre: 'Historia', gradoNombre: '2do Bachillerato', paraleloNombre: 'A' },
  { id: 'c3', docenteId: 'd2', docenteNombre: 'BARRETO MUÑOZ CARLOS', materiaNombre: 'Matemática', gradoNombre: '1er Año BT Gestión', paraleloNombre: 'D' },
  { id: 'c4', docenteId: 'd3', docenteNombre: 'BARRETO MUÑOZ CARLOS', materiaNombre: 'Física', gradoNombre: '3ro Bachillerato', paraleloNombre: 'B' }   // homónimo: otro docente
];
const docs = agruparDocentes(cargas);
assert.equal(docs.length, 3);                                   // dos "Barreto Muñoz Carlos" distintos NO se mezclan
assert.deepEqual(docs.map(d => d.id), ['d2', 'd3', 'd1']);
assert.equal(docs.find(d => d.id === 'd1').cargas.length, 2);

// Búsqueda: cualquier orden, sin tildes, y por materia/curso
assert.deepEqual(buscarDocentes(docs, 'jessenia yunga').map(d => d.id), ['d1']);
assert.deepEqual(buscarDocentes(docs, 'MUNOZ').map(d => d.id), ['d2', 'd3']);
assert.deepEqual(buscarDocentes(docs, 'matematica').map(d => d.id), ['d2']);
assert.deepEqual(buscarDocentes(docs, '').length, 3);
assert.deepEqual(buscarDocentes(docs, 'zzz'), []);

const bl = [
  { id: 'b1', docente_materia_id: 'c1', paralelo_id: 'pD', dia: 'Lunes', franja: '07:00–07:40' },
  { id: 'b2', docente_materia_id: 'c2', paralelo_id: 'pA', dia: 'Lunes', franja: '07:00–07:40' },   // mismo docente, misma hora, otro curso → cruce
  { id: 'b3', docente_materia_id: 'c3', paralelo_id: 'pD', dia: 'Martes', franja: '07:40–08:20' },
  { id: 'b4', docente_materia_id: 'c1', paralelo_id: 'pD', dia: 'Martes', franja: '08:20–09:00' }
];
assert.deepEqual(horasUbicadas(bl), { c1: 2, c2: 1, c3: 1 });
assert.equal(bloquesDeCargas(bl, ['c1', 'c2']).length, 3);
assert.equal(bloquesDeCargas(bl, new Set(['c3'])).length, 1);
const x = cruces(bloquesDeCargas(bl, ['c1', 'c2']));
assert.equal(x.length, 1); assert.equal(x[0].dia, 'Lunes'); assert.deepEqual(x[0].cargas.sort(), ['c1', 'c2']);
assert.deepEqual(cruces(bloquesDeCargas(bl, ['c3'])), []);
assert.deepEqual(cobertura(['pA', 'pD', 'pX'], bl), { conHorario: 2, total: 3 });
const mz = matrizDia(bl, 'Lunes');
assert.equal(mz.pD['07:00–07:40'].id, 'b1'); assert.equal(mz.pA['07:00–07:40'].id, 'b2'); assert.equal(mz.pX, undefined);
console.log('consultaHorarios OK');
