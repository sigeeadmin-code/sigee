// Ficha de asistencia de un estudiante: historial por días y por materias, y mensaje de WhatsApp.
// Módulo PURO (sin Supabase ni navegador).
import { analizarAlumno, estadoDia, diaSemana, UMBRALES_DEFECTO } from './asistenciaAnalisis.js';

const redondear1 = n => Math.round(n * 10) / 10;
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const fechaCorta = f => (f ? `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}` : '—');

/**
 * registros: una fila por clase { fecha, estado, materia, docente?, observacion? } del estudiante.
 * Todo se cuenta aparte por clase (materias) y por día (faltas, rachas, clasificación).
 */
export function analizarFicha(registros, umbrales = UMBRALES_DEFECTO) {
  const lista = registros || [];
  const dias = analizarAlumno(lista.map(r => ({ fecha: r.fecha, estado: r.estado })), [], umbrales);

  const c = { total: lista.length, presentes: 0, atrasos: 0, ausentes: 0, justificadas: 0 };
  const materias = new Map();
  for (const r of lista) {
    const k = r.materia || 'Sin materia';
    if (!materias.has(k)) materias.set(k, { materia: k, docente: r.docente || '', clases: 0, presentes: 0, atrasos: 0, faltas: 0, justificadas: 0 });
    const m = materias.get(k);
    m.clases++;
    if (r.estado === 'presente') { c.presentes++; m.presentes++; }
    else if (r.estado === 'atraso') { c.atrasos++; m.atrasos++; }
    else if (r.estado === 'ausente') { c.ausentes++; m.faltas++; }
    else if (r.estado === 'justificado') { c.justificadas++; m.justificadas++; }
  }
  const pctClase = (pres, atr, clases, just) => (clases - just > 0 ? redondear1(((pres + atr) / (clases - just)) * 100) : null);
  const porMateria = [...materias.values()]
    .map(m => ({ ...m, pct: pctClase(m.presentes, m.atrasos, m.clases, m.justificadas) }))
    .sort((a, b) => (b.faltas - a.faltas) || ((a.pct ?? 101) - (b.pct ?? 101)) || a.materia.localeCompare(b.materia));

  // por día: estado del día y detalle por materia
  const porFecha = new Map();
  for (const r of lista) {
    if (!porFecha.has(r.fecha)) porFecha.set(r.fecha, []);
    porFecha.get(r.fecha).push(r);
  }
  const listaDias = [...porFecha.entries()].map(([fecha, rs]) => ({
    fecha, dia: diaSemana(fecha), estado: estadoDia(rs.map(r => r.estado)),
    detalle: rs.map(r => ({ materia: r.materia || 'Sin materia', estado: r.estado, observacion: r.observacion || '' }))
  })).sort((a, b) => b.fecha.localeCompare(a.fecha));

  // por día de la semana y por mes (solo cuentan días)
  const semana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'].map(d => ({ dia: d, faltas: 0, atrasos: 0, dias: 0 }));
  const porMes = new Map();
  for (const d of listaDias) {
    const s = semana.find(x => x.dia === d.dia);
    if (s) { s.dias++; if (d.estado === 'falta') s.faltas++; if (d.estado === 'atraso') s.atrasos++; }
    const k = d.fecha.slice(0, 7);
    if (!porMes.has(k)) porMes.set(k, { mes: k, etiqueta: `${MESES[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`, faltas: 0, justificadas: 0, atrasos: 0, dias: 0 });
    const m = porMes.get(k);
    m.dias++;
    if (d.estado === 'falta') m.faltas++;
    if (d.estado === 'justificada') m.justificadas++;
    if (d.estado === 'atraso') m.atrasos++;
  }
  return {
    resumen: dias,
    clases: { ...c, pctAsistencia: pctClase(c.presentes, c.atrasos, c.total, c.justificadas) },
    porMateria, dias: listaDias, porDiaSemana: semana,
    porMes: [...porMes.values()].sort((a, b) => a.mes.localeCompare(b.mes))
  };
}

// ───────────── búsqueda ─────────────
export const sinTildes = t => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** Todas las palabras de la consulta deben aparecer (en cualquier orden, sin importar tildes ni mayúsculas). */
export function coincideBusqueda(texto, consulta) {
  const t = sinTildes(texto);
  return sinTildes(consulta).split(/\s+/).filter(Boolean).every(p => t.includes(p));
}
/** Palabra más larga de la consulta, sin caracteres que rompan un filtro .or() de PostgREST. */
export function palabraClave(consulta) {
  const limpia = String(consulta ?? '').replace(/[,()%*\\"'`;:]/g, ' ');
  return limpia.split(/\s+/).filter(Boolean).sort((a, b) => b.length - a.length)[0] || '';
}

// ───────────── WhatsApp ─────────────
/** Teléfono ecuatoriano → número nacional de 9 dígitos, o null si no sirve. */
export function telefonoEcuador(telefono) {
  let d = String(telefono ?? '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('593')) d = d.slice(3);
  d = d.replace(/^0/, '');
  return /^9\d{8}$/.test(d) ? d : null;
}
export function urlWhatsApp(telefono, mensaje) {
  const t = telefonoEcuador(telefono);
  return t ? `https://wa.me/593${t}?text=${encodeURIComponent(mensaje)}` : null;
}
export function listaFechas(fechas) {
  const f = fechas.map(fechaCorta);
  if (f.length <= 1) return f[0] || '';
  return `${f.slice(0, -1).join(', ')} y ${f[f.length - 1]}`;
}
export function mensajeWhatsApp({ estudiante, representante, institucion, fechas }) {
  const rep = representante ? `${representante.nombres || ''} ${representante.apellidos || ''}`.trim() : '';
  const n = fechas.length;
  return `Estimado(a) ${rep || 'representante'}: de parte de ${institucion?.nombre || 'la institución educativa'} le informamos que ` +
    `el/la estudiante ${estudiante.nombre}${estudiante.curso ? ` (${estudiante.curso})` : ''} registra ` +
    `${n === 1 ? 'una inasistencia injustificada el' : `${n} inasistencias injustificadas los días`} ${listaFechas(fechas)}. ` +
    `Le solicitamos presentar la justificación correspondiente a la brevedad. Gracias por su atención.`;
}
