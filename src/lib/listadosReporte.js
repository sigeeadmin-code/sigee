// Documentos de los listados (Excel e impresión) a partir de lo que devuelve POST /reportes/listados.
// Módulo PURO: sin navegador ni Supabase. Todo texto que viene de datos se escapa antes de ir al HTML.

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const etiquetaDia = iso => { const d = new Date(iso + 'T12:00:00Z'); return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()}`; };
export const fechaCorta = iso => { if (!iso) return '—'; const [y, m, d] = iso.split('-'); return `${+d} ${MESES[+m - 1]} ${y}`; };
const pct = v => (v === null || v === undefined ? '—' : `${String(v).replace('.', ',')} %`);

export const TITULOS = {
  asistencia: 'REGISTRO DE ASISTENCIA DEL CURSO',
  nomina_oficial: 'NÓMINA OFICIAL DE ESTUDIANTES POR CURSO Y PARALELO',
  junta_curso: 'REPORTE PARA JUNTA DE CURSO',
  resumen_inspector: 'RESUMEN CONSOLIDADO DE ASISTENCIA POR CURSO Y PARALELO',
  resumen_docente: 'RESUMEN DE ASISTENCIA Y FALTAS POR MATERIA'
};
const NOMBRE_ARCHIVO = {
  asistencia: 'Lista_Asistencia', nomina_oficial: 'Nomina_Oficial', junta_curso: 'Junta_de_Curso',
  resumen_inspector: 'Resumen_Inspector', resumen_docente: 'Resumen_por_Materia'
};

/** "Feriado 2–3 nov (Día de los Difuntos)" … para el encabezado. */
export function textoNoLectivos(cal) {
  const lista = (cal?.no_lectivos || []).map(e => {
    const f = e.desde === e.hasta ? fechaCorta(e.desde) : `${fechaCorta(e.desde)} al ${fechaCorta(e.hasta)}`;
    const t = { feriado: 'Feriado', vacacion: 'Vacación', excepcion: 'Excepción' }[e.tipo] || e.tipo;
    return `${t} ${f}${e.descripcion ? ` (${e.descripcion})` : ''}`;
  });
  return lista;
}

/** Líneas de título institucional (Excel: filas combinadas antes de la tabla; impresión: mismo contenido). */
export function lineasEncabezado(resultado, { tituloContexto = '', filtrosTexto = [] } = {}) {
  const meta = resultado.meta || {};
  const inst = meta.institucion || {};
  const r = meta.rango || {};
  const cal = meta.calendario;
  const l = [
    inst.nombre || 'UNIDAD EDUCATIVA',
    `Código AMIE: ${inst.amie || '—'}  ·  Régimen: ${inst.regimen || '—'}`,
    TITULOS[resultado.tipo] || 'LISTADO DE ESTUDIANTES',
    `Período: ${r.desde || '—'} al ${r.hasta || '—'}  ·  Generado: ${new Date(meta.generado_en || Date.now()).toLocaleString('es-EC')}`
  ];
  if (cal) l.push(`Calendario académico: ${cal.dias_lectivos} día(s) lectivo(s) de ${cal.dias_del_rango} del rango (se excluyen fines de semana, feriados y vacaciones)`);
  const nl = textoNoLectivos(cal);
  if (nl.length) l.push(`No lectivos en el rango: ${nl.join('; ')}`);
  if (tituloContexto) l.push(tituloContexto);
  if (meta.tutor) l.push(`Docente tutor: ${meta.tutor}`);
  if (meta.alcance && ['asistencia', 'junta_curso', 'resumen_docente'].includes(resultado.tipo)) l.push(`Alcance: ${meta.alcance}`);
  if (filtrosTexto.length) l.push(`Filtros: ${filtrosTexto.join(' · ')}`);
  if (resultado.tipo !== 'resumen_docente') l.push(`Total de estudiantes: ${meta.total_estudiantes ?? (resultado.estudiantes || []).length}`);
  l.push('');
  return l;
}

/** Hoja de Excel: { nombreArchivo, hojas:[{nombre, filas, cols, encabezado}] } lista para descargarLibro. */
export function libroExcel(resultado, ctx = {}) {
  const meta = resultado.meta || {};
  const r = meta.rango || {};
  const encabezado = lineasEncabezado(resultado, ctx);
  const sufijo = `${r.desde || ''}_${r.hasta || ''}`;
  const base = NOMBRE_ARCHIVO[resultado.tipo] || 'Listado';
  const nombreArchivo = `${base}_${sufijo}.xlsx`;
  const est = resultado.estudiantes || [];

  if (resultado.tipo === 'asistencia') {
    const dias = meta.dias || [];
    const cols = ['N°', 'Cédula', 'Apellidos y Nombres', ...dias.map(etiquetaDia), 'Faltas', 'Atrasos', 'Justificadas', '% Asistencia', 'Observaciones'];
    const filas = est.map(e => {
      const row = { 'N°': e.n, 'Cédula': e.cedula, 'Apellidos y Nombres': e.nombre_completo, 'Faltas': e.faltas, 'Atrasos': e.atrasos, 'Justificadas': e.justificadas, '% Asistencia': e.pct_asistencia ?? '', 'Observaciones': e.observaciones || '' };
      dias.forEach(d => { row[etiquetaDia(d)] = (e.marcas || {})[d] || ''; });
      return row;
    });
    return { nombreArchivo, hojas: [{ nombre: 'Asistencia', filas, cols, encabezado }] };
  }
  if (resultado.tipo === 'junta_curso') {
    const cols = ['N°', 'Apellidos y Nombres', 'Sexo', 'Días con registro', 'Faltas', 'Atrasos', 'Justificadas', '% Asistencia', 'Observaciones Académicas', 'Observaciones de Comportamiento', 'Firma Representante'];
    const filas = est.map(e => ({
      'N°': e.n, 'Apellidos y Nombres': e.nombre_completo, 'Sexo': e.sexo, 'Días con registro': e.dias_registrados, 'Faltas': e.faltas, 'Atrasos': e.atrasos,
      'Justificadas': e.justificadas, '% Asistencia': e.pct_asistencia ?? '', 'Observaciones Académicas': '', 'Observaciones de Comportamiento': '', 'Firma Representante': ''
    }));
    return { nombreArchivo, hojas: [{ nombre: 'Junta de Curso', filas, cols, encabezado }] };
  }
  if (resultado.tipo === 'resumen_inspector') {
    const cols = ['Curso', 'Paralelo', 'Jornada', 'Estudiantes', 'Hombres', 'Mujeres', 'Asistencias (días)', 'Atrasos', 'Faltas', 'Justificadas', '% Asistencia', 'Estudiantes en riesgo (<75 %)'];
    const fila = (x, curso, par, jor) => ({ 'Curso': curso, 'Paralelo': par, 'Jornada': jor, 'Estudiantes': x.total_estudiantes, 'Hombres': x.hombres, 'Mujeres': x.mujeres, 'Asistencias (días)': x.presentes, 'Atrasos': x.atrasos, 'Faltas': x.faltas, 'Justificadas': x.justificadas, '% Asistencia': x.pct_asistencia ?? '', 'Estudiantes en riesgo (<75 %)': x.en_riesgo });
    const filas = (resultado.resumen || []).map(x => fila(x, x.curso, x.paralelo, x.jornada || ''));
    if (resultado.totales) filas.push(fila(resultado.totales, 'TOTAL DEL PLANTEL', '', ''));
    const colsCurso = ['Curso', 'Paralelos', ...cols.slice(3)];
    const filasCurso = (resultado.por_curso || []).map(x => ({ ...fila(x, x.curso, '', ''), 'Paralelos': x.paralelos }));
    return { nombreArchivo, hojas: [{ nombre: 'Por paralelo', filas, cols, encabezado }, { nombre: 'Por curso', filas: filasCurso, cols: colsCurso, encabezado }] };
  }
  if (resultado.tipo === 'resumen_docente') {
    const cols = ['Curso', 'Paralelo', 'Materia', 'Docente', 'Estudiantes', 'Clases con registro', 'Asistencias', 'Atrasos', 'Faltas', 'Justificadas', '% Asistencia'];
    const fila = (x, curso, par, mat, doc) => ({ 'Curso': curso, 'Paralelo': par, 'Materia': mat, 'Docente': doc, 'Estudiantes': x.estudiantes ?? '', 'Clases con registro': x.clases_registradas ?? '', 'Asistencias': x.presentes, 'Atrasos': x.atrasos, 'Faltas': x.faltas, 'Justificadas': x.justificadas, '% Asistencia': x.pct_asistencia ?? '' });
    const filas = (resultado.resumen || []).map(x => fila(x, x.curso, x.paralelo, x.materia, x.docente));
    if (resultado.totales) filas.push(fila(resultado.totales, 'TOTAL', '', '', ''));
    return { nombreArchivo, hojas: [{ nombre: 'Por materia', filas, cols, encabezado }] };
  }
  const cols = ['N°', 'Cédula', 'Apellidos y Nombres Completos', 'Sexo', 'Estado de Matrícula', 'Curso', 'Paralelo'];
  const filas = est.map(e => ({ 'N°': e.n, 'Cédula': e.cedula, 'Apellidos y Nombres Completos': e.nombre_completo, 'Sexo': e.sexo, 'Estado de Matrícula': e.estado_matricula, 'Curso': e.curso, 'Paralelo': e.paralelo }));
  return { nombreArchivo, hojas: [{ nombre: 'Nómina Oficial', filas, cols, encabezado }] };
}

const TD = 'border:1px solid #bbb;padding:4px 6px';
const TH = 'border:1px solid #1F4E79;padding:5px 6px;background:#1F4E79;color:#fff';
const celda = (v, extra = '') => `<td style="${TD};${extra}">${esc(v)}</td>`;
const cab = (t, extra = '') => `<th style="${TH};${extra}">${esc(t)}</th>`;
const centro = 'text-align:center';

/** HTML completo para imprimir / guardar como PDF. Horizontal en las tablas anchas. */
export function htmlImprimible(resultado, ctx = {}) {
  const meta = resultado.meta || {};
  const lineas = lineasEncabezado(resultado, ctx).filter(Boolean);
  const est = resultado.estudiantes || [];
  const horizontal = ['asistencia', 'resumen_inspector', 'resumen_docente', 'junta_curso'].includes(resultado.tipo);
  let tabla = '';

  if (resultado.tipo === 'asistencia') {
    const dias = meta.dias || [];
    tabla = `<table><thead><tr>${cab('N°')}${cab('Cédula')}${cab('Apellidos y Nombres')}${dias.map(d => cab(etiquetaDia(d), 'font-size:9px')).join('')}${cab('F')}${cab('A')}${cab('J')}${cab('% asist.')}</tr></thead><tbody>${
      est.map(e => `<tr>${celda(e.n, centro)}${celda(e.cedula)}${celda(e.nombre_completo)}${dias.map(d => celda((e.marcas || {})[d] || '', centro)).join('')}${celda(e.faltas, centro)}${celda(e.atrasos, centro)}${celda(e.justificadas, centro)}${celda(pct(e.pct_asistencia), centro)}</tr>`).join('')
    }</tbody></table><p class="nota">✓ presente · F falta · A atraso · J justificado. Solo se muestran los días lectivos del calendario académico.</p>`;
  } else if (resultado.tipo === 'junta_curso') {
    tabla = `<table><thead><tr>${cab('N°')}${cab('Apellidos y Nombres')}${cab('Sexo')}${cab('Faltas')}${cab('Atrasos')}${cab('Justif.')}${cab('% asist.')}${cab('Observaciones académicas')}${cab('Observaciones de comportamiento')}${cab('Firma representante')}</tr></thead><tbody>${
      est.map(e => `<tr style="height:30px">${celda(e.n, centro)}${celda(e.nombre_completo)}${celda(e.sexo, centro)}${celda(e.faltas, centro)}${celda(e.atrasos, centro)}${celda(e.justificadas, centro)}${celda(pct(e.pct_asistencia), centro)}${celda('')}${celda('')}${celda('')}</tr>`).join('')
    }</tbody></table>`;
  } else if (resultado.tipo === 'resumen_inspector') {
    const fila = (x, a, b, c, fuerte) => `<tr style="${fuerte ? 'font-weight:bold;background:#eef3f8' : ''}">${celda(a)}${celda(b, centro)}${celda(c, centro)}${celda(x.total_estudiantes, centro)}${celda(x.hombres, centro)}${celda(x.mujeres, centro)}${celda(x.presentes, centro)}${celda(x.atrasos, centro)}${celda(x.faltas, centro)}${celda(x.justificadas, centro)}${celda(pct(x.pct_asistencia), centro)}${celda(x.en_riesgo, centro)}</tr>`;
    const head = `<tr>${cab('Curso')}${cab('Paralelo')}${cab('Jornada')}${cab('Estud.')}${cab('Hombres')}${cab('Mujeres')}${cab('Asist.')}${cab('Atrasos')}${cab('Faltas')}${cab('Justif.')}${cab('% asist.')}${cab('En riesgo')}</tr>`;
    tabla = `<table><thead>${head}</thead><tbody>${(resultado.resumen || []).map(x => fila(x, x.curso, x.paralelo, x.jornada || '', false)).join('')}${
      (resultado.por_curso || []).length > 1 ? (resultado.por_curso || []).map(x => fila(x, `Subtotal ${x.curso}`, '', '', true)).join('') : ''
    }${resultado.totales ? fila(resultado.totales, 'TOTAL DEL PLANTEL', '', '', true) : ''}</tbody></table><p class="nota">Asist./Atrasos/Faltas/Justif. son días de estudiante dentro del rango (un día es falta si hubo al menos un registro ausente). En riesgo: estudiantes con menos de 75 % de asistencia.</p>`;
  } else if (resultado.tipo === 'resumen_docente') {
    const fila = (x, fuerte) => `<tr style="${fuerte ? 'font-weight:bold;background:#eef3f8' : ''}">${celda(x.curso || '')}${celda(x.paralelo || '', centro)}${celda(x.materia || '')}${celda(x.docente || '')}${celda(x.estudiantes ?? '', centro)}${celda(x.clases_registradas ?? '', centro)}${celda(x.presentes, centro)}${celda(x.atrasos, centro)}${celda(x.faltas, centro)}${celda(x.justificadas, centro)}${celda(pct(x.pct_asistencia), centro)}</tr>`;
    tabla = `<table><thead><tr>${cab('Curso')}${cab('Par.')}${cab('Materia')}${cab('Docente')}${cab('Estud.')}${cab('Clases')}${cab('Asist.')}${cab('Atrasos')}${cab('Faltas')}${cab('Justif.')}${cab('% asist.')}</tr></thead><tbody>${(resultado.resumen || []).map(x => fila(x, false)).join('')}${resultado.totales ? fila({ ...resultado.totales, curso: 'TOTAL' }, true) : ''}</tbody></table><p class="nota">Cuenta los registros de asistencia de cada materia (cada clase tomada) en los días lectivos del rango.</p>`;
  } else {
    tabla = `<table><thead><tr>${cab('N°')}${cab('Cédula')}${cab('Apellidos y Nombres Completos')}${cab('Sexo')}${cab('Estado')}</tr></thead><tbody>${est.map(e => `<tr>${celda(e.n, centro)}${celda(e.cedula)}${celda(e.nombre_completo)}${celda(e.sexo, centro)}${celda(e.estado_matricula, centro)}</tr>`).join('')}</tbody></table>`;
  }

  const sinFirmaTutor = resultado.tipo === 'resumen_docente';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(TITULOS[resultado.tipo] || 'Listado')}</title>
<style>
  @page { size: A4 ${horizontal ? 'landscape' : 'portrait'}; margin: 12mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; padding: 10px; }
  .enc { text-align: center; margin-bottom: 10px; }
  .enc .n { font-size: 15px; font-weight: bold; color: #1F4E79; }
  .enc .t { font-size: 13px; font-weight: bold; margin-top: 6px; }
  .enc .l { font-size: 10.5px; color: #333; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  thead { display: table-header-group; } tr { page-break-inside: avoid; }
  .nota { font-size: 9.5px; color: #555; margin: 6px 0 0; }
  .firmas { margin-top: 30px; display: flex; justify-content: space-around; font-size: 11px; text-align: center; }
</style></head><body>
<div class="enc"><div class="n">${esc(lineas[0])}</div><div class="l">${esc(lineas[1])}</div><div class="t">${esc(lineas[2])}</div>${lineas.slice(3).map(x => `<div class="l">${esc(x)}</div>`).join('')}</div>
${tabla}
<div class="firmas">${sinFirmaTutor ? '<div>_____________________________<br>Firma del docente</div>' : '<div>_____________________________<br>Docente tutor</div>'}<div>_____________________________<br>Inspector / Autoridad</div></div>
<script>window.onload=function(){window.print();}</script>
</body></html>`;
}
