// Validación de la solicitud pública de demo. Módulo puro (sin base de datos) para poder probarlo.
import { validarCedulaEC } from './cedula.js';

export const CARGOS_DEMO = ['Rector/a', 'Vicerrector/a', 'Inspector/a general', 'Secretario/a', 'Docente', 'DECE', 'Autoridad de Zona o Distrito', 'Otro'];

// Dominios de correo desechable más usados. No es exhaustivo: el límite por IP y por correo/cédula hace el resto.
const DESECHABLES = new Set(['mailinator.com', 'guerrillamail.com', 'guerrillamail.net', '10minutemail.com', 'tempmail.com', 'temp-mail.org', 'yopmail.com', 'trashmail.com', 'getnada.com', 'sharklasers.com', 'dispostable.com', 'maildrop.cc', 'throwawaymail.com', 'fakeinbox.com']);
const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;

const texto = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

// Devuelve { bot, errores, datos }. `bot` = true si llenó el campo trampa (se responde como si nada, sin guardar).
export function validarSolicitud(body) {
  const b = body && typeof body === 'object' ? body : {};
  if (String(b.sitio_web ?? '').trim() !== '') return { bot: true, errores: {}, datos: null };

  const datos = {
    nombre: texto(b.nombre_completo, 120),
    cedula: String(b.cedula ?? '').replace(/\D/g, ''),
    email: texto(b.email, 120).toLowerCase(),
    institucion: texto(b.institucion, 160),
    cargo: texto(b.cargo, 60),
    telefono: String(b.telefono ?? '').replace(/[^\d+]/g, '').slice(0, 20)
  };
  const e = {};
  if (datos.nombre.length < 6 || datos.nombre.split(' ').length < 2) e.nombre = 'Escribe tus nombres y apellidos.';
  if (!validarCedulaEC(datos.cedula)) e.cedula = 'La cédula no es válida.';
  if (!EMAIL_RE.test(datos.email) || datos.email.length > 120) e.email = 'El correo no es válido.';
  else if (DESECHABLES.has(datos.email.split('@')[1])) e.email = 'Usa un correo institucional o personal, no uno temporal.';
  if (datos.institucion.length < 3) e.institucion = 'Escribe el nombre de tu institución.';
  if (!CARGOS_DEMO.includes(datos.cargo)) e.cargo = 'Elige tu cargo.';
  if (!/^\+?\d{7,15}$/.test(datos.telefono)) e.telefono = 'El WhatsApp es obligatorio: solo números, con código de país si no es de Ecuador.';
  if (b.acepta_datos !== true) e.acepta = 'Debes aceptar el uso de tus datos.';
  return { bot: false, errores: e, datos };
}
