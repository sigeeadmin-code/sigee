import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAvisosJustificacion, marcarAvisoJustificacionLeido } from '../lib/data.js';

const fmt = d => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');
const quien = f => (f === 'tutor' ? 'el docente tutor' : f === 'inspector' ? 'el inspector general' : 'la autoridad');

/** Recordatorio para el docente: faltas que él registró y que ya fueron justificadas, con su asignatura y hora. */
export default function AvisosJustificacion() {
  const [avisos, setAvisos] = useState([]);
  const cargar = useCallback(async () => {
    try { setAvisos((await fetchAvisosJustificacion()).filter(a => !a.leido_at)); } catch { setAvisos([]); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  if (!avisos.length) return null;
  async function leido(a) { try { await marcarAvisoJustificacionLeido(a.id); } catch { /* se reintenta al recargar */ } setAvisos(l => l.filter(x => x.id !== a.id)); }
  async function todosLeidos() { const l = avisos; setAvisos([]); await Promise.all(l.map(a => marcarAvisoJustificacionLeido(a.id).catch(() => null))); }
  return (
    <div className="card" role="region" aria-label="Faltas justificadas" style={{ margin: '0 0 16px', padding: 16, borderLeft: '5px solid #16a34a' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>🔔 Faltas justificadas</div>
          <div style={{ fontSize: 13, color: 'var(--slate)' }}>
            {avisos.length === 1 ? 'Una falta que registraste ya fue justificada: ' : `${avisos.length} faltas que registraste ya fueron justificadas: `}
            <strong style={{ color: '#15803d' }}>ya no cuentan como injustificadas</strong>.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={todosLeidos}>Entendido</button>
          <Link to="/asistencia" className="btn btn-primary btn-sm">Ver asistencia</Link>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
        {avisos.slice(0, 6).map(a => (
          <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', fontSize: 13, padding: '6px 10px', borderRadius: 8, background: 'var(--page, #f1f5f9)' }}>
            <span style={{ minWidth: 0 }}>
              <strong>{a.estudiantes ? `${a.estudiantes.apellidos || ''} ${a.estudiantes.nombres || ''}`.trim() : 'Estudiante'}</strong>{' '}
              <span style={{ color: 'var(--slate)' }}>· {fmt(a.fecha)} · {a.materia || 'Asignatura'}{a.franja ? ` (${a.franja})` : ''} · justificada por {quien(a.fase)}{a.motivo ? ` — ${a.motivo}` : ''}</span>
            </span>
            <span className="badge b-ok" style={{ whiteSpace: 'nowrap' }}>Justificada</span>
          </div>
        ))}
        {avisos.length > 6 && <div style={{ fontSize: 12.5, color: 'var(--slate)' }}>y {avisos.length - 6} más…</div>}
      </div>
    </div>
  );
}
