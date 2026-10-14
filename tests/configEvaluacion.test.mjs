import assert from 'node:assert/strict';
import { sanitizarConfig } from '../server/src/lib/configEvaluacion.js';
import { configPorDefecto, validarConfig } from '../src/lib/calificaciones.js';
import { validarConfig as validarServidor } from '../server/src/lib/calificaciones.js';

const ok = sanitizarConfig(configPorDefecto());
assert.ok(ok.config && validarConfig(ok.config).length === 0, 'la plantilla institucional es válida');

// nombres: se limpian, se recortan y no pueden repetirse
const sucio = configPorDefecto(); sucio.ind[0].nombre = '  <b>Lección   Oral</b>\n' + 'x'.repeat(100);
const s1 = sanitizarConfig(sucio).config;
assert.ok(!/[<>\n]/.test(s1.ind[0].nombre) && s1.ind[0].nombre.length <= 60);
const dup = configPorDefecto(); dup.grp[0].nombre = 'tareas';
assert.match(sanitizarConfig(dup).error, /mismo nombre/);

// estructura mínima y tope de rubros
const sinSum = configPorDefecto(); sinSum.sum = [];
assert.match(sanitizarConfig(sinSum).error, /sumativa/);
const muchos = configPorDefecto(); muchos.ind = Array.from({ length: 13 }, (_, i) => ({ nombre: 'R' + i, n: 1, peso: 1 }));
assert.match(sanitizarConfig(muchos).error, /Máximo/);
assert.ok(sanitizarConfig({ ind: 'x', grp: [], sum: [] }).error);

// pesos: 70/30 exactos (con tolerancia de decimales), n entero 1–10
const c = configPorDefecto(); c.ind[0].peso = 4.5; c.ind[1].peso = 5.5;       // sigue sumando 70
assert.equal(validarConfig(sanitizarConfig(c).config).length, 0);
c.ind[0].peso = 6;                                                            // ahora 71
assert.ok(validarConfig(sanitizarConfig(c).config).some(e => /70 formativo/.test(e)));
const d = configPorDefecto(); d.ind[0].n = 11;
assert.ok(validarConfig(sanitizarConfig(d).config).some(e => /entero 1-10/.test(e)));
const e = configPorDefecto(); e.ind[0].n = 2.5;
assert.ok(validarConfig(sanitizarConfig(e).config).length > 0);
const nan = configPorDefecto(); nan.ind[0].peso = 'abc';
assert.ok(validarConfig(sanitizarConfig(nan).config).length > 0);
// decimales típicos no rompen la suma
const dec = configPorDefecto(); dec.ind[0].peso = 2.5; dec.ind[1].peso = 7.5;
assert.equal(validarConfig(sanitizarConfig(dec).config).length, 0);
// ambas copias de validarConfig se comportan igual
for (const cfg of [configPorDefecto(), c, d, dec]) assert.deepEqual(validarConfig(cfg), validarServidor(cfg));
console.log('OK configEvaluacion: todas las pruebas pasaron');
