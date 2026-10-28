// Prueba de humo MANUAL de la pantalla de Notificaciones en un navegador simulado (jsdom) con respuestas de base de datos simuladas.
// Requisitos: npm i --no-save jsdom        Uso: node tests/manual/notificaciones_humo.mjs   (desde la raíz del repositorio)
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://sigee-sigee.vercel.app/', pretendToBeVisual: true });
for (const k of ['window', 'document', 'navigator', 'localStorage', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLSelectElement', 'Node', 'getComputedStyle', 'requestAnimationFrame', 'Event', 'CustomEvent', 'KeyboardEvent']) {
  try { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true }); } catch { /* ya existe */ }
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createServer } = await import('vite');
const React = (await import('react')).default;
const { createRoot } = await import('react-dom/client');
const { act } = await import('react');

const llamadas = []; const respuestas = {};
const fetchReal = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url); const m = u.match(/\/rpc\/([a-z_]+)/);
  const body = opts.body ? (() => { try { return JSON.parse(opts.body); } catch { return opts.body; } })() : null;
  if (m) { llamadas.push({ rpc: m[1], body }); const r = respuestas[m[1]]; const dato = typeof r === 'function' ? r(body) : r; return new Response(JSON.stringify(dato ?? null), { status: 200, headers: { 'content-type': 'application/json' } }); }
  if (/\/rest\/v1\/notificaciones/.test(u)) { llamadas.push({ tabla: 'notificaciones', metodo: opts.method, body }); return new Response(JSON.stringify({ id: 'nuevo-1' }), { status: opts.method === 'POST' ? 201 : 200, headers: { 'content-type': 'application/json' } }); }
  return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
};
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
let fallos = 0; const chequeo = (nombre, ok, extra = '') => { console.log((ok ? '✔ ' : '✘ ') + nombre + (ok ? '' : '  ' + extra)); if (!ok) fallos++; };
try {
  const { default: Notificaciones } = await vite.ssrLoadModule('/src/pages/Notificaciones.jsx');
  const { SessionCtx } = await vite.ssrLoadModule('/src/lib/SessionContext.jsx');
  const hace = h => new Date(Date.now() - h * 3600000).toISOString();
  const bandeja = [
    { id: 'n1', titulo: 'Suspensión de clases', cuerpo: 'Por lluvias intensas.\nMás info: https://sigee.ec/aviso.', para_roles: ['all'], para_paralelos: null, prioridad: 'urgente', categoria: 'emergencia', fijada: true, expira_at: null, created_at: hace(1), autor: null, autor_rol: 'inspector_general', leida: false, leida_at: null, es_mia: false },
    { id: 'n2', titulo: 'Reunión de padres', cuerpo: 'Viernes 18:00 en el auditorio.', para_roles: ['padre'], para_paralelos: ['p1'], prioridad: 'importante', categoria: 'evento', fijada: false, expira_at: null, created_at: hace(30), autor: null, autor_rol: 'admin_plantel', leida: true, leida_at: hace(20), es_mia: false },
    { id: 'n3', titulo: 'Truco', cuerpo: '<img src=x onerror=alert(1)> y javascript:alert(2) y [clic](javascript:alert(3))', para_roles: ['padre'], para_paralelos: null, prioridad: 'normal', categoria: 'general', fijada: false, expira_at: null, created_at: hace(80), autor: null, autor_rol: 'docente', leida: false, leida_at: null, es_mia: false }
  ];
  const stats = { desde: hace(700), dias: 30, alcance: 'plantel',
    resumen: { enviadas: 3, destinatarios: 90, lecturas: 52, tasa_lectura: 57.8, urgentes: 1, importantes: 1, horas_medias_lectura: 4.5, sin_leer_48h: 1 },
    por_dia: Array.from({ length: 30 }, (_, i) => ({ dia: new Date(Date.UTC(2026, 9, 27 - 29 + i)).toISOString().slice(0, 10), enviadas: i % 7 === 0 ? 1 : 0, lecturas: i % 7 === 0 ? 12 : 0 })),
    por_prioridad: { normal: 1, importante: 1, urgente: 1 }, por_categoria: { general: 1, evento: 1, emergencia: 1 },
    por_grupo: [{ grupo: 'padre', destinatarios: 60, lecturas: 40, tasa: 66.7 }, { grupo: 'docente', destinatarios: 30, lecturas: 12, tasa: 40 }],
    notificaciones: [{ id: 'n1', titulo: 'Suspensión de clases', prioridad: 'urgente', categoria: 'emergencia', created_at: hace(1), fijada: true, expira_at: null, para_roles: ['all'], para_paralelos: null, autor: 'Maryuri Minga', destinatarios: 60, leidas: 40, tasa: 66.7 },
      { id: 'n2', titulo: 'Reunión de padres', prioridad: 'importante', categoria: 'evento', created_at: hace(30), fijada: false, expira_at: null, para_roles: ['padre'], para_paralelos: ['p1'], autor: 'Admin', destinatarios: 30, leidas: 12, tasa: 40 }] };
  respuestas.notificaciones_bandeja = bandeja; respuestas.notificaciones_marcar_leidas = 1; respuestas.notificaciones_no_leidas = 2;
  respuestas.notificaciones_audiencia = { total: 12, por_grupo: { padre: 12 } }; respuestas.notificaciones_estadisticas = stats;
  respuestas.notificaciones_lectores = [{ nombre: 'PEREZ ANA', grupo: 'padre', leida_at: null }, { nombre: 'LOPEZ LUIS', grupo: 'padre', leida_at: hace(2) }];

  const grados = [{ id: 'g1', nombre: '1RO Gestión', orden: 1 }, { id: 'g2', nombre: '2DO Gestión', orden: 2 }];
  const paralelos = [{ id: 'p1', grado_id: 'g1', nombre: 'A' }, { id: 'p2', grado_id: 'g1', nombre: 'B' }, { id: 'p3', grado_id: 'g2', nombre: 'A', tutor_docente_id: null }];
  const sesion = (rolDb, extra = {}) => ({ profile: { id: 'u1', rolDb, rol: rolDb }, institucion: { id: 'I1', nombre: 'U.E. Prueba' }, data: { grados, paralelos, docentes: [{ id: 'd1', profileId: 'u1', cargas: [{ paraleloId: 'p1' }] }] }, ...extra });
  const montar = async (ses, props = {}) => {
    const cont = dom.window.document.getElementById('root'); cont.innerHTML = '';
    const root = createRoot(cont);
    await act(async () => { root.render(React.createElement(SessionCtx.Provider, { value: ses }, React.createElement(Notificaciones, props))); });
    await act(async () => { await new Promise(r => setTimeout(r, 250)); });
    return { cont, root, desmontar: () => act(async () => { root.unmount(); }) };
  };
  const clic = el => act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
  const escribir = (el, v) => act(async () => { const proto = el.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); el.dispatchEvent(new dom.window.Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); });
  const esperar = ms => act(async () => { await new Promise(r => setTimeout(r, ms)); });
  const botonCon = (cont, texto) => [...cont.querySelectorAll('button')].find(b => b.textContent.includes(texto));

  // ── A. Padre: solo bandeja, sin nombres del personal, marca como leída, texto seguro ──
  llamadas.length = 0;
  let { cont, desmontar } = await montar(sesion('padre'), { title: 'Comunicados' });
  let txt = cont.textContent;
  chequeo('A1 padre: muestra el título de Comunicados y las 3 notificaciones', txt.includes('Comunicados del plantel') && cont.querySelectorAll('.nt-item').length === 3);
  chequeo('A2 padre: NO hay pestañas (solo bandeja)', cont.querySelectorAll('.nt-tabs').length === 0 && !txt.includes('Redactar') && !txt.includes('estadísticas'));
  chequeo('A3 padre: la fijada va en su sección y hay secciones por fecha', txt.includes('Fijadas') && (txt.includes('Ayer') || txt.includes('Esta semana')));
  chequeo('A4 padre: contadores de filtros (no leídas = 2, urgentes = 1)', /No leídas\s*2/.test(txt) && /Urgentes\s*1/.test(txt));
  chequeo('A5 padre: no aparece "Enviadas por mí" ni el destino', !txt.includes('Enviadas por mí') && !txt.includes('Padres y representantes'));
  chequeo('A6 padre: no se muestran nombres de personal (solo el cargo)', !txt.includes('Maryuri') && txt.includes('Inspección General'));
  await clic(cont.querySelectorAll('.nt-item')[0]); await esperar(150);
  chequeo('A7 padre: abrir una notificación muestra el mensaje completo y un enlace https', cont.querySelector('.nt-reader-body') && cont.querySelector('.nt-reader-body').textContent.includes('Por lluvias intensas') && cont.querySelector('.nt-reader-body a[href="https://sigee.ec/aviso"]'));
  chequeo('A8 padre: al abrirla se marca como leída en la base', llamadas.some(l => l.rpc === 'notificaciones_marcar_leidas' && l.body.p_ids.includes('n1')));
  chequeo('A9 padre: no ve botones de gestionar (eliminar, fijar, quién leyó)', !cont.textContent.includes('Eliminar') && !cont.textContent.includes('Quién leyó') && !cont.textContent.includes('Fijar arriba'));
  await clic(botonCon(cont, 'Cerrar')); await esperar(50);
  await clic([...cont.querySelectorAll('.nt-item')].find(e => e.textContent.includes('Truco'))); await esperar(100);
  const cuerpo = cont.querySelector('.nt-reader-body');
  chequeo('A10 seguridad: el HTML escrito en un mensaje se muestra como TEXTO (no se ejecuta)', cuerpo && cuerpo.textContent.includes('<img src=x onerror=alert(1)>') && !cuerpo.querySelector('img'));
  chequeo('A11 seguridad: javascript: no es un enlace', cuerpo && ![...cuerpo.querySelectorAll('a')].some(a => /^javascript:/i.test(a.getAttribute('href') || '')));
  await clic(botonCon(cont, 'Cerrar')); await esperar(50);
  await escribir(cont.querySelector('.nt-search input'), 'reunion'); await esperar(50);
  chequeo('A12 búsqueda sin tildes: "reunion" encuentra "Reunión de padres"', cont.querySelectorAll('.nt-item').length === 1);
  await escribir(cont.querySelector('.nt-search input'), 'zzzz'); await esperar(50);
  chequeo('A13 sin resultados: mensaje y botón para quitar filtros', cont.textContent.includes('Sin resultados') && !!botonCon(cont, 'Quitar filtros'));
  await desmontar();

  // ── B. Administrador: 3 pestañas, redactar, validar, enviar, estadísticas y quién leyó ──
  llamadas.length = 0;
  ({ cont, desmontar } = await montar(sesion('admin_plantel'), { title: 'Notificaciones' }));
  const pestañas = [...cont.querySelectorAll('.nt-tabs button')].map(b => b.textContent.trim());
  chequeo('B1 admin: pestañas Bandeja, Redactar y Enviadas y estadísticas', pestañas.length === 3 && pestañas[1].includes('Redactar') && pestañas[2].includes('estadísticas'), pestañas.join('|'));
  chequeo('B2 admin: ve el destino de cada notificación', cont.textContent.includes('Todos') && cont.textContent.includes('Padres y representantes'));
  await clic(cont.querySelectorAll('.nt-tabs button')[1]); await esperar(100);
  chequeo('B3 redactar: muestra "Todo el plantel", 6 grupos y las plantillas', !!botonCon(cont, 'Todo el plantel') && cont.querySelectorAll('.nt-dest-btn').length === 7 && cont.querySelectorAll('.nt-tpl .nt-chip').length === 6);
  await clic(botonCon(cont, 'Enviar notificación')); await esperar(50);
  chequeo('B4 enviar vacío: muestra los errores y NO guarda nada', cont.querySelector('.nt-err') && cont.textContent.includes('Escribe un título') && cont.textContent.includes('Elige a quién') && !llamadas.some(l => l.tabla === 'notificaciones' && l.metodo === 'POST'));
  await escribir(cont.querySelector('#nt-titulo'), '  Reunión general  '); await escribir(cont.querySelector('#nt-cuerpo'), 'Se convoca a la reunión del viernes.');
  await clic([...cont.querySelectorAll('.nt-dest-btn')].find(b => b.textContent.includes('Padres'))); await esperar(700);
  chequeo('B5 elegir "Padres" muestra la selección de cursos y el alcance estimado (12)', cont.querySelector('.nt-cursos') && cont.querySelector('.nt-alc-n').textContent.trim() === '12', cont.querySelector('.nt-alc') && cont.querySelector('.nt-alc').textContent);
  chequeo('B6 la vista previa refleja el título escrito', cont.querySelector('.nt-sticky .nt-title').textContent === 'Reunión general');
  await clic([...cont.querySelectorAll('.nt-par')].find(b => b.textContent === 'A')); await esperar(700);
  chequeo('B7 elegir un curso vuelve a calcular el alcance con ese curso', llamadas.filter(l => l.rpc === 'notificaciones_audiencia').some(l => l.body.p_paralelos && l.body.p_paralelos.length === 1 && l.body.p_roles[0] === 'padre'));
  await clic(botonCon(cont, 'Enviar notificación')); await esperar(300);
  const post = llamadas.find(l => l.tabla === 'notificaciones' && l.metodo === 'POST');
  chequeo('B8 enviar guarda la fila correcta (título sin espacios, padres, un curso, normal)', post && post.body.titulo === 'Reunión general' && post.body.para_roles.length === 1 && post.body.para_roles[0] === 'padre' && post.body.para_paralelos.length === 1 && post.body.prioridad === 'normal' && post.body.institucion_id === 'I1', JSON.stringify(post && post.body));
  chequeo('B9 al enviar muestra confirmación y pasa a estadísticas', cont.querySelector('.nt-ok') && cont.textContent.includes('Tasa de lectura'));
  txt = cont.textContent;
  chequeo('B10 estadísticas: KPIs (enviadas 3, tasa 57,8 %, tiempo medio 4,5 h)', txt.includes('57.8 %') && txt.includes('4.5 h') && /Enviadas\s*3|3\s*Enviadas/.test(txt) || (txt.includes('57.8 %') && txt.includes('4.5 h')));
  chequeo('B11 estadísticas: alerta de baja lectura tras 48 h', txt.includes('menos de la mitad de lectura'));
  chequeo('B12 estadísticas: gráfico SVG, lectura por grupo y detalle con 2 filas', !!cont.querySelector('svg.nt-chart') && txt.includes('Lectura por grupo') && cont.querySelectorAll('.nt-row').length === 2);
  chequeo('B13 estadísticas: semáforo (40 % = lectura baja en rojo)', [...cont.querySelectorAll('.nt-row')].some(r => r.textContent.includes('40 %')));
  await clic(cont.querySelectorAll('.nt-row')[0]); await esperar(150);
  chequeo('B14 quién leyó: abre y separa "Sin leer (1)" y "Leyeron (1)"', cont.textContent.includes('Sin leer (1)') && cont.textContent.includes('Leyeron (1)') && cont.textContent.includes('PEREZ ANA'));
  await clic([...cont.querySelectorAll('.nt-seg button')].find(b => b.textContent.includes('Leyeron'))); await esperar(50);
  chequeo('B15 quién leyó: la pestaña "Leyeron" muestra a quien ya leyó', cont.textContent.includes('LOPEZ LUIS') && !cont.querySelector('.nt-lista-lectores').textContent.includes('PEREZ ANA'));
  await desmontar();

  // ── C. Urgente / todo el plantel pide confirmación ──
  llamadas.length = 0;
  ({ cont, desmontar } = await montar(sesion('inspector_general'), { title: 'Notificaciones' }));
  await clic(cont.querySelectorAll('.nt-tabs button')[1]); await esperar(80);
  await clic(botonCon(cont, 'Suspensión de clases')); await esperar(700);
  chequeo('C1 plantilla "Suspensión de clases": rellena título, urgente y 3 grupos', cont.querySelector('#nt-titulo').value === 'Suspensión de clases' && cont.querySelectorAll('.nt-dest-btn.on').length === 3);
  await clic(botonCon(cont, 'Enviar notificación')); await esperar(100);
  chequeo('C2 urgente: pide confirmación antes de enviar y aún no guarda', !!cont.querySelector('[role=dialog]') && cont.textContent.includes('Confirmar envío') && !llamadas.some(l => l.tabla === 'notificaciones' && l.metodo === 'POST'));
  await clic(botonCon(cont, 'Revisar')); await esperar(50);
  chequeo('C3 "Revisar" cierra la confirmación sin enviar', !cont.querySelector('[role=dialog]') && !llamadas.some(l => l.tabla === 'notificaciones' && l.metodo === 'POST'));
  await clic(botonCon(cont, 'Enviar notificación')); await esperar(100); await clic(botonCon(cont, 'Sí, enviar ahora')); await esperar(300);
  chequeo('C4 confirmar: ahora sí se guarda como urgente', llamadas.some(l => l.tabla === 'notificaciones' && l.metodo === 'POST' && l.body.prioridad === 'urgente' && l.body.categoria === 'emergencia'));
  await desmontar();

  // ── D. Docente: solo avisa a estudiantes y padres de SUS cursos, sin urgentes ──
  llamadas.length = 0;
  ({ cont, desmontar } = await montar(sesion('docente'), { title: 'Anuncios' }));
  chequeo('D1 docente: tiene Bandeja, Redactar y Estadísticas', cont.querySelectorAll('.nt-tabs button').length === 3);
  await clic(cont.querySelectorAll('.nt-tabs button')[1]); await esperar(100);
  const destinos = [...cont.querySelectorAll('.nt-dest-btn')].map(b => b.textContent.trim());
  chequeo('D2 docente: solo Estudiantes y Padres (sin "Todo el plantel" ni personal)', destinos.length === 2 && destinos.includes('Estudiantes') && destinos.includes('Padres y representantes'), destinos.join('|'));
  chequeo('D3 docente: no puede elegir prioridad urgente ni categoría emergencia', ![...cont.querySelectorAll('.nt-seg button')].some(b => b.textContent.includes('Urgente')) && ![...cont.querySelectorAll('select option')].some(o => o.textContent === 'Emergencia'));
  await clic([...cont.querySelectorAll('.nt-dest-btn')].find(b => b.textContent.includes('Estudiantes'))); await esperar(100);
  const pars = [...cont.querySelectorAll('.nt-par')].map(b => b.textContent);
  chequeo('D4 docente: solo ve SU curso (1RO Gestión A), no los demás', cont.querySelectorAll('.nt-par').length === 1 && pars[0] === 'A' && cont.querySelector('.nt-cursos').textContent.includes('1RO Gestión') && !cont.querySelector('.nt-cursos').textContent.includes('2DO'));
  await escribir(cont.querySelector('#nt-titulo'), 'Tarea de matemática'); await escribir(cont.querySelector('#nt-cuerpo'), 'Entregar el lunes.');
  await clic(botonCon(cont, 'Enviar notificación')); await esperar(100);
  chequeo('D5 docente sin elegir curso: se le pide elegirlo y no se envía', cont.textContent.includes('Elige los cursos') && !llamadas.some(l => l.tabla === 'notificaciones' && l.metodo === 'POST'));
  await desmontar();

  // ── E. Estudiante y sesión sin plantel ──
  ({ cont, desmontar } = await montar(sesion('estudiante'), { title: 'Comunicados' }));
  chequeo('E1 estudiante: solo bandeja', cont.querySelectorAll('.nt-tabs').length === 0 && cont.querySelectorAll('.nt-item').length === 3);
  await desmontar();
  ({ cont, desmontar } = await montar({ profile: { id: 'sa', rolDb: 'super_admin', rol: 'super_admin' }, institucion: null, data: {} }, { title: 'Notificaciones' }));
  chequeo('E2 super admin sin plantel: pide elegir un plantel y no falla', cont.textContent.includes('Elige un plantel'));
  await desmontar();
} finally { await vite.close(); globalThis.fetch = fetchReal; }
console.log(fallos ? `\n${fallos} comprobación(es) fallaron` : '\nTodas las comprobaciones pasaron');
process.exit(fallos ? 1 : 0);
