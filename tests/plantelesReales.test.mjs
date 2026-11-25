import test from 'node:test';
import assert from 'node:assert/strict';
import { idsPlantelesReales, soloPlantelesReales, limpiar, pctAsist } from '../src/lib/plantelesReales.js';

const insts = [
  { id: 'A', nombre: 'Colegio A', activo: true, es_demo: false },
  { id: 'B', nombre: 'Colegio B', activo: true },                       // es_demo ausente = real
  { id: 'D', nombre: 'Demo', activo: true, es_demo: true },
  { id: 'X', nombre: 'Inactivo', activo: false, es_demo: false }
];

test('la suma global solo incluye colegios reales y activos', () => {
  assert.deepEqual([...idsPlantelesReales(insts)].sort(), ['A', 'B']);
  const docentes = [{ institucion_id: 'A' }, { institucion_id: 'A' }, { institucion_id: 'B' }, { institucion_id: 'D' }, { institucion_id: 'X' }, { institucion_id: 'OCULTO' }];
  assert.equal(soloPlantelesReales(docentes, insts).length, 3);
});

test('si la lista de planteles no cargó, no se filtra (no se ocultan datos por un fallo)', () => {
  const filas = [{ institucion_id: 'A' }, { institucion_id: 'Z' }];
  assert.equal(soloPlantelesReales(filas, []).length, 2);
  assert.equal(soloPlantelesReales(filas, undefined).length, 2);
});

test('limpiar quita tabulaciones y espacios repetidos de los nombres de plantel', () => {
  assert.equal(limpiar('UNIDAD EDUCATIVA "ISMAEL PÉREZ PAZMIÑO"\t\t\t\t\t\t'), 'UNIDAD EDUCATIVA "ISMAEL PÉREZ PAZMIÑO"');
  assert.equal(limpiar(null), '');
});

test('% de asistencia: justificados no penalizan y sin registros da null', () => {
  assert.equal(pctAsist(8, 1, 1), 90);
  assert.equal(pctAsist(0, 0, 0), null);
  assert.equal(pctAsist(10, 0, 0), 100);
});
