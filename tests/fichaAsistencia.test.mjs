import assert from 'node:assert/strict';
import { analizarFicha, coincideBusqueda, palabraClave, telefonoEcuador, urlWhatsApp, listaFechas, mensajeWhatsApp, sinTildes } from '../src/lib/fichaAsistencia.js';

// Septiembre 2026: 1 martes. 3 jueves, 4 viernes, 7 lunes, 8 martes.
const R = (fecha, materia, estado) => ({ fecha, materia, estado, docente: 'Prof. ' + materia });
const regs = [
  R('2026-09-03', 'Matemática', 'ausente'), R('2026-09-03', 'Lengua', 'ausente'), R('2026-09-03', 'Física', 'presente'),
  R('2026-09-04', 'Matemática', 'ausente'), R('2026-09-04', 'Lengua', 'presente'),
  R('2026-09-07', 'Matemática', 'presente'), R('2026-09-07', 'Lengua', 'atraso'),
  R('2026-09-08', 'Matemática', 'justificado'), R('2026-09-08', 'Lengua', 'presente'),
  R('2026-10-05', 'Matemática', 'presente'), R('2026-10-05', 'Lengua', 'presente')
];
const f = analizarFicha(regs);

// por clase
assert.deepEqual([f.clases.total, f.clases.presentes, f.clases.atrasos, f.clases.ausentes, f.clases.justificadas], [11, 6, 1, 3, 1]);
assert.equal(f.clases.pctAsistencia, 70);            // (6 + 1) / (11 - 1)

// por día: una falta en una sola materia cuenta como día de falta
assert.equal(f.resumen.dias, 5);
assert.equal(f.resumen.faltas, 2);
assert.equal(f.resumen.justificadas, 1);
assert.deepEqual(f.resumen.fechasFaltas.filter(x => x.tipo === 'injustificada').map(x => x.fecha), ['2026-09-03', '2026-09-04']);
assert.equal(f.resumen.rachaMax, 2);
assert.equal(f.dias[0].fecha, '2026-10-05', 'lo más reciente primero');
const d3 = f.dias.find(d => d.fecha === '2026-09-03');
assert.equal(d3.estado, 'falta');
assert.equal(d3.dia, 'Jueves');
assert.equal(d3.detalle.length, 3);
assert.equal(f.dias.find(d => d.fecha === '2026-09-08').estado, 'justificada');
assert.equal(f.dias.find(d => d.fecha === '2026-09-07').estado, 'atraso');

// por materia: la que más faltas tiene va primero
assert.equal(f.porMateria[0].materia, 'Matemática');
assert.equal(f.porMateria[0].faltas, 2);
assert.equal(f.porMateria[0].clases, 5);
assert.equal(f.porMateria[0].justificadas, 1);
assert.equal(f.porMateria[0].pct, 50);               // 2 presentes / (5 - 1 justificada) = 50
const lengua = f.porMateria.find(m => m.materia === 'Lengua');
assert.equal(lengua.faltas, 1);
assert.equal(lengua.atrasos, 1);
assert.equal(f.porMateria.find(m => m.materia === 'Física').pct, 100);

// por día de la semana y por mes
assert.equal(f.porDiaSemana.find(x => x.dia === 'Jueves').faltas, 1);
assert.equal(f.porDiaSemana.find(x => x.dia === 'Viernes').faltas, 1);
assert.equal(f.porDiaSemana.find(x => x.dia === 'Lunes').atrasos, 1);
assert.deepEqual(f.porMes.map(m => [m.etiqueta, m.faltas, m.dias]), [['Sep 2026', 2, 4], ['Oct 2026', 0, 1]]);

// sin registros
const v = analizarFicha([]);
assert.equal(v.resumen.clase, 'sin_datos');
assert.equal(v.clases.pctAsistencia, null);
assert.deepEqual(v.porMateria, []);

// búsqueda
assert.equal(sinTildes('MUÑOZ ÁLVAREZ'), 'munoz alvarez');
assert.equal(coincideBusqueda('CABRERA CHINGO LEONELA THAIMY', 'chingo cabrera'), true);
assert.equal(coincideBusqueda('Muñoz Álvarez Juan', 'munoz alva'), true);
assert.equal(coincideBusqueda('CABRERA CHINGO', 'cabrera perez'), false);
assert.equal(coincideBusqueda('Ana', ''), true);
assert.equal(palabraClave('de la cruz, (x)'), 'cruz');
assert.equal(palabraClave('  '), '');

// teléfonos de Ecuador
assert.equal(telefonoEcuador('0991234567'), '991234567');
assert.equal(telefonoEcuador('+593 99 123 4567'), '991234567');
assert.equal(telefonoEcuador('593991234567'), '991234567');
assert.equal(telefonoEcuador('099-123-4567'), '991234567');
assert.equal(telefonoEcuador('072345678'), null, 'convencional: no sirve para WhatsApp');
assert.equal(telefonoEcuador('12345'), null);
assert.equal(telefonoEcuador(''), null);
assert.equal(telefonoEcuador(null), null);
assert.equal(urlWhatsApp('', 'hola'), null);
assert.match(urlWhatsApp('0991234567', 'Hola & adiós'), /^https:\/\/wa\.me\/593991234567\?text=Hola%20%26%20adi%C3%B3s$/);

// mensaje
assert.equal(listaFechas(['2026-09-03']), '03/09/2026');
assert.equal(listaFechas(['2026-09-03', '2026-09-04', '2026-09-07']), '03/09/2026, 04/09/2026 y 07/09/2026');
const m1 = mensajeWhatsApp({ estudiante: { nombre: 'Cabrera Chingo Leonela', curso: '2do Bachillerato b' }, representante: { nombres: 'María', apellidos: 'Chingo' }, institucion: { nombre: 'U.E. Juan Henriquez Coello' }, fechas: ['2026-09-03'] });
assert.match(m1, /^Estimado\(a\) María Chingo: de parte de U\.E\. Juan Henriquez Coello/);
assert.match(m1, /registra una inasistencia injustificada el 03\/09\/2026/);
const m2 = mensajeWhatsApp({ estudiante: { nombre: 'X' }, representante: null, institucion: null, fechas: ['2026-09-03', '2026-09-04'] });
assert.match(m2, /Estimado\(a\) representante/);
assert.match(m2, /2 inasistencias injustificadas los días 03\/09\/2026 y 04\/09\/2026/);

console.log('OK fichaAsistencia: todas las pruebas pasaron');
