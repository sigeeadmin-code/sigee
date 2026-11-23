import test from 'node:test';
import assert from 'node:assert/strict';
import { libroExcel, htmlImprimible, lineasEncabezado, esc, textoNoLectivos } from '../src/lib/listadosReporte.js';

const meta = {
  institucion: { nombre: 'COLEGIO LUMEN', amie: '07H01222', regimen: 'Costa' }, rango: { desde: '2026-11-02', hasta: '2026-11-13' }, generado_en: '2026-11-23T10:00:00Z',
  total_estudiantes: 2, tutor: 'Ríos Andrea', alcance: 'solo las materias a cargo del docente',
  calendario: { dias_lectivos: 9, dias_del_rango: 12, no_lectivos: [{ tipo: 'feriado', descripcion: 'Día de los Difuntos', desde: '2026-11-02', hasta: '2026-11-03' }], recuperaciones: [] }
};

test('el encabezado trae institución, AMIE, título, período y calendario con los feriados', () => {
  const l = lineasEncabezado({ tipo: 'junta_curso', meta }, { filtrosTexto: ['Curso: 2do Bachillerato', 'Paralelo A'] });
  assert.equal(l[0], 'COLEGIO LUMEN');
  assert.ok(l[1].includes('07H01222'));
  assert.ok(l.some(x => x.includes('9 día(s) lectivo(s) de 12')));
  assert.ok(l.some(x => x.includes('Feriado') && x.includes('Día de los Difuntos')));
  assert.ok(l.some(x => x.startsWith('Alcance: solo las materias')));
  assert.ok(l.some(x => x.startsWith('Filtros: Curso: 2do Bachillerato')));
});

test('Excel de asistencia: solo columnas de días lectivos, faltas y justificadas separadas, con encabezado', () => {
  const res = { tipo: 'asistencia', meta: { ...meta, dias: ['2026-11-04', '2026-11-05'] }, estudiantes: [{ n: 1, cedula: '1', nombre_completo: 'Pérez Ana', marcas: { '2026-11-04': 'F', '2026-11-05': '✓' }, faltas: 1, atrasos: 0, justificadas: 0, pct_asistencia: 50 }] };
  const { hojas, nombreArchivo } = libroExcel(res);
  assert.equal(nombreArchivo, 'Lista_Asistencia_2026-11-02_2026-11-13.xlsx');
  assert.deepEqual(hojas[0].cols.slice(3, 5), ['Mié 4', 'Jue 5']);
  assert.ok(hojas[0].cols.includes('Justificadas'));
  assert.equal(hojas[0].filas[0]['Mié 4'], 'F');
  assert.ok(hojas[0].encabezado.length >= 6);
});

test('Excel del resumen del inspector: hoja por paralelo con total y hoja por curso', () => {
  const x = { total_estudiantes: 30, hombres: 14, mujeres: 16, presentes: 200, atrasos: 5, faltas: 10, justificadas: 3, pct_asistencia: 95.3, en_riesgo: 2 };
  const { hojas } = libroExcel({ tipo: 'resumen_inspector', meta, resumen: [{ ...x, curso: '1ro', paralelo: 'A', jornada: 'Matutina' }], por_curso: [{ ...x, curso: '1ro', paralelos: 1 }], totales: x });
  assert.equal(hojas.length, 2);
  assert.equal(hojas[0].filas.at(-1)['Curso'], 'TOTAL DEL PLANTEL');
  assert.equal(hojas[0].filas[0]['% Asistencia'], 95.3);
  assert.equal(hojas[1].filas[0]['Paralelos'], 1);
});

test('Excel del resumen por materia del docente', () => {
  const r = { curso: '2do', paralelo: 'A', materia: 'Historia', docente: 'Ríos Andrea', estudiantes: 30, clases_registradas: 12, presentes: 300, atrasos: 4, faltas: 20, justificadas: 6, pct_asistencia: 93.8 };
  const { hojas } = libroExcel({ tipo: 'resumen_docente', meta, resumen: [r], totales: { ...r } });
  assert.equal(hojas[0].filas[0]['Materia'], 'Historia');
  assert.equal(hojas[0].filas.at(-1)['Curso'], 'TOTAL');
});

test('la impresión escapa los datos (un nombre con HTML no inyecta nada) y la junta incluye faltas y % de asistencia', () => {
  const res = { tipo: 'junta_curso', meta, estudiantes: [{ n: 1, nombre_completo: '<img src=x onerror=alert(1)> Pérez', sexo: 'F', faltas: 2, atrasos: 1, justificadas: 0, pct_asistencia: 88.9 }] };
  const html = htmlImprimible(res);
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;img'));
  assert.ok(html.includes('88,9 %'));
  assert.ok(html.includes('Observaciones de comportamiento'));
  assert.ok(html.includes('landscape'));
  assert.ok(html.includes('window.print()'));
});

test('escape y texto de no lectivos', () => {
  assert.equal(esc(`<a href="x">&'</a>`), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  assert.deepEqual(textoNoLectivos({ no_lectivos: [{ tipo: 'vacacion', descripcion: '', desde: '2026-12-21', hasta: '2026-12-31' }] }), ['Vacación 21 dic 2026 al 31 dic 2026']);
});
