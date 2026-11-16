import React from 'react';
import PaginaPublica from '../components/PaginaPublica.jsx';

const PANTALLAS = [
  {
    id: 'inicio', corto: 'Inicio', n: '01', quien: 'Estudiantes y representantes',
    titulo: 'Todo lo importante, apenas entras',
    texto: 'El estudiante ve su resumen del día: cómo va en notas, asistencia y tareas, sin buscar en menús.',
    puntos: [
      'Promedio general, asistencia, tareas pendientes y posición en el curso, de un vistazo.',
      'Promedio de cada materia en «Mis calificaciones».',
      'Tareas pendientes con su materia y su fecha límite.',
      '«Seguimiento y documentos» reúne los oficios y documentos que la institución registra.',
      'Debajo, el resumen de asistencia y faltas desde el inicio de clases.'
    ],
    img: '/capturas/portal-inicio.webp', w: 1177, h: 623, barra: 'Portal del estudiante · Inicio',
    alt: 'Inicio del portal del estudiante: saludo, cuatro indicadores (promedio general, asistencia, tareas pendientes y posición), tabla de calificaciones por materia, seguimiento y documentos, tareas pendientes y resumen de asistencia.'
  },
  {
    id: 'asistencia', corto: 'Asistencia y faltas', n: '02', quien: 'Estudiantes y representantes',
    titulo: 'Su asistencia, sin sorpresas',
    texto: 'Desde el inicio de clases: los días lectivos, las faltas y qué pasó con cada una.',
    puntos: [
      'Porcentaje de asistencia, faltas, justificadas, atrasos y días lectivos desde el inicio.',
      'Historial por día, por materia y de justificaciones.',
      'Cuando el docente tutor justifica una falta, queda anotado en el historial.',
      'El botón «Justificar una falta» está en la misma pantalla.',
      '«Hoja de ruta» reúne las faltas y los documentos relacionados.'
    ],
    img: '/capturas/portal-asistencia.webp', w: 1177, h: 463, barra: 'Portal del estudiante · Asistencia y faltas',
    alt: 'Pantalla de asistencia y faltas del estudiante: porcentaje de asistencia, faltas, justificadas, atrasos y días lectivos, pestañas de historial, por materia y justificaciones, y hoja de ruta de faltas y documentos.'
  },
  {
    id: 'horario', corto: 'Horario', n: '03', quien: 'Estudiantes y representantes',
    titulo: 'El horario del curso, claro y listo para imprimir',
    texto: 'La semana completa del curso, con las clases ordenadas por hora.',
    puntos: [
      'Cada materia tiene su propio color, para reconocerla de un vistazo.',
      'El día de hoy aparece resaltado.',
      'Los recreos están marcados dentro de la cuadrícula.',
      'Un botón permite imprimir el horario.'
    ],
    img: '/capturas/portal-horario.webp', w: 1171, h: 538, barra: 'Portal del estudiante · Horario',
    alt: 'Horario semanal de un curso: columnas de lunes a viernes, bloques por hora con cada materia en un color distinto, el día de hoy resaltado y los recreos marcados.'
  },
  {
    id: 'ficha', corto: 'Mi ficha', n: '04', quien: 'Estudiantes y representantes',
    titulo: 'Sus datos y el contacto de emergencia',
    texto: 'Una ficha para consultar los datos personales y familiares registrados por la institución.',
    puntos: [
      'Datos personales y de documento del estudiante.',
      'Datos familiares, con el contacto del representante.',
      'Representante de emergencia, con un botón para llamar.',
      'Es una pantalla de solo lectura.'
    ],
    img: '/capturas/portal-ficha.webp', w: 1148, h: 557, barra: 'Portal del estudiante · Mi ficha',
    alt: 'Ficha del estudiante en solo lectura: nombre, curso y paralelo, datos personales, datos familiares del representante y tarjeta de representante de emergencia con botón para llamar.'
  }
];

const CFG = {
  titulo: 'Portal de acceso al estudiante · SIGEE',
  nota: 'Portal de acceso al estudiante',
  h1: 'Todo lo del estudiante, en un solo lugar.',
  lede: 'Calificaciones, tareas, asistencia, horario y ficha personal, disponibles para el estudiante y su representante desde cualquier dispositivo.',
  pantallas: PANTALLAS,
  familia: { titulo: 'Representantes', texto: 'Los representantes ven la información de su representado con su propio acceso. Nadie ve datos de otros estudiantes.' },
  cierre: { titulo: 'Pruébalo con una institución de ejemplo', texto: 'Recibe un acceso de 5 días con cursos, docentes y estudiantes ficticios para recorrer el portal.' }
};

export default function PortalEstudiante() { return <PaginaPublica cfg={CFG} />; }
