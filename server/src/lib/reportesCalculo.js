// Cálculos puros de los listados (sin base de datos): días lectivos según el calendario académico,
// porcentajes y agrupaciones. La regla de día lectivo (evaluarDia) llega por parámetro para poder probarlo sin Supabase.

export const ymd = d => d.toISOString().slice(0, 10);

export function diasDelRango(desde, hasta) {
  const out = [];
  for (let d = new Date(desde + 'T12:00:00Z'); ymd(d) <= hasta; d = new Date(d.getTime() + 86400000)) out.push(ymd(d));
  return out;
}

/** Días del rango que son lectivos según el calendario (feriados, vacaciones, excepciones y fines de semana quedan fuera;
 *  una recuperación fuerza el día lectivo). paraleloId null = solo eventos de todo el plantel. */
export function lectivosDe(dias, eventos, paraleloId, evaluarDia) {
  return dias.filter(f => evaluarDia(f, eventos || [], null, paraleloId || null).ok);
}

/** Resumen legible del calendario para el encabezado de los reportes. */
export function resumenCalendario(eventos, desde, hasta, lectivos, totalDias) {
  const recorta = e => ({
    tipo: e.tipo, descripcion: e.descripcion || '',
    desde: e.fecha_inicio < desde ? desde : e.fecha_inicio,
    hasta: e.fecha_fin > hasta ? hasta : e.fecha_fin
  });
  const globales = (eventos || []).filter(e => !e.paralelo_id);
  const noLectivos = globales.filter(e => ['feriado', 'vacacion', 'excepcion'].includes(e.tipo)).map(recorta)
    .sort((a, b) => a.desde.localeCompare(b.desde));
  const recuperaciones = globales.filter(e => e.tipo === 'recuperacion').map(recorta).sort((a, b) => a.desde.localeCompare(b.desde));
  return { dias_lectivos: lectivos.length, dias_del_rango: totalDias, no_lectivos: noLectivos, recuperaciones };
}

export const sexoDe = g => { const x = String(g || '').toUpperCase(); return x.startsWith('F') ? 'F' : x.startsWith('M') ? 'M' : ''; };
export const nombreDe = e => `${e?.apellidos || ''} ${e?.nombres || ''}`.trim();

/** % de asistencia: no penaliza los días justificados (igual que el resto del sistema). Un decimal. */
export function pctAsistencia(presente, atraso, ausente) {
  const t = (presente || 0) + (atraso || 0) + (ausente || 0);
  return t > 0 ? Math.round((((presente || 0) + (atraso || 0)) / t) * 1000) / 10 : null;
}

export const conteoVacio = () => ({ presente: 0, atraso: 0, ausente: 0, justificado: 0, dias: 0 });

/** Une el arreglo [{e, presente, ...}] devuelto por la base en un Map por estudiante. */
export function mapaConteos(lista) {
  const m = new Map();
  for (const r of lista || []) {
    m.set(r.e, { presente: +r.presente || 0, atraso: +r.atraso || 0, ausente: +r.ausente || 0, justificado: +r.justificado || 0, dias: +r.dias || 0 });
  }
  return m;
}

/** Filtros avanzados sobre estudiantes ya calculados: solo con faltas y % de asistencia máximo. */
export function filtrarPorAsistencia(estudiantes, { soloConFaltas, pctMax }) {
  return estudiantes.filter(e => {
    if (soloConFaltas && !(e.faltas > 0)) return false;
    if (pctMax !== null && pctMax !== undefined && !Number.isNaN(pctMax)) {
      if (e.pct_asistencia === null || e.pct_asistencia > pctMax) return false;
    }
    return true;
  });
}

/** Totales por paralelo (y por curso) para el resumen del inspector. filas = matrículas ya filtradas. */
export function resumenPorParalelo(filas, conteos, umbralRiesgo = 75) {
  const porPar = new Map();
  for (const m of filas) {
    const k = m.paralelo_id;
    if (!porPar.has(k)) {
      porPar.set(k, {
        paralelo_id: k, curso: m.paralelos?.grados?.nombre || '', paralelo: m.paralelos?.nombre || '', jornada: m.paralelos?.jornada || '',
        total_estudiantes: 0, hombres: 0, mujeres: 0, presentes: 0, atrasos: 0, faltas: 0, justificadas: 0, en_riesgo: 0
      });
    }
    const g = porPar.get(k);
    g.total_estudiantes++;
    const s = sexoDe(m.estudiantes?.genero);
    if (s === 'M') g.hombres++; else if (s === 'F') g.mujeres++;
    const c = conteos.get(m.estudiante_id) || conteoVacio();
    g.presentes += c.presente; g.atrasos += c.atraso; g.faltas += c.ausente; g.justificadas += c.justificado;
    const p = pctAsistencia(c.presente, c.atraso, c.ausente);
    if (p !== null && p < umbralRiesgo) g.en_riesgo++;
  }
  const fin = g => ({ ...g, pct_asistencia: pctAsistencia(g.presentes, g.atrasos, g.faltas) });
  const resumen = [...porPar.values()].map(fin)
    .sort((a, b) => a.curso.localeCompare(b.curso, 'es') || a.paralelo.localeCompare(b.paralelo, 'es'));

  const porCurso = new Map();
  for (const r of resumen) {
    if (!porCurso.has(r.curso)) porCurso.set(r.curso, { curso: r.curso, paralelos: 0, total_estudiantes: 0, hombres: 0, mujeres: 0, presentes: 0, atrasos: 0, faltas: 0, justificadas: 0, en_riesgo: 0 });
    const c = porCurso.get(r.curso);
    c.paralelos++;
    for (const k of ['total_estudiantes', 'hombres', 'mujeres', 'presentes', 'atrasos', 'faltas', 'justificadas', 'en_riesgo']) c[k] += r[k];
  }
  const cursos = [...porCurso.values()].map(fin).sort((a, b) => a.curso.localeCompare(b.curso, 'es'));
  const totales = fin(resumen.reduce((t, r) => {
    for (const k of ['total_estudiantes', 'hombres', 'mujeres', 'presentes', 'atrasos', 'faltas', 'justificadas', 'en_riesgo']) t[k] += r[k];
    return t;
  }, { total_estudiantes: 0, hombres: 0, mujeres: 0, presentes: 0, atrasos: 0, faltas: 0, justificadas: 0, en_riesgo: 0 }));
  return { resumen, por_curso: cursos, totales };
}

/** Una fila del resumen por materia: cargas = docente_materia; conteos por carga (clases registradas). */
export function resumenPorCarga(cargas, conteosPorCarga, estudiantesPorParalelo) {
  const m = new Map((conteosPorCarga || []).map(r => [r.dm, r]));
  const filas = cargas.map(c => {
    const r = m.get(c.id) || {};
    const presente = +r.presente || 0, atraso = +r.atraso || 0, ausente = +r.ausente || 0, justificado = +r.justificado || 0;
    return {
      curso: c.curso, paralelo: c.paralelo, jornada: c.jornada || '', materia: c.materia, docente: c.docente || '',
      estudiantes: estudiantesPorParalelo.get(c.paralelo_id) || 0,
      clases_registradas: +r.fechas || 0,
      presentes: presente, atrasos: atraso, faltas: ausente, justificadas: justificado,
      pct_asistencia: pctAsistencia(presente, atraso, ausente)
    };
  }).sort((a, b) => a.curso.localeCompare(b.curso, 'es') || a.paralelo.localeCompare(b.paralelo, 'es') || a.materia.localeCompare(b.materia, 'es'));
  const t = filas.reduce((s, f) => ({ presentes: s.presentes + f.presentes, atrasos: s.atrasos + f.atrasos, faltas: s.faltas + f.faltas, justificadas: s.justificadas + f.justificadas }),
    { presentes: 0, atrasos: 0, faltas: 0, justificadas: 0 });
  return { filas, totales: { ...t, pct_asistencia: pctAsistencia(t.presentes, t.atrasos, t.faltas) } };
}
