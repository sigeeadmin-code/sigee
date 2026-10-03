import assert from 'node:assert/strict';
import { boletaHTML, documentoBoletas, esc } from '../src/lib/boletaHTML.js';

const base = {
  institucion: { nombre: 'Colegio <Lumen>', amie: '07H00001', logo_url: 'javascript:alert(1)', rector: 'Mgs. Ana' },
  periodoNombre: '2026-2027', cursoNombre: '1ro BGU', paraleloNombre: 'A', tutorNombre: 'Juan "Tutor"',
  fechaEmision: '1 de octubre de 2026',
  estudiante: { nombre: 'Pérez <script>alert(1)</script> Ana', cedula: '0102030405' },
  materias: [
    { nombre: 'Matemática', trims: [8, 8, 8], promedio: 8, final: 8, estado: 'aprobado', supletorio: null },
    { nombre: 'Física', trims: [6, 6, 6], promedio: 6, final: 7, estado: 'aprobado', supletorio: 7 },
    { nombre: 'Química', trims: [3, 3, null], promedio: 3, final: 3, estado: 'pendiente', supletorio: null }
  ]
};
assert.equal(esc('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');

let h = boletaHTML({ ...base, tipo: 'anual' });
assert.ok(!h.includes('<script>'), 'el nombre del estudiante debe escaparse');
assert.ok(!h.includes('javascript:'), 'un logo con esquema no http(s) no se incluye');
assert.ok(h.includes('COLEGIO &lt;LUMEN&gt;'));
assert.ok(h.includes('INFORME FINAL ANUAL'));
assert.ok(h.includes('Juan &quot;Tutor&quot;'));
assert.ok(h.includes('Año lectivo 2026-2027'));
// promedio general = (8 + 7 + 3)/3 = 6.00 (usa el final, no el promedio)
assert.ok(h.includes('>6.00<'), 'promedio general anual');
assert.ok(h.includes('Año lectivo en curso'), 'resumen con notas pendientes');

h = boletaHTML({ ...base, tipo: 'T2', institucion: { ...base.institucion, logo_url: 'https://x.test/logo.png' } });
assert.ok(h.includes('INFORME DE PROGRESO · 2DO TRIMESTRE'));
assert.ok(h.includes('<img src="https://x.test/logo.png"'));
assert.ok(!h.includes('>NE<'), 'en T2 todas las materias tienen nota');
h = boletaHTML({ ...base, tipo: 'T3' });
assert.ok(h.includes('>NE<'), 'Química sin nota en T3 muestra NE');

const doc = documentoBoletas([{ ...base, tipo: 'anual' }, { ...base, tipo: 'anual' }]);
assert.equal((doc.match(/<section class="boleta">/g) || []).length, 2);
assert.ok(doc.includes('page-break-after'));
console.log('OK boleta: todas las pruebas pasaron');

// materiasParaBoleta
import { materiasParaBoleta } from '../src/lib/boletaHTML.js';
const m = materiasParaBoleta(
  [{ id: 'a', materiaNombre: 'Matemática' }, { id: 'b', materiaNombre: 'Física' }, { id: 'c', materiaNombre: 'Química' }],
  [
    ...['T1', 'T2', 'T3'].map(t => ({ docente_materia_id: 'a', periodo_evaluativo: t, nota: '8.50' })),
    ...['T1', 'T2', 'T3'].map(t => ({ docente_materia_id: 'b', periodo_evaluativo: t, nota: 6 })),
    { docente_materia_id: 'c', periodo_evaluativo: 'T1', nota: 9 }
  ],
  [{ docente_materia_id: 'b', supletorio: '7.5' }]
);
assert.equal(m[0].final, 8.5); assert.equal(m[0].estado, 'aprobado');
assert.equal(m[1].final, 7); assert.equal(m[1].estado, 'aprobado'); assert.equal(m[1].supletorio, 7.5);
assert.equal(m[2].estado, 'pendiente'); assert.deepEqual(m[2].trims, [9, null, null]);
console.log('OK boleta: materiasParaBoleta');

// Estado reprobado (ya no existe remedial)
const hr = boletaHTML({ ...base, tipo: 'anual', materias: [{ nombre: 'Física', trims: [3, 3, 3], promedio: 3, final: 3, estado: 'reprobado', supletorio: null }] });
assert.ok(hr.includes('Reprobado') && hr.includes('Tiene asignaturas reprobadas.') && !hr.includes('emedial'));
console.log('OK boleta: reprobado');

// Nivel en la boleta
const hn = boletaHTML({ ...base, tipo: 'anual', nivelNombre: 'Superior' });
assert.ok(hn.includes('<strong>Nivel:</strong> Superior'));
assert.ok(boletaHTML({ ...base, tipo: 'anual' }).includes('<strong>Nivel:</strong> —'));
console.log('OK boleta: nivel');

// Texto de la escala por nivel (el nombre del nivel lo pasa el llamador en nivelNombre)
const hs = boletaHTML({ ...base, tipo: 'anual', nivel: 'SUPERIOR', nivelNombre: 'Superior', cursoNombre: '8vo EGB' });
assert.ok(hs.includes('<strong>Nivel:</strong> Superior'));
assert.ok(hs.includes('<strong>DA</strong> Domina los aprendizajes (9–10)') && hs.includes('rinde supletorio'));
const hb = boletaHTML({ ...base, tipo: 'T1', nivel: 'BACHILLERATO', nivelNombre: 'Bachillerato' });
assert.ok(hb.includes('<strong>Nivel:</strong> Bachillerato') && hb.includes('4.01–6.99, rinde supletorio'));
assert.ok(boletaHTML({ ...base, tipo: 'T1' }).includes('4.01–6.99, rinde supletorio'), 'sin nivel: texto por defecto');
assert.ok(boletaHTML({ ...base, tipo: 'T1' }).includes('<strong>Nivel:</strong> —'));
console.log('OK boleta: textos por nivel');
