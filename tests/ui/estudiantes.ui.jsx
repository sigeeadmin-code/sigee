import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import Estudiantes from '../../src/pages/Estudiantes.jsx';
import { llamadas, base, reiniciar, setFalla } from './fakeSupabase.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const sesion = {
  profile: { id: 'p1', rolDb: 'admin_plantel', rol: 'admin_plantel' },
  institucion: { id: 'inst1', nombre: 'COLEGIO PRUEBA', provincia: 'EL ORO', canton: 'MACHALA' },
  data: { estudiantes: [], periodoActivo: { id: 'per1', nombre: '2026-2027' } },
  refrescarDatos: () => {}
};
// useSession viene del alias a este contexto
import { __setSesion } from './sessionStub.js';

const esperar = ms => new Promise(r => setTimeout(r, ms));
const cambiar = (el, valor) => { const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set; set.call(el, valor); el.dispatchEvent(new window.Event('input', { bubbles: true })); };
const botonPor = (raiz, txt) => [...raiz.querySelectorAll('button')].find(b => b.textContent.includes(txt));

async function escenario(nombre, fallaBD) {
  reiniciar(); base.estudiantes = []; setFalla(fallaBD || null);
  __setSesion(sesion);
  const cont = document.createElement('div'); document.body.appendChild(cont);
  const root = createRoot(cont);
  let errorRender = null;
  const orig = console.error; console.error = (...a) => { const t = a.join(' '); if (/The above error occurred|Uncaught|Error:/.test(t)) errorRender = errorRender || t.slice(0, 160); };
  await act(async () => { root.render(<Estudiantes />); await esperar(30); });
  await act(async () => { botonPor(cont, '+ Nuevo estudiante').click(); await esperar(10); });
  const entradas = [...cont.querySelectorAll('.modal input.fc, .modal-b input.fc')];
  const porEtiqueta = txt => { const l = [...cont.querySelectorAll('label')].find(x => x.textContent.trim().toLowerCase().startsWith(txt)); return l?.parentElement.querySelector('input'); };
  await act(async () => { cambiar(porEtiqueta('nombres'), 'María José'); cambiar(porEtiqueta('apellidos'), 'López Torres'); await esperar(5); });
  await act(async () => { botonPor(cont, 'Guardar').click(); await esperar(60); });
  console.error = orig;
  const html = cont.innerHTML;
  const r = {
    nombre, pantallaEnBlanco: html.trim() === '' || cont.textContent.trim() === '',
    errorDeRender: errorRender, modalAbierto: !!cont.querySelector('.modal, .modal-bg'),
    mensajeError: (cont.querySelector('.alert, .error, [class*=err]')?.textContent || '').slice(0, 140),
    aparece: cont.textContent.includes('López Torres María José') || cont.textContent.includes('López Torres'),
    insertsEstudiantes: llamadas.filter(l => l.tabla === 'estudiantes' && l.op === 'insert').length,
    filasGuardadas: base.estudiantes.length
  };
  root.unmount(); cont.remove();
  return r;
}
globalThis.__resultados = [];
globalThis.__correr = async () => {
  globalThis.__resultados.push(await escenario('crear estudiante (caso normal)'));
  globalThis.__resultados.push(await escenario('crear estudiante (la base devuelve error)', { tabla: 'estudiantes', op: 'insert', mensaje: 'fallo simulado de la base' }));
};
