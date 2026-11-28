// Correo corto de aviso de inasistencia al representante (el equivalente al mensaje de WhatsApp).
// El texto se arma en el servidor con datos de la base: el cliente solo dice a qué estudiante y fecha se refiere.

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const fechaLarga = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** { asunto, texto, html } del aviso. curso puede ir vacío. */
export function construirAviso({ institucion, estudiante, curso, fecha }) {
  const inst = String(institucion || 'La institución educativa').trim();
  const nombre = String(estudiante || '').trim();
  const f = fechaLarga(fecha);
  const alumno = curso ? `${nombre} (${curso})` : nombre;
  const asunto = `Aviso de inasistencia — ${nombre} (${fecha})`.slice(0, 200);
  const parrafo = `Estimado/a representante: le informamos que ${alumno} registró una inasistencia el ${f}. Por favor justifique la falta si corresponde, respondiendo a este correo o acercándose al plantel.`;
  const texto = `${parrafo}\n\nAtentamente,\n${inst}\n\nMensaje enviado mediante SIGEE.`;
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#111">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #dde3ea;border-radius:10px;overflow:hidden">
<div style="background:#0c1c30;color:#fff;padding:14px 20px;font-weight:bold;font-size:15px">${esc(inst)}</div>
<div style="padding:22px 20px;font-size:15px;line-height:1.55">
<p style="margin:0 0 6px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.5px">Aviso de inasistencia</p>
<p style="margin:0 0 14px">${esc(parrafo)}</p>
<p style="margin:0;color:#334155">Atentamente,<br><strong>${esc(inst)}</strong></p>
</div>
<div style="padding:10px 20px;background:#f8fafc;border-top:1px solid #e5eaf0;font-size:11.5px;color:#64748b">Mensaje enviado mediante SIGEE. Puede responder a este correo para comunicarse con el plantel.</div>
</div></body></html>`;
  return { asunto, texto, html };
}
