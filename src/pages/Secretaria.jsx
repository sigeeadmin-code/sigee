import React from 'react';
import { Link } from 'react-router-dom';

// Competencias de la Secretaría del plantel según el Reglamento General a la LOEI (codificación publicada por el
// Ministerio de Educación). Cada competencia indica qué parte ya cubre SIGEE y qué falta. Mantener "estado" honesto:
//   disponible = SIGEE lo cubre · parcial = hay una parte · pendiente = aún no existe.
const COMPETENCIAS = [
  { art: 'Art. 57, n.º 1', texto: 'Llevar los libros, registros y formularios oficiales y responsabilizarse de su conservación, integridad, inviolabilidad y reserva.',
    estado: 'parcial', cubre: [['/estudiantes', 'Estudiantes'], ['/reportes-matriculas', 'Reportes de matrícula'], ['/egresados', 'Egresados y actas de grado']],
    falta: 'Libro de matrículas oficial, numerado e imprimible, y expediente digital de cada estudiante.' },
  { art: 'Art. 57, n.º 2', texto: 'Organizar, centralizar y mantener actualizada la estadística y el archivo del establecimiento.',
    estado: 'parcial', cubre: [['/estadistica-plantel', 'Estadísticas AMIE'], ['/estudiantes', 'Estudiantes'], ['/docentes', 'Docentes'], ['/calendario', 'Calendario académico']],
    falta: 'Archivo documental digital (expedientes de estudiantes y docentes).' },
  { art: 'Art. 57, n.º 3', texto: 'Ingresar con exactitud los datos y registros académicos que requiera el sistema de información del Ministerio de Educación.',
    estado: 'parcial', cubre: [['/estadistica-plantel', 'Estadísticas AMIE'], ['/boletas', 'Boletas'], ['/analisis-asistencia', 'Análisis de asistencia']],
    falta: 'Exportación de los datos en el formato del sistema del Ministerio: hoy los reportes salen a Excel y la carga al sistema oficial sigue siendo manual.' },
  { art: 'Art. 57, n.º 4', texto: 'Conferir, previa autorización del Rector o Director, copias y certificaciones.',
    estado: 'pendiente', cubre: [['/boletas', 'Boletas (copia de calificaciones)']],
    falta: 'Certificados de matrícula, promoción y calificaciones con número de registro y autorización del Rector.' },
  { art: 'Art. 57, n.º 5', texto: 'Suscribir, junto con el Rector o Director, los documentos de matrícula y promoción y los formularios o registros de datos del sistema del Ministerio.',
    estado: 'parcial', cubre: [['/matriculas', 'Promoción y traslados'], ['/reportes-matriculas', 'Reportes de matrícula']],
    falta: 'Documento de matrícula y de promoción imprimible, con firmas del Rector y de Secretaría.' },
  { art: 'Art. 57, n.º 6', texto: 'Las demás obligaciones determinadas en la legislación vigente y las que determine la máxima autoridad del establecimiento.',
    estado: 'disponible', cubre: [['/oficios', 'Oficios / documental'], ['/notificaciones', 'Notificaciones'], ['/tareas', 'Tareas y avisos']], falta: '' }
];

const OTRAS = [
  { art: 'Art. 44, n.º 6 y 7', texto: 'Junto con el Rector: matrículas ordinarias y extraordinarias, pases de estudiantes, legalización de documentos y custodia del expediente académico.', estado: 'parcial', cubre: [['/matriculas', 'Promoción y traslados']], falta: 'Pases con constancia imprimible y expediente académico digital.' },
  { art: 'Art. 50', texto: 'Secretaría del Consejo Ejecutivo (con voz informativa, sin voto).', estado: 'pendiente', cubre: [], falta: 'Convocatorias y actas de sesión del Consejo Ejecutivo.' },
  { art: 'Art. 54', texto: 'Integrante de la Junta de Docentes de Grado o Curso.', estado: 'parcial', cubre: [['/asistencia', 'Reporte para junta de curso (Asistencia → Reportes e impresión)'], ['/boletas', 'Boletas']], falta: 'Registro de las actas de junta de curso.' },
  { art: 'Art. 85', texto: 'Secretaría del Gobierno Escolar de las instituciones públicas.', estado: 'pendiente', cubre: [], falta: 'Convocatorias y actas del Gobierno Escolar.' },
  { art: 'Art. 94', texto: 'Ingresar y actualizar en el sistema de información del Ministerio los datos que solicite la Autoridad Educativa Nacional.', estado: 'parcial', cubre: [['/estadistica-plantel', 'Estadísticas AMIE'], ['/mi-plantel', 'Mi Plantel']], falta: 'Verificación de datos completos antes de reportar.' },
  { art: 'Art. 103, n.º 8', texto: 'Mantener el reporte del registro de matrículas y promoción estudiantil, actualizado cada año.', estado: 'disponible', cubre: [['/reportes-matriculas', 'Reportes de matrícula']], falta: '' },
  { art: 'Art. 197', texto: 'Certificados de promoción, acta de grado y título de bachiller (término de nivel).', estado: 'parcial', cubre: [['/egresados', 'Acta de grado (Egresados)']], falta: 'Certificado de promoción por estudiante y registro de actas con numeración.' }
];

const ESTADO = {
  disponible: { txt: 'Disponible', fondo: 'var(--greenXL)', color: 'var(--greenD)' },
  parcial: { txt: 'Parcial', fondo: 'var(--amberXL)', color: 'var(--amberD)' },
  pendiente: { txt: 'Pendiente', fondo: 'var(--bg-soft, #eef1f4)', color: 'var(--slate)' }
};

function Tarjeta({ c }) {
  const e = ESTADO[c.estado];
  return (
    <div className="card" style={{ marginBottom: 10 }}>
      <div className="cb" style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)' }}>{c.art}</div>
          <span className="badge" style={{ background: e.fondo, color: e.color }}>{e.txt}</span>
        </div>
        <div style={{ fontSize: 14 }}>{c.texto}</div>
        {c.cubre.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--slate)' }}>En SIGEE:</span>
            {c.cubre.map(([to, label]) => <Link key={to + label} to={to} className="btn btn-secondary btn-sm">{label}</Link>)}
          </div>
        )}
        {c.falta && <div style={{ fontSize: 12.5, color: 'var(--slate)' }}><strong>Falta:</strong> {c.falta}</div>}
      </div>
    </div>
  );
}

export default function Secretaria() {
  const todas = [...COMPETENCIAS, ...OTRAS];
  const cuenta = k => todas.filter(c => c.estado === k).length;
  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ margin: '0 0 4px' }}>Competencias de la Secretaría</h2>
        <div style={{ fontSize: 13, color: 'var(--slate)' }}>
          Funciones que el Reglamento General a la LOEI asigna a la Secretaría del plantel, y qué parte ya cubre SIGEE.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        {['disponible', 'parcial', 'pendiente'].map(k => (
          <div key={k} className="card"><div className="cb" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: ESTADO[k].color }}>{cuenta(k)}</div>
            <div style={{ fontSize: 12, color: 'var(--slate)' }}>{ESTADO[k].txt}{cuenta(k) === 1 ? '' : 's'}</div>
          </div></div>
        ))}
      </div>

      <h3 style={{ margin: '0 0 8px' }}>Art. 57 — Secretaría</h3>
      <div style={{ fontSize: 12.5, color: 'var(--slate)', marginBottom: 8 }}>
        Las responsabilidades de Secretaría las desempeña el docente asignado para el efecto o un profesional del ramo, con estos deberes y atribuciones:
      </div>
      {COMPETENCIAS.map(c => <Tarjeta key={c.art} c={c} />)}

      <h3 style={{ margin: '18px 0 8px' }}>Otras funciones de la Secretaría en el Reglamento</h3>
      {OTRAS.map(c => <Tarjeta key={c.art} c={c} />)}

      <div style={{ fontSize: 11.5, color: 'var(--slate)', marginTop: 12 }}>
        Fuente: Reglamento General a la Ley Orgánica de Educación Intercultural, codificación publicada por el Ministerio de Educación.
        Las reformas posteriores (por ejemplo las de 2023) pueden haber cambiado la numeración o la redacción: confirma el artículo en el texto vigente antes de citarlo en un documento oficial.
      </div>
    </div>
  );
}
