// Generador de contraseñas temporales: 10 caracteres, sin letras confusas (0/O, 1/l/I) y con mayúscula, minúscula y número.
const MAYUS = 'ABCDEFGHJKLMNPQRSTUVWXYZ', MINUS = 'abcdefghijkmnopqrstuvwxyz', NUMS = '23456789';
const TODO = MAYUS + MINUS + NUMS;

export function generarClave(longitud = 10, rnd = n => { const b = new Uint32Array(1); crypto.getRandomValues(b); return b[0] % n; }) {
  const pick = (set) => set[rnd(set.length)];
  const out = [pick(MAYUS), pick(MINUS), pick(NUMS)];
  while (out.length < longitud) out.push(pick(TODO));
  for (let i = out.length - 1; i > 0; i--) { const j = rnd(i + 1); [out[i], out[j]] = [out[j], out[i]]; }   // mezcla
  return out.join('');
}
