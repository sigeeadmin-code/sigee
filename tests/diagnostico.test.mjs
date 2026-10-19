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
