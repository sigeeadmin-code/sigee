// Consulta de horarios (rector, vicerrector, inspector general): lógica PURA, sin React, para poder probarla.
// Solo LEE; la edición del horario sigue en Horario.jsx (editor).
import { sinTildes, coincideBusqueda } from './fichaAsistencia.js';

export const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
export const TIPO_LABEL = { ciencias: 'Ciencias', tecnico: 'Técnico', otro: 'Otros niveles' };

/**
 * Bachillerato en Ciencias o Técnico. Orden de decisión (comprobado con los datos reales, donde la mayoría de cursos no trae el tipo):
 * 1) grados.tipo_bachillerato si está cargado; 2) figura profesional (figura_id) o especialidad del paralelo → técnico;
 * 3) "BT"/"técnico" en el nombre → técnico; 4) si no es bachillerato → otro; 5) bachillerato con nombre genérico
 * ("1ro Bachillerato", "3ro BGU") o que diga Ciencias/General → ciencias; con nombre de especialidad ("2DO Informática") → técnico.
 */
export function tipoBachillerato(grado, paralelo) {
  const t = sinTildes(grado && grado.tipo_bachillerato);
  if (t === 'tecnico' || t === 'ciencias') return t;
  const nombre = sinTildes(grado && grado.nombre);
  if ((grado && grado.figura_id) || sinTildes(paralelo && paralelo.especialidad) || /(^|\s)bt(\s|$)|tecnic/.test(nombre)) return 'tecnico';
  const esBach = /bachillerato|bgu/.test(sinTildes(grado && grado.nivel)) || /bachillerato|bgu/.test(nombre);
  if (!esBach) return 'otro';
  if (/ciencias|general/.test(nombre)) return 'ciencias';
  const resto = nombre.replace(/\b(\d+\s*(ro|do|er|to|vo|mo|no)?|primer[o]?|segund[o]?|tercer[o]?|ano|anio|curso|grado|de|del|la|el|bachillerato|bgu|unificado)\b/g, '').replace(/[^a-z]/g, '');
  return resto === '' ? 'ciencias' : 'tecnico';
}

/** Docentes con carga en el período, a partir de las cargas de la institución. Agrupa por id (dos docentes pueden llamarse igual). */
export function agruparDocentes(cargas) {
  const m = new Map();
  cargas.forEach(c => {
    if (!c.docenteId) return;
    if (!m.has(c.docenteId)) m.set(c.docenteId, { id: c.docenteId, nombre: c.docenteNombre || 'Sin nombre', cargas: [] });
    m.get(c.docenteId).cargas.push(c);
  });
  return [...m.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/** Búsqueda por nombre en cualquier orden, sin importar tildes ni mayúsculas. También encuentra por materia o curso que dicta. */
export function buscarDocentes(docentes, consulta) {
  const q = String(consulta || '').trim();
  if (!q) return docentes;
  return docentes.filter(d => coincideBusqueda(`${d.nombre} ${d.cargas.map(c => `${c.materiaNombre} ${c.gradoNombre} ${c.paraleloNombre}`).join(' ')}`, q));
}

/** Horas realmente ubicadas en el horario por carga: { cargaId: n }. */
export function horasUbicadas(bloques) {
  const out = {};
  bloques.forEach(b => { out[b.docente_materia_id] = (out[b.docente_materia_id] || 0) + 1; });
  return out;
}

/** Bloques de las cargas indicadas (conjunto de ids). */
export const bloquesDeCargas = (bloques, ids) => { const s = ids instanceof Set ? ids : new Set(ids); return bloques.filter(b => s.has(b.docente_materia_id)); };

/** Un docente en dos paralelos a la misma hora y día = cruce de horario. Devuelve [{ dia, franja, cargas:[id,id,...] }]. */
export function cruces(bloquesDelDocente) {
  const m = new Map();
  bloquesDelDocente.forEach(b => { const k = b.dia + '|' + b.franja; if (!m.has(k)) m.set(k, []); m.get(k).push(b.docente_materia_id); });
  return [...m.entries()].filter(([, ids]) => ids.length > 1).map(([k, ids]) => { const [dia, franja] = k.split('|'); return { dia, franja, cargas: ids }; });
}

/** Cuántos paralelos tienen al menos un bloque cargado. */
export function cobertura(paralelosIds, bloques) {
  const con = new Set(bloques.map(b => b.paralelo_id));
  const conHorario = paralelosIds.filter(id => con.has(id)).length;
  return { conHorario, total: paralelosIds.length };
}

/** Matriz de un día: { [paraleloId]: { [franja]: bloque } } para mostrar todos los cursos a la vez. */
export function matrizDia(bloques, dia) {
  const out = {};
  bloques.filter(b => b.dia === dia).forEach(b => { (out[b.paralelo_id] = out[b.paralelo_id] || {})[b.franja] = b; });
  return out;
}
