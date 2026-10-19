import fs from 'node:fs';
import os from 'node:os';

// Métricas del propio servidor (Railway) para el Diagnóstico del Super Admin.
// El tráfico se cuenta en memoria por hora: se reinicia si el servidor se reinicia o se duerme (el plan Free de Railway lo hace).
const HORAS_GUARDADAS = 72;
const claveHora = ts => new Date(Math.floor(ts / 3600000) * 3600000).toISOString();

export function crearContador() { return { horas: new Map(), desde: Date.now() }; }

export function registrarPeticion(contador, ts, ms, status) {
  const k = claveHora(ts);
  const h = contador.horas.get(k) || { peticiones: 0, errores: 0, ms: 0 };
  h.peticiones += 1; h.ms += ms; if (status >= 500) h.errores += 1;
  contador.horas.set(k, h);
  if (contador.horas.size > HORAS_GUARDADAS + 2) {
    const viejas = [...contador.horas.keys()].sort().slice(0, contador.horas.size - HORAS_GUARDADAS);
    for (const v of viejas) contador.horas.delete(v);
  }
}

/** Últimas `n` horas (incluida la actual), rellenando con ceros las horas sin tráfico. */
export function serieHoraria(contador, ahora = Date.now(), n = HORAS_GUARDADAS) {
  const fin = Math.floor(ahora / 3600000) * 3600000; const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const k = new Date(fin - i * 3600000).toISOString(); const h = contador.horas.get(k);
    out.push({ hora: k, peticiones: h?.peticiones || 0, errores: h?.errores || 0, ms_prom: h?.peticiones ? Math.round(h.ms / h.peticiones) : 0 });
  }
  return out;
}

function leerNumero(ruta) { try { const t = fs.readFileSync(ruta, 'utf8').trim(); return /^\d+$/.test(t) ? Number(t) : null; } catch { return null; } }

/** Memoria y disco tal como los ve el contenedor (cgroup v2/v1); si no hay cgroup, usa los del sistema. */
export function leerRecursos() {
  const limiteMem = leerNumero('/sys/fs/cgroup/memory.max') ?? leerNumero('/sys/fs/cgroup/memory/memory.limit_in_bytes');
  const usoMem = leerNumero('/sys/fs/cgroup/memory.current') ?? leerNumero('/sys/fs/cgroup/memory/memory.usage_in_bytes') ?? process.memoryUsage().rss;
  const total = limiteMem && limiteMem < os.totalmem() * 4 ? limiteMem : os.totalmem();
  let disco = null;
  try { const s = fs.statfsSync('/'); disco = { total: s.blocks * s.bsize, libre: s.bavail * s.bsize }; disco.usado = disco.total - disco.libre; } catch { /* sin statfs */ }
  return {
    memoria: { usada: usoMem, total, proceso: process.memoryUsage().rss },
    disco,
    cpu_nucleos: os.availableParallelism ? os.availableParallelism() : os.cpus().length,
    carga_1m: os.loadavg()[0],
    activo_seg: Math.round(process.uptime())
  };
}
