// Vista previa del aviso por correo y enlace "mailto" de respaldo. El texto REAL lo arma el servidor (server/src/lib/avisoCorreo.js);
// aquí se reproduce igual para mostrarlo antes de enviar. Un test comprueba que ambos dicen lo mismo.

export const fechaLarga = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export function construirAvisoVista({ institucion, estudiante, curso, fecha }) {
  const inst = String(institucion || 'La institución educativa').trim();
  const nombre = String(estudiante || '').trim();
  const alumno = curso ? `${nombre} (${curso})` : nombre;
  const asunto = `Aviso de inasistencia — ${nombre} (${fecha})`.slice(0, 200);
  const parrafo = `Estimado/a representante: le informamos que ${alumno} registró una inasistencia el ${fechaLarga(fecha)}. Por favor justifique la falta si corresponde, respondiendo a este correo o acercándose al plantel.`;
  const texto = `${parrafo}\n\nAtentamente,\n${inst}\n\nMensaje enviado mediante SIGEE.`;
  return { asunto, texto };
}

/** Enlace para abrir el programa de correo del usuario con el mensaje listo (cuando el envío automático no está activado). */
export function urlMailto(correo, aviso) {
  return `mailto:${encodeURIComponent(String(correo || '').trim())}?subject=${encodeURIComponent(aviso.asunto)}&body=${encodeURIComponent(aviso.texto)}`;
}

const CORREO = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
export const correoValido = e => CORREO.test(String(e || '').trim());
