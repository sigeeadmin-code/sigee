import assert from 'node:assert/strict';
import { clasificar, umbralesValidos, estadoDia, analizarAlumno, analizarEstudiantes, diasHabiles, coberturaPorCurso, resumenPorCurso, totalesGenerales, rangoPeriodo, diaSemana, UMBRALES_DEFECTO } from '../src/lib/asistenciaAnalisis.js';

// ── clasificación ──
assert.equal(clasificar(0, 20), 'excelente');
assert.equal(clasificar(2, 20), 'excelente');
assert.equal(clasificar(4.9, 20), 'buena');
assert.equal(clasificar(10, 20), 'en_riesgo');
assert.equal(clasificar(10.1, 20), 'critica');
assert.equal(clasificar(null, 0), 'sin_datos');
assert.equal(clasificar(50, 4, { excelente: 5, buena: 10, riesgo: 60 }), 'en_riesgo', 'umbrales configurables');
assert.equal(umbralesValidos(UMBRALES_DEFECTO), true);
assert.equal(umbralesValidos({ excelente: 5, buena: 3, riesgo: 10 }), false);
assert.equal(umbralesValidos({ excelente: 'a', buena: 3, riesgo: 10 }), false);

// ── un día con varias materias ──
assert.equal(estadoDia(['presente', 'ausente', 'presente']), 'falta');
assert.equal(estadoDia(['presente', 'justificado']), 'justificada');
assert.equal(estadoDia(['presente', 'atraso']), 'atraso');
assert.equal(estadoDia(['presente', 'presente']), 'presente');

// ── alumno: 10 días de clase (septiembre 2026: el 5-6 y 12-13 son fin de semana); faltas el 3, 4 y 7 (racha de 3 a través del fin de semana) y el 11; justificado el 14 ──
const D = n => `2026-09-${String(n).padStart(2, '0')}`;
const dias10 = [1, 2, 3, 4, 7, 8, 9, 10, 11, 14].map(D);
const regs = dias10.flatMap((f, i) => {
  const e = [3, 4].includes(i) || i === 2 ? 'ausente' : i === 8 ? 'ausente' : i === 9 ? 'justificado' : 'presente';
  return [{ fecha: f, estado: e }, { fecha: f, estado: 'presente' }];     // dos materias por día
});
const a = analizarAlumno(regs, dias10);
assert.equal(a.dias, 10);
assert.equal(a.faltas, 4);
assert.equal(a.justificadas, 1);
assert.equal(a.presentes, 5);
assert.equal(a.rachaMax, 3);
assert.equal(a.rachaIni, D(3));
assert.equal(a.rachaFin, D(7));
assert.equal(a.rachaActual, 0);
assert.equal(a.pctFaltas, 40);
assert.equal(a.pctAsistencia, Math.round((5 / 9) * 1000) / 10, 'el día justificado no penaliza');
assert.equal(a.clase, 'critica');
assert.deepEqual(a.fechasFaltas.filter(f => f.tipo === 'injustificada').map(f => f.fecha), [D(3), D(4), D(7), D(11)]);
assert.equal(a.fechasFaltas.find(f => f.tipo === 'justificada').fecha, D(14));

// una racha que sigue vigente al final
const fin = analizarAlumno([{ fecha: D(1), estado: 'presente' }, { fecha: D(2), estado: 'ausente' }, { fecha: D(3), estado: 'ausente' }], [D(1), D(2), D(3)]);
assert.equal(fin.rachaActual, 2);
// un fin de semana de por medio no rompe la racha (solo cuentan los días en que se tomó asistencia)
const finde = analizarAlumno([D(3), D(4), D(7)].map(f => ({ fecha: f, estado: 'ausente' })), [D(3), D(4), D(7)]);
assert.equal(finde.rachaMax, 3);
// sin registros
const vacio = analizarAlumno([], []);
assert.equal(vacio.clase, 'sin_datos');
assert.equal(vacio.pctAsistencia, null);

// ── varios estudiantes y cursos ──
const alumnos = [
  { id: 'e1', nombre: 'Ana', curso: '1ro A', paraleloId: 'pA' },
  { id: 'e2', nombre: 'Beto', curso: '1ro A', paraleloId: 'pA' },
  { id: 'e3', nombre: 'Carla', curso: '2do B', paraleloId: 'pB' }
];
const registros = [
  ...dias10.slice(0, 5).map(f => ({ estudiante_id: 'e1', fecha: f, estado: 'presente' })),
  ...dias10.slice(0, 5).map(f => ({ estudiante_id: 'e2', fecha: f, estado: 'ausente' })),
];
const filas = analizarEstudiantes(alumnos, registros);
assert.equal(filas[0].id, 'e2', 'el peor va primero');
assert.equal(filas[0].clase, 'critica');
assert.equal(filas[0].rachaMax, 5);
assert.equal(filas.find(f => f.id === 'e3').clase, 'sin_datos');
assert.equal(filas.at(-1).id, 'e3');

// ── días hábiles y cobertura ──
const hab = diasHabiles(D(1), D(14), [{ tipo: 'Feriado nacional', fecha_inicio: D(10), fecha_fin: D(10) }, { tipo: 'reunion', fecha_inicio: D(2), fecha_fin: D(2) }]);
assert.equal(hab.length, 9, '10 días laborables menos 1 feriado (la reunión no cuenta como no lectivo)');
assert.ok(!hab.includes(D(5)) && !hab.includes(D(6)) && !hab.includes(D(10)));
assert.deepEqual(diasHabiles(D(5), D(1)), []);
const cob = coberturaPorCurso(alumnos, registros, hab);
const cobA = cob.find(c => c.cursoId === 'pA');
assert.equal(cobA.diasConRegistro, 5);
assert.equal(cobA.pctCobertura, Math.round((5 / 9) * 1000) / 10);
assert.equal(cob.find(c => c.cursoId === 'pB').diasConRegistro, 0);
assert.equal(cob[0].cursoId, 'pB', 'el curso sin registros va primero');
assert.equal(cobA.ultimosSinRegistro.length, 4);

// ── resumen por curso y totales ──
const rc = resumenPorCurso(filas);
assert.equal(rc.find(c => c.curso === '1ro A').estudiantes, 2);
assert.equal(rc.find(c => c.curso === '1ro A').criticos, 1);
assert.equal(rc.find(c => c.curso === '1ro A').conRacha, 1);
const tot = totalesGenerales(filas, cob);
assert.equal(tot.pctAsistencia, 50);
assert.equal(tot.cursosSinRegistro, 1);
assert.equal(tot.rachaMax, 5);
assert.equal(tot.estudiantes, 3);

// ── períodos ──
const hoy = new Date(2026, 9, 8);   // jueves 8 de octubre de 2026
assert.deepEqual(rangoPeriodo('semana', hoy), { desde: '2026-10-02', hasta: '2026-10-08' });
assert.deepEqual(rangoPeriodo('mes', hoy), { desde: '2026-10-01', hasta: '2026-10-08' });
assert.deepEqual(rangoPeriodo('mes_anterior', hoy), { desde: '2026-09-01', hasta: '2026-09-30' });
assert.equal(diaSemana('2026-10-08'), 'Jueves');

console.log('OK asistenciaAnalisis: todas las pruebas pasaron');
