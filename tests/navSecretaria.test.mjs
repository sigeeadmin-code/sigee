import test from 'node:test';
import assert from 'node:assert/strict';
import { rutaPermitidaParaRolDb } from '../src/lib/nav.js';
// Copia del mapa rol de la BD → grupo de menú (src/lib/supabase.js no se puede importar fuera de Vite).
const ROLE_GROUP = {
  super_admin: 'super_admin', admin_plantel: 'admin_plantel', secretario: 'secretario', contador_plantel: 'secretario', administrativo: 'secretario',
  inspector_general: 'inspector', dece: 'dece', docente: 'docente', estudiante: 'alumno', padre: 'padre'
};

const puede = (path, rolDb) => rutaPermitidaParaRolDb(path, ROLE_GROUP[rolDb], rolDb);

test('el secretario y el administrativo ven Competencias de Secretaría y Docentes (para usar la plantilla)', () => {
  for (const rol of ['secretario', 'administrativo']) {
    assert.ok(puede('/secretaria', rol), `${rol} /secretaria`);
    assert.ok(puede('/docentes', rol), `${rol} /docentes`);
  }
});
test('el contador del plantel (mismo grupo de menú) no ve Competencias de Secretaría ni Docentes', () => {
  assert.ok(!puede('/secretaria', 'contador_plantel'));
  assert.ok(!puede('/docentes', 'contador_plantel'));
});
test('el admin de plantel ve Competencias de Secretaría; docente, padre, estudiante, inspector y DECE no', () => {
  assert.ok(puede('/secretaria', 'admin_plantel'));
  for (const rol of ['docente', 'padre', 'estudiante', 'inspector_general', 'dece']) assert.ok(!puede('/secretaria', rol), rol);
});
test('el inspector general sigue viendo Docentes (plantilla) y el estudiante no', () => {
  assert.ok(puede('/docentes', 'inspector_general'));
  assert.ok(!puede('/docentes', 'estudiante'));
});
