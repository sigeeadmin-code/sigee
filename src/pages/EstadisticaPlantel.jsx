import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { fetchMatrizEstadisticaPlantel } from '../lib/dataEstadisticaPlantel.js';
import {
  matrizPorParalelo, resumenPorJornada, resumenPorNivel, nivelDeCurso,
  totalesMatriz, RANGOS_EDAD,
} from '../lib/estadisticaPlantel.js';
import { descargarLibro } from '../lib/exportLibro.js';

const miles = v => Number(v || 0).toLocaleString('es-EC');

export default function EstadisticaPlantel() {
  const { institucion } = useSession();
  const [filas, setFilas] = useState([]);
  const [meta, setMeta] = useState(null);
  const [plantilla, setPlantilla] = useState({ docentes: 0, administrativos: 0 });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [fJornada, setFJornada] = useState('');
  const [fNivel, setFNivel] = useState('');

  useEffect(() => {
    if (!institucion?.id) { setCargando(false); setFilas([]); setMeta(null); return; }
    let vivo = true;
    (async () => {
      setCargando(true); setError('');
      try {
        const data = await fetchMatrizEstadisticaPlantel(institucion.id);
        if (!vivo) return;
        if (Array.isArray(data)) {
          setFilas(data);
          setMeta(null);
          setPlantilla({ docentes: 0, administrativos: 0 });
        } else {
          setFilas(data.filas || []);
          setMeta(data.meta || null);
          setPlantilla(data.plantilla || { docentes: 0, administrativos: 0 });
        }
      } catch (e) {
        if (vivo) setError(e.message || 'No se pudo cargar la estadística AMIE del plantel.');
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
  const totGlobal = useMemo(() => totalesMatriz(matriz), [matriz]);
  const jornadas = useMemo(() => [...new Set(matriz.map(r => r.jornada))].sort(), [matriz]);
  const niveles = useMemo(() => [...new Set(matriz.map(r => nivelDeCurso(r.curso)))].sort(), [matriz]);

  const refEst = meta?.num_estudiantes_ref != null ? Number(meta.num_estudiantes_ref) : null;
  const refDoc = meta?.num_docentes_ref != null ? Number(meta.num_docentes_ref) : null;
  const relED = plantilla.docentes > 0 ? (totGlobal.total / plantilla.docentes).toFixed(1) : '—';

  function exportar() {
    const slug = (meta?.nombre || institucion?.nombre || 'plantel').replace(/\s+/g, '-').toLowerCase();
    descargarLibro(`amie-plantel-${slug}.xlsx`, [
      {
        nombre: 'Resumen',
        filas: [{
          Plantel: meta?.nombre || institucion?.nombre,
          AMIE: meta?.amie || '',
          Periodo: meta?.periodo?.nombre || '',
          'Estudiantes SIGEE': totGlobal.total,
          'Estudiantes ref. AMIE': refEst ?? '',
          Hombres: totGlobal.H,
          Mujeres: totGlobal.M,
          'Con discapacidad': totGlobal.conDiscapacidad,
          Docentes: plantilla.docentes,
          'Docentes ref. AMIE': refDoc ?? '',
          Administrativos: plantilla.administrativos,
          'Estudiantes/Docente': relED,
        }],
      },
      {
        nombre: 'Por paralelo',
        filas: matrizFiltrada.map(r => ({
          Curso: r.curso, Paralelo: r.paralelo, Jornada: r.jornada,
          Total: r.total, Hombres: r.H, Mujeres: r.M, 'Sin género': r.S,
          'Con discapacidad': r.conDiscapacidad,
          ...Object.fromEntries(RANGOS_EDAD.map(x => [`Edad ${x.label}`, r.edades[x.label] || 0])),
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
    return (
      <div className="card" style={{ padding: 28, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🏫</div>
        <h3 style={{ margin: '0 0 6px' }}>Estadísticas AMIE del plantel</h3>
        <p style={{ color: 'var(--slate)', margin: 0, fontSize: 13 }}>
          Selecciona un plantel en la sesión para ver su consolidado.
          El panorama de toda la Zona 7 está en <strong>AMIE Zona 7</strong>.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>Estadísticas AMIE</h2>
            <span style={{
              fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
              padding: '3px 9px', borderRadius: 999, background: 'var(--brandL)', color: 'var(--brandD)', border: '1px solid var(--brandXL)',
            }}>Plantel</span>
          </div>
          <p style={{ margin: 0, color: 'var(--slate)', fontSize: 13 }}>
            {meta?.nombre || institucion.nombre}
            {meta?.amie ? ` · AMIE ${meta.amie}` : ''}
            {meta?.periodo?.nombre ? ` · ${meta.periodo.nombre}` : ''}
          </p>
          {(meta?.canton || meta?.sostenimiento) && (
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--slateL)' }}>
              {[meta.sostenimiento, meta.canton, meta.parroquia, meta.regimen].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <button className="btn btn-secondary" onClick={exportar} disabled={!matriz.length && !plantilla.docentes}>
          ⬇️ Excel AMIE
        </button>
      </div>

      {cargando && <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--slate)' }}>Calculando indicadores AMIE del plantel…</div>}
      {error && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, padding: '10px 14px', borderRadius: 'var(--r)', background: 'var(--redL)', color: 'var(--redD)', border: '1px solid #fca5a5', fontSize: 13 }}>
          <span className="ti ti-alert-circle" /> {error}
        </div>
      )}

      {!cargando && !error && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
            <Kpi valor={miles(totGlobal.total)} etiqueta="Estudiantes SIGEE" sub={refEst != null ? `Ref. AMIE: ${miles(refEst)}` : 'Matrícula activa'} color="#2563eb" />
            <Kpi valor={miles(totGlobal.H)} etiqueta="Hombres" color="#0d9488" />
            <Kpi valor={miles(totGlobal.M)} etiqueta="Mujeres" color="#be185d" />
            <Kpi valor={miles(plantilla.docentes)} etiqueta="Docentes" sub={refDoc != null ? `Ref. AMIE: ${miles(refDoc)}` : 'Activos'} color="#7c3aed" />
            <Kpi valor={miles(plantilla.administrativos)} etiqueta="Administrativos" color="#d97706" />
            <Kpi valor={relED} etiqueta="Est. / docente" sub="Relación" color="#0891b2" />
            <Kpi valor={miles(totGlobal.conDiscapacidad)} etiqueta="Con discapacidad" color="#ea580c" />
            <Kpi valor={matriz.length} etiqueta="Paralelos con matrícula" color="#475569" />
          </div>

          {(refEst != null || refDoc != null) && (
            <div style={{
              marginBottom: 14, padding: '10px 14px', borderRadius: 'var(--r2)', fontSize: 12.5,
              background: 'var(--blueL)', border: '1px solid #93c5fd', color: 'var(--blueD)',
            }}>
              Comparativo SIGEE vs referencia AMIE del plantel
              {refEst != null && <> · Estudiantes: <strong>{miles(totGlobal.total)}</strong> / ref. <strong>{miles(refEst)}</strong>{refEst ? ` (${Math.round((totGlobal.total / refEst) * 100)}%)` : ''}</>}
              {refDoc != null && <> · Docentes: <strong>{miles(plantilla.docentes)}</strong> / ref. <strong>{miles(refDoc)}</strong></>}
              . Las cifras referenciales se editan en <strong>Mi Plantel</strong>.
            </div>
          )}

          <div className="card" style={{ marginBottom: 12, padding: '12px 14px' }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate)', letterSpacing: '0.04em' }}>Filtros</span>
              <select className="fc" value={fJornada} onChange={e => setFJornada(e.target.value)}>
                <option value="">Todas las jornadas</option>
                {jornadas.map(j => <option key={j} value={j}>{j}</option>)}
              </select>
              <select className="fc" value={fNivel} onChange={e => setFNivel(e.target.value)}>
                <option value="">Todos los niveles</option>
                {niveles.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              {(fJornada || fNivel) && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setFJornada(''); setFNivel(''); }}>Limpiar</button>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12, marginBottom: 12 }}>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', fontWeight: 800, fontSize: 13 }}>Por jornada</div>
              <table className="data" style={{ width: '100%' }}>
                <thead><tr><th>Jornada</th><th>Total</th><th>H</th><th>M</th><th>Disc.</th></tr></thead>
                <tbody>
                  {porJornada.map(r => (
                    <tr key={r.jornada} style={{ cursor: 'pointer', background: fJornada === r.jornada ? 'var(--brandL)' : undefined }} onClick={() => setFJornada(fJornada === r.jornada ? '' : r.jornada)}>
                      <td><strong>{r.jornada}</strong></td>
                      <td>{r.total}</td><td>{r.H}</td><td>{r.M}</td><td>{r.conDiscapacidad}</td>
                    </tr>
                  ))}
                  {!porJornada.length && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--slate)', padding: 16 }}>Sin matrícula</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', fontWeight: 800, fontSize: 13 }}>Por nivel educativo</div>
              <table className="data" style={{ width: '100%' }}>
                <thead><tr><th>Nivel</th><th>Total</th><th>H</th><th>M</th><th>Disc.</th></tr></thead>
                <tbody>
                  {porNivel.map(r => (
                    <tr key={r.nivel} style={{ cursor: 'pointer', background: fNivel === r.nivel ? 'var(--brandL)' : undefined }} onClick={() => setFNivel(fNivel === r.nivel ? '' : r.nivel)}>
                      <td><strong>{r.nivel}</strong></td>
                      <td>{r.total}</td><td>{r.H}</td><td>{r.M}</td><td>{r.conDiscapacidad}</td>
                    </tr>
                  ))}
                  {!porNivel.length && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--slate)', padding: 16 }}>Sin matrícula</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ fontWeight: 800, fontSize: 13 }}>Matriz por curso y paralelo</div>
              <div style={{ fontSize: 12, color: 'var(--slate)' }}>
                {matrizFiltrada.length} grupo{matrizFiltrada.length === 1 ? '' : 's'}
                {(fJornada || fNivel) ? ` · filtrado · ${miles(tot.total)} estudiantes` : ` · ${miles(totGlobal.total)} estudiantes`}
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ paddingLeft: 16 }}>Curso</th>
                    <th>Paralelo</th>
                    <th>Jornada</th>
                    <th>Total</th>
                    <th>H</th>
                    <th>M</th>
                    <th>S/G</th>
                    <th>Disc.</th>
                    {RANGOS_EDAD.map(x => <th key={x.id}>{x.label}</th>)}
                    <th>Nacionalidades</th>
                  </tr>
                </thead>
                <tbody>
                  {matrizFiltrada.map(r => (
                    <tr key={`${r.curso}-${r.paralelo}-${r.jornada}`}>
                      <td style={{ paddingLeft: 16 }}><strong>{r.curso}</strong></td>
                      <td>{r.paralelo}</td>
                      <td>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'var(--page)', border: '1px solid var(--line)' }}>{r.jornada}</span>
                      </td>
                      <td><strong>{r.total}</strong></td>
                      <td>{r.H}</td>
                      <td>{r.M}</td>
                      <td>{r.S}</td>
                      <td>{r.conDiscapacidad}</td>
                      {RANGOS_EDAD.map(x => <td key={x.id}>{r.edades[x.label] || 0}</td>)}
                      <td style={{ fontSize: 11.5, maxWidth: 200 }}>
                        {Object.entries(r.nacionalidades).map(([k, n]) => `${k}: ${n}`).join(' · ') || '—'}
                      </td>
                    </tr>
                  ))}
                  {!matrizFiltrada.length && (
                    <tr>
                      <td colSpan={9 + RANGOS_EDAD.length} style={{ textAlign: 'center', padding: 28, color: 'var(--slate)' }}>
                        No hay matrículas activas con estos filtros.
                        Define jornadas en paralelos (Académico) y completa género/fecha de nacimiento en el perfil.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '10px 16px', fontSize: 12, color: 'var(--slate)', borderTop: '1px solid var(--line)', background: 'var(--page)' }}>
              H = hombres · M = mujeres · S/G = sin género · Disc. = discapacidad ≠ «Ninguna».
              Datos en tiempo real desde SIGEE. La suma de planteles alimenta el consolidado Zona 7.
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ valor, etiqueta, sub, color }) {
  return (
    <div className="card" style={{ margin: 0, padding: '14px 16px', borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 24, fontWeight: 800, color, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{valor}</div>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate)', marginTop: 6, letterSpacing: '0.04em' }}>{etiqueta}</div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--slateL)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
