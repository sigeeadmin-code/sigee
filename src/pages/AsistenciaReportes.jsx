import React from 'react';
import PaginaPublica from '../components/PaginaPublica.jsx';

const PANTALLAS = [
  {
    id: 'registro-diario', corto: 'Registro diario', n: '01', quien: 'Docentes',
    titulo: 'Pasa lista por clase, en un minuto',
    texto: 'El docente elige curso, paralelo, materia y fecha, y marca a cada estudiante. La asistencia siempre se toma por materia, nunca de forma general.',
    puntos: [
      'Presente, atraso, ausente o justificado, con una observación opcional por estudiante.',
      'Los totales de la parte superior se actualizan mientras marcas.',
      '«Todos presentes» adelanta el trabajo: solo corriges las excepciones.',
      'Indica si la fecha es día lectivo según el calendario del plantel.',
      'Desde la misma lista puedes avisar por WhatsApp al representante de un estudiante ausente.'
    ],
    img: '/capturas/asistencia-registro-diario.webp', w: 1147, h: 626, barra: 'Asistencia · Registro diario',
    alt: 'Pantalla de asistencia diaria: filtros de curso, paralelo, materia y fecha, cuatro totales (presentes, atrasos, ausentes, sin marcar) y la lista de estudiantes con opciones de presente, atraso, ausente y justificado.'
  },
  {
    id: 'consultas', corto: 'Consultas y estadísticas', n: '02', quien: 'Docentes',
    titulo: 'Encuentra a cualquier estudiante y revisa su historial',
    texto: 'Busca por nombre o cédula y filtra por curso, paralelo y rango de fechas. Cada docente consulta solo sus propias clases.',
    puntos: [
      'Vista por curso o por estudiante.',
      'Totales de presentes, atrasos, ausentes y justificados del período elegido.',
      'Cada falta con su fecha, materia, estado y observación.'
    ],
    img: '/capturas/asistencia-consultas.webp', w: 1155, h: 531, barra: 'Asistencia · Consultas y estadísticas',
    alt: 'Pantalla de consultas y estadísticas: buscador de estudiantes, filtros por curso y fechas, totales del estudiante y tabla con fecha, materia, estado y observación de cada falta.'
  },
  {
    id: 'curso-tutor', corto: 'Mi curso como tutor', n: '03', quien: 'Docentes tutores',
    titulo: 'El curso completo en una sola pantalla',
    texto: 'El tutor ve la asistencia de todo su curso, no solo la de sus clases: el promedio, las faltas y los estudiantes que necesitan atención.',
    puntos: [
      'Indicadores del período: promedio, faltas injustificadas, justificadas, atrasos y estudiantes con 3 o más faltas seguidas.',
      'Situación de cada estudiante: excelente, buena, en riesgo o crítica.',
      'Ranking de estudiantes con más faltas injustificadas.',
      'Filtros de últimos 7 días, mes, mes anterior o año lectivo, con exportación a Excel.'
    ],
    img: '/capturas/asistencia-curso-tutor.webp', w: 1154, h: 610, barra: 'Mi curso como tutor · Asistencia del curso',
    alt: 'Pantalla Mi curso como tutor: indicadores de asistencia promedio y faltas, gráfico de situación de asistencia del curso, ranking de faltas injustificadas y lista de estudiantes con su situación.'
  },
  {
    id: 'ficha', corto: 'Ficha del estudiante', n: '04', quien: 'Tutores e inspección',
    titulo: 'La ficha del estudiante, lista para actuar',
    texto: 'Desde el inicio de clases: días lectivos frente a días asistidos y el porcentaje de faltas. Las faltas y su justificación se rigen por el reglamento del Ministerio de Educación.',
    puntos: [
      'Faltas por día de la semana y por mes, para detectar patrones.',
      'Justifica las faltas seleccionadas o todas a la vez, con el detalle por materia.',
      'Aviso por WhatsApp al representante, con el mensaje ya redactado.',
      'Historial de oficios y mensajes enviados.'
    ],
    img: '/capturas/asistencia-ficha-estudiante.webp', w: 819, h: 497, barra: 'Asistencia · Ficha del estudiante',
    alt: 'Ficha de un estudiante: porcentaje de asistencia, días de falta, justificados, atrasos, faltas seguidas, clasificación, gráficos de faltas por día de la semana y por mes, y la lista de días con falta.'
  }
];

const CFG = {
  titulo: 'Asistencia y reportes · SIGEE',
  nota: 'Asistencia y reportes',
  h1: 'Pasa lista en un minuto. Entiende la asistencia de todo el curso.',
  lede: 'SIGEE registra la asistencia por materia, la compara con los días lectivos del calendario y deja listos los reportes para docentes, tutores, inspectores y representantes.',
  pantallas: PANTALLAS,
  familia: { titulo: 'Estudiantes y representantes', texto: 'Cada estudiante y su familia ven su propio historial de asistencia y faltas desde el inicio de clases, sin acceso a datos de otras personas.' },
  cierre: { titulo: 'Pruébalo con una institución de ejemplo', texto: 'Recibe un acceso de 5 días con cursos, docentes y estudiantes ficticios para recorrer todo el módulo.' }
};

export default function AsistenciaReportes() { return <PaginaPublica cfg={CFG} />; }
