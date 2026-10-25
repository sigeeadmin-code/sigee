import assert from 'node:assert/strict';
import { crearCache } from '../src/lib/cacheConsultas.js';

let t = 0; const c = crearCache({ ttlMs: 1000, ahora: () => t });
let llamadas = 0; const cargar = async () => { llamadas++; return { lista: [1, 2, 3] }; };

// Misma consulta seguida = una sola ida a la base; y cada quien recibe su copia
const [a, b] = await Promise.all([c.obtener('est:1', cargar), c.obtener('est:1', cargar)]);
assert.equal(llamadas, 1); a.lista.push(99); assert.deepEqual(b.lista, [1, 2, 3]);
assert.deepEqual((await c.obtener('est:1', cargar)).lista, [1, 2, 3]); assert.equal(llamadas, 1);   // dentro del tiempo: sale del caché
t = 1001; await c.obtener('est:1', cargar); assert.equal(llamadas, 2);                                 // venció: vuelve a pedir

// Invalidar por prefijo: solo borra lo suyo
await c.obtener('cfg:9', cargar); const antes = llamadas;
c.invalidar('est:'); await c.obtener('cfg:9', cargar); assert.equal(llamadas, antes);                   // cfg sigue en caché
await c.obtener('est:1', cargar); assert.equal(llamadas, antes + 1);                                     // est se pidió de nuevo
c.limpiar(); assert.equal(c.tamano(), 0);

// Los errores NO se guardan: el siguiente intento vuelve a pedir
let n = 0; const falla = async () => { n++; if (n === 1) throw new Error('sin red'); return 'ok'; };
await assert.rejects(c.obtener('x', falla), /sin red/); assert.equal(await c.obtener('x', falla), 'ok'); assert.equal(n, 2);

// Si algo cambia mientras se estaba cargando, lo viejo NO queda guardado
const c2 = crearCache({ ttlMs: 1000, ahora: () => 0 }); let ver = 1;
const lenta = async () => { const v = ver; await new Promise(r => setTimeout(r, 20)); return v; };
const p = c2.obtener('k', lenta); c2.invalidar('k'); ver = 2;
assert.equal(await p, 1);                 // quien ya esperaba recibe lo que pidió
assert.equal(await c2.obtener('k', lenta), 2); // pero lo siguiente es dato fresco, no el viejo
// Valores simples
assert.equal(await c2.obtener('n', async () => 5), 5); assert.equal(await c2.obtener('nulo', async () => null), null);
// ttl 0: junta peticiones simultáneas pero NO guarda (para listas que cambian desde muchos lugares)
const c3 = crearCache({ ttlMs: 1000, ahora: () => 0 }); let k = 0; const dato = async () => { k++; await new Promise(r => setTimeout(r, 10)); return k; };
await Promise.all([c3.obtener('lista', dato, 0), c3.obtener('lista', dato, 0)]); assert.equal(k, 1); assert.equal(c3.tamano(), 0);
await c3.obtener('lista', dato, 0); assert.equal(k, 2);   // la siguiente vez vuelve a pedir: siempre dato real
console.log('cacheConsultas OK');
