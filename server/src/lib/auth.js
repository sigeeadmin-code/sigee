import { supabase } from './supabase.js';

/**
 * Exige un Authorization: Bearer <access_token> emitido por Supabase Auth
 * (el mismo token que ya usa el frontend). Verifica el token contra Supabase
 * y adjunta req.user (auth) y req.profile (fila de public.profiles) a la request.
 * Nunca confiar en un institucion_id/rol que venga en el body: siempre se
 * usa el que corresponde al perfil real del token.
 */
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Falta Authorization: Bearer <token>.' });

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return res.status(401).json({ error: 'Token inválido o expirado.' });

    const { data: profile, error: profErr } = await supabase
      .from('profiles').select('*').eq('id', userData.user.id).single();
    if (profErr || !profile) return res.status(403).json({ error: 'Perfil no encontrado para este usuario.' });
    if (profile.activo === false) return res.status(403).json({ error: 'Usuario inactivo.' });

    req.user = userData.user;
    req.profile = profile;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Error validando autenticación: ' + err.message });
  }
}

export function requireRole(...rolesPermitidos) {
  return (req, res, next) => {
    if (!rolesPermitidos.includes(req.profile.rol)) {
      return res.status(403).json({ error: `Rol '${req.profile.rol}' no autorizado para esta acción.` });
    }
    next();
  };
}
