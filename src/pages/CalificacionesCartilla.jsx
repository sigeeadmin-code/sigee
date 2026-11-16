import React from 'react';
import PaginaPublica from '../components/PaginaPublica.jsx';

const PANTALLAS = [
  {
    id: 'registro', corto: 'Registro de notas', n: '01', quien: 'Docentes',
    titulo: 'Registra las notas por aporte, curso por curso',
    texto: 'El docente elige curso, paralelo, materia y trimestre, y llena el cuadro: una fila por estudiante y una columna por casillero.',
    puntos: [
      'Cada aporte lleva su nombre, su porcentaje y un color propio en el encabezado.',
      'El promedio de cada aporte aparece junto a sus casilleros.',
      'El promedio formativo aporta el 70 % de la nota del trimestre.',
      'Las notas son numéricas y los promedios se redondean a dos decimales.',
      'Se puede descargar una plantilla, llenarla y subirla, además de guardar el trimestre.'
    ],
    img: '/capturas/notas-cuadro.webp', w: 1177, h: 478, barra: 'Calificaciones · Registro de notas',
    alt: 'Cuadro de calificaciones de 8vo EGB a 3ro de Bachillerato: filtros de curso, paralelo, materia y trimestre, y una tabla con los aportes individuales y grupales, sus porcentajes, los casilleros de cada estudiante y el promedio formativo.'
  },
  {
    id: 'trimestre', corto: 'Nota del trimestre', n: '02', quien: 'Docentes',
    titulo: 'De los promedios a la nota del trimestre',
    texto: 'Al lado del promedio formativo, el cuadro suma la evaluación sumativa y calcula la nota final del trimestre.',
    puntos: [
      'La evaluación sumativa aporta el 30 %: proyecto interdisciplinar y evaluación de trimestre.',
      'Columnas opcionales de mejora: directa, refuerzo y mejora.',
      'La nota del trimestre y su equivalencia (DA, AA, PA o NA) se calculan solas.',
      'Mientras un estudiante no tiene notas definitivas, queda sin evaluar.'
    ],
    img: '/capturas/notas-sumativa.webp', w: 1180, h: 479, barra: 'Calificaciones · Evaluación sumativa y nota del trimestre',
    alt: 'Parte derecha del cuadro de calificaciones: promedio formativo del 70 %, proyecto interdisciplinar y evaluación de trimestre, promedio sumativo del 30 %, columnas de mejora opcional, nota del trimestre y equivalencia.'
  },
  {
    id: 'configuracion', corto: 'Casilleros', n: '03', quien: 'Docentes',
    titulo: 'Cada materia con sus propios casilleros',
    texto: 'El docente define los aportes, el número de actividades y el peso de cada uno, y el sistema vigila que todo sume 100 %.',
    puntos: [
      'Aportes individuales, aportes grupales y evaluación sumativa, cada uno con su nombre, número de actividades y peso.',
      'El resumen muestra formativa 70 %, sumativa 30 % y el total.',
      'Si la materia ya tiene notas, solo se pueden renombrar los rubros y ajustar los casilleros: los pesos quedan protegidos.',
      'Un botón permite restaurar la plantilla.'
    ],
    img: '/capturas/notas-configuracion.webp', w: 734, h: 592, barra: 'Calificaciones · Configuración de evaluación',
    alt: 'Ventana de configuración de evaluación: lista de aportes individuales y grupales con su número de actividades y porcentaje, evaluación sumativa, un resumen que suma 100 % y un aviso sobre las notas ya guardadas.'
  },
  {
    id: 'informe-trimestral', corto: 'Informe trimestral', n: '04', quien: 'Tutores, rectorado y familias',
    titulo: 'El informe de progreso, listo para imprimir',
    texto: 'Cada estudiante recibe su informe del trimestre con los datos de la institución y el estudiante.',
    puntos: [
      'Encabezado con la institución, el año lectivo, el estudiante, el curso y el docente tutor.',
      'Nota, equivalencia y escala de cada asignatura; «NE» cuando aún no hay nota definitiva.',
      'Promedio general y leyenda de la escala de calificaciones.',
      'Espacio para la evaluación comportamental y las observaciones del docente tutor.'
    ],
    img: '/capturas/cartilla-trimestral.webp', w: 794, h: 599, barra: 'Informe de aprendizaje · Informe de progreso trimestral',
    alt: 'Informe de progreso del primer trimestre: datos del estudiante y del curso, tabla de asignaturas con nota, equivalencia y escala, promedio general, leyenda de la escala y espacio para observaciones del docente tutor.'
  },
  {
    id: 'informe-anual', corto: 'Informe final', n: '05', quien: 'Tutores, rectorado y familias',
    titulo: 'El informe final anual, con los tres trimestres',
    texto: 'Al cierre del año lectivo, el informe reúne el recorrido completo del estudiante.',
    puntos: [
      'Las notas de los tres trimestres y el promedio final de cada asignatura.',
      'Columnas de equivalencia, supletorio y estado de cada asignatura.',
      'El resultado del año lectivo aparece al pie; mientras faltan notas, se muestra «en curso».',
      'Firmas del docente tutor, del rector y del representante legal.'
    ],
    img: '/capturas/cartilla-anual.webp', w: 782, h: 566, barra: 'Informe de aprendizaje · Informe final anual',
    alt: 'Informe final anual: datos del estudiante, tabla con las notas del primer, segundo y tercer trimestre, promedio final, equivalencia, supletorio y estado, resultado del año lectivo y firmas del docente tutor, el rector y el representante.'
  }
];

const CFG = {
  titulo: 'Calificaciones y cartilla oficial MINEDUC · SIGEE',
  nota: 'Calificaciones y cartilla oficial MINEDUC',
  h1: 'De la nota de cada casillero a la cartilla oficial, en un solo lugar.',
  lede: 'Los docentes registran las notas por aporte, SIGEE calcula el promedio formativo, el sumativo y la nota del trimestre, y los informes de aprendizaje quedan listos para imprimir.',
  pantallas: PANTALLAS,
  familia: { titulo: 'Estudiantes y representantes', texto: 'Cada estudiante y su familia ven sus propias calificaciones y su informe, sin acceso a las de otros estudiantes.' },
  cierre: { titulo: 'Pruébalo con una institución de ejemplo', texto: 'Recibe un acceso de 5 días con cursos, docentes y notas ficticias para probar el registro y los informes.' }
};

export default function CalificacionesCartilla() { return <PaginaPublica cfg={CFG} />; }
