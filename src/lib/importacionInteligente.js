// Carga masiva INTELIGENTE de docentes y estudiantes. Módulo PURO (solo importa el validador de cédula).
// Recibe una hoja como matriz (filas × columnas) con las columnas en cualquier orden y con encabezados escritos
// de formas distintas, y devuelve: dónde está el encabezado, a qué campo del sistema corresponde cada columna,
// y cada fila ya convertida al formato de las tablas (lo que falta queda vacío y se completa después).

import { validarCedulaEC } from './cedula.js';

// ───────────────────────── utilidades de texto ─────────────────────────
export const norm = t =>
  String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const vacio = v => v === null || v === undefined || String(v).trim() === '';
const limpiar = v => String(v ?? '').replace(/\s+/g, ' ').trim();
const digitos = v => String(v ?? '').replace(/\D/g, '');

function distancia(a, b) {            // Levenshtein
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
const parecido = (a, b) => 1 - distancia(a, b) / Math.max(a.length, b.length, 1);

// ───────────────────────── esquemas de campos ─────────────────────────
// `sin` = formas habituales de llamar a la columna (ya sin tildes ni signos). `rep` = campo del representante.
const F = (key, label, sin, extra = {}) => ({ key, label, sin: sin.map(norm), ...extra });

const COMUNES = [
  F('cedula', 'Cédula', ['cedula', 'cedula de identidad', 'ci', 'c i', 'documento', 'documento de identidad', 'identificacion', 'numero de cedula', 'nro cedula', 'no cedula', 'num cedula', 'n cedula', 'dni', 'cedula ruc', 'cedula pasaporte', 'cc']),
  F('nombres', 'Nombres', ['nombres', 'nombre', 'names', 'nombres del docente', 'nombres del estudiante', 'nombres del alumno'], { ambiguo: ['nombre'] }),
  F('apellidos', 'Apellidos', ['apellidos', 'apellido', 'surname', 'apellidos del docente', 'apellidos del estudiante', 'apellidos del alumno']),
  F('nombre_completo', 'Apellidos y nombres (juntos)', ['apellidos y nombres', 'apellidos nombres', 'apellido y nombre', 'nombres y apellidos', 'nombres apellidos', 'nombre completo', 'nombres completos', 'apellidos y nombres completos', 'nomina', 'estudiante', 'alumno', 'alumna', 'docente', 'nombre del docente', 'nombre del estudiante', 'nombre del alumno', 'nombre y apellido']),
  F('apellido1', 'Primer apellido', ['primer apellido', 'apellido paterno', 'apellido1', '1er apellido', 'ap paterno', 'paterno', 'apellido 1']),
  F('apellido2', 'Segundo apellido', ['segundo apellido', 'apellido materno', 'apellido2', '2do apellido', 'materno', 'ap materno', 'apellido 2']),
  F('nombre1', 'Primer nombre', ['primer nombre', 'nombre1', '1er nombre', 'nombre 1']),
  F('nombre2', 'Segundo nombre', ['segundo nombre', 'nombre2', '2do nombre', 'nombre 2']),
  F('email', 'Correo electrónico', ['email', 'correo', 'correo electronico', 'e mail', 'mail', 'correo institucional', 'correo personal', 'email institucional']),
  F('telefono', 'Teléfono / celular', ['telefono', 'celular', 'movil', 'cel', 'telf', 'tel', 'telefono celular', 'numero de celular', 'whatsapp', 'contacto', 'telefono convencional', 'convencional']),
  F('fecha_nacimiento', 'Fecha de nacimiento', ['fecha de nacimiento', 'fecha nacimiento', 'nacimiento', 'f nacimiento', 'fecha nac', 'fec nac', 'fecha de nac']),
  F('genero', 'Género', ['genero', 'sexo', 'sexo genero']),
  F('direccion', 'Dirección', ['direccion', 'domicilio', 'direccion domiciliaria', 'residencia', 'direccion de domicilio']),
  F('etnia', 'Etnia', ['etnia', 'autoidentificacion etnica', 'autoidentificacion', 'grupo etnico', 'pueblo']),
  F('discapacidad', 'Discapacidad', ['discapacidad', 'tiene discapacidad', 'tipo de discapacidad']),
  F('provincia', 'Provincia', ['provincia']),
  F('canton', 'Cantón', ['canton', 'ciudad']),
  F('observaciones', 'Observaciones', ['observaciones', 'observacion', 'notas', 'comentarios', 'detalle', 'novedades'])
];

const SOLO_DOCENTES = [
  F('titulo', 'Título', ['titulo', 'titulo profesional', 'titulo academico', 'profesion', 'titulo obtenido', 'formacion']),
  F('cargo', 'Cargo / función', ['cargo', 'funcion', 'funcion docente', 'puesto', 'cargo que desempena', 'denominacion del puesto', 'denominacion']),
  F('situacion', 'Situación laboral', ['situacion laboral', 'situacion', 'tipo de contrato', 'tipo de nombramiento', 'relacion laboral', 'tipo de relacion laboral', 'estado laboral', 'contrato', 'nombramiento']),
  F('especialidad', 'Especialidad', ['especialidad', 'especializacion', 'asignatura', 'materia que dicta', 'asignaturas']),
  F('area', 'Área', ['area', 'area de conocimiento', 'area academica', 'departamento']),
  F('fecha_ingreso', 'Fecha de ingreso', ['fecha de ingreso', 'fecha ingreso', 'ingreso', 'fecha de ingreso a la institucion', 'fecha de inicio', 'fecha inicio labores', 'fecha de incorporacion'])
];

const SOLO_ESTUDIANTES = [
  F('curso', 'Curso / grado', ['curso', 'grado', 'ano', 'anio', 'nivel', 'ano de educacion basica', 'grado curso', 'ano lectivo curso', 'curso grado']),
  F('paralelo', 'Paralelo', ['paralelo', 'seccion', 'par']),
  F('curso_paralelo', 'Curso y paralelo (juntos)', ['curso paralelo', 'grado paralelo', 'curso y paralelo', 'grado y paralelo', 'curso seccion'])
];

// Campos del representante: se reconocen porque el encabezado trae "representante", "padre", "madre", "apoderado"…
const REP = [
  F('rep_cedula', 'Representante · cédula', ['cedula', 'cedula de identidad', 'ci', 'documento', 'identificacion', 'numero de cedula']),
  F('rep_nombres', 'Representante · nombres', ['nombres', 'nombre']),
  F('rep_apellidos', 'Representante · apellidos', ['apellidos', 'apellido']),
  F('rep_nombre_completo', 'Representante · apellidos y nombres', ['nombre completo', 'apellidos y nombres', 'nombres y apellidos', 'nombres completos', 'nombre y apellido']),
  F('rep_telefono', 'Representante · teléfono', ['telefono', 'celular', 'movil', 'cel', 'telf', 'whatsapp', 'contacto']),
  F('rep_email', 'Representante · correo', ['email', 'correo', 'correo electronico', 'mail']),
  F('rep_parentesco', 'Representante · parentesco', ['parentesco', 'relacion', 'vinculo', 'relacion con el estudiante', 'tipo de representante', 'tipo'])
];
const PALABRAS_REP = ['representante', 'rep', 'apoderado', 'responsable', 'padre', 'madre', 'tutor', 'familiar', 'acudiente', 'tutor legal'];

export const ESQUEMAS = {
  docentes: { tipo: 'docentes', campos: [...COMUNES, ...SOLO_DOCENTES].filter(c => !['curso'].includes(c.key)) },
  estudiantes: { tipo: 'estudiantes', campos: [...COMUNES, ...SOLO_ESTUDIANTES, ...REP] }
};
export const etiquetaCampo = (tipo, key) => ESQUEMAS[tipo].campos.find(c => c.key === key)?.label || key;

// ───────────────────────── fechas, cédulas, teléfonos… ─────────────────────────
export function parseFecha(valor) {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) return valor.toISOString().slice(0, 10);
  const s = limpiar(valor);
  if (!s) return null;
  const valida = (y, m, d) => {
    y = Number(y); m = Number(m); d = Number(d);
    if (y < 1900 || y > new Date().getFullYear() + 1 || m < 1 || m > 12 || d < 1 || d > 31) return null;
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return valida(m[1], m[2], m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) {
    let [, a, b, y] = m;
    if (y.length === 2) y = (Number(y) > (new Date().getFullYear() % 100) + 1 ? '19' : '20') + y;
    // Ecuador escribe día/mes/año; solo si el "mes" no puede ser mes y el "día" sí, se invierte
    if (Number(b) > 12 && Number(a) <= 12) return valida(y, a, b);
    return valida(y, b, a);
  }
  const MESES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
  m = norm(s).match(/^(\d{1,2}) (?:de )?([a-z]+) (?:de |del )?(\d{4})$/);
  if (m && MESES[m[2]]) return valida(m[3], MESES[m[2]], m[1]);
  if (/^\d{5}$/.test(s)) {             // número de serie de Excel
    const dt = new Date(Math.round((Number(s) - 25569) * 86400000));
    return valida(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }
  return null;
}

export function normalizarCedula(valor) {
  const raw = limpiar(valor);
  if (!raw) return { valor: null };
  let d = digitos(raw);
  if (/[a-z]/i.test(raw.replace(/\bec\b/i, '')) && d.length !== 10 && d.length !== 9) return { valor: null, aviso: `cédula no válida (${raw})`, descartado: raw };
  if (d.length === 9) d = '0' + d;           // Excel suele quitar el cero inicial
  if (d.length === 10 && validarCedulaEC(d)) return { valor: d };
  return { valor: null, aviso: `cédula no válida (${raw})`, descartado: raw };
}

export function normalizarTelefono(valor) {
  const raw = limpiar(valor);
  if (!raw) return { valor: null };
  const primero = raw.split(/[\/,;]| y /i)[0];
  let d = digitos(primero);
  if (d.startsWith('593') && d.length >= 11) d = '0' + d.slice(3);
  if (d.length === 9 && d.startsWith('9')) d = '0' + d;
  if (d.length >= 7 && d.length <= 10) return { valor: d };
  return { valor: null, aviso: `teléfono no válido (${raw})` };
}

export function normalizarEmail(valor) {
  const raw = limpiar(valor).toLowerCase();
  if (!raw) return { valor: null };
  const candidatos = raw.split(/[\s,;]+/).filter(Boolean);
  const ok = candidatos.find(c => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c));
  return ok ? { valor: ok } : { valor: null, aviso: `correo no válido (${raw})` };
}

export function normalizarGenero(valor) {
  const t = norm(valor);
  if (!t) return { valor: null };
  if (/^(m|masculino|hombre|varon|h|male)$/.test(t)) return { valor: 'Masculino' };
  if (/^(f|femenino|mujer|female)$/.test(t)) return { valor: 'Femenino' };
  return { valor: null, aviso: `género no reconocido (${limpiar(valor)})` };
}

export function normalizarSituacion(valor) {
  const t = norm(valor);
  if (!t) return { valor: null };
  if (/nombram/.test(t)) return { valor: 'NOMBRAMIENTO' };
  if (/ocasion/.test(t)) return { valor: 'OCASIONAL' };
  if (/reemplaz|suplen/.test(t)) return { valor: 'REEMPLAZO' };
  if (/contrat/.test(t)) return { valor: 'CONTRATO' };
  return { valor: null, aviso: `situación laboral no reconocida (${limpiar(valor)})` };
}

export function normalizarParentescoImport(valor) {
  const t = norm(valor);
  if (!t) return null;
  if (/^(padre|papa)/.test(t)) return 'padre';
  if (/^(madre|mama)/.test(t)) return 'madre';
  return 'tutor';
}

// Separa "PÉREZ GÓMEZ JUAN CARLOS" (o "Juan Carlos Pérez Gómez") en apellidos y nombres.
// En las nóminas del Ecuador lo habitual es 2 apellidos + 1 o 2 nombres. Marca `dudoso` cuando hay que revisar.
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'san', 'santa', 'y', 'da', 'di', 'van', 'von']);
export function separarNombreCompleto(texto, apellidosPrimero = true) {
  const t = limpiar(texto);
  if (!t) return { nombres: '', apellidos: '', dudoso: false };
  const crudos = t.split(' ');
  const tokens = [];                    // une partículas con la palabra siguiente ("de la Cruz" = 1 palabra)
  for (let i = 0; i < crudos.length; i++) {
    let w = crudos[i], ultima = crudos[i];
    while (PARTICULAS.has(norm(ultima)) && i < crudos.length - 1) { i++; ultima = crudos[i]; w += ' ' + ultima; }
    tokens.push(w);
  }
  if (tokens.length === 1) return { nombres: apellidosPrimero ? '' : tokens[0], apellidos: apellidosPrimero ? tokens[0] : '', dudoso: true };
  const nAp = tokens.length === 2 ? 1 : 2;           // 2 palabras: 1 apellido + 1 nombre · 3 o más: 2 apellidos
  const dudoso = tokens.length === 3 || tokens.length > 4;
  const primeros = tokens.slice(0, apellidosPrimero ? nAp : tokens.length - nAp);
  const ultimos = tokens.slice(apellidosPrimero ? nAp : tokens.length - nAp);
  return apellidosPrimero
    ? { apellidos: primeros.join(' '), nombres: ultimos.join(' '), dudoso }
    : { nombres: primeros.join(' '), apellidos: ultimos.join(' '), dudoso };
}

// ───────────────────────── detección por contenido ─────────────────────────
const proporcion = (vals, fn) => (vals.length ? vals.filter(fn).length / vals.length : 0);
const CURSO_RE = /\b(\d{1,2}\s*(ro|er|do|to|vo|mo|no|°|º)?|primero|segundo|tercero|cuarto|quinto|sexto|septimo|octavo|noveno|decimo)\b.*(egb|basica|bachillerato|bgu|ano|grado|curso)|inicial|preparatoria|bachillerato|^\d{1,2}\s*(ro|er|do|to|vo|mo|no|°|º)\b/;

function puntajeContenido(valores, campo, tipo) {
  const v = valores.map(limpiar).filter(Boolean).slice(0, 80);
  if (v.length < 2) return 0;
  const base = campo.replace(/^rep_/, '');
  switch (base) {
    case 'cedula': return proporcion(v, x => { const d = digitos(x); return (d.length === 10 || d.length === 9) && validarCedulaEC(d.length === 9 ? '0' + d : d); }) ;
    case 'email': return proporcion(v, x => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}/.test(x));
    case 'telefono': return proporcion(v, x => { const d = digitos(x); return (d.length === 10 && d.startsWith('09')) || (d.length === 9 && d.startsWith('9')) || (d.length >= 9 && d.length <= 10 && /^0[2-7]/.test(d)); });
    case 'fecha_nacimiento':
    case 'fecha_ingreso': return proporcion(v, x => !/^\d{1,3}$/.test(x) && parseFecha(x) !== null);
    case 'genero': return proporcion(v, x => /^(m|f|h|masculino|femenino|hombre|mujer|varon)$/.test(norm(x)));
    case 'paralelo': return tipo === 'estudiantes' ? proporcion(v, x => /^[a-z]$/i.test(x)) : 0;
    case 'curso': return tipo === 'estudiantes' ? proporcion(v, x => CURSO_RE.test(norm(x))) : 0;
    default: return 0;
  }
}
const CAMPOS_POR_CONTENIDO = ['cedula', 'email', 'telefono', 'fecha_nacimiento', 'genero', 'paralelo', 'curso'];

// ───────────────────────── detección por encabezado ─────────────────────────
function puntajeSinonimos(h, campo) {
  let mejor = 0;
  for (const s of campo.sin) {
    let p = 0;
    if (h === s) p = 1;
    else if ((` ${h} `).includes(` ${s} `)) p = Math.max(0.78, 0.9 - 0.04 * Math.max(0, h.split(' ').length - s.split(' ').length));
    else if (s.length >= 5 && h.length >= 4) { const r = parecido(h, s); if (r >= 0.84) p = 0.72 + (r - 0.84) * 0.5; }
    if (p > mejor) mejor = p;
  }
  return mejor;
}

/** Mejor campo para un encabezado. Devuelve { campo, puntaje, rep } (campo null si nada convence). */
export function campoPorEncabezado(encabezado, tipo) {
  const h0 = norm(encabezado);
  if (!h0 || /^(n|no|nro|numero|num|item|orden)$/.test(h0) || /^\d+$/.test(h0)) return { campo: null, puntaje: 0, rep: false };
  const tokens = h0.split(' ');
  const rep = tipo === 'estudiantes' && PALABRAS_REP.some(p => (` ${h0} `).includes(` ${p} `));
  // quita las palabras que indican "representante" para comparar lo que queda ("cedula del representante" -> "cedula")
  const h = rep ? norm(tokens.filter(t => !PALABRAS_REP.includes(t) && !['del', 'de', 'la', 'el', 'legal'].includes(t)).join(' ')) || h0 : h0;
  // "Parentesco" siempre es del representante aunque el encabezado no lo diga
  const candidatos = ESQUEMAS[tipo].campos.filter(c => (rep ? c.key.startsWith('rep_') : (!c.key.startsWith('rep_') || c.key === 'rep_parentesco')));
  let mejor = { campo: null, puntaje: 0, rep };
  for (const c of candidatos) {
    let p = puntajeSinonimos(rep && c.key.startsWith('rep_') ? h : h0, c);
    if (/parentesco|vinculo/.test(h0) && c.key === 'rep_parentesco') p = Math.max(p, 0.95);
    if (p > mejor.puntaje) mejor = { campo: c.key, puntaje: p, rep };
  }
  // "Padre" / "Madre" / "Representante" a secas = la columna con el nombre del representante
  if (rep && mejor.puntaje < 0.6 && ['padre', 'madre', 'representante', 'tutor', 'apoderado', 'responsable'].includes(h0)) mejor = { campo: 'rep_nombre_completo', puntaje: 0.8, rep };
  return mejor;
}

// ───────────────────────── análisis de la hoja ─────────────────────────
const celdaTexto = c => (c instanceof Date ? c.toISOString().slice(0, 10) : limpiar(c));

/** Busca la fila de encabezados (las nóminas oficiales traen títulos encima). Devuelve índice o -1 si no hay. */
export function detectarFilaEncabezado(matriz, tipo, maxFilas = 25) {
  let mejor = { i: -1, p: 0 };
  for (let i = 0; i < Math.min(matriz.length, maxFilas); i++) {
    const fila = matriz[i] || [];
    const llenas = fila.filter(c => !vacio(c));
    if (llenas.length < 2) continue;
    let p = 0, reconocidas = 0;
    const usados = new Set();
    for (const c of fila) {
      if (vacio(c) || typeof c === 'number') continue;
      const r = campoPorEncabezado(celdaTexto(c), tipo);
      if (r.campo && r.puntaje >= 0.75 && !usados.has(r.campo)) { p += r.puntaje; reconocidas++; usados.add(r.campo); }
    }
    if (reconocidas >= 2 && p > mejor.p + 0.01) mejor = { i, p };
  }
  return mejor.i;
}

/**
 * Analiza una hoja. matriz = array de filas (cada fila array de celdas).
 * Devuelve { filaEncabezado, encabezados, filas, mapeo: [{indice, encabezado, campo, confianza, origen, ejemplos}], orden, avisos }.
 */
export function analizarHoja(matriz, tipo) {
  const limpia = (matriz || []).map(f => (f || []).map(c => (c instanceof Date ? c : (typeof c === 'string' ? c.trim() : c))));
  const avisos = [];
  const iEnc = detectarFilaEncabezado(limpia, tipo);
  const ancho = Math.max(0, ...limpia.map(f => f.length));
  let encabezados, datos;
  if (iEnc >= 0) {
    encabezados = Array.from({ length: ancho }, (_, j) => celdaTexto(limpia[iEnc][j]));
    datos = limpia.slice(iEnc + 1);
  } else {
    const primera = limpia.findIndex(f => f.some(c => !vacio(c)));
    encabezados = Array.from({ length: ancho }, (_, j) => `Columna ${nombreColumna(j)}`);
    datos = primera >= 0 ? limpia.slice(primera) : [];
    avisos.push('No encontré una fila de encabezados: identifiqué las columnas por su contenido. Revisa la asignación.');
  }
  datos = datos.filter(f => f.some(c => !vacio(c)));
  datos = datos.map(f => Array.from({ length: ancho }, (_, j) => f[j] ?? ''));

  const columnas = encabezados.map((enc, j) => {
    const vals = datos.map(f => f[j]);
    const porEnc = iEnc >= 0 ? campoPorEncabezado(enc, tipo) : { campo: null, puntaje: 0, rep: false };
    let porCont = { campo: null, puntaje: 0 };
    for (const base of CAMPOS_POR_CONTENIDO) {
      const campo = porEnc.rep ? `rep_${base}` : base;
      if (!ESQUEMAS[tipo].campos.some(c => c.key === campo)) continue;
      const p = puntajeContenido(vals.map(celdaTexto), campo, tipo);
      if (p > porCont.puntaje) porCont = { campo, puntaje: p };
    }
    return { indice: j, encabezado: enc, vals, porEnc, porCont, ejemplos: vals.map(celdaTexto).filter(Boolean).slice(0, 3) };
  });

  // propuesta de cada columna: el encabezado manda; el contenido ayuda cuando el encabezado no dice nada o es dudoso
  const propuestas = columnas.map(c => {
    const e = c.porEnc, k = c.porCont;
    let campo = null, conf = 0, origen = null;
    if (e.campo && e.puntaje >= 0.78) { campo = e.campo; conf = e.puntaje; origen = 'encabezado'; }
    else if (k.campo && k.puntaje >= 0.7) { campo = k.campo; conf = Math.min(0.9, k.puntaje * 0.9); origen = 'contenido'; }
    else if (e.campo && e.puntaje >= 0.6) { campo = e.campo; conf = e.puntaje; origen = 'encabezado'; }
    if (campo && origen === 'encabezado' && k.campo === campo && k.puntaje >= 0.7) conf = Math.min(1, conf + 0.08);
    return { ...c, campo, confianza: conf, origen };
  });

  // un campo = una columna: gana la de mayor confianza; si hay dos "cédula/teléfono/correo" por contenido, la segunda es del representante
  const asignado = new Map();
  [...propuestas].sort((a, b) => b.confianza - a.confianza || a.indice - b.indice).forEach(p => {
    if (!p.campo) return;
    let campo = p.campo;
    if (asignado.has(campo) && tipo === 'estudiantes' && p.origen === 'contenido' && !campo.startsWith('rep_') && !asignado.has(`rep_${campo}`) && ESQUEMAS.estudiantes.campos.some(c => c.key === `rep_${campo}`)) {
      campo = `rep_${campo}`;
    }
    if (asignado.has(campo)) { p.campo = null; p.duplicado = true; return; }
    p.campo = campo; asignado.set(campo, p.indice);
  });

  // "Nombre" a secas con valores largos y sin columna de apellidos = nombre completo
  let orden = 'apellidos';
  const colNombres = propuestas.find(p => p.campo === 'nombres'), colApellidos = propuestas.find(p => p.campo === 'apellidos' || p.campo === 'apellido1');
  if (colNombres && !colApellidos && norm(colNombres.encabezado) === 'nombre') {
    const medias = colNombres.vals.map(celdaTexto).filter(Boolean).map(v => v.split(' ').length);
    if (medias.length && medias.reduce((a, b) => a + b, 0) / medias.length >= 2.3) { colNombres.campo = 'nombre_completo'; orden = 'nombres'; }
  }
  const colRepNombres = propuestas.find(p => p.campo === 'rep_nombres');
  if (colRepNombres && !propuestas.some(p => p.campo === 'rep_apellidos')) {
    const largos = colRepNombres.vals.map(celdaTexto).filter(Boolean).map(v => v.split(' ').length);
    if (largos.length && largos.reduce((a, b) => a + b, 0) / largos.length >= 2.3) colRepNombres.campo = 'rep_nombre_completo';
  }
  const colCompleto = propuestas.find(p => p.campo === 'nombre_completo');
  if (colCompleto && /^nombres? (y|apellidos?)|^nombre completo|^nombres completos/.test(norm(colCompleto.encabezado))) orden = 'nombres';
  if (colCompleto && /^apellido/.test(norm(colCompleto.encabezado))) orden = 'apellidos';

  const mapeo = propuestas.map(p => ({
    indice: p.indice, encabezado: p.encabezado, campo: p.campo, confianza: p.campo ? Number(p.confianza.toFixed(2)) : 0,
    origen: p.campo ? p.origen : null, ejemplos: p.ejemplos, duplicado: !!p.duplicado
  }));
  return { filaEncabezado: iEnc, encabezados, filas: datos, mapeo, orden, avisos };
}

function nombreColumna(j) { let s = ''; j++; while (j > 0) { const r = (j - 1) % 26; s = String.fromCharCode(65 + r) + s; j = Math.floor((j - 1) / 26); } return s; }

// ───────────────────────── convertir filas con el mapeo elegido ─────────────────────────
const CAMPOS_DOCENTE = ['cedula', 'nombres', 'apellidos', 'email', 'telefono', 'titulo', 'cargo', 'situacion', 'especialidad', 'area', 'fecha_ingreso', 'fecha_nacimiento', 'genero', 'direccion', 'etnia', 'discapacidad', 'provincia', 'canton', 'observaciones'];
const CAMPOS_ESTUDIANTE = ['cedula', 'nombres', 'apellidos', 'fecha_nacimiento', 'genero', 'direccion', 'etnia', 'discapacidad', 'telefono', 'email', 'provincia', 'canton', 'observaciones'];

/**
 * mapeo: [{indice, campo}] (el que dejó elegido la persona). orden: 'apellidos' | 'nombres' para el nombre completo.
 * Devuelve [{ fila (nº en el archivo), datos, representante, cursoTxt, paraleloTxt, avisos, error }]
 * Lo que falta o no es válido queda vacío (null) y se avisa; solo se omite una fila si no tiene nombre o apellido.
 */
export function convertirFilas(filas, mapeo, tipo, { orden = 'apellidos', filaInicial = 2 } = {}) {
  const porCampo = {};
  mapeo.forEach(m => { if (m.campo) porCampo[m.campo] = m.indice; });
  const get = (fila, campo) => (campo in porCampo ? fila[porCampo[campo]] : '');
  const permitidos = tipo === 'docentes' ? CAMPOS_DOCENTE : CAMPOS_ESTUDIANTE;

  return filas.map((fila, i) => {
    const avisos = [];
    const datos = {};
    let descartadoCedula = null;
    const aplicar = (campo, fn) => {
      const raw = get(fila, campo);
      if (vacio(raw)) { datos[campo] = null; return; }
      const r = fn(raw);
      datos[campo] = r.valor ?? null;
      if (r.aviso) avisos.push(r.aviso);
      if (r.descartado && campo === 'cedula') descartadoCedula = r.descartado;
    };
    const texto = campo => { const raw = get(fila, campo); datos[campo] = vacio(raw) ? null : limpiar(celdaTexto(raw)); };

    aplicar('cedula', normalizarCedula);
    aplicar('email', normalizarEmail);
    aplicar('telefono', normalizarTelefono);
    aplicar('genero', normalizarGenero);
    aplicar('fecha_nacimiento', v => { const f = parseFecha(v); return f ? { valor: f } : { valor: null, aviso: `fecha de nacimiento no válida (${limpiar(celdaTexto(v))})` }; });
    if (tipo === 'docentes') {
      aplicar('fecha_ingreso', v => { const f = parseFecha(v); return f ? { valor: f } : { valor: null, aviso: `fecha de ingreso no válida (${limpiar(celdaTexto(v))})` }; });
      aplicar('situacion', normalizarSituacion);
      ['titulo', 'cargo', 'especialidad', 'area'].forEach(texto);
    }
    ['direccion', 'etnia', 'discapacidad', 'provincia', 'canton', 'observaciones'].forEach(texto);

    // nombres y apellidos
    let nombres = '', apellidos = '';
    const completo = limpiar(celdaTexto(get(fila, 'nombre_completo')));
    if (completo) {
      const s = separarNombreCompleto(completo, orden === 'apellidos');
      nombres = s.nombres; apellidos = s.apellidos;
      if (s.dudoso) avisos.push('nombre separado automáticamente: revisa apellidos y nombres');
    }
    const ap1 = limpiar(celdaTexto(get(fila, 'apellido1'))), ap2 = limpiar(celdaTexto(get(fila, 'apellido2')));
    const n1 = limpiar(celdaTexto(get(fila, 'nombre1'))), n2 = limpiar(celdaTexto(get(fila, 'nombre2')));
    if (!apellidos) apellidos = limpiar(celdaTexto(get(fila, 'apellidos'))) || [ap1, ap2].filter(Boolean).join(' ');
    if (!nombres) nombres = limpiar(celdaTexto(get(fila, 'nombres'))) || [n1, n2].filter(Boolean).join(' ');
    datos.nombres = nombres; datos.apellidos = apellidos;

    if (descartadoCedula) {            // no se pierde: queda anotada para corregirla después
      const nota = `Cédula original no válida en la carga: ${descartadoCedula}`;
      datos.observaciones = datos.observaciones ? `${datos.observaciones} · ${nota}` : nota;
    }

    // representante (solo estudiantes)
    let representante = null, cursoTxt = '', paraleloTxt = '';
    if (tipo === 'estudiantes') {
      cursoTxt = limpiar(celdaTexto(get(fila, 'curso')));
      paraleloTxt = limpiar(celdaTexto(get(fila, 'paralelo')));
      const cp = limpiar(celdaTexto(get(fila, 'curso_paralelo')));
      if (cp && !cursoTxt) cursoTxt = cp;
      let rn = limpiar(celdaTexto(get(fila, 'rep_nombres'))), ra = limpiar(celdaTexto(get(fila, 'rep_apellidos')));
      const rc = limpiar(celdaTexto(get(fila, 'rep_nombre_completo')));
      if (rc && !rn && !ra) { const s = separarNombreCompleto(rc, true); rn = s.nombres; ra = s.apellidos; if (s.dudoso) avisos.push('representante: nombre separado automáticamente, revísalo'); }
      const rCed = normalizarCedula(get(fila, 'rep_cedula'));
      const rTel = normalizarTelefono(get(fila, 'rep_telefono'));
      const rMail = normalizarEmail(get(fila, 'rep_email'));
      [rCed, rTel, rMail].forEach(r => { if (r.aviso) avisos.push('representante: ' + r.aviso); });
      if (rn || ra || rCed.valor) {
        representante = {
          nombres: rn, apellidos: ra, cedula: rCed.valor, telefono: rTel.valor, email: rMail.valor,
          rol_representante: normalizarParentescoImport(get(fila, 'rep_parentesco')) || 'tutor'
        };
        if (!rCed.valor) avisos.push('representante sin cédula válida: no se creó (agrégalo después desde la ficha del estudiante)');
        else if (!rn || !ra) avisos.push('representante sin nombre o apellido completo: no se creó');
      }
    }

    const limpio = {};
    permitidos.forEach(k => { limpio[k] = datos[k] === undefined ? null : datos[k]; });
    const error = !nombres && !apellidos ? 'falta el nombre y el apellido' : !nombres ? 'falta el nombre' : !apellidos ? 'falta el apellido' : null;
    return { fila: filaInicial + i, datos: limpio, representante: representante && representante.cedula && representante.nombres && representante.apellidos ? representante : null, cursoTxt, paraleloTxt, avisos, error };
  });
}

// ───────────────────────── duplicados ─────────────────────────
export const claveNombre = (apellidos, nombres) => norm(`${apellidos || ''} ${nombres || ''}`).split(' ').filter(Boolean).sort().join(' ');

/**
 * existentes: [{ id, cedula, apellidos, nombres }]. Marca en cada fila:
 *   duplicado: null | { tipo: 'existente'|'archivo', por: 'cedula'|'nombre', id? }
 * Reglas: misma cédula = misma persona. Sin cédula en la fila: mismo nombre (en cualquier orden) = posible duplicado.
 */
export function marcarDuplicados(registros, existentes) {
  const porCedula = new Map(), porNombre = new Map();
  (existentes || []).forEach(e => {
    if (e.cedula) porCedula.set(digitos(e.cedula), e);
    const k = claveNombre(e.apellidos, e.nombres);
    if (k) (porNombre.get(k) || porNombre.set(k, []).get(k)).push(e);
  });
  const cedulasArchivo = new Set(), nombresArchivo = new Set();
  return registros.map(r => {
    if (r.error) return { ...r, duplicado: null };
    const ced = r.datos.cedula, k = claveNombre(r.datos.apellidos, r.datos.nombres);
    let duplicado = null;
    if (ced) {
      if (porCedula.has(ced)) duplicado = { tipo: 'existente', por: 'cedula', id: porCedula.get(ced).id };
      else if (cedulasArchivo.has(ced)) duplicado = { tipo: 'archivo', por: 'cedula' };
      cedulasArchivo.add(ced);
    } else if (k) {
      const mismos = porNombre.get(k) || [];
      if (mismos.length) duplicado = { tipo: 'existente', por: 'nombre', id: mismos[0].id };
      else if (nombresArchivo.has(k)) duplicado = { tipo: 'archivo', por: 'nombre' };
    }
    if (k) nombresArchivo.add(k);
    return { ...r, duplicado };
  });
}

/** Solo los campos que HOY están vacíos en lo guardado y que el archivo sí trae. Nunca pisa datos existentes. */
export function camposAActualizar(existente, nuevo, campos) {
  const out = {};
  for (const k of campos) {
    const actual = existente?.[k];
    const vacioActual = actual === null || actual === undefined || String(actual).trim() === '';
    if (vacioActual && !vacio(nuevo?.[k])) out[k] = nuevo[k];
  }
  return out;
}
export const CAMPOS_COMPLETABLES = { docentes: CAMPOS_DOCENTE.filter(c => !['nombres', 'apellidos'].includes(c)), estudiantes: CAMPOS_ESTUDIANTE.filter(c => !['nombres', 'apellidos'].includes(c)) };

// ───────────────────────── curso y paralelo de los estudiantes ─────────────────────────
const ORD = { primero: 1, primer: 1, segundo: 2, tercero: 3, tercer: 3, cuarto: 4, quinto: 5, sexto: 6, septimo: 7, octavo: 8, noveno: 9, decimo: 10 };

/** De un texto de curso ("8vo EGB", "Octavo de Básica", "1ro BGU", "Inicial 2") saca { familia, anio }. */
export function interpretarCurso(texto) {
  const t = norm(texto);
  if (!t) return null;
  let familia = null;
  if (/\b(bachillerato|bgu|bach)\b/.test(t)) familia = 'BACHILLERATO';
  else if (/\binicial\b/.test(t)) familia = 'INICIAL';
  else if (/\b(egb|basica|basico|ano)\b/.test(t)) familia = 'EGB';
  let anio = null;
  for (const [w, v] of Object.entries(ORD)) if (new RegExp(`\\b${w}\\b`).test(t)) { anio = v; break; }
  if (anio === null) { const m = t.match(/\b(\d{1,2})\s*(ro|er|do|to|vo|mo|no)?\b/); if (m) anio = Number(m[1]); }
  if (anio === null) return null;
  return { familia, anio };
}

/** Separa "8vo A" en { curso: '8vo', paralelo: 'A' } cuando el paralelo viene pegado al curso. */
export function separarCursoParalelo(texto) {
  const t = limpiar(texto).replace(/["'“”]/g, ' ').trim();
  const m = t.match(/^(.*\S)[\s\-–/]+([A-Za-z])$/);
  if (m && !/^(de|del|la|el)$/i.test(m[2]) && interpretarCurso(m[1])) return { curso: m[1].trim(), paralelo: m[2].toUpperCase() };
  return { curso: t, paralelo: '' };
}

/**
 * grados: [{ id, nombre, nivel, paralelos: [{id, nombre}] }]. Devuelve { gradoId, paraleloId, aviso }.
 * Si no se puede resolver con certeza, devuelve ids null y un aviso (el estudiante se crea igual, sin matrícula).
 */
export function resolverCurso(cursoTxt, paraleloTxt, grados) {
  if (!limpiar(cursoTxt)) return { gradoId: null, paraleloId: null, aviso: null };
  let curso = cursoTxt, paralelo = paraleloTxt;
  if (!limpiar(paralelo)) { const s = separarCursoParalelo(cursoTxt); curso = s.curso; paralelo = s.paralelo; }
  const buscado = interpretarCurso(curso);
  if (!buscado) return { gradoId: null, paraleloId: null, aviso: `no pude interpretar el curso "${limpiar(cursoTxt)}"` };

  const delPlantel = (grados || []).map(g => ({ g, c: interpretarCurso(g.nombre) || interpretarCurso(`${g.nombre} ${g.nivel || ''}`) }))
    .map(x => ({ ...x, c: x.c && !x.c.familia ? { ...x.c, familia: /bachillerato|bgu/.test(norm(x.g.nivel)) ? 'BACHILLERATO' : /inicial/.test(norm(x.g.nivel)) ? 'INICIAL' : 'EGB' } : x.c }));
  const mismoAnio = delPlantel.filter(x => x.c && x.c.anio === buscado.anio);
  const candidatos = buscado.familia ? mismoAnio.filter(x => x.c.familia === buscado.familia) : mismoAnio;
  if (candidatos.length === 0) return { gradoId: null, paraleloId: null, aviso: `el curso "${limpiar(cursoTxt)}" no existe en este plantel` };
  if (candidatos.length > 1) return { gradoId: null, paraleloId: null, aviso: `el curso "${limpiar(cursoTxt)}" es ambiguo (hay varios): escribe, por ejemplo, "EGB" o "Bachillerato"` };
  const grado = candidatos[0].g;
  const pars = grado.paralelos || [];
  const p = limpiar(paralelo);
  if (p) {
    const par = pars.find(x => norm(x.nombre) === norm(p));
    return par ? { gradoId: grado.id, paraleloId: par.id, aviso: null } : { gradoId: grado.id, paraleloId: null, aviso: `el paralelo "${p}" no existe en ${grado.nombre}` };
  }
  if (pars.length === 1) return { gradoId: grado.id, paraleloId: pars[0].id, aviso: null };
  return { gradoId: grado.id, paraleloId: null, aviso: `falta el paralelo de ${grado.nombre}` };
}
