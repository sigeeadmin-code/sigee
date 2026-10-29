/**
 * SIGEE · Módulo Oficios y Tráfico Documental
 * Especificación v1.0 · 27 oct 2026
 * Principio: un caso = un documento = un PDF por versión de contenido.
 */
import { supabase } from './supabase.js';

export const TIPOS_DOCUMENTO = {
  oficio_alerta:       { nombre: 'Oficio de alerta',        uso: 'Bajo rendimiento; citación a reunión' },
  ficha_tutor:         { nombre: 'Ficha del tutor',         uso: 'Resumen notas + asistencia' },
  plan_refuerzo:       { nombre: 'Plan de refuerzo',        uso: 'Acciones, cronograma, evaluación mejora' },
  acta_compromiso:     { nombre: 'Acta de compromiso',      uso: 'Reunión familia y compromisos' },
  oficio_faltas:       { nombre: 'Oficio por inasistencia', uso: 'Notificación de faltas acumuladas' },
  informe_seguimiento: { nombre: 'Informe de seguimiento',  uso: 'Evaluación de mejora (hijo del origen)' }
};

export const ESTADOS = {
  borrador:        { label: 'Borrador',         badge: 'b-muted' },
  en_ruta:         { label: 'En ruta',          badge: 'b-info' },
  observado:       { label: 'Observado',        badge: 'b-warn' },
  aprobado_final:  { label: 'Aprobado final',   badge: 'b-ok' },
  entregado:       { label: 'Entregado',        badge: 'b-ok' },
  archivado:       { label: 'Archivado',        badge: 'b-muted' },
  rechazado:       { label: 'Rechazado',        badge: 'b-err' }
};

export const CARGOS = {
  tutor:              'Tutor',
  inspector_general:  'Inspector General',
  dece:               'DECE',
  vicerrector:        'Vicerrector/a',
  rector:             'Rector/a',
  secretaria:         'Secretaría'
};

export const ACCIONES_HISTORIAL = {
  emitido:    'Emitido',
  enviado:    'Enviado a ruta',
  recibido:   'Recibido',
  aprobado:   'Aprobado',
  observado:  'Observado',
  reenviado:  'Reenviado',
  corregido:  'Corregido',
  rechazado:  'Rechazado',
  entregado:  'Entregado',
  archivado:  'Archivado'
};

/** Lista documentos de la bandeja del usuario. */
export async function fetchOficiosBandeja(filtro = 'todos') {
  const { data, error } = await supabase.rpc('oficios_bandeja', { p_filtro: filtro });
  if (error) throw new Error(error.message || 'No se pudo cargar la bandeja de oficios.');
  return Array.isArray(data) ? data : [];
}

/** Obtiene un documento por id. */
export async function fetchOficio(id) {
  const { data, error } = await supabase
    .from('oficios_documentos')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message || 'Documento no encontrado.');
  return data;
}

/** Crea un borrador. */
export async function crearBorradorOficio({
  institucionId, tipo, titulo, estudianteId, curso, paralelo, periodo, asunto, datosPlantilla, documentoOrigenId
}) {
  const { data, error } = await supabase.rpc('oficios_crear_borrador', {
    p_institucion: institucionId,
    p_tipo: tipo,
    p_titulo: titulo || '',
    p_estudiante_id: estudianteId || null,
    p_curso: curso || null,
    p_paralelo: paralelo || null,
    p_periodo: periodo || null,
    p_asunto: asunto || null,
    p_datos_plantilla: datosPlantilla || {},
    p_documento_origen_id: documentoOrigenId || null
  });
  if (error) throw new Error(error.message || 'No se pudo crear el borrador.');
  return data;
}

/** Envía (o reenvía) a ruta. */
export async function enviarOficio(id) {
  const { data, error } = await supabase.rpc('oficios_enviar', { p_id: id });
  if (error) throw new Error(error.message || 'No se pudo enviar el documento.');
  return data;
}

/** Aprueba el paso actual. */
export async function aprobarPasoOficio(id, comentario = null) {
  const { data, error } = await supabase.rpc('oficios_aprobar_paso', {
    p_id: id,
    p_comentario: comentario || null
  });
  if (error) throw new Error(error.message || 'No se pudo aprobar el paso.');
  return data;
}

/** Observa (devuelve) con motivo obligatorio. */
export async function observarOficio(id, motivo) {
  const { data, error } = await supabase.rpc('oficios_observar', {
    p_id: id,
    p_motivo: motivo
  });
  if (error) throw new Error(error.message || 'No se pudo observar el documento.');
  return data;
}

/** Corrige contenido (sube versión). */
export async function corregirOficio(id, { datosPlantilla, titulo, asunto } = {}) {
  const { data, error } = await supabase.rpc('oficios_corregir', {
    p_id: id,
    p_datos_plantilla: datosPlantilla ?? null,
    p_titulo: titulo ?? null,
    p_asunto: asunto ?? null
  });
  if (error) throw new Error(error.message || 'No se pudo guardar la corrección.');
  return data;
}

/** Registra entrega al representante. */
export async function registrarEntregaOficio(id, { recibidoPor, cedula, medio } = {}) {
  const { data, error } = await supabase.rpc('oficios_registrar_entrega', {
    p_id: id,
    p_recibido_por: recibidoPor || 'Representante',
    p_cedula: cedula || null,
    p_medio: medio || 'presencial'
  });
  if (error) throw new Error(error.message || 'No se pudo registrar la entrega.');
  return data;
}

export async function archivarOficio(id) {
  const { data, error } = await supabase.rpc('oficios_archivar', { p_id: id });
  if (error) throw new Error(error.message || 'No se pudo archivar.');
  return data;
}

export async function rechazarOficio(id, motivo) {
  const { data, error } = await supabase.rpc('oficios_rechazar', { p_id: id, p_motivo: motivo });
  if (error) throw new Error(error.message || 'No se pudo rechazar.');
  return data;
}

/** Elimina solo borradores propios. */
export async function eliminarBorradorOficio(id) {
  const { error } = await supabase.from('oficios_documentos').delete().eq('id', id).eq('estado', 'borrador');
  if (error) throw new Error(error.message || 'No se pudo eliminar el borrador.');
}

/** Actualiza datos_plantilla / título / asunto en borrador. */
export async function guardarBorradorOficio(id, campos) {
  const patch = { updated_at: new Date().toISOString() };
  if (campos.titulo !== undefined) patch.titulo = campos.titulo;
  if (campos.asunto !== undefined) patch.asunto = campos.asunto;
  if (campos.datos_plantilla !== undefined) patch.datos_plantilla = campos.datos_plantilla;
  if (campos.estudiante_id !== undefined) patch.estudiante_id = campos.estudiante_id;
  if (campos.curso !== undefined) patch.curso = campos.curso;
  if (campos.paralelo !== undefined) patch.paralelo = campos.paralelo;
  if (campos.periodo !== undefined) patch.periodo = campos.periodo;
  const { data, error } = await supabase
    .from('oficios_documentos')
    .update(patch)
    .eq('id', id)
    .eq('estado', 'borrador')
    .select()
    .single();
  if (error) throw new Error(error.message || 'No se pudo guardar.');
  return data;
}

export function etiquetaEstado(estado) {
  return ESTADOS[estado]?.label || estado;
}

export function badgeEstado(estado) {
  return ESTADOS[estado]?.badge || 'b-muted';
}

export function etiquetaCargo(cargo) {
  return CARGOS[cargo] || cargo;
}

export function etiquetaTipo(tipo) {
  return TIPOS_DOCUMENTO[tipo]?.nombre || tipo;
}

/** ¿El usuario actual puede actuar en el paso_actual del documento? */
export function puedeActuarEnPaso(doc, profile) {
  if (!doc || !profile) return false;
  if (doc.estado !== 'en_ruta') return false;
  const paso = (doc.ruta || [])[doc.paso_actual];
  if (!paso) return false;
  const cargo = paso.cargo;
  const rol = profile.rolDb || profile.rol;
  const mapa = {
    docente: ['tutor'],
    inspector_general: ['inspector_general', 'tutor'],
    admin_plantel: ['rector', 'vicerrector', 'inspector_general', 'dece', 'secretaria', 'tutor'],
    secretario: ['secretaria', 'inspector_general'],
    supervisor_plantel: ['rector', 'vicerrector', 'inspector_general'],
    super_admin: Object.keys(CARGOS)
  };
  const permitidos = mapa[rol] || [];
  return permitidos.includes(cargo);
}

export function esEmisor(doc, profile) {
  return doc && profile && doc.emisor_id === profile.id;
}
