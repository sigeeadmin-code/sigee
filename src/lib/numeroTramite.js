/**
 * El número oficial del documento es el del trámite (0005-2026-AMIE), no el que se escribía a mano en la ficha.
 * Al enviar una ficha a Oficios se reescribe el número dentro de la hoja (copia; el original no se modifica).
 */
const TITULOS_SIN_NUMERO = ['Ficha de seguimiento', 'Acta de reunión', 'Ficha de control'];

export function aplicarNumeroTramite(documento, numero) {
  if (!documento || !numero) return documento;
  const copia = JSON.parse(JSON.stringify(documento));
  copia.numero = numero;
  for (const b of copia.bloques || []) {
    if (b.t !== 'texto' || typeof b.texto !== 'string' || b.texto.includes('\n')) continue;
    const m = /^(.*?\bNro\.)\s*.*$/.exec(b.texto);
    if (m) { b.texto = `${m[1]} ${numero}`; continue; }
    if (b.negrita && TITULOS_SIN_NUMERO.some(t => b.texto.startsWith(t))) b.texto = `${b.texto} Nro. ${numero}`;
  }
  return copia;
}

/** Referencia estable del caso: el mismo documento del mismo trimestre es SIEMPRE el mismo trámite. */
export const refOrigen = (tipoFicha, trimestre) => `${tipoFicha}:${trimestre || ''}`;

/** Tipo de ficha de SIGEE → tipo del trámite. */
export const TIPO_TRAMITE_DE_FICHA = { oficio_rendimiento: 'oficio_alerta', plan_refuerzo: 'plan_refuerzo', acta_compromiso: 'acta_compromiso', ficha_tutor: 'ficha_tutor' };
