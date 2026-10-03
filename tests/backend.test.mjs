import assert from 'node:assert/strict';
import { crearClienteBackend, MSG_SESION_CERRADA } from '../src/lib/backend.js';

const resp = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
const mk = (respuestas, sesion = { access_token: 'viejo' }, refresh = { data: { session: { access_token: 'nuevo' } }, error: null }) => {
  const llamadas = [];
  const fetchFn = async (url, op) => { llamadas.push({ url, auth: op.headers.Authorization, metodo: op.method, body: op.body }); const r = respuestas.shift(); if (r instanceof Error) throw r; return r; };
  return { llamadas, llamar: crearClienteBackend({ apiUrl: 'https://api.test', getSession: async () => ({ data: { session: sesion } }), refreshSession: async () => refresh, fetchFn, esperas: [0, 0, 0] }) };
};

// éxito simple
let t = mk([resp(201, { ok: 1 })]);
assert.deepEqual(await t.llamar('POST', '/calificaciones', { a: 1 }), { ok: 1 });
assert.equal(t.llamadas[0].auth, 'Bearer viejo'); assert.equal(t.llamadas[0].url, 'https://api.test/calificaciones'); assert.equal(t.llamadas[0].body, '{"a":1}');

// servidor dormido: reintenta
t = mk([resp(503, {}), resp(502, {}), resp(200, { ok: 2 })]);
assert.deepEqual(await t.llamar('PUT', '/x', {}), { ok: 2 }); assert.equal(t.llamadas.length, 3);

// 401 → renueva la sesión una vez y reintenta con el token nuevo
t = mk([resp(401, { error: 'Token inválido o expirado.' }), resp(201, { ok: 3 })]);
assert.deepEqual(await t.llamar('POST', '/c', {}), { ok: 3 });
assert.equal(t.llamadas[0].auth, 'Bearer viejo'); assert.equal(t.llamadas[1].auth, 'Bearer nuevo');

// 401 y no se puede renovar (sesión cerrada en otro lado) → mensaje claro
t = mk([resp(401, {})], { access_token: 'viejo' }, { data: { session: null }, error: { message: 'Session not found' } });
await assert.rejects(() => t.llamar('POST', '/c', {}), e => e.message === MSG_SESION_CERRADA);
assert.equal(t.llamadas.length, 1);

// 401 incluso tras renovar → mensaje claro, sin bucle
t = mk([resp(401, {}), resp(401, {})]);
await assert.rejects(() => t.llamar('POST', '/c', {}), e => e.message === MSG_SESION_CERRADA);
assert.equal(t.llamadas.length, 2);

// sin sesión local
t = mk([], null);
await assert.rejects(() => t.llamar('POST', '/c', {}), e => e.message === MSG_SESION_CERRADA);

// error de validación del servidor: se muestra tal cual y NO se reintenta
t = mk([resp(422, { error: 'No se puede reducir el rubro.' })]);
await assert.rejects(() => t.llamar('PUT', '/c', {}), e => e.message === 'No se puede reducir el rubro.');
assert.equal(t.llamadas.length, 1);

// sin conexión
t = mk([new Error('fetch failed'), new Error('fetch failed'), new Error('fetch failed')]);
await assert.rejects(() => t.llamar('POST', '/c', {}), e => /No se pudo conectar/.test(e.message));
console.log('OK backend: todas las pruebas pasaron');
