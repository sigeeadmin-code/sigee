import assert from 'node:assert/strict';
import { CUENTAS_DEMO, claveAleatoria, correoCuenta, tokenValido, codigoDe, rolDeCorreo, MAX_DEMOS_ACTIVAS } from '../server/src/lib/demoActivacion.js';

assert.equal(CUENTAS_DEMO.length, 8);
assert.equal(new Set(CUENTAS_DEMO.map(c => c.clave)).size, 8, 'claves únicas');
const claves = new Set(); for (let i = 0; i < 500; i++) claves.add(claveAleatoria());
assert.equal(claves.size, 500, 'las contraseñas no se repiten');
for (const k of claves) assert.match(k, /^[a-zA-Z2-9]{5}-[a-zA-Z2-9]{5}-[a-zA-Z2-9]{5}$/);
assert.ok(![...claves].some(k => /[0OIl1]/.test(k)), 'sin caracteres ambiguos');
const id = '123e4567-e89b-12d3-a456-426614174000';
assert.equal(codigoDe(id), '123e45');
assert.equal(correoCuenta('adminplantel', id, ' Ana@Colegio.EDU.ec '), 'ana@colegio.edu.ec', 'el admin usa el correo del solicitante');
assert.equal(correoCuenta('docente', id, 'x@y.com'), 'docente.123e45@demo.sigee.test');
const correos = CUENTAS_DEMO.map(c => correoCuenta(c.clave, id, 'x@y.com')); assert.equal(new Set(correos).size, 8, 'correos únicos por demo');
assert.ok(tokenValido('a'.repeat(64))); assert.ok(!tokenValido('a'.repeat(63))); assert.ok(!tokenValido('g'.repeat(64))); assert.ok(!tokenValido(null));
assert.equal(rolDeCorreo('docente.123e45@demo.sigee.test'), 'Docente'); assert.equal(rolDeCorreo('x@y.com'), 'Administrador del plantel');
assert.equal(MAX_DEMOS_ACTIVAS, 50);
console.log('demoActivacion: ok');
