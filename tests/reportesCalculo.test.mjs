import test from 'node:test';
import assert from 'node:assert/strict';
process.env.SUPABASE_URL ||= 'http://localhost'; process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'x';
const { evaluarDia } = await import('../server/src/lib/calendario.js');
const C = await import('../server/src/lib/reportesCalculo.js');

const eventos = [
  { tipo: 'feriado', descripcion: 'Día de los Difuntos', fecha_inicio: '2026-11-02', fecha_fin: '2026-11-03', paralelo_id: null },
  { tipo: 'recuperacion', descripcion: 'Sábado de recuperación', fecha_inicio: '2026-11-14', fecha_fin: '2026-11-14', paralelo_id: null },
  { tipo: 'excepcion', descripcion: 'Solo 1ro A', fecha_inicio: '2026-11-05', fecha_fin: '2026-11-05', paralelo_id: 'P1' }
];

test('días lectivos: excluye feriados y fines de semana, la recuperación fuerza el sábado', () => {
  const dias = C.diasDelRango('2026-11-02', '2026-11-15');
  const lect = C.lectivosDe(dias, eventos, null, evaluarDia);
  assert.ok(!lect.includes('2026-11-02') && !lect.includes('2026-11-03'));      // feriado
  assert.ok(!lect.includes('2026-11-07') && !lect.includes('2026-11-08'));      // fin de semana
  assert.ok(lect.includes('2026-11-14'));                                         // recuperación
  assert.ok(lect.includes('2026-11-05'));                                         // la excepción de un paralelo no afecta al plantel
  assert.equal(lect.length, 9);                                                   // 4,5,6 + 9..13 + el sábado 14
});

test('la excepción de un paralelo sí afecta a ese paralelo', () => {
  const dias = C.diasDelRango('2026-11-04', '2026-11-06');
  assert.ok(!C.lectivosDe(dias, eventos, 'P1', evaluarDia).includes('2026-11-05'));
  assert.ok(C.lectivosDe(dias, eventos, 'P2', evaluarDia).includes('2026-11-05'));
});

test('resumen del calendario: lista feriados recortados al rango y las recuperaciones', () => {
  const dias = C.diasDelRango('2026-11-03', '2026-11-14');
  const r = C.resumenCalendario(eventos, '2026-11-03', '2026-11-14', C.lectivosDe(dias, eventos, null, evaluarDia), dias.length);
  assert.deepEqual(r.no_lectivos.map(x => [x.descripcion, x.desde, x.hasta]), [['Día de los Difuntos', '2026-11-03', '2026-11-03']]);
  assert.equal(r.recuperaciones.length, 1);
  assert.equal(r.dias_del_rango, 12);
});

test('% de asistencia: la falta justificada no penaliza', () => {
  assert.equal(C.pctAsistencia(8, 1, 1), 90);
  assert.equal(C.pctAsistencia(0, 0, 0), null);
});

test('filtros avanzados: solo con faltas y % máximo', () => {
  const est = [{ faltas: 0, pct_asistencia: 100 }, { faltas: 2, pct_asistencia: 80 }, { faltas: 5, pct_asistencia: 50 }, { faltas: 0, pct_asistencia: null }];
  assert.equal(C.filtrarPorAsistencia(est, { soloConFaltas: true, pctMax: null }).length, 2);
  assert.equal(C.filtrarPorAsistencia(est, { soloConFaltas: false, pctMax: 80 }).length, 2);
  assert.equal(C.filtrarPorAsistencia(est, { soloConFaltas: false, pctMax: null }).length, 4);
});

test('resumen por paralelo y por curso suma estudiantes, hombres, mujeres, días de falta y % de asistencia', () => {
  const mk = (id, par, gen) => ({ estudiante_id: id, paralelo_id: par, estudiantes: { genero: gen }, paralelos: { nombre: par, jornada: 'Matutina', grados: { nombre: '1ro Bachillerato' } } });
  const filas = [mk('a', 'A', 'Masculino'), mk('b', 'A', 'Femenino'), mk('c', 'B', 'Femenino')];
  const conteos = C.mapaConteos([{ e: 'a', presente: 8, atraso: 0, ausente: 2, justificado: 0, dias: 10 }, { e: 'b', presente: 10, atraso: 0, ausente: 0, justificado: 1, dias: 11 }, { e: 'c', presente: 5, atraso: 0, ausente: 5, justificado: 0, dias: 10 }]);
  const r = C.resumenPorParalelo(filas, conteos);
  assert.equal(r.resumen.length, 2);
  const A = r.resumen.find(x => x.paralelo === 'A');
  assert.deepEqual([A.total_estudiantes, A.hombres, A.mujeres, A.faltas, A.justificadas, A.pct_asistencia], [2, 1, 1, 2, 1, 90]);
  assert.equal(r.por_curso.length, 1);
  assert.equal(r.por_curso[0].paralelos, 2);
  assert.equal(r.totales.total_estudiantes, 3);
  assert.equal(r.totales.en_riesgo, 1);   // c: 50 % < 75 %
});

test('resumen por materia del docente: totales y % por carga', () => {
  const cargas = [{ id: 'd1', paralelo_id: 'P1', materia: 'Historia', curso: '2do Bachillerato', paralelo: 'A', docente: 'Ríos Andrea' },
                  { id: 'd2', paralelo_id: 'P1', materia: 'Física', curso: '2do Bachillerato', paralelo: 'A', docente: 'Ríos Andrea' }];
  const r = C.resumenPorCarga(cargas, [{ dm: 'd1', presente: 90, atraso: 5, ausente: 5, justificado: 2, fechas: 20 }], new Map([['P1', 30]]));
  assert.equal(r.filas[0].materia, 'Física');            // orden alfabético dentro del paralelo
  assert.equal(r.filas[1].pct_asistencia, 95);
  assert.equal(r.filas[0].pct_asistencia, null);          // sin registros: no inventa un %
  assert.equal(r.totales.faltas, 5);
});
