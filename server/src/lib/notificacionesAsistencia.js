// Notificaciones automáticas al registrar falta (ausente) o atraso.
// Usa Resend (correo.js). Diseñado para extenderse a In-App y Web Push.
import { supabase } from './supabase.js';
import { correoConfigurado, enviarCorreo, correoValido } from './correo.js';

const ESTADOS_AVISO = new Set(['ausente', 'atraso']);

function fechaCorta(f) {
  if (!f || typeof f !== 'string') return '—';
  const [y, m, d] = f.split('-');
  return `${d}/${m}/${y}`;
}

function etiquetaEstado(estado) {
  return estado === 'atraso' ? 'atraso' : 'falta';
}

/**
 * Arma el asunto y el cuerpo del correo de aviso de asistencia.
 */
export function plantillaAvisoAsistencia({ estudianteNombre, curso, materia, docenteNombre, fecha, estado, institucionNombre }) {
  const tipo = etiquetaEstado(estado);
  const asunto = `Aviso de asistencia – ${estudianteNombre} – ${curso || ''}`.trim().slice(0, 200);
  const texto =
    `Estimado/a representante:\n\n` +
    `Le informamos que el estudiante ${estudianteNombre}` +
    (curso ? ` del curso ${curso}` : '') +
    ` registró ${tipo}` +
    (materia ? ` en la materia de ${materia}` : '') +
    (docenteNombre ? ` (Docente: ${docenteNombre})` : '') +
    ` el día ${fechaCorta(fecha)}.\n\n` +
    (tipo === 'falta'
      ? 'Por favor, justifique la novedad a la brevedad posible a través de los canales oficiales del colegio.\n\n'
      : 'Le solicitamos tomar las medidas correspondientes para evitar que esta situación se repita.\n\n') +
    `Atentamente,\n${institucionNombre || 'La institución educativa'}`;

  const html =
    `<p>Estimado/a representante:</p>` +
    `<p>Le informamos que el estudiante <strong>${escapeHtml(estudianteNombre)}</strong>` +
    (curso ? ` del curso <strong>${escapeHtml(curso)}</strong>` : '') +
    ` registró <strong>${tipo}</strong>` +
    (materia ? ` en la materia de <strong>${escapeHtml(materia)}</strong>` : '') +
    (docenteNombre ? ` (Docente: ${escapeHtml(docenteNombre)})` : '') +
    ` el día <strong>${fechaCorta(fecha)}</strong>.</p>` +
    `<p>${tipo === 'falta'
      ? 'Por favor, justifique la novedad a la brevedad posible a través de los canales oficiales del colegio.'
      : 'Le solicitamos tomar las medidas correspondientes para evitar que esta situación se repita.'}</p>` +
    `<p>Atentamente,<br/><strong>${escapeHtml(institucionNombre || 'La institución educativa')}</strong></p>`;

  return { asunto, texto, html };
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Dado el lote de registros ya guardados, envía correo a los representantes
 * de quienes tienen estado ausente o atraso. No bloquea el guardado si el
 * correo falla: solo reporta resultados.
 *
 * @returns {{ enviados: number, fallidos: number, omitidos: number, detalle: Array }}
 */
export async function notificarFaltasYAtrasos({ institucionId, docenteMateriaId, fecha, registrosGuardados, registradoPor }) {
  const resultado = { enviados: 0, fallidos: 0, omitidos: 0, detalle: [] };

  const novedades = (registrosGuardados || []).filter(r => ESTADOS_AVISO.has(r.estado));
  if (!novedades.length) return resultado;

  if (!correoConfigurado()) {
    resultado.omitidos = novedades.length;
    resultado.detalle.push({ motivo: 'Correo no configurado en el servidor (RESEND_API_KEY / MAIL_FROM).' });
    return resultado;
  }

  // Contexto de la clase (materia, curso, docente, institución)
  const { data: dm } = await supabase
    .from('docente_materia')
    .select(`
      id,
      materias(nombre),
      docentes(nombres, apellidos),
      paralelo:paralelos(nombre, grado:grados(nombre, institucion_id, instituciones(nombre)))
    `)
    .eq('id', docenteMateriaId)
    .single();

  const materiaNombre = dm?.materias?.nombre || '';
  const docenteNombre = dm?.docentes
    ? `${dm.docentes.apellidos || ''} ${dm.docentes.nombres || ''}`.trim()
    : '';
  const cursoNombre = dm?.paralelo?.grado?.nombre && dm?.paralelo?.nombre
    ? `${dm.paralelo.grado.nombre} ${dm.paralelo.nombre}`.trim()
    : (dm?.paralelo?.grado?.nombre || '');
  const institucionNombre = dm?.paralelo?.grado?.instituciones?.nombre || '';

  const estudianteIds = [...new Set(novedades.map(r => r.estudiante_id))];

  // Estudiantes
  const { data: estudiantes } = await supabase
    .from('estudiantes')
    .select('id, nombres, apellidos')
    .in('id', estudianteIds);
  const estById = Object.fromEntries((estudiantes || []).map(e => [e.id, e]));

  // Representantes (email)
  const { data: vinculos } = await supabase
    .from('representantes_estudiantes')
    .select('estudiante_id, representantes(id, nombres, apellidos, email)')
    .in('estudiante_id', estudianteIds);

  const repPorEst = {};
  for (const v of vinculos || []) {
    const email = String(v.representantes?.email || '').trim().toLowerCase();
    if (!correoValido(email)) continue;
    if (!repPorEst[v.estudiante_id]) repPorEst[v.estudiante_id] = [];
    if (!repPorEst[v.estudiante_id].includes(email)) {
      repPorEst[v.estudiante_id].push(email);
    }
  }

  for (const reg of novedades) {
    const est = estById[reg.estudiante_id];
    const nombreEst = est
      ? `${est.apellidos || ''} ${est.nombres || ''}`.trim()
      : 'Estudiante';
    const destinos = (repPorEst[reg.estudiante_id] || []).slice(0, 2);

    if (!destinos.length) {
      resultado.omitidos++;
      resultado.detalle.push({
        estudiante_id: reg.estudiante_id,
        nombre: nombreEst,
        estado: reg.estado,
        motivo: 'Sin correo válido del representante'
      });
      continue;
    }

    const { asunto, texto, html } = plantillaAvisoAsistencia({
      estudianteNombre: nombreEst,
      curso: cursoNombre,
      materia: materiaNombre,
      docenteNombre,
      fecha,
      estado: reg.estado,
      institucionNombre
    });

    try {
      await enviarCorreo({
        to: destinos,
        subject: asunto,
        html,
        text: texto,
        nombreRemitente: institucionNombre || 'Asistencia'
      });
      resultado.enviados++;
      resultado.detalle.push({
        estudiante_id: reg.estudiante_id,
        nombre: nombreEst,
        estado: reg.estado,
        destinos,
        ok: true
      });

      // Constancia en avisos_inasistencia (si la tabla existe y acepta el insert)
      try {
        await supabase.from('avisos_inasistencia').insert({
          institucion_id: institucionId,
          estudiante_id: reg.estudiante_id,
          fecha,
          mensaje: texto.slice(0, 2000),
          enviado_por: registradoPor || null,
          enviado_at: new Date().toISOString(),
          canal: 'email'
        });
      } catch (e) {
        // No fallar el flujo si el log no se puede guardar
        console.warn('[notificacionesAsistencia] no se pudo registrar aviso:', e?.message || e);
      }
    } catch (err) {
      resultado.fallidos++;
      resultado.detalle.push({
        estudiante_id: reg.estudiante_id,
        nombre: nombreEst,
        estado: reg.estado,
        destinos,
        ok: false,
        error: err.message || String(err)
      });
      console.error('[notificacionesAsistencia] fallo envío', reg.estudiante_id, err.message);
    }
  }

  return resultado;
}
