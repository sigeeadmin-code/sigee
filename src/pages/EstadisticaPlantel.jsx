import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { fetchMatrizEstadisticaPlantel } from '../lib/dataEstadisticaPlantel.js';
import {
  matrizPorParalelo, resumenPorJornada, resumenPorNivel, nivelDeCurso,
  totalesMatriz, RANGOS_EDAD,
} from '../lib/estadisticaPlantel.js';
import { descargarLibro } from '../lib/exportLibro.js';

export default function EstadisticaPlantel() {
  const { institucion } = useSession();
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [fJornada, setFJornada] = useState('');
  const [fNivel, setFNivel] = useState('');

  useEffect(() => {
    if (!institucion?.id) { setCargando(false); return; }
    let vivo = true;
    (async () => {
      setCargando(true); setError('');
      try {
        const data = await fetchMatrizEstadisticaPlantel(institucion.id);
        if (vivo) setFilas(data);
      } catch (e) {
        if (vivo) setError(e.message || 'No se pudo cargar la estadística.');
      }
      if (vivo) setCargando(false);
    })();
    return () => { vivo = false; };
  }, [institucion?.id]);

  const matriz = useMemo(() => matrizPorParalelo(filas), [filas]);
  const matrizFiltrada = useMemo(() => matriz.filter(r => {
    if (fJornada && r.jornada !== fJornada) return false;
    if (fNivel && nivelDeCurso(r.curso) !== fNivel) return false;
    return true;
  }), [matriz, fJornada, fNivel]);

  const porJornada = useMemo(() => resumenPorJornada(matriz), [matriz]);
  const porNivel = useMemo(() => resumenPorNivel(matriz, nivelDeCurso), [matriz]);
  const tot = useMemo(() => totalesMatriz(matrizFiltrada), [matrizFiltrada]);
  const jornadas = useMemo(() => [...new Set(matriz.map(r => r.jornada))].sort(), [matriz]);
  const niveles = useMemo(() => [...new Set(matriz.map(r => nivelDeCurso(r.curso)))].sort(), [matriz]);

  function exportar() {
    descargarLibro(`estadistica-plantel-${(institucion?.nombre || 'plantel').replace(/\s+/g, '-').toLowerCase()}.xlsx`, [
      {
        nombre: 'Por paralelo',
        filas: matrizFiltrada.map(r => ({
          Curso: r.curso,
          Paralelo: r.paralelo,
          Jornada: r.jornada,
          Total: r.total,
          Hombres: r.H,
          Mujeres: r.M,
          'Sin género': r.S,
          'Con discapacidad': r.conDiscapacidad,
          ...Object.fromEntries(RANGOS_EDAD.map(x => [`Edad ${x.label}`, r.edades[x.label] || 0])),
          'Edad sin dato': r.edades['Sin dato'] || 0,
        })),
      },
      {
        nombre: 'Por jornada',
        filas: porJornada.map(r => ({ Jornada: r.jornada, Total: r.total, Hombres: r.H, Mujeres: r.M, 'Con discapacidad': r.conDiscapacidad })),
      },
      {
        nombre: 'Por nivel',
        filas: porNivel.map(r => ({ Nivel: r.nivel, Total: r.total, Hombres: r.H, Mujeres: r.M, 'Con discapacidad': r.conDiscapacidad })),
      },
    ]);
  }

  if (!institucion?.id) {
    return <div className="card cb">Selecciona un plantel para ver su estadística. El consolidado de Zona 7 está en Estadísticas AMIE.</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0 }}>Estadística del plantel</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--slate)', fontSize: 13 }}>
            {institucion.nombre} · Matrícula activa · Por curso, paralelo y jornada
          </p>
        </div>
        <button className="btn btn-secondary" onClick={exportar} disabled={!matriz.length}>⬇️ Excel</button>
      </div>

      {cargando && <div className="card cb">Calculando matriz…</div>}
      {error && <div className="lerr" style={{ display: 'flex' }}>{error}</div>}

      {!cargando && !error && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <Kpi valor={tot.total} etiqueta="Estudiantes" color="#2563eb" />
            <Kpi valor={tot.H} etiqueta="Hombres" color="#0d9488" />
            <Kpi valor={tot.M} etiqueta="Mujeres" color="#be185d" />
            <Kpi valor={tot.S} etiqueta="Sin género" color="#94a3b8" />
            <Kpi valor={tot.conDiscapacidad} etiqueta="Con discapacidad" color="#d97706" />
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <div className="cb" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="fl" style={{ margin: 0 }}>Jornada</span>
              <select className="fc" value={fJornada} onChange={e => setFJornada(e.target.value)}>
                <option value="">Todas</option>
                {jornadas.map(j => <option key={j} value={j}>{j}</option>)}
              </select>
              <span className="fl" style={{ margin: 0 }}>Nivel</span>
              <select className="fc" value={fNivel} onChange={e => setFNivel(e.target.value)}>
                <option value="">Todos</option>
                {niveles.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 12 }}>
            <div className="card">
              <div className="ch"><h3>Por jornada</h3></div>
              <div className="cb" style={{ padding: 0 }}>
                <table className="data">
                  <thead><tr><th>Jornada</th><th>Total</th><th>H</th><th>M</th><th>Disc.</th></tr></thead>
                  <tbody>
                    {porJornada.map(r => (
                      <tr key={r.jornada}><td>{r.jornada}</td><td><strong>{r.total}</strong></td><td>{r.H}</td><td>{r.M}</td><td>{r.conDiscapacidad}</td></tr>
                    ))}
                    {!porJornada.length && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--slate)' }}>Sin datos</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card">
              <div className="ch"><h3>Por nivel</h3></div>
              <div className="cb" style={{ padding: 0 }}>
                <table className="data">
                  <thead><tr><th>Nivel</th><th>Total</th><th>H</th><th>M</th><th>Disc.</th></tr></thead>
                  <tbody>
                    {porNivel.map(r => (
                      <tr key={r.nivel}><td>{r.nivel}</td><td><strong>{r.total}</strong></td><td>{r.H}</td><td>{r.M}</td><td>{r.conDiscapacidad}</td></tr>
                    ))}
                    {!porNivel.length && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--slate)' }}>Sin datos</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="ch"><h3>Matriz por curso y paralelo</h3></div>
            <div className="cb" style={{ padding: 0, overflowX: 'auto' }}>
              <table className="data">
                <thead>
                  <tr>
                    <th>Curso</th><th>Paralelo</th><th>Jornada</th>
                    <th>Total</th><th>H</th><th>M</th><th>S/G</th>
                    <th>Disc.</th>
                    {RANGOS_EDAD.map(x => <th key={x.id}>{x.label}</th>)}
                    <th>Nacionalidades</th>
                  </tr>
                </thead>
                <tbody>
                  {matrizFiltrada.map(r => (
                    <tr key={`${r.curso}-${r.paralelo}-${r.jornada}`}>
                      <td><strong>{r.curso}</strong></td>
                      <td>{r.paralelo}</td>
                      <td>{r.jornada}</td>
                      <td><strong>{r.total}</strong></td>
                      <td>{r.H}</td>
                      <td>{r.M}</td>
                      <td>{r.S}</td>
                      <td>{r.conDiscapacidad}</td>
                      {RANGOS_EDAD.map(x => <td key={x.id}>{r.edades[x.label] || 0}</td>)}
                      <td style={{ fontSize: 11.5, maxWidth: 180 }}>
                        {Object.entries(r.nacionalidades).map(([k, n]) => `${k}: ${n}`).join(' · ') || '—'}
                      </td>
                    </tr>
                  ))}
                  {!matrizFiltrada.length && (
                    <tr><td colSpan={9 + RANGOS_EDAD.length} style={{ textAlign: 'center', padding: 18, color: 'var(--slate)' }}>
                      No hay matrículas activas con estos filtros. Completa estudiantes y paralelos en Académico.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '8px 16px 12px', fontSize: 12, color: 'var(--slate)' }}>
              H = hombres · M = mujeres · S/G = sin género · Disc. = con discapacidad distinta de «Ninguna».
              La jornada sale del paralelo (Académico). Nacionalidad requiere el campo en la ficha del estudiante (SQL de migración).
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ valor, etiqueta, color }) {
  return (
    <div className="card" style={{ margin: 0, padding: '12px 16px', minWidth: 120, flex: '1 1 120px', borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{valor}</div>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate)' }}>{etiqueta}</div>
    </div>
  );
}
