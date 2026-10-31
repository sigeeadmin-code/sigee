/**
 * Hoja de ruta para estudiantes y representantes (lógica pura, probada en tests/hojaRutaFamilia.test.mjs).
 * Une en una sola línea de tiempo lo que ya está aprobado/emitido: documentos del tráfico documental
 * (oficio de alerta, plan de refuerzo, acta, seguimiento), oficios por inasistencia y avisos al representante.
 * El servidor (oficios_hoja_ruta_familia) ya entrega solo lo del propio estudiante y sin datos internos.
 */

const CANAL = { whatsapp: 'WhatsApp', correo: 'correo', email: 'correo', sms: 'SMS', llamada: 'llamada' };
const ESTADO_DOC = {
  aprobado_final: { texto: 'Disponible', tono: 'b-info' },
  entregado: { texto: 'Entregado', tono: 'b-ok' },
  archivado: { texto: 'Archivado', tono: 'b-muted' }
};

/** "2026-10-05" → "05/10/2026" sin desfase de zona horaria; los timestamps se muestran en hora de Ecuador. */
export function soloFecha(v) {
  if (!v) return '—';
  const s = String(v);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.slice(0, 10);
  return d.toLocaleDateString('es-EC', { timeZone: 'America/Guayaquil', day: '2-digit', month: '2-digit', year: 'numeric' });
}

const clave = v => (v ? new Date(v).getTime() || 0 : 0);

export function armarLineaTiempo(datos) {
  const items = [];
  for (const d of datos?.documentos || []) {
    const est = ESTADO_DOC[d.estado] || { texto: d.estado, tono: 'b-muted' };
    items.push({
      id: 'doc-' + d.id, clase: d.es_seguimiento ? 'seguimiento' : 'documento', fecha: d.fecha, icono: d.es_seguimiento ? 'ti-chart-line' : 'ti-file-text',
      titulo: d.tipo_nombre || 'Documento', detalle: d.es_seguimiento && d.documento_origen_numero ? `Seguimiento del documento ${d.documento_origen_numero}` : d.titulo,
      numero: d.numero, estado: est.texto, tono: est.tono, doc: d
    });
  }
  for (const o of datos?.oficios_faltas || []) {
    const entregado = !!o.entregado_at;
    const rango = o.desde && o.hasta ? ` · del ${soloFecha(o.desde)} al ${soloFecha(o.hasta)}` : '';
    items.push({
      id: 'of-' + o.id, clase: 'faltas', fecha: o.fecha, icono: 'ti-mail', titulo: 'Oficio por inasistencia',
      detalle: `${o.dias_falta ?? 0} ${o.dias_falta === 1 ? 'día' : 'días'} de falta${rango}`, numero: o.numero,
      estado: entregado ? 'Entregado' : o.por_correo ? 'Enviado por correo' : 'Emitido', tono: entregado ? 'b-ok' : 'b-info'
    });
  }
  for (const a of datos?.avisos || []) {
    items.push({
      id: 'av-' + a.id, clase: 'aviso', fecha: a.enviado_at || a.fecha, icono: 'ti-bell',
      titulo: 'Aviso al representante', detalle: `Falta del ${soloFecha(a.fecha)}${a.canal ? ` · por ${CANAL[String(a.canal).toLowerCase()] || a.canal}` : ''}`,
      numero: null, estado: 'Enviado', tono: 'b-muted'
    });
  }
  return items.sort((x, y) => clave(y.fecha) - clave(x.fecha));
}

export function resumenHojaRuta(items) {
  const c = { documentos: 0, seguimientos: 0, faltas: 0, avisos: 0 };
  for (const i of items) {
    if (i.clase === 'documento') c.documentos++;
    else if (i.clase === 'seguimiento') c.seguimientos++;
    else if (i.clase === 'faltas') c.faltas++;
    else if (i.clase === 'aviso') c.avisos++;
  }
  return c;
}

/** Adapta el documento sanitizado de la familia a lo que espera la hoja imprimible (vista de entrega). */
export const docParaImpresion = d => ({
  ...d, created_at: d.emitido, datos_plantilla: { notas: d.contenido || '', documento: d.documento || null }, historial_recorrido: [], entrega: null
});
