// Asignar docentes de la base central a un plantel (incorporarlos al sistema activo)
// y cruzar la base con los docentes que ya están activos. Módulo PURO.
import { separarNombreCompleto } from './importacionInteligente.js';
import { cedulaCentral } from './importCentral.js';

const igual = c => cedulaCentral(c);   // 702806712 y 0702806712 son la misma cédula

/** Ficha de `docentes` a partir del registro de la base. En la base el nombre viene como "APELLIDOS NOMBRES". */
export function docenteDesdeBase(b, institucionId) {
  const s = separarNombreCompleto(b.nombre, true);
  const titulos = Array.isArray(b.titulos) ? b.titulos : [];
  const fila = {
    institucion_id: institucionId,
    cedula: igual(b.cedula) || b.cedula,
    apellidos: s.apellidos || String(b.nombre || '').trim(),
    nombres: s.nombres || ''
  };
  const titulo = titulos.find(t => t?.titulo)?.titulo;
  if (titulo) fila.titulo = titulo;
  if (b.especialidad) fila.especialidad = b.especialidad;
  return { fila, dudoso: !!s.dudoso };
}

/**
 * registros: filas de base_docentes elegidas · cedulasEnPlantel: cédulas que ya tiene ese plantel como docentes.
 * Devuelve qué se debe crear, cuáles ya estaban (solo se marcan como asignadas) y los nombres que conviene revisar.
 */
export function planAsignacion(registros, cedulasEnPlantel, institucionId) {
  const yaEn = new Set([...(cedulasEnPlantel || [])].map(igual).filter(Boolean));
  const aIncorporar = [], yaEstaban = [], dudosos = [], sinCedula = [];
  const vistas = new Set();
  for (const b of registros) {
    const c = igual(b.cedula);
    if (!c) { sinCedula.push(b.id); continue; }
    if (vistas.has(c)) continue;
    vistas.add(c);
    if (yaEn.has(c)) { yaEstaban.push(b.id); continue; }
    const { fila, dudoso } = docenteDesdeBase(b, institucionId);
    aIncorporar.push({ id: b.id, fila });
    if (dudoso) dudosos.push({ cedula: fila.cedula, nombre: b.nombre });
  }
  return { aIncorporar, yaEstaban, dudosos, sinCedula };
}

/**
 * Cruce con los docentes activos: la base sin plantel que ya está en UN plantel se asigna a ese plantel.
 * Si la cédula está en varios planteles no se decide sola (queda como ambigua).
 */
export function planCruce(baseSinPlantel, docentesActivos) {
  const porCedula = new Map();
  for (const d of docentesActivos) {
    const c = igual(d.cedula);
    if (!c || !d.institucion_id) continue;
    if (!porCedula.has(c)) porCedula.set(c, new Set());
    porCedula.get(c).add(d.institucion_id);
  }
  const asignar = new Map();   // institucion_id → [ids de la base]
  let ambiguos = 0, sinCoincidencia = 0;
  for (const b of baseSinPlantel) {
    const planteles = porCedula.get(igual(b.cedula));
    if (!planteles) { sinCoincidencia++; continue; }
    if (planteles.size > 1) { ambiguos++; continue; }
    const [inst] = planteles;
    if (!asignar.has(inst)) asignar.set(inst, []);
    asignar.get(inst).push(b.id);
  }
  const total = [...asignar.values()].reduce((a, l) => a + l.length, 0);
  return { asignar, total, ambiguos, sinCoincidencia };
}
