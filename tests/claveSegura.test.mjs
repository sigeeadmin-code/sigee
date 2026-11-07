import assert from 'node:assert/strict';
import { reglasClave, validarClave, fuerzaClave, LARGO_MINIMO } from '../src/lib/claveSegura.js';

assert.equal(LARGO_MINIMO, 10);
assert.equal(validarClave('Abcdefg123', 'Abcdefg123').ok, true);
assert.equal(validarClave('abcdefg123', 'abcdefg123').ok, false, 'sin mayúscula');
assert.equal(validarClave('ABCDEFG123', 'ABCDEFG123').ok, false, 'sin minúscula');
assert.equal(validarClave('Abcdefghij', 'Abcdefghij').ok, false, 'sin número');
assert.equal(validarClave('Abc123', 'Abc123').ok, false, 'muy corta');
assert.equal(validarClave('Abcdefg123', 'Abcdefg124').ok, false, 'confirmación distinta');
assert.equal(validarClave('', '').ok, false, 'vacía');
assert.equal(validarClave('Abcdefg123', 'Abcdefg123').coincide, true);
// no debe contener el usuario del correo
assert.equal(validarClave('Sigeeadmin2026', 'Sigeeadmin2026', 'sigeeadmin@gmail.com').ok, false);
assert.equal(reglasClave('Sigeeadmin2026', 'sigeeadmin@gmail.com').find(r => r.id === 'sin_correo').ok, false);
assert.equal(validarClave('Sigeeadmin2026', 'Sigeeadmin2026', 'sigee.admin@gmail.com').ok, false, 'el usuario con punto también se detecta');
assert.equal(validarClave('Sigee.Admin#2026', 'Sigee.Admin#2026', 'sigee.admin@gmail.com').ok, false, 'ni con símbolos intercalados');
assert.equal(validarClave('Zq9!mTr4kLpX', 'Zq9!mTr4kLpX', 'sigee.admin@gmail.com').ok, true);
assert.equal(reglasClave('x', 'ab@x.com').find(r => r.id === 'sin_correo').ok, true, 'usuarios muy cortos no se comparan');
assert.equal(fuerzaClave(''), 0);
assert.ok(fuerzaClave('Abcdefg123') >= 2);
assert.equal(fuerzaClave('Zq9!mTr4kLpXyz'), 4);
console.log('claveSegura: OK');
