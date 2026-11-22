// Consejería estudiantil (DECE) — expediente de casos y oficios/informes editables. Módulo PURO (sin red ni DOM).
//
// Base: Modelo de Funcionamiento de los Departamentos de Consejería Estudiantil del Ministerio de Educación del Ecuador
// (ejes: promoción y prevención, detección, intervención, derivación y seguimiento; registro de sesión y seguimiento;
// informe de derivación). Se cita por su nombre y NO por número de artículo ni de anexo: el formato oficial del Distrito
// puede variar, por eso TODO el contenido de cada documento es editable antes de imprimir.
// Reglas del Modelo que este módulo respeta: confidencialidad de la información; el DECE no emite diagnósticos clínicos;
// la violencia y las drogas se manejan con las rutas y protocolos vigentes; el seguimiento termina cuando se cumplen los
// objetivos del plan, el sistema de apoyos se mantiene y el estudiante está en situación de protección y bienestar.
import { AVISO_BORRADOR } from './fichasRendimiento.js';

const mkOpts = lista => Object.fromEntries(lista.map(([k, l]) => [k, l]));

export const CATEGORIAS = mkOpts([
  ['violencia', 'Violencia (física, psicológica o sexual)'], ['vulneracion_derechos', 'Vulneración de derechos'], ['drogas', 'Tenencia, uso o consumo de drogas'],
  ['inasistencia', 'Inasistencia reiterativa'], ['socioeconomica', 'Vulnerabilidad socioeconómica'], ['aprendizaje', 'Dificultades de aprendizaje'],
  ['discriminacion', 'Discriminación'], ['emocional_conductual', 'Situación emocional o conductual'], ['otra', 'Otra situación'],
]);
export const ORIGENES = mkOpts([
  ['dece', 'Detección del DECE'], ['tutor', 'Docente tutor'], ['docente', 'Docente'], ['familia', 'Familia o representante'],
  ['estudiante', 'El propio estudiante'], ['autoridad', 'Autoridad de la institución'], ['comunidad', 'Miembro de la comunidad'], ['otro', 'Otro'],
]);
export const RIESGOS = mkOpts([['bajo', 'Riesgo bajo'], ['medio', 'Riesgo medio'], ['alto', 'Riesgo alto']]);
export const ESTADOS_CASO = mkOpts([
  ['deteccion', 'Detección'], ['intervencion', 'Intervención'], ['derivado', 'Derivado'], ['seguimiento', 'Seguimiento'], ['cerrado', 'Cerrado'],
]);
export const ORDEN_ESTADOS = ['deteccion', 'intervencion', 'derivado', 'seguimiento', 'cerrado'];
export const TIPOS_INTERVENCION = mkOpts([
  ['individual', 'Individual'], ['familiar', 'Familiar'], ['grupal', 'Grupal / institucional'], ['crisis', 'En crisis'], ['mediacion', 'Mediación escolar'],
  ['reinsercion', 'Acompañamiento en reinserción'], ['seguimiento', 'Seguimiento'], ['observacion_aulica', 'Observación áulica'],
]);
export const CAUSALES = mkOpts([
  ['reiteracion', 'Manifestación reiterativa de la problemática'], ['agravamiento', 'Agravamiento tras la intervención interna'],
  ['psicosomatico', 'Dificultades psicosomáticas que dilatan la intervención'], ['aprendizaje', 'Dificultades persistentes de aprendizaje'], ['otra', 'Otra causal'],
]);
export const DESTINOS = mkOpts([
  ['udai', 'UDAI (Unidad de Apoyo a la Inclusión)'], ['salud_publica', 'Servicio de salud pública'], ['junta_distrital', 'Junta Distrital de Resolución de Conflictos'],
  ['ie_especializada', 'Institución educativa especializada'], ['profesional_externo', 'Profesional o institución externa'], ['otro', 'Otro'],
]);
export const ESTADOS_DERIVACION = mkOpts([['enviada', 'Enviada'], ['en_atencion', 'En atención'], ['contrarreferencia', 'Contrarreferencia recibida'], ['cerrada', 'Cerrada']]);

export const TIPOS_DOC = {
  ficha_deteccion: { titulo: 'Ficha de detección', corto: 'Detección', icono: 'ti ti-radar-2', desc: 'Registra la situación de riesgo detectada, quién la reporta y las acciones inmediatas.' },
  plan_intervencion: { titulo: 'Plan integral de intervención', corto: 'Plan de intervención', icono: 'ti ti-clipboard-list', desc: 'Problemas, tipo de intervención, objetivos, acciones y resultados.' },
  registro_sesion: { titulo: 'Registro de sesión y seguimiento', corto: 'Registro de sesión', icono: 'ti ti-notes', desc: 'Constancia de una sesión individual, familiar o grupal con acuerdos.' },
  informe_derivacion: { titulo: 'Informe de derivación', corto: 'Derivación', icono: 'ti ti-arrow-forward-up', desc: 'Causal, destino, motivo e intervenciones previas del caso.' },
  informe_seguimiento: { titulo: 'Informe de seguimiento y cierre', corto: 'Seguimiento / cierre', icono: 'ti ti-circle-check', desc: 'Avance de los objetivos y decisión de continuar o cerrar el caso.' },
  oficio_representante: { titulo: 'Oficio al representante legal', corto: 'Oficio a la familia', icono: 'ti ti-mail', desc: 'Convocatoria o comunicación reservada al representante.' },
};

export const PIE_DECE = 'Documento reservado del Departamento de Consejería Estudiantil (DECE). Elaborado conforme al Modelo de Funcionamiento de los DECE del Ministerio de Educación del Ecuador. La información es confidencial y de uso exclusivo del equipo DECE; el DECE no emite diagnósticos clínicos.';

// ── Utilidades de fecha (local, sin zona horaria) ──
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const hoyISO = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseISO = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
export function fechaLarga(s) { const d = parseISO(s); return d ? `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}` : ''; }
export function fechaCorta(s) { const d = parseISO(s); return d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` : '—'; }
export function diasEntre(desdeISO, hastaISO = hoyISO()) { const a = parseISO(desdeISO), b = parseISO(hastaISO); return a && b ? Math.round((b - a) / 86400000) : null; }

// ── Resumen del expediente ──
/** ¿La revisión programada del caso ya venció? (solo casos abiertos con fecha de próxima revisión) */
export function revisionVencida(caso, hoy = hoyISO()) {
  return !!caso && caso.estado !== 'cerrado' && !!caso.proxima_revision && String(caso.proxima_revision).slice(0, 10) < hoy;
}
/** Indicadores del tablero a partir de las listas ya cargadas. */
export function indicadores({ casos = [], derivaciones = [], documentos = [] }, hoy = hoyISO()) {
  const abiertos = casos.filter(c => c.estado !== 'cerrado');
  const mes = hoy.slice(0, 7);
  return {
    abiertos: abiertos.length,
    riesgoAlto: abiertos.filter(c => c.nivel_riesgo === 'alto').length,
    revisionVencida: abiertos.filter(c => revisionVencida(c, hoy)).length,
    derivadosActivos: derivaciones.filter(d => d.estado !== 'cerrada').length,
    informesMes: documentos.filter(d => String(d.fecha || '').slice(0, 7) === mes).length,
  };
}
/** Línea de tiempo del expediente (más reciente primero). */
export function lineaDeTiempo({ caso, intervenciones = [], derivaciones = [], documentos = [] }) {
  const ev = [];
  if (caso) ev.push({ clave: 'c-' + caso.id, fecha: String(caso.fecha_deteccion || '').slice(0, 10), tipo: 'deteccion', titulo: 'Caso detectado', detalle: CATEGORIAS[caso.categoria] || '' });
  intervenciones.forEach(i => ev.push({ clave: 'i-' + i.id, fecha: String(i.fecha).slice(0, 10), tipo: 'intervencion', titulo: `Sesión · ${TIPOS_INTERVENCION[i.tipo] || i.tipo}`, detalle: i.resumen }));
  derivaciones.forEach(d => ev.push({ clave: 'd-' + d.id, fecha: String(d.fecha).slice(0, 10), tipo: 'derivacion', titulo: `Derivación · ${DESTINOS[d.destino] || d.destino}`, detalle: d.motivo }));
  documentos.forEach(d => ev.push({ clave: 'x-' + d.id, fecha: String(d.fecha).slice(0, 10), tipo: 'documento', titulo: d.titulo, detalle: TIPOS_DOC[d.tipo]?.corto || '' }));
  if (caso?.estado === 'cerrado' && caso.fecha_cierre) ev.push({ clave: 'z-' + caso.id, fecha: String(caso.fecha_cierre).slice(0, 10), tipo: 'cierre', titulo: 'Caso cerrado', detalle: caso.motivo_cierre || '' });
  return ev.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
}
/** Estado que corresponde tras registrar una acción (nunca retrocede un caso derivado, en seguimiento o cerrado). */
export function estadoTrasAccion(estadoActual, accion) {
  if (accion === 'sesion') return estadoActual === 'deteccion' ? 'intervencion' : estadoActual;
  if (accion === 'derivacion') return estadoActual === 'cerrado' ? estadoActual : 'derivado';
  return estadoActual;
}
/** Código legible del caso: DECE-AAAA-NNN (consecutivo dentro de las cifras ya existentes del año). */
export function siguienteCodigo(casos = [], anio = new Date().getFullYear()) {
  const re = new RegExp(`^DECE-${anio}-(\\d+)$`);
  const max = casos.reduce((m, c) => { const x = re.exec(c.codigo || ''); return x ? Math.max(m, +x[1]) : m; }, 0);
  return `DECE-${anio}-${String(max + 1).padStart(3, '0')}`;
}

// ── Constructores de bloques (mismo formato que DocumentoEditable) ──
let contador = 0;
const id = () => `dc${++contador}`;
const texto = (t, extra = {}) => ({ id: id(), t: 'texto', texto: t, ...extra });
const subtitulo = t => ({ id: id(), t: 'subtitulo', texto: t });
const campos = (filas, cols = 1) => ({ id: id(), t: 'campos', cols, filas: filas.map(([e, v]) => [e, v ?? '']) });
const tabla = (cols, filas, vacias = 0) => ({ id: id(), t: 'tabla', cols, filas: [...filas, ...Array.from({ length: vacias }, () => cols.map(() => ''))] });
const lista = items => ({ id: id(), t: 'lista', items: items.map(i => (typeof i === 'string' ? { texto: i, marcado: false } : i)) });
const firmas = f => ({ id: id(), t: 'firmas', firmas: f });

const mayus = t => String(t || '').trim().toUpperCase();
function cabecera(inst, subt) {
  const i = inst || {};
  return { institucion: mayus(i.nombre || 'Institución educativa'), amie: i.amie ? `AMIE ${i.amie}` : '', subtitulo: ['Departamento de Consejería Estudiantil (DECE)', subt].filter(Boolean).join(' · ') };
}
const datosEstudiante = e => campos([
  ['Estudiante', mayus(e.nombre)], ['Cédula', e.cedula || ''], ['Curso y paralelo', [e.curso, e.paralelo].filter(c => c && c !== '—').join(' ')], ['Representante legal', e.representante || ''],
], 2);
const firmaDece = p => ({ nombre: p?.nombre || '', cargo: 'Profesional DECE' });
const marcar = (opciones, activa) => lista(Object.entries(opciones).map(([k, l]) => ({ texto: l, marcado: k === activa })));
const doc = (inst, subt, bloques) => ({ cabecera: cabecera(inst, subt), bloques, pie: PIE_DECE, aviso: AVISO_BORRADOR });

/**
 * Arma el documento estructurado de un tipo. `datos`: { institucion, estudiante, caso, intervencion, intervenciones,
 * derivacion, profesional, fecha, ciudad }. Todo texto queda editable en la hoja.
 */
export function construirDocDece(tipo, datos) {
  const { institucion, estudiante, caso, intervencion, intervenciones = [], derivacion, profesional } = datos;
  const fecha = datos.fecha || hoyISO();
  const est = estudiante || {};
  const lugarFecha = `${datos.ciudad ? datos.ciudad + ', ' : ''}${fechaLarga(fecha)}`;
  const cat = CATEGORIAS[caso?.categoria] || '';
  const ref = caso?.codigo ? `Caso ${caso.codigo}` : '';

  if (tipo === 'ficha_deteccion') {
    return doc(institucion, 'Ficha de detección', [
      texto('FICHA DE DETECCIÓN', { alin: 'centro', negrita: true }),
      campos([['Fecha de detección', fechaCorta(caso?.fecha_deteccion || fecha)], ['Código del caso', caso?.codigo || '']], 2),
      subtitulo('1. Datos del estudiante'), datosEstudiante(est),
      subtitulo('2. Datos de la detección'),
      campos([['Situación o problemática', cat], ['Detectado por', ORIGENES[caso?.origen] || ''], ['Nivel de riesgo', RIESGOS[caso?.nivel_riesgo] || ''], ['Registrado en el portal oficial', caso?.registrado_educar ? 'Sí' : 'No']], 2),
      subtitulo('3. Descripción de la situación (hechos observados, sin juicios de valor ni diagnósticos)'),
      texto(caso?.descripcion || ''),
      subtitulo('4. Acciones inmediatas'),
      lista(['Se conversó con el estudiante en un espacio adecuado y reservado', 'Se informó al representante legal', 'Se coordinó con el docente tutor', 'Se activó la ruta o protocolo correspondiente (si es violencia o drogas)']),
      subtitulo('5. Observaciones'), texto(''),
      firmas([firmaDece(profesional), { nombre: '', cargo: 'Quien reporta' }]),
    ]);
  }

  if (tipo === 'plan_intervencion') {
    return doc(institucion, 'Plan integral de intervención', [
      texto('PLAN INTEGRAL DE INTERVENCIÓN', { alin: 'centro', negrita: true }),
      campos([['Fecha', fechaCorta(fecha)], ['Código del caso', caso?.codigo || '']], 2),
      datosEstudiante(est),
      subtitulo('1. Problemas identificados'), texto(caso?.descripcion || cat || ''),
      subtitulo('2. Valoración'),
      campos([['Individual (personal, afectiva, académica, social y familiar)', ''], ['Familiar (relaciones, percepciones y soluciones intentadas)', ''], ['Institucional (percepción docente y factores del plantel)', '']]),
      subtitulo('3. Tipo de intervención'),
      marcar(TIPOS_INTERVENCION, 'individual'),
      subtitulo('4. Objetivos a desarrollar'), texto(''),
      subtitulo('5. Acciones o estrategias a implementar'),
      tabla(['Acción o estrategia', 'Responsable', 'Fecha prevista', 'Estado'], [], 4),
      subtitulo('6. Resultados esperados e indicadores de avance'), texto(''),
      firmas([firmaDece(profesional), { nombre: est.representante || '', cargo: 'Representante legal (conformidad)' }]),
    ]);
  }

  if (tipo === 'registro_sesion') {
    const s = intervencion || {};
    return doc(institucion, 'Registro de sesión y seguimiento', [
      texto('REGISTRO DE SESIÓN Y SEGUIMIENTO', { alin: 'centro', negrita: true }),
      campos([['Fecha de la sesión', fechaCorta(s.fecha || fecha)], ['Tipo de sesión', TIPOS_INTERVENCION[s.tipo] || ''], ['Participantes', s.participantes || ''], ['Código del caso', caso?.codigo || '']], 2),
      datosEstudiante(est),
      subtitulo('1. Desarrollo de la sesión'), texto(s.resumen || ''),
      subtitulo('2. Acuerdos y compromisos'),
      s.acuerdos ? texto(s.acuerdos) : texto(''),
      tabla(['Compromiso', 'Responsable', 'Fecha límite'], [], 3),
      subtitulo('3. Próxima sesión o revisión'), campos([['Fecha prevista', s.proxima_fecha ? fechaCorta(s.proxima_fecha) : '']]),
      subtitulo('4. Observaciones'), texto(''),
      firmas([firmaDece(profesional), { nombre: '', cargo: 'Participante' }]),
    ]);
  }

  if (tipo === 'informe_derivacion') {
    const d = derivacion || {};
    return doc(institucion, 'Informe de derivación', [
      texto('INFORME DE DERIVACIÓN', { alin: 'centro', negrita: true }),
      campos([['Fecha', fechaCorta(d.fecha || fecha)], ['Código del caso', caso?.codigo || '']], 2),
      subtitulo('1. Datos del estudiante'), datosEstudiante(est),
      subtitulo('2. Destino de la derivación'),
      campos([['Institución o servicio', DESTINOS[d.destino] || ''], ['Detalle', d.destino_detalle || '']], 1),
      subtitulo('3. Causal de la derivación'),
      marcar(CAUSALES, d.causal),
      subtitulo('4. Motivo de la derivación'), texto(d.motivo || ''),
      subtitulo('5. Intervenciones realizadas en la institución'),
      tabla(['Fecha', 'Tipo', 'Resumen'], intervenciones.map(i => [fechaCorta(i.fecha), TIPOS_INTERVENCION[i.tipo] || i.tipo, i.resumen || '']), intervenciones.length ? 0 : 3),
      subtitulo('6. Coordinación previa'),
      lista(['Representante legal informado y de acuerdo', 'Docente tutor y equipo docente informados', 'Autoridad de la institución informada']),
      subtitulo('7. Observaciones'), texto('El presente informe se remite con carácter reservado. El DECE no emite diagnósticos clínicos.'),
      firmas([firmaDece(profesional), { nombre: '', cargo: 'Rector/a o autoridad de la institución' }]),
    ]);
  }

  if (tipo === 'informe_seguimiento') {
    return doc(institucion, 'Informe de seguimiento y cierre', [
      texto('INFORME DE SEGUIMIENTO Y CIERRE', { alin: 'centro', negrita: true }),
      campos([['Fecha', fechaCorta(fecha)], ['Código del caso', caso?.codigo || ''], ['Situación atendida', cat], ['Estado actual', ESTADOS_CASO[caso?.estado] || '']], 2),
      datosEstudiante(est),
      subtitulo('1. Acciones de seguimiento realizadas'),
      tabla(['Fecha', 'Tipo', 'Resultado'], intervenciones.map(i => [fechaCorta(i.fecha), TIPOS_INTERVENCION[i.tipo] || i.tipo, i.resumen || '']), intervenciones.length ? 0 : 3),
      subtitulo('2. Avance de los objetivos del plan de intervención'), texto(''),
      subtitulo('3. Criterios para finalizar el seguimiento'),
      lista(['Los objetivos propuestos en el plan de intervención se cumplieron', 'El sistema de apoyos que requiere el estudiante se mantiene', 'El estudiante se encuentra en situación de protección y bienestar']),
      subtitulo('4. Decisión'),
      lista([{ texto: 'Continuar el seguimiento', marcado: caso?.estado !== 'cerrado' }, { texto: 'Cerrar el caso', marcado: caso?.estado === 'cerrado' }]),
      campos([['Motivo del cierre o próxima revisión', caso?.motivo_cierre || (caso?.proxima_revision ? fechaCorta(caso.proxima_revision) : '')]]),
      firmas([firmaDece(profesional), { nombre: '', cargo: 'Rector/a o autoridad de la institución' }]),
    ]);
  }

  if (tipo === 'oficio_representante') {
    const rep = est.representante || '';
    return doc(institucion, 'Oficio', [
      texto('Oficio N.° DECE-____-' + fecha.slice(0, 4), { negrita: true }),
      texto(lugarFecha, { alin: 'derecha' }),
      texto(`Señor(a)\n${rep || '____________________'}\nREPRESENTANTE LEGAL DEL ESTUDIANTE ${mayus(est.nombre)}`),
      texto('Presente.-'),
      texto('Asunto: Convocatoria a reunión con el Departamento de Consejería Estudiantil', { negrita: true }),
      texto('De mi consideración:'),
      texto(`Reciba un cordial saludo. Por medio del presente, el Departamento de Consejería Estudiantil (DECE) de la institución le convoca a una reunión reservada, con el fin de conversar sobre el acompañamiento de ${est.nombre ? 'su representado/a ' + est.nombre : 'su representado/a'}${est.curso && est.curso !== '—' ? ', del ' + [est.curso, est.paralelo].filter(Boolean).join(' ') : ''}, y acordar de manera conjunta las acciones de apoyo que correspondan.`),
      campos([['Día y fecha', ''], ['Hora', ''], ['Lugar', 'Departamento de Consejería Estudiantil']], 1),
      texto('Su participación es muy importante: la corresponsabilidad entre la familia y la institución favorece el bienestar y el desarrollo integral del estudiante. En caso de no poder asistir, le solicitamos comunicarse con el DECE para fijar una nueva fecha.'),
      texto('Atentamente,'),
      firmas([firmaDece(profesional), { nombre: '', cargo: 'Recibí conforme (representante legal)' }]),
    ]);
  }

  throw new Error('Tipo de documento DECE no válido');
}

/** Título por defecto del documento (se puede cambiar al guardar). */
export function tituloDoc(tipo, estudiante, fecha = hoyISO()) {
  return `${TIPOS_DOC[tipo]?.corto || 'Documento'} · ${estudiante?.nombre || 'Estudiante'} · ${fechaCorta(fecha)}`;
}
