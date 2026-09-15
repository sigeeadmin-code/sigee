import { Router } from 'express';
import { requireAuth } from '../lib/auth.js';
import { evaluarDiaInstitucion, TIPOS_EVENTO } from '../lib/calendario.js';
import { supabase } from '../lib/supabase.js';

export const calendarioRouter = Router();

// GET /calendario/dia?fecha=2026-03-10&paralelo_id=uuid
// Evalúa si `fecha` es lectiva para la institución del usuario autenticado.
calendarioRouter.get('/dia', requireAuth, async (req, res) => {
  const { fecha, paralelo_id } = req.query;
  if (!fecha) return res.status(400).json({ error: 'Falta el parámetro fecha (YYYY-MM-DD).' });
  try {
    const resultado = await evaluarDiaInstitucion(req.profile.institucion_id, fecha, paralelo_id || null);
    res.json(resultado);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /calendario/eventos — crear feriado/vacación/excepción/recuperación/evento
calendarioRouter.post('/eventos', requireAuth, async (req, res) => {
  const { tipo, fecha_inicio, fecha_fin, descripcion, paralelo_id, periodo_id } = req.body || {};
  if (!TIPOS_EVENTO.includes(tipo)) return res.status(400).json({ error: 'Tipo inválido. Debe ser uno de: ' + TIPOS_EVENTO.join(', ') });
  if (!fecha_inicio || !fecha_fin) return res.status(400).json({ error: 'Faltan fecha_inicio/fecha_fin.' });
  if (fecha_inicio > fecha_fin) return res.status(400).json({ error: 'La fecha de inicio no puede ser posterior a la de fin.' });

  const rolesQuePuedenEditarCalendario = ['super_admin', 'admin_plantel', 'supervisor_plantel', 'secretario'];
  if (!rolesQuePuedenEditarCalendario.includes(req.profile.rol)) {
    return res.status(403).json({ error: `Tu rol (${req.profile.rol}) no puede modificar el calendario académico.` });
  }

  const { data, error } = await supabase.from('calendario_eventos').insert({
    institucion_id: req.profile.institucion_id,
    periodo_id: periodo_id || null,
    tipo, fecha_inicio, fecha_fin,
    descripcion: descripcion?.trim() || null,
    paralelo_id: paralelo_id || null,
    created_by: req.profile.id
  }).select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

calendarioRouter.delete('/eventos/:id', requireAuth, async (req, res) => {
  const rolesQuePuedenEditarCalendario = ['super_admin', 'admin_plantel', 'supervisor_plantel', 'secretario'];
  if (!rolesQuePuedenEditarCalendario.includes(req.profile.rol)) {
    return res.status(403).json({ error: `Tu rol (${req.profile.rol}) no puede modificar el calendario académico.` });
  }
  // Verifica que el evento pertenezca a la institución del usuario antes de borrar.
  const { data: ev, error: e1 } = await supabase.from('calendario_eventos').select('institucion_id').eq('id', req.params.id).single();
  if (e1 || !ev) return res.status(404).json({ error: 'Evento no encontrado.' });
  if (ev.institucion_id !== req.profile.institucion_id) return res.status(403).json({ error: 'Ese evento no pertenece a tu institución.' });

  const { error } = await supabase.from('calendario_eventos').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).end();
});
