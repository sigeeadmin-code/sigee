// Soporte TIC en el servidor: (1) bloquea las IP que el Super Admin marcó y (2) deja constancia de las
// peticiones rechazadas (401, 403, 429) y de las rutas inexistentes (404) para detectar sondeos y ataques.
// El registro nunca debe frenar ni romper una petición: todo es en segundo plano y tolera fallos.

export const normalizarIp = ip => String(ip || '').replace(/^::ffff:/i, '').trim() || null;

export function crearLimitador(ventanaMs, ahora = () => Date.now(), maxClaves = 2000) {
  const vistos = new Map();
  return clave => {
    const t = ahora(), previo = vistos.get(clave);
    if (previo != null && t - previo < ventanaMs) return false;
    vistos.set(clave, t);
    if (vistos.size > maxClaves) for (const [k, v] of vistos) if (t - v >= ventanaMs) vistos.delete(k);
    return true;
  };
}

const TIPO_POR_ESTADO = { 401: ['no_autorizado', 'baja'], 403: ['acceso_denegado', 'baja'], 404: ['sondeo_ruta', 'baja'], 429: ['rate_limit', 'media'] };

export function crearVigilante({ supabase, ahora = () => Date.now(), ttlBloqueosMs = 60000, loteMax = 50, programar = true }) {
  let bloqueadas = new Set(); let cargadoEn = 0; let cargando = null;
  const cola = []; const puedeRegistrar = crearLimitador(60000, ahora);

  async function refrescar() {
    try {
      const { data, error } = await supabase.from('tic_ips_bloqueadas').select('ip,hasta').eq('activo', true);
      if (error) throw error;
      const t = ahora();
      bloqueadas = new Set((data || []).filter(b => !b.hasta || new Date(b.hasta).getTime() > t).map(b => normalizarIp(b.ip)));
    } catch (e) { console.error('[tic] no se pudo leer las IP bloqueadas:', e.message); }
    cargadoEn = ahora();
  }
  async function vaciar() {
    const lote = cola.splice(0, loteMax); if (!lote.length) return;
    try { const { error } = await supabase.from('tic_eventos_seguridad').insert(lote); if (error) throw error; }
    catch (e) { console.error('[tic] no se pudo guardar eventos de seguridad:', e.message); }
  }
  function registrar({ tipo, severidad, ip, ruta, metodo }) {
    if (!ip || !puedeRegistrar(`${ip}|${tipo}|${ruta}`)) return;
    cola.push({ tipo, severidad, ip, detalle: { ruta, metodo }, fuente: 'servidor' });
    if (cola.length >= loteMax) vaciar();
  }
  const rutaSegura = req => String(req.originalUrl || req.url || '').split('?')[0].slice(0, 120);   // sin query: puede traer tokens

  if (programar) setInterval(vaciar, 10000).unref();

  return {
    bloqueo: async (req, res, next) => {
      if (req.path === '/health') return next();
      if (ahora() - cargadoEn > ttlBloqueosMs) {
        if (!cargando) cargando = refrescar().finally(() => { cargando = null; });
        if (cargadoEn === 0) await cargando;       // la primera vez se espera; después se refresca en segundo plano
      }
      const ip = normalizarIp(req.ip);
      if (ip && bloqueadas.has(ip)) {
        registrar({ tipo: 'ip_bloqueo_activo', severidad: 'baja', ip, ruta: rutaSegura(req), metodo: req.method });
        return res.status(403).json({ error: 'Acceso bloqueado por seguridad. Comunícate con soporte.' });
      }
      next();
    },
    vigilancia: (req, res, next) => {
      res.on('finish', () => {
        const t = TIPO_POR_ESTADO[res.statusCode]; if (!t) return;
        registrar({ tipo: t[0], severidad: t[1], ip: normalizarIp(req.ip), ruta: rutaSegura(req), metodo: req.method });
      });
      next();
    },
    _vaciar: vaciar, _refrescar: refrescar, _cola: cola
  };
}
