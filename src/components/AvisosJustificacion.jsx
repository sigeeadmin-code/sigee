import React, { useCallback, useEffect, useState } from 'react';
import { fetchAvisosJustificacion, marcarAvisoJustificacionLeido } from '../lib/data.js';

const fmt = d => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');

/** Recordatorio para el docente: faltas que él registró y que el tutor (o el inspector) ya justificó, con su asignatura y hora. */
export default function AvisosJustificacion() {
  const [avisos, setAvisos] = useState([]);
  const cargar = useCallback(async () => {
    try { setAvisos((await fetchAvisosJustificacion()).filter(a => !a.leido_at)); } catch { setAvisos([]); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  if (!avisos.length) return null;
  async function leido(a) { try { await marcarAvisoJustificacionLeido(a.id); } catch { /* se reintenta al recargar */ } setAvisos(l => l.filter(x => x.id !== a.id)); }
  return (
    <div className="card" style={{ marginBottom: 14, borderLeft: '4px solid #1d4ed8' }}>
      <div className="cb">
        <div style={{ fontWeight: 800, marginBottom: 6 }}>📝 Faltas justificadas en tus clases ({avisos.length})</div>
        <div style={{ fontSize: 12, color: 'var(--slate)', marginBottom: 8 }}>Son recordatorios: la falta que registraste ya figura como justificada.</div>
        <div style={{ display: 'grid', gap: 6 }}>
          {avisos.map(a => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', fontSize: 13, flexWrap: 'wrap' }}>
              <span>
                <strong>{a.estudiantes ? `${a.estudiantes.apellidos || ''} ${a.estudiantes.nombres || ''}`.trim() : 'Estudiante'}</strong>
                {' · '}{fmt(a.fecha)}{' · '}{a.materia || 'Asignatura'}{a.franja ? ` (${a.franja})` : ''}
                {a.motivo ? <span style={{ color: 'var(--slate)' }}> — {a.motivo}</span> : null}
                <span style={{ color: 'var(--slate)' }}> · justificada por {a.fase === 'tutor' ? 'el docente tutor' : a.fase === 'inspector' ? 'el inspector general' : 'la autoridad'}</span>
              </span>
              <button className="btn btn-secondary btn-sm" onClick={() => leido(a)}>Entendido</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
