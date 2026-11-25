import test from 'node:test';
import assert from 'node:assert/strict';
import { construirMarcas, validarMarcas, rankingDocentes, agruparPorFecha, resumenMarcas } from '../src/lib/clasesSinRegistro.js';

test('solo se mandan las excepciones: los presentes no se envían', () => {
  const m = construirMarcas({ a: { estado: 'presente' }, b: { estado: 'ausente' }, c: { estado: 'atraso', hora: '07:25', observacion: ' llegó con permiso ' } });
  assert.deepEqual(m, [{ estudiante_id: 'b', estado: 'ausente' }, { estudiante_id: 'c', estado: 'atraso', hora_llegada: '07:25', observacion: 'llegó con permiso' }]);
  assert.deepEqual(resumenMarcas(m), { ausentes: 1, atrasos: 1 });
});

test('un atraso sin hora o con hora inválida no se puede guardar', () => {
  assert.ok(validarMarcas({ a: { estado: 'atraso', hora: '' } }));
  assert.ok(validarMarcas({ a: { estado: 'atraso', hora: '7:5' } }));
  assert.ok(validarMarcas({ a: { estado: 'atraso', hora: '25:00' } }));
  assert.equal(validarMarcas({ a: { estado: 'atraso', hora: '07:25' }, b: { estado: 'ausente' } }), null);
});

test('un estado distinto de ausente/atraso (por ejemplo justificado) nunca se envía desde Inspección', () => {
  assert.deepEqual(construirMarcas({ a: { estado: 'justificado' }, b: { estado: 'presente' } }), []);
});

test('ranking por docente y agrupación por fecha', () => {
  const clases = [
    { fecha: '2026-11-24', docente: 'Ríos Andrea' }, { fecha: '2026-11-25', docente: 'Vivar Carlos' },
    { fecha: '2026-11-25', docente: 'Ríos Andrea' }, { fecha: '2026-11-24', docente: 'Ríos Andrea' }
  ];
  assert.deepEqual(rankingDocentes(clases), [{ docente: 'Ríos Andrea', total: 3 }, { docente: 'Vivar Carlos', total: 1 }]);
  const g = agruparPorFecha(clases);
  assert.deepEqual(g.map(x => [x.fecha, x.items.length]), [['2026-11-25', 2], ['2026-11-24', 2]]);
});
