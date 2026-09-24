import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import {
  fetchPeriodos, fetchInstitucionesCatalogo, cambiarEstadoMatricula
} from '../lib/data.js';

const ACCIONES = [
  { id: 'promovida', label: '⬆️ Promover al año superior' },
  { id: 'repite', label: '↩️ Repite el año' },
  { id: 'trasladada', label: '🏫 Trasladar a otra institución' }
];

export default function PromocionMatriculas() {
  const { data, institucion, refrescarDatos } = useSession();
  const institucionId = institucion?.id;

  const [periodos, setPeriodos] = useState([]);
  useEffect(() => { if (institucionId) fetchPeriodos(institucionId).then(setPeriodos); }, [institucionId]);

  const gradosOrdenados = useMemo(
    () => [...(data?.grados || [])].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)),
    [data?.grados]
  );

  const [fCurso, setFCurso] = useState(''); // "gradoId|paraleloId"
  const cursosDisponibles = useMemo(() => {
    const set = new Map();
    (data?.estudiantes || []).forEach(e => {
      if (e.estado === 'activa' && e.gradoId && e.paraleloId) {
        set.set(`${e.gradoId}|${e.paraleloId}`, `${e.curso} ${e.paralelo}`);
      }
    });
    return [...set.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data?.estudiantes]);

  const [gradoId, paraleloId] = fCurso.split('|');
  const estudiantesEnCurso = useMemo(
    () => (data?.estudiantes || []).filter(e => e.gradoId === gradoId && e.paraleloId === paraleloId && e.estado === 'activa'),
    [data?.estudiantes, gradoId, paraleloId]
  );

  const [seleccion, setSeleccion] = useState(new Set());
  useEffect(() => { setSeleccion(new Set()); }, [fCurso]);
  function toggleSel(id) {
    setSeleccion(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleTodos() {
    setSeleccion(s => s.size === estudiantesEnCurso.length ? new Set() : new Set(estudiantesEnCurso.map(e => e.id)));
  }

  const [accion, setAccion] = useState('');
  const [periodoDestinoId, setPeriodoDestinoId] = useState('');
  const [paraleloDestinoId, setParaleloDestinoId] = useState(paraleloId || '');
  const [motivo, setMotivo] = useState('');
  const [buscarInst, setBuscarInst] = useState('');
  const [resultadosInst, setResultadosInst] = useState([]);
  const [institucionDestino, setInstitucionDestino] = useState(null);
  const [institucionExterna, setInstitucionExterna] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  const gradoOrigen = gradosOrdenados.find(g => g.id === gradoId);
  const idx = gradosOrdenados.findIndex(g => g.id === gradoId);
  const gradoSiguiente = accion === 'promovida' ? (gradosOrdenados[idx + 1] || null) : null;
  const esEgreso = accion === 'promovida' && gradoOrigen && !gradoSiguiente;
  const gradoDestino = accion === 'repite' ? gradoOrigen : gradoSiguiente;
  const paralelosDestino = (data?.paralelos || []).filter(p => p.grado_id === gradoDestino?.id);

  useEffect(() => {
    setParaleloDestinoId(accion === 'repite' ? paraleloId || '' : '');
    setMotivo(''); setInstitucionDestino(null); setInstitucionExterna(''); setBuscarInst(''); setResultadosInst([]);
  }, [accion]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!buscarInst || buscarInst.length < 3) { setResultadosInst([]); return; }
    const t = setTimeout(() => { fetchInstitucionesCatalogo(buscarInst).then(setResultadosInst); }, 350);
    return () => clearTimeout(t);
  }, [buscarInst]);

  const puedeConfirmar =
    seleccion.size > 0 && accion &&
    (accion === 'trasladada'
      ? (institucionDestino || institucionExterna.trim())
      : (esEgreso || (periodoDestinoId && paraleloDestinoId)));

  async function confirmar() {
    setProcesando(true); setError('');
    const loteId = crypto.randomUUID();
    const tipoFinal = esEgreso ? 'egresada' : accion;
    let ok = 0, fallos = [];
    for (const est of estudiantesEnCurso.filter(e => seleccion.has(e.id))) {
      try {
        await cambiarEstadoMatricula(est.id, est.matriculaId, tipoFinal, {
          motivo: motivo || null, loteId,
          institucionDestinoId: institucionDestino?.id || null,
          institucionDestinoExterna: institucionDestino ? null : (institucionExterna.trim() || null),
          gradoDestinoId: gradoDestino?.id || null,
          paraleloDestinoId: paraleloDestinoId || null,
          periodoDestinoId: periodoDestinoId || null
        });
        ok++;
      } catch (err) {
        fallos.push({ nombre: est.nombre, motivo: err.message });
      }
    }
    setProcesando(false);
    setResultado({ ok, fallos, loteId });
    setSeleccion(new Set());
    await refrescarDatos();
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 4px' }}>Promoción, repitencia y traslados</h2>
      <div style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 16 }}>
        {institucion?.nombre} · Selecciona uno o varios estudiantes del mismo curso para procesar el cambio de forma individual o masiva.
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="cb">
          <div className="form-grid">
            <div className="full">
              <label className="fl">Curso de origen</label>
              <select className="fc" value={fCurso} onChange={e => { setFCurso(e.target.value); setAccion(''); setResultado(null); }}>
                <option value="">Seleccione un curso…</option>
                {cursosDisponibles.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {fCurso && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="ch"><h3>Estudiantes ({estudiantesEnCurso.length})</h3></div>
          <div className="cb" style={{ maxHeight: 340, overflow: 'auto' }}>
            <table className="tbl">
              <thead><tr>
                <th><input type="checkbox" checked={seleccion.size > 0 && seleccion.size === estudiantesEnCurso.length} onChange={toggleTodos} /></th>
                <th>Estudiante</th><th>Cédula</th>
              </tr></thead>
              <tbody>
                {estudiantesEnCurso.map(e => (
                  <tr key={e.id}>
                    <td><input type="checkbox" checked={seleccion.has(e.id)} onChange={() => toggleSel(e.id)} /></td>
                    <td>{e.nombre}</td><td className="mono">{e.cedula || '—'}</td>
                  </tr>
                ))}
                {estudiantesEnCurso.length === 0 && <tr><td colSpan={3} className="muted">No hay estudiantes activos en este curso.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {seleccion.size > 0 && (
        <div className="card">
          <div className="ch"><h3>{seleccion.size} estudiante{seleccion.size === 1 ? '' : 's'} seleccionado{seleccion.size === 1 ? '' : 's'}</h3></div>
          <div className="cb">
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              {ACCIONES.map(a => (
                <button key={a.id} type="button"
                  className={'btn ' + (accion === a.id ? 'btn-primary' : 'btn-secondary')}
                  onClick={() => setAccion(a.id)}>{a.label}</button>
              ))}
            </div>

            {accion === 'promovida' && (
              esEgreso
                ? <p style={{ color: 'var(--slate)' }}>Este es el último grado ({gradoOrigen?.nombre}) — el cambio se registrará como <strong>egresado</strong>, sin abrir una matrícula nueva.</p>
                : <p style={{ color: 'var(--slate)' }}>Grado siguiente: <strong>{gradoSiguiente?.nombre || '—'}</strong></p>
            )}

            {(accion === 'promovida' && !esEgreso || accion === 'repite') && (
              <div className="form-grid" style={{ marginBottom: 12 }}>
                <div>
                  <label className="fl">Período lectivo destino</label>
                  <select className="fc" value={periodoDestinoId} onChange={e => setPeriodoDestinoId(e.target.value)}>
                    <option value="">Seleccione…</option>
                    {periodos.filter(p => p.id !== data?.periodoActivo?.id).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                  {periodos.filter(p => p.id !== data?.periodoActivo?.id).length === 0 && (
                    <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>
                      No hay otro período lectivo creado aún. Crea el siguiente año lectivo en Configuración antes de promover o marcar repitencia.
                    </p>
                  )}
                </div>
                <div>
                  <label className="fl">Paralelo destino ({gradoDestino?.nombre})</label>
                  <select className="fc" value={paraleloDestinoId} onChange={e => setParaleloDestinoId(e.target.value)}>
                    <option value="">Seleccione…</option>
                    {paralelosDestino.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
              </div>
            )}

            {accion === 'trasladada' && (
              <div className="form-grid" style={{ marginBottom: 12 }}>
                <div className="full">
                  <label className="fl">Institución destino (buscar en el catálogo)</label>
                  <input className="fc" placeholder="Escriba al menos 3 letras del nombre…" value={buscarInst}
                    onChange={e => { setBuscarInst(e.target.value); setInstitucionDestino(null); }} disabled={!!institucionDestino} />
                  {institucionDestino && (
                    <div style={{ marginTop: 6 }}>
                      <span className="badge b-ok">{institucionDestino.nombre}</span>{' '}
                      <button type="button" className="btn btn-sm btn-secondary" onClick={() => setInstitucionDestino(null)}>Cambiar</button>
                    </div>
                  )}
                  {!institucionDestino && resultadosInst.length > 0 && (
                    <div style={{ border: '1px solid var(--border)', borderRadius: 8, marginTop: 6, maxHeight: 180, overflow: 'auto' }}>
                      {resultadosInst.map(i => (
                        <div key={i.id} style={{ padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid #eef1f8' }}
                          onClick={() => { setInstitucionDestino(i); setBuscarInst(''); setResultadosInst([]); }}>
                          {i.nombre} <span className="muted" style={{ fontSize: 12 }}>({i.canton}, {i.provincia})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="full">
                  <label className="fl">O institución fuera del sistema (no está en el catálogo)</label>
                  <input className="fc" placeholder="Nombre de la institución externa" value={institucionExterna}
                    onChange={e => setInstitucionExterna(e.target.value)} disabled={!!institucionDestino} />
                </div>
              </div>
            )}

            {(accion === 'repite' || accion === 'trasladada') && (
              <div className="form-grid" style={{ marginBottom: 12 }}>
                <div className="full">
                  <label className="fl">Motivo {accion === 'repite' ? '(ej. notas, inasistencias)' : '(ej. cambio de domicilio)'}</label>
                  <input className="fc" value={motivo} onChange={e => setMotivo(e.target.value)} />
                </div>
              </div>
            )}

            {error && <p style={{ color: 'var(--red)' }}>{error}</p>}

            {accion && (
              <button type="button" className="btn btn-primary" disabled={!puedeConfirmar || procesando} onClick={confirmar}>
                {procesando ? 'Procesando…' : `✅ Confirmar (${seleccion.size})`}
              </button>
            )}
          </div>
        </div>
      )}

      {resultado && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="cb">
            <p><strong>{resultado.ok}</strong> matrícula{resultado.ok === 1 ? '' : 's'} actualizada{resultado.ok === 1 ? '' : 's'} correctamente.</p>
            {resultado.fallos.length > 0 && (
              <>
                <p style={{ color: 'var(--red)' }}>{resultado.fallos.length} fallaron:</p>
                <ul style={{ fontSize: 12, color: 'var(--red)' }}>
                  {resultado.fallos.map((f, i) => <li key={i}>{f.nombre}: {f.motivo}</li>)}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
