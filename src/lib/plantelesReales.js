// Reglas puras del Admin global: qué planteles cuentan en las sumas y cómo se calcula el % de asistencia del panel.

/** Ids de colegios reales y activos (se excluyen los de demostración y los inactivos). */
export const idsPlantelesReales = instituciones =>
  new Set((instituciones || []).filter(i => i.activo !== false && !i.es_demo).map(i => i.id));

/** Deja solo las filas de colegios reales. Si no hay lista de planteles (falló la carga) no filtra, para no ocultar datos. */
export const soloPlantelesReales = (filas, instituciones) =>
  (instituciones && instituciones.length ? filas.filter(f => idsPlantelesReales(instituciones).has(f.institucion_id)) : filas);

/** Quita espacios, tabulaciones y saltos repetidos (algunos nombres de plantel vienen con tabulaciones al final). */
export const limpiar = t => String(t ?? '').replace(/\s+/g, ' ').trim();

/** % de asistencia: no penaliza los justificados. null si no hay registros. Un decimal. */
export const pctAsist = (presente = 0, atraso = 0, ausente = 0) => {
  const t = presente + atraso + ausente;
  return t > 0 ? Math.round(((presente + atraso) / t) * 1000) / 10 : null;
};
