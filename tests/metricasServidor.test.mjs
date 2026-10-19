import assert from 'node:assert/strict';
import { crearContador, registrarPeticion, serieHoraria, leerRecursos } from '../server/src/lib/metricas.js';

const c = crearContador();
const t = Date.UTC(2026, 9, 19, 14, 30);
registrarPeticion(c, t, 100, 200); registrarPeticion(c, t + 1000, 300, 500); registrarPeticion(c, t - 3600000, 50, 200);
const s = serieHoraria(c, t, 3);
assert.equal(s.length, 3);
assert.deepEqual(s.map(x => x.peticiones), [0, 1, 2], 'rellena con ceros y ordena de la más vieja a la actual');
assert.equal(s[2].errores, 1); assert.equal(s[2].ms_prom, 200);

// no crece sin límite
const g = crearContador();
for (let i = 0; i < 200; i++) registrarPeticion(g, t - i * 3600000, 1, 200);
assert.ok(g.horas.size <= 74);

const r = leerRecursos();
assert.ok(r.memoria.total > 0 && r.memoria.usada > 0);
assert.ok(r.disco === null || (r.disco.total > 0 && r.disco.usado >= 0));
console.log('metricasServidor: ok');
