import assert from 'node:assert/strict';
import { construirDocumento, construirOficioRendimiento, construirPlanRefuerzo, construirActaCompromiso, construirFichaTutor, TIPOS_FICHA, textoCompleto,
  editarTexto, editarCampo, editarCelda, agregarFila, quitarFila, marcarItem, editarFirma, editarCabecera } from '../src/lib/fichasRendimiento.js';

const institucion = { nombre: 'Unidad Educativa "Ismael Pérez Pazmiño"', amie: '07H00001' };
const estudiante = { nombre: 'Gómez Lucía', cedula: '0701234567', curso: '1RO Gestión Adm. y Logística D', jornada: 'Matutina', representante: { nombres: 'Rosa', apellidos: 'Gómez' } };
const materias = [
  { materia: 'Física', docente: 'PÉREZ ANA', formativo: 3.5, sumativo: 3.5, parcial: 3.5 },
  { materia: 'Química', docente: 'LOOR LUIS', formativo: 6.47, sumativo: null, parcial: 6.47 },
  { materia: 'Lengua', docente: 'SOLANO BELGICA', formativo: 8.2, sumativo: 9, parcial: 8.44 },
  { materia: 'ECA', docente: 'MOSQUERA NINO', formativo: null, sumativo: null, parcial: null }
];
const base = { institucion, estudiante, trimestre: 'T1', periodoLectivo: '2026-2027', materias, opciones: { numero: '012', ciudad: 'Machala', fecha: new Date(2026, 9, 20), firmanteNombre: 'MINGA MARYURI', tutorNombre: 'RAMOS GINGER' } };

// Oficio: solo asignaturas bajo 7 (no la de 8,44 ni la sin notas), con escala y datos de la familia
const of = construirOficioRendimiento(base); const t = textoCompleto(of);
assert.ok(t.includes('Machala, 20 de octubre de 2026') && t.includes('Oficio Nro. 012') && t.includes('GÓMEZ LUCÍA') && t.includes('ROSA GÓMEZ'));
assert.ok(t.includes('Física') && t.includes('3,50') && t.includes('NA · No alcanza') && t.includes('Química') && t.includes('PA · Próximo a alcanzar'));
assert.ok(!t.includes('Lengua') && !t.includes('ECA'), 'solo asignaturas en alerta');
assert.ok(t.includes('plan individual de refuerzo pedagógico') && t.includes('primer trimestre') && t.includes('evaluación psicopedagógica'));
assert.ok(of.bloques.some(b => b.t === 'firmas' && b.firmas.some(f => f.cargo === 'Docente tutor') && b.firmas.some(f => f.cargo === 'Inspector General')));
assert.equal(construirOficioRendimiento({ ...base, opciones: { ...base.opciones, mencionarDece: false } }).bloques.some(b => /DECE/.test(b.texto || '')), false, 'se puede quitar la derivación al DECE');

// Plan de refuerzo
const pl = construirPlanRefuerzo(base); const tp = textoCompleto(pl);
assert.ok(tp.includes('Clases de refuerzo') && tp.includes('Tutorías individuales') && tp.includes('Cronograma de estudio en casa') && tp.includes('Promedio inicial') && tp.includes('Representante legal'));
assert.ok(pl.bloques.find(b => b.t === 'tabla' && b.cols[0] === 'Fecha').filas.length === 4, 'cronograma con filas vacías para llenar');
// Acta y ficha del tutor
assert.ok(textoCompleto(construirActaCompromiso(base)).includes('Compromisos'));
const ft = construirFichaTutor({ ...base, asistencia: { dias: 40, presentes: 35, faltas: 3, justificadas: 1, atrasos: 2, pctAsistencia: 92.5, rachaMax: 2 }, periodoAsistencia: '04/05/2026 a 20/10/2026' });
const tf = textoCompleto(ft);
assert.ok(tf.includes('Lengua') && tf.includes('ECA'), 'la ficha del tutor lista TODAS las asignaturas');
assert.ok(tf.includes('92.5%') && tf.includes('04/05/2026 a 20/10/2026') && tf.includes('Promedio general'), 'asistencia y promedio');
assert.ok(tf.includes('Asignaturas con promedio menor a 7') && ft.bloques.find(b => b.t === 'campos' && b.filas[0][0].startsWith('Promedio general')).filas[1][1] === '2');
assert.equal(construirFichaTutor({ ...base, asistencia: null }).bloques.some(b => b.t === 'campos' && b.filas.some(f => f[0] === 'Faltas injustificadas' && f[1] === '')), true, 'sin datos de asistencia queda en blanco para llenar');

// Reglas de contenido: sin números de artículo no verificados, siempre con aviso de borrador y base normativa
for (const tipo of Object.keys(TIPOS_FICHA)) {
  const d = construirDocumento(tipo, base);
  assert.equal(d.tipo, tipo); assert.ok(d.aviso.includes('borrador') && d.pie.includes('Decreto Ejecutivo No. 675'), tipo);
  assert.ok(!/art\.\s*\d+|artículo\s*\d+/i.test(d.pie), 'no cita números de artículo sin verificar: ' + tipo);
  assert.ok(d.cabecera.institucion === institucion.nombre.toUpperCase() && d.cabecera.amie === 'AMIE 07H00001');
  const ids = d.bloques.map(b => b.id); assert.equal(new Set(ids).size, ids.length, 'ids únicos');
}
assert.throws(() => construirDocumento('otro', base));

// Edición inmutable
let d = construirPlanRefuerzo(base); const orig = JSON.stringify(d);
const tabCron = d.bloques.find(b => b.t === 'tabla' && b.cols[0] === 'Fecha');
const d2 = editarCelda(d, tabCron.id, 0, 1, 'Tutoría de Física');
assert.equal(d2.bloques.find(b => b.id === tabCron.id).filas[0][1], 'Tutoría de Física'); assert.equal(JSON.stringify(d), orig, 'no muta el original');
assert.equal(agregarFila(d2, tabCron.id).bloques.find(b => b.id === tabCron.id).filas.length, 5);
assert.equal(quitarFila(d2, tabCron.id, 0).bloques.find(b => b.id === tabCron.id).filas.length, 3);
const lis = d.bloques.find(b => b.t === 'lista'); assert.equal(marcarItem(d, lis.id, 1, true).bloques.find(b => b.id === lis.id).items[1].marcado, true);
const camp = d.bloques.find(b => b.t === 'campos'); assert.equal(editarCampo(d, camp.id, 1, '0799').bloques.find(b => b.id === camp.id).filas[1][1], '0799');
const fir = d.bloques.find(b => b.t === 'firmas'); assert.equal(editarFirma(d, fir.id, 0, 'nombre', 'X').bloques.find(b => b.id === fir.id).firmas[0].nombre, 'X');
assert.equal(editarCabecera(d, 'institucion', 'OTRA').cabecera.institucion, 'OTRA');
const tx = d.bloques.find(b => b.t === 'texto'); assert.equal(editarTexto(d, tx.id, 'nuevo').bloques.find(b => b.id === tx.id).texto, 'nuevo');
console.log('fichasRendimiento: ok');
