import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[FATAL] Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en las variables de entorno.');
  process.exit(1);
}

// Este cliente usa la service_role key: se salta RLS a propósito, porque
// este backend ES la capa de confianza que reemplaza esas validaciones
// con reglas de negocio explícitas (ver lib/calendario.js). NUNCA exponer
// esta key al frontend — solo vive en variables de entorno del servidor.
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});
