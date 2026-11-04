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

// oficio por inasistencia → documento del trámite
import { construirOficio, oficioADocumento } from '../src/lib/oficioFaltas.js';
const of = construirOficio({
  institucion: { nombre: 'U.E. Prueba', amie: '07H00094', canton: 'Machala' },
  alumno: { nombre: 'Mateo Cárdenas', cedula: '0705381246', curso: '10mo A', faltas: 3, dias: 40, pctFaltas: 7.5, rachaMax: 3, rachaIni: '2026-10-05', rachaFin: '2026-10-07',
    fechasFaltas: [{ fecha: '2026-10-05', tipo: 'injustificada' }, { fecha: '2026-10-06', tipo: 'injustificada' }, { fecha: '2026-10-07', tipo: 'injustificada' }] },
  periodo: { desde: '2026-10-01', hasta: '2026-10-31' }, opciones: { fechaEmision: new Date(2026, 10, 4), ciudad: 'Machala', firmanteNombre: 'Lcdo. X' }
});
const d = oficioADocumento(of, 'Mateo Cárdenas');
assert.equal(d.tipo, 'oficio_faltas');
assert.equal(d.titulo, 'Oficio de inasistencias — Mateo Cárdenas');
assert.equal(d.cabecera.amie, 'AMIE 07H00094');
assert.ok(d.bloques.some(b => b.t === 'tabla' && b.filas.length === 3));
assert.ok(d.bloques.some(b => b.t === 'firmas' && b.firmas[0].nombre === 'Lcdo. X'));
assert.ok(d.bloques.every(b => b.id), 'todos los bloques tienen id');
assert.equal(new Set(d.bloques.map(b => b.id)).size, d.bloques.length, 'ids únicos');
const num = aplicarNumeroTramite(d, '0008-2026-07H00094');
assert.equal(num.bloques.find(b => /Nro\./.test(b.texto || '')).texto, 'OFICIO Nro. 0008-2026-07H00094');
assert.equal(d.bloques.find(b => /Nro\./.test(b.texto || '')).texto, 'OFICIO Nro. ________');
console.log('oficioADocumento: OK');
