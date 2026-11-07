/** Reglas de contraseña de SIGEE (lógica pura, probada en tests/claveSegura.test.mjs). */
export const LARGO_MINIMO = 10;

export function reglasClave(clave, correo = '') {
  const c = String(clave || '');
  const soloLetras = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  const usuario = soloLetras(String(correo || '').split('@')[0]);        // «sigee.admin» → «sigeeadmin»
  return [
    { id: 'largo', texto: `Al menos ${LARGO_MINIMO} caracteres`, ok: c.length >= LARGO_MINIMO },
    { id: 'minuscula', texto: 'Una letra minúscula', ok: /[a-zñ]/.test(c) },
    { id: 'mayuscula', texto: 'Una letra mayúscula', ok: /[A-ZÑ]/.test(c) },
    { id: 'numero', texto: 'Un número', ok: /\d/.test(c) },
    { id: 'sin_correo', texto: 'No contiene tu usuario de correo', ok: usuario.length < 3 || !soloLetras(c).includes(usuario) }
  ];
}

/** { ok, reglas, coincide } — ok solo si cumple todas las reglas y la confirmación coincide. */
export function validarClave(clave, confirmacion, correo = '') {
  const reglas = reglasClave(clave, correo);
  const coincide = clave === confirmacion && String(clave || '').length > 0;
  return { ok: reglas.every(r => r.ok) && coincide, reglas, coincide };
}

/** Fuerza para la barra: 0–4. */
export function fuerzaClave(clave) {
  const c = String(clave || '');
  if (!c) return 0;
  let p = 0;
  if (c.length >= LARGO_MINIMO) p++;
  if (c.length >= 14) p++;
  if (/[a-zñ]/.test(c) && /[A-ZÑ]/.test(c)) p++;
  if (/\d/.test(c) && /[^A-Za-zñÑ0-9]/.test(c)) p++;
  return p;
}
