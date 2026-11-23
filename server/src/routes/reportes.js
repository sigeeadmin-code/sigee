import { Router } from 'express';
import { requireAuth, requireRole } from '../lib/auth.js';
import { supabase } from '../lib/supabase.js';

export const reportesRouter = Router();

/**
 * POST /reportes/listados
 * Body:
 * {
 *   tipo: 'asistencia' | 'nomina_oficial' | 'junta_curso' | 'resumen_inspector',
 *   paralelo_id?: string,
 *   grado_id?: string,
 *   tutor_id?: string,          // id del docente tutor (docentes.id)
 *   jornada?: string,
 *   anio_lectivo?: string,
 *   sexo?: 'M' | 'F',
 *   estado?: string,            // activa, retirada, etc.
 *   fecha_inicio?: 'YYYY-MM-DD',
 *   fecha_fin?: 'YYYY-MM-DD',
 *   semana?: 'YYYY-MM-DD'       // cualquier día de la semana deseada
 * }
 *
 * Devuelve datos estructurados listos para generar Excel/PDF en el frontend.
 */
// Solo personal con función de gestión. El docente solo ve los paralelos donde es tutor (se fuerza más abajo).
// Estudiantes, padres, contadores, administrativos y DECE no tienen acceso a estos listados.
const ROLES_LISTADOS = ['super_admin', 'admin_plantel', 'secretario', 'inspector_general', 'supervisor_plantel', 'docente'];
const TIPOS_DOCENTE = ['asistencia', 'nomina_oficial', 'junta_curso'];

reportesRouter.post('/listados', requireAuth, requireRole(...ROLES_LISTADOS), async (req, res) => {
  try {
    const {
      tipo = 'nomina_oficial',
      paralelo_id,
      grado_id,
      tutor_id,
      jornada,
      anio_lectivo,
      sexo,
      estado = 'activa',
      fecha_inicio,
      fecha_fin,
      semana
    } = req.body || {};

    const tiposValidos = ['asistencia', 'nomina_oficial', 'junta_curso', 'resumen_inspector'];
    if (!tiposValidos.includes(tipo)) {
      return res.status(400).json({ error: `tipo inválido. Use: ${tiposValidos.join(', ')}` });
    }

    // La institución sale SIEMPRE del perfil del token. Solo el super_admin sin plantel puede elegirla (body.institucion_id).
    let institucionId = req.profile.institucion_id;
    if (!institucionId && req.profile.rol === 'super_admin') institucionId = req.body?.institucion_id || null;
    if (!institucionId) {
      return res.status(req.profile.rol === 'super_admin' ? 400 : 403).json({
        error: req.profile.rol === 'super_admin'
          ? 'Indique institucion_id: el listado se genera por plantel.'
          : 'Usuario sin institución asignada.'
      });
    }

    // Docente: solo los paralelos donde es tutor.
    let paralelosPermitidos = null;
    if (req.profile.rol === 'docente') {
      if (!TIPOS_DOCENTE.includes(tipo)) return res.status(403).json({ error: 'Tu rol no puede generar este tipo de listado.' });
      const { data: doc } = await supabase.from('docentes').select('id').eq('profile_id', req.profile.id).eq('institucion_id', institucionId).maybeSingle();
      if (!doc) return res.status(403).json({ error: 'No se encontró tu ficha de docente.' });
      const { data: misPar } = await supabase.from('paralelos').select('id').eq('tutor_docente_id', doc.id);
      paralelosPermitidos = (misPar || []).map(x => x.id);
      if (!paralelosPermitidos.length) return res.status(403).json({ error: 'No eres tutor de ningún paralelo.' });
    }

    // Resolver rango de fechas
    let desde = fecha_inicio;
    let hasta = fecha_fin;

    if (semana) {
      const d = new Date(semana + 'T12:00:00');
      const day = d.getDay(); // 0=domingo
      const diffLunes = day === 0 ? -6 : 1 - day;
      const lunes = new Date(d);
      lunes.setDate(d.getDate() + diffLunes);
      const viernes = new Date(lunes);
      viernes.setDate(lunes.getDate() + 4);
      desde = lunes.toISOString().slice(0, 10);
      hasta = viernes.toISOString().slice(0, 10);
    }

    if (!desde || !hasta) {
      // Por defecto: mes actual
      const ahora = new Date();
      desde = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString().slice(0, 10);
      hasta = ahora.toISOString().slice(0, 10);
    }

    // 1. Obtener estudiantes matriculados con filtros
    let queryMat = supabase
      .from('matriculas')
      .select(`
        id,
        estado,
        estudiante_id,
        paralelo_id,
        grado_id,
        periodo_id,
        estudiantes!inner (
          id, institucion_id, cedula, nombres, apellidos, genero, activo
        ),
        paralelos (
          id, nombre, jornada, tutor_docente_id,
          grados ( id, nombre )
        )
      `)
      .eq('estado', estado || 'activa');

    queryMat = queryMat.eq('estudiantes.institucion_id', institucionId);
    if (paralelosPermitidos) queryMat = queryMat.in('paralelo_id', paralelosPermitidos);

    if (paralelo_id) queryMat = queryMat.eq('paralelo_id', paralelo_id);
    if (grado_id) queryMat = queryMat.eq('grado_id', grado_id);

    const { data: matriculas, error: errMat } = await queryMat;
    if (errMat) {
      console.error('[reportes] matriculas', errMat.message);
      return res.status(500).json({ error: 'Error al consultar matrículas: ' + errMat.message });
    }

    let filas = (matriculas || []).filter(m => m.estudiantes);

    // Filtros adicionales en memoria (más flexibles)
    if (jornada) {
      filas = filas.filter(m => (m.paralelos?.jornada || '').toLowerCase() === jornada.toLowerCase());
    }
    if (sexo) {
      filas = filas.filter(m => (m.estudiantes.genero || '').toUpperCase().startsWith(sexo.toUpperCase()));
    }
    if (tutor_id) {
      filas = filas.filter(m => m.paralelos?.tutor_docente_id === tutor_id);
    }

    // Orden alfabético por apellidos + nombres
    filas.sort((a, b) => {
      const na = `${a.estudiantes.apellidos || ''} ${a.estudiantes.nombres || ''}`.trim().toLowerCase();
      const nb = `${b.estudiantes.apellidos || ''} ${b.estudiantes.nombres || ''}`.trim().toLowerCase();
      return na.localeCompare(nb, 'es');
    });

    // Datos de la institución
    const { data: institucion } = await supabase
      .from('instituciones')
      .select('id, nombre, amie, regimen')
      .eq('id', institucionId)
      .maybeSingle();

    // Resolver nombre del tutor si hay un solo paralelo
    let tutorNombre = null;
    const tutoresUnicos = new Set(filas.map(m => m.paralelos?.tutor_docente_id));
    if (filas.length && tutoresUnicos.size === 1 && filas[0].paralelos?.tutor_docente_id) {
      const tid = filas[0].paralelos.tutor_docente_id;
      const { data: tutorProf } = await supabase
        .from('docentes')
        .select('nombres, apellidos')
        .eq('id', tid)
        .maybeSingle();
      if (tutorProf) {
        tutorNombre = `${tutorProf.apellidos || ''} ${tutorProf.nombres || ''}`.trim();
      }
    }

    const meta = {
      institucion: institucion ? {
        nombre: institucion.nombre,
        amie: institucion.amie,
        regimen: institucion.regimen
      } : null,
      rango: { desde, hasta },
      generado_en: new Date().toISOString(),
      total_estudiantes: filas.length,
      tutor: tutorNombre,
      filtros: { paralelo_id, grado_id, tutor_id, jornada, anio_lectivo, sexo, estado, tipo }
    };

    // ===================== SEGÚN TIPO =====================

    if (tipo === 'nomina_oficial' || tipo === 'junta_curso') {
      const estudiantes = filas.map((m, i) => ({
        n: i + 1,
        cedula: m.estudiantes.cedula || '',
        apellidos: m.estudiantes.apellidos || '',
        nombres: m.estudiantes.nombres || '',
        nombre_completo: `${m.estudiantes.apellidos || ''} ${m.estudiantes.nombres || ''}`.trim(),
        sexo: (m.estudiantes.genero || '').toUpperCase().startsWith('F') ? 'F' :
              (m.estudiantes.genero || '').toUpperCase().startsWith('M') ? 'M' : '',
        estado_matricula: m.estado || 'activa',
        curso: m.paralelos?.grados?.nombre || '',
        paralelo: m.paralelos?.nombre || '',
        jornada: m.paralelos?.jornada || ''
      }));

      return res.json({
        tipo,
        meta,
        estudiantes,
        // Columnas sugeridas para el Excel
        columnas: tipo === 'junta_curso'
          ? ['n', 'nombre_completo', 'sexo', 'observaciones_academicas', 'observaciones_comportamiento', 'firma_representante']
          : ['n', 'cedula', 'nombre_completo', 'sexo', 'estado_matricula']
      });
    }

    if (tipo === 'asistencia') {
      // Traer registros de asistencia del rango
      const estudianteIds = filas.map(m => m.estudiante_id);
      let registros = [];

      if (estudianteIds.length) {
        // Buscamos asistencia de esos estudiantes en el rango (por cualquier materia del paralelo)
        // PostgREST corta en 1.000 filas: se pagina por bloques de estudiantes y por rango.
        for (let i = 0; i < estudianteIds.length; i += 100) {
          const bloque = estudianteIds.slice(i, i + 100);
          for (let desdeFila = 0; ; desdeFila += 1000) {
            const { data: asist, error: errAs } = await supabase
              .from('asistencia')
              .select('estudiante_id, fecha, estado, observacion')
              .in('estudiante_id', bloque)
              .gte('fecha', desde)
              .lte('fecha', hasta)
              .order('fecha')
              .order('id')
              .range(desdeFila, desdeFila + 999);
            if (errAs) return res.status(500).json({ error: 'Error al consultar asistencia: ' + errAs.message });
            registros.push(...(asist || []));
            if (!asist || asist.length < 1000) break;
          }
        }
      }

      // Generar lista de días laborables del rango
      const dias = [];
      const d = new Date(desde + 'T12:00:00');
      const fin = new Date(hasta + 'T12:00:00');
      while (d <= fin) {
        const dow = d.getDay();
        if (dow !== 0 && dow !== 6) { // L-V
          dias.push(d.toISOString().slice(0, 10));
        }
        d.setDate(d.getDate() + 1);
      }

      const porEstudiante = {};
      registros.forEach(r => {
        if (!porEstudiante[r.estudiante_id]) porEstudiante[r.estudiante_id] = {};
        // Si hay varios registros el mismo día (distintas materias), priorizamos ausente > atraso > presente
        const actual = porEstudiante[r.estudiante_id][r.fecha];
        const prioridad = { ausente: 3, justificado: 2, atraso: 1, presente: 0 };
        if (!actual || (prioridad[r.estado] || 0) > (prioridad[actual] || 0)) {
          porEstudiante[r.estudiante_id][r.fecha] = r.estado;
        }
      });

      const mapaEstado = {
        presente: '✓',
        ausente: 'F',
        atraso: 'A',
        justificado: 'J'
      };

      const estudiantes = filas.map((m, i) => {
        const diasMap = porEstudiante[m.estudiante_id] || {};
        let faltas = 0, atrasos = 0;
        const marcas = {};

        dias.forEach(dia => {
          const est = diasMap[dia] || '';
          marcas[dia] = mapaEstado[est] || '';
          if (est === 'ausente' || est === 'justificado') faltas++;
          if (est === 'atraso') atrasos++;
        });

        return {
          n: i + 1,
          cedula: m.estudiantes.cedula || '',
          nombre_completo: `${m.estudiantes.apellidos || ''} ${m.estudiantes.nombres || ''}`.trim(),
          sexo: (m.estudiantes.genero || '').toUpperCase().startsWith('F') ? 'F' : (m.estudiantes.genero || '').toUpperCase().startsWith('M') ? 'M' : '',
          curso: m.paralelos?.grados?.nombre || '',
          paralelo: m.paralelos?.nombre || '',
          marcas,
          faltas,
          atrasos,
          observaciones: ''
        };
      });

      return res.json({
        tipo: 'asistencia',
        meta: { ...meta, dias },
        estudiantes
      });
    }

    if (tipo === 'resumen_inspector') {
      // Agrupar por paralelo
      const porParalelo = {};

      filas.forEach(m => {
        const key = m.paralelo_id;
        if (!porParalelo[key]) {
          porParalelo[key] = {
            paralelo_id: key,
            curso: m.paralelos?.grados?.nombre || '',
            paralelo: m.paralelos?.nombre || '',
            jornada: m.paralelos?.jornada || '',
            tutor_id: m.paralelos?.tutor_docente_id || null,
            total: 0,
            hombres: 0,
            mujeres: 0,
            estudiantes_ids: []
          };
        }
        const g = porParalelo[key];
        g.total++;
        const gen = (m.estudiantes.genero || '').toUpperCase();
        if (gen.startsWith('M')) g.hombres++;
        else if (gen.startsWith('F')) g.mujeres++;
        g.estudiantes_ids.push(m.estudiante_id);
      });

      // Calcular % asistencia aproximado por paralelo (opcional, si hay datos)
      const resumen = Object.values(porParalelo).map(p => ({
        curso: p.curso,
        paralelo: p.paralelo,
        jornada: p.jornada,
        total_estudiantes: p.total,
        hombres: p.hombres,
        mujeres: p.mujeres,
        pct_asistencia: null, // se puede enriquecer después
        faltas_justificadas: null,
        faltas_injustificadas: null,
        estudiantes_recurrentes: null
      }));

      // Ordenar
      resumen.sort((a, b) => (a.curso + a.paralelo).localeCompare(b.curso + b.paralelo, 'es'));

      return res.json({
        tipo: 'resumen_inspector',
        meta,
        resumen
      });
    }

    return res.status(400).json({ error: 'Tipo no implementado.' });

  } catch (err) {
    console.error('[reportes/listados]', err);
    return res.status(500).json({ error: 'Error interno al generar el listado: ' + (err.message || String(err)) });
  }
});
