// Notificaciones automáticas al registrar falta (ausente) o atraso.
// - Email al representante (Resend)
// - Notificación In-App para Inspección y Administración (tabla notificaciones)
import { supabase } from './supabase.js';
import { correoConfigurado, enviarCorreo, correoValido } from './correo.js';
import { estadoDemoInstitucion } from './demo.js';

const ESTADOS_AVISO = new Set(['ausente', 'atraso']);

function fechaCorta(f) {
  if (!f || typeof f !== 'string') return '—';
  const [y, m, d] = f.split('-');
  return `${d}/${m}/${y}`;
}

function etiquetaEstado(estado) {
  return estado === 'atraso' ? 'atraso' : 'falta';
}

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
 * Crea una notificación In-App para el personal del plantel (inspección + admin).
 * Una sola notificación por lote de faltas/atrasos del mismo guardado.
 */
async function crearNotificacionInApp({ institucionId, fecha, cursoNombre, materiaNombre, docenteNombre, novedades, estById, registradoPor }) {
  if (!novedades.length) return null;

  const lineas = novedades.map(r => {
    const est = estById[r.estudiante_id];
    const nombre = est ? `${est.apellidos || ''} ${est.nombres || ''}`.trim() : 'Estudiante';
    return `• ${nombre}: ${etiquetaEstado(r.estado)}`;
  });

  const nFaltas = novedades.filter(r => r.estado === 'ausente').length;
  const nAtrasos = novedades.filter(r => r.estado === 'atraso').length;
  const partes = [];
  if (nFaltas) partes.push(`${nFaltas} falta${nFaltas === 1 ? '' : 's'}`);
  if (nAtrasos) partes.push(`${nAtrasos} atraso${nAtrasos === 1 ? '' : 's'}`);

  const titulo = `Asistencia ${fechaCorta(fecha)}: ${partes.join(' y ')}` +
    (cursoNombre ? ` · ${cursoNombre}` : '');

  const cuerpo =
    (materiaNombre ? `Materia: ${materiaNombre}\n` : '') +
    (docenteNombre ? `Docente: ${docenteNombre}\n` : '') +
    (cursoNombre ? `Curso: ${cursoNombre}\n` : '') +
    `Fecha: ${fechaCorta(fecha)}\n\n` +
    lineas.join('\n') +
    '\n\nLos representantes con correo registrado recibieron aviso automático por email.';

  const fila = {
    institucion_id: institucionId,
    titulo: titulo.slice(0, 140),
    cuerpo: cuerpo.slice(0, 4000),
    para_roles: ['inspector', 'admin_plantel', 'secretario'],
    para_paralelos: null,
    categoria: 'convivencia',
    prioridad: nFaltas >= 3 ? 'importante' : 'normal',
    fijada: false,
    creado_por: registradoPor || null
  };

  const { data, error } = await supabase.from('notificaciones').insert(fila).select('id').single();
  if (error) {
    console.warn('[notificacionesAsistencia] no se pudo crear In-App:', error.message);
    return null;
  }
  return data?.id || null;
}

/**
 * Dado el lote de registros ya guardados:
 * 1) Envía correo a representantes (ausente/atraso)
 * 2) Crea notificación In-App para inspección/admin
 *
 * @returns {{ enviados, fallidos, omitidos, detalle, inAppId }}
 */
export async function notificarFaltasYAtrasos({ institucionId, docenteMateriaId, fecha, registrosGuardados, registradoPor }) {
  const resultado = { enviados: 0, fallidos: 0, omitidos: 0, detalle: [], inAppId: null };

  const novedades = (registrosGuardados || []).filter(r => ESTADOS_AVISO.has(r.estado));
  if (!novedades.length) return resultado;

  // Contexto de la clase
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

  const { data: estudiantes } = await supabase
    .from('estudiantes')
    .select('id, nombres, apellidos')
    .in('id', estudianteIds);
  const estById = Object.fromEntries((estudiantes || []).map(e => [e.id, e]));

  // —— In-App (siempre, aunque el correo no esté configurado)
  try {
    resultado.inAppId = await crearNotificacionInApp({
      institucionId,
      fecha,
      cursoNombre,
      materiaNombre,
      docenteNombre,
      novedades,
      estById,
      registradoPor
    });
  } catch (e) {
    console.warn('[notificacionesAsistencia] In-App falló:', e?.message || e);
  }

  // —— Email (desactivado en demostraciones)
  if ((await estadoDemoInstitucion(institucionId)).es_demo) {
    resultado.omitidos = novedades.length;
    resultado.detalle.push({ motivo: 'El correo está desactivado en la demostración.' });
    return resultado;
  }
  if (!correoConfigurado()) {
    resultado.omitidos = novedades.length;
    resultado.detalle.push({ motivo: 'Correo no configurado (RESEND_API_KEY / MAIL_FROM).' });
    return resultado;
  }

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
