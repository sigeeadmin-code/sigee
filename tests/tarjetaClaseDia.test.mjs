import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { pathToFileURL } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';

// Se compila el JSX de la tarjeta (solo depende de React y de la lógica pura) y se renderiza a HTML para revisar qué ve cada rol.
const dir = mkdtempSync(path.join(process.cwd(), 'node_modules', '.tarjeta-'));
const salida = path.join(dir, 'tarjeta.mjs');
await build({ entryPoints: ['src/components/TarjetaClaseDia.jsx'], bundle: true, format: 'esm', outfile: salida, jsx: 'automatic', external: ['react', 'react/jsx-runtime'], logLevel: 'silent' });
const { default: Tarjeta } = await import(pathToFileURL(salida).href);
process.on('exit', () => rmSync(dir, { recursive: true, force: true }));

const clase = (o = {}) => ({
  docente_materia_id: 'dm1', materia: 'Matemática', curso: '1ro Bachillerato', paralelo: 'A', franjas: '11:10–11:45, 11:45–12:20', inicio: '11:10', fin: '12:20', estudiantes: 12,
  estado: 'registrada', en_hora: true, presentes: 8, atrasos: 1, ausentes: 2, justificados: 1,
  lista_ausentes: [{ id: 'x1', nombre: 'Demo 11-2 Estudiante' }, { id: 'x2', nombre: 'Demo 11-3 Estudiante' }], lista_atrasos: [{ id: 'y1', nombre: 'Demo 11-4 Estudiante', hora: '11:20' }], ...o
});
const html = (props) => renderToStaticMarkup(React.createElement(Tarjeta, { hora: '11:20', seleccion: new Set(), onAlternar() {}, onTodos() {}, onMarcar() {}, ...props }));

test('el Inspector General, dentro de la hora, ve casillas, el botón de atraso y los minutos que quedan', () => {
  const h = html({ c: clase(), rolDb: 'inspector_general' });
  assert.match(h, /type="checkbox"/);
  assert.match(h, /Llegó tarde: registrar atraso/);
  assert.match(h, /quedan 25 minutos/);
  assert.match(h, /Demo 11-4 Estudiante · 11:20/);
});

test('fuera de la hora de esa clase no hay casillas ni botón y se explica por qué', () => {
  const h = html({ c: clase({ en_hora: false }), rolDb: 'inspector_general' });
  assert.doesNotMatch(h, /type="checkbox"/);
  assert.doesNotMatch(h, /Llegó tarde/);
  assert.match(h, /ya terminó: los ausentes siguen como ausentes/);
});

test('el resto de roles (p. ej. Vicerrector/supervisor) ve la clase pero es informativo: sin casillas ni botón', () => {
  for (const rolDb of ['supervisor_plantel', 'admin_plantel', 'secretario']) {
    const h = html({ c: clase(), rolDb });
    assert.doesNotMatch(h, /type="checkbox"/, rolDb);
    assert.doesNotMatch(h, /Llegó tarde/, rolDb);
    assert.match(h, /informativa/, rolDb);
    assert.match(h, /Demo 11-2 Estudiante/, rolDb);
  }
});

test('clase sin registro: avisa que el docente no registró y no ofrece marcar atraso', () => {
  const h = html({ c: clase({ estado: 'sin_registro', en_hora: false, presentes: 0, atrasos: 0, ausentes: 0, justificados: 0, lista_ausentes: [], lista_atrasos: [] }), rolDb: 'inspector_general' });
  assert.match(h, /no registró la asistencia de esta clase/);
  assert.doesNotMatch(h, /Llegó tarde/);
});

test('nada se escapa mal: un nombre con HTML se muestra como texto', () => {
  const h = html({ c: clase({ lista_ausentes: [{ id: 'z', nombre: '<img src=x onerror=alert(1)>' }] }), rolDb: 'supervisor_plantel' });
  assert.doesNotMatch(h, /<img src=x/);
  assert.match(h, /&lt;img/);
});
