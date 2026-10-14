import assert from 'node:assert/strict';
import { historialDesdeInicio } from '../src/lib/historialAsistencia.js';

// Semana del lun 07 al vie 11 sep 2026; el miércoles 09 es feriado. Período académico desde el lunes 07.
const eventos = [
  { tipo: 'evento', descripcion: 'Primer período académico', fecha_inicio: '2026-09-07', fecha_fin: '2026-12-18' },
  { tipo: 'feriado', descripcion: 'Feriado', fecha_inicio: '2026-09-09', fecha_fin: '2026-09-09' }
];
const R = (fecha, estado, materia = 'Matemática') => ({ fecha, estado, materia });
const regs = [
  R('2026-09-07', 'presente'), R('2026-09-07', 'ausente', 'Lengua'),
  R('2026-09-08', 'justificado'),
  R('2026-09-10', 'atraso'),
  R('2026-09-20', 'ausente')                       // posterior a "hoy": no cuenta
];
const h = historialDesdeInicio(regs, eventos, '2026-09-11');
assert.equal(h.inicio, '2026-09-07');
assert.equal(h.comparativo.diasLectivos, 4);       // 07, 08, 10, 11 (el 09 es feriado)
assert.equal(h.comparativo.faltas, 1);
assert.equal(h.comparativo.justificadas, 1);
assert.equal(h.comparativo.atrasos, 1);
assert.equal(h.comparativo.diasConRegistro, 3);
assert.equal(h.comparativo.sinRegistro, 1);
assert.equal(h.comparativo.texto, '4 días lectivos · 1 falta');
assert.equal(h.dias.length, 3, 'ignora registros futuros');

// sin calendario: el inicio es el primer registro
const h2 = historialDesdeInicio([R('2026-09-08', 'presente')], [], '2026-09-10');
assert.equal(h2.inicio, '2026-09-08');
assert.equal(h2.comparativo.diasLectivos, 3);
assert.equal(h2.comparativo.texto, '3 días lectivos · 0 faltas');

// sin nada
const h3 = historialDesdeInicio([], [], '2026-09-10');
assert.equal(h3.comparativo.diasLectivos, 0);
assert.equal(h3.comparativo.texto, '0 días lectivos · 0 faltas');
console.log('historialAsistencia OK');
