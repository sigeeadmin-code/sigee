// ¿La versión abierta en esta pestaña sigue siendo la publicada? Módulo puro (la comparación) + una función que consulta /version.json.
export function hayVersionNueva(miVersion, publicada) {
  if (!miVersion || !publicada) return false;           // sin datos (p. ej. modo desarrollo): no se molesta a nadie
  return String(miVersion) !== String(publicada);
}

export async function consultarVersionPublicada(fetchFn = fetch) {
  try {
    const r = await fetchFn(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.version ? String(j.version) : null;
  } catch (e) { return null; }                           // sin internet o el archivo no existe: no se hace nada
}
