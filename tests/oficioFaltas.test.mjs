import assert from 'node:assert/strict';
import { construirOficio, candidatosOficio, fechaCorta, fechaLarga, numeroCorrelativo } from '../src/lib/oficioFaltas.js';

const inst = { nombre: 'Unidad Educativa Juan Henriquez Coello', amie: '07H00001', canton: 'Machala', provincia: 'El Oro' };
const alumno = {
  nombre: 'Espinoza Tapia Esteban', cedula: '1472964269', curso: '3ro Bachillerato A', dias: 20, faltas: 4, justificadas: 1, pctFaltas: 20,
  rachaMax: 3, rachaIni: '2026-09-03', rachaFin: '2026-09-07', representante: { nombres: 'María', apellidos: 'Tapia' },
  fechasFaltas: [{ fecha: '2026-09-03', tipo: 'injustificada' }, { fecha: '2026-09-04', tipo: 'injustificada' }, { fecha: '2026-09-07', tipo: 'injustificada' }, { fecha: '2026-09-11', tipo: 'injustificada' }, { fecha: '2026-09-14', tipo: 'justificada' }]
};
const periodo = { desde: '2026-09-01', hasta: '2026-09-30' };
const op = { numero: '012-2026', fechaEmision: new Date(2026, 9, 8), firmanteNombre: 'Lcdo. Juan Pérez', plazoDias: 3 };
const of = construirOficio({ institucion: inst, alumno, periodo, opciones: op });

assert.equal(of.titulo, 'OFICIO Nro. 012-2026');
assert.equal(of.lugarFecha, 'Machala, 8 de octubre de 2026');
assert.deepEqual(of.destinatario.slice(0, 3), ['Señor(a)', 'MARÍA TAPIA', 'REPRESENTANTE LEGAL DEL ESTUDIANTE ESPINOZA TAPIA ESTEBAN']);
assert.match(of.parrafos[0], /registra 4 días de inasistencias injustificadas entre el 01\/09\/2026 y el 30\/09\/2026/);
assert.match(of.parrafos[0], /3ro Bachillerato A/);
assert.match(of.parrafos[0], /C\.I\. 1472964269/);

// solo las injustificadas, con día de la semana correcto (3 sep 2026 es jueves)
assert.equal(of.filas.length, 4);
assert.deepEqual(of.filas[0], { n: 1, fecha: '03/09/2026', dia: 'Jueves', situacion: 'Injustificada' });
assert.equal(of.filas[2].dia, 'Lunes');
assert.match(of.totales, /4 días \(20% de los 20 días de clase/);
assert.match(of.racha, /3 días de clase consecutivos \(del 03\/09\/2026 al 07\/09\/2026\)/);

// base legal: art. 171 y plazos del reglamento; sin inventar porcentajes de reprobación
assert.match(of.baseLegal, /artículo 171/);
assert.match(of.baseLegal, /dos días posteriores al retorno/);
assert.match(of.baseLegal, /tres días continuos/);
assert.doesNotMatch(of.baseLegal + of.solicitud, /10 ?%|diez por ciento|reprob/i);
assert.match(of.baseNormativa, /Decreto Ejecutivo No\. 675/);
assert.match(of.baseNormativa, /254/);

// 3 días seguidos no "exceden" de tres: se justifica ante el tutor; con 4 o más, ante el Inspector/máxima autoridad
assert.match(of.solicitud, /ante el profesor tutor del curso, en el plazo de 3 días hábiles/);
const largo = construirOficio({ institucion: inst, alumno: { ...alumno, rachaMax: 5 }, periodo, opciones: op });
assert.match(largo.solicitud, /con la documentación respectiva, ante la máxima autoridad o el Inspector General/);

// firma y acuse
assert.equal(of.firmante.nombre, 'Lcdo. Juan Pérez');
assert.equal(of.firmante.cargo, 'Inspector General');
assert.equal(of.acuse[0], 'ACUSE DE RECIBO');
assert.match(of.dece, /DECE/);

// opciones: incluir justificadas, sin DECE ni base legal, sin plazo
const o2 = construirOficio({ institucion: inst, alumno, periodo, opciones: { ...op, incluirJustificadas: true, mencionarDece: false, incluirBaseLegal: false, plazoDias: 0, notaAdicional: '  Favor acercarse a Inspección.  ' } });
assert.equal(o2.filas.length, 5);
assert.equal(o2.filas[4].situacion, 'Justificada');
assert.equal(o2.dece, '');
assert.equal(o2.baseLegal, '');
assert.equal(o2.baseNormativa, '');
assert.match(o2.solicitud, /a la brevedad posible/);
assert.equal(o2.notaAdicional, 'Favor acercarse a Inspección.');

// singular y sin representante registrado
const uno = construirOficio({ institucion: inst, alumno: { ...alumno, faltas: 1, dias: 1, pctFaltas: 100, rachaMax: 1, representante: null, fechasFaltas: [alumno.fechasFaltas[0]] }, periodo, opciones: op });
assert.match(uno.parrafos[0], /1 día de inasistencia injustificada/);
assert.match(uno.parrafos[0], /en la fecha que se detalla/);
assert.equal(uno.destinatario[1], 'REPRESENTANTE LEGAL');
assert.equal(uno.racha, '');
assert.equal(construirOficio({ institucion: inst, alumno: { ...alumno, faltas: 0, fechasFaltas: [] }, periodo, opciones: op }).advertencia.length > 0, true);

// candidatos
const lista = candidatosOficio([{ faltas: 0, nombre: 'A' }, { faltas: 2, nombre: 'B' }, { faltas: 5, nombre: 'C' }], 1);
assert.deepEqual(lista.map(x => x.nombre), ['C', 'B']);
assert.equal(candidatosOficio(lista, 3).length, 1);
assert.equal(fechaCorta('2026-09-03'), '03/09/2026');
assert.equal(fechaLarga(new Date(2026, 0, 5)), '5 de enero de 2026');

assert.equal(numeroCorrelativo('012-2026', 2), '014-2026');
assert.equal(numeroCorrelativo('099-2026', 1), '100-2026');
assert.equal(numeroCorrelativo('UE-5-2026', 3), 'UE-8-2026');
assert.equal(numeroCorrelativo('sin numero', 3), 'sin numero');
assert.equal(numeroCorrelativo('', 1), '');
assert.equal(numeroCorrelativo('012-2026', 0), '012-2026');

console.log('OK oficioFaltas: todas las pruebas pasaron');
