import assert from 'node:assert/strict';
import * as N from '../src/lib/notificaciones.js';

const AHORA = new Date('2026-10-26T15:00:00Z').getTime();   // 10:00 en Ecuador

// ── Permisos en pantalla ──
for (const r of ['super_admin', 'admin_plantel', 'secretario', 'inspector_general', 'docente']) assert.equal(N.puedeEnviar(r), true, r);
for (const r of ['padre', 'estudiante', 'contador_plantel', 'administrativo', 'supervisor_plantel']) assert.equal(N.puedeEnviar(r), false, r);
assert.deepEqual(N.gruposPermitidos('docente').map(g => g.id), ['alumno', 'padre']);
assert.equal(N.gruposPermitidos('admin_plantel').length, 6);
assert.ok(!N.prioridadesPermitidas('docente').some(p => p.id === 'urgente')); assert.ok(N.prioridadesPermitidas('admin_plantel').some(p => p.id === 'urgente'));
assert.ok(!N.categoriasPermitidas('docente').some(c => c.id === 'emergencia'));

// ── Grupos por rol (igual que la base de datos) ──
const g = { admin_plantel: 'admin_plantel', supervisor_plantel: 'admin_plantel', secretario: 'secretario', contador_plantel: 'secretario', administrativo: 'secretario', inspector_general: 'inspector', docente: 'docente', estudiante: 'alumno', padre: 'padre', super_admin: 'super_admin' };
for (const [rol, esp] of Object.entries(g)) assert.equal(N.grupoDeRol(rol), esp, rol);
assert.equal(N.grupoDeRol('inventado'), null);
assert.equal(N.esParaGrupo(['all'], 'docente'), true); assert.equal(N.esParaGrupo(['alumno'], 'docente'), false);
assert.equal(N.esParaGrupo(['estudiante'], 'alumno'), true); assert.equal(N.esParaGrupo(['representante'], 'padre'), true);
assert.equal(N.esParaGrupo(['padre'], 'alumno'), false); assert.equal(N.esParaGrupo(['all'], 'super_admin'), false); assert.equal(N.esParaGrupo(null, 'docente'), false);

// ── Validación del formulario ──
const ok = { ...N.formularioVacio(), titulo: 'Reunión de padres', cuerpo: 'Se convoca a la reunión.', destinos: ['padre'] };
assert.deepEqual(N.validarFormulario(ok, { rolDb: 'admin_plantel', ahora: AHORA }), []);
assert.ok(N.validarFormulario({ ...ok, titulo: 'ab' }, { rolDb: 'admin_plantel' }).some(e => /título/i.test(e)));
assert.ok(N.validarFormulario({ ...ok, titulo: 'x'.repeat(141) }, { rolDb: 'admin_plantel' }).some(e => /140/.test(e)));
assert.ok(N.validarFormulario({ ...ok, cuerpo: ' ' }, { rolDb: 'admin_plantel' }).some(e => /mensaje/i.test(e)));
assert.ok(N.validarFormulario({ ...ok, cuerpo: 'x'.repeat(4001) }, { rolDb: 'admin_plantel' }).some(e => /4000/.test(e)));
assert.ok(N.validarFormulario({ ...ok, destinos: [] }, { rolDb: 'admin_plantel' }).some(e => /dirigida/i.test(e)));
assert.deepEqual(N.validarFormulario({ ...ok, destinos: [], todos: true }, { rolDb: 'admin_plantel' }), []);
assert.ok(N.validarFormulario({ ...ok, expira: '2026-10-20' }, { rolDb: 'admin_plantel', ahora: AHORA }).some(e => /vigencia/i.test(e)));
assert.deepEqual(N.validarFormulario({ ...ok, expira: '2026-11-30' }, { rolDb: 'admin_plantel', ahora: AHORA }), []);
// Docente: solo sus cursos, sin urgentes, sin "todos"
const doc = { ...ok, destinos: ['padre'], paralelos: ['p1'] };
assert.deepEqual(N.validarFormulario(doc, { rolDb: 'docente', paralelosPermitidos: ['p1', 'p2'] }), []);
assert.ok(N.validarFormulario({ ...doc, paralelos: [] }, { rolDb: 'docente', paralelosPermitidos: ['p1'] }).some(e => /cursos/i.test(e)));
assert.ok(N.validarFormulario({ ...doc, paralelos: ['p9'] }, { rolDb: 'docente', paralelosPermitidos: ['p1'] }).some(e => /donde enseñas/i.test(e)));
assert.ok(N.validarFormulario({ ...doc, prioridad: 'urgente' }, { rolDb: 'docente', paralelosPermitidos: ['p1'] }).some(e => /urgencias/i.test(e)));
assert.ok(N.validarFormulario({ ...doc, destinos: ['docente'] }, { rolDb: 'docente', paralelosPermitidos: ['p1'] }).some(e => /no puedes usar/i.test(e)));
assert.ok(N.validarFormulario({ ...doc, todos: true }, { rolDb: 'docente', paralelosPermitidos: ['p1'] }).some(e => /solo puedes avisar/i.test(e)));

// ── Fila que se guarda ──
let fila = N.armarNotificacion({ ...ok, titulo: '  Reunión  ', cuerpo: ' texto ', prioridad: 'importante', fijada: true, expira: '2026-11-30' }, 'I1');
assert.equal(fila.titulo, 'Reunión'); assert.equal(fila.cuerpo, 'texto'); assert.deepEqual(fila.para_roles, ['padre']); assert.equal(fila.para_paralelos, null);
assert.equal(fila.fijada, true); assert.equal(fila.prioridad, 'importante'); assert.ok(fila.expira_at.startsWith('2026-12-01') || fila.expira_at.startsWith('2026-11-30'));
fila = N.armarNotificacion({ ...ok, todos: true, destinos: ['docente'], paralelos: ['p1', 'p2'] }, 'I1');
assert.deepEqual(fila.para_roles, ['all']); assert.deepEqual(fila.para_paralelos, ['p1', 'p2']);
fila = N.armarNotificacion({ ...ok, destinos: ['secretario'], paralelos: ['p1'] }, 'I1');
assert.equal(fila.para_paralelos, null);   // los cursos no aplican al personal administrativo
assert.equal(N.armarNotificacion(ok, 'I1').expira_at, null);

// ── Plantillas ──
const f2 = N.aplicarPlantilla(N.formularioVacio(), N.PLANTILLAS[1]);
assert.equal(f2.prioridad, 'urgente'); assert.equal(f2.categoria, 'emergencia'); assert.deepEqual(f2.destinos, ['docente', 'alumno', 'padre']);
assert.ok(N.PLANTILLAS.every(p => p.titulo.length >= 3 && p.titulo.length <= 140 && p.cuerpo.length >= 3 && p.destinos.every(d => N.ETIQUETA_GRUPO[d])));
assert.equal(N.requiereConfirmacion({ prioridad: 'urgente' }, 5), true); assert.equal(N.requiereConfirmacion({ prioridad: 'normal' }, 120), true);
assert.equal(N.requiereConfirmacion({ prioridad: 'normal' }, 30), false); assert.equal(N.requiereConfirmacion({ prioridad: 'normal', todos: true }, 3), true);

// ── Presentación ──
assert.equal(N.etiquetaDestinatarios(['all']), 'Todos');
assert.equal(N.etiquetaDestinatarios(['padre', 'alumno'], 2), 'Padres y representantes, Estudiantes · 2 cursos');
assert.equal(N.etiquetaDestinatarios(['estudiante', 'alumno']), 'Estudiantes');   // no se repite
assert.equal(N.etiquetaDestinatarios(['docente'], 1), 'Docentes · 1 curso');
assert.equal(N.etiquetaDestinatarios([]), 'Sin destinatarios');
const hace = ms => new Date(AHORA - ms).toISOString();
assert.equal(N.tiempoRelativo(hace(20000), AHORA), 'ahora'); assert.equal(N.tiempoRelativo(hace(5 * 60000), AHORA), 'hace 5 min');
assert.equal(N.tiempoRelativo(hace(3 * 3600000), AHORA), 'hace 3 h'); assert.equal(N.tiempoRelativo(hace(30 * 3600000), AHORA), 'ayer');
assert.equal(N.tiempoRelativo(hace(3 * 86400000), AHORA), 'hace 3 días'); assert.equal(N.tiempoRelativo('basura', AHORA), '');
// Secciones por día en hora de Ecuador: las 02:00 UTC del 26 son las 21:00 del 25 en Ecuador → "Ayer"
assert.equal(N.seccionDeFecha('2026-10-26T14:00:00Z', AHORA), 'Hoy');
assert.equal(N.seccionDeFecha('2026-10-26T02:00:00Z', AHORA), 'Ayer');
assert.equal(N.seccionDeFecha('2026-10-22T14:00:00Z', AHORA), 'Esta semana'); assert.equal(N.seccionDeFecha('2026-09-01T14:00:00Z', AHORA), 'Anteriores');
const lista = [
  { id: 1, titulo: 'Reunión de padres', cuerpo: 'Viernes 18:00', created_at: '2026-10-26T14:00:00Z', fijada: false, leida: false, prioridad: 'importante', categoria: 'evento', es_mia: false },
  { id: 2, titulo: 'Suspensión', cuerpo: 'Por lluvias', created_at: '2026-10-25T20:00:00Z', fijada: true, leida: true, prioridad: 'urgente', categoria: 'emergencia', es_mia: false },
  { id: 3, titulo: 'Notas', cuerpo: 'Entrega de calificaciones', created_at: '2026-09-01T14:00:00Z', fijada: false, leida: true, prioridad: 'normal', categoria: 'academico', es_mia: true }
];
assert.deepEqual(N.agruparBandeja(lista, AHORA).map(g => g.seccion + ':' + g.items.length), ['Fijadas:1', 'Hoy:1', 'Anteriores:1']);
assert.deepEqual(N.contarBandeja(lista), { todas: 3, no_leidas: 1, importantes: 1, urgentes: 1, mias: 1 });
assert.deepEqual(N.filtrarBandeja(lista, { filtro: 'no_leidas' }).map(n => n.id), [1]);
assert.deepEqual(N.filtrarBandeja(lista, { filtro: 'urgentes' }).map(n => n.id), [2]);
assert.deepEqual(N.filtrarBandeja(lista, { filtro: 'mias' }).map(n => n.id), [3]);
assert.deepEqual(N.filtrarBandeja(lista, { q: 'reunion' }).map(n => n.id), [1]);          // sin tildes
assert.deepEqual(N.filtrarBandeja(lista, { q: 'CALIFICACIONES' }).map(n => n.id), [3]);   // sin mayúsculas
assert.deepEqual(N.filtrarBandeja(lista, { categoria: 'academico' }).map(n => n.id), [3]);
assert.deepEqual(N.filtrarBandeja(null, {}), []);
assert.equal(N.estadoLectura(95).id, 'alta'); assert.equal(N.estadoLectura(80).id, 'alta'); assert.equal(N.estadoLectura(79.9).id, 'media');
assert.equal(N.estadoLectura(50).id, 'media'); assert.equal(N.estadoLectura(49.9).id, 'baja'); assert.equal(N.estadoLectura(null).id, 'sin_datos'); assert.equal(N.estadoLectura(0).id, 'baja');

// ── Enlaces seguros: solo http/https y nunca HTML ──
assert.deepEqual(N.partirEnlaces('Mira https://sigee.ec/ayuda. Gracias'), [{ t: 'texto', v: 'Mira ' }, { t: 'enlace', v: 'https://sigee.ec/ayuda' }, { t: 'texto', v: '.' }, { t: 'texto', v: ' Gracias' }]);
const peligro = N.partirEnlaces('<script>alert(1)</script> javascript:alert(1) data:text/html,x https://ok.ec');
assert.deepEqual(peligro.filter(p => p.t === 'enlace').map(p => p.v), ['https://ok.ec']);   // javascript: y data: NO son enlaces
assert.ok(peligro.filter(p => p.t === 'texto').map(p => p.v).join('').includes('<script>'));  // el HTML queda como texto plano (React lo escapa)
assert.deepEqual(N.partirEnlaces(''), []); assert.deepEqual(N.partirEnlaces(null), []);
assert.equal(N.extracto('a'.repeat(200), 50).length, 50); assert.equal(N.extracto('  hola   mundo  '), 'hola mundo');
assert.equal(N.ETIQUETA_ROL.inspector_general, 'Inspección General'); assert.equal(N.ETIQUETA_ROL.admin_plantel, 'Administración'); assert.equal(N.ETIQUETA_ROL.padre, undefined);
console.log('notificaciones OK');
