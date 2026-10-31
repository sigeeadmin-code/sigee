/**
 * Oficios · lógica de vista pura (sin Supabase ni React): se prueba en tests/oficiosVista.test.mjs.
 * El servidor es la fuente de verdad de los permisos (doc.puede_actuar / doc.soy_emisor).
 */

export const ESTADOS_ABIERTOS = ['borrador', 'en_ruta', 'observado', 'aprobado_final'];
export const ESTADOS_CERRADOS = ['entregado', 'archivado', 'rechazado'];
export const SLA_HORAS = 24;          // meta institucional de respuesta por despacho
export const LIMITE_VERSIONES = 5;    // alerta anti-abuso (especificación §9)

export const TABS = [
  { id: 'mios', label: 'Mis documentos' },
  { id: 'por_cargo', label: 'Por mi cargo' },
  { id: 'todos', label: 'Todos' }
];

export function fmtFecha(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 16);
  return d.toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Guayaquil' });
}

/** 90 → "2 min" · 7200 → "2 h" · 200000 → "2 d 7 h" */
export function fmtEspera(seg) {
  if (seg == null || !Number.isFinite(Number(seg))) return '—';
  const s = Math.max(0, Math.round(Number(seg)));
  if (s < 60) return 'menos de 1 min';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24), hr = h % 24;
  return hr ? `${d} d ${hr} h` : `${d} d`;
}

/** Semáforo del tiempo que lleva un documento esperando en el despacho actual. */
export function semaforoEspera(seg) {
  if (seg == null) return 'ninguno';
  const h = seg / 3600;
  if (h < SLA_HORAS) return 'ok';
  if (h < SLA_HORAS * 2) return 'warn';
  return 'err';
}

export const abierto = d => ESTADOS_ABIERTOS.includes(d.estado);

/** Documentos de cada pestaña. «todos» solo existe para quienes ven más que lo propio. */
export function filtrarTab(items, tab) {
  if (tab === 'mios') return items.filter(d => d.soy_emisor);
  if (tab === 'por_cargo') return items.filter(d => d.puede_actuar);
  return items;
}

const sinTildes = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function filtrarOficios(items, { q = '', tipo = '', estado = '', nombreEstudiante = () => '' } = {}) {
  const t = sinTildes(q).trim();
  return items.filter(d => {
    if (tipo && d.tipo !== tipo) return false;
    if (estado && d.estado !== estado) return false;
    if (!t) return true;
    const pajar = sinTildes([d.numero, d.titulo, d.asunto, d.curso, d.paralelo, nombreEstudiante(d.estudiante_id)].join(' '));
    return t.split(/\s+/).every(p => pajar.includes(p));
  });
}

/** Última observación vigente (para mostrarla al emisor que debe corregir). */
export function ultimaObservacion(doc) {
  const h = doc?.historial_recorrido || [];
  for (let i = h.length - 1; i >= 0; i--) if (h[i].accion === 'observado') return h[i];
  return null;
}

export function numObservaciones(doc) {
  return (doc?.historial_recorrido || []).filter(h => h.accion === 'observado').length;
}

/** Indicadores de la cabecera de la bandeja. */
export function resumenOficios(items) {
  const porCargo = items.filter(d => d.puede_actuar);
  const esperas = porCargo.map(d => d.espera_seg).filter(s => s != null);
  const cerrados = items.filter(d => d.closed_at && d.created_at && d.estado !== 'rechazado');
  const dias = cerrados.map(d => (new Date(d.closed_at) - new Date(d.created_at)) / 86400000).filter(n => n >= 0);
  return {
    porCargo: porCargo.length,
    esperaMaxSeg: esperas.length ? Math.max(...esperas) : null,
    sobreSla: porCargo.filter(d => semaforoEspera(d.espera_seg) !== 'ok' && d.espera_seg != null).length,
    observadosMios: items.filter(d => d.soy_emisor && d.estado === 'observado').length,
    enRuta: items.filter(d => d.estado === 'en_ruta').length,
    borradoresMios: items.filter(d => d.soy_emisor && d.estado === 'borrador').length,
    versionAlta: items.filter(d => abierto(d) && d.version > LIMITE_VERSIONES).length,
    tramiteMedioDias: dias.length ? dias.reduce((a, b) => a + b, 0) / dias.length : null
  };
}

export const fmtDias = n => (n == null ? '—' : n.toFixed(1).replace('.', ',') + ' d');

/** Quién firmó cada cargo (último «aprobado» por cargo) para el bloque de firmas impreso. */
export function firmantesPorCargo(doc) {
  const out = {};
  for (const h of doc?.historial_recorrido || []) if (h.accion === 'aprobado' && h.cargo) out[h.cargo] = h.usuario_nombre || null;
  return out;
}

/** Acciones que se pueden mostrar según estado y banderas del servidor. */
export function accionesDisponibles(doc) {
  if (!doc) return [];
  const a = [];
  if (doc.estado === 'borrador' && doc.soy_emisor) a.push('guardar', 'enviar', 'eliminar');
  if (doc.estado === 'en_ruta' && doc.puede_actuar) a.push('aprobar', 'observar', 'rechazar');
  if (doc.estado === 'observado' && doc.soy_emisor) a.push('corregir');
  if (doc.estado === 'aprobado_final') a.push('entregar');
  if (doc.estado === 'entregado') a.push('archivar');
  if (doc.estado !== 'borrador') a.push('imprimir');
  if (SEGUIMIENTO_DESDE.includes(doc.tipo) && !doc.es_seguimiento && ['aprobado_final', 'entregado', 'archivado'].includes(doc.estado)) a.push('seguimiento');
  return a;
}

export function periodoPorDefecto(fecha = new Date()) {
  const y = fecha.getFullYear();
  return fecha.getMonth() >= 4 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

/** Tipos tras los cuales se controla «¿mejoró?» con un informe de seguimiento enlazado (especificación §10). */
export const SEGUIMIENTO_DESDE = ['oficio_alerta', 'plan_refuerzo', 'acta_compromiso'];

/** Despacho: lo que lleva más tiempo esperando va primero (SLA 24 h / 48 h). */
export const ordenarPorEspera = items => [...items].sort((a, b) => (b.espera_seg ?? -1) - (a.espera_seg ?? -1));

/** Informes de seguimiento que cuelgan de un documento origen. */
export const seguimientosDe = (items, id) => items.filter(d => d.documento_origen_id === id);

/** Versiones del PDF a partir del historial inmutable: v1 = emisión; cada «corregido» abre una versión nueva. */
export function versionesDe(doc) {
  const h = doc?.historial_recorrido || [];
  const out = [];
  const primera = h[0];
  out.push({ version: 1, fecha: primera?.fecha_accion || doc?.created_at, usuario: primera?.usuario_nombre || null, nota: 'Emisión inicial' });
  for (const x of h) if (x.accion === 'corregido') out.push({ version: x.version_pdf, fecha: x.fecha_accion, usuario: x.usuario_nombre || null, nota: x.comentario });
  const motivos = h.filter(x => x.accion === 'observado');
  return out.map((v, i) => ({ ...v, observadaPor: motivos[i] ? { cargo: motivos[i].cargo, motivo: motivos[i].comentario } : null, actual: v.version === doc?.version }));
}

/** Aprobación en lote: solo documentos donde el usuario puede actuar. */
export const seleccionables = items => items.filter(d => d.puede_actuar);

// ───────────────────────── Tableros (emisor y despacho) ─────────────────────────
export const META_TRAMITE_DIAS = 3;                  // meta institucional del tiempo de trámite
export const ESTADOS_ORDEN = ['borrador', 'observado', 'en_ruta', 'aprobado_final', 'entregado', 'archivado', 'rechazado'];
const TZ = 'America/Guayaquil';
const DIA_MS = 86400000;

/** Clave de día (YYYY-MM-DD) en hora de Ecuador. */
export const claveDia = v => (v ? new Date(v).toLocaleDateString('en-CA', { timeZone: TZ }) : '');
const diasEntre = (desde, ahora) => (desde ? Math.max(0, Math.floor((ahora - new Date(desde).getTime()) / DIA_MS)) : 0);
const ACCIONES_DECISION = ['aprobado', 'observado', 'rechazado'];

/** Indicadores de «Mis documentos» (el emisor). */
export function resumenEmisor(items, ahora = Date.now()) {
  const mios = items.filter(d => d.soy_emisor);
  const obs = mios.filter(d => d.estado === 'observado')
    .map(d => ({ id: d.id, numero: d.numero, version: d.version, dias: diasEntre(ultimaObservacion(d)?.fecha_accion || d.updated_at, ahora) }))
    .sort((a, b) => b.dias - a.dias);
  const enRuta = mios.filter(d => d.estado === 'en_ruta');
  const cargos = [...new Set(enRuta.map(d => (d.ruta || [])[d.paso_actual]?.cargo).filter(Boolean))];
  const borr = mios.filter(d => d.estado === 'borrador');
  const alta = mios.filter(d => abierto(d) && d.version > LIMITE_VERSIONES).sort((a, b) => b.version - a.version);
  const cerrados = mios.filter(d => d.closed_at && d.created_at && d.estado !== 'rechazado');
  const dias = cerrados.map(d => (new Date(d.closed_at) - new Date(d.created_at)) / DIA_MS).filter(n => n >= 0);
  const medio = dias.length ? dias.reduce((a, b) => a + b, 0) / dias.length : null;
  return {
    observados: { n: obs.length, items: obs, masAntiguoDias: obs[0]?.dias ?? 0 },
    enRuta: { n: enRuta.length, cargos },
    borradores: { n: borr.length, items: borr.map(d => ({ id: d.id, numero: d.numero, tipo: d.tipo })) },
    versionAlta: { n: alta.length, doc: alta[0] ? { id: alta[0].id, numero: alta[0].numero, version: alta[0].version } : null },
    tramite: { medioDias: medio, metaDias: META_TRAMITE_DIAS, dentroMeta: medio == null ? null : medio <= META_TRAMITE_DIAS },
    carga: ESTADOS_ORDEN.map(e => ({ estado: e, n: mios.filter(d => d.estado === e).length }))
  };
}

const decisiones = items => items.flatMap(d => (d.historial_recorrido || []).map((h, i, arr) => ({ ...h, _llegada: i > 0 ? arr[i - 1].fecha_accion : h.fecha_entrada, _doc: d })))
  .filter(h => ACCIONES_DECISION.includes(h.accion));

/** Indicadores del despacho (lo que el usuario debe resolver y cómo viene resolviendo). */
export function resumenDespacho(items, userId, ahora = Date.now()) {
  const pend = items.filter(d => d.puede_actuar && d.espera_seg != null);
  const b = { ok: 0, warn: 0, err: 0 };
  for (const d of pend) b[semaforoEspera(d.espera_seg)]++;
  const maxima = [...pend].sort((a, b2) => b2.espera_seg - a.espera_seg)[0] || null;
  const media = pend.length ? pend.reduce((s, d) => s + d.espera_seg, 0) / pend.length : null;

  const todas = decisiones(items);
  const mias = todas.filter(h => h.usuario_id === userId);
  const hoy = claveDia(ahora);
  const hoyMias = mias.filter(h => claveDia(h.fecha_accion) === hoy);
  const semana = mias.filter(h => ahora - new Date(h.fecha_accion).getTime() < 7 * DIA_MS);
  const dev = semana.filter(h => h.accion === 'observado').length;

  const acum = {};
  for (const h of todas) {
    if (h.accion === 'rechazado' || h.tiempo_espera == null || ahora - new Date(h.fecha_accion).getTime() > 30 * DIA_MS) continue;
    (acum[h.cargo] ||= []).push(h.tiempo_espera / 3600);
  }
  const esperaPorCargo = Object.entries(acum).map(([cargo, hs]) => ({ cargo, horas: hs.reduce((a, c) => a + c, 0) / hs.length, n: hs.length })).sort((a, c) => c.horas - a.horas);

  const dias = [];
  for (let i = 9; i >= 0; i--) { const k = claveDia(ahora - i * DIA_MS); dias.push({ clave: k, llegadas: 0, resueltos: 0 }); }
  const idx = Object.fromEntries(dias.map((d, i) => [d.clave, i]));
  for (const h of mias) { const i = idx[claveDia(h.fecha_accion)]; if (i != null) dias[i].resueltos++; const j = idx[claveDia(h._llegada)]; if (j != null) dias[j].llegadas++; }
  for (const d of pend) { const ult = (d.historial_recorrido || []).slice(-1)[0]; const j = idx[claveDia(ult?.fecha_accion)]; if (j != null) dias[j].llegadas++; }

  return {
    pendientes: { n: pend.length, ...b, masDe48: b.err },
    maxima: maxima ? { id: maxima.id, numero: maxima.numero, seg: maxima.espera_seg } : null,
    mediaSeg: media, sobreSla: media != null && media / 3600 > SLA_HORAS,
    resueltosHoy: { n: hoyMias.length, aprobados: hoyMias.filter(h => h.accion === 'aprobado').length, observados: hoyMias.filter(h => h.accion === 'observado').length },
    ritmoSemanal: semana.length / 7,
    devolucionesSemana: { n: dev, despachados: semana.length, tasa: semana.length ? (dev / semana.length) * 100 : 0 },
    esperaPorCargo, serieDiaria: dias
  };
}

/** Cargos con documentos pendientes de decisión del usuario (pestañas de la cola de despacho). */
export function cargosEnCola(items) {
  const m = new Map();
  for (const d of items.filter(x => x.puede_actuar)) { const c = (d.ruta || [])[d.paso_actual]?.cargo; if (c) m.set(c, (m.get(c) || 0) + 1); }
  return [...m.entries()].map(([cargo, n]) => ({ cargo, n })).sort((a, b) => b.n - a.n);
}

/** Filtros de la cola: todos | vencidos (>24 h en el despacho) | reenviados (ya devueltos al menos una vez). */
export function filtrarCola(items, { cargo = '', modo = 'todos' } = {}) {
  return items.filter(d => {
    if (cargo && (d.ruta || [])[d.paso_actual]?.cargo !== cargo) return false;
    if (modo === 'vencidos') return d.espera_seg != null && d.espera_seg / 3600 >= SLA_HORAS;
    if (modo === 'reenviados') return numObservaciones(d) > 0;
    return true;
  });
}

/** Documentos del mismo estudiante (para «Documentos relacionados»). */
export const relacionados = (items, doc) => items.filter(d => d.id !== doc.id && doc.estudiante_id && d.estudiante_id === doc.estudiante_id);

/** Indicadores del trámite de UN documento. */
export function indicadoresTramite(doc, ahora = Date.now()) {
  const fin = doc.closed_at ? new Date(doc.closed_at).getTime() : ahora;
  const dias = doc.created_at ? Math.max(0, (fin - new Date(doc.created_at).getTime()) / DIA_MS) : null;
  return { dias, horas: dias == null ? null : dias * 24, devoluciones: numObservaciones(doc), version: doc.version, maxVersiones: LIMITE_VERSIONES, metaHoras: META_TRAMITE_DIAS * 24 };
}

/** Carga por estado de cualquier conjunto de documentos. */
export const cargaPorEstado = items => ESTADOS_ORDEN.map(e => ({ estado: e, n: items.filter(d => d.estado === e).length }));
