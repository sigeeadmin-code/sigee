import test from 'node:test';
import assert from 'node:assert/strict';
import { ordenarDocentes, filtrarDocentes, puedeMarcarAtraso, motivoSinAccion, totalesDocente, franjaActual, textoRestan, barraClase } from '../src/lib/resumenDia.js';

const clase = (o = {}) => ({ estado: 'registrada', en_hora: true, franjas: '07:00–07:42', lista_ausentes: [{ id: 'a1' }], ...o });

test('solo el Inspector General puede marcar atraso, y solo con ausentes y dentro de la hora de la clase', () => {
  assert.equal(puedeMarcarAtraso('inspector_general', clase()), true);
  assert.equal(puedeMarcarAtraso('inspector_general', clase({ en_hora: false })), false);        // terminó la hora
  assert.equal(puedeMarcarAtraso('inspector_general', clase({ lista_ausentes: [] })), false);    // nadie ausente
  assert.equal(puedeMarcarAtraso('inspector_general', clase({ estado: 'sin_registro' })), false);// el docente no registró
  for (const rol of ['supervisor_plantel', 'admin_plantel', 'secretario', 'docente', 'super_admin']) assert.equal(puedeMarcarAtraso(rol, clase()), false, rol);
});

test('mensajes: informativo para otros roles, hora terminada o aún no empieza para el inspector', () => {
  assert.match(motivoSinAccion('supervisor_plantel', clase()), /informativa/);
  assert.match(motivoSinAccion('inspector_general', clase({ en_hora: false })), /ya terminó/);
  assert.match(motivoSinAccion('inspector_general', clase({ en_hora: false, estado: 'pendiente' })), /aún no está en su hora/);
  assert.equal(motivoSinAccion('inspector_general', clase()), null);
  assert.equal(motivoSinAccion('inspector_general', clase({ lista_ausentes: [] })), null);
});

test('orden: sin registro primero, luego más ausentes; filtro por nombre y solo pendientes', () => {
  const d = [
    { docente: 'B', sin_registro: 0, ausentes: 5 }, { docente: 'A', sin_registro: 0, ausentes: 5 },
    { docente: 'C', sin_registro: 2, ausentes: 0 }, { docente: 'D', sin_registro: 0, ausentes: 0 }
  ];
  assert.deepEqual(ordenarDocentes(d).map(x => x.docente), ['C', 'A', 'B', 'D']);
  assert.deepEqual(filtrarDocentes(d, { soloPendientes: true }).map(x => x.docente).sort(), ['A', 'B', 'C']);
  assert.deepEqual(filtrarDocentes(d, { texto: ' b ' }).map(x => x.docente), ['B']);
});

test('totales por docente', () => {
  assert.deepEqual(totalesDocente({ clases: [{ ausentes: 2, atrasos: 1 }, { ausentes: 1, atrasos: 0 }] }), { clases: 2, ausentes: 3, atrasos: 1 });
});

test('franja actual: solo cuenta la franja en la que cae la hora (no el rango entre franjas separadas)', () => {
  const f = '09:05–09:40, 11:10–11:45, 11:45–12:20';
  assert.deepEqual(franjaActual(f, '11:20'), { inicio: '11:10', fin: '11:45', restan: 25 });
  assert.equal(franjaActual(f, '10:00'), null);
  assert.equal(franjaActual(f, '12:30'), null);
  assert.equal(franjaActual('', '10:00'), null);
});

test('texto de minutos restantes y barra de la clase', () => {
  assert.equal(textoRestan(25), 'quedan 25 minutos');
  assert.equal(textoRestan(1), 'queda 1 minuto');
  assert.equal(textoRestan(0), 'termina ahora');
  assert.deepEqual(barraClase({ presentes: 8, atrasos: 1, ausentes: 1, justificados: 0 }), { presentes: 80, atrasos: 10, ausentes: 10, justificados: 0 });
  assert.deepEqual(barraClase({}), { presentes: 0, atrasos: 0, ausentes: 0, justificados: 0 });
});
