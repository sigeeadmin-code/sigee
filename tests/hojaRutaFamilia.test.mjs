import assert from 'node:assert/strict';
import { armarLineaTiempo, resumenHojaRuta, soloFecha, docParaImpresion } from '../src/lib/hojaRutaFamilia.js';

assert.equal(soloFecha('2026-10-05'), '05/10/2026');           // sin desfase de zona horaria
assert.equal(soloFecha(null), '—');
assert.equal(soloFecha('2026-10-05T03:00:00Z'), '04/10/2026'); // timestamp → hora de Ecuador (UTC-5)

const datos = {
  documentos: [
    { id: 'd1', tipo: 'plan_refuerzo', tipo_nombre: 'Plan de refuerzo', titulo: 'Plan Matemática', numero: '0010-2026-X', estado: 'entregado', fecha: '2026-10-20T15:00:00Z', emitido: '2026-10-10T15:00:00Z', contenido: 'Acciones…' },
    { id: 'd2', tipo: 'informe_seguimiento', tipo_nombre: 'Informe de seguimiento', titulo: 'Seg', numero: '0015-2026-X', estado: 'aprobado_final', es_seguimiento: true, documento_origen_numero: '0010-2026-X', fecha: '2026-10-28T15:00:00Z' }
  ],
  oficios_faltas: [
    { id: 'o1', numero: '0003-2026-X', fecha: '2026-10-15', desde: '2026-10-01', hasta: '2026-10-14', dias_falta: 3, estado: 'emitido', entregado_at: null, por_correo: true },
    { id: 'o2', numero: '0001-2026-X', fecha: '2026-09-20', dias_falta: 1, estado: 'entregado', entregado_at: '2026-09-22T10:00:00Z', por_correo: false }
  ],
  avisos: [{ id: 'a1', fecha: '2026-10-02', canal: 'whatsapp', enviado_at: '2026-10-02T14:00:00Z' }]
};
const l = armarLineaTiempo(datos);
assert.deepEqual(l.map(i => i.id), ['doc-d2', 'doc-d1', 'of-o1', 'av-a1', 'of-o2']);   // más reciente primero
assert.equal(l[0].clase, 'seguimiento');
assert.equal(l[0].detalle, 'Seguimiento del documento 0010-2026-X');
assert.equal(l[1].estado, 'Entregado');
assert.equal(l[2].estado, 'Enviado por correo');
assert.equal(l[2].detalle, '3 días de falta · del 01/10/2026 al 14/10/2026');
assert.equal(l[3].detalle, 'Falta del 02/10/2026 · por WhatsApp');
assert.equal(l[4].detalle, '1 día de falta');
assert.equal(l[4].estado, 'Entregado');
assert.deepEqual(resumenHojaRuta(l), { documentos: 1, seguimientos: 1, faltas: 2, avisos: 1 });
assert.deepEqual(armarLineaTiempo(null), []);
assert.deepEqual(armarLineaTiempo({}), []);

const p = docParaImpresion(datos.documentos[0]);
assert.equal(p.datos_plantilla.notas, 'Acciones…');
assert.equal(p.created_at, '2026-10-10T15:00:00Z');
assert.deepEqual(p.historial_recorrido, []);
console.log('hojaRutaFamilia: OK');
