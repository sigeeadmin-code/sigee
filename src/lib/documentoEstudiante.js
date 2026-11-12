/** Documento de identidad del estudiante (cédula EC, pasaporte o código SIGEE para extranjeros). */

/** Algoritmo Módulo 10 — cédula ecuatoriana (Registro Civil). */
export function validarCedulaEcuador(cedula) {
  if (!/^\d{10}$/.test(String(cedula || ''))) return false;
  const provincia = parseInt(cedula.substring(0, 2), 10);
  if (provincia < 1 || provincia > 24) return false;
  const digitos = cedula.split('').map(Number);
  const verificador = digitos[9];
  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let val = digitos[i] * (i % 2 === 0 ? 2 : 1);
    if (val > 9) val -= 9;
    suma += val;
  }
  const residuo = suma % 10;
  const digitoCalculado = residuo === 0 ? 0 : 10 - residuo;
  return digitoCalculado === verificador;
}

/** Nacionalidad ecuatoriana (variantes de texto). */
export function esNacionalidadEcuador(nacionalidad) {
  const s = String(nacionalidad || '').trim().toLowerCase()
    .normalize('NFD').replace(/\p{M}/gu, '');
  return !s || s === 'ecuatoriana' || s === 'ecuador' || s === 'ecuatoriano';
}

/**
 * Puede generar código único SIGEE solo si:
 * - marcado como extranjero, y
 * - tiene nacionalidad distinta de ecuatoriana.
 */
export function puedeGenerarCodigoExtranjero({ extranjero, nacionalidad }) {
  return !!extranjero && !!String(nacionalidad || '').trim() && !esNacionalidadEcuador(nacionalidad);
}

/**
 * Código único legible para extranjero sin cédula EC.
 * Formato: EXT-AAAA-XXXXXXXX o EXT-PREF-AAAA-XXXXXXXX.
 * Se guarda en el campo `cedula` con tipo_documento = 'codigo_sigee'.
 */
export function generarCodigoExtranjero(prefijoInstitucion = '') {
  const year = new Date().getFullYear();
  const rnd = typeof crypto !== 'undefined' && crypto.getRandomValues
    ? Array.from(crypto.getRandomValues(new Uint32Array(2)))
      .map(n => n.toString(36)).join('').toUpperCase().replace(/[^A-Z0-9]/g, '')
    : Math.random().toString(36).slice(2).toUpperCase();
  const cuerpo = (rnd + Date.now().toString(36).toUpperCase()).slice(0, 8).padEnd(8, '0');
  const pre = String(prefijoInstitucion || '').replace(/[^A-Z0-9]/gi, '').slice(0, 4).toUpperCase();
  return pre ? `EXT-${pre}-${year}-${cuerpo}` : `EXT-${year}-${cuerpo}`;
}

/** Valida el documento según tipo. */
export function validarDocumento({ tipoDocumento, tipo_documento, cedula, extranjero, nacionalidad }) {
  const doc = String(cedula || '').trim();
  const tipo = tipo_documento || tipoDocumento || (extranjero ? 'pasaporte' : 'cedula');

  if (puedeGenerarCodigoExtranjero({ extranjero, nacionalidad }) && tipo === 'codigo_sigee') {
    if (!doc) return { ok: false, msg: 'Genere el código único del estudiante extranjero.' };
    if (!/^EXT-/i.test(doc) || doc.length < 12) return { ok: false, msg: 'Código SIGEE inválido.' };
    return { ok: true };
  }

  if (tipo === 'pasaporte' || (extranjero && !esNacionalidadEcuador(nacionalidad))) {
    if (!doc) return { ok: false, msg: 'Ingrese pasaporte o genere el código único.' };
    if (doc.length < 6) return { ok: false, msg: 'Documento demasiado corto (mín. 6 caracteres).' };
    return { ok: true };
  }

  if (!doc) return { ok: false, msg: 'La cédula es obligatoria.' };
  if (!validarCedulaEcuador(doc)) return { ok: false, msg: 'Cédula ecuatoriana inválida.' };
  return { ok: true };
}

export const NACIONALIDADES_COMUNES = [
  'Ecuatoriana', 'Colombiana', 'Peruana', 'Venezolana', 'Cubana',
  'Española', 'Estadounidense', 'China', 'Chilena', 'Argentina',
  'Brasileña', 'Mexicana', 'Haitiana', 'Otra',
];
