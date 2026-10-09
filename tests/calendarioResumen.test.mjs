import assert from 'node:assert/strict';
import { esDiaLectivo, contarDiasLectivos, resumenAnioLectivo } from '../src/lib/calendarioResumen.js';

// El cronograma oficial Costa-Galápagos 2026-2027 tal como se cargó en la base.
const e = (tipo, fecha_inicio, fecha_fin, descripcion) => ({ tipo, fecha_inicio, fecha_fin, descripcion });
const EV = [
  e('evento', '2026-05-04', '2026-08-07', 'Primer período académico'),
  e('evento', '2026-08-11', '2026-11-13', 'Segundo período académico'),
  e('evento', '2026-11-16', '2027-02-24', 'Tercer período académico'),
  e('vacacion', '2026-12-26', '2027-01-03', 'Vacaciones estudiantiles de fin de año'),
  e('feriado', '2026-05-25', '2026-05-25', 'Batalla de Pichincha'), e('feriado', '2026-08-10', '2026-08-10', 'Primer Grito'),
  e('feriado', '2026-10-09', '2026-10-09', 'Independencia de Guayaquil'), e('feriado', '2026-11-02', '2026-11-02', 'Difuntos'),
  e('feriado', '2026-11-03', '2026-11-03', 'Cuenca'), e('feriado', '2026-12-25', '2026-12-25', 'Navidad'),
  e('feriado', '2027-01-01', '2027-01-01', 'Año Nuevo'), e('feriado', '2027-02-08', '2027-02-09', 'Carnaval')
];

// los días lectivos del calendario cargado reproducen las cifras oficiales: 69 + 66 + 65 = 200
const r = resumenAnioLectivo(EV, '2026-10-09');
assert.deepEqual(r.periodos.map(p => p.total), [69, 66, 65]);
assert.equal(r.total, 200);
assert.equal(r.inicio, '2026-05-04');
assert.equal(r.fin, '2027-02-24');

// el tercer período se parte en 29 días antes de las vacaciones y 36 después
assert.equal(contarDiasLectivos('2026-11-16', '2026-12-24', EV), 29);
assert.equal(contarDiasLectivos('2027-01-04', '2027-02-24', EV), 36);

// hoy es el feriado del 9 de octubre: dentro del segundo período, pero no es un día lectivo
assert.equal(esDiaLectivo('2026-10-09', EV), false);
assert.equal(esDiaLectivo('2026-10-08', EV), true);
assert.equal(esDiaLectivo('2026-10-10', EV), false, 'sábado');
assert.equal(r.periodos[1].actual, true);
assert.equal(r.periodos[0].actual, false);
assert.equal(r.periodos[0].restantes, 0);
assert.equal(r.periodos[0].transcurridos, 69);
assert.equal(r.periodos[2].transcurridos, 0);
assert.equal(r.periodos[2].restantes, 65);
assert.equal(r.transcurridos + r.restantes, 200);
assert.equal(r.proximoNoLectivo.descripcion, 'Independencia de Guayaquil');
assert.equal(resumenAnioLectivo(EV, '2026-10-10').proximoNoLectivo.descripcion, 'Difuntos');

// recuperación fuerza día lectivo; excepciones de un solo curso no cambian el día de toda la institución
const extra = [...EV, e('recuperacion', '2026-10-10', '2026-10-10', 'Recuperación sábado'), { ...e('excepcion', '2026-10-13', '2026-10-13', 'Solo 1ro'), paralelo_id: 'p1' }];
assert.equal(esDiaLectivo('2026-10-10', extra), true);
assert.equal(esDiaLectivo('2026-10-13', extra), true);
// antes del inicio y después del fin del año
const antes = resumenAnioLectivo(EV, '2026-03-01');
assert.equal(antes.transcurridos, 0);
assert.equal(antes.restantes, 200);
const despues = resumenAnioLectivo(EV, '2027-03-01');
assert.equal(despues.restantes, 0);
assert.equal(despues.proximoNoLectivo, null);
assert.equal(resumenAnioLectivo([], '2026-10-09'), null);
assert.equal(contarDiasLectivos('2026-10-09', '2026-10-01', EV), 0);

console.log('OK calendarioResumen: todas las pruebas pasaron');
