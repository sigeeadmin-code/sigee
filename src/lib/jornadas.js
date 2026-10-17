// Jornadas de trabajo del colegio: Matutina, Vespertina y Nocturna.
export const JORNADAS = ['Matutina', 'Vespertina', 'Nocturna'];

// Acepta un texto libre ("Matutina y Vespertina", "Matutina, Vesperina y Nocturna", "Completa") o una lista
// y devuelve las jornadas reconocidas, en orden. [] si no reconoce ninguna.
export function normalizarJornadas(valor) {
  const txt = (Array.isArray(valor) ? valor.join(' ') : String(valor || '')).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const out = [];
  if (/matutin|completa/.test(txt)) out.push('Matutina');
  if (/vesper|completa/.test(txt)) out.push('Vespertina');
  if (/nocturn/.test(txt)) out.push('Nocturna');
  return out;
}
// Jornadas que ofrece el plantel (perfil del plantel). Si no hay datos, Matutina.
export function jornadasDePlantel(inst) {
  const j = normalizarJornadas(inst?.jornadas?.length ? inst.jornadas : inst?.jornada);
  return j.length ? j : ['Matutina'];
}
// Jornadas declaradas en la ficha del docente; null si no tiene ninguna definida.
export function jornadasDeDocente(valor) { const j = normalizarJornadas(valor); return j.length ? j : null; }
// ¿El docente puede aparecer en esa jornada? Si su ficha no tiene jornada definida no se excluye (se avisa aparte).
export function docenteTrabajaEn(valorFicha, jornada) { const j = jornadasDeDocente(valorFicha); return !j || j.includes(jornada); }
export const textoJornadas = lista => lista.join(', ');
