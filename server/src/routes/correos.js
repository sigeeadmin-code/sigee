import { Router } from 'express';
import { requireAuth, requireRole } from '../lib/auth.js';
import { supabase } from '../lib/supabase.js';
import { correoConfigurado, enviarCorreo, correoValido } from '../lib/correo.js';
import { normalizarOficio, oficioAHtml, oficioATexto } from '../lib/oficioCorreo.js';

export const correosRouter = Router();

// Quién puede emitir oficios (igual que las políticas de oficios_inasistencia).
const ROLES_OFICIO = ['super_admin', 'admin_plantel', 'secretario', 'inspector_general'];

// GET /correos/estado — para que la pantalla sepa si el envío está disponible (sin exponer ninguna clave).
correosRouter.get('/estado', requireAuth, (_req, res) => res.json({ configurado: correoConfigurado() }));

// POST /correos/oficio
// body: { estudiante_id, oficio: <construirOficio()>, registro?: { numero, fechaEmision, periodoDesde, periodoHasta, diasFalta, fechas, firmante, cargo } }
// El destinatario NUNCA viene del cliente: se toma de los representantes del estudiante en la base.
correosRouter.post('/oficio', requireAuth, requireRole(...ROLES_OFICIO), async (req, res) => {
  const { estudiante_id: estudianteId, oficio, registro } = req.body || {};
  if (!estudianteId) return res.status(400).json({ error: 'Falta estudiante_id.' });
  const of = normalizarOficio(oficio);
  if (!of) return res.status(400).json({ error: 'El oficio recibido no es válido.' });
  // 501 (no 503): el cliente reintenta los 502/503/504 y aquí reintentar no sirve de nada.
  if (!correoConfigurado()) return res.status(501).json({ error: 'El envío de correo aún no está configurado en el servidor. Pide al administrador de SIGEE que lo active.' });

  const { data: est, error: eEst } = await supabase.from('estudiantes').select('id, institucion_id, nombres, apellidos').eq('id', estudianteId).single();
  if (eEst || !est) return res.status(404).json({ error: 'Estudiante no encontrado.' });
  if (req.profile.rol !== 'super_admin' && est.institucion_id !== req.profile.institucion_id) {
    return res.status(403).json({ error: 'Ese estudiante no pertenece a tu institución.' });
  }

  const { data: vinc, error: eRep } = await supabase.from('representantes_estudiantes').select('representantes(nombres, apellidos, email)').eq('estudiante_id', estudianteId);
  if (eRep) return res.status(500).json({ error: 'No se pudo leer al representante.' });
  const destinos = [...new Set((vinc || []).map(v => String(v.representantes?.email || '').trim().toLowerCase()).filter(correoValido))].slice(0, 2);
  if (!destinos.length) return res.status(422).json({ error: 'El representante de este estudiante no tiene un correo electrónico válido registrado. Agrégalo en el módulo de Estudiantes.' });

  const { data: inst } = await supabase.from('instituciones').select('nombre').eq('id', est.institucion_id).single();
  let envio;
  try {
    envio = await enviarCorreo({
      to: destinos, subject: of.asunto.slice(0, 200), html: oficioAHtml(of), text: oficioATexto(of),
      replyTo: req.user.email, nombreRemitente: inst?.nombre || of.encabezado.institucion
    });
  } catch (err) {
    console.error('[correos] fallo al enviar', err.codigo || '', err.status || '', err.message);
    return res.status(err.codigo === 'proveedor' ? 502 : 500).json({ error: 'No se pudo enviar el correo: ' + err.message });
  }

  // Constancia en el historial del estudiante (solo si el cliente lo pidió).
  let registrado = false;
  if (registro && typeof registro === 'object') {
    const f = (registro.fechas || []).filter(x => typeof x === 'string').slice(0, 200);
    const { error: eIns } = await supabase.from('oficios_inasistencia').insert({
      institucion_id: est.institucion_id, estudiante_id: est.id, numero: txt(registro.numero), fecha_emision: /^\d{4}-\d{2}-\d{2}$/.test(registro.fechaEmision || '') ? registro.fechaEmision : undefined,
      periodo_desde: fechaOnull(registro.periodoDesde), periodo_hasta: fechaOnull(registro.periodoHasta), dias_falta: Number(registro.diasFalta) || 0, fechas: f,
      firmante: txt(registro.firmante), cargo: txt(registro.cargo), creado_por: req.profile.id,
      correo_enviado_at: new Date().toISOString(), correo_destino: destinos.join(', ')
    });
    registrado = !eIns;
    if (eIns) console.error('[correos] enviado pero no se pudo registrar el oficio', eIns.message);
  }
  res.status(201).json({ enviado: true, destinos, registrado });
});

const txt = v => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : null);
const fechaOnull = v => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null);
