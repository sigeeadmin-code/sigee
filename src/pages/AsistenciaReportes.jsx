import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../lib/SessionContext.jsx';
import '../asistencia-reportes.css';

// Página pública: muestra el módulo de asistencia y reportes con capturas reales de una
// institución de ejemplo (datos ficticios). No necesita sesión.
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

export default function AsistenciaReportes() {
  const { profile } = useSession();
  useEffect(() => {
    const previo = document.title;
    document.title = 'Asistencia y reportes · SIGEE';
    window.scrollTo(0, 0);
    return () => { document.title = previo; };
  }, []);

  return (
    <div className="ar">
      <a className="ar-salto" href="#contenido">Saltar al contenido</a>
      <header className="ar-barra">
        <Link to="/" className="ar-marca" aria-label="SIGEE, ir al inicio">
          <span className="ar-logo" aria-hidden="true">S</span><span>SIGEE</span>
        </Link>
        <nav className="ar-acciones" aria-label="Acciones">
          <Link to="/" className="ar-enlace">{profile ? 'Ir al sistema' : 'Iniciar sesión'}</Link>
          {!profile && <Link to="/?demo=1" className="ar-btn">Solicitar demo</Link>}
        </nav>
      </header>

      <main id="contenido">
        <section className="ar-hero">
          <div className="ar-hero-int">
            <p className="ar-nota">Asistencia y reportes</p>
            <h1>Pasa lista en un minuto. Entiende la asistencia de todo el curso.</h1>
            <p className="ar-lede">SIGEE registra la asistencia por materia, la compara con los días lectivos del calendario y deja listos los reportes para docentes, tutores, inspectores y representantes.</p>
            <nav className="ar-indice" aria-label="Pantallas del módulo">
              {PANTALLAS.map(p => <a key={p.id} href={`#${p.id}`}><span>{p.n}</span>{p.corto}</a>)}
            </nav>
          </div>
        </section>

        {PANTALLAS.map((p, i) => (
          <section key={p.id} id={p.id} className={'ar-bloque' + (i % 2 ? ' ar-alt' : '')} aria-labelledby={`${p.id}-t`}>
            <div className="ar-bloque-int">
              <div className="ar-texto">
                <p className="ar-num"><span>{p.n}</span> · {p.quien}</p>
                <h2 id={`${p.id}-t`}>{p.titulo}</h2>
                <p>{p.texto}</p>
                <ul>{p.puntos.map(t => <li key={t}>{t}</li>)}</ul>
              </div>
              <figure className="ar-fig">
                <div className="ar-marco">
                  <div className="ar-marco-barra">{p.barra}</div>
                  <a href={p.img} target="_blank" rel="noreferrer" aria-label={`Abrir la captura «${p.barra}» en tamaño completo`}>
                    <img src={p.img} width={p.w} height={p.h} alt={p.alt} loading={i === 0 ? 'eager' : 'lazy'} decoding="async" />
                  </a>
                </div>
                <figcaption>Captura de una institución de ejemplo con datos ficticios.</figcaption>
              </figure>
            </div>
          </section>
        ))}

        <section className="ar-familia" aria-labelledby="fam-t">
          <div className="ar-bloque-int ar-familia-int">
            <h2 id="fam-t">Estudiantes y representantes</h2>
            <p>Cada estudiante y su familia ven su propio historial de asistencia y faltas desde el inicio de clases, sin acceso a datos de otras personas.</p>
          </div>
        </section>

        <section className="ar-cierre" aria-labelledby="cierre-t">
          <div className="ar-cierre-int">
            <h2 id="cierre-t">Pruébalo con una institución de ejemplo</h2>
            <p>Recibe un acceso de 5 días con cursos, docentes y estudiantes ficticios para recorrer todo el módulo.</p>
            <div className="ar-cierre-btns">
              <Link to="/?demo=1" className="ar-btn ar-btn-ambar">Solicitar demo de 5 días</Link>
              <Link to="/" className="ar-enlace ar-enlace-claro">{profile ? 'Ir al sistema' : 'Volver a iniciar sesión'}</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="ar-pie">SIGEE · Sistema de gestión educativa</footer>
    </div>
  );
}
