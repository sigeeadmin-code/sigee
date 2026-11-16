import assert from 'node:assert/strict';
import { validarSolicitud } from '../server/src/lib/demoSolicitud.js';
import { validarCedulaEC } from '../server/src/lib/cedula.js';

let ced = ''; for (let i = 0; i < 1e6 && !ced; i++) { const c = '07' + String(i).padStart(8, '0'); if (validarCedulaEC(c)) ced = c; }
const ok = { nombre_completo: 'Ana Pérez Loor', cedula: ced, email: 'Ana@Colegio.edu.ec', institucion: 'Unidad Educativa Ejemplo', cargo: 'Rector/a', telefono: '0991234567', acepta_datos: true, sitio_web: '' };

let r = validarSolicitud(ok);
assert.equal(r.bot, false); assert.deepEqual(r.errores, {}); assert.equal(r.datos.email, 'ana@colegio.edu.ec');
assert.equal(validarSolicitud({ ...ok, sitio_web: 'http://spam' }).bot, true, 'la trampa descarta al bot');
assert.ok(validarSolicitud({ ...ok, cedula: '1234567890' }).errores.cedula, 'cédula inválida');
assert.ok(validarSolicitud({ ...ok, telefono: '' }).errores.telefono, 'WhatsApp obligatorio');
assert.ok(validarSolicitud({ ...ok, email: 'x@mailinator.com' }).errores.email, 'correo desechable');
assert.ok(validarSolicitud({ ...ok, email: 'a,b@x.com' }).errores.email, 'correo con coma');
assert.ok(validarSolicitud({ ...ok, cargo: 'Hacker' }).errores.cargo, 'cargo fuera de la lista');
assert.ok(validarSolicitud({ ...ok, acepta_datos: 'true' }).errores.acepta, 'el consentimiento debe ser true');
assert.ok(validarSolicitud(null).errores.nombre, 'cuerpo vacío no rompe');
assert.equal(validarSolicitud({ ...ok, nombre_completo: 'Ana\u0000 Pérez\n Loor' }).datos.nombre, 'Ana Pérez Loor', 'limpia caracteres de control');
console.log('demoSolicitud: ok');
