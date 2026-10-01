// Genera el HTML imprimible de la boleta (informe de aprendizaje) de un estudiante de Bachillerato.
// Módulo puro: recibe datos ya calculados y devuelve texto. Todo dato libre se escapa.
import { escalaDAAPA, calcAnual, TRIMESTRES } from './calificaciones.js';

export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const f2 = n => (n === null || n === undefined ? '—' : Number(n).toFixed(2));
const urlSegura = u => (typeof u === 'string' && /^https?:\/\//i.test(u.trim()) ? u.trim() : '');
const NOMBRE_TRIM = { T1: '1er Trimestre', T2: '2do Trimestre', T3: '3er Trimestre' };
const ESTADO_TXT = { aprobado: 'Aprobado', supletorio: 'Supletorio', remedial: 'Remedial', pendiente: 'En curso' };
const ESTADO_COLOR = { aprobado: '#2f9e44', supletorio: '#e8590c', remedial: '#e03131', pendiente: '#6b7490' };

export const ESTILOS_BOLETA = `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #000; background: #fff; margin: 0; }
  .boleta { page-break-after: always; padding: 4px 2px; }
  .boleta:last-child { page-break-after: auto; }
  .b-head { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #003F8F; padding-bottom: 10px; margin-bottom: 10px; }
  .b-head img { max-height: 58px; max-width: 90px; object-fit: contain; }
  .b-head h1 { margin: 0; font-size: 17px; font-weight: 800; color: #003F8F; }
  .b-head p { margin: 2px 0 0; font-size: 11px; color: #444; }
  .b-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 18px; background: #f5f7fc; padding: 10px 12px; border-radius: 6px; margin-bottom: 12px; font-size: 12px; }
  table.b-tbl { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 8px; }
  .b-tbl th { background: #003F8F; color: #fff; padding: 6px 8px; text-align: left; }
  .b-tbl td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
  .b-tbl tr:nth-child(even) td { background: #f5f7fc; }
  .c { text-align: center; } .b { font-weight: 700; }
  .b-nota { font-size: 10px; color: #555; margin: 4px 0 0; }
  .b-firmas { display: flex; justify-content: space-around; margin-top: 46px; gap: 16px; }
  .b-firma { text-align: center; flex: 1; font-size: 11px; }
  .b-firma .linea { border-top: 1.5px solid #000; margin: 0 auto 4px; width: 80%; }
  @media screen { body { background: #eef1f6; padding: 16px; } .boleta { background: #fff; max-width: 780px; margin: 0 auto 16px; padding: 18px; box-shadow: 0 1px 6px rgba(0,0,0,.15); } }
`;

/**
 * datos = {
 *   institucion: { nombre, amie, logo_url, rector }, periodoNombre, cursoNombre, paraleloNombre, tutorNombre,
 *   tipo: 'anual' | 'T1' | 'T2' | 'T3', fechaEmision (string),
 *   estudiante: { nombre, cedula },
 *   materias: [{ nombre, trims:[t1,t2,t3], promedio, final, estado, supletorio }]
 * }
 */
export function boletaHTML(d) {
  const anual = d.tipo === 'anual';
  const inst = d.institucion || {};
  const logo = urlSegura(inst.logo_url);
  const titulo = anual ? 'INFORME FINAL ANUAL' : `INFORME DE PROGRESO · ${NOMBRE_TRIM[d.tipo] || ''}`.toUpperCase();
  let filas = '';
  let suma = 0, cuenta = 0;

  if (anual) {
    for (const m of d.materias) {
      const eq = escalaDAAPA(m.final);
      if (m.final !== null && m.final !== undefined) { suma += m.final; cuenta++; }
      filas += `<tr><td>${esc(m.nombre)}</td>
        ${m.trims.map(t => `<td class="c">${f2(t)}</td>`).join('')}
        <td class="c b">${f2(m.final)}</td><td class="c b">${esc(eq.c)}</td>
        <td class="c">${f2(m.supletorio)}</td>
        <td class="c b" style="color:${ESTADO_COLOR[m.estado] || '#000'}">${esc(ESTADO_TXT[m.estado] || '')}</td></tr>`;
    }
  } else {
    const idx = ['T1', 'T2', 'T3'].indexOf(d.tipo);
    for (const m of d.materias) {
      const nota = idx >= 0 ? m.trims[idx] : null;
      const eq = escalaDAAPA(nota);
      if (nota !== null && nota !== undefined) { suma += nota; cuenta++; }
      filas += `<tr><td>${esc(m.nombre)}</td><td class="c b">${nota === null || nota === undefined ? 'NE' : f2(nota)}</td>
        <td class="c b">${esc(eq.c)}</td><td>${esc(eq.label)}</td></tr>`;
    }
  }
  // Promedio con truncado a 2 decimales (misma regla que el cálculo de notas)
  const general = cuenta ? Math.trunc((suma / cuenta) * 100 + 1e-9) / 100 : null;

  const cabecera = anual
    ? `<tr><th>Asignatura</th><th class="c">1er Trim.</th><th class="c">2do Trim.</th><th class="c">3er Trim.</th><th class="c">Promedio final</th><th class="c">Equiv.</th><th class="c">Supletorio</th><th class="c">Estado</th></tr>`
    : `<tr><th>Asignatura</th><th class="c">Nota</th><th class="c">Equiv.</th><th>Escala</th></tr>`;
  const pie = anual
    ? `<tr style="background:#f5f7fc;font-weight:700"><td>PROMEDIO GENERAL</td><td colspan="3"></td><td class="c" style="font-size:14px">${f2(general)}</td><td class="c">${general === null ? '—' : esc(escalaDAAPA(general).c)}</td><td colspan="2"></td></tr>`
    : `<tr style="background:#f5f7fc;font-weight:700"><td>PROMEDIO GENERAL</td><td class="c" style="font-size:14px">${f2(general)}</td><td class="c">${general === null ? '—' : esc(escalaDAAPA(general).c)}</td><td></td></tr>`;

  let resumen = '';
  if (anual && d.materias.length) {
    const est = d.materias.map(m => m.estado);
    resumen = est.includes('remedial') ? 'Tiene asignaturas en examen remedial.'
      : est.includes('supletorio') ? 'Tiene asignaturas pendientes de examen supletorio.'
      : est.every(e => e === 'aprobado') ? 'Aprobó todas las asignaturas del año lectivo.'
      : 'Año lectivo en curso: aún faltan notas definitivas.';
  }

  return `<section class="boleta">
  <div class="b-head">
    ${logo ? `<img src="${esc(logo)}" alt="">` : ''}
    <div>
      <h1>${esc((inst.nombre || 'INSTITUCIÓN EDUCATIVA').toUpperCase())}</h1>
      <p style="font-weight:700;color:#1a1f2e">INFORME DE APRENDIZAJE${inst.amie ? ' · AMIE ' + esc(inst.amie) : ''}</p>
      <p>Ministerio de Educación · República del Ecuador · Año lectivo ${esc(d.periodoNombre)}</p>
      <p style="font-weight:700">${esc(titulo)}</p>
    </div>
  </div>
  <div class="b-grid">
    <div><strong>Estudiante:</strong> ${esc(d.estudiante.nombre)}</div>
    <div><strong>Cédula/ID:</strong> ${esc(d.estudiante.cedula || '—')}</div>
    <div><strong>Curso:</strong> ${esc(d.cursoNombre)} · Paralelo "${esc(d.paraleloNombre)}"</div>
    <div><strong>Docente tutor:</strong> ${esc(d.tutorNombre || '—')}</div>
    <div><strong>Fecha de emisión:</strong> ${esc(d.fechaEmision)}</div>
    <div><strong>Régimen:</strong> Trimestral</div>
  </div>
  <table class="b-tbl"><thead>${cabecera}</thead><tbody>${filas || '<tr><td colspan="8" class="c">Sin asignaturas registradas</td></tr>'}${pie}</tbody></table>
  ${resumen ? `<p class="b-nota" style="font-size:12px;color:#000"><strong>Resultado:</strong> ${esc(resumen)}</p>` : ''}
  <p class="b-nota">Escala: <strong>DA</strong> Domina los aprendizajes (9–10) · <strong>AA</strong> Alcanza (7–8.99) · <strong>PA</strong> Próximo a alcanzar (4.01–6.99) · <strong>NA</strong> No alcanza (≤ 4). NE = no evaluado. Solo constan notas definitivas.</p>
  <div class="b-firmas">
    <div class="b-firma"><div class="linea"></div>${esc(d.tutorNombre || 'Docente tutor')}<br>Firma y sello</div>
    <div class="b-firma"><div class="linea"></div>${esc(inst.rector || 'Rector(a)')}<br>Rector(a)</div>
    <div class="b-firma"><div class="linea"></div>Padre / Madre / Representante legal<br>Firma</div>
  </div>
</section>`;
}

export function documentoBoletas(listaDatos, tituloVentana = 'Boletas') {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(tituloVentana)}</title><style>${ESTILOS_BOLETA}</style></head><body>${listaDatos.map(boletaHTML).join('\n')}</body></html>`;
}

// Arma las filas de materias de UN estudiante a partir de las cargas, sus notas definitivas y sus supletorios.
// cargas: [{ id, materiaNombre }] · notas: [{ docente_materia_id, periodo_evaluativo, nota }] · mejoras: [{ docente_materia_id, supletorio }]
export function materiasParaBoleta(cargas, notas, mejoras) {
  return cargas.map(c => {
    const trims = TRIMESTRES.map(t => {
      const n = notas.find(x => x.docente_materia_id === c.id && x.periodo_evaluativo === t);
      return n ? Number(n.nota) : null;
    });
    const sup = mejoras.find(x => x.docente_materia_id === c.id && x.supletorio != null);
    const supletorio = sup ? Number(sup.supletorio) : null;
    const anual = calcAnual(trims, supletorio);
    return { nombre: c.materiaNombre, trims, promedio: anual.promedio, final: anual.final, estado: anual.estado, supletorio };
  });
}
