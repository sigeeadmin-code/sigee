// Llamadas autenticadas al servidor (Railway) con tolerancia a: servidor dormido (502/503/504 → reintenta)
// y sesión vencida o cerrada (401 → intenta renovarla UNA vez y, si no se puede, explica qué pasó).
// Se inyectan getSession / refreshSession / fetchFn para poder probarlo sin red.

export const MSG_SESION_CERRADA =
  'Tu sesión se cerró (por ejemplo, porque cerraste sesión con esta misma cuenta en otra pestaña o dispositivo). ' +
  'Inicia sesión de nuevo. Las notas que escribiste y no guardaste siguen en esta pantalla mientras no la recargues.';

export function crearClienteBackend({ apiUrl, getSession, refreshSession, fetchFn = fetch, esperas = [0, 2500, 5000] }) {
  async function token(forzarRenovar) {
    if (forzarRenovar) {
      const { data, error } = await refreshSession();
      return error ? null : (data?.session?.access_token || null);
    }
    const { data } = await getSession();
    return data?.session?.access_token || null;
  }

  async function enviar(metodo, ruta, cuerpo, tk) {
    let ultimo = null;
    for (const espera of esperas) {
      if (espera) await new Promise(r => setTimeout(r, espera));
      try {
        const resp = await fetchFn(`${apiUrl}${ruta}`, {
          method: metodo,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
          body: JSON.stringify(cuerpo)
        });
        if ([502, 503, 504].includes(resp.status)) { ultimo = new Error('El servidor está iniciando.'); continue; }
        const body = await resp.json().catch(() => ({}));
        return { status: resp.status, ok: resp.ok, body };
      } catch (err) { ultimo = err; }
    }
    throw new Error('No se pudo conectar con el servidor. Revisa tu internet e inténtalo de nuevo.' + (ultimo?.message ? ` (${ultimo.message})` : ''));
  }

  return async function llamar(metodo, ruta, cuerpo) {
    let tk = await token(false);
    if (!tk) throw new Error(MSG_SESION_CERRADA);
    let r = await enviar(metodo, ruta, cuerpo, tk);
    if (r.status === 401) {
      tk = await token(true);                       // la sesión pudo vencer: se renueva una sola vez
      if (!tk) throw new Error(MSG_SESION_CERRADA);
      r = await enviar(metodo, ruta, cuerpo, tk);
      if (r.status === 401) throw new Error(MSG_SESION_CERRADA);
    }
    if (!r.ok) throw new Error(r.body?.error || `Error del servidor (${r.status}).`);
    return r.body;
  };
}
