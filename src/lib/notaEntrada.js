// Entrada de notas: SOLO números de 0 a 10 con hasta 2 decimales. Módulo puro (sin React) para poder probarlo.
// Se aplica mientras se escribe o se pega (sanitizarNota) y otra vez antes de guardar (esNotaValida); el servidor vuelve a validar.
export const NOTA_MAX = 10;
export const DECIMALES_NOTA = 2;

// Limpia lo escrito: deja solo dígitos y UN separador decimal (la coma se acepta como punto), hasta 2 decimales y sin pasar de 10.
// Si lo escrito deja la nota por encima de 10, se rechaza el último cambio y se devuelve `anterior`.
export function sanitizarNota(entrada, anterior = '') {
  const s = String(entrada === null || entrada === undefined ? '' : entrada).replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const punto = s.indexOf('.');
  let ent = punto === -1 ? s : s.slice(0, punto);
  const dec = punto === -1 ? null : s.slice(punto + 1).replace(/\./g, '').slice(0, DECIMALES_NOTA);
  ent = ent.replace(/^0+(?=\d)/, '').slice(0, 2);   // sin ceros de más a la izquierda y máximo 2 cifras enteras
  if (ent === '' && dec !== null) ent = '0';
  const r = dec === null ? ent : `${ent}.${dec}`;
  if (r === '') return '';
  const n = Number(r);
  if (!Number.isFinite(n) || n > NOTA_MAX) return anterior;
  return r;
}

// ¿Es una nota válida (o vacía)? Estricto: nada de espacios, letras, signos, notación científica ni hexadecimal.
export function esNotaValida(v) {
  if (v === '' || v === null || v === undefined) return true;
  const t = typeof v === 'number' ? String(v) : v;
  return typeof t === 'string' && /^\d{1,2}(\.\d{0,2})?$/.test(t) && Number(t) <= NOTA_MAX;
}

// Cambios de la cuadrícula de notas como funciones PURAS (la pantalla solo las llama): devuelven una cuadrícula nueva, sin tocar la anterior.
export function conCelda(grid, estId, tipo, g, a, valor) {
  const fila = grid && grid[estId];
  const arr = fila && fila[tipo] && fila[tipo][g];
  if (!fila || !arr || a < 0 || a >= arr.length) return grid;   // casillero que no existe: no se cambia nada
  const copia = { ...grid, [estId]: { ...fila, [tipo]: fila[tipo].map(x => [...x]) } };
  copia[estId][tipo][g][a] = sanitizarNota(valor, arr[a]);
  return copia;
}
export function conMejora(grid, estId, campo, valor) {
  const fila = grid && grid[estId];
  if (!fila || !fila.mejora || !(campo in fila.mejora)) return grid;
  return { ...grid, [estId]: { ...fila, mejora: { ...fila.mejora, [campo]: sanitizarNota(valor, fila.mejora[campo]) } } };
}
