import React, { useCallback, useEffect, useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { listarCentral, contarCentral, crearRegistroCentral, eliminarRegistroCentral, todasCentral, cantonesCentral, registrosParaAsignar, cruzarBaseConActivos } from '../lib/data.js';
import AsignarPlantel from '../components/AsignarPlantel.jsx';
import ImportadorCentral from '../components/ImportadorCentral.jsx';
import { exportarFilasExcel } from '../lib/cargaMasiva.js';
import { filasExport } from '../lib/importCentral.js';
import { CENTRALES, TAM_PAGINA, puedeVerCentrales, filaDesdeForm } from '../lib/centralesBase.js';

// Una sola pantalla para las 4 bases centrales; `clave` elige cuál (ver CENTRALES).
// Solo Super Admin y Supervisor general (también lo exige la RLS de cada tabla).
export default function BasesCentrales({ clave }) {
  const cfg = CENTRALES[clave];
  const { profile } = useSession();
  const permitido = puedeVerCentrales(profile.rolDb);
  // importar y exportar masivamente: solo el Super Admin global
  const esSuperAdmin = profile.rolDb === 'super_admin';
  const [importando, setImportando] = useState(false);
  const [exportando, setExportando] = useState(null);
  // base de docentes: filtros, selección y asignación de plantel
  const [canton, setCanton] = useState('');
  const [cantones, setCantones] = useState([]);
  const [seleccion, setSeleccion] = useState(new Map());   // id → registro
  const [asignando, setAsignando] = useState(null);        // lista de registros a asignar
  const [ficha, setFicha] = useState(null);
  const [cruzando, setCruzando] = useState(false);
  const [confirmaCruce, setConfirmaCruce] = useState(false);
  const [cargandoSel, setCargandoSel] = useState(false);

  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [plantel, setPlantel] = useState('');
  const [pagina, setPagina] = useState(0);
  const [filas, setFilas] = useState([]);
  const [total, setTotal] = useState(0);
  const [resumen, setResumen] = useState({ total: 0, conPlantel: null });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);       // null | { form }
  const [borrar, setBorrar] = useState(null);     // fila a eliminar
  const [msg, setMsg] = useState('');
  const [guardando, setGuardando] = useState(false);

  // al cambiar de base se reinicia todo
  useEffect(() => {
    setTexto(''); setBusqueda(''); setPlantel(''); setCanton(''); setPagina(0); setModal(null); setBorrar(null); setMsg('');
    setSeleccion(new Map()); setAsignando(null); setFicha(null);
  }, [clave]);
  useEffect(() => {
    if (!permitido || !cfg.filtroCanton) { setCantones([]); return; }
    let vivo = true;
    cantonesCentral(cfg).then(l => { if (vivo) setCantones(l); }).catch(() => {});
    return () => { vivo = false; };
  }, [cfg, permitido]);

  const cargar = useCallback(async () => {
    if (!permitido) return;
    setCargando(true); setError('');
    try {
      const [r, c] = await Promise.all([
        listarCentral(cfg, { texto: busqueda, pagina, tam: TAM_PAGINA, plantel, canton }),
        contarCentral(cfg)
      ]);
      setFilas(r.filas); setTotal(r.total); setResumen(c);
    } catch (e) {
      setError(e.message || 'No se pudo cargar la información.');
    }
    setCargando(false);
  }, [cfg, permitido, busqueda, pagina, plantel, canton]);

  useEffect(() => { cargar(); }, [cargar]);

  // búsqueda con pausa para no consultar en cada tecla
  useEffect(() => {
    const id = setTimeout(() => { setBusqueda(texto); setPagina(0); }, 350);
    return () => clearTimeout(id);
  }, [texto]);

  if (!permitido) {
    return <div className="empty" style={{ padding: '60px 20px' }}><span className="ti ti-lock" style={{ fontSize: 32 }} /><h3>Sin acceso</h3></div>;
  }

  const paginas = Math.max(1, Math.ceil(total / TAM_PAGINA));

  async function guardar() {
    setGuardando(true); setMsg('');
    try {
      const fila = filaDesdeForm(cfg, modal.form, profile.id);
      await crearRegistroCentral(cfg, fila);
      setModal(null); setMsg('Registro agregado.');
      await cargar();
    } catch (e) {
      setMsg(/duplicate key|unique/i.test(e.message || '') ? 'Ya existe un registro con esa cédula.' : (e.message || 'No se pudo guardar.'));
    }
    setGuardando(false);
  }

  async function exportar() {
    setMsg(''); setExportando({ hecho: 0, total: resumen.total });
    try {
      const todas = await todasCentral(cfg, setExportando);
      const { cols, filas: filasX } = filasExport(cfg, todas);
      exportarFilasExcel(`${cfg.tabla}_${new Date().toISOString().slice(0, 10)}.xlsx`, filasX, cols);
      setMsg(`Exportados ${todas.length.toLocaleString('es-EC')} registros${cfg.tabla === 'base_docentes' ? ' (una fila por título)' : ''}.`);
    } catch (e) { setMsg('No se pudo exportar: ' + (e.message || e)); }
    setExportando(null);
  }

  const alternar = r => setSeleccion(m => { const n = new Map(m); n.has(r.id) ? n.delete(r.id) : n.set(r.id, r); return n; });
  const todosEnPagina = filas.length > 0 && filas.every(r => seleccion.has(r.id));
  const alternarPagina = () => setSeleccion(m => { const n = new Map(m); if (todosEnPagina) filas.forEach(r => n.delete(r.id)); else filas.forEach(r => n.set(r.id, r)); return n; });
  async function seleccionarTodosResultados() {
    setCargandoSel(true);
    try {
      const todos = await registrosParaAsignar(cfg, { texto: busqueda, plantel, canton });
      setSeleccion(new Map(todos.map(r => [r.id, r])));
    } catch (e) { setMsg('No se pudo seleccionar: ' + (e.message || e)); }
    setCargandoSel(false);
  }
  async function cruzar() {
    setConfirmaCruce(false); setCruzando(true); setMsg('');
    try {
      const r = await cruzarBaseConActivos();
      setMsg(`Cruce terminado: ${r.cruzados.toLocaleString('es-EC')} docentes de la base ya estaban activos en un plantel y quedaron asignados`
        + (r.ambiguos ? ` · ${r.ambiguos} están en más de un plantel (asígnalos tú)` : '') + ` · ${r.sinCoincidencia.toLocaleString('es-EC')} sin coincidencia.`
        + (r.fallos.length ? ' Hubo errores: ' + r.fallos[0] : ''));
      await cargar();
    } catch (e) { setMsg('No se pudo cruzar: ' + (e.message || e)); }
    setCruzando(false);
  }

  async function confirmarBorrar() {
    try {
      await eliminarRegistroCentral(cfg, borrar.id);
      setBorrar(null); setMsg('Registro eliminado.');
      await cargar();
    } catch (e) { setMsg(e.message || 'No se pudo eliminar.'); setBorrar(null); }
  }

  return (
    <div>
      <div className="ph" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0 }}><span className={cfg.icono} /> {cfg.titulo}</h2>
          <p style={{ color: 'var(--slate)', margin: '4px 0 0', fontSize: 13 }}>{cfg.sub}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {cfg.asignable && <button className="btn btn-secondary" style={{ borderColor: '#d97706', color: '#b45309' }} disabled={cruzando} onClick={() => setConfirmaCruce(true)} title="Asigna a su plantel a los de la base que ya están activos">{cruzando ? 'Cruzando…' : '🔄 Cruzar con docentes activos'}</button>}
          {esSuperAdmin && <button className="btn btn-secondary" onClick={() => setImportando(true)}>⬆️ Importar</button>}
          {esSuperAdmin && (
            <button className="btn btn-secondary" onClick={exportar} disabled={!!exportando || resumen.total === 0}>
              {exportando ? `Exportando… ${exportando.hecho.toLocaleString('es-EC')}` : '⬇️ Exportar Excel'}
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setModal({ form: {} })}><span className="ti ti-plus" /> Agregar registro</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div className="card" style={{ padding: '12px 18px', margin: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--slate)', fontWeight: 700, textTransform: 'uppercase' }}>Total en base</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{resumen.total.toLocaleString('es-EC')}</div>
        </div>
        {resumen.conTitulos !== null && resumen.conTitulos !== undefined && (
          <div className="card" style={{ padding: '12px 18px', margin: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--slate)', fontWeight: 700, textTransform: 'uppercase' }}>Con títulos</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{resumen.conTitulos.toLocaleString('es-EC')}</div>
          </div>
        )}
        {cfg.filtroPlantel && resumen.conPlantel !== null && (
          <>
            <div className="card" style={{ padding: '12px 18px', margin: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--slate)', fontWeight: 700, textTransform: 'uppercase' }}>Con plantel asignado</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{resumen.conPlantel.toLocaleString('es-EC')}</div>
            </div>
            <div className="card" style={{ padding: '12px 18px', margin: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--slate)', fontWeight: 700, textTransform: 'uppercase' }}>Sin plantel · pendientes de asignación</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{(resumen.total - resumen.conPlantel).toLocaleString('es-EC')}</div>
            </div>
          </>
        )}
      </div>

      {msg && <div className="card" style={{ padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>{msg}</div>}

      <div className="card">
        <div className="cb">
          <div className="search-bar">
            <input className="fc" style={{ maxWidth: 320 }} placeholder="Buscar por cédula o nombre…" value={texto} onChange={e => setTexto(e.target.value)} />
            {cfg.filtroPlantel && (
              <select className="fc" value={plantel} onChange={e => { setPlantel(e.target.value); setPagina(0); }}>
                <option value="">Todos</option>
                <option value="sin">Sin plantel asignado</option>
                <option value="con">Con plantel asignado</option>
              </select>
            )}
            {cfg.filtroCanton && (
              <select className="fc" value={canton} onChange={e => { setCanton(e.target.value); setPagina(0); }}>
                <option value="">Todos los cantones</option>
                {cantones.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            {(texto || plantel || canton) && <button className="btn btn-secondary btn-sm" onClick={() => { setTexto(''); setBusqueda(''); setPlantel(''); setCanton(''); setPagina(0); }}>✕ Limpiar</button>}
          </div>

          {cfg.asignable && seleccion.size > 0 && (
            <div className="card" style={{ margin: '0 0 10px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: 'rgba(8,145,178,.08)' }}>
              <strong>{seleccion.size.toLocaleString('es-EC')} seleccionado{seleccion.size === 1 ? '' : 's'}</strong>
              <button className="btn btn-primary btn-sm" onClick={() => setAsignando([...seleccion.values()])}>🏫 Asignar plantel</button>
              {total > seleccion.size && <button className="btn btn-secondary btn-sm" onClick={seleccionarTodosResultados} disabled={cargandoSel}>{cargandoSel ? 'Seleccionando…' : `Seleccionar los ${total.toLocaleString('es-EC')} resultados`}</button>}
              <button className="btn btn-ghost btn-sm" onClick={() => setSeleccion(new Map())}>Quitar selección</button>
            </div>
          )}
          {error && <div className="lerr" style={{ display: 'flex', marginBottom: 10 }}>{error}</div>}

          <div style={{ overflowX: 'auto' }}>
            <table className="tbl" style={{ width: '100%' }}>
              <thead>
                <tr>
                  {cfg.asignable && <th style={{ width: 34 }}><input type="checkbox" checked={todosEnPagina} onChange={alternarPagina} title="Seleccionar esta página" /></th>}
                  <th style={{ width: 40 }}>#</th>
                  {cfg.columnas.map(c => <th key={c.k}>{c.t}</th>)}
                  <th>{cfg.etiquetaPlantel}</th>
                  <th style={{ width: cfg.asignable ? 120 : 70 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cargando && <tr><td colSpan={cfg.columnas.length + 3 + (cfg.asignable ? 1 : 0)} style={{ textAlign: 'center', padding: 24 }}>Cargando…</td></tr>}
                {!cargando && filas.length === 0 && (
                  <tr><td colSpan={cfg.columnas.length + 3 + (cfg.asignable ? 1 : 0)} style={{ textAlign: 'center', padding: 28, color: 'var(--slate)' }}>
                    {busqueda ? 'Sin resultados para la búsqueda.' : 'Aún no hay registros en esta base.'}
                  </td></tr>
                )}
                {!cargando && filas.map((r, i) => (
                  <tr key={r.id}>
                    {cfg.asignable && <td><input type="checkbox" checked={seleccion.has(r.id)} onChange={() => alternar(r)} /></td>}
                    <td>{pagina * TAM_PAGINA + i + 1}</td>
                    {cfg.columnas.map(c => (
                      <td key={c.k} className={c.mono ? 'mono' : ''}>{c.k === 'titulos' ? <span style={{ background: 'rgba(22,163,74,.14)', color: '#15803d', borderRadius: 999, padding: '2px 9px', fontWeight: 700, fontSize: 12 }}>{c.calc(r)}</span> : ((c.calc ? c.calc(r) : r[c.k]) ?? '—')}</td>
                    ))}
                    <td>{r.plantel ? `${r.plantel.nombre}${r.plantel.amie ? ' · ' + r.plantel.amie : ''}` : <span style={{ color: 'var(--slate)' }}>Sin asignar</span>}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {cfg.asignable && <button className="btn btn-ghost btn-sm" title="Ver ficha" onClick={() => setFicha(r)}>👁</button>}
                      {cfg.asignable && !r.institucion_id && <button className="btn btn-ghost btn-sm" title="Asignar plantel" onClick={() => setAsignando([r])}>🏫</button>}
                      <button className="btn btn-ghost btn-sm" title="Eliminar" onClick={() => setBorrar(r)}><span className="ti ti-trash" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: 12.5, color: 'var(--slate)' }}>
            <span>{total.toLocaleString('es-EC')} resultado{total === 1 ? '' : 's'}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" disabled={pagina === 0} onClick={() => setPagina(p => p - 1)}>‹ Anterior</button>
              Página {pagina + 1} de {paginas}
              <button className="btn btn-secondary btn-sm" disabled={pagina + 1 >= paginas} onClick={() => setPagina(p => p + 1)}>Siguiente ›</button>
            </span>
          </div>
        </div>
      </div>

      {asignando && (
        <AsignarPlantel registros={asignando} onClose={() => setAsignando(null)} onTerminado={() => { setSeleccion(new Map()); cargar(); }} />
      )}

      {confirmaCruce && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setConfirmaCruce(false); }}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="ch"><h3>🔄 Cruzar con docentes activos</h3></div>
            <div className="cb">
              <p style={{ fontSize: 13 }}>Reviso por cédula los docentes de la base que aún no tienen plantel. Los que ya están activos en <strong>un</strong> plantel quedan asignados a ese plantel. Si una cédula está en varios planteles, no la toco.</p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button className="btn btn-secondary" onClick={() => setConfirmaCruce(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={cruzar}>Cruzar ahora</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {ficha && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setFicha(null); }}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="ch"><h3>{ficha.nombre}</h3></div>
            <div className="cb">
              <table className="tbl" style={{ width: '100%', marginBottom: 12 }}>
                <tbody>
                  {cfg.campos.filter(c => ficha[c.k]).map(c => <tr key={c.k}><td style={{ width: 150, color: 'var(--slate)' }}>{c.t}</td><td>{ficha[c.k]}</td></tr>)}
                  <tr><td style={{ color: 'var(--slate)' }}>{cfg.etiquetaPlantel}</td><td>{ficha.plantel ? `${ficha.plantel.nombre}${ficha.plantel.amie ? ' · ' + ficha.plantel.amie : ''}` : 'Sin asignar'}</td></tr>
                </tbody>
              </table>
              <strong style={{ fontSize: 13 }}>Títulos ({Array.isArray(ficha.titulos) ? ficha.titulos.length : 0})</strong>
              {(!Array.isArray(ficha.titulos) || ficha.titulos.length === 0) ? <p style={{ fontSize: 12.5, color: 'var(--slate)' }}>Sin títulos registrados.</p> : (
                <ul style={{ fontSize: 12.5, margin: '6px 0 0 18px' }}>
                  {ficha.titulos.map((t, i) => <li key={i}>{t.titulo}{t.institucion ? ` — ${t.institucion}` : ''}{t.num_registro ? ` · registro ${t.num_registro}` : ''}</li>)}
                </ul>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
                <button className="btn btn-secondary" onClick={() => setFicha(null)}>Cerrar</button>
                {!ficha.institucion_id && <button className="btn btn-primary" onClick={() => { const f = ficha; setFicha(null); setAsignando([f]); }}>🏫 Asignar plantel</button>}
              </div>
            </div>
          </div>
        </div>
      )}

      {importando && esSuperAdmin && (
        <ImportadorCentral cfg={cfg} autorId={profile.id} onClose={() => setImportando(false)} onTerminar={cargar} />
      )}

      {modal && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="ch"><h3>Agregar registro · {cfg.titulo}</h3></div>
            <div className="cb">
              {cfg.campos.map(c => (
                <div key={c.k} style={{ marginBottom: 10 }}>
                  <label className="fl">{c.t}{c.req ? ' *' : ''}</label>
                  {c.opciones ? (
                    <select className="fc" value={modal.form[c.k] || ''} onChange={e => setModal(m => ({ form: { ...m.form, [c.k]: e.target.value } }))}>
                      <option value="">—</option>
                      {c.opciones.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : c.largo ? (
                    <textarea className="fc" rows={3} value={modal.form[c.k] || ''} onChange={e => setModal(m => ({ form: { ...m.form, [c.k]: e.target.value } }))} />
                  ) : (
                    <input className="fc" type={c.tipo || 'text'} value={modal.form[c.k] || ''} onChange={e => setModal(m => ({ form: { ...m.form, [c.k]: e.target.value } }))} />
                  )}
                </div>
              ))}
              {msg && <div className="lerr" style={{ display: 'flex', marginBottom: 8 }}>{msg}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
                <button className="btn btn-primary" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {borrar && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setBorrar(null); }}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="ch"><h3>¿Eliminar este registro?</h3></div>
            <div className="cb">
              <p style={{ fontSize: 13 }}>{borrar.cedula || 'Sin cédula'} · {(cfg.columnas.find(c => c.k === 'nombre')?.calc?.(borrar)) || borrar.nombre || '—'}</p>
              <p style={{ fontSize: 12, color: 'var(--slate)' }}>Esta acción no se puede deshacer.</p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button className="btn btn-secondary" onClick={() => setBorrar(null)}>Cancelar</button>
                <button className="btn btn-danger" onClick={confirmarBorrar}>Eliminar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
