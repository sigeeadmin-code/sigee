import assert from 'node:assert/strict';
import { build } from 'esbuild';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const raiz = path.resolve('.');
const salida = path.join(raiz, 'tests/.matricula.salida.mjs');
await build({
  entryPoints: [path.join(raiz, 'src/lib/data.js')], bundle: true, platform: 'node', format: 'esm', outfile: salida, logLevel: 'error',
  define: { 'import.meta.env': '{}' },
  plugins: [{ name: 'alias', setup(b) { b.onResolve({ filter: /^\.\/supabase\.js$/ }, () => ({ path: path.join(raiz, 'tests/ui/fakeMatriculas.js') })); } }]
});
// el bundle trae su propia copia de la base falsa: se expone con un export extra
fs.appendFileSync(salida, '\nexport { db as __db };\n');
const D = await import(pathToFileURL(salida).href);
const db = D.__db;
const reset = () => { db.matriculas.length = 0; db.estudiantes.length = 0; };

// 1) Matricular por primera vez
reset();
let m = await D.crearMatricula('e1', 'p1', 'g1', 'par1');
assert.equal(m.estado, 'activa'); assert.equal(db.matriculas.length, 1);

// 2) Cambiar de paralelo en el MISMO período: antes se retiraba la activa y el insert fallaba por la restricción única.
//    Ahora se mueve la misma matrícula y sigue ACTIVA (nunca queda "retirado" por un error).
m = await D.crearMatricula('e1', 'p1', 'g1', 'par2', 'Traslado de paralelo');
assert.equal(db.matriculas.length, 1, 'sigue habiendo una sola matrícula por período');
assert.deepEqual([db.matriculas[0].estado, db.matriculas[0].paralelo_id, db.matriculas[0].observacion], ['activa', 'par2', 'Traslado de paralelo']);

// 3) Re-matricular a un estudiante RETIRADO en ese período lo deja activo y borra los datos del retiro
db.matriculas[0].estado = 'retirada'; db.matriculas[0].fecha_salida = '2026-10-05'; db.matriculas[0].motivo_cambio = 'error';
await D.crearMatricula('e1', 'p1', 'g1', 'par1');
assert.deepEqual([db.matriculas[0].estado, db.matriculas[0].fecha_salida, db.matriculas[0].motivo_cambio], ['activa', null, null]);

// 4) Otro período: se crea una matrícula nueva
await D.crearMatricula('e1', 'p2', 'g2', 'par9');
assert.equal(db.matriculas.length, 2);

// 5) Quitar el retiro
reset();
db.estudiantes.push({ id: 'e1', activo: false });
db.matriculas.push({ id: 'mx', estudiante_id: 'e1', periodo_id: 'p1', estado: 'retirada', fecha_salida: '2026-10-05', motivo_cambio: 'x' });
await D.reactivarMatricula('mx', 'e1');
assert.deepEqual([db.matriculas[0].estado, db.matriculas[0].fecha_salida, db.matriculas[0].motivo_cambio, db.estudiantes[0].activo], ['activa', null, null, true]);
// una matrícula que NO está retirada no se toca
db.matriculas[0].estado = 'promovida';
await D.reactivarMatricula('mx', 'e1');
assert.equal(db.matriculas[0].estado, 'promovida');

fs.rmSync(salida, { force: true });
console.log('OK matricula: todas las pruebas pasaron');
