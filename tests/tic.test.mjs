import assert from 'node:assert/strict';
import { clasificarLatencia, usuarioConProblema, formatoDuracion, navegadorCorto, horaPico, intensidadCalor, crearLimitador, etiquetaEvento, esEventoExterno } from '../src/lib/tic.js';
import { crearMonitorTic } from '../src/lib/ticMonitor.js';
import { crearVigilante, normalizarIp } from '../server/src/lib/seguridad.js';

// ── utilidades puras ──
assert.equal(clasificarLatencia(300).id, 'buena');
assert.equal(clasificarLatencia(2500).id, 'lento');
assert.equal(clasificarLatencia(4500).id, 'muy_lento');
assert.equal(clasificarLatencia(null).id, 'sin_dato');
assert.deepEqual(usuarioConProblema({ db_p95: 300, fallos: 0, offline_seg: 0, pct_lentos: 0 }), { problema: false, motivos: [] });
assert.ok(usuarioConProblema({ db_p95: 3000 }).motivos.includes('latencia alta'));
assert.ok(usuarioConProblema({ offline_seg: 90 }).motivos.includes('se quedó sin internet'));
assert.ok(usuarioConProblema({ fallos: 4 }).problema);
assert.equal(formatoDuracion(0.2), '< 1 min'); assert.equal(formatoDuracion(45), '45 min'); assert.equal(formatoDuracion(125), '2 h 5 min'); assert.equal(formatoDuracion(60), '1 h'); assert.equal(formatoDuracion(null), '—');
assert.equal(navegadorCorto('Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537'), 'Chrome · Windows');
assert.equal(navegadorCorto('Mozilla/5.0 (Linux; Android 13) SamsungBrowser/22 Chrome/115'), 'Samsung · Android');
assert.equal(horaPico([{ hr: 7, usuarios: '10' }, { hr: 8, usuarios: '25' }, { hr: 9, usuarios: '5' }]).hr, 8);
assert.equal(horaPico([]), null); assert.equal(horaPico([{ hr: 1, usuarios: 0 }]), null);
assert.equal(intensidadCalor(5, 10), 0.5); assert.equal(intensidadCalor(5, 0), 0); assert.equal(intensidadCalor(50, 10), 1);
assert.equal(esEventoExterno('rociado_contrasenas'), true); assert.equal(esEventoExterno('borrado_masivo'), false); assert.equal(etiquetaEvento('algo_raro'), 'algo_raro');
{ let t = 0; const ok = crearLimitador(1000, () => t); assert.equal(ok('a'), true); assert.equal(ok('a'), false); assert.equal(ok('b'), true); t = 1500; assert.equal(ok('a'), true); }

// ── monitor de conexión ──
const espera = () => new Promise(r => setTimeout(r, 10));   // iniciar() lanza el primer latido solo
function mkMonitor({ latidoResp = { data: '2026-10-22T00:00:00Z', error: null }, fetchOk = true, online = true } = {}) {
  const llamadas = []; let t = 0;
  const supabase = {
    auth: { getSession: async () => ({ data: { session: { access_token: 'tk' } } }) },
    rpc: async (n, a) => { llamadas.push([n, a]); t += 120; if (n === 'tic_iniciar_sesion') return { data: 'ses-1', error: null }; if (n === 'tic_latido') return typeof latidoResp === 'function' ? latidoResp() : latidoResp; return { data: null, error: null }; }
  };
  const fetchFn = async () => { t += 300; if (!fetchOk) throw new Error('red'); return { ok: true }; };
  const nav = { onLine: online, userAgent: 'UA' };
  const m = crearMonitorTic({ supabase, apiUrl: 'https://api.test', urlRest: 'https://sb.test', anonKey: 'k', fetchFn, ahora: () => t, ventana: null, doc: null, nav, ruta: () => '/x', intervaloMs: 1e9 });
  return { m, llamadas, nav };
}
{
  const { m, llamadas } = mkMonitor(); m.iniciar(); await espera();
  assert.deepEqual(llamadas.map(l => l[0]).slice(0, 2), ['tic_iniciar_sesion', 'tic_latido']);
  const lat = llamadas.find(l => l[0] === 'tic_latido')[1];
  assert.equal(lat.p_sesion, 'ses-1'); assert.equal(lat.p_lat_api, 300); assert.equal(lat.p_ruta, '/x'); assert.equal(lat.p_fallos, 0);
  await m._latido();   // el segundo latido lleva la latencia medida en el primero
  assert.equal(llamadas.filter(l => l[0] === 'tic_latido').at(-1)[1].p_lat_db, 120);
  await m.cerrar('logout'); assert.equal(llamadas.at(-1)[0], 'tic_cerrar_sesion'); assert.equal(llamadas.at(-1)[1].p_motivo, 'logout');
}
{ // servidor caído: se cuenta el fallo y se reporta
  const { m, llamadas } = mkMonitor({ fetchOk: false }); m.iniciar(); await espera();
  const lat = llamadas.find(l => l[0] === 'tic_latido')[1]; assert.equal(lat.p_lat_api, null); assert.ok(lat.p_fallos >= 1);
}
{ // sin internet: no llama a nada
  const { m, llamadas } = mkMonitor({ online: false }); m.iniciar(); await espera(); await m._latido(); assert.equal(llamadas.length, 0);
}
{ // la sesión remota ya no existe (null): abre otra
  let n = 0; const { m, llamadas } = mkMonitor({ latidoResp: () => ({ data: n++ === 0 ? null : 'ok', error: null }) }); m.iniciar(); await espera();
  assert.equal(llamadas.filter(l => l[0] === 'tic_iniciar_sesion').length >= 2, true);
}
{ // un error de la base nunca lanza excepción
  const { m } = mkMonitor({ latidoResp: { data: null, error: { message: 'boom' } } }); m.iniciar(); await espera(); assert.ok(m._estado().fallos >= 1);
}

// ── vigilante del servidor ──
assert.equal(normalizarIp('::ffff:10.0.0.1'), '10.0.0.1'); assert.equal(normalizarIp(''), null);
{
  const inserts = [];
  const sb = { from: t => ({ select: () => ({ eq: async () => ({ data: [{ ip: '9.9.9.9', hasta: null }, { ip: '8.8.8.8', hasta: '2000-01-01T00:00:00Z' }], error: null }) }), insert: async fila => { inserts.push([t, fila]); return { error: null }; } }) };
  const v = crearVigilante({ supabase: sb, programar: false });
  const res = () => { const r = { codigo: 200, fin: [], status(c) { r.codigo = c; return r; }, json(b) { r.cuerpo = b; return r; }, on(e, f) { r.fin.push(f); } }; return r; };
  let r = res(), siguio = false; await v.bloqueo({ path: '/asistencia', ip: '::ffff:9.9.9.9', method: 'POST', originalUrl: '/asistencia?token=secreto' }, r, () => { siguio = true; });
  assert.equal(r.codigo, 403); assert.equal(siguio, false);
  r = res(); siguio = false; await v.bloqueo({ path: '/asistencia', ip: '8.8.8.8', method: 'GET', originalUrl: '/asistencia' }, r, () => { siguio = true; }); assert.equal(siguio, true);   // bloqueo vencido
  r = res(); siguio = false; await v.bloqueo({ path: '/health', ip: '9.9.9.9' }, r, () => { siguio = true; }); assert.equal(siguio, true);              // /health nunca se bloquea
  // vigilancia: 404 y 429 se registran, 200 no, y la ruta no lleva la query (puede traer tokens)
  const reg = (ip, estado, url) => { const rr = res(); v.vigilancia({ ip, method: 'GET', originalUrl: url }, rr, () => {}); rr.statusCode = estado; rr.fin.forEach(f => f()); };
  reg('1.1.1.1', 404, '/.env?x=1'); reg('1.1.1.1', 404, '/.env?x=2'); reg('1.1.1.1', 200, '/ok'); reg('1.1.1.1', 429, '/asistencia');
  await v._vaciar();
  const filas = inserts.flatMap(i => i[1]);
  const tipos = filas.map(f => f.tipo).sort();
  assert.ok(tipos.includes('ip_bloqueo_activo'), 'registra el intento de una IP bloqueada');
  assert.equal(filas.filter(f => f.tipo === 'sondeo_ruta').length, 1, 'el mismo sondeo repetido en 1 minuto se registra una sola vez');
  assert.equal(filas.find(f => f.tipo === 'sondeo_ruta').detalle.ruta, '/.env');
  assert.ok(tipos.includes('rate_limit')); assert.equal(filas.some(f => JSON.stringify(f).includes('secreto')), false);
}
console.log('tic.test.mjs OK');

// ── IPs compartidas ──
import { clasificarIpCompartida, coincideIp, ordenarIpsPorRiesgo, resumenAccesos, ROLES_SENSIBLES } from '../src/lib/tic.js';
const ipx = (extra) => ({ n_usuarios: 2, n_planteles: 1, nocturnas: 0, usuarios: [{ rol: 'docente' }, { rol: 'docente' }], ...extra });
assert.equal(clasificarIpCompartida(ipx({})).nivel, 'info');
assert.equal(clasificarIpCompartida(ipx({ n_usuarios: 3 })).nivel, 'alerta');
assert.equal(clasificarIpCompartida(ipx({ usuarios: [{ rol: 'admin_plantel' }, { rol: 'contador_plantel' }] })).nivel, 'alerta');
assert.equal(clasificarIpCompartida(ipx({ usuarios: [{ rol: 'admin_plantel' }, { rol: 'docente' }] })).nivel, 'info', 'un solo rol sensible de día es red compartida');
assert.equal(clasificarIpCompartida(ipx({ n_planteles: 2 })).nivel, 'critico');
assert.equal(clasificarIpCompartida(ipx({ nocturnas: 1, usuarios: [{ rol: 'contador_plantel' }, { rol: 'docente' }] })).nivel, 'critico');
assert.equal(clasificarIpCompartida(ipx({ nocturnas: 3 })).nivel, 'info', 'madrugada sin rol sensible no escala');
assert.ok(ROLES_SENSIBLES.includes('super_admin') && !ROLES_SENSIBLES.includes('docente'));
assert.equal(coincideIp('190.110.44.218', ''), true);
assert.equal(coincideIp('190.110.44.218', '190.110.44.218'), true);
assert.equal(coincideIp('190.110.44.218', '190.110.'), true);
assert.equal(coincideIp('190.110.44.218', '190.111'), false);
assert.equal(coincideIp('190.110.44.218', ' 190.110 '), true, 'se ignoran espacios');
const ord = ordenarIpsPorRiesgo([
  { ip: 'a', n_usuarios: 2, n_planteles: 1, nocturnas: 0, usuarios: [], ultima: '2026-10-01' },
  { ip: 'b', n_usuarios: 5, n_planteles: 1, nocturnas: 0, usuarios: [], ultima: '2026-10-02' },
  { ip: 'c', n_usuarios: 2, n_planteles: 2, nocturnas: 0, usuarios: [], ultima: '2026-09-01' }]);
assert.deepEqual(ord.map(i => i.ip), ['c', 'b', 'a']);
assert.equal(ord[0].riesgo.nivel, 'critico');
const ra = resumenAccesos([{ user_id: 'u1', abierta: true, minutos: 600 }, { user_id: 'u1', abierta: false, minutos: 20 }, { user_id: 'u2', abierta: true, minutos: 30 }], ord);
assert.deepEqual(ra, { activas: 2, usuariosUnicos: 2, ipsCompartidas: 3, ipsCriticas: 1, largas: 1 });
console.log('tic (IPs compartidas): OK');

import { resumirIpDesdeSesiones } from '../src/lib/tic.js';
const ses = [
  { user_id: 'u1', nombre: 'Ana', email: 'a@x', rol: 'admin_plantel', institucion_id: 'i1', plantel: 'P1', inicio: '2026-10-20T15:00:00Z' },   // 10:00 Ecuador
  { user_id: 'u1', nombre: 'Ana', email: 'a@x', rol: 'admin_plantel', institucion_id: 'i1', plantel: 'P1', inicio: '2026-10-21T07:30:00Z' },   // 02:30 Ecuador → madrugada
  { user_id: 'u2', nombre: 'Beto', email: 'b@x', rol: 'docente', institucion_id: 'i2', plantel: 'P2', inicio: '2026-10-22T16:00:00Z' }];
const r = resumirIpDesdeSesiones(ses);
assert.equal(r.n_usuarios, 2); assert.equal(r.n_sesiones, 3); assert.equal(r.n_planteles, 2); assert.equal(r.nocturnas, 1);
assert.equal(r.primera, '2026-10-20T15:00:00Z'); assert.equal(r.ultima, '2026-10-22T16:00:00Z');
assert.equal(r.usuarios[0].nombre, 'Beto'); assert.equal(r.usuarios.find(u => u.user_id === 'u1').sesiones, 2);
assert.equal(clasificarIpCompartida(r).nivel, 'critico');
assert.equal(resumirIpDesdeSesiones([]).n_usuarios, 0);
console.log('resumirIpDesdeSesiones: OK');
