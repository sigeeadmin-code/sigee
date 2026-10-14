// Envío de correo por la API de Resend (sin dependencias). Variables de entorno en Railway:
//   RESEND_API_KEY  clave de la API de Resend
//   MAIL_FROM       remitente verificado en Resend, ej.: oficios@midominio.com  (o "SIGEE <oficios@midominio.com>")
export const correoConfigurado = () => Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);

const soloDireccion = from => (String(from).match(/<([^>]+)>/)?.[1] || String(from)).trim();
const limpiarNombre = n => String(n || '').replace(/[<>"\r\n,;]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
export const correoValido = e => /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(String(e || '').trim());

export async function enviarCorreo({ to, subject, html, text, replyTo, nombreRemitente, fetchFn = fetch }) {
  if (!correoConfigurado()) throw Object.assign(new Error('El envío de correo aún no está configurado en el servidor.'), { codigo: 'sin_configurar' });
  const nombre = limpiarNombre(nombreRemitente);
  const from = nombre ? `${nombre} (vía SIGEE) <${soloDireccion(process.env.MAIL_FROM)}>` : process.env.MAIL_FROM;
  const resp = await fetchFn('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: Array.isArray(to) ? to : [to], subject, html, text, ...(replyTo && correoValido(replyTo) ? { reply_to: replyTo } : {}) })
  });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) throw Object.assign(new Error(body?.message || `El proveedor de correo respondió ${resp.status}.`), { codigo: 'proveedor', status: resp.status });
  return { id: body.id || null };
}
