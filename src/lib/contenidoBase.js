// Textos editables del frontend (módulo "Contenido del sitio").
// Este archivo es puro (sin Supabase) para poder probarlo en Node.

export const CONTENIDO_DEFAULTS = {
  'login.hero.activo': 'true',
  'login.hero.marca': 'SIGEE',
  'login.hero.marca_sub': 'Sistema de gestión educativa',
  'login.hero.badge': 'Ecuador · LOEI · Art. 26',
  'login.hero.titulo_antes': 'El sistema que',
  'login.hero.titulo_resaltado': 'simplifica',
  'login.hero.titulo_despues': 'tus calificaciones',
  'login.hero.descripcion': 'Gestión de notas, cartillas oficiales MINEDUC, reportes trimestrales e informe anual — todo en un solo lugar, sin papel.',
  'login.hero.chip1': 'Módulo Art.26 R-LOEI',
  'login.hero.chip2': 'Cartilla oficial MINEDUC',
  'login.hero.chip3': 'Reportes trimestrales',
  'login.hero.chip4': 'Informe anual',
  'login.hero.chip5': 'Impresión masiva',
  'login.hero.chip6': 'Datos seguros'
};

// Campos que muestra el editor, en orden. 'largo' = área de texto.
export const CONTENIDO_CAMPOS = [
  { clave: 'login.hero.marca', etiqueta: 'Nombre de la marca' },
  { clave: 'login.hero.marca_sub', etiqueta: 'Subtítulo de la marca' },
  { clave: 'login.hero.badge', etiqueta: 'Etiqueta sobre el título' },
  { clave: 'login.hero.titulo_antes', etiqueta: 'Título: texto antes de la palabra resaltada' },
  { clave: 'login.hero.titulo_resaltado', etiqueta: 'Título: palabra resaltada (en azul)' },
  { clave: 'login.hero.titulo_despues', etiqueta: 'Título: texto después de la palabra resaltada' },
  { clave: 'login.hero.descripcion', etiqueta: 'Descripción', largo: true },
  { clave: 'login.hero.chip1', etiqueta: 'Etiqueta 1' },
  { clave: 'login.hero.chip2', etiqueta: 'Etiqueta 2' },
  { clave: 'login.hero.chip3', etiqueta: 'Etiqueta 3' },
  { clave: 'login.hero.chip4', etiqueta: 'Etiqueta 4' },
  { clave: 'login.hero.chip5', etiqueta: 'Etiqueta 5' },
  { clave: 'login.hero.chip6', etiqueta: 'Etiqueta 6' }
];

const LIMITE = 400;

// Mezcla las filas de la base con los valores por defecto. Una clave que no
// existe en la base (o llega nula) conserva el texto original.
export function mezclarContenido(filas) {
  const out = { ...CONTENIDO_DEFAULTS };
  for (const f of filas || []) {
    if (f && typeof f.clave === 'string' && f.clave in CONTENIDO_DEFAULTS && typeof f.valor === 'string') {
      out[f.clave] = f.valor;
    }
  }
  return out;
}

export function limpiarTexto(v) {
  return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, LIMITE);
}

// Devuelve solo las claves cuyo valor cambió respecto de `actual`.
export function cambiosContenido(actual, nuevo) {
  const cambios = [];
  for (const clave of Object.keys(CONTENIDO_DEFAULTS)) {
    if (!(clave in nuevo)) continue;
    const valor = clave === 'login.hero.activo' ? (nuevo[clave] === 'false' ? 'false' : 'true') : limpiarTexto(nuevo[clave]);
    if (valor !== actual[clave]) cambios.push({ clave, valor });
  }
  return cambios;
}

export function portadaActiva(c) {
  return (c || CONTENIDO_DEFAULTS)['login.hero.activo'] !== 'false';
}

export function chipsDe(c) {
  return [1, 2, 3, 4, 5, 6].map(n => c[`login.hero.chip${n}`]).filter(t => t && t.trim());
}
