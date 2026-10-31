import assert from 'node:assert/strict';
import {
  fmtEspera, semaforoEspera, filtrarTab, filtrarOficios, resumenOficios, accionesDisponibles,
  ultimaObservacion, firmantesPorCargo, periodoPorDefecto, fmtDias, ordenarPorEspera, seguimientosDe, versionesDe
} from '../src/lib/oficiosVista.js';

assert.equal(fmtEspera(null), '—');
assert.equal(fmtEspera(30), 'menos de 1 min');
assert.equal(fmtEspera(90), '1 min');
assert.equal(fmtEspera(7200), '2 h');
assert.equal(fmtEspera(2 * 86400 + 7 * 3600), '2 d 7 h');
assert.equal(fmtEspera(86400), '1 d');

assert.equal(semaforoEspera(null), 'ninguno');
assert.equal(semaforoEspera(3600), 'ok');
assert.equal(semaforoEspera(30 * 3600), 'warn');
assert.equal(semaforoEspera(50 * 3600), 'err');

const docs = [
  { id: 1, estado: 'en_ruta', soy_emisor: true, puede_actuar: false, titulo: 'Citación Matemática', numero: '0001-2026-X', estudiante_id: 'a', espera_seg: 3600, version: 1, tipo: 'oficio_alerta' },
  { id: 2, estado: 'en_ruta', soy_emisor: false, puede_actuar: true, titulo: 'Plan refuerzo', numero: '0002-2026-X', estudiante_id: 'b', espera_seg: 60 * 3600, version: 2, tipo: 'plan_refuerzo' },
  { id: 3, estado: 'observado', soy_emisor: true, puede_actuar: false, titulo: 'Acta', estudiante_id: 'a', version: 7, tipo: 'acta_compromiso',
    historial_recorrido: [{ accion: 'observado', comentario: 'Falta fecha' }, { accion: 'corregido' }, { accion: 'observado', comentario: 'Detalla acciones' }] },
  { id: 4, estado: 'entregado', soy_emisor: true, puede_actuar: false, titulo: 'Ficha', estudiante_id: 'b', tipo: 'ficha_tutor', created_at: '2026-10-01T00:00:00Z', closed_at: '2026-10-05T00:00:00Z' }
];
assert.deepEqual(filtrarTab(docs, 'mios').map(d => d.id), [1, 3, 4]);
assert.deepEqual(filtrarTab(docs, 'por_cargo').map(d => d.id), [2]);
assert.equal(filtrarTab(docs, 'todos').length, 4);

const nombre = id => (id === 'a' ? 'Cárdenas Loaiza Mateo' : 'Romero Camila');
assert.deepEqual(filtrarOficios(docs, { q: 'cardenas matematica', nombreEstudiante: nombre }).map(d => d.id), [1]);
assert.deepEqual(filtrarOficios(docs, { q: '0002' }).map(d => d.id), [2]);
assert.deepEqual(filtrarOficios(docs, { tipo: 'acta_compromiso' }).map(d => d.id), [3]);
assert.deepEqual(filtrarOficios(docs, { estado: 'observado' }).map(d => d.id), [3]);

const r = resumenOficios(docs);
assert.equal(r.porCargo, 1);
assert.equal(r.esperaMaxSeg, 60 * 3600);
assert.equal(r.sobreSla, 1);
assert.equal(r.observadosMios, 1);
assert.equal(r.enRuta, 2);
assert.equal(r.versionAlta, 1);
assert.equal(Math.round(r.tramiteMedioDias), 4);
assert.equal(fmtDias(3.84), '3,8 d');
assert.equal(fmtDias(null), '—');

assert.equal(ultimaObservacion(docs[2]).comentario, 'Detalla acciones');
assert.equal(ultimaObservacion(docs[0]), null);

assert.deepEqual(accionesDisponibles({ estado: 'borrador', soy_emisor: true }), ['guardar', 'enviar', 'eliminar']);
assert.deepEqual(accionesDisponibles({ estado: 'borrador', soy_emisor: false }), []);
assert.deepEqual(accionesDisponibles({ estado: 'en_ruta', puede_actuar: true }), ['aprobar', 'observar', 'rechazar', 'imprimir']);
assert.deepEqual(accionesDisponibles({ estado: 'en_ruta', puede_actuar: false }), ['imprimir']);
assert.deepEqual(accionesDisponibles({ estado: 'observado', soy_emisor: true }), ['corregir', 'imprimir']);
assert.deepEqual(accionesDisponibles({ estado: 'aprobado_final' }), ['entregar', 'imprimir']);
assert.deepEqual(accionesDisponibles({ estado: 'entregado' }), ['archivar', 'imprimir']);
assert.deepEqual(accionesDisponibles({ estado: 'archivado' }), ['imprimir']);
assert.deepEqual(accionesDisponibles(null), []);
assert.deepEqual(accionesDisponibles({ estado: 'entregado', tipo: 'plan_refuerzo' }), ['archivar', 'imprimir', 'seguimiento']);
assert.deepEqual(accionesDisponibles({ estado: 'entregado', tipo: 'plan_refuerzo', es_seguimiento: true }), ['archivar', 'imprimir']);
assert.deepEqual(accionesDisponibles({ estado: 'en_ruta', tipo: 'plan_refuerzo', puede_actuar: false }), ['imprimir']);

assert.deepEqual(ordenarPorEspera([{ id: 'a', espera_seg: 10 }, { id: 'b', espera_seg: 500 }, { id: 'c' }]).map(d => d.id), ['b', 'a', 'c']);
assert.deepEqual(seguimientosDe([{ id: 1, documento_origen_id: 'x' }, { id: 2 }], 'x').map(d => d.id), [1]);

const v = versionesDe({ version: 2, created_at: '2026-10-01', historial_recorrido: [
  { accion: 'emitido', fecha_accion: '2026-10-01', usuario_nombre: 'Karina' },
  { accion: 'observado', cargo: 'rector', comentario: 'Falta detalle', fecha_accion: '2026-10-02' },
  { accion: 'corregido', version_pdf: 2, comentario: 'Contenido corregido → versión 2', fecha_accion: '2026-10-03', usuario_nombre: 'Karina' }] });
assert.equal(v.length, 2);
assert.equal(v[0].version, 1); assert.equal(v[0].observadaPor.motivo, 'Falta detalle'); assert.equal(v[0].actual, false);
assert.equal(v[1].version, 2); assert.equal(v[1].actual, true); assert.equal(v[1].observadaPor, null);

assert.deepEqual(firmantesPorCargo({ historial_recorrido: [
  { accion: 'aprobado', cargo: 'tutor', usuario_nombre: 'Zambrano Karina' },
  { accion: 'observado', cargo: 'inspector_general', usuario_nombre: 'X' },
  { accion: 'aprobado', cargo: 'inspector_general', usuario_nombre: 'Palacios Ricardo' }] }),
  { tutor: 'Zambrano Karina', inspector_general: 'Palacios Ricardo' });

assert.equal(periodoPorDefecto(new Date(2026, 9, 30)), '2026-2027');
assert.equal(periodoPorDefecto(new Date(2027, 1, 10)), '2026-2027');
console.log('oficiosVista: OK');

// ── tableros ──
import { resumenEmisor, resumenDespacho, cargosEnCola, filtrarCola, relacionados, indicadoresTramite, claveDia } from '../src/lib/oficiosVista.js';
const AHORA = new Date('2026-10-28T15:00:00Z').getTime();
const H = (accion, cargo, fecha, extra = {}) => ({ accion, cargo, fecha_accion: fecha, ...extra });
const casos = [
  { id: 'a', numero: '0138', estado: 'observado', soy_emisor: true, version: 6, updated_at: '2026-10-24T10:00:00Z', historial_recorrido: [H('emitido', 'tutor', '2026-10-20T10:00:00Z'), H('observado', 'rector', '2026-10-24T10:00:00Z', { usuario_id: 'otro', tiempo_espera: 3600 })] },
  { id: 'b', numero: '0142', estado: 'observado', soy_emisor: true, version: 2, updated_at: '2026-10-27T10:00:00Z', historial_recorrido: [H('observado', 'rector', '2026-10-27T10:00:00Z', { usuario_id: 'otro' })] },
  { id: 'c', numero: '0150', estado: 'en_ruta', soy_emisor: true, paso_actual: 1, ruta: [{ cargo: 'tutor' }, { cargo: 'dece' }], version: 1, historial_recorrido: [] },
  { id: 'd', numero: '0155', estado: 'borrador', soy_emisor: true, tipo: 'ficha_tutor', version: 1, historial_recorrido: [] },
  { id: 'e', numero: '0160', estado: 'entregado', soy_emisor: true, version: 1, created_at: '2026-10-01T00:00:00Z', closed_at: '2026-10-05T00:00:00Z', historial_recorrido: [] },
  { id: 'f', numero: '0170', estado: 'en_ruta', soy_emisor: false, puede_actuar: true, espera_seg: 30 * 3600, paso_actual: 0, ruta: [{ cargo: 'inspector_general' }], version: 1,
    historial_recorrido: [H('emitido', 'tutor', '2026-10-27T09:00:00Z')] },
  { id: 'g', numero: '0171', estado: 'en_ruta', soy_emisor: false, puede_actuar: true, espera_seg: 60 * 3600, paso_actual: 0, ruta: [{ cargo: 'dece' }], version: 1,
    historial_recorrido: [H('emitido', 'tutor', '2026-10-25T09:00:00Z')] },
  { id: 'h', numero: '0172', estado: 'en_ruta', soy_emisor: false, puede_actuar: true, espera_seg: 3600, paso_actual: 0, ruta: [{ cargo: 'inspector_general' }], version: 1,
    historial_recorrido: [H('emitido', 'tutor', '2026-10-28T14:00:00Z')] },
  { id: 'i', numero: '0173', estado: 'aprobado_final', soy_emisor: false, version: 1, historial_recorrido: [
    H('emitido', 'tutor', '2026-10-27T08:00:00Z'), H('aprobado', 'inspector_general', '2026-10-28T13:00:00Z', { usuario_id: 'yo', tiempo_espera: 18 * 3600 }),
    H('observado', 'inspector_general', '2026-10-26T13:00:00Z', { usuario_id: 'yo', tiempo_espera: 6 * 3600 })] }
];
const re = resumenEmisor(casos, AHORA);
assert.equal(re.observados.n, 2);
assert.deepEqual(re.observados.items.map(o => o.numero), ['0138', '0142']);      // el más antiguo primero
assert.equal(re.observados.masAntiguoDias, 4);
assert.deepEqual(re.enRuta, { n: 1, cargos: ['dece'] });
assert.equal(re.borradores.n, 1);
assert.equal(re.versionAlta.doc.numero, '0138');
assert.equal(re.tramite.medioDias, 4); assert.equal(re.tramite.dentroMeta, false);
assert.deepEqual(re.carga.find(c => c.estado === 'observado'), { estado: 'observado', n: 2 });

const rd = resumenDespacho(casos, 'yo', AHORA);
assert.equal(rd.pendientes.n, 3);
assert.deepEqual([rd.pendientes.ok, rd.pendientes.warn, rd.pendientes.err], [1, 1, 1]);
assert.equal(rd.maxima.numero, '0171');
assert.equal(Math.round(rd.mediaSeg / 3600), 30); assert.equal(rd.sobreSla, true);
assert.deepEqual(rd.resueltosHoy, { n: 1, aprobados: 1, observados: 0 });
assert.equal(rd.devolucionesSemana.n, 1); assert.equal(rd.devolucionesSemana.despachados, 2); assert.equal(rd.devolucionesSemana.tasa, 50);
assert.equal(rd.esperaPorCargo[0].cargo, 'inspector_general');
assert.equal(rd.serieDiaria.length, 10);
assert.equal(rd.serieDiaria[9].clave, claveDia(AHORA));
assert.equal(rd.serieDiaria[9].resueltos, 1);

assert.deepEqual(cargosEnCola(casos), [{ cargo: 'inspector_general', n: 2 }, { cargo: 'dece', n: 1 }]);
assert.deepEqual(filtrarCola(casos.filter(d => d.puede_actuar), { cargo: 'inspector_general' }).map(d => d.id), ['f', 'h']);
assert.deepEqual(filtrarCola(casos.filter(d => d.puede_actuar), { modo: 'vencidos' }).map(d => d.id), ['f', 'g']);
assert.deepEqual(filtrarCola(casos, { modo: 'reenviados' }).map(d => d.id), ['a', 'b', 'i']);
assert.deepEqual(relacionados([{ id: 1, estudiante_id: 'x' }, { id: 2, estudiante_id: 'x' }, { id: 3, estudiante_id: 'y' }], { id: 1, estudiante_id: 'x' }).map(d => d.id), [2]);
const it = indicadoresTramite({ created_at: '2026-10-24T13:00:00Z', historial_recorrido: [H('observado', 'rector', '2026-10-27T20:00:00Z'), H('observado', 'x', '2026-10-28T08:00:00Z')], version: 2 }, new Date('2026-10-27T15:00:00Z').getTime());
assert.equal(Math.round(it.horas), 74); assert.equal(it.devoluciones, 2); assert.equal(it.metaHoras, 72);
console.log('oficiosVista (tableros): OK');
