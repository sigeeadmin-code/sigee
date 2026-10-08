// Financiero de SIGEE: cobro a los planteles por paralelo activado.
// Módulo PURO (sin Supabase ni navegador) para poder probarlo en Node.

export const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const ESTADOS_MES = ['pagado', 'en_revision', 'rechazado', 'mora', 'por_vencer', 'futuro'];

const num = v => Number(v) || 0;
const redondear = v => Math.round(num(v) * 100) / 100;

// ───────────── tarifa por tramos ─────────────
export function validarTramos(tramos) {
  if (!Array.isArray(tramos) || tramos.length === 0) return 'Agrega al menos un tramo.';
  const t = [...tramos].sort((a, b) => a.desde - b.desde);
  if (t[0].desde !== 1) return 'El primer tramo debe empezar en 1 paralelo.';
  for (let i = 0; i < t.length; i++) {
    const x = t[i];
    if (!(x.tarifa >= 0)) return 'Cada tramo necesita una tarifa válida.';
    const ultimo = i === t.length - 1;
    if (ultimo) { if (x.hasta !== null && x.hasta !== undefined && x.hasta !== '') return 'El último tramo debe quedar abierto (sin tope).'; }
    else {
      if (x.hasta === null || x.hasta === undefined || x.hasta === '' || x.hasta < x.desde) return `El tramo que empieza en ${x.desde} necesita un tope válido.`;
      if (t[i + 1].desde !== Number(x.hasta) + 1) return `Los tramos deben ser continuos: tras ${x.hasta} debe seguir ${Number(x.hasta) + 1}.`;
    }
  }
  return null;
}

/** Tarifa del paralelo número `posicion` (1, 2, 3…) del plantel: cada paralelo paga la tarifa del tramo donde cae (tarifa marginal). */
export function tarifaPorPosicion(tramos, posicion) {
  const t = [...tramos].sort((a, b) => a.desde - b.desde);
  const hallado = t.find(x => posicion >= x.desde && (x.hasta === null || x.hasta === undefined || posicion <= x.hasta));
  return hallado ? num(hallado.tarifa) : num(t[t.length - 1]?.tarifa);
}

/** Total mensual de un plantel con `n` paralelos, con tarifa marginal. */
export function totalMarginal(tramos, n) {
  let s = 0;
  for (let i = 1; i <= n; i++) s += tarifaPorPosicion(tramos, i);
  return redondear(s);
}

/** Total mensual si TODO el plantel pagara la tarifa de su tramo (tarifa plana): hace que 11 paralelos paguen menos que 10. */
export function totalPlano(tramos, n) {
  return n > 0 ? redondear(n * tarifaPorPosicion(tramos, n)) : 0;
}

/** Para cada licencia, la tarifa que le toca según su posición dentro de su plantel (por antigüedad). */
export function planTarifas(licencias, tramos) {
  const porPlantel = new Map();
  for (const l of licencias) {
    if (!porPlantel.has(l.institucion_id)) porPlantel.set(l.institucion_id, []);
    porPlantel.get(l.institucion_id).push(l);
  }
  const out = [];
  for (const [inst, lista] of porPlantel) {
    lista.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || String(a.id).localeCompare(String(b.id)));
    lista.forEach((l, i) => out.push({
      id: l.id, institucion_id: inst, institucion_nombre: l.institucion_nombre, posicion: i + 1,
      actual: num(l.tarifa_mensual), propuesta: tarifaPorPosicion(tramos, i + 1)
    }));
  }
  return out;
}

// ───────────── estado de cada mes ─────────────
/** Primer mes (1-12) que se factura de esa licencia en `anio`; 13 si empieza después. */
export function mesInicio(lic, anio) {
  const f = new Date(lic.created_at);
  if (Number.isNaN(f.getTime())) return 1;
  const ec = new Date(f.getTime() - 5 * 3600 * 1000);   // hora de Ecuador: 1 nov 02:00 UTC todavía es 31 oct
  const a = ec.getUTCFullYear();
  if (a < anio) return 1;
  if (a > anio) return 13;
  return ec.getUTCMonth() + 1;
}

export function estadoMes({ lic, anio, mes, pago, hoy, diaVenc }) {
  if (mes < mesInicio(lic, anio)) return null;
  if (pago?.estado === 'aprobado') return 'pagado';
  if (pago?.estado === 'pendiente_revision') return 'en_revision';
  if (pago?.estado === 'rechazado') return 'rechazado';
  const idx = anio * 12 + mes;
  const hoyIdx = hoy.getFullYear() * 12 + (hoy.getMonth() + 1);
  if (idx > hoyIdx) return 'futuro';
  if (idx < hoyIdx) return 'mora';
  return hoy.getDate() > (diaVenc || 10) ? 'mora' : 'por_vencer';
}

const vacioMeses = () => Array.from({ length: 12 }, () => ({ pagado: 0, en_revision: 0, rechazado: 0, mora: 0, por_vencer: 0, futuro: 0, n: 0 }));

/**
 * licencias: filas de licencias_paralelo_resumen · pagos: pagos DEL AÑO · devuelve el estado de cuenta por plantel,
 * la serie mensual y los totales.
 */
export function construirEstadoCuenta({ licencias, pagos, anio, hoy = new Date(), diaVenc = 10 }) {
  const pagoDe = new Map();
  for (const p of pagos) pagoDe.set(`${p.licencia_paralelo_id}|${p.mes}`, p);

  const planteles = new Map();
  const serie = vacioMeses();

  for (const lic of licencias) {
    if (mesInicio(lic, anio) > 12) continue;   // todavía no existe en este año
    if (!planteles.has(lic.institucion_id)) {
      planteles.set(lic.institucion_id, {
        institucion_id: lic.institucion_id, nombre: lic.institucion_nombre || '—', paralelos: 0, tarifaMensual: 0,
        meses: vacioMeses(), licencias: [], cobrado: 0, enRevision: 0, porCobrar: 0, porVencer: 0, futuro: 0
      });
    }
    const pl = planteles.get(lic.institucion_id);
    pl.paralelos += 1;
    pl.tarifaMensual = redondear(pl.tarifaMensual + num(lic.tarifa_mensual));
    const celdas = [];
    for (let mes = 1; mes <= 12; mes++) {
      const pago = pagoDe.get(`${lic.id}|${mes}`);
      const estado = estadoMes({ lic, anio, mes, pago, hoy, diaVenc });
      const monto = estado ? num(pago ? pago.monto : lic.tarifa_mensual) : 0;
      celdas.push({ mes, estado, monto, pago: pago || null });
      if (!estado) continue;
      for (const destino of [pl.meses[mes - 1], serie[mes - 1]]) { destino[estado] = redondear(destino[estado] + monto); destino.n += 1; }
      if (estado === 'pagado') pl.cobrado = redondear(pl.cobrado + monto);
      else if (estado === 'en_revision') pl.enRevision = redondear(pl.enRevision + monto);
      else if (estado === 'mora' || estado === 'rechazado') pl.porCobrar = redondear(pl.porCobrar + monto);
      else if (estado === 'por_vencer') pl.porVencer = redondear(pl.porVencer + monto);
      else pl.futuro = redondear(pl.futuro + monto);
    }
    pl.licencias.push({ lic, celdas });
  }

  const lista = [...planteles.values()].map(pl => {
    const exigible = pl.cobrado + pl.enRevision + pl.porCobrar;
    return {
      ...pl,
      cobranza: exigible > 0 ? Math.round((pl.cobrado / exigible) * 1000) / 10 : null,
      estado: pl.porCobrar > 0 ? 'mora' : pl.enRevision > 0 ? 'en_revision' : 'al_dia'
    };
  }).sort((a, b) => b.porCobrar - a.porCobrar || a.nombre.localeCompare(b.nombre));

  const suma = k => redondear(lista.reduce((s, p) => s + p[k], 0));
  const cobrado = suma('cobrado'), enRevision = suma('enRevision'), porCobrar = suma('porCobrar');
  const exigible = cobrado + enRevision + porCobrar;
  return {
    planteles: lista, serie,
    totales: {
      cobrado, enRevision, porCobrar, porVencer: suma('porVencer'), futuro: suma('futuro'),
      cobranza: exigible > 0 ? Math.round((cobrado / exigible) * 1000) / 10 : null,
      paralelos: lista.reduce((s, p) => s + p.paralelos, 0),
      alDia: lista.filter(p => p.estado === 'al_dia').length,
      enMora: lista.filter(p => p.estado === 'mora').length,
      enRevisionN: lista.filter(p => p.estado === 'en_revision').length
    }
  };
}

/** Indicadores de un mes: lo que se esperaba, lo cobrado, y el margen frente al costo de operar. */
export function indicadoresMes(estadoCuenta, mes, costoMensual = 0) {
  const m = estadoCuenta.serie[mes - 1];
  const esperado = redondear(m.pagado + m.en_revision + m.rechazado + m.mora + m.por_vencer + m.futuro);
  const margen = redondear(m.pagado - num(costoMensual));
  const tarifaMedia = m.n > 0 ? esperado / m.n : 0;
  return {
    esperado, cobrado: m.pagado, enRevision: m.en_revision, porCobrar: redondear(m.rechazado + m.mora),
    paralelosFacturables: m.n, paralelosActivos: estadoCuenta.planteles.reduce((s, p) => s + p.licencias.filter(l => l.celdas[mes - 1].estado === 'pagado').length, 0),
    margen, costo: num(costoMensual),
    paralelosEquilibrio: tarifaMedia > 0 ? Math.ceil(num(costoMensual) / tarifaMedia) : null
  };
}

/** Filas planas para exportar el estado de cuenta (una fila por plantel). */
export function filasEstadoCuenta(estadoCuenta, anio) {
  return estadoCuenta.planteles.map(p => ({
    'Plantel': p.nombre, 'Año': anio, 'Paralelos': p.paralelos, 'Tarifa mensual (USD)': p.tarifaMensual,
    'Cobrado (USD)': p.cobrado, 'En revisión (USD)': p.enRevision, 'Por cobrar (USD)': p.porCobrar,
    'Por vencer (USD)': p.porVencer, 'Cobranza (%)': p.cobranza ?? '',
    'Estado': { al_dia: 'Al día', mora: 'En mora', en_revision: 'Pago en revisión' }[p.estado]
  }));
}

/** Filas para el libro de cobros (contable): una por pago reportado. */
export function filasLibro(pagos) {
  return pagos.map(p => ({
    'Fecha de reporte': p.fecha_reporte ? String(p.fecha_reporte).slice(0, 10) : '',
    'Plantel': p.licencias_paralelo?.institucion?.nombre || '', 'AMIE': p.licencias_paralelo?.institucion?.amie || '',
    'Curso': p.licencias_paralelo?.grado?.nombre || '', 'Paralelo': p.licencias_paralelo?.paralelo?.nombre || '',
    'Período': `${MESES[(p.mes || 1) - 1]} ${p.anio}`, 'Monto (USD)': num(p.monto), 'Comprobante': p.comprobante_num || '',
    'Estado': { aprobado: 'Aprobado', pendiente_revision: 'Pendiente de revisión', rechazado: 'Rechazado' }[p.estado] || p.estado,
    'Fecha de revisión': p.fecha_revision ? String(p.fecha_revision).slice(0, 10) : '', 'Notas': p.notas_revision || ''
  }));
}
