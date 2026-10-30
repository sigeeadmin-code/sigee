import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../lib/SessionContext.jsx';
import { fetchHijosDeRepresentante, fetchEstudianteIdPorProfile } from '../lib/data.js';
import HistorialAsistencia from '../components/HistorialAsistencia.jsx';
import MiSeguimiento from '../components/MiSeguimiento.jsx';

// Módulo "Asistencia y faltas" de las cuentas de ESTUDIANTE y REPRESENTANTE (solo lectura).
// El estudiante ve lo suyo; el representante ve el de cada uno de sus hijos (la RLS de Supabase lo garantiza).
export default function MiAsistencia() {
  const { profile, institucion } = useSession();
  const esPadre = profile.rolDb === 'padre';
  const [hijos, setHijos] = useState([]);
  const [estudianteId, setEstudianteId] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    (async () => {
      setCargando(true);
      try {
        if (esPadre) {
          const h = await fetchHijosDeRepresentante(profile.id);
          if (!activo) return;
          setHijos(h); setEstudianteId(h[0]?.id || null);
        } else {
          const id = await fetchEstudianteIdPorProfile(profile.id);
          if (!activo) return;
          setEstudianteId(id);
        }
      } catch { if (activo) setEstudianteId(null); }
      if (activo) setCargando(false);
    })();
    return () => { activo = false; };
  }, [esPadre, profile.id]);

  const hijo = hijos.find(h => h.id === estudianteId);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Asistencia y faltas</h2>
          <p className="muted" style={{ margin: '2px 0 0' }}>
            {esPadre ? (hijo ? `Historial de ${hijo.nombre}` : 'Historial de asistencia de tu representado') : 'Tu historial de asistencia, atrasos y faltas'}
          </p>
        </div>
        <Link to="/justificaciones" className="btn btn-secondary btn-sm">📄 Justificar una falta</Link>
      </div>

      {esPadre && hijos.length > 1 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="cb" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label className="fl" style={{ margin: 0 }}>Hijo/a:</label>
            <select className="fc" value={estudianteId || ''} onChange={e => setEstudianteId(e.target.value)} style={{ maxWidth: 280 }}>
              {hijos.map(h => <option key={h.id} value={h.id}>{h.nombre}</option>)}
            </select>
          </div>
        </div>
      )}

      {cargando && <p style={{ fontSize: 13, color: 'var(--slate)' }}>Cargando…</p>}
      {!cargando && !estudianteId && (
        <div className="empty"><span className="ti ti-users" /><p>{esPadre ? 'No hay ningún estudiante vinculado a tu cuenta todavía. Contacta a la secretaría del plantel.' : 'No se encontró tu ficha de estudiante. Contacta a la secretaría del plantel.'}</p></div>
      )}
      {!cargando && estudianteId && (
        <>
          <HistorialAsistencia key={estudianteId} estudianteId={estudianteId} institucionId={institucion?.id} titulo="Asistencia y faltas desde el inicio de clases" />
          <MiSeguimiento key={'seg' + estudianteId} estudianteId={estudianteId} nombreEstudiante={hijo?.nombre || ''} titulo="Hoja de ruta de las faltas y documentos" limite={10} />
        </>
      )}
    </div>
  );
}
