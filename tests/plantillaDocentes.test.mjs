import test from 'node:test';
import assert from 'node:assert/strict';
import { filaAPayloadDocente, combinarResultado, ROLES_PLANTILLA_DOCENTES } from '../src/lib/plantillaDocentes.js';

test('fila válida: arma el payload y no marca errores', () => {
  const { payload, errores } = filaAPayloadDocente({ 'Cédula': '1710034065', 'Nombres': 'Juan', 'Apellidos': 'Pérez', 'Situación (NOMBRAMIENTO/CONTRATO/OCASIONAL/REEMPLAZO)': 'contrato', 'Fecha Ingreso (AAAA-MM-DD)': '2020-03-15' });
  assert.deepEqual(errores, []);
  assert.equal(payload.situacion, 'CONTRATO');
  assert.equal(payload.fecha_ingreso, '2020-03-15');
});
test('cédula inválida, nombres vacíos y fecha mala se detectan', () => {
  const { errores } = filaAPayloadDocente({ 'Cédula': '1234567890', 'Nombres': '', 'Apellidos': 'X', 'Fecha Ingreso (AAAA-MM-DD)': 'ayer' });
  assert.ok(errores.includes('cédula inválida'));
  assert.ok(errores.includes('nombres vacíos'));
  assert.ok(errores.includes('fecha de ingreso inválida'));
});
test('combinarResultado respeta el orden y las filas locales con error no se envían', () => {
  const locales = [{ payload: { cedula: 'a' }, errores: [] }, { payload: { cedula: 'b' }, errores: ['cédula inválida'] }, { payload: { cedula: 'c' }, errores: [] }];
  const enviadas = [0, 2];
  const resp = { filas: [{ fila: 1, accion: 'crear', motivo: null }, { fila: 2, accion: 'actualizar', motivo: null }] };
  const r = combinarResultado(locales, enviadas, resp);
  assert.deepEqual(r.map(x => [x.n, x.accion]), [[2, 'crear'], [3, 'error'], [4, 'actualizar']]);
});
test('el inspector general y el super admin pueden usar la plantilla; el docente y la familia no', () => {
  assert.ok(ROLES_PLANTILLA_DOCENTES.includes('inspector_general'));
  assert.ok(ROLES_PLANTILLA_DOCENTES.includes('super_admin'));
  assert.ok(!ROLES_PLANTILLA_DOCENTES.includes('docente'));
  assert.ok(!ROLES_PLANTILLA_DOCENTES.includes('estudiante'));
});
test('la fila de ejemplo de la plantilla NO pasa la validación (si se sube sin borrarla, no crea un docente falso)', () => {
  const ejemplo = {}; 
  return import('../src/lib/plantillaDocentes.js').then(m => {
    m.PLANTILLA_DOCENTES_COLS.forEach((c, i) => { ejemplo[c] = m.PLANTILLA_DOCENTES_EJEMPLO[i]; });
    assert.ok(m.filaAPayloadDocente(ejemplo).errores.includes('cédula inválida'));
  });
});
