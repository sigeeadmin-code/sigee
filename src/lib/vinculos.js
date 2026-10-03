// Detecta cuándo una cuenta de acceso y una ficha de docente son la misma persona. Módulo PURO.
// Criterio: misma cédula (solo dígitos) o mismo correo. Los nombres NO se usan: dos personas pueden llamarse igual.

const soloDigitos = t => String(t ?? '').replace(/\D/g, '');
const correo = t => String(t ?? '').trim().toLowerCase();

/** ¿Estos dos registros (cuenta o ficha) son la misma persona? Devuelve 'cedula' | 'correo' | null. */
export function coincidencia(a, b) {
  const ca = soloDigitos(a?.cedula), cb = soloDigitos(b?.cedula);
  if (ca.length >= 6 && ca === cb) return 'cedula';
  const ea = correo(a?.email), eb = correo(b?.email);
  if (ea && ea === eb) return 'correo';
  return null;
}

/** De una lista de cuentas sin ficha, las que coinciden con el docente (primero cédula, luego correo). */
export function cuentasQueCoinciden(docente, cuentas) {
  return (cuentas || [])
    .map(c => ({ cuenta: c, por: coincidencia(docente, c) }))
    .filter(x => x.por)
    .sort((x, y) => (x.por === 'cedula' ? 0 : 1) - (y.por === 'cedula' ? 0 : 1))
    .map(x => ({ ...x.cuenta, por: x.por }));
}

/** De una lista de fichas sin cuenta, la ÚNICA que coincide con los datos escritos (si hay duda, ninguna). */
export function fichaUnicaQueCoincide(datos, fichas) {
  const m = (fichas || []).filter(f => coincidencia(datos, f));
  return m.length === 1 ? m[0] : null;
}
