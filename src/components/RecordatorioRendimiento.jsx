import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAnalisisCalificaciones } from '../lib/data.js';
import { alertasDeVentana, textoRecordatorio, fmtNota } from '../lib/rendimiento.js';
import { ChipNota } from './GraficosRendimiento.jsx';

/** Recordatorio para el docente: sus estudiantes con promedio bajo 7 esta semana / este mes (y asignaturas sin notas). */
export default function RecordatorioRendimiento({ institucionId }) {
  const [d, setD] = useState(null); const [error, setError] = useState(false);
  useEffect(() => {
    let activo = true;
    if (institucionId) fetchAnalisisCalificaciones(institucionId, null).then(x => { if (activo) setD(x); }).catch(() => { if (activo) setError(true); });
    return () => { activo = false; };
  }, [institucionId]);
  if (error || !d) return null;

  const r = d.resumen || {};
  const semana = alertasDeVentana(d.alertas, 'semana', d.semana_actual);
  const mes = alertasDeVentana(d.alertas, 'mes', d.mes_actual);
  const lista = (semana.length ? semana : mes.length ? mes : alertasDeVentana(d.alertas, 'acumulado')).slice(0, 5);
  const sinNotas = (d.cargas || []).filter(c => !Number(c.evaluados));
  const hayAlerta = r.est_alerta > 0 || r.est_alerta_semana > 0 || r.est_alerta_mes > 0;
  if (!hayAlerta && !sinNotas.length) return null;
  const color = r.est_alerta_semana > 0 ? '#dc2626' : hayAlerta ? '#d97706' : '#0891b2';

  return (
    <div className="card" role="region" aria-label="Recordatorio de rendimiento" style={{ margin: '0 0 16px', padding: 16, borderLeft: `5px solid ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>🔔 Recordatorio de rendimiento</div>
          <div style={{ fontSize: 13, color: 'var(--slate)' }}>{hayAlerta ? <>Estudiantes de tus cursos con promedio bajo 7: <strong style={{ color }}>{textoRecordatorio(r)}</strong>.</> : 'Ningún estudiante en alerta por ahora.'}</div>
        </div>
        <Link to="/analisis-calificaciones" className="btn btn-primary btn-sm">Ver alertas y gráficos</Link>
      </div>
      {lista.length > 0 && (
        <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
          {lista.map(a => (
            <div key={a.estudiante_id + a.carga_id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', fontSize: 13, padding: '6px 10px', borderRadius: 8, background: 'var(--page, #f1f5f9)' }}>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><strong>{a.apellidos} {a.nombres}</strong> <span style={{ color: 'var(--slate)' }}>· {a.curso} {a.paralelo} · {a.materia}</span></span>
              <ChipNota valor={a.prom_sem ?? a.prom_mes ?? a.parcial} />
            </div>
          ))}
        </div>
      )}
      {sinNotas.length > 0 && <div style={{ fontSize: 12.5, color: '#b45309', marginTop: 10 }}>📝 Aún no registras notas en: {sinNotas.slice(0, 4).map(c => `${c.materia} (${c.curso} ${c.paralelo})`).join(', ')}{sinNotas.length > 4 ? ` y ${sinNotas.length - 4} más` : ''}. Sin notas no se pueden detectar alertas.</div>}
    </div>
  );
}
