import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { fetchResumenDiaDocentes, marcarAtrasoInspeccion } from '../lib/data.js';
import { filtrarDocentes, ordenarDocentes, totalesDocente } from '../lib/resumenDia.js';
import TarjetaClaseDia, { Pildora } from './TarjetaClaseDia.jsx';

const CLAVE_COLAPSADO = 'sigee.resumenDia.colapsado';
const iniciales = n => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();

/** «Hoy por docente»: estado de cada clase del día, ausentes por docente y, solo para el Inspector General, el paso de ausente a atraso
 *  dentro de la hora de esa clase. Para el resto de roles (p. ej. Vicerrector) es informativo. */
export default function ResumenDiaDocentes() {
  const { profile, institucion } = useSession();
  const rolDb = profile.rolDb;
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [errAccion, setErrAccion] = useState('');
  const [filtro, setFiltro] = useState('');            // '' | 'sin_registro' | 'ausentes' | 'atrasos'
  const [soloNovedades, setSoloNovedades] = useState(true);
  const [texto, setTexto] = useState('');
  const [abiertos, setAbiertos] = useState(() => new Set());
  const [sel, setSel] = useState({});                  // { [docente_materia_id]: Set(asistenciaId) }
  const [confirmar, setConfirmar] = useState(null);    // { clase, ids:Set }
  const [guardando, setGuardando] = useState(false);
  const [colapsado, setColapsado] = useState(() => { try { return sessionStorage.getItem(CLAVE_COLAPSADO) === '1'; } catch { return false; } });

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setError('');
    try { setDatos(await fetchResumenDiaDocentes(institucion?.id || null)); setError(''); }
    catch (e) { setError(e.message || 'No se pudo cargar el resumen del día.'); }
  }, [institucion?.id]);

  useEffect(() => {
    cargar();
    const t = setInterval(() => { if (!document.hidden) cargar(true); }, 60000);
    return () => clearInterval(t);
  }, [cargar]);

  const docentes = useMemo(() => {
    let lista = filtrarDocentes(ordenarDocentes(datos?.docentes), { texto, soloPendientes: soloNovedades && !filtro });
    if (filtro === 'sin_registro') lista = lista.filter(d => d.sin_registro > 0);
    if (filtro === 'ausentes') lista = lista.filter(d => d.ausentes > 0);
    if (filtro === 'atrasos') lista = lista.filter(d => d.atrasos > 0);
    return lista;
  }, [datos, texto, soloNovedades, filtro]);

  const alternarAbierto = (id, abierto) => setAbiertos(s => { const n = new Set(s); if (abierto) n.add(id); else n.delete(id); return n; });
  const alternarEst = (dm, id) => setSel(s => { const n = new Set(s[dm] || []); if (n.has(id)) n.delete(id); else n.add(id); return { ...s, [dm]: n }; });

  async function registrar() {
    if (!confirmar) return;
    setGuardando(true); setErrAccion('');
    try {
      const r = await marcarAtrasoInspeccion([...confirmar.ids]);
      setAviso(`✔ ${r.convertidos} estudiante${r.convertidos === 1 ? '' : 's'} registrado${r.convertidos === 1 ? '' : 's'} con atraso a las ${r.hora} en ${confirmar.clase.materia}. Queda en su ficha de asistencia.`);
      setSel(s => ({ ...s, [confirmar.clase.docente_materia_id]: new Set() }));
      setConfirmar(null);
      await cargar(true);
    } catch (e) { setErrAccion(e.message); await cargar(true); }
    setGuardando(false);
  }

  if (!institucion?.id && rolDb === 'super_admin') return null;
  const t = datos?.totales;
  const kpi = (clave, etiqueta, valor, tono) => (
    <button type="button" key={clave} className={`rd-kpi ${tono || ''}`} aria-pressed={filtro === clave} disabled={!clave}
      onClick={() => clave && setFiltro(f => (f === clave ? '' : clave))} style={!clave ? { cursor: 'default' } : undefined}>
      <b>{valor ?? '—'}</b><span>{etiqueta}</span>
    </button>
  );

  return (
    <section className="rd" aria-label="Hoy por docente">
      <div className="rd-head">
        <div>
          <h3>Hoy por docente</h3>
          <div className="rd-sub">
            {datos ? `Hora del plantel ${datos.hora} · se actualiza cada minuto` : 'Consultando…'}
            {rolDb !== 'inspector_general' && ' · vista informativa'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-sm" onClick={() => cargar()} title="Actualizar ahora">↻ Actualizar</button>
          <button type="button" className="btn btn-sm" aria-expanded={!colapsado}
            onClick={() => setColapsado(v => { try { sessionStorage.setItem(CLAVE_COLAPSADO, v ? '0' : '1'); } catch { /* sin storage */ } return !v; })}>
            {colapsado ? 'Mostrar' : 'Ocultar'}
          </button>
        </div>
      </div>

      {!colapsado && (
        <div className="rd-body">
          {error && <div className="rd-err">{error} <button className="btn btn-secondary btn-sm" onClick={() => cargar()}>Reintentar</button></div>}
          {aviso && <div className="rd-ok" role="status">{aviso}</div>}
          {errAccion && <div className="rd-err" role="alert">{errAccion}</div>}
          {!datos && !error && <div className="rd-empty">Cargando el resumen del día…</div>}

          {datos && !datos.lectivo && <div className="rd-empty">Hoy no es día lectivo según el calendario académico: no hay clases que controlar.</div>}

          {datos?.lectivo && (
            <>
              <div className="rd-kpis">
                {kpi('', 'Clases hoy', t.clases)}
                {kpi('', 'Registradas', t.registradas, 'green')}
                {kpi('', 'En curso', t.en_curso, 'blue')}
                {kpi('', 'Pendientes', t.pendientes)}
                {kpi('sin_registro', 'Sin registro', t.sin_registro, t.sin_registro ? 'red' : '')}
                {kpi('ausentes', 'Ausentes', t.ausentes, t.ausentes ? 'red' : '')}
                {kpi('atrasos', 'Atrasos', t.atrasos, t.atrasos ? 'amber' : '')}
              </div>

              <div className="rd-tools">
                <input className="fc" type="search" placeholder="Buscar docente…" aria-label="Buscar docente" value={texto} onChange={e => setTexto(e.target.value)} />
                <button type="button" className="rd-chip" aria-pressed={soloNovedades} onClick={() => setSoloNovedades(v => !v)}>
                  {soloNovedades ? '✓ ' : ''}Solo con novedades
                </button>
                {filtro && <button type="button" className="rd-chip" aria-pressed="true" onClick={() => setFiltro('')}>Filtro activo ✕</button>}
                <span className="rd-note">{docentes.length} de {datos.docentes.length} docentes</span>
              </div>

              {docentes.length === 0 ? (
                <div className="rd-empty">{datos.docentes.length === 0 ? 'No hay clases con estudiantes en el horario de hoy.' : '✅ Sin novedades: ningún docente tiene ausentes ni clases sin registro con este filtro.'}</div>
              ) : docentes.map(d => {
                const tot = totalesDocente(d);
                return (
                  <details key={d.docente_id} className="rd-doc" open={abiertos.has(d.docente_id)} onToggle={e => { if (e.currentTarget.open !== abiertos.has(d.docente_id)) alternarAbierto(d.docente_id, e.currentTarget.open); }}>
                    <summary>
                      <span className="rd-av" aria-hidden="true">{iniciales(d.docente)}</span>
                      <span className="rd-doc-n">{d.docente}<small>{tot.clases} clase{tot.clases === 1 ? '' : 's'} hoy</small></span>
                      {d.sin_registro > 0 && <Pildora fondo="var(--red)" color="#fff">{d.sin_registro} sin registro</Pildora>}
                      {tot.ausentes > 0 && <Pildora fondo="var(--redXL)" color="var(--redD)">{tot.ausentes} ausente{tot.ausentes === 1 ? '' : 's'}</Pildora>}
                      {tot.atrasos > 0 && <Pildora fondo="var(--amberXL)" color="var(--amberD)">{tot.atrasos} atraso{tot.atrasos === 1 ? '' : 's'}</Pildora>}
                      <span className="rd-chev" aria-hidden="true">▶</span>
                    </summary>
                    {d.clases.map(c => (
                      <TarjetaClaseDia key={c.docente_materia_id} c={c} hora={datos.hora} rolDb={rolDb} seleccion={sel[c.docente_materia_id]}
                        onAlternar={id => alternarEst(c.docente_materia_id, id)}
                        onTodos={set => setSel(s => ({ ...s, [c.docente_materia_id]: set }))}
                        onMarcar={ids => { setErrAccion(''); setAviso(''); setConfirmar({ clase: c, ids }); }} />
                    ))}
                  </details>
                );
              })}
            </>
          )}
        </div>
      )}

      {confirmar && (
        <div className="modal-bg" onClick={() => !guardando && setConfirmar(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Confirmar atraso" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <h3>Registrar atraso</h3>
            <p style={{ fontSize: 14 }}>
              Vas a pasar de <strong>ausente</strong> a <strong>atraso</strong> a <strong>{confirmar.ids.size}</strong> estudiante{confirmar.ids.size === 1 ? '' : 's'} en <strong>{confirmar.clase.materia}</strong> ({confirmar.clase.curso} «{confirmar.clase.paralelo}»).
            </p>
            <ul style={{ fontSize: 13, color: 'var(--slate)', paddingLeft: 18 }}>
              <li>Se guarda con la <strong>hora actual</strong> y queda a tu nombre en la ficha del estudiante.</li>
              <li><strong>No se puede deshacer</strong> ni volver a presente.</li>
              <li>Los demás ausentes de esta clase siguen como ausentes.</li>
            </ul>
            <div className="modal-f">
              <button className="btn btn-secondary" disabled={guardando} onClick={() => setConfirmar(null)}>Cancelar</button>
              <button className="btn btn-primary" disabled={guardando} onClick={registrar}>{guardando ? 'Guardando…' : 'Registrar atraso'}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
