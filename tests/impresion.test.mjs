import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MARGEN_A4, reglaPagina, usarMargenesA4 } from '../src/lib/impresion.js';

// La regla de página
assert.equal(MARGEN_A4, '14mm 20mm');
assert.equal(reglaPagina(), '@page{size:A4;margin:14mm 20mm}');
assert.equal(reglaPagina('10mm'), '@page{size:A4;margin:10mm}');

// Pone la regla al imprimir y la quita al terminar (no queda pegada para otras impresiones)
const hijos = [];
const doc = { head: { appendChild: n => { n.parentNode = doc.head; hijos.push(n); }, removeChild: n => { hijos.splice(hijos.indexOf(n), 1); n.parentNode = null; } },
  createElement: () => ({ attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, textContent: '' }) };
const quitar = usarMargenesA4(undefined, doc);
assert.equal(hijos.length, 1); assert.equal(hijos[0].textContent, '@page{size:A4;margin:14mm 20mm}'); assert.equal(hijos[0].attrs['data-sigee-pagina'], 'a4');
quitar(); assert.equal(hijos.length, 0);
quitar();   // llamarla otra vez no rompe nada
assert.doesNotThrow(() => usarMargenesA4(undefined, null)());   // sin documento (servidor/pruebas): no hace nada

// El CSS: en pantalla la hoja se ve con sus márgenes; al IMPRIMIR el margen lo da la página y la hoja no lleva relleno ni altura fija
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
assert.match(css, /\.oficio-hoja\{[^}]*padding:14mm 20mm/);                                  // vista en pantalla intacta
const imprimir = css.slice(css.indexOf('body.imprimiendo-oficio .oficio-hoja{'));
const regla = imprimir.slice(0, imprimir.indexOf('}') + 1);
assert.match(regla, /padding:0/); assert.match(regla, /min-height:0/); assert.match(regla, /width:auto/);
assert.doesNotMatch(regla, /min-height:296mm/); assert.doesNotMatch(regla, /width:210mm/);
assert.match(css, /\.of-tabla thead\{display:table-header-group\}/);                          // el encabezado de la tabla se repite en cada hoja
assert.match(css, /\.of-tabla tr\{break-inside:avoid/);                                       // una fila no se parte entre dos hojas

// Los dos documentos que se imprimen (oficio de inasistencias y fichas de rendimiento/seguimiento) usan la regla
for (const f of ['OficioFaltasModal.jsx', 'FichaDocumentoModal.jsx']) {
  const src = readFileSync(new URL('../src/components/' + f, import.meta.url), 'utf8');
  assert.match(src, /import \{ usarMargenesA4 \} from '..\/lib\/impresion\.js'/, f);
  assert.match(src, /const quitarMargenes = usarMargenesA4\(\)/, f);
  assert.ok((src.match(/quitarMargenes\(\)/g) || []).length >= 2, `${f}: debe quitar la regla al terminar y al cerrar`);
}
// Las boletas ya imprimían con margen de página en todas las hojas
const bol = readFileSync(new URL('../src/lib/boletaHTML.js', import.meta.url), 'utf8');
assert.match(bol, /@page \{ size: A4; margin: 14mm; \}/);
console.log('impresion OK');
