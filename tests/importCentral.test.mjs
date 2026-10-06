import assert from 'node:assert/strict';
import { CENTRALES } from '../src/lib/centralesBase.js';
import { leerMatriz, leerObjetos, cedulaCentral, filaParaGuardar, agruparPorColumnas, trozos, filasExport, columnasExport } from '../src/lib/importCentral.js';

const BD = CENTRALES['base-docentes'], DD = CENTRALES['docentes-desvinculados'], BE = CENTRALES['base-estudiantes'], ED = CENTRALES['estudiantes-desvinculados'];

// cédulas: Excel quita el cero inicial
assert.equal(cedulaCentral(702806712), '0702806712');
assert.equal(cedulaCentral(' 070-280.6712 '), '0702806712');
assert.equal(cedulaCentral('12'), null);
assert.equal(cedulaCentral(''), null);

// base de docentes: columnas en desorden, un título por fila, misma cédula = un docente con varios títulos
const m = [
  ['LISTADO BASE', '', '', ''],
  ['Título', 'Cantón', 'Cédula', 'Apellidos y Nombres', 'Especialidad', 'N° de registro', 'Columna rara'],
  ['LICENCIADO EN CIENCIAS', 'MACHALA', 702806712, 'IZQUIERDO GUALAN LAURA YOLANDA', 'EDUCACION BASICA', '1011-08-1', 'x'],
  ['MAGISTER EN GERENCIA', '', '0702806712', '', '', '1011-12-9', ''],
  ['', 'MACHALA', '0913131702', 'VEGA CORDOVA CARMEN ARACELY', 'PRIMARIA', '', ''],
  ['', '', '', 'SIN CEDULA PERSONA', '', '', '']
];
const r = leerMatriz(BD, m);
assert.equal(r.filas.length, 2, 'dos docentes (la 4ª fila no tiene cédula)');
const izq = r.filas.find(f => f.cedula === '0702806712');
assert.equal(izq.titulos.length, 2, 'los dos títulos van al mismo docente');
assert.equal(izq.nombre, 'IZQUIERDO GUALAN LAURA YOLANDA');
assert.equal(izq.canton, 'MACHALA');
assert.equal(r.omitidas.length, 1);
assert.match(r.omitidas[0].motivo, /cédula válida|cédula/i);
assert.equal(r.columnas.find(c => c.encabezado === 'Columna rara').campo, null, 'lo desconocido se ignora');
assert.equal(r.filas.find(f => f.cedula === '0913131702').titulos.length, 0);

// JSON del sistema anterior (titulos como lista)
const j = leerObjetos(BD, [
  { id: 'b1', cedula: '0700807365', nombre: 'JARAMILLO FREIRE ALBERTO', provincia: 'EL ORO', canton: 'MACHALA', categoria: 'DOCENTE CATEGORIA A', especialidad: 'PRIMARIA',
    titulos: [{ titulo: 'LICENCIADO', institucion: 'UTM', tipo: 'Nacional', reconocido_por: '', num_registro: '1011-08-830752', fecha_registro: '2008-05-16', observacion: '', anio: '' }] },
  { cedula: '0101029437', nombre: 'LOAYZA ARMIJOS ANGEL', titulos: [] }
]);
assert.equal(j.filas.length, 2);
assert.equal(j.filas[0].titulos[0].institucion, 'UTM');
assert.equal(j.filas[0].titulos[0].fecha_registro, '2008-05-16');
assert.equal(j.filas[1].titulos.length, 0);
assert.equal(j.totalFilas, 2);
assert.ok(leerObjetos(BD, {}).error);

// desvinculados: motivo y fecha normalizados, cédula repetida se omite
const d = leerMatriz(DD, [
  ['Cédula', 'Apellidos', 'Nombres', 'Motivo', 'Fecha de desvinculación', 'Cargo'],
  ['0702806712', 'Izquierdo', 'Laura', 'Renuncia voluntaria', '15/03/2024', 'DOCENTE'],
  ['0702806712', 'Izquierdo', 'Laura', 'Jubilación', '', ''],
  ['0913131702', 'Vega', 'Carmen', 'por razones familiares', '2024-01-10', '']
]);
assert.equal(d.filas.length, 2);
assert.equal(d.filas[0].motivo, 'renuncia');
assert.equal(d.filas[0].fecha_desvinculacion, '2024-03-15');
assert.equal(d.filas[1].motivo, 'otro');
assert.equal(d.omitidas.length, 1);
assert.match(d.omitidas[0].motivo, /repetida/);

// estudiantes: nombre completo se separa; cédula puede faltar en desvinculados
const e = leerMatriz(ED, [
  ['Apellidos y nombres', 'Curso', 'Fecha de retiro', 'Motivo'],
  ['PEREZ GOMEZ JUAN CARLOS', '8vo A', '2024-02-01', 'traslado'],
  ['', '', '', '']
]);
assert.equal(e.filas.length, 1);
assert.equal(e.filas[0].apellidos, 'PEREZ GOMEZ');
assert.equal(e.filas[0].nombres, 'JUAN CARLOS');
assert.equal(e.filas[0].cedula, null);
const be = leerMatriz(BE, [['Cédula', 'Apellidos', 'Nombres', 'Género'], ['0913131702', 'VEGA', 'CARMEN', 'f'], ['', 'SIN', 'CEDULA', 'M']]);
assert.equal(be.filas.length, 1, 'la base de estudiantes exige cédula');
assert.equal(be.filas[0].genero, 'Femenino');
assert.equal(be.omitidas.length, 1);

// sin encabezados reconocibles
assert.ok(leerMatriz(BD, [['a', 'b'], ['1', '2']]).error);

// no pisar datos con celdas vacías
const g = filaParaGuardar({ cedula: '1', nombre: 'A', canton: null, especialidad: '', titulos: [] });
assert.deepEqual(Object.keys(g).sort(), ['cedula', 'nombre']);
const grupos = agruparPorColumnas([{ a: 1, b: 2 }, { a: 3 }, { b: 5, a: 6 }]);
assert.equal(grupos.length, 2);
assert.equal(trozos([1, 2, 3, 4, 5], 2).length, 3);

// exportar: una fila por título; lo exportado se vuelve a leer igual (ida y vuelta)
const regs = [{ cedula: '0702806712', nombre: 'IZQUIERDO', canton: 'MACHALA', titulos: [{ titulo: 'LIC', num_registro: '1' }, { titulo: 'MAG', num_registro: '2' }], plantel: { nombre: 'COLEGIO X', amie: '07H00001' } },
              { cedula: '0913131702', nombre: 'VEGA', titulos: [] }];
const ex = filasExport(BD, regs);
assert.equal(ex.filas.length, 3);
assert.equal(ex.filas[0].AMIE, '07H00001');
const matriz = [ex.cols, ...ex.filas.map(f => ex.cols.map(c => f[c]))];
const ida = leerMatriz(BD, matriz);
assert.equal(ida.filas.length, 2);
assert.equal(ida.filas.find(f => f.cedula === '0702806712').titulos.length, 2);
assert.equal(columnasExport(ED).includes('AMIE'), true);

console.log('OK importCentral: todas las pruebas pasaron');
