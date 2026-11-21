// Utilidades puras de la administración de demos (sin Supabase) para poder probarlas.
export const ESTADOS_DEMO = {
  pendiente_confirmacion: { txt: 'Pendiente', color: '#8a5a00', bg: '#fdf0c9' },
  confirmado: { txt: 'Entregada', color: '#1b3f9c', bg: '#e1e9fb' },
  activo: { txt: 'En uso', color: '#14603a', bg: '#e4f2ea' },
  vencido: { txt: 'Vencida', color: '#8f1d16', bg: '#f9dcda' },
  bloqueado: { txt: 'Bloqueada', color: '#8f1d16', bg: '#f9dcda' },
  expirada: { txt: 'Link vencido', color: '#4a5b73', bg: '#e9eff7' },
  eliminado: { txt: 'Eliminada', color: '#4a5b73', bg: '#e9eff7' }
};

export const linkActivacion = (origen, token) => `${String(origen || '').replace(/\/$/, '')}/activar-demo?token=${token}`;

export function diasRestantes(hasta, ahora = new Date()) {
  if (!hasta) return null;
  return Math.ceil((new Date(hasta).getTime() - ahora.getTime()) / 86400000);
}

// 09XXXXXXXX → 593XXXXXXXXX ; si ya trae código de país se respeta.
export function normalizarTelefonoEC(t) {
  const d = String(t || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('593')) return d;
  if (d.startsWith('0')) return '593' + d.slice(1);
  return d;
}

export const whatsappUrl = (telefono, texto) => {
  const n = normalizarTelefonoEC(telefono);
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
};
export const mailtoUrl = (correo, asunto, cuerpo) => `mailto:${correo}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;

// Texto de bienvenida con el link de activación (válido 24 horas).
export function mensajeBienvenida({ nombre, institucion, link }) {
  const n = String(nombre || '').trim().split(/\s+/)[0] || '';
  const whatsapp = `Hola ${n}, bienvenido/a a SIGEE.\n\nRecibimos tu solicitud de demostración para ${institucion || 'tu institución'}. Para activar tu demo abre este enlace (válido por 24 horas):\n\n${link}\n\nAl abrirlo recibirás las credenciales de una institución de ejemplo con todos los paneles: administración, docentes, estudiantes y familias. Tus 5 días empiezan cuando ingreses por primera vez.\n\nSi tienes alguna duda, responde este mensaje. ¡Gracias por probar SIGEE!`;
  const asunto = 'Tu demostración de SIGEE: activa tu acceso';
  const cuerpoCorreo = `Estimado/a ${nombre || ''}:\n\nGracias por su interés en SIGEE, el Sistema de Gestión Educativa. Recibimos su solicitud de demostración para ${institucion || 'su institución'}.\n\nPara activar su acceso, abra el siguiente enlace (válido por 24 horas):\n${link}\n\nAl abrirlo recibirá las credenciales de una institución de ejemplo con todos los paneles: administración, docentes, estudiantes y familias. Sus 5 días de prueba comienzan en su primer ingreso al sistema.\n\nSi necesita ayuda, responda a este correo.\n\nSaludos cordiales,\nEquipo SIGEE`;
  return { whatsapp, asunto, cuerpoCorreo };
}

// Mensaje con las credenciales (cuando se restablecen las claves de una demo ya creada).
export function mensajeCredenciales({ nombre, url, cuentas, dias = 5 }) {
  const n = String(nombre || '').trim().split(/\s+/)[0] || '';
  const lista = (cuentas || []).map(c => `• ${c.rol}\n  Usuario: ${c.email}\n  Contraseña: ${c.password}`).join('\n');
  return `Hola ${n}, estas son las credenciales de tu demostración de SIGEE:\n\nIngresa en: ${url}\n\n${lista}\n\nTus ${dias} días empiezan en tu primer ingreso. Guarda estos datos en un lugar seguro.`;
}
