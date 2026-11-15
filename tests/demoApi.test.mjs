import assert from 'node:assert/strict';
import { validarSolicitudDemo, normalizarSolicitud, solicitarDemo } from '../src/lib/demoApi.js';
import { validarCedulaEC } from '../src/lib/cedula.js';

// Cédula válida generada con el módulo 10 (no corresponde a una persona real).
let cedulaOk = '';
for (let i = 0; i < 1e6 && !cedulaOk; i++) { const c = '07' + String(i).padStart(8, '0'); if (validarCedulaEC(c)) cedulaOk = c; }
const base = { nombre: 'Ana Pérez Loor', cedula: cedulaOk, email: 'Ana@Colegio.edu.ec', institucion: 'Unidad Educativa Ejemplo', cargo: 'Rector/a', telefono: '', acepta: true, sitio_web: '' };

assert.deepEqual(validarSolicitudDemo(base), {}, 'una solicitud completa no debe tener errores');
const mal = validarSolicitudDemo({ ...base, nombre: 'Ana', email: 'x', cargo: '', acepta: false, institucion: 'a', cedula: '1234567890' });
for (const k of ['nombre', 'email', 'cargo', 'acepta', 'institucion', 'cedula']) assert.ok(mal[k], 'falta error en ' + k);
assert.ok(validarSolicitudDemo({ ...base, telefono: '12ab' }).telefono, 'teléfono con letras');
const n = normalizarSolicitud({ ...base, cedula: '075-076.1942' });
assert.equal(n.email, 'ana@colegio.edu.ec'); assert.equal(n.cedula, '0750761942');
assert.equal(normalizarSolicitud({ ...base, sitio_web: 'http://spam' }).sitio_web, 'http://spam', 'la trampa viaja para que el servidor la descarte');

const resp = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
const llamar = r => solicitarDemo(base, { apiUrl: 'https://api.test', fetchFn: async () => { if (r instanceof Error) throw r; return r; } });
assert.equal((await llamar(resp(200, {}))).ok, true);
assert.equal((await llamar(resp(404, {}))).codigo, 'no_disponible');
assert.equal((await llamar(resp(429, {}))).codigo, 'limite');
assert.equal((await llamar(resp(409, { error: 'ya existe' }))).mensaje, 'ya existe');
assert.equal((await llamar(new Error('x'))).codigo, 'red');
assert.equal((await solicitarDemo(base, { simulado: true })).codigo, 'simulado');
let url = ''; await solicitarDemo(base, { apiUrl: 'https://api.test', fetchFn: async (u) => { url = u; return resp(200, {}); } });
assert.equal(url, 'https://api.test/demo/solicitar');
console.log('demoApi: ok');
