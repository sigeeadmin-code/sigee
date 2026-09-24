import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { fetchEgresados } from '../lib/data.js';
import { exportarFilasExcel } from '../lib/cargaMasiva.js';

function ActaGrado({ institucion, promocion, especialidad, estudiantes, onClose }) {
  const fechaHoy = new Date().toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: 'numeric' });
  return (
    <div className="modal-bg open">
      <div className="modal wide print-area" style={{ maxWidth: 780, background: '#fff', padding: 32 }}>
        <div className="print-hide" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
          <button className="btn btn-primary" onClick={() => window.print()}>🖨️ Imprimir / Guardar PDF</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, borderBottom: '2px solid #1a1a1a', paddingBottom: 14, marginBottom: 18 }}>
          {institucion?.logo && <img src={institucion.logo} alt="Logo" style={{ width: 64, height: 64, objectFit: 'contain' }} />}
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{institucion?.nombre}</div>
            <div style={{ fontSize: 12, color: '#444' }}>
              AMIE: {institucion?.amie || '—'} · {institucion?.canton || ''}{institucion?.provincia ? ', ' + institucion.provincia : ''}
            </div>
          </div>
        </div>

        <h2 style={{ textAlign: 'center', margin: '0 0 4px', letterSpacing: 1 }}>ACTA DE GRADO</h2>
        <p style={{ textAlign: 'center', fontSize: 13, margin: '0 0 4px' }}>
          Promoción <strong>{promocion}</strong>{especialidad && especialidad !== 'General' ? <> — Especialidad <strong>{especialidad}</strong></> : ''}
        </p>
        <p style={{ textAlign: 'center', fontSize: 12, color: '#555', margin: '0 0 20px' }}>Emitida el {fechaHoy}</p>

        <p style={{ fontSize: 13, marginBottom: 14 }}>
          Se deja constancia de que los siguientes estudiantes han cumplido con los requisitos académicos
          establecidos y se gradúan en la promoción indicada:
        </p>

        <table className="tbl" style={{ width: '100%', marginBottom: 26 }}>
          <thead><tr><th style={{ width: 40 }}>N°</th><th>Apellidos y nombres</th><th>Cédula</th><th>Curso de origen</th></tr></thead>
          <tbody>
            {estudiantes.map((e, i) => (
              <tr key={e.matriculaId}>
                <td>{i + 1}</td><td>{e.nombre}</td><td className="mono">{e.cedula || '—'}</td>
                <td>{e.grado}{e.paralelo ? ' ' + e.paralelo : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginTop: 60, fontSize: 13, textAlign: 'center' }}>
          <div>
            <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: 6 }}>{institucion?.rector || 'Rector / Director'}</div>
            <div style={{ fontSize: 11, color: '#555' }}>Rector/a del plantel</div>
          </div>
          <div>
            <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: 6 }}>&nbsp;</div>
            <div style={{ fontSize: 11, color: '#555' }}>Secretario/a</div>
          </div>
        </div>
      </div>
    </div>
  );
}


export default function Egresados() {
  const { institucion } = useSession();
  const institucionId = institucion?.id;

  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buscar, setBuscar] = useState('');
  const [fPromocion, setFPromocion] = useState('');
  const [fEspecialidad, setFEspecialidad] = useState('');
  const [acta, setActa] = useState(null); // { promocion, especialidad, estudiantes }

  const cargar = useCallback(async () => {
    if (!institucionId) return;
    setLoading(true);
    setFilas(await fetchEgresados(institucionId));
    setLoading(false);
  }, [institucionId]);
  useEffect(() => { cargar(); }, [cargar]);

  const promociones = [...new Set(filas.map(f => f.promocion).filter(Boolean))].sort().reverse();
  const especialidades = [...new Set(filas.map(f => f.especialidad).filter(Boolean))].sort();

  const filtradas = filas.filter(f =>
    (!buscar || f.nombre.toLowerCase().includes(buscar.toLowerCase()) || f.cedula.includes(buscar)) &&
    (!fPromocion || f.promocion === fPromocion) &&
    (!fEspecialidad || f.especialidad === fEspecialidad)
  );

  // Agrupado: Promoción → Especialidad (o "General" si no aplica) → lista
  const grupos = useMemo(() => {
    const porPromocion = {};
    filtradas.forEach(f => {
      const promo = f.promocion || 'Sin período registrado';
      const esp = f.especialidad || 'General';
      porPromocion[promo] ||= {};
      porPromocion[promo][esp] ||= [];
      porPromocion[promo][esp].push(f);
    });
    return Object.entries(porPromocion).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtradas]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: '0 0 4px' }}>Egresados</h2>
          <div style={{ fontSize: 13, color: 'var(--slate)' }}>{institucion?.nombre} · {filtradas.length} graduado{filtradas.length === 1 ? '' : 's'}, agrupados por promoción y especialidad</div>
        </div>
        <button className="btn btn-secondary"
          onClick={() => exportarFilasExcel('egresados.xlsx', filtradas, ['nombre', 'cedula', 'promocion', 'grado', 'paralelo', 'especialidad', 'fechaEgreso'])}
          disabled={filtradas.length === 0}>
          ⬇️ Exportar Excel
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="cb">
          <div className="form-grid">
            <div><label className="fl">Buscar</label><input className="fc" placeholder="Nombre o cédula…" value={buscar} onChange={e => setBuscar(e.target.value)} /></div>
            <div>
              <label className="fl">Promoción</label>
              <select className="fc" value={fPromocion} onChange={e => setFPromocion(e.target.value)}>
                <option value="">Todas</option>
                {promociones.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            {especialidades.length > 0 && (
              <div>
                <label className="fl">Especialidad</label>
                <select className="fc" value={fEspecialidad} onChange={e => setFEspecialidad(e.target.value)}>
                  <option value="">Todas</option>
                  {especialidades.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {loading && <p className="muted">Cargando…</p>}
      {!loading && grupos.length === 0 && (
        <p className="muted">Todavía no hay estudiantes egresados. Se registran automáticamente al promover a un estudiante desde el último grado de la institución (en la pantalla de Promoción y traslados).</p>
      )}

      {!loading && grupos.map(([promo, porEspecialidad]) => (
        <div key={promo} className="card" style={{ marginBottom: 16 }}>
          <div className="ch"><h3>🎓 Promoción {promo}</h3></div>
          <div className="cb" style={{ padding: 0 }}>
            {Object.entries(porEspecialidad).sort((a, b) => a[0].localeCompare(b[0])).map(([esp, lista]) => (
              <div key={esp} style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate)', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{esp} <span className="badge" style={{ marginLeft: 6 }}>{lista.length}</span></span>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActa({ promocion: promo, especialidad: esp, estudiantes: lista })}>
                    📜 Generar acta
                  </button>
                </div>
                <table className="tbl">
                  <thead><tr><th>Estudiante</th><th>Cédula</th><th>Curso de origen</th><th>Fecha de egreso</th></tr></thead>
                  <tbody>
                    {lista.map(f => (
                      <tr key={f.matriculaId}>
                        <td>{f.nombre}</td><td className="mono">{f.cedula || '—'}</td>
                        <td>{f.grado}{f.paralelo ? ' ' + f.paralelo : ''}</td>
                        <td>{f.fechaEgreso || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      ))}

      {acta && (
        <ActaGrado
          institucion={institucion}
          promocion={acta.promocion}
          especialidad={acta.especialidad}
          estudiantes={acta.estudiantes}
          onClose={() => setActa(null)}
        />
      )}
    </div>
  );
}
