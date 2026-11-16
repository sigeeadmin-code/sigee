import React from 'react';
import PaginaPublica from '../components/PaginaPublica.jsx';

const PANTALLAS = [
  {
    id: 'gestion', corto: 'Gestión académica', n: '01', quien: 'Administración del plantel',
    titulo: 'Cursos, materias y docentes en un solo lugar',
    texto: 'El horario parte de una buena base: qué cursos y paralelos tiene el plantel, qué materias se dictan y quién las enseña.',
    puntos: [
      'Cursos, paralelos y materias se administran en la misma pantalla.',
      'Cada materia muestra su docente, sus horas por semana y su estado.',
      '«Cargar materias del nivel» trae el catálogo del nivel para no escribirlas a mano.',
      'El total de horas por semana del paralelo se calcula solo.'
    ],
    img: '/capturas/horarios-gestion.webp', w: 1177, h: 496, barra: 'Gestión académica · Cursos, paralelos y materias',
    alt: 'Pantalla de gestión académica: lista de cursos, paralelos del curso elegido y tabla de materias con su docente, horas por semana y estado, con el total de horas semanales.'
  },
  {
    id: 'carga-docente', corto: 'Carga docente', n: '02', quien: 'Administración del plantel',
    titulo: 'Revisa la carga de cada docente antes de armar el horario',
    texto: 'Detecta quién tiene poca carga, quién se pasa del máximo y a quién le falta la jornada en su ficha.',
    puntos: [
      'Indicadores: docentes activos, con carga, sin carga, sin jornada en su ficha, carga baja, que exceden el máximo y mayor carga.',
      'La institución define la carga máxima, la mínima y las semanas por mes.',
      'Gráfico de los docentes con mayor carga horaria.',
      'Detalle por docente: materias, paralelos y horas por semana, por día y por mes, con exportación a Excel.'
    ],
    img: '/capturas/horarios-carga.webp', w: 1167, h: 622, barra: 'Gestión académica · Carga docente',
    alt: 'Pantalla de carga docente: indicadores de docentes activos, con carga y sin carga, parámetros de carga horaria, gráfico de docentes con mayor carga y tabla con el detalle de cada docente.'
  },
  {
    id: 'horario-semanal', corto: 'Horario semanal', n: '03', quien: 'Administración del plantel',
    titulo: 'Arma el horario a mano o deja que SIGEE lo genere',
    texto: 'Elige el curso y el paralelo, y completa la semana. Cada clase muestra su materia y su docente.',
    puntos: [
      'Elige una materia a la izquierda y haz clic en una celda vacía, o arrastra una clase para moverla.',
      '«Generar automáticamente» arma el horario con las materias y los docentes asignados.',
      '«Jornada y recreos» define los bloques de la jornada; los recreos quedan marcados en la cuadrícula.',
      'Cada materia tiene su color y se puede indicar el aula de cada paralelo.'
    ],
    img: '/capturas/horarios-semanal.webp', w: 1175, h: 598, barra: 'Horario semanal · Edición',
    alt: 'Editor de horario semanal: selección de curso, paralelo y aula, lista de materias con su docente para asignar y cuadrícula de lunes a viernes con las clases de cada hora y los recreos.'
  },
  {
    id: 'consulta', corto: 'Consulta de horarios', n: '04', quien: 'Rectorado, vicerrectorado e inspección',
    titulo: 'Consulta e imprime los horarios de todo el plantel',
    texto: 'Las autoridades ven los horarios sin riesgo de modificarlos: es una pantalla de solo consulta.',
    puntos: [
      'Tres vistas: por docente, por curso y general por día.',
      'Filtros por tipo de bachillerato (ciencias o técnico) y por día de la semana.',
      'Los paralelos sin clase en una hora se ven de un vistazo.',
      'Impresión en A4 horizontal con el membrete de la institución.'
    ],
    img: '/capturas/horarios-consulta.webp', w: 1177, h: 392, barra: 'Consulta de horarios · General por día',
    alt: 'Consulta de horarios en vista general por día: filas por curso, columnas por hora, cada clase con su materia y su docente, y filtros por bachillerato y por día.'
  }
];

const CFG = {
  titulo: 'Generación de horarios · SIGEE',
  nota: 'Generación de horarios',
  h1: 'De la carga docente al horario, en un solo sistema.',
  lede: 'Define cursos, materias y docentes, revisa la carga de cada docente y arma el horario a mano o de forma automática. Rectores, vicerrectores e inspectores lo consultan e imprimen.',
  pantallas: PANTALLAS,
  familia: { titulo: 'Docentes y estudiantes', texto: 'Cada docente ve su propio horario y cada estudiante el de su curso, en modo solo lectura.' },
  cierre: { titulo: 'Pruébalo con una institución de ejemplo', texto: 'Recibe un acceso de 5 días con cursos, docentes y horarios ficticios para recorrer todo el módulo.' }
};

export default function GeneracionHorarios() { return <PaginaPublica cfg={CFG} />; }
