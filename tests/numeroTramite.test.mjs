import assert from 'node:assert/strict';
import { aplicarNumeroTramite, refOrigen, TIPO_TRAMITE_DE_FICHA } from '../src/lib/numeroTramite.js';

const oficio = { numero: '', bloques: [{ t: 'texto', texto: 'Machala, 24 de octubre', alin: 'derecha' }, { t: 'texto', texto: 'Oficio Nro. ________', negrita: true }, { t: 'texto', texto: 'Texto libre\nNro. no tocar' }] };
const r = aplicarNumeroTramite(oficio, '0005-2026-07H01222');
assert.equal(r.numero, '0005-2026-07H01222');
assert.equal(r.bloques[1].texto, 'Oficio Nro. 0005-2026-07H01222');
assert.equal(r.bloques[2].texto, 'Texto libre\nNro. no tocar');           // los textos de varias líneas no se tocan
assert.equal(oficio.bloques[1].texto, 'Oficio Nro. ________');            // el original no se modifica

const plan = { bloques: [{ t: 'texto', texto: 'Ficha de seguimiento académico y plan individual de refuerzo pedagógico', negrita: true, alin: 'centro' }] };
assert.equal(aplicarNumeroTramite(plan, '0006').bloques[0].texto, 'Ficha de seguimiento académico y plan individual de refuerzo pedagógico Nro. 0006');
const conNum = { bloques: [{ t: 'texto', texto: 'Acta de reunión y compromiso Nro. 12', negrita: true }] };
assert.equal(aplicarNumeroTramite(conNum, '0007').bloques[0].texto, 'Acta de reunión y compromiso Nro. 0007');
assert.equal(aplicarNumeroTramite(null, '1'), null);
assert.equal(aplicarNumeroTramite(oficio, ''), oficio);
assert.equal(refOrigen('oficio_rendimiento', 'T1'), 'oficio_rendimiento:T1');
assert.deepEqual(Object.keys(TIPO_TRAMITE_DE_FICHA).sort(), ['acta_compromiso', 'ficha_tutor', 'oficio_rendimiento', 'plan_refuerzo']);
assert.equal(TIPO_TRAMITE_DE_FICHA.oficio_rendimiento, 'oficio_alerta');
console.log('numeroTramite: OK');
