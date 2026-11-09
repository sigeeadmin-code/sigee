import assert from 'node:assert/strict';
import { rutaPermitidaParaRolDb, rolesConAcceso } from '../src/lib/nav.js';
import { readFileSync } from 'node:fs';
import { grupoDeRol } from '../src/lib/notificaciones.js';

// supabase.js usa import.meta.env (solo existe en el navegador): se lee la tabla ROLE_GROUP del propio archivo
const ROLE_GROUP = new Function('return ' + /export const ROLE_GROUP = (\{[\s\S]*?\});/.exec(readFileSync(new URL('../src/lib/supabase.js', import.meta.url), 'utf8'))[1].replace(/;$/, ''))();
const ok = (rolDb, ruta) => rutaPermitidaParaRolDb(ruta, ROLE_GROUP[rolDb], rolDb);

// DECE (docs/ROL-DECE.md): consulta + oficios en su paso; sin análisis académicos, finanzas ni administración
assert.equal(ROLE_GROUP.dece, 'dece');
for (const r of ['/', '/notificaciones', '/estudiantes', '/justificaciones', '/oficios', '/configuracion']) assert.equal(ok('dece', r), true, 'DECE debe ver ' + r);
for (const r of ['/analisis-calificaciones', '/analisis-asistencia', '/licencias', '/usuarios', '/asistencia', '/boletas', '/matriculas']) assert.equal(ok('dece', r), false, 'DECE NO debe ver ' + r);

// Secretaría (docs/ROL-SECRETARIA.md): maneja Oficios; Finanzas (licencias) no
assert.equal(ok('secretario', '/oficios'), true);
assert.equal(ok('secretario', '/licencias'), false);
assert.equal(ok('secretario', '/estudiantes'), true);
// Contador de plantel (mismo menú de Secretaría): licencias sí, oficios no
assert.equal(ok('contador_plantel', '/licencias'), true);
assert.equal(ok('contador_plantel', '/oficios'), false);
// Administrativo: ambos
assert.equal(ok('administrativo', '/oficios'), true);
assert.equal(ok('administrativo', '/licencias'), true);
// Sin cambios para quienes ya tenían acceso
for (const r of ['inspector_general', 'admin_plantel']) assert.equal(ok(r, '/oficios'), true, r + ' sigue viendo Oficios');
assert.equal(ok('admin_plantel', '/licencias'), true);
assert.equal(ok('docente', '/oficios'), true);
// la ruta de Oficios llega a DECE
assert.ok(rolesConAcceso('/oficios').includes('dece'));
// notificaciones: el rol DECE pertenece al grupo «dece» (igual que mi_grupo_notificacion() en la base)
assert.equal(grupoDeRol('dece'), 'dece');
console.log('navRoles: OK');
