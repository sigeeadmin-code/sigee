/**
 * Documento formal de un trámite: reutiliza los constructores y las notas reales que ya usa SIGEE para
 * las fichas de seguimiento (fichasRendimiento.js). El trámite solo agrega número, ruta, versiones y firmas.
 * Tipos del trámite → constructor existente. Los que no tienen constructor (oficio por inasistencia,
 * informe de seguimiento) usan una hoja general con el mismo formato.
 */
import { fetchDetalleEstudianteCalificaciones, fetchRepresentanteDe, fetchPeriodoActivoNombre } from './data.js';
import { parcialDesdeActividades } from './rendimiento.js';
import { construirDocumento, OPCIONES_FICHA, textoCompleto, AVISO_BORRADOR } from './fichasRendimiento.js';

export const CONSTRUCTOR_DE = { oficio_alerta: 'oficio_rendimiento', plan_refuerzo: 'plan_refuerzo', acta_compromiso: 'acta_compromiso', ficha_tutor: 'ficha_tutor' };
export const tieneConstructor = tipo => !!CONSTRUCTOR_DE[tipo];
export const TRIMESTRES = [['T1', 'Primer trimestre'], ['T2', 'Segundo trimestre'], ['T3', 'Tercer trimestre']];

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaLarga = d => `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
let n = 0;
const bid = () => `g${++n}`;

/** Hoja general (sin notas): fecha, número, destinatario, asunto, cuerpo editable y firmas. */
export function construirDocumentoGeneral({ tipo, titulo, asunto, numero, institucion, estudiante, periodoLectivo, ciudad, tutorNombre, fecha = new Date() }) {
  const inst = institucion || {};
  const bloques = [
    { id: bid(), t: 'texto', texto: `${ciudad ? ciudad + ', ' : ''}${fechaLarga(fecha)}`, alin: 'derecha' },
    { id: bid(), t: 'texto', texto: `Oficio Nro. ${numero || '________'}`, negrita: true },
    { id: bid(), t: 'texto', texto: `Señor(a)\nREPRESENTANTE LEGAL DEL ESTUDIANTE ${String(estudiante?.nombre || '').toUpperCase()}\n${estudiante?.curso || ''}\nPresente.-` },
    { id: bid(), t: 'texto', texto: `Asunto: ${asunto || titulo || ''}`, negrita: true },
    { id: bid(), t: 'texto', texto: 'De mi consideración:' },
    { id: bid(), t: 'texto', texto: 'Escriba aquí el contenido del documento.' },
    { id: bid(), t: 'texto', texto: 'Particular que comunico para los fines pertinentes.\nAtentamente,' },
    { id: bid(), t: 'firmas', firmas: [{ nombre: tutorNombre || '', cargo: 'Docente tutor' }, { nombre: '', cargo: 'Inspector General' }] },
    { id: bid(), t: 'campos', cols: 1, filas: [['Recibí conforme (nombre y firma del representante)', ''], ['Cédula', ''], ['Fecha de recepción', '']] }
  ];
  return {
    tipo, titulo: titulo || 'Documento', numero: numero || '', trimestre: null,
    cabecera: { institucion: String(inst.nombre || 'Institución educativa').toUpperCase(), amie: inst.amie ? `AMIE ${inst.amie}` : '', subtitulo: periodoLectivo ? `Período lectivo ${periodoLectivo}` : '' },
    bloques, pie: '', aviso: AVISO_BORRADOR
  };
}

/**
 * Arma el documento del trámite. estudiante: { id, nombre, cedula, curso, paralelo, jornada? }.
 * Devuelve { documento, notas } (notas = texto plano para búsquedas y para quien no pueda ver la hoja).
 */
export async function armarDocumentoOficio({ tipo, estudiante, institucion, trimestre = 'T1', numero, titulo, asunto, tutorNombre = '' }) {
  const idInst = institucion?.id || '';
  const cursoTxt = `${estudiante?.curso || ''} ${estudiante?.paralelo || ''}`.trim();
  let periodoLectivo = '';
  let documento;
  if (tieneConstructor(tipo) && estudiante?.id) {
    const [det, rep, per] = await Promise.all([
      fetchDetalleEstudianteCalificaciones(estudiante.id, trimestre),
      fetchRepresentanteDe(estudiante.id).catch(() => null),
      fetchPeriodoActivoNombre(idInst).catch(() => '')
    ]);
    periodoLectivo = per || '';
    const materias = (det.materias || [])
      .map(m => ({ materia: m.materia, docente: m.docente, ...parcialDesdeActividades(m.actividades) }))
      .sort((a, b) => a.materia.localeCompare(b.materia, 'es'));
    documento = construirDocumento(CONSTRUCTOR_DE[tipo], {
      institucion, trimestre, periodoLectivo, materias, asistencia: null, periodoAsistencia: '',
      estudiante: { nombre: estudiante.nombre, cedula: estudiante.cedula, curso: cursoTxt, jornada: estudiante.jornada || '', representante: rep },
      opciones: { ...OPCIONES_FICHA, numero: numero || '', ciudad: institucion?.canton || '', fecha: new Date(), tutorNombre, firmanteCargo: 'Inspector General', mencionarDece: true }
    });
    documento.tipo = tipo;       // el trámite conserva su propio código de tipo
  } else {
    documento = construirDocumentoGeneral({
      tipo, titulo, asunto, numero, institucion, estudiante: { nombre: estudiante?.nombre || '', curso: cursoTxt },
      periodoLectivo, ciudad: institucion?.canton || '', tutorNombre
    });
  }
  return { documento, notas: textoCompleto(documento) };
}

/** Texto plano del documento actual (se guarda junto a los bloques). */
export const notasDe = documento => (documento ? textoCompleto(documento) : '');
