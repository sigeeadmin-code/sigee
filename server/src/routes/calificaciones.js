import { Router } from 'express';
import { requireAuth } from '../lib/auth.js';
import { supabase } from '../lib/supabase.js';
import {
  TRIMESTRES, configPorDefecto, validarConfig, calcTrimestre, aplicarMejora, calcAnual, claseNivelEvaluacion
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
    .select('id, paralelo_id, periodo_id, docentes(profile_id), paralelo:paralelos!inner(id, grado:grados!inner(institucion_id, nivel, nombre))')
    .eq('id', docenteMateriaId).single();
  if (error || !data) return null;
  return {
    id: data.id, paraleloId: data.paralelo_id, periodoId: data.periodo_id,
    docenteProfileId: data.docentes?.profile_id || null,
    institucionId: data.paralelo.grado.institucion_id, nivel: data.paralelo.grado.nivel, nombreGrado: data.paralelo.grado.nombre,
    clase: claseNivelEvaluacion({ nivel: data.paralelo.grado.nivel, nombre: data.paralelo.grado.nombre })
  };
}

async function configEfectiva(institucionId, paraleloId, docenteMateriaId = null) {
  const { data } = await supabase.from('config_evaluacion')
    .select('paralelo_id, docente_materia_id, config').eq('institucion_id', institucionId);
  const filas = data || [];
  const deCarga = docenteMateriaId && filas.find(r => r.docente_materia_id === docenteMateriaId);
  const deParalelo = filas.find(r => !r.docente_materia_id && r.paralelo_id === paraleloId);
  const general = filas.find(r => !r.docente_materia_id && r.paralelo_id === null);
  return (deCarga || deParalelo || general)?.config || configPorDefecto();
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
  if (!carga.clase) {
    return res.status(422).json({ error: `Este módulo admite EGB Superior (8vo a 10mo) y Bachillerato; el curso es '${carga.nombreGrado}' (${carga.nivel || 'sin nivel'}). Los demás niveles se habilitan en fases siguientes.` });
  }

  // Los estudiantes deben tener matrícula activa en ESE paralelo y período
  const { data: mats, error: mErr } = await supabase.from('matriculas')
    .select('estudiante_id').eq('paralelo_id', carga.paraleloId).eq('periodo_id', carga.periodoId).eq('estado', 'activa');
  if (mErr) return res.status(500).json({ error: mErr.message });
  const permitidos = new Set((mats || []).map(m => m.estudiante_id));

  const cfg = await configEfectiva(carga.institucionId, carga.paraleloId, carga.id);
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
    .is('docente_materia_id', null)[paralelo_id ? 'eq' : 'is']('paralelo_id', paralelo_id).maybeSingle();
  const fila = { institucion_id: inst, paralelo_id, config, updated_by: req.profile.id, updated_at: new Date().toISOString() };
  const { error } = ya
    ? await supabase.from('config_evaluacion').update(fila).eq('id', ya.id)
    : await supabase.from('config_evaluacion').insert(fila);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// POST /calificaciones/supletorio
// body: { docente_materia_id, registros: [{ estudiante_id, supletorio: número | null }] }
// Solo se admite si el promedio anual del estudiante en esa materia está entre 5.00 y 6.99
// (se recalcula aquí con las notas guardadas; el cliente no decide quién rinde supletorio).
calificacionesRouter.post('/supletorio', requireAuth, async (req, res) => {
  const { docente_materia_id, registros } = req.body || {};
  if (!docente_materia_id || !Array.isArray(registros) || !registros.length) {
    return res.status(400).json({ error: 'Faltan docente_materia_id o registros.' });
  }
  if (!ROLES_ESCRITURA.includes(req.profile.rol)) {
    return res.status(403).json({ error: `Rol '${req.profile.rol}' no puede registrar supletorios.` });
  }
  const carga = await cargarCarga(docente_materia_id);
  if (!carga) return res.status(404).json({ error: 'Carga docente no encontrada.' });
  if (req.profile.rol !== 'super_admin' && carga.institucionId !== req.profile.institucion_id) {
    return res.status(403).json({ error: 'Esa carga académica no pertenece a tu institución.' });
  }
  if (req.profile.rol === 'docente' && carga.docenteProfileId !== req.profile.id) {
    return res.status(403).json({ error: 'Esa carga académica no te pertenece.' });
  }
  if (!carga.clase) {
    return res.status(422).json({ error: `Este módulo admite EGB Superior (8vo a 10mo) y Bachillerato; el curso es '${carga.nombreGrado}'.` });
  }

  const ids = registros.map(r => r.estudiante_id);
  const { data: notas, error: nErr } = await supabase.from('calificaciones')
    .select('estudiante_id, periodo_evaluativo, nota').eq('docente_materia_id', docente_materia_id).in('estudiante_id', ids);
  if (nErr) return res.status(500).json({ error: nErr.message });

  const guardar = [], borrar = [];
  for (const r of registros) {
    const trims = TRIMESTRES.map(t => {
      const n = (notas || []).find(x => x.estudiante_id === r.estudiante_id && x.periodo_evaluativo === t);
      return n ? Number(n.nota) : null;
    });
    const vacio = r.supletorio === null || r.supletorio === undefined || r.supletorio === '';
    if (vacio) { borrar.push(r.estudiante_id); continue; }
    if (!valorValido(r.supletorio)) return res.status(400).json({ error: `Nota de supletorio inválida (${r.supletorio}): debe estar entre 0 y 10.` });
    const anual = calcAnual(trims);
    if (anual.estado !== 'supletorio') {
      return res.status(422).json({ error: `El estudiante ${r.estudiante_id} no puede rendir supletorio en esta materia (estado: ${anual.estado}; el supletorio es para promedios de 4.01 a 6.99 con los 3 trimestres cerrados).` });
    }
    guardar.push({
      estudiante_id: r.estudiante_id, docente_materia_id, periodo_evaluativo: 'SUP',
      supletorio: Number(r.supletorio), registrado_por: req.profile.id, updated_at: new Date().toISOString()
    });
  }
  if (guardar.length) {
    const { error } = await supabase.from('calificaciones_mejoras')
      .upsert(guardar, { onConflict: 'estudiante_id,docente_materia_id,periodo_evaluativo' });
    if (error) return res.status(500).json({ error: error.message });
  }
  if (borrar.length) {
    const { error } = await supabase.from('calificaciones_mejoras').delete()
      .eq('docente_materia_id', docente_materia_id).eq('periodo_evaluativo', 'SUP').in('estudiante_id', borrar);
    if (error) return res.status(500).json({ error: error.message });
  }
  res.status(201).json({ guardados: guardar.length, eliminados: borrar.length });
});

// PUT /calificaciones/config-carga
// body: { docente_materia_id, casilleros: { ind:[n,...], grp:[n,...], sum:[n,...] } }
// El docente elige SOLO cuántos casilleros usa en cada rubro. Nombres y pesos se heredan de la
// configuración vigente del paralelo/institución (los pesos 70/30 los define administración).
// Nunca se permite reducir un rubro por debajo de la última casilla que ya tiene notas.
calificacionesRouter.put('/config-carga', requireAuth, async (req, res) => {
  const { docente_materia_id, casilleros } = req.body || {};
  if (!docente_materia_id || !casilleros) return res.status(400).json({ error: 'Faltan docente_materia_id o casilleros.' });
  if (!ROLES_ESCRITURA.includes(req.profile.rol)) return res.status(403).json({ error: 'Tu rol no puede configurar casilleros.' });
  const carga = await cargarCarga(docente_materia_id);
  if (!carga) return res.status(404).json({ error: 'Carga docente no encontrada.' });
  if (req.profile.rol !== 'super_admin' && carga.institucionId !== req.profile.institucion_id) {
    return res.status(403).json({ error: 'Esa carga académica no pertenece a tu institución.' });
  }
  if (req.profile.rol === 'docente' && carga.docenteProfileId !== req.profile.id) {
    return res.status(403).json({ error: 'Esa carga académica no te pertenece.' });
  }
  if (!carga.clase) return res.status(422).json({ error: 'Por ahora solo EGB Superior (8vo a 10mo) y Bachillerato.' });

  const base = await configEfectiva(carga.institucionId, carga.paraleloId, null);
  const nueva = JSON.parse(JSON.stringify(base));
  for (const tipo of TIPOS) {
    const ns = casilleros[tipo];
    if (!Array.isArray(ns) || ns.length !== base[tipo].length) {
      return res.status(400).json({ error: `Se esperaban ${base[tipo].length} valores en '${tipo}'.` });
    }
    ns.forEach((n, i) => { nueva[tipo][i].n = Number(n); });
  }
  const errores = validarConfig(nueva);
  if (errores.length) return res.status(400).json({ error: errores.join(' ') });

  // Protección de datos: no se puede quitar un casillero que ya tiene una nota guardada
  for (const tipo of TIPOS) {
    for (let g = 0; g < nueva[tipo].length; g++) {
      if (nueva[tipo][g].n >= 10) continue; // 10 es el máximo: no puede haber notas más allá
      const { count, error } = await supabase.from('calificaciones_aportes')
        .select('id', { count: 'exact', head: true })
        .eq('docente_materia_id', docente_materia_id).eq('tipo', tipo).eq('grupo', g).gte('actividad', nueva[tipo][g].n);
      if (error) return res.status(500).json({ error: error.message });
      if (count > 0) {
        return res.status(422).json({ error: `No se puede reducir '${nueva[tipo][g].nombre}' a ${nueva[tipo][g].n} casillero(s): ya hay ${count} nota(s) guardadas en casilleros posteriores. Bórralas primero si realmente quieres quitarlos.` });
      }
    }
  }

  const { data: ya } = await supabase.from('config_evaluacion').select('id')
    .eq('institucion_id', carga.institucionId).eq('docente_materia_id', docente_materia_id).maybeSingle();
  const fila = {
    institucion_id: carga.institucionId, paralelo_id: carga.paraleloId, docente_materia_id,
    config: nueva, updated_by: req.profile.id, updated_at: new Date().toISOString()
  };
  const { error } = ya
    ? await supabase.from('config_evaluacion').update(fila).eq('id', ya.id)
    : await supabase.from('config_evaluacion').insert(fila);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, config: nueva });
});
