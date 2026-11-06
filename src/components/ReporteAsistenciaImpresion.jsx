import React from 'react';
import { createPortal } from 'react-dom';
import { ETIQUETA_CLASE, ETIQUETA_172, estado172, UMBRAL_ALERTA_172, UMBRAL_RIESGO_172 } from '../lib/asistenciaAnalisis.js';
import { fechaCorta } from '../lib/oficioFaltas.js';

const pct = v => (v === null || v === undefined ? '—' : `${String(v).replace('.', ',')}%`);

/**
 * Hoja imprimible / PDF del reporte de asistencia (mismo mecanismo que oficios y fichas: se monta en <body>).
 * Recibe lo que ya calculó la pantalla: filtros aplicados, totales, resumen por curso y estudiantes visibles.
 */
export default function ReporteAsistenciaImpresion({ institucion, desde, hasta, filtros, totales, art172, porCurso, estudiantes, umbrales }) {
  return createPortal(
    <div className="oficio-print">
      <div className="oficio-hoja ofd-rep">
        <header className="ofd-rep-h">
          <div><strong>{String(institucion?.nombre || 'Institución educativa').toUpperCase()}</strong>{institucion?.amie && <span>AMIE {institucion.amie}</span>}</div>
          <div className="ofd-rep-f">Generado el {fechaCorta(new Date().toISOString().slice(0, 10))}</div>
        </header>
        <h1 className="ofd-rep-t">Reporte de asistencia</h1>
        <p className="ofd-rep-s">Del {fechaCorta(desde)} al {fechaCorta(hasta)}{filtros.length ? ` · ${filtros.join(' · ')}` : ''}</p>

        <table className="of-tabla ofd-rep-k"><tbody><tr>
          <td><b>{totales.estudiantes}</b><span>Estudiantes</span></td>
          <td><b>{pct(totales.pctAsistencia)}</b><span>Asistencia general</span></td>
          <td><b>{art172.alerta}</b><span>Alerta preventiva (≥ {UMBRAL_ALERTA_172} %)</span></td>
          <td><b>{art172.riesgo}</b><span>Riesgo Art. 172 (≥ {UMBRAL_RIESGO_172} %)</span></td>
          <td><b>{totales.conRacha}</b><span>Con faltas seguidas</span></td>
        </tr></tbody></table>

        <h2 className="ofd-rep-h2">Por curso</h2>
        <table className="of-tabla ofd-rep-tb">
          <thead><tr><th>Curso</th><th>Estud.</th><th>% asist.</th><th>Faltas inj.</th><th>Justif.</th><th>En riesgo</th><th>Críticos</th></tr></thead>
          <tbody>{porCurso.map(c => <tr key={c.curso}><td>{c.curso}</td><td>{c.estudiantes}</td><td>{pct(c.pctAsistencia)}</td><td>{c.faltas}</td><td>{c.justificadas}</td><td>{c.enRiesgo}</td><td>{c.criticos}</td></tr>)}</tbody>
        </table>

        <h2 className="ofd-rep-h2">Estudiantes ({estudiantes.length})</h2>
        <table className="of-tabla ofd-rep-tb">
          <thead><tr><th>#</th><th>Estudiante</th><th>Curso</th><th>Días</th><th>Faltas inj.</th><th>Justif.</th><th>% asist.</th><th>% faltas inj.</th><th>Seguidas</th><th>Clasificación</th><th>Art. 172</th></tr></thead>
          <tbody>
            {estudiantes.map((f, i) => (
              <tr key={f.id}>
                <td>{i + 1}</td><td>{f.nombre}</td><td>{f.curso}</td><td>{f.dias}</td><td>{f.faltas}</td><td>{f.justificadas}</td>
                <td>{pct(f.pctAsistencia)}</td><td>{pct(f.pctFaltas)}</td><td>{f.rachaMax || '—'}</td><td>{ETIQUETA_CLASE[f.clase]}</td><td>{ETIQUETA_172[estado172(f.pctFaltas, f.dias)]}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="ofd-rep-n">
          Base normativa: Art. 171 y 172 de la LOEI. La clasificación usa el % de faltas injustificadas (excelente ≤ {umbrales.excelente} %, buena ≤ {umbrales.buena} %, en riesgo ≤ {umbrales.riesgo} %).
          Los porcentajes se calculan sobre los días con registro del período elegido; la reprobación por inasistencia del Art. 172 se evalúa sobre el total de días de clase del año lectivo.
        </p>
      </div>
    </div>,
    document.body
  );
}
