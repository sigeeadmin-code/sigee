// Monitor de conexión: cada usuario con sesión manda un latido al sistema (cada ~90 s) con la latencia que
// midió hacia la base de datos y hacia el servidor (Railway), y cuánto tiempo estuvo sin internet.
// Nunca debe romper la app: todo va en try/catch y los fallos se acumulan para reportarlos al reconectar.

export function crearMonitorTic({ supabase, apiUrl, urlRest, anonKey, intervaloMs = 90000, fetchFn = (...a) => fetch(...a), ahora = () => Date.now(), ventana = typeof window !== 'undefined' ? window : null, doc = typeof document !== 'undefined' ? document : null, nav = typeof navigator !== 'undefined' ? navigator : null, ruta = () => (ventana?.location?.pathname || '') }) {
  let sesionId = null, timer = null, activo = false, enCurso = false;
  let ultimaLatDb = null, fallos = 0, offlineSeg = 0, offlineDesde = null, ultimoToken = null, ultimoLatido = 0;
  const enLinea = () => (nav ? nav.onLine !== false : true);

  async function medirApi() {
    const t0 = ahora();
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const corte = ctl ? setTimeout(() => ctl.abort(), 8000) : null;
    try {
      const r = await fetchFn(`${apiUrl}/health`, { cache: 'no-store', signal: ctl?.signal });
      if (!r.ok) { fallos += 1; return null; }
      return Math.round(ahora() - t0);
    } catch { fallos += 1; return null; } finally { if (corte) clearTimeout(corte); }
  }

  async function iniciarSesionRemota() {
    const { data, error } = await supabase.rpc('tic_iniciar_sesion', { p_user_agent: nav?.userAgent || null });
    if (error) throw error;
    sesionId = data;
  }

  async function latido() {
    if (!activo || enCurso) return;
    if (!enLinea()) return;                       // sin internet: no hay nada que reportar todavía, se cuenta el tiempo
    enCurso = true;
    try {
      const { data: s } = await supabase.auth.getSession();
      ultimoToken = s?.session?.access_token || ultimoToken;
      if (!s?.session) return;
      if (!sesionId) await iniciarSesionRemota();
      const latApi = await medirApi();
      const t0 = ahora();
      const { data, error } = await supabase.rpc('tic_latido', { p_sesion: sesionId, p_lat_db: ultimaLatDb, p_lat_api: latApi, p_fallos: fallos, p_offline_seg: Math.round(offlineSeg), p_ruta: ruta() });
      const ms = Math.round(ahora() - t0);
      if (error) { fallos += 1; return; }
      ultimaLatDb = ms;                           // la medición de ESTA llamada viaja en el siguiente latido
      if (data == null) { sesionId = null; await iniciarSesionRemota(); return; }   // la sesión remota ya no existe: se abre otra
      fallos = 0; offlineSeg = 0; ultimoLatido = ahora();
    } catch { fallos += 1; } finally { enCurso = false; }
  }

  const alDesconectar = () => { if (offlineDesde == null) offlineDesde = ahora(); };
  const alReconectar = () => { if (offlineDesde != null) { offlineSeg += (ahora() - offlineDesde) / 1000; offlineDesde = null; } latido(); };
  const alVolver = () => { if (doc && doc.visibilityState === 'visible' && ahora() - ultimoLatido > 30000) latido(); };
  const alSalir = e => {
    if (e && e.persisted) return;                 // pestaña congelada en caché (móvil), no es un cierre real
    if (!sesionId || !ultimoToken || !urlRest) return;
    try { fetchFn(`${urlRest}/rest/v1/rpc/tic_cerrar_sesion`, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${ultimoToken}` }, body: JSON.stringify({ p_sesion: sesionId, p_motivo: 'cierre_pestana' }) }); } catch { /* mejor esfuerzo */ }
  };

  return {
    iniciar() {
      if (activo) return; activo = true;
      if (!enLinea()) offlineDesde = ahora();
      ventana?.addEventListener?.('offline', alDesconectar); ventana?.addEventListener?.('online', alReconectar);
      doc?.addEventListener?.('visibilitychange', alVolver); ventana?.addEventListener?.('pagehide', alSalir);
      latido(); timer = setInterval(latido, intervaloMs); timer?.unref?.();
    },
    async cerrar(motivo = 'logout') {
      if (!activo) return; activo = false;
      clearInterval(timer); timer = null;
      ventana?.removeEventListener?.('offline', alDesconectar); ventana?.removeEventListener?.('online', alReconectar);
      doc?.removeEventListener?.('visibilitychange', alVolver); ventana?.removeEventListener?.('pagehide', alSalir);
      const id = sesionId; sesionId = null;
      if (id) { try { await supabase.rpc('tic_cerrar_sesion', { p_sesion: id, p_motivo: motivo }); } catch { /* la limpieza automática lo cierra */ } }
    },
    _estado: () => ({ sesionId, fallos, offlineSeg, ultimaLatDb, activo }),
    _latido: latido
  };
}
