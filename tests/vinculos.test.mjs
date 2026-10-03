import assert from 'node:assert/strict';
import { coincidencia, cuentasQueCoinciden, fichaUnicaQueCoincide } from '../src/lib/vinculos.js';

// caso real: la cuenta y la ficha de Carlos Vivar
assert.equal(coincidencia({ cedula: '0704674670' }, { cedula: '0704674670', email: 'tutor@sigee.test' }), 'cedula');
assert.equal(coincidencia({ cedula: '070467-4670 ' }, { cedula: '0704674670' }), 'cedula');       // ignora separadores
assert.equal(coincidencia({ email: 'Tutor@SIGEE.test ' }, { email: 'tutor@sigee.test' }), 'correo');
assert.equal(coincidencia({ cedula: '0704674670' }, { cedula: '0704674671' }), null);
assert.equal(coincidencia({ cedula: '' }, { cedula: '' }), null, 'dos cédulas vacías no son coincidencia');
assert.equal(coincidencia({ cedula: '123' }, { cedula: '123' }), null, 'cédula demasiado corta no cuenta');
assert.equal(coincidencia({ email: '' }, { email: '' }), null);
assert.equal(coincidencia(null, { cedula: '0704674670' }), null);
// los nombres iguales NO bastan
assert.equal(coincidencia({ nombres: 'Carlos', cedula: '1111111111' }, { nombres: 'Carlos', cedula: '2222222222' }), null);

const cuentas = [
  { id: 'c1', cedula: '0102030405', email: 'a@x.com' },
  { id: 'c2', cedula: '0704674670', email: 'tutor@sigee.test' },
  { id: 'c3', cedula: '', email: 'vivar@x.com' }
];
// primero la que coincide por cédula
let r = cuentasQueCoinciden({ cedula: '0704674670', email: 'vivar@x.com' }, cuentas);
assert.deepEqual(r.map(x => [x.id, x.por]), [['c2', 'cedula'], ['c3', 'correo']]);
assert.deepEqual(cuentasQueCoinciden({ cedula: '9999999999' }, cuentas), []);
assert.deepEqual(cuentasQueCoinciden({ cedula: '0704674670' }, null), []);

// ficha única: si hay dos que podrían ser, no se adivina
const fichas = [{ id: 'f1', cedula: '0704674670' }, { id: 'f2', cedula: '0999999999' }];
assert.equal(fichaUnicaQueCoincide({ cedula: '0704674670' }, fichas).id, 'f1');
assert.equal(fichaUnicaQueCoincide({ cedula: '0000000000' }, fichas), null);
assert.equal(fichaUnicaQueCoincide({ cedula: '0704674670' }, [...fichas, { id: 'f3', cedula: '0704674670' }]), null);
assert.equal(fichaUnicaQueCoincide({}, fichas), null);
console.log('OK vinculos: todas las pruebas pasaron');
