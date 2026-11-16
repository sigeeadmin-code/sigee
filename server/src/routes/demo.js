import { Router } from 'express';
import crypto from 'node:crypto';
import { supabase } from '../lib/supabase.js';
import { normalizarIp } from '../lib/seguridad.js';
import { validarSolicitud } from '../lib/demoSolicitud.js';

export const demoRouter = Router();

const MAX_POR_IP_DIA = 3;       // solicitudes por IP en 24 horas
const MAX_GLOBAL_DIA = 300;     // freno general contra inundaciones
const MENSAJE_MANUAL = 'Tu solicitud fue registrada. El administrador se comunicará contigo por WhatsApp para entregarte el acceso.';

// POST /demo/solicitar — pública. Valida, aplica límites, guarda IP y datos. La entrega del acceso es manual por WhatsApp
// hasta que el correo (Resend) y la página de activación estén listos.
demoRouter.post('/solicitar', async (req, res) => {
  const { bot, errores, datos } = validarSolicitud(req.body);
  if (bot) return res.json({ ok: true, entrega: 'manual', message: MENSAJE_MANUAL });   // un bot no debe saber que fue descartado
  if (Object.keys(errores).length) return res.status(400).json({ error: Object.values(errores)[0], campos: errores });

  const ip = normalizarIp(req.ip);
  const ua = String(req.get('user-agent') || '').slice(0, 300);
  try {
    const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    if (ip) {
      const { count } = await supabase.from('demo_solicitudes').select('id', { count: 'exact', head: true }).eq('ip', ip).gte('created_at', desde);
      if ((count || 0) >= MAX_POR_IP_DIA) return res.status(429).json({ error: 'Ya enviaste varias solicitudes hoy. Comunícate con el administrador.' });
    }
    const { count: total } = await supabase.from('demo_solicitudes').select('id', { count: 'exact', head: true }).gte('created_at', desde);
    if ((total || 0) >= MAX_GLOBAL_DIA) return res.status(429).json({ error: 'Recibimos muchas solicitudes hoy. Inténtalo de nuevo mañana o comunícate con el administrador.' });

    // Un demo por correo y por cédula (las solicitudes "expiradas" no cuentan: esa persona escribe al administrador).
    const MSG_DUP = 'Ya existe una solicitud de demostración con este correo o cédula. Comunícate con el administrador.';
    const [porCorreo, porCedula] = await Promise.all([
      supabase.from('demo_solicitudes').select('id').eq('email', datos.email).neq('estado', 'expirada').limit(1),
      supabase.from('demo_solicitudes').select('id').eq('cedula', datos.cedula).neq('estado', 'expirada').limit(1)
    ]);
    if (porCorreo.error || porCedula.error) throw (porCorreo.error || porCedula.error);
    if (porCorreo.data?.length || porCedula.data?.length) return res.status(409).json({ error: MSG_DUP });

    const { data: fila, error } = await supabase.from('demo_solicitudes').insert({
      email: datos.email, nombre_completo: datos.nombre, empresa: datos.institucion, telefono: datos.telefono, cargo: datos.cargo,
      cedula: datos.cedula, ip, user_agent: ua,
      token_confirmacion: crypto.randomBytes(32).toString('hex'), token_expira_en: new Date(Date.now() + 24 * 3600 * 1000).toISOString()
    }).select('id').single();
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: MSG_DUP });
      throw error;
    }
    // Aviso para el Super Admin (si falla no impide la solicitud).
    await supabase.from('demo_alertas').insert({ solicitud_id: fila.id, mensaje: `Nueva solicitud de demo de ${datos.nombre} (${datos.institucion})` }).then(() => {}, () => {});
    return res.json({ ok: true, entrega: 'manual', message: MENSAJE_MANUAL });
  } catch (e) {
    console.error('[DEMO] error al registrar la solicitud:', e?.message || e);
    return res.status(500).json({ error: 'No pudimos registrar tu solicitud. Inténtalo de nuevo en unos minutos.' });
  }
});
