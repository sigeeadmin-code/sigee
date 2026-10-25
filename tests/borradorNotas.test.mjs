import assert from 'node:assert/strict';
import { claveBorrador, firmaCfg, armarBorrador, aplicarBorrador, borradorVigente, leerBorrador, guardarBorradorLS, borrarBorrador, borrarTodosLosBorradores } from '../src/lib/borradorNotas.js';

const cfg = { ind: [{ n: 3 }, { n: 3 }], grp: [], sum: [{ n: 1 }, { n: 1 }] };
const fila = (a, b) => ({ ind: [[a, '', ''], ['', '', '']], grp: [], sum: [[b], ['']], mejora: { mejora_directa: '', refuerzo: '', mejora_refuerzo: '' } });
const base = { e1: fila('8', '7'), e2: fila('9', '9'), e3: fila('', '') };

// 1) Se arma solo con los estudiantes con cambios
const grid = { ...base, e1: fila('10', '7') };
let b = armarBorrador({ grid, base, sucios: { e1: true }, cfg, ahora: 1000 });
assert.deepEqual(Object.keys(b.filas), ['e1']);
assert.equal(armarBorrador({ grid, base, sucios: {}, cfg }), null);

// 2) Se restaura sobre lo que llega del servidor si nada cambió allá
let r = aplicarBorrador({ grid: base, cfg, borrador: b, ahora: 2000 });
assert.equal(r.aplicados, 1); assert.deepEqual(r.sucios, { e1: true });
assert.equal(r.grid.e1.ind[0][0], '10'); assert.equal(r.grid.e2.ind[0][0], '9');

// 3) NO pisa notas más nuevas guardadas por otra persona/dispositivo
const servidorCambio = { ...base, e1: fila('9.5', '7') };
r = aplicarBorrador({ grid: servidorCambio, cfg, borrador: b, ahora: 2000 });
assert.equal(r.aplicados, 0); assert.equal(r.descartados, 1); assert.equal(r.grid.e1.ind[0][0], '9.5');

// 4) Estudiante que ya no está en el curso, o configuración distinta o borrador vencido: no se aplica nada
const sinE1 = { e2: base.e2, e3: base.e3 };
assert.equal(aplicarBorrador({ grid: sinE1, cfg, borrador: b, ahora: 2000 }).aplicados, 0);
assert.equal(aplicarBorrador({ grid: base, cfg: { ...cfg, ind: [{ n: 3 }] }, borrador: b, ahora: 2000 }).aplicados, 0);
assert.equal(borradorVigente(b, 1000 + 3 * 24 * 3600 * 1000 + 1), false);
assert.equal(aplicarBorrador({ grid: base, cfg, borrador: b, ahora: 1000 + 4 * 24 * 3600 * 1000 }).aplicados, 0);
assert.equal(aplicarBorrador({ grid: base, cfg, borrador: null }).aplicados, 0);
assert.equal(aplicarBorrador({ grid: base, cfg, borrador: { v: 9 } }).aplicados, 0);

// 5) La firma de la configuración detecta cambios de estructura
assert.notEqual(firmaCfg(cfg), firmaCfg({ ...cfg, sum: [{ n: 1 }] }));

// 6) Almacenamiento: guarda, lee, borra y borra todo; y NUNCA lanza error aunque falle el navegador
const mem = new Map();
const store = { get length() { return mem.size; }, key: i => [...mem.keys()][i] ?? null, getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v), removeItem: k => mem.delete(k) };
const k1 = claveBorrador('p1', 'c1', 'T1'), k2 = claveBorrador('p1', 'c2', 'T1');
assert.equal(guardarBorradorLS(k1, b, store), true); assert.equal(guardarBorradorLS(k2, b, store), true);
store.setItem('otra:cosa', 'x');
assert.deepEqual(leerBorrador(k1, store), b);
borrarBorrador(k1, store); assert.equal(leerBorrador(k1, store), null);
borrarTodosLosBorradores(store); assert.equal(leerBorrador(k2, store), null); assert.equal(store.getItem('otra:cosa'), 'x');
const roto = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('cuota'); }, removeItem() { throw new Error('x'); }, length: 1, key() { throw new Error('x'); } };
assert.equal(leerBorrador(k1, roto), null); assert.equal(guardarBorradorLS(k1, b, roto), false);
borrarBorrador(k1, roto); borrarTodosLosBorradores(roto);
assert.equal(guardarBorradorLS(k1, b, null), false); assert.equal(leerBorrador(k1, null), null);
// Un borrador corrupto no rompe nada
mem.set(k1, '{no es json'); assert.equal(leerBorrador(k1, store), null);
console.log('borradorNotas OK');
