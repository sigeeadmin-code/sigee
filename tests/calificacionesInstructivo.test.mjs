import assert from 'node:assert/strict';
import * as C from '../src/lib/calificaciones.js';
import * as S from '../server/src/lib/calificaciones.js';

// Regla vigente en SIGEE: promedios a 2 decimales REDONDEADOS (decisión de la institución).
// Nota: el Instructivo de Evaluación Estudiantil 2025 del Mineduc indica dos decimales truncados, sin redondeo; si algún día se vuelve
// a esa regla, se cambia MODO_DECIMALES a 'truncar' en las dos copias de la librería y estas pruebas muestran qué números cambian.
assert.equal(C.MODO_DECIMALES, 'redondear'); assert.equal(S.MODO_DECIMALES, 'redondear');
const cfg = { ind: [{ nombre: 'A1', n: 3, peso: 35 }, { nombre: 'A2', n: 3, peso: 35 }], grp: [], sum: [{ nombre: 'EXAMEN', n: 1, peso: 15 }, { nombre: 'PROYECTO', n: 1, peso: 15 }] };
assert.deepEqual(C.validarConfig(cfg), []);

// Ejemplo del Instructivo (da lo mismo redondeando o truncando): formativa 7,33 -> 70% = 5,13; sumativa 8,00 -> 30% = 2,40; nota 7,53
let r = C.calcTrimestre({ ind: [[7, 7, 8], [7, 7, 8]], grp: [], sum: [[8], [8]] }, cfg);
assert.equal(r.formativo, 7.33); assert.equal(r.formativo70, 5.13); assert.equal(r.sumativo30, 2.4); assert.equal(r.nota, 7.53);

// Caso real de Historia (Alvarado): sumativa 7,75 -> 30% = 2,325 se redondea a 2,33 y la nota queda en 9,33 (truncando era 9,32)
r = C.calcTrimestre({ ind: [[10, 10, 10], [10]], grp: [], sum: [[6.5], [9]] }, cfg);
assert.equal(r.sumativo, 7.75); assert.equal(r.sumativo30, 2.33); assert.equal(r.nota, 9.33);
// Caso real de Historia (Calva): sumativa 6,62 -> 30% = 1,986 -> 1,99 y la nota queda en 8,99 (truncando era 8,98)
r = C.calcTrimestre({ ind: [[10, 10, 10], [10, 10, 10]], grp: [], sum: [[6.62], [6.62]] }, cfg);
assert.equal(r.sumativo30, 1.99); assert.equal(r.nota, 8.99);
// Un 8,99 nunca pasa a 9,00 por error de aproximación: hace falta de verdad 8,995 o más
assert.equal(C.aDos(8.994), 8.99); assert.equal(C.aDos(8.995), 9);

// El servidor y la pantalla calculan IGUAL (un solo criterio)
for (const casos of [
  { ind: [[10, 10, 10], [10]], grp: [], sum: [[6.5], [9]] },
  { ind: [[7, 7, 8], [7, 7, 8]], grp: [], sum: [[8], [8]] },
  { ind: [[0.1, 10, 9.75], [8, null, null]], grp: [], sum: [[5], [9.5]] },
  { ind: [[10, 10, 10], [10, 10, 10]], grp: [], sum: [[6.62], [6.62]] }
]) {
  const a = C.calcTrimestre(casos, cfg), s = S.calcTrimestre(casos, cfg);
  assert.equal(a.nota, s.nota); assert.equal(a.formativo, s.formativo); assert.equal(a.sumativo, s.sumativo);
  assert.equal(C.aplicarMejora(a.nota, { mejora_directa: 10 }), S.aplicarMejora(s.nota, { mejora_directa: 10 }));
}
// Aportes sin notas no cuentan; sin sumativa la nota NO es definitiva
r = C.calcTrimestre({ ind: [[10, 10, 10], [], []], grp: [], sum: [[], []] }, cfg);
assert.equal(r.completo, false);
// Config con 12 actividades de 3 casilleros (Matemática) es válida si los pesos suman 70/30
const m = { ind: Array.from({ length: 12 }, (_, i) => ({ nombre: `Actividad ${i + 1}`, n: 3, peso: i < 8 ? 5.83 : 5.84 })), grp: [], sum: [{ nombre: 'EXAMEN', n: 1, peso: 15 }, { nombre: 'PROYECTO', n: 1, peso: 15 }] };
assert.deepEqual(C.validarConfig(m), []);
assert.ok(C.validarConfig({ ...m, ind: m.ind.map(g => ({ ...g, peso: 5 })) }).length > 0);   // 60 en vez de 70: se rechaza
console.log('calificacionesInstructivo OK');
