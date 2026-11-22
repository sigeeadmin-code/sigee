import test from 'node:test';
import assert from 'node:assert/strict';
import { construirDocDece, TIPOS_DOC, indicadores, lineaDeTiempo, estadoTrasAccion, siguienteCodigo, revisionVencida, fechaLarga, tituloDoc } from '../src/lib/deceInformes.js';
import { textoCompleto } from '../src/lib/fichasRendimiento.js';

const inst = { nombre: 'Unidad Educativa Demo', amie: '07H00001' };
const est = { id: 'e1', nombre: 'Pérez Ana', cedula: '0102030405', curso: '1ro Bachillerato', paralelo: 'A', representante: 'Pérez Luis' };
const caso = { id: 'c1', codigo: 'DECE-2026-001', categoria: 'aprendizaje', origen: 'tutor', nivel_riesgo: 'medio', estado: 'intervencion', fecha_deteccion: '2026-11-02', descripcion: 'Bajo rendimiento sostenido.' };

test('cada tipo genera un documento editable con cabecera, pie reservado y firma DECE', () => {
  for (const tipo of Object.keys(TIPOS_DOC)) {
    const d = construirDocDece(tipo, { institucion: inst, estudiante: est, caso, profesional: { nombre: 'Lic. Mora' }, fecha: '2026-11-21' });
    assert.match(d.cabecera.institucion, /UNIDAD EDUCATIVA DEMO/);
    assert.match(d.cabecera.subtitulo, /DECE/);
    assert.ok(d.bloques.length > 3, tipo);
    assert.match(d.pie, /confidencial/i);
    assert.match(d.pie, /no emite diagn[óo]sticos cl[íi]nicos/i);
    const firmas = d.bloques.find(b => b.t === 'firmas');
    assert.equal(firmas.firmas[0].nombre, 'Lic. Mora');
    const ids = d.bloques.map(b => b.id); assert.equal(new Set(ids).size, ids.length, 'ids únicos');
  }
});
test('la derivación marca la causal elegida y lista las sesiones previas', () => {
  const d = construirDocDece('informe_derivacion', { institucion: inst, estudiante: est, caso, fecha: '2026-11-21',
    derivacion: { fecha: '2026-11-20', causal: 'agravamiento', destino: 'udai', motivo: 'No hay mejoría.' }, intervenciones: [{ fecha: '2026-11-05', tipo: 'individual', resumen: 'Primera sesión' }] });
  const causales = d.bloques.filter(b => b.t === 'lista')[0].items;
  assert.equal(causales.filter(i => i.marcado).length, 1);
  assert.match(causales.find(i => i.marcado).texto, /Agravamiento/);
  assert.match(textoCompleto(d), /Primera sesión/); assert.match(textoCompleto(d), /No hay mejor/);
});
test('el oficio al representante no revela la categoría del caso', () => {
  const t = textoCompleto(construirDocDece('oficio_representante', { institucion: inst, estudiante: est, caso: { ...caso, categoria: 'violencia', descripcion: 'detalle reservado' }, fecha: '2026-11-21' }));
  assert.match(t, /PÉREZ ANA/); assert.match(t, /Pérez Luis/); assert.doesNotMatch(t, /violencia|detalle reservado/i);
});
test('tipo inválido lanza error', () => assert.throws(() => construirDocDece('otro', { estudiante: est }), /no válido/));
test('estado del caso nunca retrocede', () => {
  assert.equal(estadoTrasAccion('deteccion', 'sesion'), 'intervencion'); assert.equal(estadoTrasAccion('seguimiento', 'sesion'), 'seguimiento');
  assert.equal(estadoTrasAccion('intervencion', 'derivacion'), 'derivado'); assert.equal(estadoTrasAccion('cerrado', 'derivacion'), 'cerrado');
});
test('código consecutivo por año y revisión vencida', () => {
  assert.equal(siguienteCodigo([], 2026), 'DECE-2026-001');
  assert.equal(siguienteCodigo([{ codigo: 'DECE-2026-007' }, { codigo: 'DECE-2025-099' }], 2026), 'DECE-2026-008');
  assert.equal(revisionVencida({ estado: 'intervencion', proxima_revision: '2026-11-01' }, '2026-11-21'), true);
  assert.equal(revisionVencida({ estado: 'cerrado', proxima_revision: '2026-11-01' }, '2026-11-21'), false);
});
test('indicadores y línea de tiempo', () => {
  const k = indicadores({ casos: [caso, { ...caso, id: 'c2', estado: 'cerrado' }, { ...caso, id: 'c3', nivel_riesgo: 'alto', proxima_revision: '2026-11-01' }], derivaciones: [{ estado: 'enviada' }, { estado: 'cerrada' }], documentos: [{ fecha: '2026-11-03' }, { fecha: '2026-10-30' }] }, '2026-11-21');
  assert.deepEqual(k, { abiertos: 2, riesgoAlto: 1, revisionVencida: 1, derivadosActivos: 1, informesMes: 1 });
  const t = lineaDeTiempo({ caso, intervenciones: [{ id: 'i1', fecha: '2026-11-05', tipo: 'individual', resumen: 'x' }], documentos: [{ id: 'd1', fecha: '2026-11-10', titulo: 'Plan', tipo: 'plan_intervencion' }] });
  assert.deepEqual(t.map(e => e.fecha), ['2026-11-10', '2026-11-05', '2026-11-02']);
});
test('fecha larga y título por defecto', () => { assert.equal(fechaLarga('2026-11-21'), '21 de noviembre de 2026'); assert.match(tituloDoc('plan_intervencion', est, '2026-11-21'), /Plan de intervención · Pérez Ana · 21\/11\/2026/); });
