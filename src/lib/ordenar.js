// Orden alfabético por apellidos y luego nombres (respeta tildes y la ñ).
const clave = x => String(x?.apellidos !== undefined ? `${x.apellidos || ''} ${x.nombres || ''}` : (x?.nombre || '')).trim();
export const cmpNombre = (a, b) => clave(a).localeCompare(clave(b), 'es', { sensitivity: 'base' });
export const ordenarPorNombre = lista => [...(lista || [])].sort(cmpNombre);
