import { Router } from 'express';
import crypto from 'node:crypto';
import { supabase } from '../lib/supabase.js';
import { normalizarIp } from '../lib/seguridad.js';
import { validarSolicitud } from '../lib/demoSolicitud.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { MAX_DEMOS_ACTIVAS, CUENTAS_DEMO, claveAleatoria, correoCuenta, tokenValido, rolDeCorreo } from '../lib/demoActivacion.js';

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

const URL_SISTEMA = (process.env.FRONTEND_ORIGIN || 'https://sigee-sigee.vercel.app').split(',')[0].trim();

class ErrorDemo extends Error { constructor(estado, mensaje) { super(mensaje); this.estado = estado; } }

// POST /demo/activar — pública, con el link que genera el Super Admin (válido 24 horas, un solo uso).
// Crea las 8 cuentas, copia Colegio Lumen en una institución nueva y devuelve las credenciales UNA sola vez.
demoRouter.post('/activar', async (req, res) => {
  const token = String(req.body?.token || '').trim();
  if (!tokenValido(token)) return res.status(400).json({ error: 'El enlace no es válido.' });
  const creados = [];
  try {
    const { data: sol, error: eSol } = await supabase.from('demo_solicitudes').select('*').eq('token_confirmacion', token).maybeSingle();
    if (eSol) throw eSol;
    if (!sol) throw new ErrorDemo(404, 'El enlace no es válido o ya fue usado.');
    if (sol.estado !== 'pendiente_confirmacion') throw new ErrorDemo(409, 'Este enlace ya fue usado.');
    if (!sol.token_expira_en || new Date(sol.token_expira_en) < new Date()) throw new ErrorDemo(410, 'El enlace venció. Comunícate con el administrador de SIGEE.');

    const { count: activas } = await supabase.from('demo_solicitudes').select('id', { count: 'exact', head: true }).in('estado', ['confirmado', 'activo']);
    if ((activas || 0) >= MAX_DEMOS_ACTIVAS) throw new ErrorDemo(503, 'En este momento no hay cupo para nuevas demostraciones. Comunícate con el administrador de SIGEE.');

    // El admin primero: si su correo ya tiene cuenta, se avisa antes de crear nada más.
    const cuentas = [];
    for (const c of CUENTAS_DEMO) {
      const email = correoCuenta(c.clave, sol.id, sol.email);
      const password = claveAleatoria();
      const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { demo: true, solicitud_id: sol.id } });
      if (error || !data?.user) {
        if (c.clave === 'adminplantel') throw new ErrorDemo(409, 'Tu correo ya tiene una cuenta en SIGEE. Comunícate con el administrador para usar otro correo.');
        throw error || new Error('No se pudo crear una cuenta de la demostración');
      }
      creados.push(data.user.id);
      cuentas.push({ clave: c.clave, rol: c.rol, user_id: data.user.id, email, password });
    }
    const { data: r, error: eClon } = await supabase.rpc('demo_clonar_lumen', {
      p_solicitud: sol.id, p_cuentas: cuentas.map(({ clave, user_id, email }) => ({ clave, user_id, email }))
    });
    if (eClon) throw eClon;
    return res.json({ ok: true, url: URL_SISTEMA, dias: 5, institucion_id: r?.institucion_id || null, cuentas: cuentas.map(({ rol, email, password }) => ({ rol, email, password })) });
  } catch (e) {
    for (const id of creados) { await supabase.auth.admin.deleteUser(id).catch(() => {}); }   // no dejar cuentas huérfanas
    if (e instanceof ErrorDemo) return res.status(e.estado).json({ error: e.message });
    console.error('[DEMO] error al activar:', e?.message || e);
    return res.status(500).json({ error: 'No pudimos activar la demostración. Inténtalo de nuevo en unos minutos o comunícate con el administrador.' });
  }
});

// POST /demo/admin/credenciales — solo Super Admin. Genera contraseñas nuevas para las 8 cuentas de una demo y las devuelve
// (las contraseñas nunca se guardan: por eso si la persona perdió las suyas hay que restablecerlas).
demoRouter.post('/admin/credenciales', requireAuth, requireRole('super_admin'), async (req, res) => {
  const solicitudId = String(req.body?.solicitud_id || '');
  if (!/^[0-9a-f-]{36}$/.test(solicitudId)) return res.status(400).json({ error: 'Solicitud inválida.' });
  try {
    const { data: sol } = await supabase.from('demo_solicitudes').select('id, estado, institucion_demo_id').eq('id', solicitudId).maybeSingle();
    if (!sol?.institucion_demo_id) return res.status(404).json({ error: 'Esa solicitud aún no tiene una demostración creada.' });
    if (['vencido', 'bloqueado', 'eliminado'].includes(sol.estado)) return res.status(409).json({ error: 'La demostración está vencida o bloqueada: extiéndela antes de restablecer las claves.' });
    const { data: perfiles, error } = await supabase.from('profiles').select('id, email').eq('institucion_id', sol.institucion_demo_id);
    if (error) throw error;
    const cuentas = [];
    for (const p of perfiles || []) {
      const password = claveAleatoria();
      const { error: eUp } = await supabase.auth.admin.updateUserById(p.id, { password });
      if (eUp) throw eUp;
      cuentas.push({ rol: rolDeCorreo(p.email), email: p.email, password });
    }
    const orden = CUENTAS_DEMO.map(c => c.rol);
    cuentas.sort((a, b) => orden.indexOf(a.rol) - orden.indexOf(b.rol));
    return res.json({ ok: true, url: URL_SISTEMA, cuentas });
  } catch (e) {
    console.error('[DEMO] error al restablecer credenciales:', e?.message || e);
    return res.status(500).json({ error: 'No se pudieron restablecer las credenciales.' });
  }
});
