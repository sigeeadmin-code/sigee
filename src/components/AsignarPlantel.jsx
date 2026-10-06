import React, { useEffect, useState } from 'react';
import BuscadorInstitucion from './BuscadorInstitucion.jsx';
import { fetchInstitucionesBusqueda, asignarBaseDocentes } from '../lib/data.js';

const overlay = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 70, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '6vh 12px', overflowY: 'auto' };
const caja = { background: 'var(--card, #fff)', borderRadius: 14, width: '100%', maxWidth: 560, boxShadow: '0 20px 50px rgba(0,0,0,.28)' };

// Asigna un plantel (por nombre o AMIE) a los docentes elegidos de la base y los incorpora al sistema activo.
export default function AsignarPlantel({ registros: elegidos, onClose, onTerminado }) {
  // Los que ya tienen plantel no se tocan: así nadie queda duplicado en dos planteles.
  const registros = elegidos.filter(r => !r.institucion_id);
  const yaAsignados = elegidos.length - registros.length;
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [plantelId, setPlantelId] = useState('');
  const [plantel, setPlantel] = useState(null);
  const [paso, setPaso] = useState('elegir');   // elegir → trabajando → resultado
  const [progreso, setProgreso] = useState({ hecho: 0, total: 1 });
  const [res, setRes] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    fetchInstitucionesBusqueda().then(l => { if (vivo) setLista(l); }).catch(() => { if (vivo) setLista([]); }).finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, []);

  async function asignar() {
    setPaso('trabajando'); setError(''); setProgreso({ hecho: 0, total: registros.length });
    try { setRes(await asignarBaseDocentes(plantelId, registros, setProgreso)); }
    catch (e) { setRes(null); setError(e.message || String(e)); }
    setPaso('resultado');
    onTerminado?.();
  }

  const cerrar = () => { if (paso !== 'trabajando') onClose(); };
  const n = registros.length;

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) cerrar(); }}>
      <div style={caja}>
        <div className="ch"><h3>🏫 Asignar plantel · {n.toLocaleString('es-EC')} docente{n === 1 ? '' : 's'}</h3><button className="btn btn-ghost btn-sm" onClick={cerrar} disabled={paso === 'trabajando'}>✕</button></div>
        <div className="cb">
          {paso === 'elegir' && (
            <div>
              <p style={{ fontSize: 13, marginTop: 0 }}>Elige el plantel por nombre o código AMIE. Los docentes quedan <strong>incorporados al sistema activo</strong> de ese plantel (si ya estaban, no se duplican).</p>
              {yaAsignados > 0 && <p style={{ fontSize: 12.5, color: '#b45309', margin: '0 0 10px' }}>{yaAsignados.toLocaleString('es-EC')} de los elegidos ya tienen plantel y no se modifican.</p>}
              {n === 0 && <p style={{ fontSize: 13 }}>Todos los elegidos ya tienen plantel asignado.</p>}
              <BuscadorInstitucion instituciones={lista} cargando={cargando} value={plantelId} onChange={(id, inst) => { setPlantelId(id); setPlantel(inst); }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
                <button className="btn btn-primary" disabled={!plantelId || n === 0} onClick={asignar}>Asignar {n.toLocaleString('es-EC')} a este plantel</button>
              </div>
            </div>
          )}

          {paso === 'trabajando' && (
            <div style={{ padding: '14px 0' }}>
              <p style={{ fontSize: 13 }}>Incorporando… {progreso.hecho.toLocaleString('es-EC')} de {progreso.total.toLocaleString('es-EC')}. No cierres esta ventana.</p>
              <div style={{ height: 10, background: 'var(--line, #e2e8f0)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, Math.round((progreso.hecho / Math.max(1, progreso.total)) * 100))}%`, height: '100%', background: 'var(--brand, #0891b2)', transition: 'width .2s' }} />
              </div>
            </div>
          )}

          {paso === 'resultado' && (
            <div>
              {error && <div className="lerr" style={{ display: 'flex', marginBottom: 10 }}>No se pudo asignar: {error}</div>}
              {res && (
                <>
                  <p style={{ fontSize: 14, marginTop: 0 }}>{res.fallos.length === 0 ? '✅ Listo.' : '⚠️ Terminó con problemas.'} {plantel ? <>Plantel: <strong>{plantel.nombre}</strong>{plantel.amie ? ` · ${plantel.amie}` : ''}</> : null}</p>
                  <ul style={{ fontSize: 13, margin: '0 0 10px 18px' }}>
                    <li>{res.incorporados.toLocaleString('es-EC')} incorporados al plantel</li>
                    {res.yaEstaban > 0 && <li>{res.yaEstaban.toLocaleString('es-EC')} ya estaban en el plantel (solo se marcaron como asignados)</li>}
                    {res.sinCedula > 0 && <li>{res.sinCedula} sin cédula válida: no se asignaron</li>}
                  </ul>
                  {res.dudosos.length > 0 && (
                    <details style={{ fontSize: 12.5, marginBottom: 10 }}>
                      <summary>Revisa estos nombres ({res.dudosos.length}): no estoy seguro de dónde separar apellidos y nombres</summary>
                      <ul style={{ margin: '6px 0 0 18px' }}>{res.dudosos.slice(0, 20).map((d, i) => <li key={i}>{d.nombre} ({d.cedula})</li>)}</ul>
                    </details>
                  )}
                  {res.fallos.map((f, i) => <div key={i} className="lerr" style={{ display: 'flex', marginBottom: 6 }}>{f.cedula ? `Cédula ${f.cedula}: ` : ''}{f.motivo}</div>)}
                </>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="btn btn-primary" onClick={onClose}>Cerrar</button></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
