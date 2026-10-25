import assert from 'node:assert/strict';
import { sanitizarNota, esNotaValida, conCelda, conMejora } from '../src/lib/notaEntrada.js';
import { valorValido } from '../server/src/lib/calificaciones.js';

// ── Lo que se escribe o se pega: solo números ──
// Lo que SALE de sanitizarNota siempre es una nota válida (o vacío), sea cual sea la entrada.
const entradas = ['8', '10', '0', '9.75', '9,75', 'abc', '8a', 'a8', '8e1', ' ', '  7 ', '7 5', '-5', '+5', '5!', '5#', '5%', '<b>', "'; drop table", '0x5', '1e1',
  '.5', '5.', '.', '007', '00.5', '8.999', '8.9.9', '1.234', '10.5', '11', '100', '99', '10.0', '10.00', '', null, undefined, 8, 9.5];
for (const entrada of entradas) {
  const got = sanitizarNota(entrada, '');
  assert.equal(typeof got, 'string');
  assert.ok(esNotaValida(got), `salida inválida para ${JSON.stringify(entrada)} → ${JSON.stringify(got)}`);
}
// Resultados exactos de los casos importantes
assert.equal(sanitizarNota('9,75'), '9.75'); assert.equal(sanitizarNota('abc'), ''); assert.equal(sanitizarNota(' '), '');
assert.equal(sanitizarNota('8a'), '8'); assert.equal(sanitizarNota('-5'), '5'); assert.equal(sanitizarNota('.5'), '0.5'); assert.equal(sanitizarNota('007'), '7');
assert.equal(sanitizarNota('8.999'), '8.99'); assert.equal(sanitizarNota('8.9.9'), '8.99');
// Si lo escrito pasa de 10, se rechaza el último cambio y queda lo anterior
assert.equal(sanitizarNota('11', '1'), '1'); assert.equal(sanitizarNota('10.5', '10.'), '10.'); assert.equal(sanitizarNota('99', '9'), '9');
assert.equal(sanitizarNota('10', '1'), '10'); assert.equal(sanitizarNota('10.0', '10.'), '10.0');
// Pegar un texto cualquiera nunca produce algo inválido
for (const basura of ['SELECT * FROM', '😀8', '٣٤', '８', '1e309', 'Infinity', 'NaN', '0b11', '0o7', '\n8\n', '\t', '8\u200b5', '9..5', ',,,', '...']) assert.ok(esNotaValida(sanitizarNota(basura, '')), JSON.stringify(basura));

// ── Validación estricta (pantalla) ──
for (const ok of ['', '0', '10', '9.75', '0.1', '7.5', '8.', '10.0', '10.00', 5, 9.75, 0.1, null, undefined]) assert.equal(esNotaValida(ok), true, String(ok));
for (const mal of [' ', ' 7', '7 ', 'a', '1e1', '0x5', '-1', '+5', '10.01', '11', '100', '8.999', '.5', '1,5', 'Infinity', NaN, Infinity, -1, 10.5, true, [], {}]) assert.equal(esNotaValida(mal), false, JSON.stringify(mal));

// ── Validación del servidor: igual de estricta ──
for (const ok of [0, 10, 9.75, 0.1, 8.3, '0', '10', '9.75', '8.5', '10.0', 7, 5.05]) assert.equal(valorValido(ok), true, String(ok));
for (const mal of [' ', '', null, undefined, true, false, [], [5], {}, '1e1', '0x5', '0b1', ' 7', '7 ', '8.999', 8.999, 10.01, -0.01, 11, NaN, Infinity, -Infinity, 'abc', '8,5', '.5', '8.', '+5', '-5', '１０']) assert.equal(valorValido(mal), false, JSON.stringify(mal));
// Lo que la pantalla deja pasar (convertido a número, como lo envía) el servidor también lo acepta
for (const e of entradas) { const s = sanitizarNota(e, ''); if (s !== '') assert.equal(valorValido(Number(s)), true, `${JSON.stringify(e)} → ${s}`); }
// ── Cambios de la cuadrícula (los usa la pantalla) ──
const g0 = { e1: { ind: [['8', '', '']], grp: [], sum: [['7']], mejora: { mejora_directa: '', refuerzo: '', mejora_refuerzo: '' } }, e2: { ind: [['', '', '']], grp: [], sum: [['']], mejora: { mejora_directa: '', refuerzo: '', mejora_refuerzo: '' } } };
let g1 = conCelda(g0, 'e1', 'ind', 0, 1, '9,5');
assert.equal(g1.e1.ind[0][1], '9.5'); assert.equal(g0.e1.ind[0][1], '');                 // la cuadrícula anterior no se modifica
assert.equal(g1.e2, g0.e2);                                                               // lo que no cambió se reutiliza
assert.equal(conCelda(g1, 'e1', 'ind', 0, 1, '9.5x').e1.ind[0][1], '9.5');                // una letra no entra
assert.equal(conCelda(g1, 'e1', 'ind', 0, 1, 'abc').e1.ind[0][1], '');                    // pegar texto: queda vacío
assert.equal(conCelda(g1, 'e1', 'ind', 0, 1, '95').e1.ind[0][1], '9.5');                  // 95 > 10: se queda lo anterior
assert.equal(conCelda(g1, 'e1', 'ind', 0, 1, ' ').e1.ind[0][1], '');                      // un espacio ya no se convierte en 0
assert.equal(conCelda(g0, 'noexiste', 'ind', 0, 0, '5'), g0);                             // estudiante o casillero inexistente: sin cambios
assert.equal(conCelda(g0, 'e1', 'ind', 0, 9, '5'), g0); assert.equal(conCelda(g0, 'e1', 'grp', 0, 0, '5'), g0);
assert.equal(conMejora(g0, 'e1', 'refuerzo', '8,25').e1.mejora.refuerzo, '8.25');
assert.equal(conMejora(g0, 'e1', 'refuerzo', 'x').e1.mejora.refuerzo, '');
assert.equal(conMejora(g0, 'e1', 'campo_inventado', '5'), g0); assert.equal(conMejora(g0, 'zz', 'refuerzo', '5'), g0);
console.log('notaEntrada OK');
