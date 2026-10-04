import assert from 'node:assert/strict';
import * as I from '../src/lib/importacionInteligente.js';
import { validarCedulaEC } from '../src/lib/cedula.js';

// cédulas válidas generadas con el mismo algoritmo (provincia 07 = El Oro)
function cedula(prefijo9) {
  const d = String(prefijo9).padStart(9, '0').split('').map(Number);
  let suma = 0;
  for (let i = 0; i < 9; i++) { let v = d[i] * (i % 2 === 0 ? 2 : 1); if (v > 9) v -= 9; suma += v; }
  return d.join('') + ((10 - (suma % 10)) % 10);
}
const C1 = cedula(70467467), C2 = cedula(70123456), C3 = cedula(70999111), C4 = cedula(70555222);
[C1, C2, C3, C4].forEach(c => assert.ok(validarCedulaEC(c), 'cédula de prueba válida ' + c));

// ───── normalizadores ─────
assert.deepEqual(I.normalizarCedula(C1), { valor: C1 });
assert.deepEqual(I.normalizarCedula(Number(C1)), { valor: C1 });                    // número de Excel (pierde el cero inicial)
assert.deepEqual(I.normalizarCedula(' ' + C1.slice(0, 5) + '-' + C1.slice(5) + ' '), { valor: C1 });
assert.equal(I.normalizarCedula('1234567890').valor, null); assert.match(I.normalizarCedula('1234567890').aviso, /no válida/);
assert.equal(I.normalizarCedula('AB123456').valor, null);
assert.deepEqual(I.normalizarCedula(''), { valor: null });
assert.equal(I.normalizarTelefono('991234567').valor, '0991234567');
assert.equal(I.normalizarTelefono('+593 99 123 4567').valor, '0991234567');
assert.equal(I.normalizarTelefono('0991234567 / 072930000').valor, '0991234567');
assert.equal(I.normalizarTelefono('12').valor, null);
assert.equal(I.normalizarEmail(' Juan.Perez@Mail.COM ').valor, 'juan.perez@mail.com');
assert.equal(I.normalizarEmail('sin arroba').valor, null);
assert.equal(I.normalizarGenero('M').valor, 'Masculino'); assert.equal(I.normalizarGenero('mujer').valor, 'Femenino');
assert.equal(I.normalizarGenero('otro').valor, null);
assert.equal(I.normalizarSituacion('Contrato ocasional').valor, 'OCASIONAL');
assert.equal(I.normalizarSituacion('NOMBRAMIENTO DEFINITIVO').valor, 'NOMBRAMIENTO');
assert.equal(I.normalizarSituacion('xyz').valor, null);
assert.equal(I.parseFecha('15/03/2020'), '2020-03-15');
assert.equal(I.parseFecha('2020-3-5'), '2020-03-05');
assert.equal(I.parseFecha('3/15/2020'), '2020-03-15');                              // mes imposible → se invierte
assert.equal(I.parseFecha('15 de marzo de 2020'), '2020-03-15');
assert.equal(I.parseFecha('31/02/2020'), null);
assert.equal(I.parseFecha('hola'), null);
assert.equal(I.parseFecha('43905'), '2020-03-15');                                  // serie de Excel

// ───── nombre completo ─────
assert.deepEqual(I.separarNombreCompleto('PÉREZ GÓMEZ JUAN CARLOS', true), { apellidos: 'PÉREZ GÓMEZ', nombres: 'JUAN CARLOS', dudoso: false });
assert.deepEqual(I.separarNombreCompleto('Juan Carlos Pérez Gómez', false), { nombres: 'Juan Carlos', apellidos: 'Pérez Gómez', dudoso: false });
assert.equal(I.separarNombreCompleto('Vivar Carlos', true).apellidos, 'Vivar'); assert.equal(I.separarNombreCompleto('Vivar Carlos', true).nombres, 'Carlos');
assert.deepEqual(I.separarNombreCompleto('DE LA CRUZ MORA ANA', true), { apellidos: 'DE LA CRUZ MORA', nombres: 'ANA', dudoso: true });
assert.deepEqual(I.separarNombreCompleto('DE LA CRUZ MORA ANA LUCÍA', true), { apellidos: 'DE LA CRUZ MORA', nombres: 'ANA LUCÍA', dudoso: false });
assert.equal(I.separarNombreCompleto('RÍOS ANDREA LUCÍA', true).dudoso, true, '3 palabras: hay que revisar');

// ───── encabezados desordenados y con títulos encima (nómina oficial) ─────
const matrizDoc = [
  ['MINISTERIO DE EDUCACIÓN', '', '', '', '', '', ''],
  ['NÓMINA DE DOCENTES 2026-2027', '', '', '', '', '', ''],
  ['', '', '', '', '', '', ''],
  ['N°', 'CELULAR', 'APELLIDOS Y NOMBRES', 'C.I.', 'TIPO DE CONTRATO', 'CORREO INSTITUCIONAL', 'Fecha de ingreso', 'ASIGNATURA', 'FUNCIÓN'],
  [1, '991234567', 'VIVAR CARLOS', Number(C1), 'Nombramiento definitivo', 'cvivar@edu.ec', '15/03/2018', 'Matemática', 'Docente'],
  [2, '0987654321', 'RÍOS MORA ANDREA LUCÍA', C2, 'Contrato ocasional', 'andrea@x.com', '2020-08-01', 'Lengua', 'Docente'],
  [3, '', 'MORA PRISCILA', '', '', '', '', 'Inglés', ''],
  ['', '', '', '', '', '', '', '', '']
];
let an = I.analizarHoja(matrizDoc, 'docentes');
assert.equal(an.filaEncabezado, 3);
assert.equal(an.filas.length, 3, 'las filas vacías se descartan');
const campoDe = (nombreCol) => an.mapeo.find(m => m.encabezado === nombreCol)?.campo;
assert.equal(campoDe('CELULAR'), 'telefono');
assert.equal(campoDe('APELLIDOS Y NOMBRES'), 'nombre_completo');
assert.equal(campoDe('C.I.'), 'cedula');
assert.equal(campoDe('TIPO DE CONTRATO'), 'situacion');
assert.equal(campoDe('CORREO INSTITUCIONAL'), 'email');
assert.equal(campoDe('Fecha de ingreso'), 'fecha_ingreso');
assert.equal(campoDe('ASIGNATURA'), 'especialidad');
assert.equal(campoDe('FUNCIÓN'), 'cargo');
assert.equal(campoDe('N°'), null, 'el número de orden no se importa');
assert.equal(an.orden, 'apellidos');
let conv = I.convertirFilas(an.filas, an.mapeo, 'docentes', { orden: an.orden, filaInicial: an.filaEncabezado + 2 });
assert.equal(conv.length, 3);
assert.deepEqual([conv[0].datos.apellidos, conv[0].datos.nombres, conv[0].datos.cedula, conv[0].datos.telefono, conv[0].datos.situacion, conv[0].datos.fecha_ingreso],
  ['VIVAR', 'CARLOS', C1, '0991234567', 'NOMBRAMIENTO', '2018-03-15']);
assert.equal(conv[0].fila, 5);
assert.equal(conv[1].datos.apellidos, 'RÍOS MORA'); assert.equal(conv[1].datos.nombres, 'ANDREA LUCÍA');
// lo que falta queda vacío, la fila se crea igual
assert.equal(conv[2].error, null);
assert.deepEqual([conv[2].datos.cedula, conv[2].datos.email, conv[2].datos.telefono, conv[2].datos.situacion, conv[2].datos.cargo], [null, null, null, null, null]);
assert.equal(conv[2].datos.especialidad, 'Inglés');

// ───── columnas en otro orden, encabezados distintos, sin cédula en algunas ─────
const matriz2 = [
  ['Nombres', 'Apellidos', 'Sexo', 'Documento', 'Celular', 'Titulo profesional', 'Cargo', 'Teléfono convencional'],
  ['Carlos', 'Vivar', 'M', C1, '0991234567', 'Lic. Matemática', 'Docente', '072930000'],
  ['Ana', 'Mora', 'F', '123', '', '', '', '']
];
an = I.analizarHoja(matriz2, 'docentes');
assert.equal(an.filaEncabezado, 0);
assert.equal(an.mapeo.find(m => m.encabezado === 'Sexo').campo, 'genero');
assert.equal(an.mapeo.find(m => m.encabezado === 'Documento').campo, 'cedula');
assert.equal(an.mapeo.find(m => m.encabezado === 'Titulo profesional').campo, 'titulo');
assert.equal(an.mapeo.find(m => m.encabezado === 'Celular').campo, 'telefono');
assert.equal(an.mapeo.find(m => m.encabezado === 'Teléfono convencional').campo, null, 'un campo = una columna');
conv = I.convertirFilas(an.filas, an.mapeo, 'docentes');
assert.equal(conv[1].datos.cedula, null); assert.ok(conv[1].avisos.some(a => /cédula no válida/.test(a)));
assert.match(conv[1].datos.observaciones, /Cédula original no válida en la carga: 123/);   // no se pierde el dato original

// ───── archivo SIN encabezados: se reconoce por el contenido ─────
const sinEnc = [
  ['Vivar Carlos', C1, '0991234567', 'cvivar@edu.ec', '15/03/1980', 'M'],
  ['Mora Priscila', C2, '0987654321', 'pmora@edu.ec', '02/11/1985', 'F'],
  ['Ríos Andrea', C3, '0998887777', 'arios@edu.ec', '30/01/1990', 'F']
];
an = I.analizarHoja(sinEnc, 'docentes');
assert.equal(an.filaEncabezado, -1); assert.ok(an.avisos.length);
const porIdx = i => an.mapeo[i];
assert.equal(porIdx(1).campo, 'cedula'); assert.equal(porIdx(1).origen, 'contenido');
assert.equal(porIdx(2).campo, 'telefono'); assert.equal(porIdx(3).campo, 'email');
assert.equal(porIdx(4).campo, 'fecha_nacimiento'); assert.equal(porIdx(5).campo, 'genero');
assert.equal(an.filas.length, 3, 'sin encabezado, la primera fila SÍ es un dato');

// ───── estudiantes: curso, paralelo y representante ─────
const matrizEst = [
  ['Paralelo', 'CÉDULA DEL ESTUDIANTE', 'Apellidos y nombres', 'Curso', 'Fecha de nac.', 'Representante', 'Cédula representante', 'Celular del representante', 'Parentesco', 'Sexo'],
  ['A', C1, 'LÓPEZ TORRES MARÍA JOSÉ', '8vo EGB', '20/06/2012', 'LÓPEZ VERA CARLOS', C4, '0991112233', 'Padre', 'F'],
  ['B', '', 'GÓMEZ RUIZ LUIS', 'Octavo', '', '', '', '', '', 'M']
];
an = I.analizarHoja(matrizEst, 'estudiantes');
const cd = n => an.mapeo.find(m => m.encabezado === n)?.campo;
assert.equal(cd('Paralelo'), 'paralelo'); assert.equal(cd('CÉDULA DEL ESTUDIANTE'), 'cedula');
assert.equal(cd('Apellidos y nombres'), 'nombre_completo'); assert.equal(cd('Curso'), 'curso');
assert.equal(cd('Fecha de nac.'), 'fecha_nacimiento'); assert.equal(cd('Representante'), 'rep_nombre_completo');
assert.equal(cd('Cédula representante'), 'rep_cedula'); assert.equal(cd('Celular del representante'), 'rep_telefono');
assert.equal(cd('Parentesco'), 'rep_parentesco'); assert.equal(cd('Sexo'), 'genero');
conv = I.convertirFilas(an.filas, an.mapeo, 'estudiantes', { orden: an.orden });
assert.equal(conv[0].datos.apellidos, 'LÓPEZ TORRES'); assert.equal(conv[0].datos.nombres, 'MARÍA JOSÉ');
assert.equal(conv[0].cursoTxt, '8vo EGB'); assert.equal(conv[0].paraleloTxt, 'A');
assert.deepEqual([conv[0].representante.apellidos, conv[0].representante.nombres, conv[0].representante.cedula, conv[0].representante.rol_representante],
  ['LÓPEZ VERA', 'CARLOS', C4, 'padre']);
assert.equal(conv[1].representante, null);
// representante sin cédula válida: el estudiante se crea, el representante no
const sinRepCed = I.convertirFilas([['A', C1, 'LÓPEZ TORRES MARÍA', '8vo', '', 'LÓPEZ VERA CARLOS', '', '', '', 'F']], an.mapeo, 'estudiantes');
assert.equal(sinRepCed[0].representante, null); assert.ok(sinRepCed[0].avisos.some(a => /representante sin cédula/.test(a)));
// sin nombre ni apellido → se omite
const sinNombre = I.convertirFilas([['A', C1, '', '8vo', '', '', '', '', '', 'F']], an.mapeo, 'estudiantes');
assert.match(sinNombre[0].error, /falta el nombre y el apellido/);
// dos cédulas por contenido sin encabezado: la segunda es del representante
const dosCed = I.analizarHoja([[C1, C4, 'López María'], [C2, C3, 'Gómez Luis'], [C3, C2, 'Ruiz Ana']], 'estudiantes');
assert.equal(dosCed.mapeo[0].campo, 'cedula'); assert.equal(dosCed.mapeo[1].campo, 'rep_cedula');

// ───── duplicados ─────
const existentes = [{ id: 'e1', cedula: C1, apellidos: 'Vivar', nombres: 'Carlos' }, { id: 'e2', cedula: null, apellidos: 'Mora', nombres: 'Priscila' }];
const regs = [
  { datos: { cedula: C1, apellidos: 'VIVAR', nombres: 'CARLOS' } },                 // misma cédula → existente
  { datos: { cedula: null, apellidos: 'MORA', nombres: 'PRISCILA' } },              // sin cédula, mismo nombre → posible duplicado
  { datos: { cedula: C2, apellidos: 'RÍOS', nombres: 'ANDREA' } },                  // nueva
  { datos: { cedula: C2, apellidos: 'RÍOS', nombres: 'ANDREA' } },                  // repetida en el archivo
  { datos: { cedula: C3, apellidos: 'MORA', nombres: 'PRISCILA' } },                // mismo nombre pero otra cédula → NO es duplicado
  { datos: { cedula: null, apellidos: 'Priscila', nombres: 'Mora' } },              // nombre en otro orden → duplicado
  { error: 'falta el nombre', datos: {} }
];
const dup = I.marcarDuplicados(regs, existentes).map(r => r.duplicado && `${r.duplicado.tipo}/${r.duplicado.por}`);
assert.deepEqual(dup, ['existente/cedula', 'existente/nombre', null, 'archivo/cedula', null, 'existente/nombre', null]);

// completar solo lo vacío, sin pisar
assert.deepEqual(I.camposAActualizar({ email: 'a@x.com', telefono: '', cargo: null }, { email: 'otro@x.com', telefono: '0991112233', cargo: 'Docente', area: null }, ['email', 'telefono', 'cargo', 'area']),
  { telefono: '0991112233', cargo: 'Docente' });

// ───── cursos escritos de muchas formas ─────
const grados = [
  { id: 'g8', nombre: '8vo EGB', nivel: 'SUPERIOR', paralelos: [{ id: 'p8a', nombre: 'A' }, { id: 'p8b', nombre: 'B' }] },
  { id: 'g1b', nombre: '1ro Bachillerato', nivel: 'BGU', paralelos: [{ id: 'p1ba', nombre: 'A' }] },
  { id: 'g1e', nombre: '1er Año EGB', nivel: 'PREPARATORIA', paralelos: [{ id: 'p1ea', nombre: 'A' }, { id: 'p1eb', nombre: 'B' }] },
  { id: 'gi2', nombre: 'Inicial 2', nivel: 'INICIAL', paralelos: [{ id: 'pi2', nombre: 'Única' }] }
];
const rc = (c, p = '') => I.resolverCurso(c, p, grados);
assert.deepEqual([rc('8vo EGB', 'A').gradoId, rc('8vo EGB', 'A').paraleloId], ['g8', 'p8a']);
assert.equal(rc('Octavo', 'b').paraleloId, 'p8b');
assert.equal(rc('Octavo de Básica', 'B').gradoId, 'g8');
assert.equal(rc('8° A').gradoId, 'g8');                                   // paralelo pegado al curso
assert.equal(rc('8vo A').paraleloId, 'p8a');
assert.equal(rc('8vo "B"').paraleloId, 'p8b');
assert.equal(rc('1ro Bachillerato', 'A').gradoId, 'g1b');
assert.equal(rc('1ro BGU', 'A').gradoId, 'g1b');
assert.equal(rc('Primero de Bachillerato', 'A').gradoId, 'g1b');
assert.equal(rc('Primero EGB', 'B').gradoId, 'g1e');
assert.equal(rc('Inicial 2').gradoId, 'gi2'); assert.equal(rc('Inicial 2').paraleloId, 'pi2', 'un solo paralelo: se asigna');
assert.equal(rc('1ro', 'A').gradoId, null); assert.match(rc('1ro', 'A').aviso, /ambiguo/);   // 1ro EGB vs 1ro Bachillerato
assert.match(rc('9no EGB', 'A').aviso, /no existe en este plantel/);
assert.match(rc('8vo EGB', 'Z').aviso, /paralelo "Z" no existe/);
assert.match(rc('8vo EGB').aviso, /falta el paralelo/);
assert.match(rc('cuarto de pizza').aviso || '', /./);
assert.deepEqual(rc(''), { gradoId: null, paraleloId: null, aviso: null });
console.log('OK importacionInteligente: todas las pruebas pasaron');
