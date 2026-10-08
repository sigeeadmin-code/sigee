import assert from 'node:assert/strict';
import { validarTramos, tarifaPorPosicion, totalMarginal, totalPlano, planTarifas, mesInicio, estadoMes, construirEstadoCuenta, indicadoresMes, filasEstadoCuenta, filasLibro } from '../src/lib/financieroBase.js';

const TRAMOS = [{ desde: 1, hasta: 10, tarifa: 5 }, { desde: 11, hasta: 25, tarifa: 4 }, { desde: 26, hasta: null, tarifa: 3 }];

// ── tramos ──
assert.equal(validarTramos(TRAMOS), null);
assert.match(validarTramos([]), /al menos un tramo/);
assert.match(validarTramos([{ desde: 2, hasta: null, tarifa: 5 }]), /empezar en 1/);
assert.match(validarTramos([{ desde: 1, hasta: 10, tarifa: 5 }, { desde: 12, hasta: null, tarifa: 4 }]), /continuos/);
assert.match(validarTramos([{ desde: 1, hasta: 10, tarifa: 5 }]), /abierto/);
assert.match(validarTramos([{ desde: 1, hasta: null, tarifa: -1 }]), /tarifa/);

// ── tarifa marginal: un plantel que crece nunca paga menos ──
assert.equal(tarifaPorPosicion(TRAMOS, 1), 5);
assert.equal(tarifaPorPosicion(TRAMOS, 10), 5);
assert.equal(tarifaPorPosicion(TRAMOS, 11), 4);
assert.equal(tarifaPorPosicion(TRAMOS, 26), 3);
assert.equal(tarifaPorPosicion(TRAMOS, 300), 3);
assert.equal(totalMarginal(TRAMOS, 10), 50);
assert.equal(totalMarginal(TRAMOS, 11), 54);
assert.equal(totalMarginal(TRAMOS, 12), 58);
assert.equal(totalMarginal(TRAMOS, 26), 50 + 60 + 3);
assert.ok(totalMarginal(TRAMOS, 11) > totalMarginal(TRAMOS, 10), 'con tarifa marginal 11 paralelos pagan más que 10');
// el problema de la tarifa plana (el de la propuesta anterior): 11 paralelos pagarían menos que 10
assert.equal(totalPlano(TRAMOS, 10), 50);
assert.equal(totalPlano(TRAMOS, 11), 44);
assert.ok(totalPlano(TRAMOS, 11) < totalPlano(TRAMOS, 10));
assert.equal(totalPlano(TRAMOS, 0), 0);

// ── plan de tarifas por antigüedad dentro de cada plantel ──
const lics = [];
for (let i = 0; i < 12; i++) lics.push({ id: 'P1-' + String(i).padStart(2, '0'), institucion_id: 'P1', institucion_nombre: 'Plantel 1', created_at: `2026-0${(i % 9) + 1}-05T12:00:00Z`, tarifa_mensual: 5 });
lics.push({ id: 'P2-0', institucion_id: 'P2', institucion_nombre: 'Plantel 2', created_at: '2026-03-01T12:00:00Z', tarifa_mensual: 4 });
const plan = planTarifas(lics, TRAMOS);
const delP1 = plan.filter(p => p.institucion_id === 'P1');
assert.equal(delP1.length, 12);
assert.equal(delP1.reduce((s, p) => s + p.propuesta, 0), 58, '10×$5 + 2×$4');
assert.equal(delP1.filter(p => p.propuesta === 4).length, 2);
assert.equal(plan.find(p => p.id === 'P2-0').propuesta, 5);
assert.equal(plan.find(p => p.id === 'P2-0').actual, 4);

// ── meses y estados ──
const HOY = new Date(2026, 9, 20);          // 20 de octubre de 2026
const L = { id: 'a', institucion_id: 'X', created_at: '2026-09-05T12:00:00Z', tarifa_mensual: 5 };
assert.equal(mesInicio(L, 2026), 9);
assert.equal(mesInicio(L, 2025), 13);
assert.equal(mesInicio(L, 2027), 1);
assert.equal(mesInicio({ created_at: '2026-11-01T02:00:00Z' }, 2026), 10, 'hora de Ecuador');
const e = (mes, pago, hoy = HOY) => estadoMes({ lic: L, anio: 2026, mes, pago, hoy, diaVenc: 10 });
assert.equal(e(8), null, 'antes de registrarse no se cobra');
assert.equal(e(9, { estado: 'aprobado' }), 'pagado');
assert.equal(e(9, { estado: 'pendiente_revision' }), 'en_revision');
assert.equal(e(9, { estado: 'rechazado' }), 'rechazado');
assert.equal(e(9), 'mora');
assert.equal(e(10), 'mora', 'octubre pasado el día 10');
assert.equal(e(10, undefined, new Date(2026, 9, 8)), 'por_vencer');
assert.equal(e(11), 'futuro');

// ── estado de cuenta ──
const licencias = [
  { id: 'a1', institucion_id: 'P1', institucion_nombre: 'Plantel 1', created_at: '2026-09-05T12:00:00Z', tarifa_mensual: 5 },
  { id: 'a2', institucion_id: 'P1', institucion_nombre: 'Plantel 1', created_at: '2026-09-05T12:00:00Z', tarifa_mensual: 5 },
  { id: 'b1', institucion_id: 'P2', institucion_nombre: 'Plantel 2', created_at: '2026-10-01T12:00:00Z', tarifa_mensual: 4 },
  { id: 'c1', institucion_id: 'P3', institucion_nombre: 'Plantel 3', created_at: '2026-09-01T12:00:00Z', tarifa_mensual: 5 },
  { id: 'd1', institucion_id: 'P4', institucion_nombre: 'Plantel futuro', created_at: '2027-02-01T12:00:00Z', tarifa_mensual: 5 }
];
const pagos = [
  { licencia_paralelo_id: 'a1', anio: 2026, mes: 9, monto: 5, estado: 'aprobado' },
  { licencia_paralelo_id: 'a1', anio: 2026, mes: 10, monto: 5, estado: 'aprobado' },
  { licencia_paralelo_id: 'a2', anio: 2026, mes: 9, monto: 5, estado: 'aprobado' },
  { licencia_paralelo_id: 'a2', anio: 2026, mes: 10, monto: 5, estado: 'pendiente_revision' },
  { licencia_paralelo_id: 'b1', anio: 2026, mes: 10, monto: 4, estado: 'aprobado' },
  { licencia_paralelo_id: 'c1', anio: 2026, mes: 9, monto: 5, estado: 'rechazado' }
];
const ec = construirEstadoCuenta({ licencias, pagos, anio: 2026, hoy: HOY });
assert.equal(ec.planteles.length, 3, 'el plantel que empieza en 2027 no aparece en 2026');
const p1 = ec.planteles.find(p => p.institucion_id === 'P1');
assert.equal(p1.paralelos, 2);
assert.equal(p1.tarifaMensual, 10);
assert.equal(p1.cobrado, 15);
assert.equal(p1.enRevision, 5);
assert.equal(p1.porCobrar, 0);
assert.equal(p1.futuro, 20, 'nov y dic de los 2 paralelos');
assert.equal(p1.cobranza, 75);
assert.equal(p1.estado, 'en_revision');
const p2 = ec.planteles.find(p => p.institucion_id === 'P2');
assert.equal(p2.estado, 'al_dia');
assert.equal(p2.cobranza, 100);
const p3 = ec.planteles.find(p => p.institucion_id === 'P3');
assert.equal(p3.estado, 'mora');
assert.equal(p3.porCobrar, 10, 'sep rechazado + oct sin pagar');
assert.equal(p3.cobranza, 0);
assert.equal(ec.planteles[0].institucion_id, 'P3', 'los que más deben van primero');
assert.deepEqual([ec.totales.alDia, ec.totales.enRevisionN, ec.totales.enMora], [1, 1, 1]);
assert.equal(ec.totales.cobrado, 19);   // a1 sep+oct, a2 sep, b1 oct
assert.equal(ec.totales.paralelos, 4);

// ── indicadores de octubre ──
const oct = indicadoresMes(ec, 10, 50);
assert.equal(oct.cobrado, 9);           // a1 $5 + b1 $4 (a2 está en revisión)
assert.equal(oct.enRevision, 5);
assert.equal(oct.porCobrar, 5);         // c1 octubre en mora
assert.equal(oct.esperado, 5 + 5 + 4 + 5);
assert.equal(oct.paralelosFacturables, 4);
assert.equal(oct.paralelosActivos, 2);
assert.equal(oct.margen, 9 - 50);
assert.equal(oct.paralelosEquilibrio, Math.ceil(50 / ((5 + 5 + 4 + 5) / 4)));
assert.equal(indicadoresMes(ec, 1, 50).paralelosEquilibrio, null, 'enero: nada facturable');

// ── exportes ──
const fe = filasEstadoCuenta(ec, 2026);
assert.equal(fe.length, 3);
assert.equal(fe[0]['Estado'], 'En mora');
const fl = filasLibro([{ fecha_reporte: '2026-10-03T12:00:00Z', anio: 2026, mes: 9, monto: '5.00', comprobante_num: 'C-1', estado: 'aprobado', licencias_paralelo: { institucion: { nombre: 'X', amie: '07H1' }, grado: { nombre: '1ro' }, paralelo: { nombre: 'A' } } }]);
assert.equal(fl[0]['Período'], 'Sep 2026');
assert.equal(fl[0]['Monto (USD)'], 5);
assert.equal(fl[0]['Estado'], 'Aprobado');

console.log('OK financiero: todas las pruebas pasaron');
