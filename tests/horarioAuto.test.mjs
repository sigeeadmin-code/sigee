import assert from 'node:assert/strict';
import { construirFranjas, validarJornada, FRANJAS_DEFAULT, normalizarFranjas, generarHorario, DIAS } from '../src/lib/horarioAuto.js';

// Jornada por defecto = exactamente las 7 etiquetas que ya usan los horarios guardados
assert.deepEqual(FRANJAS_DEFAULT.filter(f => f.tipo === 'clase').map(f => f.label),
  ['07:00–07:40', '07:40–08:20', '08:20–09:00', '09:20–10:00', '10:00–10:40', '10:40–11:20', '11:20–12:00']);
assert.deepEqual(FRANJAS_DEFAULT.filter(f => f.tipo === 'recreo').map(f => f.label), ['09:00–09:20']);

// Varios recreos en los lugares que se elijan
const j = construirFranjas({ inicio: '07:30', duracion: 45, clases: 8, recreos: [{ despuesDe: 2, minutos: 15 }, { despuesDe: 5, minutos: 30 }] });
assert.equal(j.filter(f => f.tipo === 'clase').length, 8);
assert.deepEqual(j.filter(f => f.tipo === 'recreo').map(f => f.label), ['09:00–09:15', '11:30–12:00']);
assert.equal(j[2].tipo, 'recreo'); assert.equal(j[2].inicio, '09:00');   // 07:30 + 2×45 = 09:00
assert.equal(j[6].tipo, 'recreo');                                       // después de la clase 5
for (let i = 1; i < j.length; i++) assert.equal(j[i].inicio, j[i - 1].fin, 'sin huecos ni solapes');

// Validaciones
assert.ok(validarJornada({ inicio: '7:00', duracion: 40, clases: 7 }).length);
assert.ok(validarJornada({ inicio: '07:00', duracion: 10, clases: 7 }).length);
assert.ok(validarJornada({ inicio: '07:00', duracion: 40, clases: 7, recreos: [{ despuesDe: 7, minutos: 20 }] }).length, 'recreo al final no tiene sentido');
assert.ok(validarJornada({ inicio: '07:00', duracion: 40, clases: 7, recreos: [{ despuesDe: 3, minutos: 20 }, { despuesDe: 3, minutos: 10 }] }).length);
assert.throws(() => construirFranjas({ inicio: 'x', duracion: 40, clases: 7 }));
assert.equal(normalizarFranjas(null), FRANJAS_DEFAULT);
assert.equal(normalizarFranjas([{ inicio: '07:00', fin: '07:40', tipo: 'otro' }]), FRANJAS_DEFAULT);
assert.equal(normalizarFranjas(j).length, j.length);

// Generador: 3 paralelos, 5 materias, 5 docentes que dictan en los 3 (como Colegio Lumen)
const franjas = FRANJAS_DEFAULT.filter(f => f.tipo === 'clase').map(f => f.label);
const docentes = ['D1', 'D2', 'D3', 'D4', 'D5'];
const paralelos = ['P1', 'P2', 'P3'].map(p => ({ id: p, cargas: docentes.map((d, i) => ({ id: `${p}-${i}`, docenteId: d, horas: 5 })) }));
const chequear = (res, ps, horasEsperadas) => {
  const slotPar = new Set(), slotDoc = new Set(), porCarga = {};
  for (const b of res.bloques) {
    const k = `${b.paralelo_id}|${b.dia}|${b.franja}`; assert.ok(!slotPar.has(k), 'paralelo con dos clases a la vez'); slotPar.add(k);
    const doc = ps.flatMap(p => p.cargas).find(c => c.id === b.docente_materia_id).docenteId;
    const kd = `${doc}|${b.dia}|${b.franja}`; assert.ok(!slotDoc.has(kd), 'docente en dos paralelos a la vez'); slotDoc.add(kd);
    assert.ok(franjas.includes(b.franja)); assert.ok(DIAS.includes(b.dia));
    porCarga[b.docente_materia_id] = (porCarga[b.docente_materia_id] || 0) + 1;
  }
  if (horasEsperadas) Object.entries(horasEsperadas).forEach(([id, h]) => assert.equal(porCarga[id] || 0, h, 'horas de ' + id));
  return porCarga;
};
const r1 = generarHorario({ franjas, paralelos, seed: 1 });
assert.equal(r1.faltantes.length, 0);
assert.equal(r1.bloques.length, 3 * 5 * 5);
chequear(r1, paralelos);
// repartida: ninguna materia más de 2 veces el mismo día
const cuenta = {};
r1.bloques.forEach(b => { const k = `${b.docente_materia_id}|${b.dia}`; cuenta[k] = (cuenta[k] || 0) + 1; });
assert.ok(Object.values(cuenta).every(n => n <= 2));

// Determinista con la misma semilla; distinto con otra (se puede generar varias veces)
const r1b = generarHorario({ franjas, paralelos, seed: 1 });
assert.deepEqual(r1b.bloques, r1.bloques);
const r2 = generarHorario({ franjas, paralelos, seed: 2 });
assert.equal(r2.faltantes.length, 0); chequear(r2, paralelos);
assert.notDeepEqual(r2.bloques, r1.bloques, 'otra semilla da otro horario');

// Horario completo: 7 horas por materia = los 35 huecos
const llenos = ['P1', 'P2', 'P3'].map(p => ({ id: p, cargas: docentes.map((d, i) => ({ id: `${p}-${i}`, docenteId: d, horas: 7 })) }));
const rl = generarHorario({ franjas, paralelos: llenos, seed: 7 });
assert.equal(rl.faltantes.length, 0); assert.equal(rl.bloques.length, 105); chequear(rl, llenos);

// Imposible: más horas que huecos -> avisa cuántas faltan, sin romper reglas
const demas = [{ id: 'P1', cargas: docentes.map((d, i) => ({ id: `P1-${i}`, docenteId: d, horas: 9 })) }];
const rd = generarHorario({ franjas, paralelos: demas, seed: 3 });
assert.equal(rd.bloques.length, 35); assert.equal(rd.faltantes.reduce((a, f) => a + f.faltan, 0), 45 - 35); chequear(rd, demas);

// Se respetan las clases fijas (cuentan para las horas) y los docentes ocupados en otros paralelos
const fijos = [{ paralelo_id: 'P1', docente_materia_id: 'P1-0', dia: 'Lunes', franja: franjas[0] }];
const rf = generarHorario({ franjas, paralelos: [paralelos[0]], fijos, seed: 4 });
assert.equal(rf.bloques.filter(b => b.docente_materia_id === 'P1-0').length, 4, '5 horas - 1 fija');
assert.ok(!rf.bloques.some(b => b.dia === 'Lunes' && b.franja === franjas[0]), 'no pisa la clase fija');
const ocup = DIAS.flatMap(d => franjas.slice(0, 6).map(f => ({ docenteId: 'D1', dia: d, franja: f })));   // D1 libre solo en la franja 7
const ro = generarHorario({ franjas, paralelos: [{ id: 'P9', cargas: [{ id: 'X', docenteId: 'D1', horas: 5 }] }], ocupadosDocente: ocup, seed: 5 });
assert.equal(ro.faltantes.length, 0); assert.ok(ro.bloques.every(b => b.franja === franjas[6]));
// Materia sin docente asignado también se coloca (no hay cruce que controlar)
const rs = generarHorario({ franjas, paralelos: [{ id: 'P8', cargas: [{ id: 'S', docenteId: null, horas: 3 }] }], seed: 6 });
assert.equal(rs.bloques.length, 3);
console.log('OK horarioAuto: todas las pruebas pasaron');
