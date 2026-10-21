// Oficios y fichas de seguimiento académico (alerta temprana de bajo rendimiento) — módulo PURO.
// Cada constructor devuelve un documento ESTRUCTURADO y editable; la pantalla lo dibuja, lo deja editar y lo imprime.
//
// Base normativa: Reglamento General a la LOEI (Decreto Ejecutivo No. 675, Registro Oficial Suplemento No. 254 de
// 22-feb-2023) y el Instructivo de Evaluación Estudiantil vigente del Ministerio de Educación del Ecuador: informes de
// aprendizaje a la familia, refuerzo pedagógico y PLAN INDIVIDUAL DE REFUERZO PEDAGÓGICO cuando el informe de progreso es
// menor a 7/10, y derivación a evaluación psicopedagógica y acompañamiento si no se evidencia mejora. Se citan por su
// nombre y NO por número de artículo: el número cambió con la reforma de 2023 y no se pudo confirmar contra el texto oficial.
// Los plazos y formatos del distrito pueden variar: por eso TODO el contenido es editable antes de imprimir.
import { bandaDe, fmtNota, ALERTA_MAX } from './rendimiento.js';
import { BASE_NORMATIVA as BASE_ASISTENCIA, MESES_LARGO } from './oficioFaltas.js';

export const TIPOS_FICHA = {
  oficio_rendimiento: { titulo: 'Oficio al representante legal', corto: 'Oficio', icono: 'ti ti-mail', desc: 'Notifica la alerta de bajo rendimiento y convoca a reunión.' },
  plan_refuerzo: { titulo: 'Plan individual de refuerzo pedagógico', corto: 'Plan de refuerzo', icono: 'ti ti-target-arrow', desc: 'Acciones de refuerzo por asignatura, cronograma y evaluación de la mejora.' },
  acta_compromiso: { titulo: 'Acta de reunión y compromiso', corto: 'Acta de compromiso', icono: 'ti ti-signature', desc: 'Constancia de la reunión con la familia y compromisos de cada parte.' },
  ficha_tutor: { titulo: 'Ficha de control del tutor (calificaciones y asistencia)', corto: 'Ficha del tutor', icono: 'ti ti-clipboard-check', desc: 'Resumen de notas de todas las asignaturas y de la asistencia del estudiante.' }
};

export const BASE_NORMATIVA_RENDIMIENTO = 'Reglamento General a la Ley Orgánica de Educación Intercultural (Decreto Ejecutivo No. 675, Registro Oficial Suplemento No. 254 de 22 de febrero de 2023) e Instructivo de Evaluación Estudiantil vigente del Ministerio de Educación: informes de aprendizaje, refuerzo pedagógico y plan individual de refuerzo pedagógico.';
export const AVISO_BORRADOR = 'Documento generado por SIGEE como borrador: revíselo, edítelo y fírmelo antes de entregarlo.';

const mayus = t => String(t || '').trim().toUpperCase();
const fechaLarga = d => `${d.getDate()} de ${MESES_LARGO[d.getMonth()]} de ${d.getFullYear()}`;
const trimNombre = t => (t === 'T1' ? 'primer' : t === 'T2' ? 'segundo' : t === 'T3' ? 'tercer' : '');
const escala = p => { const b = bandaDe(p); return b ? `${b.sigla} · ${b.nombre}` : '—'; };

export const OPCIONES_FICHA = { numero: '', ciudad: '', fecha: new Date(), firmanteNombre: '', firmanteCargo: 'Inspector General', tutorNombre: '', mencionarDece: true };

let contador = 0;
const id = () => `b${++contador}`;
const texto = (t, extra = {}) => ({ id: id(), t: 'texto', texto: t, ...extra });
const subtitulo = t => ({ id: id(), t: 'subtitulo', texto: t });
const campos = (filas, cols = 1) => ({ id: id(), t: 'campos', cols, filas: filas.map(([e, v]) => [e, v ?? '']) });
const tabla = (cols, filas, vacias = 0) => ({ id: id(), t: 'tabla', cols, filas: [...filas, ...Array.from({ length: vacias }, () => cols.map(() => ''))] });
const lista = items => ({ id: id(), t: 'lista', items: items.map(i => (typeof i === 'string' ? { texto: i, marcado: false } : i)) });
const firmas = lista => ({ id: id(), t: 'firmas', firmas: lista });

function cabecera(institucion, periodoLectivo, subtitulo) {
  const inst = institucion || {};
  return { institucion: mayus(inst.nombre || 'Institución educativa'), amie: inst.amie ? `AMIE ${inst.amie}` : '', subtitulo: [periodoLectivo ? `Período lectivo ${periodoLectivo}` : '', subtitulo].filter(Boolean).join(' · ') };
}
const datosEstudiante = (est, trimestre) => campos([
  ['Estudiante', mayus(est.nombre)], ['Cédula', est.cedula || ''], ['Curso y paralelo', est.curso || ''], ['Jornada', est.jornada || ''],
  ['Representante legal', est.representante ? `${est.representante.nombres || ''} ${est.representante.apellidos || ''}`.trim() : ''],
  ['Informe de progreso', trimestre ? `Trimestre ${trimestre.slice(1)}` : '']
], 2);
const filasMaterias = materias => materias.map(m => [m.materia, m.docente || '', fmtNota(m.parcial), escala(m.parcial)]);
const enBajo = materias => materias.filter(m => m.parcial !== null && m.parcial !== undefined && Number(m.parcial) > 0 && Number(m.parcial) <= ALERTA_MAX).sort((a, b) => a.parcial - b.parcial);

function firmantes(o, extra = []) {
  const lista = [{ nombre: o.tutorNombre || '', cargo: 'Docente tutor' }];
  if (o.firmanteNombre || o.firmanteCargo) lista.push({ nombre: o.firmanteNombre || '', cargo: o.firmanteCargo || '' });
  return [...lista, ...extra];
}

/** Oficio de notificación de alerta temprana al representante legal. */
export function construirOficioRendimiento({ institucion, estudiante, trimestre, periodoLectivo, materias, opciones }) {
  const o = { ...OPCIONES_FICHA, ...(opciones || {}) }; const inst = institucion || {}; const bajo = enBajo(materias || []);
  const rep = estudiante.representante ? `${estudiante.representante.nombres || ''} ${estudiante.representante.apellidos || ''}`.trim() : '';
  const nombre = mayus(estudiante.nombre);
  const bloques = [
    texto(`${o.ciudad ? o.ciudad + ', ' : ''}${fechaLarga(o.fecha)}`, { alin: 'derecha' }),
    texto(`Oficio Nro. ${o.numero || '________'}`, { negrita: true }),
    texto(`Señor(a)\n${rep ? mayus(rep) : 'REPRESENTANTE LEGAL'}\nRepresentante legal del estudiante ${nombre}\n${estudiante.curso || ''}${estudiante.jornada ? ' · Jornada ' + estudiante.jornada : ''}\nPresente.-`),
    texto('Asunto: Notificación de alerta temprana de bajo rendimiento académico y convocatoria a reunión.', { negrita: true }),
    texto('De mi consideración:'),
    texto(`Reciba un cordial saludo de la ${inst.nombre || 'institución educativa'}. Por medio del presente pongo en su conocimiento que, de acuerdo con el informe de progreso del ${trimNombre(trimestre) || ''} trimestre, el estudiante ${nombre} registra promedios inferiores a 7/10 en las siguientes asignaturas:`),
    tabla(['Asignatura', 'Docente', 'Promedio', 'Escala'], filasMaterias(bajo)),
    texto('Con el fin de apoyar el aprendizaje de su representado, la institución diseñará un plan individual de refuerzo pedagógico, conforme a la normativa del Ministerio de Educación. Para ello es indispensable la corresponsabilidad de la familia; por lo tanto, le solicito acudir a la institución el día ________________ a las ________ en ________________________.')
  ];
  if (o.mencionarDece) bloques.push(texto('Si en el siguiente informe de progreso no se evidencia mejora con el plan individual de refuerzo pedagógico, la institución derivará al estudiante a una evaluación psicopedagógica y a acompañamiento por parte del Departamento de Consejería Estudiantil (DECE), con su conocimiento.'));
  bloques.push(texto('Particular que comunico para los fines pertinentes.\nAtentamente,'));
  bloques.push(firmas(firmantes(o)));
  bloques.push(campos([['Recibí conforme (nombre y firma del representante)', ''], ['Cédula', ''], ['Fecha de recepción', '']], 1));
  return { tipo: 'oficio_rendimiento', titulo: `Oficio de alerta temprana — ${estudiante.nombre}`, numero: o.numero || '', trimestre, cabecera: cabecera(institucion, periodoLectivo, 'Alerta temprana de rendimiento'), bloques, pie: BASE_NORMATIVA_RENDIMIENTO, aviso: AVISO_BORRADOR };
}

/** Ficha de seguimiento y plan individual de refuerzo pedagógico. */
export function construirPlanRefuerzo({ institucion, estudiante, trimestre, periodoLectivo, materias, opciones }) {
  const o = { ...OPCIONES_FICHA, ...(opciones || {}) }; const bajo = enBajo(materias || []);
  const bloques = [
    texto(`Ficha de seguimiento académico y plan individual de refuerzo pedagógico${o.numero ? ' Nro. ' + o.numero : ''}`, { negrita: true, alin: 'centro' }),
    subtitulo('1. Datos del estudiante'), datosEstudiante(estudiante, trimestre),
    subtitulo('2. Asignaturas con promedio menor a 7/10 (alerta temprana)'),
    tabla(['Asignatura', 'Docente', 'Promedio', 'Escala', 'Aprendizajes o destrezas a reforzar'], bajo.map(m => [...filasMaterias([m])[0], '']), bajo.length ? 0 : 2),
    subtitulo('3. Acciones de refuerzo pedagógico (marque las que se aplicarán)'),
    lista(['Clases de refuerzo con el docente de la asignatura', 'Tutorías individuales', 'Cronograma de estudio en casa con acompañamiento de la familia', 'Actividades de recuperación y retroalimentación de los trabajos', 'Ajustes en las estrategias o instrumentos de evaluación (si corresponde)', 'Seguimiento del Departamento de Consejería Estudiantil (DECE)', 'Otra: ________________________________________']),
    subtitulo('4. Cronograma de refuerzo'),
    tabla(['Fecha', 'Actividad', 'Responsable', 'Observaciones'], [], 4),
    subtitulo('5. Seguimiento y evaluación de la mejora'),
    tabla(['Asignatura', 'Promedio inicial', 'Promedio en el siguiente informe', '¿Evidencia mejora? (Sí / No)'], bajo.map(m => [m.materia, fmtNota(m.parcial), '', '']), bajo.length ? 0 : 2)
  ];
  if (o.mencionarDece) bloques.push(texto('Si en el siguiente informe de progreso no se evidencia mejora con este plan, se derivará al estudiante a evaluación psicopedagógica y acompañamiento por parte del DECE, con conocimiento del representante legal.'));
  bloques.push(subtitulo('6. Observaciones'), texto('\n\n'));
  bloques.push(firmas([...firmantes(o), { nombre: estudiante.representante ? `${estudiante.representante.nombres || ''} ${estudiante.representante.apellidos || ''}`.trim() : '', cargo: 'Representante legal' }]));
  return { tipo: 'plan_refuerzo', titulo: `Plan de refuerzo — ${estudiante.nombre}`, numero: o.numero || '', trimestre, cabecera: cabecera(institucion, periodoLectivo, 'Plan individual de refuerzo pedagógico'), bloques, pie: BASE_NORMATIVA_RENDIMIENTO, aviso: AVISO_BORRADOR };
}

/** Acta de reunión con la familia y compromisos. */
export function construirActaCompromiso({ institucion, estudiante, trimestre, periodoLectivo, materias, opciones }) {
  const o = { ...OPCIONES_FICHA, ...(opciones || {}) }; const bajo = enBajo(materias || []);
  const bloques = [
    texto(`Acta de reunión y compromiso${o.numero ? ' Nro. ' + o.numero : ''}`, { negrita: true, alin: 'centro' }),
    campos([['Fecha', ''], ['Hora de inicio', ''], ['Lugar', ''], ['Asisten', '']], 2),
    subtitulo('1. Datos del estudiante'), datosEstudiante(estudiante, trimestre),
    subtitulo('2. Situación académica presentada'),
    tabla(['Asignatura', 'Docente', 'Promedio', 'Escala'], filasMaterias(bajo), bajo.length ? 0 : 2),
    subtitulo('3. Temas tratados'), texto('\n\n'),
    subtitulo('4. Compromisos'),
    tabla(['Responsable', 'Compromiso', 'Fecha límite'], [['Representante legal', '', ''], ['Estudiante', '', ''], ['Docentes / Tutor', '', ''], ['Institución (DECE / Inspección)', '', '']]),
    subtitulo('5. Seguimiento'), texto('Fecha de la próxima revisión: ________________'),
    firmas([...firmantes(o), { nombre: estudiante.representante ? `${estudiante.representante.nombres || ''} ${estudiante.representante.apellidos || ''}`.trim() : '', cargo: 'Representante legal' }, { nombre: mayus(estudiante.nombre), cargo: 'Estudiante' }])
  ];
  return { tipo: 'acta_compromiso', titulo: `Acta de compromiso — ${estudiante.nombre}`, numero: o.numero || '', trimestre, cabecera: cabecera(institucion, periodoLectivo, 'Acta de reunión y compromiso'), bloques, pie: BASE_NORMATIVA_RENDIMIENTO, aviso: AVISO_BORRADOR };
}

/** Ficha de control del tutor: calificaciones de TODAS las asignaturas + asistencia. */
export function construirFichaTutor({ institucion, estudiante, trimestre, periodoLectivo, materias, asistencia, periodoAsistencia, opciones }) {
  const o = { ...OPCIONES_FICHA, ...(opciones || {}) }; const ms = materias || [];
  const con = ms.filter(m => m.parcial !== null && m.parcial !== undefined && Number(m.parcial) > 0);
  const prom = con.length ? Math.round((con.reduce((a, m) => a + Number(m.parcial), 0) / con.length) * 100) / 100 : null;
  const a = asistencia || null; const f = v => (v === null || v === undefined ? '' : String(v));
  const bloques = [
    texto(`Ficha de control del docente tutor${o.numero ? ' Nro. ' + o.numero : ''}`, { negrita: true, alin: 'centro' }),
    subtitulo('1. Datos del estudiante'), datosEstudiante(estudiante, trimestre),
    subtitulo('2. Calificaciones por asignatura'),
    tabla(['Asignatura', 'Docente', 'Formativa', 'Sumativa / proyecto', 'Promedio', 'Escala'], ms.map(m => [m.materia, m.docente || '', fmtNota(m.formativo), fmtNota(m.sumativo), fmtNota(m.parcial), escala(m.parcial)])),
    campos([['Promedio general (lo calificado)', prom === null ? '—' : fmtNota(prom)], ['Asignaturas con promedio menor a 7', String(enBajo(ms).length)]], 2),
    subtitulo(`3. Asistencia${periodoAsistencia ? ' (' + periodoAsistencia + ')' : ''}`),
    campos([
      ['Días con registro', f(a?.dias)], ['Presente', f(a?.presentes)], ['Faltas injustificadas', f(a?.faltas)], ['Faltas justificadas', f(a?.justificadas)],
      ['Atrasos', f(a?.atrasos)], ['% de asistencia', a?.pctAsistencia === null || a?.pctAsistencia === undefined ? '' : `${a.pctAsistencia}%`], ['Faltas consecutivas (máx.)', f(a?.rachaMax)]
    ], 2),
    texto('Las faltas y su justificación se rigen por el reglamento del Ministerio de Educación vigente. ' + BASE_ASISTENCIA.split(', art.')[0] + '.', { menor: true }),
    subtitulo('4. Acciones realizadas por el tutor'),
    lista(['Entrevista con el estudiante', 'Comunicación o reunión con el representante legal', 'Coordinación con los docentes de las asignaturas', 'Derivación al DECE', 'Plan individual de refuerzo pedagógico entregado']),
    subtitulo('5. Observaciones y compromisos'), texto('\n\n'),
    firmas([{ nombre: o.tutorNombre || '', cargo: 'Docente tutor' }, { nombre: o.firmanteNombre || '', cargo: o.firmanteCargo || 'Inspector General' }, { nombre: estudiante.representante ? `${estudiante.representante.nombres || ''} ${estudiante.representante.apellidos || ''}`.trim() : '', cargo: 'Representante legal' }])
  ];
  return { tipo: 'ficha_tutor', titulo: `Ficha del tutor — ${estudiante.nombre}`, numero: o.numero || '', trimestre, cabecera: cabecera(institucion, periodoLectivo, 'Ficha de control de calificaciones y asistencia'), bloques, pie: BASE_NORMATIVA_RENDIMIENTO, aviso: AVISO_BORRADOR };
}

export function construirDocumento(tipo, datos) {
  const fn = { oficio_rendimiento: construirOficioRendimiento, plan_refuerzo: construirPlanRefuerzo, acta_compromiso: construirActaCompromiso, ficha_tutor: construirFichaTutor }[tipo];
  if (!fn) throw new Error('Tipo de documento no válido');
  return fn(datos);
}

// ── Edición inmutable (la pantalla las usa al escribir) ──
const mapBloque = (doc, bid, fn) => ({ ...doc, bloques: doc.bloques.map(b => (b.id === bid ? fn(b) : b)) });
export const editarTexto = (doc, bid, t) => mapBloque(doc, bid, b => ({ ...b, texto: t }));
export const editarCampo = (doc, bid, fila, valor) => mapBloque(doc, bid, b => ({ ...b, filas: b.filas.map((f, i) => (i === fila ? [f[0], valor] : f)) }));
export const editarCelda = (doc, bid, fila, col, valor) => mapBloque(doc, bid, b => ({ ...b, filas: b.filas.map((f, i) => (i === fila ? f.map((c, j) => (j === col ? valor : c)) : f)) }));
export const agregarFila = (doc, bid) => mapBloque(doc, bid, b => ({ ...b, filas: [...b.filas, b.cols.map(() => '')] }));
export const quitarFila = (doc, bid, fila) => mapBloque(doc, bid, b => ({ ...b, filas: b.filas.filter((_, i) => i !== fila) }));
export const marcarItem = (doc, bid, item, marcado) => mapBloque(doc, bid, b => ({ ...b, items: b.items.map((x, i) => (i === item ? { ...x, marcado } : x)) }));
export const editarItem = (doc, bid, item, t) => mapBloque(doc, bid, b => ({ ...b, items: b.items.map((x, i) => (i === item ? { ...x, texto: t } : x)) }));
export const editarFirma = (doc, bid, i, campo, valor) => mapBloque(doc, bid, b => ({ ...b, firmas: b.firmas.map((x, k) => (k === i ? { ...x, [campo]: valor } : x)) }));
export const editarCabecera = (doc, campo, valor) => ({ ...doc, cabecera: { ...doc.cabecera, [campo]: valor } });
/** Todo el texto del documento (para pruebas y búsquedas). */
export function textoCompleto(doc) {
  return [doc.cabecera?.institucion, doc.cabecera?.subtitulo, ...doc.bloques.flatMap(b => b.t === 'texto' || b.t === 'subtitulo' ? [b.texto] : b.t === 'campos' ? b.filas.flat() : b.t === 'tabla' ? [...b.cols, ...b.filas.flat()] : b.t === 'lista' ? b.items.map(i => i.texto) : b.t === 'firmas' ? b.firmas.flatMap(f => [f.nombre, f.cargo]) : []), doc.pie].filter(Boolean).join('\n');
}
