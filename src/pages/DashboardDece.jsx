import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../lib/SessionContext.jsx';
import { supabase } from '../lib/supabase.js';
import { fetchOficiosBandeja } from '../lib/oficiosDocumental.js';
import { fmtEspera } from '../lib/oficiosVista.js';

const Tarjeta = ({ etiqueta, valor, nota, color, to }) => {
  const cuerpo = (<><div className="m-lbl">{etiqueta}</div><div className="m-val" style={color ? { color } : undefined}>{valor}</div>{nota && <div className="m-sub">{nota}</div>}</>);
  return to ? <Link to={to} className="metric" style={{ textDecoration: 'none', color: 'inherit' }}>{cuerpo}</Link> : <div className="metric">{cuerpo}</div>;
};

/** Inicio del DECE: lo que espera su atención (oficios en su paso) y el resumen de su gestión. */
export default function DashboardDece() {
  const { profile, institucion } = useSession();
  const [oficios, setOficios] = useState(null);
  const [est, setEst] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [of, es] = await Promise.all([
          fetchOficiosBandeja('por_cargo'),
          supabase.rpc('dece_estadisticas').then(r => (r.error ? null : r.data))      // si el módulo de casos no está disponible, solo falta ese resumen
        ]);
        if (vivo) { setOficios(of); setEst(es); }
      } catch (e) { if (vivo) setError(e.message || 'No se pudo cargar el resumen.'); }
    })();
    return () => { vivo = false; };
  }, []);

  const espera = oficios?.length ? Math.max(...oficios.map(d => d.espera_seg || 0)) : null;
  return (
    <div>
      <h2 style={{ margin: '0 0 2px' }}>Hola, {profile?.nombres || 'DECE'} 👋</h2>
      <p style={{ color: 'var(--slate)', margin: '0 0 14px', fontSize: 13 }}>Departamento de Consejería Estudiantil · {institucion?.nombre || '—'}</p>
      {error && <div className="lerr" style={{ display: 'flex', marginBottom: 12 }}>{error}</div>}
      <div className="dash-kpis">
        <Tarjeta to="/oficios" etiqueta="Oficios en mi paso" valor={oficios ? oficios.length : '…'} color={oficios?.length ? 'var(--amberD)' : 'var(--green)'}
          nota={oficios?.length ? `El más antiguo espera ${fmtEspera(espera)}` : 'Nada pendiente de tu decisión'} />
        {est && <>
          <Tarjeta etiqueta="Casos activos" valor={est.casos_activos} nota={`${est.casos_total} en total`} />
          <Tarjeta etiqueta="Reportes nuevos" valor={est.reportes_nuevos} color={est.reportes_nuevos ? 'var(--amberD)' : undefined} nota="Sin atender" />
          <Tarjeta etiqueta="Seguimientos vencidos" valor={est.seguimientos_vencidos} color={est.seguimientos_vencidos ? 'var(--red)' : 'var(--green)'} nota="Revisión programada ya cumplida" />
        </>}
      </div>
      {est && est.derivaciones_sin_respuesta > 0 && <p style={{ fontSize: 13, margin: '0 0 12px' }}>⚠️ {est.derivaciones_sin_respuesta} derivaciones sin respuesta de la institución destino.</p>}
      <div className="card">
        <div className="ch"><h3>Accesos</h3></div>
        <div className="cb" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn btn-primary" style={{ textDecoration: "none" }} to="/oficios">Oficios en mi paso</Link>
          <Link className="btn btn-secondary" style={{ textDecoration: "none" }} to="/estudiantes">Estudiantes</Link>
          <Link className="btn btn-secondary" style={{ textDecoration: "none" }} to="/justificaciones">Justificaciones</Link>
        </div>
      </div>
    </div>
  );
}
