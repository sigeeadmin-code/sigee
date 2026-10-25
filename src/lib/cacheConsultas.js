// Caché corto de consultas de solo lectura: evita pedir a la base lo mismo varias veces seguidas (p. ej. al cambiar de materia
// dentro del mismo curso). Dura poco (por defecto 30 s), junta peticiones iguales que van al mismo tiempo, NO guarda errores
// y se vacía cuando algo cambia (escrituras) y al cerrar sesión. Devuelve copias: quien lo use puede modificar el resultado sin riesgo.
const copia = v => { if (v === null || typeof v !== 'object') return v; try { return structuredClone(v); } catch { return JSON.parse(JSON.stringify(v)); } };

export function crearCache({ ttlMs = 30000, ahora = () => Date.now() } = {}) {
  const datos = new Map();      // clave -> { v, t }
  const enVuelo = new Map();    // clave -> Promise
  let generacion = 0;           // sube con cada invalidación: lo que estaba cargando en ese momento no se guarda
  const api = {
    async obtener(clave, cargar, ttl = ttlMs) {   // ttl 0: solo junta peticiones iguales simultáneas, no guarda nada
      const hit = datos.get(clave);
      if (ttl > 0 && hit && ahora() - hit.t < ttl) return copia(hit.v);
      if (enVuelo.has(clave)) return copia(await enVuelo.get(clave));
      const gen = generacion;
      const p = (async () => {
        try { const v = await cargar(); if (ttl > 0 && gen === generacion) datos.set(clave, { v, t: ahora() }); return v; }
        finally { if (enVuelo.get(clave) === p) enVuelo.delete(clave); }
      })();
      enVuelo.set(clave, p);
      return copia(await p);
    },
    invalidar(prefijo = '') {
      generacion++;
      for (const k of [...datos.keys()]) if (k.startsWith(prefijo)) datos.delete(k);
      for (const k of [...enVuelo.keys()]) if (k.startsWith(prefijo)) enVuelo.delete(k);
    },
    limpiar() { api.invalidar(''); },
    tamano() { return datos.size; }
  };
  return api;
}
