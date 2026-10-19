import assert from 'node:assert/strict';
import { calcularPuntaje, estadoPuntaje } from '../src/lib/diagnostico.js';

assert.equal(calcularPuntaje([]), 100);
assert.equal(calcularPuntaje([{ severidad: 'alta', total: 0 }, { severidad: 'media', total: 0 }]), 100, 'sin hallazgos no resta');
assert.equal(calcularPuntaje([{ severidad: 'alta', total: 3 }, { severidad: 'media', total: 1 }, { severidad: 'baja', total: 50 }]), 100 - 12 - 6 - 2);
assert.equal(calcularPuntaje(Array(20).fill({ severidad: 'alta', total: 1 })), 0, 'nunca baja de 0');
assert.equal(estadoPuntaje(95).texto, 'Saludable');
assert.equal(estadoPuntaje(75).texto, 'Requiere atención');
assert.equal(estadoPuntaje(40).texto, 'Crítico');
console.log('diagnostico: ok');

import { porcentaje, colorCapacidad, formatearBytes, comoPorcentajeDelPico, detectarPicos, planDeLimites, PLANES_SUPABASE } from '../src/lib/diagnostico.js';
assert.equal(porcentaje(250, 500), 50);
assert.equal(porcentaje(900, 500), 100, 'no pasa de 100');
assert.equal(porcentaje(5, 0), null);
assert.equal(colorCapacidad(50), 'var(--green)'); assert.equal(colorCapacidad(75), 'var(--amber)'); assert.equal(colorCapacidad(90), 'var(--red)'); assert.equal(colorCapacidad(null), 'var(--slate)');
assert.equal(formatearBytes(0), '0 B'); assert.equal(formatearBytes(1536), '1,5 KB'); assert.equal(formatearBytes(34 * 1024 ** 2), '34 MB');
assert.deepEqual(comoPorcentajeDelPico([0, 5, 10]), [0, 50, 100]); assert.deepEqual(comoPorcentajeDelPico([0, 0]), [0, 0]);
assert.deepEqual(detectarPicos([0, 2, 3, 2, 300, 0, 4]), [4], 'solo el pico enorme');
assert.deepEqual(detectarPicos([0, 0, 0]), []); assert.deepEqual(detectarPicos([5, 6, 7]), [], 'por debajo del mínimo no alerta');
assert.equal(planDeLimites(PLANES_SUPABASE.free.db, PLANES_SUPABASE.free.storage), 'free'); assert.equal(planDeLimites(1, 2), 'otro');
console.log('diagnostico (capacidad): ok');
