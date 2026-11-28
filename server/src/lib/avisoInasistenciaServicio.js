import { construirAviso } from './avisoCorreo.js';
import { correoValido } from './correo.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Aviso de inasistencia por correo al representante. Las dependencias llegan por parámetro para poder probarlo sin red ni base.
 * deps: { supabase, correoConfigurado(), enviarCorreo({to,subject,html,text,replyTo,nombreRemitente}) }
 * entrada: { body:{estudiante_id,fecha,reenviar}, perfil:{id,rol,institucion_id}, usuario:{email}, demo:boolean }
 * Devuelve { status, body }. El destinatario y el texto salen SIEMPRE de la base: el cliente no puede mandar ni correo ni contenido.
 */
export async function procesarAviso(deps, entrada) {
  const { supabase, correoConfigurado, enviarCorreo } = deps;
  const { estudiante_id: estudianteId, fecha, reenviar } = entrada.body || {};
  const perfil = entrada.perfil || {};
  if (!UUID.test(String(estudianteId || ''))) return { status: 400, body: { error: 'Falta el estudiante.' } };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha || ''))) return { status: 400, body: { error: 'La fecha debe ser AAAA-MM-DD.' } };

  const { data: est, error: eEst } = await supabase.from('estudiantes').select('id, institucion_id, nombres, apellidos').eq('id', estudianteId).single();
  if (eEst || !est) return { status: 404, body: { error: 'Estudiante no encontrado.' } };
  if (perfil.rol !== 'super_admin' && est.institucion_id !== perfil.institucion_id) {
    return { status: 403, body: { error: 'Ese estudiante no pertenece a tu institución.' } };
  }

  // Solo se avisa de una inasistencia que existe de verdad.
  const { data: aus, error: eAus } = await supabase.from('asistencia').select('id').eq('estudiante_id', est.id).eq('fecha', fecha).eq('estado', 'ausente').limit(1);
  if (eAus) return { status: 500, body: { error: 'No se pudo verificar la inasistencia.' } };
  if (!aus?.length) return { status: 422, body: { error: 'Ese estudiante no tiene una inasistencia registrada en esa fecha.' } };

  const { data: vinc, error: eRep } = await supabase.from('representantes_estudiantes').select('representantes(email)').eq('estudiante_id', est.id);
  if (eRep) return { status: 500, body: { error: 'No se pudo leer al representante.' } };
  const destinos = [...new Set((vinc || []).map(v => String(v.representantes?.email || '').trim().toLowerCase()).filter(correoValido))].slice(0, 2);
  if (!destinos.length) {
    return { status: 422, body: { error: 'El representante de este estudiante no tiene un correo electrónico válido registrado. Agrégalo en el módulo de Estudiantes.' } };
  }

  const [{ data: inst }, { data: mat }] = await Promise.all([
    supabase.from('instituciones').select('nombre').eq('id', est.institucion_id).single(),
    supabase.from('matriculas').select('grados(nombre), paralelos(nombre)').eq('estudiante_id', est.id).eq('estado', 'activa').limit(1)
  ]);
  const curso = mat?.[0] ? `${mat[0].grados?.nombre || ''} ${mat[0].paralelos?.nombre || ''}`.trim() : '';
  const nombreEst = `${est.nombres || ''} ${est.apellidos || ''}`.trim();
  const aviso = construirAviso({ institucion: inst?.nombre, estudiante: nombreEst, curso, fecha });

  // Demostración: no se envía nada de verdad; se muestra cómo se enviaría.
  if (entrada.demo) return { status: 200, body: { simulado: true, enviado: false, destinos, asunto: aviso.asunto } };
  if (!correoConfigurado()) return { status: 501, body: { error: 'El envío de correo aún no está configurado en el servidor. Pide al administrador de SIGEE que lo active.' } };

  // Evita el doble envío por descuido: si ya se envió un correo de esta inasistencia, hay que confirmar el reenvío.
  if (!reenviar) {
    const { data: previo } = await supabase.from('avisos_inasistencia').select('id').eq('estudiante_id', est.id).eq('fecha', fecha).like('mensaje', 'Aviso por correo%').limit(1);
    if (previo?.length) return { status: 409, body: { error: 'Ya se envió un correo de esta inasistencia al representante.', yaEnviado: true } };
  }

  try {
    await enviarCorreo({ to: destinos, subject: aviso.asunto, html: aviso.html, text: aviso.texto, replyTo: entrada.usuario?.email, nombreRemitente: inst?.nombre });
  } catch (err) {
    console.error('[correos] fallo al enviar el aviso', err.codigo || '', err.status || '', err.message);
    return { status: err.codigo === 'proveedor' ? 502 : 500, body: { error: 'No se pudo enviar el correo: ' + err.message } };
  }

  // Constancia: queda como aviso en la ficha del estudiante (igual que el de WhatsApp).
  const { error: eIns } = await supabase.from('avisos_inasistencia').insert({
    institucion_id: est.institucion_id, estudiante_id: est.id, fecha,
    mensaje: `Aviso por correo a ${destinos.join(', ')}: inasistencia del ${fecha}${curso ? ' — ' + curso : ''}.`.slice(0, 500), enviado_por: perfil.id
  });
  if (eIns) console.error('[correos] enviado pero no se pudo registrar el aviso', eIns.message);
  return { status: 201, body: { enviado: true, destinos, registrado: !eIns } };
}
