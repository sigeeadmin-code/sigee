import React, { useCallback, useEffect, useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { listarCentral, contarCentral, crearRegistroCentral, eliminarRegistroCentral, todasCentral } from '../lib/data.js';
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
  useEffect(() => { setTexto(''); setBusqueda(''); setPlantel(''); setPagina(0); setModal(null); setBorrar(null); setMsg(''); }, [clave]);

  const cargar = useCallback(async () => {
    if (!permitido) return;
    setCargando(true); setError('');
    try {
      const [r, c] = await Promise.all([
        listarCentral(cfg, { texto: busqueda, pagina, tam: TAM_PAGINA, plantel }),
        contarCentral(cfg)
      ]);
      setFilas(r.filas); setTotal(r.total); setResumen(c);
    } catch (e) {
      setError(e.message || 'No se pudo cargar la información.');
    }
    setCargando(false);
  }, [cfg, permitido, busqueda, pagina, plantel]);

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
          <div style={{ fontSize: 11, color: 'var(--slate)', fontWeight: 700, textTransform: 'uppercase' }}>Total registrado</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{resumen.total.toLocaleString('es-EC')}</div>
        </div>
        {cfg.filtroPlantel && resumen.conPlantel !== null && (
          <>
            <div className="card" style={{ padding: '12px 18px', margin: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--slate)', fontWeight: 700, textTransform: 'uppercase' }}>Con plantel asignado</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{resumen.conPlantel.toLocaleString('es-EC')}</div>
            </div>
            <div className="card" style={{ padding: '12px 18px', margin: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--slate)', fontWeight: 700, textTransform: 'uppercase' }}>Sin plantel</div>
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
          </div>

          {error && <div className="lerr" style={{ display: 'flex', marginBottom: 10 }}>{error}</div>}

          <div style={{ overflowX: 'auto' }}>
            <table className="tbl" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  {cfg.columnas.map(c => <th key={c.k}>{c.t}</th>)}
                  <th>{cfg.etiquetaPlantel}</th>
                  <th style={{ width: 70 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cargando && <tr><td colSpan={cfg.columnas.length + 3} style={{ textAlign: 'center', padding: 24 }}>Cargando…</td></tr>}
                {!cargando && filas.length === 0 && (
                  <tr><td colSpan={cfg.columnas.length + 3} style={{ textAlign: 'center', padding: 28, color: 'var(--slate)' }}>
                    {busqueda ? 'Sin resultados para la búsqueda.' : 'Aún no hay registros en esta base.'}
                  </td></tr>
                )}
                {!cargando && filas.map((r, i) => (
                  <tr key={r.id}>
                    <td>{pagina * TAM_PAGINA + i + 1}</td>
                    {cfg.columnas.map(c => (
                      <td key={c.k} className={c.mono ? 'mono' : ''}>{(c.calc ? c.calc(r) : r[c.k]) ?? '—'}</td>
                    ))}
                    <td>{r.plantel ? `${r.plantel.nombre}${r.plantel.amie ? ' · ' + r.plantel.amie : ''}` : '—'}</td>
                    <td><button className="btn btn-ghost btn-sm" title="Eliminar" onClick={() => setBorrar(r)}><span className="ti ti-trash" /></button></td>
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
