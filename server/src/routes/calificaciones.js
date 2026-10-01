import { Router } from 'express';
import { requireAuth } from '../lib/auth.js';
import { supabase } from '../lib/supabase.js';
import {
  TRIMESTRES, configPorDefecto, validarConfig, calcTrimestre, aplicarMejora
} from '../lib/calificaciones.js';

export const calificacionesRouter = Router();

const ROLES_ESCRITURA = ['docente', 'admin_plantel', 'secretario', 'super_admin'];
const ROLES_CONFIG = ['admin_plantel', 'secretario', 'super_admin'];
const TIPOS = ['ind', 'grp', 'sum'];

// El backend usa service_role (salta el RLS): TODA validación de institución,
// rol y pertenencia se hace a mano aquí.
async function cargarCarga(docenteMateriaId) {
  const { data, error } = await supabase
    .from('docente_materia')
    .select('id, paralelo_id, periodo_id, docentes(profile_id), paralelo:paralelos!inner(id, grado:grados!inner(institucion_id, nivel))')
    .eq('id', docenteMateriaId).single();
  if (error || !data) return null;
  return {
    id: data.id, paraleloId: data.paralelo_id, periodoId: data.periodo_id,
    docenteProfileId: data.docentes?.profile_id || null,
    institucionId: data.paralelo.grado.institucion_id, nivel: data.paralelo.grado.nivel
  };
}

async function configEfectiva(institucionId, paraleloId) {
  const { data } = await supabase.from('config_evaluacion')
    .select('paralelo_id, config').eq('institucion_id', institucionId);
  const propia = (data || []).find(r => r.paralelo_id === paraleloId);
  const general = (data || []).find(r => r.paralelo_id === null);
  return (propia || general)?.config || configPorDefecto();
}

const esVacio = v => v === null || v === undefined || v === '';
function valorValido(v) { const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= 10; }

// POST /calificaciones
// body: { docente_materia_id, periodo_evaluativo: 'T1'|'T2'|'T3',
//         registros: [{ estudiante_id, aportes: {ind:[[..]],grp:[[..]],sum:[[..]]},
//                       mejora: {mejora_directa, refuerzo, mejora_refuerzo} }] }
// El servidor RECALCULA la nota del trimestre; nunca confía en una nota enviada por el cliente.
calificacionesRouter.post('/', requireAuth, async (req, res) => {
  const { docente_materia_id, periodo_evaluativo, registros } = req.body || {};
  if (!docente_materia_id || !TRIMESTRES.includes(periodo_evaluativo) || !Array.isArray(registros) || !registros.length) {
    return res.status(400).json({ error: 'Faltan docente_materia_id, periodo_evaluativo (T1/T2/T3) o registros.' });
  }
  if (!ROLES_ESCRITURA.includes(req.profile.rol)) {
    return res.status(403).json({ error: `Rol '${req.profile.rol}' no puede registrar calificaciones.` });
  }
  const carga = await cargarCarga(docente_materia_id);
  if (!carga) return res.status(404).json({ error: 'Carga docente no encontrada.' });
  if (req.profile.rol !== 'super_admin' && carga.institucionId !== req.profile.institucion_id) {
    return res.status(403).json({ error: 'Esa carga académica no pertenece a tu institución.' });
  }
  if (req.profile.rol === 'docente' && carga.docenteProfileId !== req.profile.id) {
    return res.status(403).json({ error: 'Esa carga académica no te pertenece.' });
  }
  if (carga.nivel !== 'BGU') {
    return res.status(422).json({ error: `Este módulo solo admite Bachillerato (BGU); el curso es '${carga.nivel}'. Los demás niveles se habilitan en fases siguientes.` });
  }

  // Los estudiantes deben tener matrícula activa en ESE paralelo y período
  const { data: mats, error: mErr } = await supabase.from('matriculas')
    .select('estudiante_id').eq('paralelo_id', carga.paraleloId).eq('periodo_id', carga.periodoId).eq('estado', 'activa');
  if (mErr) return res.status(500).json({ error: mErr.message });
  const permitidos = new Set((mats || []).map(m => m.estudiante_id));

  const cfg = await configEfectiva(carga.institucionId, carga.paraleloId);
  const errCfg = validarConfig(cfg);
  if (errCfg.length) return res.status(500).json({ error: 'Configuración de evaluación inválida: ' + errCfg.join(' ') });

  const filasAportes = [], filasMejoras = [], filasCalif = [];
  const idsBorrarMejora = [], idsBorrarCalif = [], idsEstudiantes = [];
  const llavesNuevas = new Set();
  const regPor = req.profile.id;

  for (const r of registros) {
    if (!permitidos.has(r.estudiante_id)) {
      return res.status(422).json({ error: `El estudiante ${r.estudiante_id} no está matriculado en este paralelo.` });
    }
    idsEstudiantes.push(r.estudiante_id);
    const ap = r.aportes || {};
    for (const tipo of TIPOS) {
      const grupos = ap[tipo] || [];
      if (grupos.length > cfg[tipo].length) return res.status(400).json({ error: `Demasiados grupos en '${tipo}'.` });
      for (let g = 0; g < grupos.length; g++) {
        const celdas = grupos[g] || [];
        if (celdas.length > cfg[tipo][g].n) return res.status(400).json({ error: `El grupo '${cfg[tipo][g].nombre}' admite máximo ${cfg[tipo][g].n} notas.` });
        for (let a = 0; a < celdas.length; a++) {
          if (esVacio(celdas[a])) continue;
          if (!valorValido(celdas[a])) return res.status(400).json({ error: `Nota inválida (${celdas[a]}): debe estar entre 0 y 10.` });
          filasAportes.push({
            estudiante_id: r.estudiante_id, docente_materia_id, periodo_evaluativo,
            tipo, grupo: g, actividad: a, valor: Number(celdas[a]), registrado_por: regPor, updated_at: new Date().toISOString()
          });
          llavesNuevas.add(`${r.estudiante_id}|${tipo}|${g}|${a}`);
        }
      }
    }
    const mj = r.mejora || {};
    for (const k of ['mejora_directa', 'refuerzo', 'mejora_refuerzo']) {
      if (!esVacio(mj[k]) && !valorValido(mj[k])) return res.status(400).json({ error: `Valor inválido en ${k}.` });
    }
    const hayMejora = ['mejora_directa', 'refuerzo', 'mejora_refuerzo'].some(k => !esVacio(mj[k]));
    if (hayMejora) {
      filasMejoras.push({
        estudiante_id: r.estudiante_id, docente_materia_id, periodo_evaluativo,
        mejora_directa: esVacio(mj.mejora_directa) ? null : Number(mj.mejora_directa),
        refuerzo: esVacio(mj.refuerzo) ? null : Number(mj.refuerzo),
        mejora_refuerzo: esVacio(mj.mejora_refuerzo) ? null : Number(mj.mejora_refuerzo),
        registrado_por: regPor, updated_at: new Date().toISOString()
      });
    } else idsBorrarMejora.push(r.estudiante_id);

    const calc = calcTrimestre(ap, cfg);
    if (calc.completo) {
      filasCalif.push({
        estudiante_id: r.estudiante_id, docente_materia_id, periodo_evaluativo,
        nota: aplicarMejora(calc.nota, mj), registrado_por: regPor
      });
    } else idsBorrarCalif.push(r.estudiante_id);
  }

  // 1) Aportes: upsert de lo enviado + borrar celdas que quedaron vacías
  if (filasAportes.length) {
    const { error } = await supabase.from('calificaciones_aportes')
      .upsert(filasAportes, { onConflict: 'estudiante_id,docente_materia_id,periodo_evaluativo,tipo,grupo,actividad' });
    if (error) return res.status(500).json({ error: 'Aportes: ' + error.message });
  }
  const { data: existentes, error: eErr } = await supabase.from('calificaciones_aportes')
    .select('id, estudiante_id, tipo, grupo, actividad')
    .eq('docente_materia_id', docente_materia_id).eq('periodo_evaluativo', periodo_evaluativo).in('estudiante_id', idsEstudiantes);
  if (eErr) return res.status(500).json({ error: eErr.message });
  const idsVaciar = (existentes || []).filter(x => !llavesNuevas.has(`${x.estudiante_id}|${x.tipo}|${x.grupo}|${x.actividad}`)).map(x => x.id);
  if (idsVaciar.length) {
    const { error } = await supabase.from('calificaciones_aportes').delete().in('id', idsVaciar);
    if (error) return res.status(500).json({ error: error.message });
  }

  // 2) Mejoras
  if (filasMejoras.length) {
    const { error } = await supabase.from('calificaciones_mejoras')
      .upsert(filasMejoras, { onConflict: 'estudiante_id,docente_materia_id,periodo_evaluativo' });
    if (error) return res.status(500).json({ error: 'Mejoras: ' + error.message });
  }
  if (idsBorrarMejora.length) {
    await supabase.from('calificaciones_mejoras').delete()
      .eq('docente_materia_id', docente_materia_id).eq('periodo_evaluativo', periodo_evaluativo).in('estudiante_id', idsBorrarMejora);
  }

  // 3) Nota del trimestre (la que leen dashboards, boletas y reportes): solo si es definitiva
  if (filasCalif.length) {
    const { error } = await supabase.from('calificaciones')
      .upsert(filasCalif, { onConflict: 'estudiante_id,docente_materia_id,periodo_evaluativo' });
    if (error) return res.status(500).json({ error: 'Calificaciones: ' + error.message });
  }
  if (idsBorrarCalif.length) {
    await supabase.from('calificaciones').delete()
      .eq('docente_materia_id', docente_materia_id).eq('periodo_evaluativo', periodo_evaluativo).in('estudiante_id', idsBorrarCalif);
  }

  res.status(201).json({
    estudiantes: registros.length, aportes: filasAportes.length,
    notas_definitivas: filasCalif.length, notas_pendientes: idsBorrarCalif.length
  });
});

// PUT /calificaciones/config  body: { paralelo_id|null, config }
calificacionesRouter.put('/config', requireAuth, async (req, res) => {
  if (!ROLES_CONFIG.includes(req.profile.rol)) return res.status(403).json({ error: 'Solo administración puede cambiar la configuración de evaluación.' });
  const { paralelo_id = null, config } = req.body || {};
  const errores = validarConfig(config);
  if (errores.length) return res.status(400).json({ error: errores.join(' ') });
  if (paralelo_id) {
    const { data } = await supabase.from('paralelos').select('id, grado:grados!inner(institucion_id)').eq('id', paralelo_id).single();
    if (!data || (req.profile.rol !== 'super_admin' && data.grado.institucion_id !== req.profile.institucion_id)) {
      return res.status(403).json({ error: 'Ese paralelo no pertenece a tu institución.' });
    }
  }
  const inst = req.profile.institucion_id;
  const { data: ya } = await supabase.from('config_evaluacion').select('id').eq('institucion_id', inst)
    [paralelo_id ? 'eq' : 'is']('paralelo_id', paralelo_id).maybeSingle();
  const fila = { institucion_id: inst, paralelo_id, config, updated_by: req.profile.id, updated_at: new Date().toISOString() };
  const { error } = ya
    ? await supabase.from('config_evaluacion').update(fila).eq('id', ya.id)
    : await supabase.from('config_evaluacion').insert(fila);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});
