// Solicitud pública de demostración (5 días). La validación del navegador es solo una ayuda:
// el servidor vuelve a validar todo, aplica límites por IP/correo/cédula y guarda la IP.
// Módulo puro (sin Supabase) para poder probarlo en Node: la URL del servidor se inyecta.
import { validarCedulaEC } from './cedula.js';

export const CARGOS_DEMO = [
  'Rector/a', 'Vicerrector/a', 'Inspector/a general', 'Secretario/a',
  'Docente', 'DECE', 'Autoridad de Zona o Distrito', 'Otro'
];

export function normalizarSolicitud(d) {
  return {
    nombre_completo: String(d.nombre || '').replace(/\s+/g, ' ').trim(),
    cedula: String(d.cedula || '').replace(/\D/g, ''),
    email: String(d.email || '').trim().toLowerCase(),
    institucion: String(d.institucion || '').replace(/\s+/g, ' ').trim(),
    cargo: String(d.cargo || '').trim(),
    telefono: String(d.telefono || '').replace(/[^\d+]/g, ''),
    acepta_datos: d.acepta === true,
    sitio_web: String(d.sitio_web || '')   // trampa para bots: un usuario real nunca la llena
  };
}

// Devuelve { campo: 'mensaje' } solo con los campos inválidos.
export function validarSolicitudDemo(d) {
  const n = normalizarSolicitud(d);
  const e = {};
  if (n.nombre_completo.length < 6 || n.nombre_completo.split(' ').length < 2) e.nombre = 'Escribe tus nombres y apellidos.';
  if (!validarCedulaEC(n.cedula)) e.cedula = 'La cédula no es válida. Revisa los 10 dígitos.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(n.email)) e.email = 'Escribe un correo válido: ahí llegará tu enlace de activación.';
  if (n.institucion.length < 3) e.institucion = 'Escribe el nombre de tu institución.';
  if (!CARGOS_DEMO.includes(n.cargo)) e.cargo = 'Elige tu cargo.';
  if (n.telefono && !/^\+?\d{7,15}$/.test(n.telefono)) e.telefono = 'Usa solo números, con el código de país si es el caso.';
  if (!n.acepta_datos) e.acepta = 'Debes aceptar el uso de tus datos para continuar.';
  return e;
}

// Resultado: { ok, mensaje, codigo } — nunca lanza.
export async function solicitarDemo(datos, { apiUrl, fetchFn = fetch, simulado = false } = {}) {
  const cuerpo = normalizarSolicitud(datos);
  if (simulado) return { ok: true, codigo: 'simulado', mensaje: 'Vista previa: no se envió nada.' };
  try {
    const resp = await fetchFn(`${apiUrl}/demo/solicitar`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo)
    });
    const body = await resp.json().catch(() => ({}));
    if (resp.ok) return { ok: true, codigo: 'enviado', mensaje: body.message || '' };
    if (resp.status === 404) return { ok: false, codigo: 'no_disponible', mensaje: 'La solicitud de demos aún no está habilitada. Inténtalo de nuevo más tarde.' };
    if (resp.status === 429) return { ok: false, codigo: 'limite', mensaje: 'Hiciste demasiados intentos. Espera unos minutos o comunícate con el administrador.' };
    if (resp.status === 409) return { ok: false, codigo: 'duplicada', mensaje: body.error || 'Ya existe una demostración para este correo o cédula. Comunícate con el administrador.' };
    return { ok: false, codigo: 'error', mensaje: body.error || 'No pudimos registrar tu solicitud. Revisa los datos e inténtalo de nuevo.' };
  } catch {
    return { ok: false, codigo: 'red', mensaje: 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.' };
  }
}
