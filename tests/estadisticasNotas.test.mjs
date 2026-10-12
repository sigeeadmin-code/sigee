import assert from 'node:assert/strict';
import * as E from '../src/lib/estadisticasNotas.js';

// sumar: promedio ponderado por registros y % de aprobación (sin contar "en curso")
const a = { aprobados: 3, supletorio: 3, reprobados: 2, en_curso: 0, da: 1, aa: 2, pa: 3, na: 2, promedio: '5.69', estudiantes: 8 };
const b = { aprobados: 1, supletorio: 0, reprobados: 0, en_curso: 1, da: 0, aa: 1, pa: 1, na: 0, promedio: '8.00', estudiantes: 2 };
const t = E.sumar([a, b]);
assert.equal(t.registros, 10);
assert.equal(t.promedio, 6.15);                 // (5.69*8 + 8*2) / 10 = 6.152
assert.equal(t.aprobados, 4); assert.equal(t.supletorio, 3); assert.equal(t.reprobados, 2); assert.equal(t.en_curso, 1);
assert.equal(t.pctAprobacion, 44.4);            // 4 / (4+3+2)
assert.deepEqual(E.sumar([]).promedio, null);
assert.equal(E.sumar([]).pctAprobacion, null);

// agruparColegios: junta las etapas de un mismo colegio y respeta el filtro de etapa
const filas = [
  { institucion_id: 'x', institucion: 'COLEGIO X', etapa: 'EGB Superior', ...a, estudiantes: 10, paralelos: 2 },
  { institucion_id: 'x', institucion: 'COLEGIO X', etapa: 'BGU', ...b, estudiantes: 5, paralelos: 1 },
  { institucion_id: 'y', institucion: 'COLEGIO Y', etapa: 'BGU', ...b, estudiantes: 7, paralelos: 1 }
];
const cols = E.agruparColegios(filas);
assert.equal(cols.length, 2);
assert.equal(cols.find(c => c.id === 'x').estudiantes, 15);
assert.equal(cols.find(c => c.id === 'x').registros, 10);
assert.equal(E.agruparColegios(filas, 'BGU').find(c => c.id === 'x').estudiantes, 5);
assert.equal(E.agruparColegios(filas, 'EGB Superior').length, 1);

// agruparDetalle: los estudiantes no se duplican por materia dentro de un mismo paralelo
const det = [
  { grado_id: 'g1', grado: '1ro Bachillerato', grado_orden: 1, paralelo_id: 'p1', materia_id: 'm1', materia: 'Matemática', docente_id: 'd1', docente: 'Pérez Ana', ...a, estudiantes: 30 },
  { grado_id: 'g1', grado: '1ro Bachillerato', grado_orden: 1, paralelo_id: 'p1', materia_id: 'm2', materia: 'Inglés', docente_id: 'd2', docente: 'Lopez Bo', ...b, estudiantes: 30 }
];
const gr = E.porGrado(det);
assert.equal(gr.length, 1); assert.equal(gr[0].estudiantes, 30); assert.equal(gr[0].cargas, 2);
assert.equal(E.porMateria(det).length, 2);
assert.equal(E.porDocente(det).length, 2);
assert.equal(E.porDocente([{ ...det[0], docente_id: null, docente: null }])[0].etiqueta, 'Sin docente asignado');

// escala y formato
const esc = E.porcentajesEscala({ da: 1, aa: 1, pa: 1, na: 1 });
assert.equal(esc.reduce((x, e) => x + e.pct, 0), 100);
assert.equal(E.porcentajesEscala({ da: 0, aa: 0, pa: 0, na: 0 })[0].pct, 0);
assert.equal(E.pctTxt(44.4), '44,4%'); assert.equal(E.pctTxt(null), '—');
assert.equal(E.notaTxt('6.9'), '6,90'); assert.equal(E.notaTxt(null), '—');
assert.equal(E.condicionRiesgo({ estado: 'en_curso' }), 'En riesgo (promedio < 7)');
assert.equal(E.condicionRiesgo({ estado: 'reprobado' }), 'Reprobado');

console.log('estadisticasNotas: OK');
