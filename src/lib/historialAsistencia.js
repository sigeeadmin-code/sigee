// Historial y comparativo de asistencia de un estudiante desde el inicio de clases.
// Módulo PURO (sin Supabase ni navegador). Los porcentajes y el estado de cada falta siguen las reglas ya
// vigentes en el sistema (asistenciaAnalisis.js); los días lectivos son solo una referencia: "X días lectivos · Y faltas".
import { analizarFicha } from './fichaAsistencia.js';
import { resumenAnioLectivo, contarDiasLectivos } from './calendarioResumen.js';

/**
 * registros: [{ fecha, estado, materia, docente?, observacion? }] (una fila por clase) · eventos: calendario del plantel
 * hoy: 'AAAA-MM-DD'. Devuelve la ficha analizada más el comparativo de días lectivos desde el inicio de clases.
 */
export function historialDesdeInicio(registros, eventos, hoy, umbrales) {
  const lista = (registros || []).filter(r => r.fecha <= hoy);
  const ficha = analizarFicha(lista, umbrales);
  const anio = resumenAnioLectivo(eventos, hoy);
  const primero = lista.length ? lista.map(r => r.fecha).sort()[0] : null;
  const inicio = anio?.inicio && anio.inicio <= hoy ? anio.inicio : primero;
  const diasLectivos = inicio ? contarDiasLectivos(inicio, hoy, eventos) : 0;
  const r = ficha.resumen;
  const sinRegistro = Math.max(0, diasLectivos - r.dias);
  return {
    ...ficha,
    inicio, hoy,
    comparativo: {
      diasLectivos,                       // días lectivos desde el inicio de clases hasta hoy
      diasConRegistro: r.dias,            // días en que hay asistencia registrada del estudiante
      diasAsistidos: r.presentes + r.atrasos,
      faltas: r.faltas,                   // días de falta injustificada
      justificadas: r.justificadas,
      atrasos: r.atrasos,
      sinRegistro,                        // días lectivos sin asistencia registrada (no se cuentan como falta)
      texto: `${diasLectivos} ${diasLectivos === 1 ? 'día lectivo' : 'días lectivos'} · ${r.faltas} ${r.faltas === 1 ? 'falta' : 'faltas'}`
    }
  };
}
