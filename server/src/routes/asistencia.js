import { Router } from 'express';
import { requireAuth } from '../lib/auth.js';
import { evaluarDiaInstitucion } from '../lib/calendario.js';
import { supabase } from '../lib/supabase.js';

export const asistenciaRouter = Router();

const ESTADOS_VALIDOS = ['presente', 'ausente', 'atraso', 'justificado'];

// POST /asistencia
// body: { docente_materia_id, fecha, paralelo_id, registros: [{estudiante_id, estado}] }
// El backend vuelve a evaluar el calendario académico — nunca confía en que
// el frontend ya lo validó. Si el día no es lectivo, rechaza todo el lote.
asistenciaRouter.post('/', requireAuth, async (req, res) => {
  const { docente_materia_id, fecha, paralelo_id, registros } = req.body || {};
  if (!docente_materia_id || !fecha || !Array.isArray(registros) || registros.length === 0) {
    return res.status(400).json({ error: 'Faltan docente_materia_id, fecha o registros.' });
  }
  for (const r of registros) {
    if (!ESTADOS_VALIDOS.includes(r.estado)) {
      return res.status(400).json({ error: `Estado inválido '${r.estado}'. Debe ser uno de: ${ESTADOS_VALIDOS.join(', ')}` });
    }
  }

  try {
    const gate = await evaluarDiaInstitucion(req.profile.institucion_id, fecha, paralelo_id || null);
    if (!gate.ok) return res.status(422).json({ error: 'Día no lectivo: ' + gate.msg });
  } catch (err) {
    return res.status(500).json({ error: 'No se pudo validar el calendario: ' + err.message });
  }

  // Si es docente, confirma que esa carga (docente_materia) realmente es suya
  // antes de dejarlo escribir asistencia a nombre de otro.
  if (req.profile.rol === 'docente') {
    const { data: carga, error: eCarga } = await supabase
      .from('docente_materia').select('docente_id, docentes!inner(profile_id)')
      .eq('id', docente_materia_id).single();
    if (eCarga || !carga) return res.status(404).json({ error: 'Carga docente no encontrada.' });
    if (carga.docentes.profile_id !== req.profile.id) {
      return res.status(403).json({ error: 'Esa carga académica no te pertenece.' });
    }
  }

  const filas = registros.map(r => ({
    docente_materia_id, fecha, estudiante_id: r.estudiante_id, estado: r.estado,
    registrado_por: req.profile.id
  }));

  const { data, error } = await supabase
    .from('asistencia')
    .upsert(filas, { onConflict: 'estudiante_id,docente_materia_id,fecha' })
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ guardados: data.length, registros: data });
});

// GET /asistencia?docente_materia_id=&fecha=
asistenciaRouter.get('/', requireAuth, async (req, res) => {
  const { docente_materia_id, fecha } = req.query;
  if (!docente_materia_id || !fecha) return res.status(400).json({ error: 'Faltan docente_materia_id o fecha.' });
  const { data, error } = await supabase
    .from('asistencia').select('*')
    .eq('docente_materia_id', docente_materia_id).eq('fecha', fecha);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
