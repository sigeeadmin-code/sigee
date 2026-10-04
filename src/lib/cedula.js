// Validador de cédula ecuatoriana (algoritmo Módulo 10 del Registro Civil). Módulo puro, sin dependencias.
export function validarCedulaEC(cedula) {
  if (!/^\d{10}$/.test(cedula)) return false;
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
