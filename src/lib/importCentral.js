// Importar / exportar las bases centrales (docentes y estudiantes desvinculados,
// base de docentes, base de estudiantes). Módulo PURO (sin Supabase ni navegador).
// Lee Excel/CSV (matriz) o JSON (lista de objetos) con las columnas en cualquier orden.
import { norm, parseFecha, normalizarGenero, separarNombreCompleto } from './importacionInteligente.js';

const MOTIVOS = {
  docentes_desvinculados: ['renuncia', 'jubilacion', 'traslado', 'destitucion', 'fallecimiento', 'otro'],
  estudiantes_desvinculados: ['traslado', 'desercion', 'graduado', 'fallecimiento', 'otro']
};

// Nombres con los que suelen llamar a cada columna (ya sin tildes ni signos, ver `norm`).
const ALIAS = {
  cedula: ['cedula', 'cedula de identidad', 'ci', 'identificacion', 'numero de cedula', 'nro cedula', 'no cedula', 'documento', 'cedula ciudadania'],
  nombreCompleto: ['nombre', 'nombres y apellidos', 'apellidos y nombres', 'apellidos nombres', 'nombre completo', 'docente', 'estudiante', 'apellidos y nombres del docente'],
  apellidos: ['apellidos', 'apellido'],
  nombres: ['nombres', 'primer nombre'],
  provincia: ['provincia'],
  canton: ['canton'],
  categoria: ['categoria', 'categoria escalafon'],
  especialidad: ['especialidad'],
  ultima_situacion: ['ultima situacion laboral', 'ultima situacion', 'situacion laboral', 'situacion'],
  funcion: ['funcion cargo', 'funcion', 'cargo'],
  fecha_desvinculacion: ['fecha de desvinculacion', 'fecha desvinculacion', 'desvinculado'],
  fecha_retiro: ['fecha de retiro', 'fecha retiro', 'retiro'],
  curso_paralelo: ['curso paralelo', 'curso', 'curso y paralelo'],
  motivo: ['motivo', 'motivo de retiro', 'motivo de desvinculacion'],
  observaciones: ['observaciones', 'observacion', 'notas'],
  genero: ['genero', 'sexo'],
  fecha_nacimiento: ['fecha de nacimiento', 'fecha nacimiento', 'nacimiento'],
  // títulos (solo base de docentes): una fila por título, la cédula se repite
  t_titulo: ['titulo', 'titulo obtenido', 'titulo academico', 'titulos'],
  t_institucion: ['institucion del titulo', 'universidad', 'institucion educativa', 'institucion'],
  t_tipo: ['tipo de titulo', 'tipo titulo', 'tipo'],
  t_reconocido_por: ['reconocido por'],
  t_num_registro: ['n de registro', 'numero de registro', 'num registro', 'registro senescyt', 'n registro'],
  t_fecha_registro: ['fecha de registro', 'fecha registro'],
  t_observacion: ['observacion del titulo'],
  t_anio: ['anio', 'ano', 'anio del titulo']
};

const CAMPOS_TITULO = ['titulo', 'institucion', 'tipo', 'reconocido_por', 'num_registro', 'fecha_registro', 'observacion', 'anio'];
const limpiar = v => String(v ?? '').replace(/\s+/g, ' ').trim();

// Con las etiquetas del propio formulario (cfg.campos[].t) también se reconoce lo que exporta el sistema.
export function aliasesDe(cfg) {
  const m = new Map();
  const poner = (campo, textos) => textos.forEach(t => { const k = norm(t); if (k && !m.has(k)) m.set(k, campo); });
  const tieneNombreUnico = cfg.campos.some(c => c.k === 'nombre');
  Object.entries(ALIAS).forEach(([campo, textos]) => {
    if (campo.startsWith('t_') && cfg.tabla !== 'base_docentes') return;
    if (campo === 'nombreCompleto') return poner('nombreCompleto', textos);
    if (campo !== 'cedula' && !campo.startsWith('t_') && !cfg.campos.some(c => c.k === campo)) return;
    poner(campo, textos);
  });
  cfg.campos.forEach(c => poner(c.k === 'nombre' ? 'nombreCompleto' : c.k, [c.t]));
  if (!tieneNombreUnico) m.delete('nombre'); // en tablas con apellidos+nombres, "nombre" suelto = nombre completo
  return m;
}

// ¿Esta fila parece el encabezado? (al menos 2 columnas reconocidas)
export function filaEncabezado(matriz, alias, max = 12) {
  let mejor = -1, mejorN = 1;
  for (let i = 0; i < Math.min(matriz.length, max); i++) {
    const n = (matriz[i] || []).filter(c => alias.has(norm(c))).length;
    if (n > mejorN) { mejorN = n; mejor = i; }
  }
  return mejor;
}

export function cedulaCentral(valor) {
  let s = limpiar(valor).replace(/[\s.-]/g, '');
  if (!s) return null;
  if (/^\d+$/.test(s) && s.length === 9) s = '0' + s;     // Excel quita el cero inicial
  if (s.length < 5 || s.length > 20) return null;
  return s.toUpperCase();
}

function motivoCentral(tabla, valor) {
  const t = norm(valor);
  if (!t) return { valor: null };
  const permitidos = MOTIVOS[tabla];
  if (!permitidos) return { valor: null };
  const hallado = permitidos.find(p => t === p || t.startsWith(p.slice(0, 5)));
  if (hallado) return { valor: hallado };
  return { valor: 'otro', aviso: `motivo “${limpiar(valor)}” → otro` };
}

const fechaCentral = v => { const f = parseFecha(v); return f || null; };

// items: [{ fila, v: { campo: valor crudo } }] → { filas, omitidas, avisos }
function construir(cfg, items) {
  const omitidas = [];
  const avisos = [];
  const porCedula = new Map();
  const sinCedula = [];
  const esBaseDoc = cfg.tabla === 'base_docentes';
  const requiereCedula = cfg.campos.find(c => c.k === 'cedula')?.req;

  for (const { fila, v } of items) {
    const r = {};
    // nombre
    if (cfg.campos.some(c => c.k === 'nombre')) {
      const juntos = limpiar(`${v.apellidos ?? ''} ${v.nombres ?? ''}`);
      r.nombre = limpiar(v.nombreCompleto) || juntos || null;
    } else {
      let ap = limpiar(v.apellidos), no = limpiar(v.nombres);
      if ((!ap || !no) && limpiar(v.nombreCompleto)) {
        const s = separarNombreCompleto(v.nombreCompleto, true);
        ap = ap || s.apellidos; no = no || s.nombres;
        if (s.dudoso) avisos.push({ fila, motivo: `nombre dudoso: “${limpiar(v.nombreCompleto)}” → apellidos “${s.apellidos}”, nombres “${s.nombres}”` });
      }
      r.apellidos = ap || null; r.nombres = no || null;
    }
    r.cedula = cedulaCentral(v.cedula);
    for (const c of cfg.campos) {
      if (['cedula', 'nombre', 'apellidos', 'nombres'].includes(c.k)) continue;
      const crudo = v[c.k];
      if (c.tipo === 'date') r[c.k] = fechaCentral(crudo);
      else if (c.k === 'motivo') { const m = motivoCentral(cfg.tabla, crudo); r.motivo = m.valor; if (m.aviso) avisos.push({ fila, motivo: m.aviso }); }
      else if (c.k === 'genero') { const g = normalizarGenero(crudo); r.genero = g.valor; if (g.aviso) avisos.push({ fila, motivo: g.aviso }); }
      else r[c.k] = limpiar(crudo) || null;
    }
    // en la base de docentes, una fila que solo repite la cédula y trae otro título se une al docente ya leído
    if (esBaseDoc && r.cedula && porCedula.has(r.cedula)) {
      const previa = porCedula.get(r.cedula);
      const titulo = {};
      CAMPOS_TITULO.forEach(k => { titulo[k] = limpiar(v['t_' + k]); });
      if (titulo.fecha_registro) titulo.fecha_registro = fechaCentral(titulo.fecha_registro) || titulo.fecha_registro;
      Object.keys(r).forEach(k => { if (k !== 'titulos' && !previa[k] && r[k]) previa[k] = r[k]; });
      if (Object.values(titulo).some(Boolean) && !previa.titulos.some(x => x.titulo === titulo.titulo && x.num_registro === titulo.num_registro)) previa.titulos.push(titulo);
      continue;
    }
    // faltantes obligatorios
    const falta = cfg.campos.filter(c => c.req).find(c => !r[c.k]);
    if (falta) { omitidas.push({ fila, motivo: `falta ${falta.t.toLowerCase()}${falta.k === 'cedula' && v.cedula ? ' válida' : ''}` }); continue; }
    if (!requiereCedula && !r.cedula && !(r.apellidos || r.nombre)) { omitidas.push({ fila, motivo: 'fila sin datos' }); continue; }

    const titulo = {};
    if (esBaseDoc) {
      CAMPOS_TITULO.forEach(k => { titulo[k] = limpiar(v['t_' + k]); });
      if (titulo.fecha_registro) titulo.fecha_registro = fechaCentral(titulo.fecha_registro) || titulo.fecha_registro;
    }
    const tieneTitulo = esBaseDoc && Object.values(titulo).some(Boolean);
    r.titulos = tieneTitulo ? [titulo] : [];

    if (!r.cedula) { sinCedula.push(r); continue; }
    const previa = porCedula.get(r.cedula);
    if (!previa) { porCedula.set(r.cedula, { ...r, _fila: fila }); continue; }
    omitidas.push({ fila, motivo: `cédula repetida en el archivo (${r.cedula})` });
  }
  const lista = Array.from(porCedula.values()).map(({ _fila, ...x }) => x).concat(sinCedula);
  return { filas: lista, omitidas, avisos };
}

/** matriz: filas × columnas (como la entrega leerArchivo). */
export function leerMatriz(cfg, matriz) {
  const alias = aliasesDe(cfg);
  const h = filaEncabezado(matriz, alias);
  if (h < 0) return { error: 'No encontré los títulos de las columnas. Revisa que la primera fila tenga, por ejemplo, “Cédula” y “Apellidos y nombres”.' };
  const enc = matriz[h] || [];
  const columnas = enc.map((t, i) => ({ indice: i, encabezado: limpiar(t), campo: alias.get(norm(t)) || null })).filter(c => c.encabezado);
  const items = [];
  for (let i = h + 1; i < matriz.length; i++) {
    const fila = matriz[i] || [];
    if (!fila.some(c => limpiar(c))) continue;
    const v = {};
    columnas.forEach(c => { if (c.campo && !(c.campo in v)) v[c.campo] = fila[c.indice]; });
    items.push({ fila: i + 1, v });
  }
  const r = construir(cfg, items);
  return { ...r, columnas, totalFilas: items.length };
}

/** objetos: lista de objetos con las mismas claves de la tabla (JSON del sistema anterior). */
export function leerObjetos(cfg, objetos) {
  if (!Array.isArray(objetos)) return { error: 'El JSON debe ser una lista de registros.' };
  const alias = aliasesDe(cfg);
  const items = [];
  objetos.forEach((o, i) => {
    const obj = o && typeof o === 'object' ? o : {};
    const v = {};
    Object.entries(obj).forEach(([k, val]) => {
      if (Array.isArray(val)) return;            // "titulos" viene como lista: se lee aparte
      const campo = alias.get(norm(k));
      if (campo && !(campo in v)) v[campo] = val;
    });
    const lista = cfg.tabla === 'base_docentes' && Array.isArray(obj.titulos) ? obj.titulos : [];
    if (!lista.length) { items.push({ fila: i + 1, v }); return; }
    // un título por fila: construir() las une por cédula
    lista.forEach(t => {
      const vt = { ...v };
      CAMPOS_TITULO.forEach(k => { vt['t_' + k] = t?.[k]; });
      items.push({ fila: i + 1, v: vt });
    });
  });
  const r = construir(cfg, items);
  return { ...r, columnas: null, totalFilas: objetos.length };
}

/** Quita lo vacío de cada fila: así un archivo con celdas en blanco no borra datos ya guardados. */
export function filaParaGuardar(fila) {
  const o = {};
  for (const [k, v] of Object.entries(fila)) {
    if (k === 'titulos') { if (Array.isArray(v) && v.length) o.titulos = v; continue; }
    if (v !== null && v !== undefined && v !== '') o[k] = v;
  }
  return o;
}

/** Agrupa filas que traen exactamente las mismas columnas (el upsert por lote exige columnas iguales). */
export function agruparPorColumnas(filas) {
  const grupos = new Map();
  for (const f of filas) {
    const clave = Object.keys(f).sort().join('|');
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(f);
  }
  return [...grupos.values()];
}

export function trozos(lista, n) {
  const out = [];
  for (let i = 0; i < lista.length; i += n) out.push(lista.slice(i, i + n));
  return out;
}

// ───────────── exportar ─────────────
export function columnasExport(cfg) {
  const base = cfg.campos.map(c => c.t);
  const plantel = [cfg.etiquetaPlantel, 'AMIE'];
  const titulos = cfg.tabla === 'base_docentes'
    ? ['Título', 'Institución del título', 'Tipo de título', 'Reconocido por', 'N° de registro', 'Fecha de registro', 'Observación del título', 'Año'] : [];
  return [...base, ...plantel, ...titulos];
}

/** Una fila por registro; en la base de docentes, una fila por título (la cédula se repite). */
export function filasExport(cfg, registros) {
  const cols = columnasExport(cfg);
  const out = [];
  for (const r of registros) {
    const fila = {};
    cfg.campos.forEach(c => { fila[c.t] = r[c.k] ?? ''; });
    fila[cfg.etiquetaPlantel] = r.plantel?.nombre || '';
    fila.AMIE = r.plantel?.amie || '';
    if (cfg.tabla === 'base_docentes') {
      const ts = Array.isArray(r.titulos) && r.titulos.length ? r.titulos : [{}];
      ts.forEach(t => out.push({
        ...fila, 'Título': t.titulo || '', 'Institución del título': t.institucion || '', 'Tipo de título': t.tipo || '',
        'Reconocido por': t.reconocido_por || '', 'N° de registro': t.num_registro || '', 'Fecha de registro': t.fecha_registro || '',
        'Observación del título': t.observacion || '', 'Año': t.anio || ''
      }));
    } else out.push(fila);
  }
  return { cols, filas: out };
}
