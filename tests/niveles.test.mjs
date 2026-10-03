import assert from 'node:assert/strict';
import { NIVELES, ANIOS_NIVEL, ASIGNATURAS_NIVEL, nivelCanonico, combinarCatalogo, ordenarPorCatalogo, clave } from '../src/lib/niveles.js';

const n = (nivel, nombre) => nivelCanonico({ nivel, nombre });
// valores canónicos
NIVELES.forEach(v => assert.equal(n(v, ''), v));
// datos reales de SIGEE (texto libre)
assert.equal(n('BGU', '1ro Bachillerato'), 'BACHILLERATO');
assert.equal(n('BACHILLERATO', '1ro de BACHILLERATO'), 'BACHILLERATO');
assert.equal(n('', '3ro Bachillerato'), 'BACHILLERATO');
assert.equal(n('EGB', '8vo EGB'), 'SUPERIOR');
// por el nombre de cada año
for (const [niv, anios] of Object.entries(ANIOS_NIVEL)) anios.forEach(a => assert.equal(n('', a), niv, `${a} -> ${niv}`));
assert.equal(n('EGB', 'Décimo año'), 'SUPERIOR');
assert.equal(n('', 'Octavo'), 'SUPERIOR');
assert.equal(n('EGB', 'Séptimo'), 'MEDIA');
assert.equal(n('', 'Segundo de básica'), 'ELEMENTAL');
assert.equal(n('EGB', 'Primero de básica'), 'PREPARATORIA');
assert.equal(n('', 'Club de ajedrez'), null);
assert.equal(n(null, null), null);
assert.equal(nivelCanonico(null), null);

// catálogo: sin filas -> por defecto; con filas -> las de la institución, en orden
let c = combinarCatalogo([]);
NIVELES.forEach(v => { assert.deepEqual(c[v].nombres, ASIGNATURAS_NIVEL[v]); assert.equal(c[v].personalizado, false); });
assert.equal(ASIGNATURAS_NIVEL.BACHILLERATO.length, 12); assert.equal(ASIGNATURAS_NIVEL.INICIAL.length, 7);
c = combinarCatalogo([{ nivel: 'SUPERIOR', nombre: 'Física', orden: 1 }, { nivel: 'SUPERIOR', nombre: 'Matemática', orden: 0 }]);
assert.deepEqual(c.SUPERIOR.nombres, ['Matemática', 'Física']); assert.equal(c.SUPERIOR.personalizado, true);
assert.equal(c.MEDIA.personalizado, false);
// el por defecto no se comparte por referencia (editar uno no cambia el original)
c.MEDIA.nombres.push('X'); assert.ok(!ASIGNATURAS_NIVEL.MEDIA.includes('X'));

// orden por catálogo: sin importar tildes/mayúsculas; las que no están, al final
const cargas = [{ materiaNombre: 'inglés' }, { materiaNombre: 'Club' }, { materiaNombre: 'MATEMATICA' }, { materiaNombre: 'Lengua y Literatura' }];
assert.deepEqual(ordenarPorCatalogo(cargas, ASIGNATURAS_NIVEL.SUPERIOR).map(x => x.materiaNombre), ['Lengua y Literatura', 'MATEMATICA', 'inglés', 'Club']);
assert.equal(clave('  Educación   Física '), 'EDUCACION FISICA');
console.log('OK niveles: todas las pruebas pasaron');
