// Lógica pura del resumen "Hoy por docente" (Análisis de asistencia): orden, etiquetas y reglas de la acción de Inspección.

export const ETIQUETA_ESTADO = {
  registrada: { txt: 'Registrada', fondo: '#dcfce7', color: '#15803d' },
  en_curso: { txt: 'En curso', fondo: '#dbeafe', color: '#1d4ed8' },
  pendiente: { txt: 'Pendiente', fondo: '#f1f5f9', color: '#475569' },
  sin_registro: { txt: 'Sin registro', fondo: '#fee2e2', color: '#b91c1c' }
};

/** Primero los docentes con clases sin registro, luego los que más ausentes tienen; empate por nombre. */
export function ordenarDocentes(docentes) {
  return [...(docentes || [])].sort((a, b) =>
    (b.sin_registro - a.sin_registro) || (b.ausentes - a.ausentes) || String(a.docente).localeCompare(String(b.docente), 'es'));
}

/** Filtra por nombre y, si soloPendientes, deja solo docentes con ausentes o clases sin registro. */
export function filtrarDocentes(docentes, { texto = '', soloPendientes = false } = {}) {
  const t = String(texto).trim().toLowerCase();
  return (docentes || []).filter(d => (!t || String(d.docente).toLowerCase().includes(t)) && (!soloPendientes || d.ausentes > 0 || d.sin_registro > 0));
}

/** La acción "marcar como atraso" solo existe para el Inspector General, sobre ausentes, y solo mientras dura la hora de ESA clase. */
export function puedeMarcarAtraso(rolDb, clase) {
  return rolDb === 'inspector_general' && !!clase?.en_hora && clase.estado === 'registrada' && (clase.lista_ausentes || []).length > 0;
}

/** Texto que explica por qué no se puede marcar (o null si se puede). */
export function motivoSinAccion(rolDb, clase) {
  if (rolDb !== 'inspector_general') return 'Solo el Inspector General registra atrasos; esta vista es informativa.';
  if (!(clase?.lista_ausentes || []).length) return null;
  if (clase.en_hora) return null;
  return clase.estado === 'pendiente' || clase.estado === 'en_curso'
    ? `La clase aún no está en su hora (${clase.franjas}).`
    : `La hora de esta clase (${clase.franjas}) ya terminó: los ausentes siguen como ausentes.`;
}

export function totalesDocente(d) {
  const clases = d?.clases || [];
  return { clases: clases.length, ausentes: clases.reduce((s, c) => s + (c.ausentes || 0), 0), atrasos: clases.reduce((s, c) => s + (c.atrasos || 0), 0) };
}

const aMin = hhmm => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + m; };

/** Franja de la clase en la que cae la hora dada: { inicio, fin, restan } (minutos que quedan), o null si no está en ninguna. */
export function franjaActual(franjas, hora) {
  const h = aMin(hora);
  for (const f of String(franjas || '').split(',').map(x => x.trim()).filter(Boolean)) {
    const [i, e] = f.split('–');
    if (!i || !e) continue;
    if (aMin(i) <= h && h <= aMin(e)) return { inicio: i, fin: e, restan: aMin(e) - h };
  }
  return null;
}

export const textoRestan = min => (min <= 0 ? 'termina ahora' : min === 1 ? 'queda 1 minuto' : `quedan ${min} minutos`);

/** Porcentajes de la barra de una clase (presentes, atrasos, ausentes, justificados) sobre lo registrado. */
export function barraClase(c) {
  const t = (c.presentes || 0) + (c.atrasos || 0) + (c.ausentes || 0) + (c.justificados || 0);
  if (!t) return { presentes: 0, atrasos: 0, ausentes: 0, justificados: 0 };
  const p = n => Math.round(((n || 0) / t) * 1000) / 10;
  return { presentes: p(c.presentes), atrasos: p(c.atrasos), ausentes: p(c.ausentes), justificados: p(c.justificados) };
}
