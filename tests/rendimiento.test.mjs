import assert from 'node:assert/strict';
import { enAlerta, esCritica, bandaDe, alertasDeVentana, promedioDeVentana, resumenPorDocente, resumenPorCurso, resumenPorMateria, etiquetaSemana, etiquetaMes, textoRecordatorio, fmtNota } from '../src/lib/rendimiento.js';

// Rango de alerta: 0,01 a 6,99
assert.equal(enAlerta(0), false, '0 = sin nota, no es alerta'); assert.equal(enAlerta(0.01), true); assert.equal(enAlerta(6.99), true);
assert.equal(enAlerta(7), false); assert.equal(enAlerta(null), false); assert.equal(enAlerta('6.5'), true);
assert.equal(esCritica(4), true); assert.equal(esCritica(4.01), false); assert.equal(esCritica(0), false);
assert.equal(bandaDe(9.5).id, 'da'); assert.equal(bandaDe(9).id, 'da'); assert.equal(bandaDe(8.99).id, 'aa'); assert.equal(bandaDe(7).id, 'aa');
assert.equal(bandaDe(6.99).id, 'pa'); assert.equal(bandaDe(4.01).id, 'pa'); assert.equal(bandaDe(4).id, 'na'); assert.equal(bandaDe(0.01).id, 'na'); assert.equal(bandaDe(0), null);
assert.equal(fmtNota(6.5), '6,50'); assert.equal(fmtNota(null), '—');

// Ventanas
const al = [
  { id: 1, parcial: 8, semanas: [['2026-10-12', 6.5], ['2026-10-19', 9]], meses: [['2026-10-01', 7.5]] },
  { id: 2, parcial: 6, semanas: [['2026-10-19', 5]], meses: [['2026-10-01', 6]] },
  { id: 3, parcial: 7.2, semanas: [['2026-10-19', 7]], meses: [] }
];
assert.deepEqual(alertasDeVentana(al, 'acumulado').map(a => a.id), [2]);
assert.deepEqual(alertasDeVentana(al, 'semana', '2026-10-12').map(a => a.id), [1], 'recuperado después pero cayó esa semana');
assert.deepEqual(alertasDeVentana(al, 'semana', '2026-10-19').map(a => a.id), [2]);
assert.deepEqual(alertasDeVentana(al, 'mes', '2026-10-01').map(a => a.id), [2]);
assert.equal(promedioDeVentana(al[0], 'semana', '2026-10-12'), 6.5); assert.equal(promedioDeVentana(al[0], 'semana', '2020-01-01'), null);

// Resúmenes
const cargas = [
  { docente_id: 'a', docente: 'Ana', curso: '1ro', curso_orden: 1, paralelo: 'A', materia: 'Física', estudiantes: 30, evaluados: 10, promedio: 7, na: 1, pa: 2, aa: 6, da: 1, ultima: '2026-10-10' },
  { docente_id: 'a', docente: 'Ana', curso: '1ro', curso_orden: 1, paralelo: 'B', materia: 'Química', estudiantes: 30, evaluados: 0, promedio: null, na: 0, pa: 0, aa: 0, da: 0 },
  { docente_id: 'b', docente: 'Beto', curso: '2do', curso_orden: 2, paralelo: 'A', materia: 'Física', estudiantes: 20, evaluados: 20, promedio: 8, na: 0, pa: 1, aa: 15, da: 4, ultima: '2026-10-12' }
];
const docs = resumenPorDocente(cargas, [{ docente_id: 'a', parcial: 3 }, { docente_id: 'a', parcial: 6 }, { docente_id: 'a', parcial: 8 }, { docente_id: 'b', parcial: 6.9 }]);
assert.equal(docs[0].docente, 'Ana'); assert.equal(docs[0].alertas, 2); assert.equal(docs[0].criticas, 1); assert.equal(docs[0].sin_notas, 1); assert.equal(docs[0].promedio, 7); assert.equal(docs[0].ultima, '2026-10-10');
assert.equal(resumenPorCurso(cargas).map(c => c.etiqueta).join(), '1ro A,1ro B,2do A');
const mats = resumenPorMateria(cargas); assert.equal(mats.find(m => m.etiqueta === 'Física').alertas, 4); assert.equal(mats.find(m => m.etiqueta === 'Física').evaluados, 30);
assert.equal(mats[0].etiqueta, 'Física', 'ordenado por % en alerta');

// Textos
assert.equal(etiquetaSemana('2026-10-19'), '19 oct'); assert.equal(etiquetaMes('2026-10-01'), 'oct 26');
assert.equal(textoRecordatorio({}), 'Sin estudiantes en alerta.');
assert.equal(textoRecordatorio({ est_alerta_semana: 2, est_alerta_mes: 3, est_alerta: 5 }), '2 esta semana · 3 este mes · 5 en el trimestre');
console.log('rendimiento: ok');

import { parcialDesdeActividades } from '../src/lib/rendimiento.js';
// Dos grupos formativos (pesos 5 y 10) y la sumativa (peso 15) con el proyecto
const acts = [
  { tipo: 'ind', grupo: 0, valor: 6, peso: 5 }, { tipo: 'ind', grupo: 0, valor: 8, peso: 5 },   // media 7
  { tipo: 'ind', grupo: 2, valor: 9, peso: 10 },                                                  // media 9
  { tipo: 'sum', grupo: 0, valor: 5, peso: 15 }                                                   // proyecto 5
];
const r = parcialDesdeActividades(acts);
assert.equal(r.formativo, 8.33, '(7*5 + 9*10) / 15'); assert.equal(r.sumativo, 5);
assert.equal(r.parcial, 7.33, '8,33*0,7 + 5*0,3 = 7,33');
assert.equal(parcialDesdeActividades([{ tipo: 'ind', grupo: 0, valor: 6, peso: 5 }]).parcial, 6, 'solo formativa: se normaliza');
assert.equal(parcialDesdeActividades([]).parcial, null); assert.equal(parcialDesdeActividades([{ tipo: 'sum', grupo: 0, valor: 4, peso: 15 }]).parcial, 4);
console.log('rendimiento (parcial): ok');

// Acceso al módulo: supervisor de plantel, inspector general, administrador y docentes (cada docente ve solo lo suyo en el servidor)
import { rolesConAcceso, rutaPermitidaParaRolDb, NAV_BY_ROL } from '../src/lib/nav.js';
const R = '/analisis-calificaciones';
assert.deepEqual(rolesConAcceso(R).sort(), ['admin_plantel', 'docente', 'inspector']);
assert.equal(rutaPermitidaParaRolDb(R, 'admin_plantel', 'supervisor_plantel'), true, 'supervisor de plantel');
assert.equal(rutaPermitidaParaRolDb(R, 'admin_plantel', 'admin_plantel'), true);
assert.equal(rutaPermitidaParaRolDb(R, 'admin_plantel', 'contador_general'), false, 'contador no ve notas');
assert.equal(rutaPermitidaParaRolDb(R, 'inspector', 'inspector_general'), true, 'inspector general');
assert.equal(rutaPermitidaParaRolDb(R, 'docente', 'docente'), true);
assert.equal(rutaPermitidaParaRolDb(R, 'alumno', 'estudiante'), false); assert.equal(rutaPermitidaParaRolDb(R, 'padre', 'padre'), false);
assert.equal(NAV_BY_ROL.docente.flatMap(c => c.items).find(i => i.to === R).label, 'Alertas de rendimiento');
console.log('rendimiento (acceso): ok');

// Boletas: administración, supervisión e inspección del plantel (y el docente tutor de su curso)
assert.deepEqual(rolesConAcceso('/boletas').sort(), ['admin_plantel', 'docente', 'inspector', 'secretario']);
assert.equal(rutaPermitidaParaRolDb('/boletas', 'admin_plantel', 'supervisor_plantel'), true, 'supervisor de plantel ve boletas');
assert.equal(rutaPermitidaParaRolDb('/boletas', 'admin_plantel', 'admin_plantel'), true);
assert.equal(rutaPermitidaParaRolDb('/boletas', 'inspector', 'inspector_general'), true, 'inspector general ve boletas');
console.log('boletas (acceso): ok');
