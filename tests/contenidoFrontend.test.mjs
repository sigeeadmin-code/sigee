import assert from 'node:assert/strict';
import { CONTENIDO_DEFAULTS, mezclarContenido, cambiosContenido, limpiarTexto, portadaActiva, chipsDe } from '../src/lib/contenidoBase.js';
import { CENTRALES, puedeVerCentrales, sanitizarBusqueda, filtroOr, filaDesdeForm } from '../src/lib/centralesBase.js';

// mezclar: lo que no está en la base conserva el texto original
const m = mezclarContenido([{ clave: 'login.hero.titulo_resaltado', valor: 'facilita' }, { clave: 'clave.inventada', valor: 'x' }, { clave: 'login.hero.badge', valor: null }]);
assert.equal(m['login.hero.titulo_resaltado'], 'facilita');
assert.equal(m['login.hero.badge'], CONTENIDO_DEFAULTS['login.hero.badge'], 'valor nulo no pisa el original');
assert.equal('clave.inventada' in m, false, 'claves desconocidas se ignoran');
assert.deepEqual(mezclarContenido(null), CONTENIDO_DEFAULTS);

// cambios: solo lo modificado, con texto limpio y límite de largo
const base = mezclarContenido([]);
const nuevo = { ...base, 'login.hero.marca': '  SIGEE   Pro  ', 'login.hero.descripcion': 'a'.repeat(900) };
const c = cambiosContenido(base, nuevo);
assert.equal(c.length, 2);
assert.equal(c.find(x => x.clave === 'login.hero.marca').valor, 'SIGEE Pro');
assert.equal(c.find(x => x.clave === 'login.hero.descripcion').valor.length, 400);
assert.deepEqual(cambiosContenido(base, base), []);
assert.equal(limpiarTexto(null), '');

// portada: solo 'false' la apaga; chips vacíos no se muestran
assert.equal(portadaActiva({ 'login.hero.activo': 'false' }), false);
assert.equal(portadaActiva({}), true);
assert.equal(portadaActiva(undefined), true);
assert.equal(chipsDe({ ...base, 'login.hero.chip3': '   ' }).length, 5);

// permisos de las bases centrales: solo el Super Admin global
assert.equal(puedeVerCentrales('super_admin'), true);
for (const r of ['supervisor_general', 'admin_plantel', 'secretario', 'contador_general', 'supervisor_plantel', 'docente', undefined]) assert.equal(puedeVerCentrales(r), false, String(r));

// búsqueda: no deja pasar caracteres que rompen el filtro
assert.equal(sanitizarBusqueda('perez,(x)%'), 'perez x');
assert.equal(filtroOr(CENTRALES['base-docentes'], 'ana, luz'), 'cedula.ilike.%ana luz%,nombre.ilike.%ana luz%');
assert.equal(filtroOr(CENTRALES['base-docentes'], '   '), null);

// formulario → fila
const cfg = CENTRALES['docentes-desvinculados'];
assert.throws(() => filaDesdeForm(cfg, { cedula: '' }), /Cédula/);
const fila = filaDesdeForm(cfg, { cedula: '0700000000', apellidos: ' Perez ', motivo: 'renuncia' }, 'u1');
assert.equal(fila.apellidos, 'Perez');
assert.equal(fila.nombres, null);
assert.equal(fila.desvinculado_por, 'u1');
assert.equal('fecha_desvinculacion' in fila, false, 'fecha vacía usa el valor por defecto de la base');
assert.equal(Object.keys(CENTRALES).length, 4);

console.log('OK contenidoFrontend: todas las pruebas pasaron');
