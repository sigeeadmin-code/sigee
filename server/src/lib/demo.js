// Estado de demostración de una institución, con caché corta para no consultar la base en cada petición.
import { supabase } from './supabase.js';

const cache = new Map();   // institucionId -> { es_demo, demo_hasta, t }
const TTL_MS = 60_000;

export async function estadoDemoInstitucion(institucionId) {
  if (!institucionId) return { es_demo: false, demo_hasta: null };
  const hit = cache.get(institucionId);
  if (hit && Date.now() - hit.t < TTL_MS) return hit;
  const { data } = await supabase.from('instituciones').select('es_demo, demo_hasta').eq('id', institucionId).maybeSingle();
  const est = { es_demo: !!data?.es_demo, demo_hasta: data?.demo_hasta || null, t: Date.now() };
  cache.set(institucionId, est);
  return est;
}

export const demoVencida = (est) => !!(est?.es_demo && est.demo_hasta && new Date(est.demo_hasta) < new Date());
export const olvidarEstadoDemo = (institucionId) => cache.delete(institucionId);
