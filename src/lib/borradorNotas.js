// Borrador local de notas: si se cae el internet, se cierra la pestaña o el navegador, el docente recupera lo que no alcanzó a guardar.
// Módulo PURO (sin React): la pantalla solo lo llama. Nada de esto sustituye al guardado en el servidor.
const PREFIJO = 'sigee:borrador:';
const VIGENCIA_MS = 3 * 24 * 3600 * 1000;   // un borrador viejo se descarta a los 3 días

export const claveBorrador = (perfilId, cargaId, trimestre) => `${PREFIJO}${perfilId}:${cargaId}:${trimestre}`;

// Forma de la configuración (cuántos casilleros tiene cada aporte). Si cambió, el borrador ya no encaja en la cuadrícula.
export const firmaCfg = cfg => JSON.stringify(['ind', 'grp', 'sum'].map(t => ((cfg && cfg[t]) || []).map(g => g.n)));
const fila = r => JSON.stringify(r === undefined ? null : r);

// `grid`: filas actuales; `base`: filas tal como llegaron del servidor; `sucios`: { estudianteId: true } con cambios sin guardar.
export function armarBorrador({ grid, base, sucios, cfg, ahora = Date.now() }) {
  const filas = {};
  Object.keys(sucios || {}).forEach(id => { if (sucios[id] && grid && grid[id]) filas[id] = { edit: grid[id], base: (base && base[id]) || null }; });
  return Object.keys(filas).length ? { v: 1, t: ahora, cfg: firmaCfg(cfg), filas } : null;
}

export function borradorVigente(b, ahora = Date.now()) {
  return !!b && b.v === 1 && typeof b.t === 'number' && ahora - b.t < VIGENCIA_MS && !!b.filas && typeof b.filas === 'object';
}

// Aplica el borrador sobre lo que acaba de llegar del servidor. Es CONSERVADOR: una fila del borrador solo se restaura si
// el estudiante sigue en el curso y su fila en el servidor es igual a la que había cuando se empezó a editar
// (si otra persona o otro dispositivo guardó notas nuevas mientras tanto, NO se pisan).
export function aplicarBorrador({ grid, cfg, borrador, ahora = Date.now() }) {
  const total = borrador && borrador.filas ? Object.keys(borrador.filas).length : 0;
  if (!borradorVigente(borrador, ahora) || borrador.cfg !== firmaCfg(cfg)) return { grid, sucios: {}, aplicados: 0, descartados: total };
  const out = { ...grid }; const sucios = {}; let aplicados = 0; let descartados = 0;
  for (const [id, f] of Object.entries(borrador.filas)) {
    if (!grid[id] || !f || !f.edit) { descartados++; continue; }
    if (fila(f.base) !== fila(grid[id])) { descartados++; continue; }
    out[id] = f.edit; sucios[id] = true; aplicados++;
  }
  return { grid: out, sucios, aplicados, descartados };
}

/* ── Almacenamiento: jamás debe romper la pantalla (modo privado, cuota llena, navegador sin localStorage…) ── */
const tienda = () => { try { return globalThis.localStorage || null; } catch { return null; } };
export function leerBorrador(clave, store = tienda()) { try { const s = store && store.getItem(clave); return s ? JSON.parse(s) : null; } catch { return null; } }
export function guardarBorradorLS(clave, b, store = tienda()) { try { if (!store) return false; store.setItem(clave, JSON.stringify(b)); return true; } catch { return false; } }
export function borrarBorrador(clave, store = tienda()) { try { if (store) store.removeItem(clave); } catch { /* sin almacenamiento */ } }
export function borrarTodosLosBorradores(store = tienda()) {
  try {
    if (!store) return;
    const claves = [];
    for (let i = 0; i < store.length; i++) { const k = store.key(i); if (k && k.startsWith(PREFIJO)) claves.push(k); }
    claves.forEach(k => store.removeItem(k));
  } catch { /* sin almacenamiento */ }
}
