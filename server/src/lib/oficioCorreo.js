// Arma el correo (HTML con estilos en línea + texto plano) a partir del oficio estructurado que produce
// construirOficio() en el frontend. TODO texto que viene del cliente se escapa: el HTML lo construye el servidor.

const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const txt = (v, max = 4000) => (typeof v === 'string' ? v.slice(0, max) : '');
const lista = (v, max = 40) => (Array.isArray(v) ? v.slice(0, max).map(x => txt(x, 400)) : []);

/** Valida y recorta el oficio recibido. Devuelve null si no tiene la forma esperada. */
export function normalizarOficio(of) {
  if (!of || typeof of !== 'object') return null;
  const filas = Array.isArray(of.filas) ? of.filas.slice(0, 200).map(f => ({ n: Number(f?.n) || 0, fecha: txt(f?.fecha, 20), dia: txt(f?.dia, 20), situacion: txt(f?.situacion, 30) })) : [];
  const o = {
    titulo: txt(of.titulo, 120), lugarFecha: txt(of.lugarFecha, 200), asunto: txt(of.asunto, 300), saludo: txt(of.saludo, 200),
    advertencia: txt(of.advertencia, 400), totales: txt(of.totales, 600), racha: txt(of.racha, 400), baseLegal: txt(of.baseLegal, 2000),
    baseNormativa: txt(of.baseNormativa, 600), solicitud: txt(of.solicitud, 1200), dece: txt(of.dece, 600), notaAdicional: txt(of.notaAdicional, 2000),
    encabezado: { institucion: txt(of.encabezado?.institucion, 300), amie: txt(of.encabezado?.amie, 40), ubicacion: txt(of.encabezado?.ubicacion, 300) },
    destinatario: lista(of.destinatario, 6), parrafos: lista(of.parrafos, 10), cierre: lista(of.cierre, 4), acuse: lista(of.acuse, 8), filas,
    firmante: { nombre: txt(of.firmante?.nombre, 200), cargo: txt(of.firmante?.cargo, 200), institucion: txt(of.firmante?.institucion, 300) }
  };
  return o.titulo && o.asunto && o.parrafos.length ? o : null;
}

export function oficioAHtml(of) {
  const p = t => (t ? `<p style="margin:0 0 12px;line-height:1.5">${esc(t)}</p>` : '');
  const filas = of.filas.map(f => `<tr><td style="border:1px solid #cbd5e1;padding:4px 8px;text-align:center">${f.n}</td><td style="border:1px solid #cbd5e1;padding:4px 8px">${esc(f.fecha)}</td><td style="border:1px solid #cbd5e1;padding:4px 8px">${esc(f.dia)}</td><td style="border:1px solid #cbd5e1;padding:4px 8px">${esc(f.situacion)}</td></tr>`).join('');
  const tabla = of.filas.length
    ? `<table style="border-collapse:collapse;margin:0 0 12px;font-size:13px"><thead><tr style="background:#f1f5f9"><th style="border:1px solid #cbd5e1;padding:4px 8px">N°</th><th style="border:1px solid #cbd5e1;padding:4px 8px">Fecha</th><th style="border:1px solid #cbd5e1;padding:4px 8px">Día</th><th style="border:1px solid #cbd5e1;padding:4px 8px">Situación</th></tr></thead><tbody>${filas}</tbody></table>` : '';
  const sub = [of.encabezado.amie && `AMIE ${of.encabezado.amie}`, of.encabezado.ubicacion].filter(Boolean).join(' · ');
  return `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Georgia,'Times New Roman',serif;color:#0f172a">
<div style="max-width:680px;margin:0 auto;background:#fff;padding:28px 32px;font-size:14px">
<div style="text-align:center;border-bottom:2px solid #0f172a;padding-bottom:10px;margin-bottom:16px">
<div style="font-weight:700;font-size:16px">${esc(of.encabezado.institucion)}</div>${sub ? `<div style="font-size:12px;color:#475569">${esc(sub)}</div>` : ''}</div>
<div style="font-weight:700;text-align:center;margin-bottom:6px">${esc(of.titulo)}</div>
<div style="text-align:right;margin-bottom:12px">${esc(of.lugarFecha)}</div>
<div style="margin-bottom:12px;line-height:1.4">${of.destinatario.map(l => `<div>${esc(l)}</div>`).join('')}</div>
<p style="margin:0 0 12px"><strong>ASUNTO:</strong> ${esc(of.asunto)}</p>
${p(of.saludo)}${of.advertencia ? `<p style="margin:0 0 12px;color:#b45309"><strong>${esc(of.advertencia)}</strong></p>` : ''}
${of.parrafos.map(p).join('')}${tabla}
<p style="margin:0 0 12px;line-height:1.5"><strong>${esc(of.totales)}</strong>${of.racha ? ' ' + esc(of.racha) : ''}</p>
${p(of.baseLegal)}${p([of.solicitud, of.dece].filter(Boolean).join(' '))}${p(of.notaAdicional)}
${of.cierre.map(p).join('')}
<div style="margin-top:28px"><div style="border-top:1px solid #0f172a;width:260px;padding-top:4px"><strong>${esc(of.firmante.nombre)}</strong>${of.firmante.cargo ? `<div>${esc(of.firmante.cargo)}</div>` : ''}<div>${esc(of.firmante.institucion)}</div></div></div>
<div style="margin-top:20px;border:1px dashed #94a3b8;padding:10px 12px;font-size:12.5px;line-height:1.6"><strong>${esc(of.acuse[0] || '')}</strong>${of.acuse.slice(1).map(l => `<div>${esc(l)}</div>`).join('')}</div>
${of.baseNormativa ? `<div style="margin-top:14px;font-size:11px;color:#64748b">Base normativa: ${esc(of.baseNormativa)}.</div>` : ''}
<div style="margin-top:14px;font-size:11px;color:#94a3b8">Correo enviado desde SIGEE. Para responder, use el botón Responder: llegará al funcionario que emitió el oficio.</div>
</div></body></html>`;
}

export function oficioATexto(of) {
  const L = [of.encabezado.institucion, of.titulo, of.lugarFecha, '', ...of.destinatario, '', `ASUNTO: ${of.asunto}`, '', of.saludo];
  if (of.advertencia) L.push(of.advertencia);
  L.push(...of.parrafos);
  of.filas.forEach(f => L.push(`  ${f.n}. ${f.fecha} (${f.dia}) — ${f.situacion}`));
  L.push('', of.totales + (of.racha ? ' ' + of.racha : ''));
  if (of.baseLegal) L.push('', of.baseLegal);
  L.push('', [of.solicitud, of.dece].filter(Boolean).join(' '));
  if (of.notaAdicional) L.push('', of.notaAdicional);
  L.push('', ...of.cierre, '', of.firmante.nombre, of.firmante.cargo, of.firmante.institucion);
  if (of.baseNormativa) L.push('', `Base normativa: ${of.baseNormativa}.`);
  return L.filter(l => l !== undefined && l !== null).join('\n');
}
