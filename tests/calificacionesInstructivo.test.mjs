import assert from 'node:assert/strict';
import * as C from '../src/lib/calificaciones.js';
import * as S from '../server/src/lib/calificaciones.js';

// El Instructivo de Evaluación 2025 manda promedios a 2 decimales TRUNCADOS, sin redondeo (Bachillerato).
const cfg = { ind: [{ nombre: 'A1', n: 3, peso: 35 }, { nombre: 'A2', n: 3, peso: 35 }], grp: [], sum: [{ nombre: 'EXAMEN', n: 1, peso: 15 }, { nombre: 'PROYECTO', n: 1, peso: 15 }] };
assert.deepEqual(C.validarConfig(cfg), []);

// Ejemplo del Instructivo: formativa 7,33 -> 70% = 5,13; sumativa 8,00 -> 30% = 2,40; nota 7,53
let r = C.calcTrimestre({ ind: [[7, 7, 8], [7, 7, 8]], grp: [], sum: [[8], [8]] }, cfg);
assert.equal(r.formativo, 7.33); assert.equal(r.formativo70, 5.13); assert.equal(r.sumativo30, 2.4); assert.equal(r.nota, 7.53);

// Truncado, no redondeo: caso real de Historia (Alvarado): sumativa 7,75 -> 30% = 2,325 se queda en 2,32 y la nota en 9,32
r = C.calcTrimestre({ ind: [[10, 10, 10], [10]], grp: [], sum: [[6.5], [9]] }, cfg);
assert.equal(r.sumativo, 7.75); assert.equal(r.sumativo30, 2.32); assert.equal(r.nota, 9.32);
// 8,999 no sube a 9: un 8,99 nunca se vuelve 9,00 por aproximación
r = C.calcTrimestre({ ind: [[10, 10, 10], [10, 10, 10]], grp: [], sum: [[6.62], [6.62]] }, cfg);   // sumativa 6,62 -> 30% = 1,986 -> 1,98
assert.equal(r.sumativo30, 1.98); assert.equal(r.nota, 8.98);

// El servidor y la pantalla calculan IGUAL (un solo criterio)
for (const casos of [
  { ind: [[10, 10, 10], [10]], grp: [], sum: [[6.5], [9]] },
  { ind: [[7, 7, 8], [7, 7, 8]], grp: [], sum: [[8], [8]] },
  { ind: [[0.1, 10, 9.75], [8, null, null]], grp: [], sum: [[5], [9.5]] }
]) {
  const a = C.calcTrimestre(casos, cfg), s = S.calcTrimestre(casos, cfg);
  assert.equal(a.nota, s.nota); assert.equal(a.formativo, s.formativo); assert.equal(a.sumativo, s.sumativo);
}

// Aportes sin notas no cuentan (como Actividad 3 y 4 vacías en Historia); sin sumativa la nota NO es definitiva
r = C.calcTrimestre({ ind: [[10, 10, 10], [], []], grp: [], sum: [[], []] }, cfg);
assert.equal(r.completo, false);
// Config con 12 actividades de 3 casilleros (Matemática) es válida si los pesos suman 70/30
const m = { ind: Array.from({ length: 12 }, (_, i) => ({ nombre: `Actividad ${i + 1}`, n: 3, peso: i < 8 ? 5.83 : 5.84 })), grp: [], sum: [{ nombre: 'EXAMEN', n: 1, peso: 15 }, { nombre: 'PROYECTO', n: 1, peso: 15 }] };
assert.deepEqual(C.validarConfig(m), []);
assert.ok(C.validarConfig({ ...m, ind: m.ind.map(g => ({ ...g, peso: 5 })) }).length > 0);   // 60 en vez de 70: se rechaza
console.log('calificacionesInstructivo OK');
