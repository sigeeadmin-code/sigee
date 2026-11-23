import { Router } from 'express';
import { requireAuth, requireRole } from '../lib/auth.js';
import { supabase } from '../lib/supabase.js';
import { evaluarDia } from '../lib/calendario.js';
import {
  diasDelRango, lectivosDe, resumenCalendario, sexoDe, nombreDe, pctAsistencia, conteoVacio, mapaConteos,
  filtrarPorAsistencia, resumenPorParalelo, resumenPorCarga, ymd
} from '../lib/reportesCalculo.js';

export const reportesRouter = Router();

/**
 * POST /reportes/listados
 * Body:
 *   tipo: 'asistencia' | 'nomina_oficial' | 'junta_curso' | 'resumen_inspector' | 'resumen_docente'
 *   paralelo_id?, grado_id?, tutor_id? (docentes.id), jornada?, sexo? 'M'|'F', estado? (activa por defecto), materia_id?
 *   fecha_inicio?/fecha_fin? 'YYYY-MM-DD'  o  semana? (cualquier día de la semana)
 *   solo_con_faltas? boolean, pct_max? número (solo estudiantes con % de asistencia ≤ pct_max)
 *   institucion_id? (solo el Super Admin sin plantel)
 *
 * Todo se calcula con el calendario académico del plantel: solo cuentan los días lectivos (sin feriados, vacaciones,
 * excepciones ni fines de semana; una recuperación fuerza el día). Un día es "falta" si hay al menos un registro ausente.
 */
// Solo personal con función de gestión; el docente solo ve sus paralelos (donde es tutor o dicta) y solo SUS materias.
// Estudiantes, padres, contadores, administrativos y DECE no tienen acceso.
const ROLES_LISTADOS = ['super_admin', 'admin_plantel', 'secretario', 'inspector_general', 'supervisor_plantel', 'docente'];
const TIPOS = ['asistencia', 'nomina_oficial', 'junta_curso', 'resumen_inspector', 'resumen_docente'];
const TIPOS_DOCENTE = ['asistencia', 'nomina_oficial', 'junta_curso', 'resumen_docente'];
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DIAS = 366;

reportesRouter.post('/listados', requireAuth, requireRole(...ROLES_LISTADOS), async (req, res) => {
  try {
    const b = req.body || {};
    const { tipo = 'nomina_oficial', paralelo_id, grado_id, tutor_id, jornada, anio_lectivo, sexo, materia_id } = b;
    const estado = b.estado || 'activa';
    const soloConFaltas = b.solo_con_faltas === true || b.solo_con_faltas === 'true';
    const pctMax = b.pct_max === undefined || b.pct_max === null || b.pct_max === '' ? null : Number(b.pct_max);
    if (pctMax !== null && (!Number.isFinite(pctMax) || pctMax < 0 || pctMax > 100)) return res.status(400).json({ error: 'pct_max debe estar entre 0 y 100.' });
    if (!TIPOS.includes(tipo)) return res.status(400).json({ error: `tipo inválido. Use: ${TIPOS.join(', ')}` });

    // La institución sale SIEMPRE del perfil del token. Solo el super_admin sin plantel puede elegirla.
    let institucionId = req.profile.institucion_id;
    if (!institucionId && req.profile.rol === 'super_admin') institucionId = b.institucion_id || null;
    if (!institucionId) {
      return res.status(req.profile.rol === 'super_admin' ? 400 : 403).json({
        error: req.profile.rol === 'super_admin' ? 'Indique institucion_id: el listado se genera por plantel.' : 'Usuario sin institución asignada.'
      });
    }

    // ---- Rango de fechas
    let desde = b.fecha_inicio;
    let hasta = b.fecha_fin;
    if (b.semana) {
      if (!FECHA.test(b.semana)) return res.status(400).json({ error: 'semana inválida (AAAA-MM-DD).' });
      const d = new Date(b.semana + 'T12:00:00Z');
      const dow = d.getUTCDay();
      const lunes = new Date(d.getTime() + (dow === 0 ? -6 : 1 - dow) * 86400000);
      desde = ymd(lunes);
      hasta = ymd(new Date(lunes.getTime() + 4 * 86400000));
    }
    if (!desde || !hasta) {
      const ahora = new Date();
      desde = ymd(new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), 1)));
      hasta = ymd(ahora);
    }
    if (!FECHA.test(desde) || !FECHA.test(hasta)) return res.status(400).json({ error: 'Fechas inválidas (AAAA-MM-DD).' });
    if (desde > hasta) return res.status(400).json({ error: 'La fecha inicial es posterior a la final.' });
    const todosDias = diasDelRango(desde, hasta);
    if (todosDias.length > MAX_DIAS) return res.status(400).json({ error: `El rango no puede pasar de ${MAX_DIAS} días.` });

    // ---- Período activo y, si es docente, sus paralelos y cargas
    const { data: periodos } = await supabase.from('periodos_lectivos').select('id').eq('institucion_id', institucionId).eq('activo', true).limit(1);
    const periodoId = periodos?.[0]?.id || null;

    const esDocente = req.profile.rol === 'docente';
    let misCargas = null;               // docente_materia del docente (periodo activo)
    let paralelosPermitidos = null;     // docente: donde dicta o es tutor
    let paralelosTutor = null;          // docente: donde es tutor (nómina con cédulas solo ahí)
    if (esDocente) {
      if (!TIPOS_DOCENTE.includes(tipo)) return res.status(403).json({ error: 'Tu rol no puede generar este tipo de listado.' });
      const { data: doc } = await supabase.from('docentes').select('id').eq('profile_id', req.profile.id).eq('institucion_id', institucionId).maybeSingle();
      if (!doc) return res.status(403).json({ error: 'No se encontró tu ficha de docente.' });
      let qc = supabase.from('docente_materia').select('id, paralelo_id, materia_id').eq('docente_id', doc.id);
      if (periodoId) qc = qc.eq('periodo_id', periodoId);
      const [{ data: cargas }, { data: tut }] = await Promise.all([qc, supabase.from('paralelos').select('id').eq('tutor_docente_id', doc.id)]);
      misCargas = cargas || [];
      paralelosTutor = (tut || []).map(x => x.id);
      paralelosPermitidos = [...new Set([...misCargas.map(c => c.paralelo_id), ...paralelosTutor])];
      if (!paralelosPermitidos.length) return res.status(403).json({ error: 'No tienes cursos asignados.' });
      if (paralelo_id && !paralelosPermitidos.includes(paralelo_id)) return res.status(403).json({ error: 'Ese paralelo no está entre tus cursos.' });
      if (tipo === 'nomina_oficial') {
        if (!paralelosTutor.length) return res.status(403).json({ error: 'La nómina con cédulas solo la genera el docente tutor del curso.' });
        if (paralelo_id && !paralelosTutor.includes(paralelo_id)) return res.status(403).json({ error: 'La nómina con cédulas solo la genera el docente tutor del curso.' });
      }
    }

    // ---- Matrículas con filtros
    let q = supabase.from('matriculas').select(`
        id, estado, estudiante_id, paralelo_id, grado_id, periodo_id,
        estudiantes!inner ( id, institucion_id, cedula, nombres, apellidos, genero, activo ),
        paralelos ( id, nombre, jornada, tutor_docente_id, grados ( id, nombre ) )
      `).eq('estado', estado).eq('estudiantes.institucion_id', institucionId);
    const limite = esDocente ? (tipo === 'nomina_oficial' ? paralelosTutor : paralelosPermitidos) : null;
    if (limite) q = q.in('paralelo_id', limite);
    if (paralelo_id) q = q.eq('paralelo_id', paralelo_id);
    if (grado_id) q = q.eq('grado_id', grado_id);
    const { data: matriculas, error: errMat } = await q;
    if (errMat) { console.error('[reportes] matriculas', errMat.message); return res.status(500).json({ error: 'Error al consultar matrículas: ' + errMat.message }); }

    let filas = (matriculas || []).filter(m => m.estudiantes);
    if (jornada) filas = filas.filter(m => (m.paralelos?.jornada || '').toLowerCase() === String(jornada).toLowerCase());
    if (sexo) filas = filas.filter(m => sexoDe(m.estudiantes.genero) === String(sexo).toUpperCase().slice(0, 1));
    if (tutor_id) filas = filas.filter(m => m.paralelos?.tutor_docente_id === tutor_id);
    filas.sort((a, b) => nombreDe(a.estudiantes).toLowerCase().localeCompare(nombreDe(b.estudiantes).toLowerCase(), 'es'));

    // ---- Institución, tutor y calendario académico
    const [{ data: institucion }, { data: eventos, error: errEv }] = await Promise.all([
      supabase.from('instituciones').select('id, nombre, amie, regimen').eq('id', institucionId).maybeSingle(),
      supabase.from('calendario_eventos').select('tipo, descripcion, fecha_inicio, fecha_fin, paralelo_id')
        .eq('institucion_id', institucionId).lte('fecha_inicio', hasta).gte('fecha_fin', desde)
    ]);
    if (errEv) return res.status(500).json({ error: 'Error al leer el calendario académico: ' + errEv.message });
    const paralelosEnLista = [...new Set(filas.map(m => m.paralelo_id))];
    const unSoloParalelo = paralelosEnLista.length === 1 ? paralelosEnLista[0] : null;
    const diasLectivos = lectivosDe(todosDias, eventos, unSoloParalelo, evaluarDia);
    const calendario = resumenCalendario(eventos, desde, hasta, diasLectivos, todosDias.length);

    let tutorNombre = null;
    const tutores = new Set(filas.map(m => m.paralelos?.tutor_docente_id));
    if (filas.length && tutores.size === 1 && filas[0].paralelos?.tutor_docente_id) {
      const { data: t } = await supabase.from('docentes').select('nombres, apellidos').eq('id', filas[0].paralelos.tutor_docente_id).maybeSingle();
      if (t) tutorNombre = nombreDe(t);
    }

    // ---- Cargas (materias) que cuentan: docente → solo las suyas; materia_id → las de esa materia
    let dmIds = null;     // null = todas las materias
    let alcance = 'todas las materias del curso';
    if (esDocente) {
      dmIds = misCargas.filter(c => paralelosEnLista.includes(c.paralelo_id) && (!materia_id || c.materia_id === materia_id)).map(c => c.id);
      alcance = 'solo las materias a cargo del docente';
    } else if (materia_id) {
      let qm = supabase.from('docente_materia').select('id').eq('materia_id', materia_id).in('paralelo_id', paralelosEnLista.length ? paralelosEnLista : ['00000000-0000-0000-0000-000000000000']);
      if (periodoId) qm = qm.eq('periodo_id', periodoId);
      const { data: ms } = await qm;
      dmIds = (ms || []).map(x => x.id);
      alcance = 'solo la materia seleccionada';
    }
    if (dmIds && !dmIds.length) dmIds = ['00000000-0000-0000-0000-000000000000'];   // sin cargas: nada que contar

    const meta = {
      institucion: institucion ? { nombre: institucion.nombre, amie: institucion.amie, regimen: institucion.regimen } : null,
      rango: { desde, hasta }, generado_en: new Date().toISOString(),
      total_estudiantes: filas.length, tutor: tutorNombre, calendario, alcance,
      filtros: { paralelo_id, grado_id, tutor_id, jornada, anio_lectivo, sexo, estado, tipo, materia_id, solo_con_faltas: soloConFaltas, pct_max: pctMax }
    };
    const estudianteIds = filas.map(m => m.estudiante_id);
    const rpc = async (nombre, extra = {}) => {
      if (!estudianteIds.length || !diasLectivos.length) return [];
      const { data, error } = await supabase.rpc(nombre, { p_estudiantes: estudianteIds, p_desde: desde, p_hasta: hasta, p_dias: diasLectivos, p_dm: dmIds, ...extra });
      if (error) throw new Error(`${nombre}: ${error.message}`);
      return data || [];
    };
    const datosEst = m => ({
      cedula: m.estudiantes.cedula || '', apellidos: m.estudiantes.apellidos || '', nombres: m.estudiantes.nombres || '',
      nombre_completo: nombreDe(m.estudiantes), sexo: sexoDe(m.estudiantes.genero),
      curso: m.paralelos?.grados?.nombre || '', paralelo: m.paralelos?.nombre || '', jornada: m.paralelos?.jornada || ''
    });

    // ===================== NÓMINA OFICIAL =====================
    if (tipo === 'nomina_oficial') {
      const estudiantes = filas.map((m, i) => ({ n: i + 1, ...datosEst(m), estado_matricula: m.estado || 'activa' }));
      return res.json({ tipo, meta, estudiantes, columnas: ['n', 'cedula', 'nombre_completo', 'sexo', 'estado_matricula'] });
    }

    // ===================== JUNTA DE CURSO (con resumen de asistencia por estudiante) =====================
    if (tipo === 'junta_curso') {
      const conteos = mapaConteos(await rpc('reporte_asistencia_estudiantes'));
      let estudiantes = filas.map(m => {
        const c = conteos.get(m.estudiante_id) || conteoVacio();
        return {
          ...datosEst(m), estado_matricula: m.estado || 'activa',
          dias_registrados: c.dias, presentes: c.presente, atrasos: c.atraso, faltas: c.ausente, justificadas: c.justificado,
          pct_asistencia: pctAsistencia(c.presente, c.atraso, c.ausente)
        };
      });
      estudiantes = filtrarPorAsistencia(estudiantes, { soloConFaltas, pctMax }).map((e, i) => ({ n: i + 1, ...e }));
      return res.json({
        tipo, meta: { ...meta, total_estudiantes: estudiantes.length }, estudiantes,
        columnas: ['n', 'nombre_completo', 'sexo', 'faltas', 'atrasos', 'justificadas', 'pct_asistencia', 'observaciones_academicas', 'observaciones_comportamiento', 'firma_representante']
      });
    }

    // ===================== ASISTENCIA (grilla por día lectivo) =====================
    if (tipo === 'asistencia') {
      const celdas = await rpc('reporte_asistencia_grilla');
      const marca = { presente: '✓', ausente: 'F', atraso: 'A', justificado: 'J' };
      const porEst = new Map();
      for (const c of celdas) { if (!porEst.has(c.e)) porEst.set(c.e, {}); porEst.get(c.e)[c.f] = c.s; }
      let estudiantes = filas.map(m => {
        const dm = porEst.get(m.estudiante_id) || {};
        const marcas = {}; let faltas = 0, atrasos = 0, justificadas = 0, presentes = 0;
        for (const dia of diasLectivos) {
          const s = dm[dia]; marcas[dia] = marca[s] || '';
          if (s === 'ausente') faltas++; else if (s === 'justificado') justificadas++; else if (s === 'atraso') atrasos++; else if (s === 'presente') presentes++;
        }
        return { ...datosEst(m), marcas, faltas, atrasos, justificadas, presentes, pct_asistencia: pctAsistencia(presentes, atrasos, faltas), observaciones: '' };
      });
      estudiantes = filtrarPorAsistencia(estudiantes, { soloConFaltas, pctMax }).map((e, i) => ({ n: i + 1, ...e }));
      return res.json({ tipo: 'asistencia', meta: { ...meta, total_estudiantes: estudiantes.length, dias: diasLectivos }, estudiantes });
    }

    // ===================== RESUMEN CONSOLIDADO (inspector) =====================
    if (tipo === 'resumen_inspector') {
      const conteos = mapaConteos(await rpc('reporte_asistencia_estudiantes'));
      const r = resumenPorParalelo(filas, conteos);
      return res.json({ tipo, meta, resumen: r.resumen, por_curso: r.por_curso, totales: r.totales });
    }

    // ===================== RESUMEN POR MATERIA (docente; también lo puede ver la gestión) =====================
    let qc2 = supabase.from('docente_materia').select('id, paralelo_id, materia_id, materias(nombre), docentes(nombres, apellidos)')
      .in('paralelo_id', paralelosEnLista.length ? paralelosEnLista : ['00000000-0000-0000-0000-000000000000']);
    if (periodoId) qc2 = qc2.eq('periodo_id', periodoId);
    const { data: cargasRaw, error: errCg } = await qc2;
    if (errCg) throw new Error('docente_materia: ' + errCg.message);
    const infoPar = new Map(filas.map(m => [m.paralelo_id, m.paralelos]));
    const cargas = (cargasRaw || [])
      .filter(c => (!esDocente || misCargas.some(x => x.id === c.id)) && (!materia_id || c.materia_id === materia_id))
      .map(c => ({
        id: c.id, paralelo_id: c.paralelo_id, materia: c.materias?.nombre || '—', docente: nombreDe(c.docentes),
        curso: infoPar.get(c.paralelo_id)?.grados?.nombre || '', paralelo: infoPar.get(c.paralelo_id)?.nombre || '', jornada: infoPar.get(c.paralelo_id)?.jornada || ''
      }));
    const estPorPar = new Map();
    filas.forEach(m => estPorPar.set(m.paralelo_id, (estPorPar.get(m.paralelo_id) || 0) + 1));
    let porCarga = [];
    if (cargas.length && estudianteIds.length && diasLectivos.length) {
      const { data, error } = await supabase.rpc('reporte_asistencia_por_carga', {
        p_estudiantes: estudianteIds, p_desde: desde, p_hasta: hasta, p_dias: diasLectivos, p_dm: cargas.map(c => c.id)
      });
      if (error) throw new Error('reporte_asistencia_por_carga: ' + error.message);
      porCarga = data || [];
    }
    const r = resumenPorCarga(cargas, porCarga, estPorPar);
    return res.json({ tipo: 'resumen_docente', meta: { ...meta, alcance: esDocente ? 'solo las materias a cargo del docente' : alcance }, resumen: r.filas, totales: r.totales });
  } catch (e) {
    console.error('[reportes] error', e);
    return res.status(500).json({ error: 'Error interno al generar el listado.' });
  }
});
