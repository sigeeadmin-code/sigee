// Soporte TIC — utilidades puras (sin red ni React) para el panel del Super Admin y el monitor de conexión.

export const UMBRAL_LENTO_MS = 2000;
export const UMBRAL_MUY_LENTO_MS = 4000;

export function clasificarLatencia(ms) {
  if (ms == null) return { id: 'sin_dato', texto: 'Sin dato', color: 'var(--slate)' };
  if (ms > UMBRAL_MUY_LENTO_MS) return { id: 'muy_lento', texto: 'Muy lenta', color: 'var(--red)' };
  if (ms > UMBRAL_LENTO_MS) return { id: 'lento', texto: 'Lenta', color: 'var(--amber)' };
  return { id: 'buena', texto: 'Buena', color: 'var(--green)' };
}

/** Un usuario "con problemas de conexión": latencia p95 alta, caídas de red o muchos latidos lentos. */
export function usuarioConProblema(u) {
  const motivos = [];
  if ((u.db_p95 ?? 0) > UMBRAL_LENTO_MS) motivos.push('latencia alta');
  if ((u.api_p95 ?? 0) > 6000) motivos.push('servidor lento');
  if ((u.fallos ?? 0) >= 3) motivos.push('fallos de conexión');
  if ((u.offline_seg ?? 0) >= 60) motivos.push('se quedó sin internet');
  if ((u.pct_lentos ?? 0) >= 30) motivos.push('muchas respuestas lentas');
  return { problema: motivos.length > 0, motivos };
}

export function formatoDuracion(min) {
  if (min == null || isNaN(min)) return '—';
  const m = Math.round(Number(min));
  if (m < 1) return '< 1 min';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export function navegadorCorto(ua) {
  if (!ua) return '—';
  const so = /Windows/i.test(ua) ? 'Windows' : /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iOS/i.test(ua) ? 'iOS' : /Mac OS/i.test(ua) ? 'Mac' : /Linux/i.test(ua) ? 'Linux' : '';
  const nav = /Edg\//i.test(ua) ? 'Edge' : /OPR\/|Opera/i.test(ua) ? 'Opera' : /SamsungBrowser/i.test(ua) ? 'Samsung' : /Chrome\//i.test(ua) ? 'Chrome' : /Firefox\//i.test(ua) ? 'Firefox' : /Safari\//i.test(ua) ? 'Safari' : 'Otro';
  return so ? `${nav} · ${so}` : nav;
}

export const TIPOS_EVENTO = {
  login_fallido: { texto: 'Intento de ingreso fallido', externo: true },
  fuerza_bruta_cuenta: { texto: 'Fuerza bruta contra una cuenta', externo: true },
  rociado_contrasenas: { texto: 'Rociado de contraseñas (una IP, muchas cuentas)', externo: true },
  sondeo_api: { texto: 'Sondeo del servidor (muchas peticiones rechazadas)', externo: true },
  escaneo_vulnerabilidades: { texto: 'Escaneo de vulnerabilidades', externo: true },
  rate_limit: { texto: 'Exceso de peticiones (límite alcanzado)', externo: true },
  no_autorizado: { texto: 'Petición sin autorización', externo: true },
  acceso_denegado: { texto: 'Acceso denegado', externo: true },
  sondeo_ruta: { texto: 'Ruta inexistente consultada', externo: true },
  ip_bloqueo_activo: { texto: 'Petición de una IP bloqueada', externo: true },
  borrado_masivo: { texto: 'Borrado masivo de registros', externo: false },
  actividad_masiva: { texto: 'Actividad masiva de un usuario', externo: false },
  cambio_fuera_horario: { texto: 'Docente modificó datos de madrugada', externo: false },
  cuenta_multiples_ips: { texto: 'Cuenta usada desde varias IP', externo: false },
  ip_bloqueada: { texto: 'IP bloqueada por el Super Admin', externo: false },
  ip_desbloqueada: { texto: 'IP desbloqueada', externo: false }
};
export const etiquetaEvento = t => TIPOS_EVENTO[t]?.texto || t;
export const esEventoExterno = t => TIPOS_EVENTO[t]?.externo === true;

export const ESTADOS_RED = {
  normal: { texto: 'Todo normal', icono: 'ti ti-circle-check', color: 'var(--green)', fondo: 'var(--greenL, #ecfdf5)' },
  internet_lento: { texto: 'Internet lento en un plantel', icono: 'ti ti-wifi-2', color: 'var(--amberD)', fondo: 'var(--amberL)' },
  caida_internet: { texto: 'Caída de internet en un plantel', icono: 'ti ti-wifi-off', color: 'var(--amberD)', fondo: 'var(--amberL)' },
  saturacion_sistema: { texto: 'Sistema saturado por flujo de usuarios', icono: 'ti ti-flame', color: 'var(--red)', fondo: 'var(--redL)' },
  caida_sistema: { texto: 'Posible caída del sistema o del proveedor', icono: 'ti ti-server-off', color: 'var(--red)', fondo: 'var(--redL)' }
};

export const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** Hora (0-23) con más usuarios promedio, a partir de `por_hora` ([{hr, usuarios}]). */
export function horaPico(porHora) {
  let mejor = null;
  for (const h of porHora || []) if (!mejor || Number(h.usuarios) > Number(mejor.usuarios)) mejor = h;
  return mejor && Number(mejor.usuarios) > 0 ? mejor : null;
}

/** Celda del mapa de calor → intensidad 0-1 respecto al máximo. */
export function intensidadCalor(valor, maximo) { return maximo > 0 ? Math.max(0, Math.min(1, Number(valor || 0) / maximo)) : 0; }

/** Limita la frecuencia de eventos iguales (misma clave) dentro de una ventana. Devuelve true si se puede registrar. */
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

/* ── Conexiones y límites del plan (Soporte TIC → Conexiones) ── */
// Límite de conexiones simultáneas de tiempo real del plan Pro de Supabase (500). Se puede cambiar desde la pantalla
// si el plan cambia; el valor oficial vigente está en Supabase → Settings → Billing / Realtime limits.
export const LIMITE_REALTIME_PLAN_PRO = 500;
export const UMBRAL_ATENCION = 70;   // % del límite: empieza a preocupar
export const UMBRAL_CRITICO = 85;    // % del límite: hay que actuar (ampliar el plan o apagar el tiempo real)

export const porcentajeLimite = (valor, limite) => (limite > 0 ? Math.round((Number(valor || 0) / limite) * 1000) / 10 : 0);

// Semáforo: normal (< 70 %), atención (70–84,9 %), crítico (≥ 85 %).
export function semaforoConexiones(valor, limite) {
  const pct = porcentajeLimite(valor, limite);
  if (pct >= UMBRAL_CRITICO) return { id: 'critico', pct, color: 'var(--red)', texto: 'Crítico: cerca del límite del plan' };
  if (pct >= UMBRAL_ATENCION) return { id: 'atencion', pct, color: 'var(--amberD)', texto: 'Atención: se acerca al límite del plan' };
  return { id: 'normal', pct, color: 'var(--green, #0f9d8a)', texto: 'Normal: lejos del límite del plan' };
}

// Resume la lista de días que devuelve tic_conexiones_diarias: pico máximo del rango, el de hoy, el promedio de los días con actividad.
export function resumenConexiones(dias) {
  const lista = Array.isArray(dias) ? dias : [];
  let max = { valor: 0, dia: null, hora: null };
  lista.forEach(d => { const v = Number(d.pico) || 0; if (v > max.valor) max = { valor: v, dia: d.dia, hora: d.hora_pico || null }; });
  const hoy = lista.length ? lista[lista.length - 1] : null;
  const activos = lista.filter(d => Number(d.pico) > 0);
  const promedio = activos.length ? Math.round((activos.reduce((a, d) => a + Number(d.pico), 0) / activos.length) * 10) / 10 : 0;
  const maxBd = lista.reduce((m, d) => Math.max(m, Number(d.pico_bd) || 0), 0);
  return { max, hoy: hoy ? { valor: Number(hoy.pico) || 0, hora: hoy.hora_pico || null, dia: hoy.dia } : { valor: 0, hora: null, dia: null }, promedio, diasActivos: activos.length, maxBd };
}

// Límite elegido por el administrador (guardado en su navegador). Acepta solo enteros razonables; si no, usa el del plan Pro.
export function limiteValido(v, porDefecto = LIMITE_REALTIME_PLAN_PRO) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 10 && n <= 1000000 ? n : porDefecto;
}
