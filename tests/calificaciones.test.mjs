import assert from 'node:assert/strict';
import * as C from '../src/lib/calificaciones.js';

const cfg = C.configPorDefecto();
assert.deepEqual(C.pesosConfig(cfg), { formativo: 70, sumativo: 30, total: 100 });
assert.deepEqual(C.validarConfig(cfg), []);
assert.ok(C.validarConfig({ ...cfg, sum: [{ nombre: 'x', n: 1, peso: 20 }] }).length > 0);

// Todo en 10 -> 10
const full = { ind: cfg.ind.map(g => Array(g.n).fill(10)), grp: cfg.grp.map(g => Array(g.n).fill(10)), sum: cfg.sum.map(g => Array(g.n).fill(10)) };
let r = C.calcTrimestre(full, cfg);
assert.equal(r.nota, 10); assert.equal(r.completo, true);

// Solo formativa: parcial, máx 7 y NO completo
r = C.calcTrimestre({ ind: [[10, 10, 10]], grp: [], sum: [] }, cfg);
assert.equal(r.nota, 7); assert.equal(r.completo, false);

// Ponderación: Lección Oral (peso 5) = 10, Tareas (peso 10) = 7 -> (50+70)/15 = 8
r = C.calcTrimestre({ ind: [[10], [], [7]], grp: [], sum: [[8]] }, cfg);
assert.equal(r.formativo, 8);            // 8 -> 5.6
assert.equal(r.formativo70, 5.6);
assert.equal(r.sumativo30, 2.4);
assert.equal(r.nota, 8);

// Sumativa ponderada respeta pesos (el mockup la promediaba simple)
const cfg2 = { ...cfg, sum: [{ nombre: 'A', n: 1, peso: 10 }, { nombre: 'B', n: 1, peso: 20 }] };
r = C.calcTrimestre({ ind: [[10]], grp: [], sum: [[10], [4]] }, cfg2);
assert.equal(r.sumativo, 6); // (100+80)/30

// Truncado, no redondeo, y sin error de coma flotante
assert.equal(C.aDos(8.999), 8.99);
assert.equal(C.aDos(0.29), 0.29);
assert.equal(C.aDos(4.35), 4.35);

// Mejoras
assert.equal(C.aplicarMejora(8, { mejora_directa: 10 }), 9);
assert.equal(C.aplicarMejora(8, { mejora_directa: 5 }), 8);       // no baja
assert.equal(C.aplicarMejora(9, { mejora_directa: 10 }), 9);      // fuera de rango 7.01-8.99
assert.equal(C.aplicarMejora(6, { refuerzo: 9, mejora_refuerzo: 9 }), 8);
assert.equal(C.aplicarMejora(6, { refuerzo: 9 }), 6);             // falta el segundo
assert.equal(C.aplicarMejora(null, { mejora_directa: 10 }), null);

// Escala
assert.equal(C.escalaDAAPA(9).c, 'DA'); assert.equal(C.escalaDAAPA(8.99).c, 'AA');
assert.equal(C.escalaDAAPA(7).c, 'AA'); assert.equal(C.escalaDAAPA(6.99).c, 'PA');
assert.equal(C.escalaDAAPA(4.01).c, 'PA'); assert.equal(C.escalaDAAPA(4).c, 'NA');

// Anual (normativa vigente: sin remedial ni gracia; supletorio de 4.01 a 6.99)
assert.deepEqual(C.calcAnual([8, 8, 8]), { promedio: 8, final: 8, estado: 'aprobado' });
assert.equal(C.calcAnual([8, 8]).estado, 'pendiente');
assert.equal(C.calcAnual([6, 6, 6]).estado, 'supletorio');
assert.equal(C.calcAnual([4.01, 4.01, 4.01]).estado, 'supletorio');   // límite inferior del supletorio
assert.equal(C.calcAnual([5, 5, 5]).estado, 'supletorio');
assert.equal(C.calcAnual([6.99, 6.99, 6.99]).estado, 'supletorio');
assert.equal(C.calcAnual([4, 4, 4]).estado, 'reprobado');             // 4.00 reprueba directo
assert.equal(C.calcAnual([3, 3, 3]).estado, 'reprobado');
assert.deepEqual(C.calcAnual([6, 6, 6], 7), { promedio: 6, final: 7, estado: 'aprobado' });
// BUG del mockup corregido: supletorio < 7 NO aprueba
assert.deepEqual(C.calcAnual([6, 6, 6], 3), { promedio: 6, final: 6, estado: 'reprobado' });
assert.deepEqual(C.calcAnual([6, 6, 6], 6.99), { promedio: 6, final: 6, estado: 'reprobado' });
assert.equal(C.calcAnual([null, null, null]).estado, 'pendiente');

// Clasificador de nivel: Bachillerato y EGB Superior (8vo–10mo); el resto no
const k = (nivel, nombre) => C.claseNivelEvaluacion({ nivel, nombre });
assert.equal(k('BGU', '1ro Bachillerato'), 'BACHILLERATO');
assert.equal(k('BACHILLERATO', '1ro de BACHILLERATO'), 'BACHILLERATO');
assert.equal(k('', '3ro Bachillerato'), 'BACHILLERATO');
assert.equal(k('EGB Superior', '8vo EGB'), 'SUPERIOR');
assert.equal(k('SUPERIOR', '8vo EGB'), 'SUPERIOR');      // como lo crea el Académico
assert.equal(k('Superior', 'cualquier nombre'), 'SUPERIOR');
assert.equal(k('', '9no EGB'), 'SUPERIOR');
assert.equal(k('EGB', '10mo de EGB'), 'SUPERIOR');
assert.equal(k('EGB', 'Décimo año'), 'SUPERIOR');
assert.equal(k('', 'Octavo'), 'SUPERIOR');
assert.equal(k('EGB', '7mo EGB'), null);
assert.equal(k('MEDIA', '6to Año EGB'), null);
assert.equal(k('EGB', '2do EGB'), null);
assert.equal(k('INICIAL', 'Inicial 2'), null);
assert.equal(k('', '18vo club'), null);
assert.equal(k(null, null), null);
assert.equal(C.claseNivelEvaluacion(null), null);
console.log('OK calificaciones: todas las pruebas pasaron');
