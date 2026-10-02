// Colores fijos por materia (determinísticos por nombre) — compartidos por la pantalla de Horario y sus ventanas.
export const PALETA = [
  { bg: '#eef2ff', bd: '#c7d2fe', tx: '#3730a3' }, // índigo
  { bg: '#ecfdf5', bd: '#a7f3d0', tx: '#065f46' }, // esmeralda
  { bg: '#fff7ed', bd: '#fed7aa', tx: '#9a3412' }, // ámbar
  { bg: '#fdf2f8', bd: '#fbcfe8', tx: '#9d174d' }, // rosa
  { bg: '#f0f9ff', bd: '#bae6fd', tx: '#075985' }, // celeste
  { bg: '#f7fee7', bd: '#d9f99d', tx: '#3f6212' }, // lima
  { bg: '#faf5ff', bd: '#e9d5ff', tx: '#6b21a8' }, // violeta
];
export function colorDeMateria(nombre) {
  let h = 0;
  for (let i = 0; i < (nombre || '').length; i++) h = (h * 31 + nombre.charCodeAt(i)) % PALETA.length;
  return PALETA[h];
}
