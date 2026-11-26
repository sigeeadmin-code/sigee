import test from 'node:test';
import assert from 'node:assert/strict';
import { analizarFicha, textoEstadoClase } from '../src/lib/fichaAsistencia.js';

test('la ficha muestra la hora del atraso y que lo registró Inspección', () => {
  assert.equal(textoEstadoClase({ estado: 'atraso', hora: '07:25', observacion: 'Atraso registrado por Inspección a las 07:25' }), 'atraso 07:25 · por Inspección');
  assert.equal(textoEstadoClase({ estado: 'atraso', hora: '', observacion: '' }), 'atraso');
  assert.equal(textoEstadoClase({ estado: 'ausente', hora: '07:25', observacion: '' }), 'ausente');
});

test('el atraso con hora se cuenta como atraso (no como falta) y conserva la hora en el detalle del día', () => {
  const f = analizarFicha([
    { fecha: '2026-11-25', estado: 'atraso', materia: 'Matemática', hora: '11:20', observacion: 'Atraso registrado por Inspección a las 11:20' },
    { fecha: '2026-11-25', estado: 'presente', materia: 'Historia' }
  ]);
  assert.equal(f.clases.atrasos, 1);
  assert.equal(f.clases.ausentes, 0);
  assert.equal(f.dias[0].detalle.find(x => x.materia === 'Matemática').hora, '11:20');
});
