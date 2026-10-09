// Oficio de notificación de inasistencias al representante legal.
// Módulo PURO: devuelve el contenido estructurado; la pantalla solo lo dibuja (vista previa e impresión).
//
// Base normativa verificada: Reglamento General a la LOEI (Decreto Ejecutivo No. 675, Registro Oficial
// Suplemento No. 254 de 22-feb-2023), art. 171 «Inasistencia». NO se cita aquí la consecuencia por superar un
// porcentaje de inasistencias (art. de reprobación): no se verificó su redacción en el texto 2023; la institución
// puede agregarla en la «nota adicional».
import { diaSemana } from './asistenciaAnalisis.js';

export const BASE_NORMATIVA = 'Reglamento General a la Ley Orgánica de Educación Intercultural (Decreto Ejecutivo No. 675, Registro Oficial Suplemento No. 254 de 22 de febrero de 2023), art. 171';
export const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export const fechaCorta = f => (f ? `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}` : '—');
export const fechaLarga = d => `${d.getDate()} de ${MESES_LARGO[d.getMonth()]} de ${d.getFullYear()}`;
const mayus = t => String(t || '').trim().toUpperCase();
const plural = (n, uno, varios) => (n === 1 ? uno : varios);

export const OPCIONES_OFICIO = {
  numero: '', ciudad: '', fechaEmision: new Date(), plazoDias: 3,
  firmanteNombre: '', firmanteCargo: 'Inspector General',
  incluirJustificadas: false, mencionarDece: true, incluirBaseLegal: true, notaAdicional: ''
};

/**
 * alumno: fila de analizarEstudiantes (nombre, cedula, curso, faltas, justificadas, dias, pctFaltas, rachaMax, rachaIni,
 *         rachaFin, fechasFaltas) + representante { nombres, apellidos } · periodo: { desde, hasta }.
 */
export function construirOficio({ institucion, alumno, periodo, opciones }) {
  const o = { ...OPCIONES_OFICIO, ...(opciones || {}) };
  const inst = institucion || {};
  const nombre = mayus(alumno.nombre);
  const filas = (alumno.fechasFaltas || [])
    .filter(f => f.tipo === 'injustificada' || o.incluirJustificadas)
    .map((f, i) => ({ n: i + 1, fecha: fechaCorta(f.fecha), dia: diaSemana(f.fecha), situacion: f.tipo === 'injustificada' ? 'Injustificada' : 'Justificada' }));
  const n = alumno.faltas || 0;
  const rep = alumno.representante ? `${alumno.representante.nombres || ''} ${alumno.representante.apellidos || ''}`.trim() : '';

  const parrafos = [];
  parrafos.push(
    `La ${inst.nombre || 'institución educativa'} pone en su conocimiento que, según los registros de asistencia de la institución, ` +
    `el/la estudiante ${nombre}${alumno.cedula ? ` (C.I. ${alumno.cedula})` : ''}, del ${alumno.curso}, registra ${n} ${plural(n, 'día', 'días')} de ` +
    `${plural(n, 'inasistencia injustificada', 'inasistencias injustificadas')} entre el ${fechaCorta(periodo.desde)} y el ${fechaCorta(periodo.hasta)}, ` +
    `en ${plural(filas.length, 'la fecha', 'las fechas')} que se ${plural(filas.length, 'detalla', 'detallan')} a continuación:`
  );
  const totales = `Total de inasistencias injustificadas: ${n} ${plural(n, 'día', 'días')}` +
    (alumno.dias ? ` (${String(alumno.pctFaltas ?? 0).replace('.', ',')}% de los ${alumno.dias} ${plural(alumno.dias, 'día', 'días')} de clase con asistencia registrada).` : '.');
  const racha = alumno.rachaMax >= 3
    ? `Se registra además una inasistencia de ${alumno.rachaMax} días de clase consecutivos (del ${fechaCorta(alumno.rachaIni)} al ${fechaCorta(alumno.rachaFin)}).` : '';

  const baseLegal = o.incluirBaseLegal
    ? 'De conformidad con el artículo 171 del Reglamento General a la Ley Orgánica de Educación Intercultural, la inasistencia de uno o dos días debe ser ' +
      'notificada a los representantes legales, quienes deben justificarla, a más tardar, dentro de los dos días posteriores al retorno del estudiante a clases, ' +
      'ante el profesor tutor de curso; y si la inasistencia excede de tres días continuos, el representante legal debe justificarla, con la documentación ' +
      'respectiva, ante la máxima autoridad o el Inspector General de la institución educativa. Asimismo, es obligación de los representantes legales ' +
      'garantizar la asistencia a clases de sus representados.'
    : '';

  const excede = alumno.rachaMax > 3;
  const destino = excede ? 'la máxima autoridad o el Inspector General de la institución' : 'el profesor tutor del curso';
  const plazo = Number(o.plazoDias) > 0 ? ` en el plazo de ${o.plazoDias} ${plural(Number(o.plazoDias), 'día hábil', 'días hábiles')} contados desde la recepción del presente oficio` : ' a la brevedad posible';
  const solicitud = `En virtud de lo expuesto, se solicita presentar la justificación correspondiente${excede ? ', con la documentación respectiva,' : ''} ante ${destino},${plazo}.`;
  const dece = o.mencionarDece ? 'Para brindar acompañamiento a la familia y al estudiante, la institución cuenta con el Departamento de Consejería Estudiantil (DECE).' : '';

  const lugar = [o.ciudad || inst.canton, fechaLarga(new Date(o.fechaEmision))].filter(Boolean).join(', ');
  return {
    advertencia: n === 0 ? 'Este estudiante no tiene inasistencias injustificadas en el período.' : '',
    encabezado: { institucion: mayus(inst.nombre), amie: inst.amie || '', ubicacion: [inst.canton, inst.provincia].filter(Boolean).join(' · ') },
    titulo: `OFICIO Nro. ${o.numero || '________'}`,
    lugarFecha: lugar,
    destinatario: ['Señor(a)', rep ? mayus(rep) : 'REPRESENTANTE LEGAL', `REPRESENTANTE LEGAL DEL ESTUDIANTE ${nombre}`, 'Presente.-'],
    asunto: `Notificación de inasistencias del estudiante ${nombre} — ${alumno.curso}`,
    saludo: 'De mi consideración:',
    parrafos, filas, totales, racha, baseLegal,
    baseNormativa: o.incluirBaseLegal ? BASE_NORMATIVA : '',
    solicitud, dece, notaAdicional: String(o.notaAdicional || '').trim(),
    cierre: ['Con sentimientos de distinguida consideración.', 'Atentamente,'],
    firmante: { nombre: o.firmanteNombre || '______________________________', cargo: o.firmanteCargo || '', institucion: inst.nombre || '' },
    acuse: ['ACUSE DE RECIBO', `Recibí el oficio de notificación de inasistencias del estudiante ${nombre}.`, 'Nombre del representante: ________________________    C.I.: ________________', 'Fecha: ____ / ____ / ________        Firma: ________________________', 'Presentará justificación:   ☐ Sí    ☐ No']
  };
}

/** Estudiantes a los que corresponde un oficio: al menos `minimo` días de falta injustificada. */
export function candidatosOficio(filas, minimo = 1) {
  return filas.filter(f => f.faltas >= minimo).sort((a, b) => b.faltas - a.faltas || String(a.nombre).localeCompare(String(b.nombre)));
}

/** "012-2026" + 2 → "014-2026": suma al primer grupo de dígitos conservando los ceros a la izquierda. */
export function numeroCorrelativo(base, desplazamiento) {
  const t = String(base || '').trim();
  const m = t.match(/\d+/);
  if (!m || !desplazamiento) return t;
  const nuevo = String(Number(m[0]) + desplazamiento).padStart(m[0].length, '0');
  return t.slice(0, m.index) + nuevo + t.slice(m.index + m[0].length);
}
