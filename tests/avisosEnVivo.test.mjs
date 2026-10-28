import assert from 'node:assert/strict';
import { crearAvisosEnVivo, textoAviso } from '../src/lib/avisosEnVivo.js';

// Cliente falso de Supabase
function falso({ falla = false } = {}) {
  const reg = { canales: [], quitados: 0, handlers: [] };
  const canal = { on(tipo, filtro, fn) { reg.handlers.push({ filtro, fn }); return canal; }, subscribe() { if (falla) throw new Error('sin conexión'); return canal; } };
  return { reg, channel(nombre) { reg.canales.push(nombre); return canal; }, removeChannel() { reg.quitados++; } };
}
const docFalso = () => { const l = {}; return { hidden: false, addEventListener: (e, f) => { l[e] = f; }, removeEventListener: (e) => { delete l[e]; }, emitir: e => l[e] && l[e](), l }; };
let timers = []; const setT = (f, ms) => { timers.push({ f, ms }); return timers.length; }; const clearT = id => { timers[id - 1] = null; };

// Textos
assert.equal(textoAviso('notificaciones', 'INSERT', { titulo: 'Reunión' }), 'Nueva notificación: Reunión');
assert.equal(textoAviso('notificaciones', 'INSERT', { titulo: 'Lluvias', prioridad: 'urgente' }), 'URGENTE: Lluvias');
assert.equal(textoAviso('notificaciones', 'INSERT', { titulo: 'Notas', prioridad: 'importante' }), 'Importante: Notas');
assert.equal(textoAviso('notificaciones', 'DELETE', {}), null);
assert.equal(textoAviso('justificaciones', 'INSERT', {}), 'Llegó una nueva justificación');
assert.equal(textoAviso('justificaciones', 'UPDATE', { estado: 'aprobada' }), 'Una justificación quedó como: aprobada');

// Se suscribe a las dos tablas, SOLO de su plantel
let sb = falso(), doc = docFalso(), avisos = [];
let v = crearAvisosEnVivo(sb, { institucionId: 'I1', perfilId: 'P1', alAviso: a => avisos.push(a), doc, setT, clearT });
v.iniciar();
assert.equal(sb.reg.handlers.length, 2); assert.ok(sb.reg.handlers.every(h => h.filtro.filter === 'institucion_id=eq.I1'));
assert.deepEqual(sb.reg.handlers.map(h => h.filtro.table), ['notificaciones', 'justificaciones']);
sb.reg.handlers[0].fn({ eventType: 'INSERT', new: { titulo: 'Hola', created_by: 'OTRO' } });
sb.reg.handlers[1].fn({ eventType: 'UPDATE', new: { estado: 'rechazada', created_by: 'OTRO' } });
sb.reg.handlers[0].fn({ eventType: 'INSERT', new: { titulo: 'Mío', created_by: 'P1' } });   // lo hice yo: sin aviso
sb.reg.handlers[0].fn(null); sb.reg.handlers[1].fn({ eventType: 'DELETE' });                // datos raros: no revienta
assert.deepEqual(avisos.map(a => a.texto), ['Nueva notificación: Hola', 'Una justificación quedó como: rechazada']);

// Pestaña oculta mucho rato: libera la conexión; al volver, reconecta y avisa para refrescar
doc.hidden = true; doc.emitir('visibilitychange'); assert.equal(timers.length, 1); assert.equal(timers[0].ms, 120000);
timers[0].f(); assert.equal(sb.reg.quitados, 1);
doc.hidden = false; doc.emitir('visibilitychange'); assert.equal(sb.reg.canales.length, 2);
assert.equal(avisos[avisos.length - 1].evento, 'RECONECTADO');
// Vuelve antes de tiempo: no cierra nada
doc.hidden = true; doc.emitir('visibilitychange'); doc.hidden = false; doc.emitir('visibilitychange'); assert.equal(timers[timers.length - 1], null);
v.detener(); assert.equal(sb.reg.quitados, 2); assert.equal(doc.l.visibilitychange, undefined);

// Si Supabase falla o no hay plantel: no lanza error y simplemente no escucha
sb = falso({ falla: true }); v = crearAvisosEnVivo(sb, { institucionId: 'I1', perfilId: 'P1', alAviso() {}, doc: docFalso(), setT, clearT });
v.iniciar(); assert.equal(v._estado().abierto, false); v.detener();
v = crearAvisosEnVivo(falso(), { institucionId: null, perfilId: 'P1', alAviso() {}, doc: docFalso(), setT, clearT }); v.iniciar(); assert.equal(v._estado().abierto, false); v.detener();
// Un aviso que falla en la pantalla no rompe la escucha
sb = falso(); v = crearAvisosEnVivo(sb, { institucionId: 'I1', perfilId: 'P1', alAviso() { throw new Error('toast roto'); }, doc: docFalso(), setT, clearT }); v.iniciar();
sb.reg.handlers[0].fn({ eventType: 'INSERT', new: { titulo: 'x', created_by: 'O' } });
console.log('avisosEnVivo OK');
