import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Las ventanas emergentes a pantalla completa deben quedar POR ENCIMA del menú lateral (z-index 200 en escritorio, 300 en móvil);
// si no, el menú tapa el borde izquierdo de la ventana y el contenido sale cortado.
const MIN = 500;
const archivos = [];
(function recorrer(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? recorrer(p) : /\.(jsx|js|css)$/.test(f) && archivos.push(p); } })('src');

const malos = [];
for (const f of archivos) {
  const txt = fs.readFileSync(f, 'utf8');
  // CSS: reglas con position:fixed + inset:0
  for (const m of txt.matchAll(/([.#][\w-]+)\{([^}]*position:fixed;[^}]*inset:0[^}]*)\}/g)) {
    const z = /z-index:(\d+)/.exec(m[2]);
    if (!/sidebar-backdrop/.test(m[1]) && (!z || Number(z[1]) < MIN)) malos.push(`${f} ${m[1]} z-index=${z?.[1] ?? 'sin definir'}`);
  }
  // JSX: objetos de estilo con position: 'fixed' + inset: 0
  for (const m of txt.matchAll(/\{[^{}]*position: 'fixed'[^{}]*inset: 0[^{}]*\}/g)) {
    const z = /zIndex: (\d+)/.exec(m[0]);
    if (!z || Number(z[1]) < MIN) malos.push(`${f} zIndex=${z?.[1] ?? 'sin definir'}`);
  }
}
assert.deepEqual(malos, [], 'Ventanas emergentes por debajo del menú lateral:\n' + malos.join('\n'));
console.log('capas: ok');
