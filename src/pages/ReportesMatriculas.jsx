import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { fetchReporteCambiosMatricula } from '../lib/data.js';
import { exportarFilasExcel } from '../lib/cargaMasiva.js';

const TIPO_LABEL = {
  promovida: 'Promovido', repite: 'Repite', trasladada: 'Traslado',
  egresada: 'Egresado', retirada: 'Retirado'
};

function haceMeses(n) { const d = new Date(); d.setMonth(d.getMonth() - n); return d.toISOString().slice(0, 10); }
function hoyISO() { return new Date().toISOString().slice(0, 10); }

export default function ReportesMatriculas() {
  const { data, institucion } = useSession();
  const institucionId = institucion?.id;

  const [desde, setDesde] = useState(haceMeses(6));
  const [hasta, setHasta] = useState(hoyISO());
  const [tipo, setTipo] = useState('');
  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!institucionId) return;
    setLoading(true);
    const rows = await fetchReporteCambiosMatricula(institucionId, { desde, hasta, tipo: tipo || undefined });
    setFilas(rows);
    setLoading(false);
  }, [institucionId, desde, hasta, tipo]);
  useEffect(() => { cargar(); }, [cargar]);

  const estudiantesById = useMemo(() => Object.fromEntries((data?.estudiantes || []).map(e => [e.id, e])), [data?.estudiantes]);
  const usuariosById = useMemo(() => Object.fromEntries((data?.usuarios || []).map(u => [u.id, u])), [data?.usuarios]);
  const gradosById = useMemo(() => Object.fromEntries((data?.grados || []).map(g => [g.id, g])), [data?.grados]);
  const paralelosById = useMemo(() => Object.fromEntries((data?.paralelos || []).map(p => [p.id, p])), [data?.paralelos]);

  const filasEnriquecidas = useMemo(() => filas.map(r => {
    const c = r.cambios || {};
    const nuevo = c.new || {}, viejo = c.old || {};
    const est = estudiantesById[r.estudianteId];
    const gradoOrigen = gradosById[viejo.grado_id];
    const paraleloOrigen = paralelosById[viejo.paralelo_id];
    const destinoInterno = nuevo.institucion_destino_id;
    return {
      fecha: (r.created_at || '').slice(0, 10),
      estudiante: est?.nombre || r.estudianteId || '—',
      cursoOrigen: gradoOrigen ? `${gradoOrigen.nombre}${paraleloOrigen ? ' ' + paraleloOrigen.nombre : ''}` : '—',
      tipo: TIPO_LABEL[r.estadoNuevo] || r.estadoNuevo,
      destino: r.estadoNuevo === 'trasladada'
        ? (nuevo.institucion_destino_externa || (destinoInterno ? 'Otra institución del sistema' : '—'))
        : '—',
      motivo: nuevo.motivo_cambio || '—',
      usuario: usuariosById[r.profile_id]?.nombre || '—'
    };
  }), [filas, estudiantesById, gradosById, paralelosById, usuariosById]);

  const cursosDisponibles = [...new Set(filasEnriquecidas.map(f => f.cursoOrigen))].sort();
  const [fCurso, setFCurso] = useState('');
  const filtradas = filasEnriquecidas.filter(f => !fCurso || f.cursoOrigen === fCurso);

  const resumen = filtradas.reduce((acc, f) => { acc[f.tipo] = (acc[f.tipo] || 0) + 1; return acc; }, {});

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: '0 0 4px' }}>Reportes de cambios de matrícula</h2>
          <div style={{ fontSize: 13, color: 'var(--slate)' }}>{institucion?.nombre} · Promociones, repitencias y traslados</div>
        </div>
        <button className="btn btn-secondary"
          onClick={() => exportarFilasExcel(`cambios_matricula_${hasta}.xlsx`, filtradas,
            ['fecha', 'estudiante', 'cursoOrigen', 'tipo', 'destino', 'motivo', 'usuario'])}
          disabled={filtradas.length === 0}>
          ⬇️ Exportar Excel
        </button>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="cb">
          <div className="form-grid">
            <div><label className="fl">Desde</label><input type="date" className="fc" value={desde} onChange={e => setDesde(e.target.value)} /></div>
            <div><label className="fl">Hasta</label><input type="date" className="fc" value={hasta} onChange={e => setHasta(e.target.value)} /></div>
            <div>
              <label className="fl">Tipo de cambio</label>
              <select className="fc" value={tipo} onChange={e => setTipo(e.target.value)}>
                <option value="">Todos</option>
                {Object.entries(TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="fl">Curso de origen</label>
              <select className="fc" value={fCurso} onChange={e => setFCurso(e.target.value)}>
                <option value="">Todos</option>
                {cursosDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        {Object.entries(resumen).map(([k, v]) => (
          <div key={k} className="card" style={{ padding: '10px 16px' }}>
            <div style={{ fontSize: 12, color: 'var(--slate)' }}>{k}</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{v}</div>
          </div>
        ))}
        {Object.keys(resumen).length === 0 && !loading && <p className="muted">No hay cambios registrados en este rango de fechas.</p>}
      </div>

      <div className="card">
        <div className="cb" style={{ overflow: 'auto' }}>
          <table className="tbl">
            <thead><tr>
              <th>Fecha</th><th>Estudiante</th><th>Curso origen</th><th>Tipo</th><th>Destino</th><th>Motivo</th><th>Registrado por</th>
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="muted">Cargando…</td></tr>}
              {!loading && filtradas.map((f, i) => (
                <tr key={i}>
                  <td>{f.fecha}</td><td>{f.estudiante}</td><td>{f.cursoOrigen}</td>
                  <td><span className="badge">{f.tipo}</span></td>
                  <td>{f.destino}</td><td>{f.motivo}</td><td>{f.usuario}</td>
                </tr>
              ))}
              {!loading && filtradas.length === 0 && <tr><td colSpan={7} className="muted">Sin resultados.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
