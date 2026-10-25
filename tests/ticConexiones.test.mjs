import assert from 'node:assert/strict';
import { LIMITE_REALTIME_PLAN_PRO, porcentajeLimite, semaforoConexiones, resumenConexiones, limiteValido } from '../src/lib/tic.js';

assert.equal(LIMITE_REALTIME_PLAN_PRO, 500);
assert.equal(porcentajeLimite(250, 500), 50); assert.equal(porcentajeLimite(3, 500), 0.6); assert.equal(porcentajeLimite(5, 0), 0); assert.equal(porcentajeLimite(null, 500), 0);

// Semáforo: los cortes son exactos (70 % y 85 %)
assert.equal(semaforoConexiones(3, 500).id, 'normal');
assert.equal(semaforoConexiones(349, 500).id, 'normal');
assert.equal(semaforoConexiones(350, 500).id, 'atencion');   // 70 %
assert.equal(semaforoConexiones(424, 500).id, 'atencion');
assert.equal(semaforoConexiones(425, 500).id, 'critico');    // 85 %
assert.equal(semaforoConexiones(600, 500).id, 'critico');    // pasó el límite
assert.equal(semaforoConexiones(0, 0).id, 'normal');          // sin límite válido no explota

// Resumen sobre datos reales de la base (pico por día, el último elemento es hoy)
const dias = [
  { dia: '2026-10-22', pico: 2, hora_pico: '20:42', sesiones: 11, usuarios: 5, pico_bd: 19 },
  { dia: '2026-10-23', pico: 3, hora_pico: '05:30', sesiones: 32, usuarios: 8, pico_bd: 19 },
  { dia: '2026-10-24', pico: 3, hora_pico: '07:48', sesiones: 8, usuarios: 5, pico_bd: 21 },
  { dia: '2026-10-25', pico: 1, hora_pico: '00:00', sesiones: 0, usuarios: 0, pico_bd: 10 }
];
let r = resumenConexiones(dias);
assert.deepEqual(r.max, { valor: 3, dia: '2026-10-23', hora: '05:30' });   // ante empate, el primer día
assert.deepEqual(r.hoy, { valor: 1, hora: '00:00', dia: '2026-10-25' });
assert.equal(r.promedio, 2.3); assert.equal(r.diasActivos, 4); assert.equal(r.maxBd, 21);
// Sin datos o datos raros: no revienta
r = resumenConexiones([]); assert.equal(r.max.valor, 0); assert.equal(r.hoy.valor, 0); assert.equal(r.promedio, 0);
r = resumenConexiones(null); assert.equal(r.diasActivos, 0);
r = resumenConexiones([{ dia: 'x', pico: null }, { dia: 'y' }]); assert.equal(r.max.valor, 0);

// El límite que escribe el administrador se valida
assert.equal(limiteValido('500'), 500); assert.equal(limiteValido(10000), 10000); assert.equal(limiteValido(' 200 '), 200);
assert.equal(limiteValido('abc'), 500); assert.equal(limiteValido(0), 500); assert.equal(limiteValido(-5), 500); assert.equal(limiteValido(5), 500);
assert.equal(limiteValido(null), 500); assert.equal(limiteValido('', 200), 200); assert.equal(limiteValido(99999999), 500);
console.log('ticConexiones OK');
