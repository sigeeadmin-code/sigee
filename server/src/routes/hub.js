import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { LUMEN_ID, CUENTAS_HUB } from '../lib/hubLumen.js';

export const hubRouter = Router();

// POST /hub/entrar — solo Super Admin. Entrega un acceso de UN SOLO USO para una cuenta demo de Colegio Lumen,
// para que el navegador inicie sesión con él (verifyOtp) sin que ninguna contraseña viaje en el código de la web.
hubRouter.post('/entrar', requireAuth, requireRole('super_admin'), async (req, res) => {
  const rol = String(req.body?.rol || '');
  if (!Object.prototype.hasOwnProperty.call(CUENTAS_HUB, rol)) return res.status(400).json({ error: 'Rol de demostración desconocido.' });
  const email = CUENTAS_HUB[rol];
  if (!email) return res.status(404).json({ error: 'Esta cuenta demo aún no existe en Colegio Lumen.' });
  try {
    // La cuenta debe pertenecer a Colegio Lumen y estar activa: jamás se abre una cuenta de un plantel real.
    const { data: perfil, error: eP } = await supabase.from('profiles').select('id, email, activo').eq('email', email).eq('institucion_id', LUMEN_ID).maybeSingle();
    if (eP) throw eP;
    if (!perfil || perfil.activo === false) return res.status(404).json({ error: 'La cuenta demo no está disponible.' });
    const { data, error } = await supabase.auth.admin.generateLink({ type: 'magiclink', email });
    const tokenHash = data?.properties?.hashed_token;
    if (error || !tokenHash) throw error || new Error('Sin token');
    // Constancia: quién entró y a qué cuenta (si falla no impide la entrada).
    await supabase.from('auditoria').insert({ profile_id: req.user.id, accion: 'HUB_ENTRAR', entidad: 'profiles', entidad_id: perfil.id, institucion_id: LUMEN_ID, cambios: { rol_hub: rol, email } }).then(() => {}, () => {});
    return res.json({ ok: true, token_hash: tokenHash, email });
  } catch (e) {
    console.error('[HUB] error al abrir la cuenta demo:', e?.message || e);
    return res.status(502).json({ error: 'No se pudo abrir la cuenta demo. Inténtalo de nuevo.' });
  }
});
