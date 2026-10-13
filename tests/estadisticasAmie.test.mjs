import assert from 'node:assert/strict';
import * as A from '../src/lib/estadisticasAmie.js';

const F = [
  { id: '1', amie: '07H00001', nombre: 'UNIDAD A', canton: 'MACHALA', parroquia: 'LA PROVIDENCIA', sostenimiento: 'Fiscal', nivel_educativo: 'Educación General Básica', jornada: 'Matutina', estudiantes_ref: 100, docentes_ref: 5, estudiantes_sistema: 10, docentes_sistema: 2, administrativos_sistema: 1, finanzas_habilitado: false },
  { id: '2', amie: '07H00002', nombre: 'COLEGIO B', canton: 'MACHALA', parroquia: 'LA PROVIDENCIA', sostenimiento: 'Particular', nivel_educativo: 'Bachillerato', jornada: 'Matutina', estudiantes_ref: 50, docentes_ref: 3, estudiantes_sistema: 0, docentes_sistema: 0, administrativos_sistema: 0, finanzas_habilitado: true },
  { id: '3', amie: '07H00003', nombre: 'ESCUELA C', canton: 'PASAJE', parroquia: 'BUENAVISTA', sostenimiento: 'Fiscal', nivel_educativo: 'Educación General Básica', jornada: 'Vespertina', estudiantes_ref: 0, docentes_ref: 0, estudiantes_sistema: 0, docentes_sistema: 0, administrativos_sistema: 0, finanzas_habilitado: false },
  { id: '4', amie: '07H00004', nombre: 'SIN DATOS', canton: 'PASAJE', parroquia: 'BUENAVISTA', sostenimiento: null, nivel_educativo: 'Bachillerato', jornada: 'Matutina', estudiantes_ref: 0, docentes_ref: 0, estudiantes_sistema: 0, docentes_sistema: 0, administrativos_sistema: 0, finanzas_habilitado: false }
];

const c = A.contar(F, 'sostenimiento');
assert.deepEqual(c.map(x => [x.clave, x.n]), [['Fiscal', 2], ['Particular', 1], ['Sin dato', 1]]);
assert.equal(c[0].pct, 50);
assert.equal(A.contar([], 'jornada').length, 0);

const t = A.totales(F);
assert.equal(t.planteles, 4); assert.equal(t.estudiantesRef, 150); assert.equal(t.docentesSistema, 2); assert.equal(t.conFinanzas, 1);
assert.equal(t.promEstudiantesRef, 38);                    // 150 / 4 = 37.5 → 38

const cant = A.agruparCantones(F);
assert.equal(cant.length, 2); assert.equal(cant[0].canton, 'MACHALA'); assert.equal(cant[0].planteles, 2);
assert.deepEqual(cant[0].sostenimientos, { Fiscal: 1, Particular: 1 }); assert.equal(cant[0].parroquias, 1);

assert.equal(A.filtrar(F, { canton: 'PASAJE' }).length, 2);
assert.equal(A.filtrar(F, { canton: 'PASAJE', nivel: 'Bachillerato' }).length, 1);
assert.equal(A.filtrar(F, { texto: ' colegio ' }).length, 1);
assert.equal(A.filtrar(F, { texto: '07h00003' }).length, 1);
assert.equal(A.filtrar(F).length, 4);

assert.equal(A.nivelCorto('x'.repeat(40), 10), 'xxxxxxxxxx…'); assert.equal(A.nivelCorto(null), 'Sin dato');
console.log('estadisticasAmie: OK');
