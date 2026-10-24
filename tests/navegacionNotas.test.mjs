import assert from 'node:assert/strict';
import { siguienteCelda } from '../src/lib/navegacionNotas.js';

// 3 estudiantes x 2 columnas, todas libres
const todas = [];
for (let c = 0; c < 2; c++) for (let r = 0; r < 3; r++) todas.push({ r, c, ok: true });
assert.deepEqual(siguienteCelda(todas, { r: 0, c: 0 }), { r: 1, c: 0 });          // baja al siguiente estudiante
assert.deepEqual(siguienteCelda(todas, { r: 1, c: 0 }), { r: 2, c: 0 });
assert.deepEqual(siguienteCelda(todas, { r: 2, c: 0 }), { r: 0, c: 1 });          // fin de columna: primer estudiante de la siguiente
assert.equal(siguienteCelda(todas, { r: 2, c: 1 }), null);                         // última celda: se queda
assert.deepEqual(siguienteCelda(todas, { r: 1, c: 1 }, true), { r: 0, c: 1 });     // Mayús+Enter sube
assert.deepEqual(siguienteCelda(todas, { r: 0, c: 1 }, true), { r: 2, c: 0 });     // arriba de la columna: último de la anterior
assert.equal(siguienteCelda(todas, { r: 0, c: 0 }, true), null);

// El estudiante de la fila 1 faltó hoy (celdas bloqueadas): se salta
const conBloqueo = todas.map(x => (x.r === 1 ? { ...x, ok: false } : x));
assert.deepEqual(siguienteCelda(conBloqueo, { r: 0, c: 0 }), { r: 2, c: 0 });
assert.deepEqual(siguienteCelda(conBloqueo, { r: 2, c: 0 }, true), { r: 0, c: 0 });

// Una columna entera bloqueada se salta
const colBloq = todas.map(x => (x.c === 1 ? { ...x, ok: false } : x));
assert.equal(siguienteCelda(colBloq, { r: 2, c: 0 }), null);

// Casos vacíos
assert.equal(siguienteCelda([], { r: 0, c: 0 }), null);
assert.equal(siguienteCelda(todas, null), null);
// Celda actual no listada (bloqueada): avanza a la siguiente libre
assert.deepEqual(siguienteCelda(conBloqueo, { r: 1, c: 0 }), { r: 2, c: 0 });
console.log('navegacionNotas OK');
