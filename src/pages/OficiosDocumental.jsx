/**
 * SIGEE · Oficios y tráfico documental.
 * Página delgada: orquesta estado y llamadas; la presentación vive en src/components/oficios/*
 * y la lógica pura en src/lib/oficiosVista.js (con pruebas). Los permisos los decide el servidor.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSession } from '../lib/SessionContext.jsx';
import {
  fetchOficiosBandeja, fetchOficio, crearBorradorOficio, enviarOficio, aprobarPasoOficio, observarOficio,
  corregirOficio, registrarEntregaOficio, archivarOficio, rechazarOficio, eliminarBorradorOficio, guardarBorradorOficio,
  TIPOS_DOCUMENTO, ESTADOS
} from '../lib/oficiosDocumental.js';
import { cargaPorEstado, cargosEnCola, filtrarCola, filtrarOficios, filtrarTab, ordenarPorEspera, relacionados, resumenDespacho, resumenEmisor, seguimientosDe, TABS } from '../lib/oficiosVista.js';
import { useEstudiantesEmisor } from '../lib/useEstudiantesEmisor.js';
import { useImpresionOficio } from '../lib/useImpresionOficio.js';
import { armarDocumentoOficio, tieneConstructor } from '../lib/documentoOficio.js';
import { TableroDespacho, TableroEmisor, TableroTodos } from '../components/oficios/OficiosTableros.jsx';
import { ColumnasMenu, useColumnas } from '../components/oficios/OficiosTabla.jsx';
import { etiquetaCargo } from '../lib/oficiosDocumental.js';
import OficiosTabla from '../components/oficios/OficiosTabla.jsx';
import OficioDetalle from '../components/oficios/OficioDetalle.jsx';
import OficioNuevoModal from '../components/oficios/OficioNuevoModal.jsx';
import OficioImpresion from '../components/oficios/OficioImpresion.jsx';

const VEN_TODO = ['admin_plantel', 'secretario', 'inspector_general', 'supervisor_plantel', 'supervisor_general', 'administrativo', 'contador_plantel', 'super_admin'];

export default function OficiosDocumental() {
  const { profile, institucion, data } = useSession();
  const institucionId = institucion?.id;
  const esSuper = profile?.rolDb === 'super_admin';
  const estudiantes = useEstudiantesEmisor({ profile, institucionId, estudiantesPlantel: data?.estudiantes });
  const [params, setParams] = useSearchParams();
  const docId = params.get('doc');

  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [tipo, setTipo] = useState('');
  const [estado, setEstado] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [toast, setToast] = useState(null);
  const [nuevo, setNuevo] = useState(false);
  const { modo: imprimir, imprimir: setImprimir } = useImpresionOficio();
  const [extra, setExtra] = useState(null);
  const [seleccion, setSeleccion] = useState(() => new Set());
  const [confirmarLote, setConfirmarLote] = useState(false);
  const [inicial, setInicial] = useState({ visor: false, pestana: 'documento', accion: null });       // documento abierto por enlace que no está en la lista

  const tabs = useMemo(() => TABS.filter(t => t.id !== 'todos' || VEN_TODO.includes(profile?.rolDb)), [profile?.rolDb]);

  const nombreEst = useCallback(id => {
    if (!id) return '—';
    return estudiantes.find(e => e.id === id)?.nombre || (data?.estudiantes || []).find(e => e.id === id)?.nombre || 'Estudiante';
  }, [estudiantes, data?.estudiantes]);

  const avisar = (msg, tipoT = 'ok') => setToast({ msg, tipo: tipoT });
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 3800); return () => clearTimeout(t); }, [toast]);

  const cargar = useCallback(async () => {
    if (!institucionId && !esSuper) return;
    try { setItems(await fetchOficiosBandeja('todos')); }
    catch (e) { avisar(e.message || 'No se pudo cargar la bandeja.', 'err'); }
    setCargando(false);
  }, [institucionId, esSuper]);
  useEffect(() => { cargar(); }, [cargar]);

  const resEmisor = useMemo(() => resumenEmisor(items), [items]);
  const resDespacho = useMemo(() => resumenDespacho(items, profile?.id), [items, profile?.id]);
  const enCola = useMemo(() => cargosEnCola(items), [items]);
  const [columnas, alternarColumna] = useColumnas();
  const [cargoCola, setCargoCola] = useState('');
  const [modoCola, setModoCola] = useState('todos');

  // Pestaña inicial: «Por mi cargo» si hay pendientes; si no, lo propio. Solo la primera vez.
  useEffect(() => {
    if (tab || cargando) return;
    setTab(resDespacho.pendientes.n > 0 ? 'por_cargo' : 'mios');
  }, [cargando, tab, resDespacho.pendientes.n]);

  const lista = useMemo(() => {
    let base = filtrarOficios(filtrarTab(items, tab || 'mios'), { q: busqueda, tipo, estado, nombreEstudiante: nombreEst });
    if (tab === 'por_cargo') base = ordenarPorEspera(filtrarCola(base, { cargo: cargoCola, modo: modoCola }));   // despacho: lo más antiguo primero
    return base;
  }, [items, tab, busqueda, tipo, estado, nombreEst, cargoCola, modoCola]);
  const cedulaEst = useCallback(id => estudiantes.find(e => e.id === id)?.cedula || (data?.estudiantes || []).find(e => e.id === id)?.cedula || '', [estudiantes, data?.estudiantes]);
  useEffect(() => { setSeleccion(new Set()); }, [tab, items]);        // la selección no sobrevive a un cambio de vista o de datos
  const alternar = id => setSeleccion(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const alternarTodos = hab => setSeleccion(s => (hab.every(d => s.has(d.id)) ? new Set() : new Set(hab.map(d => d.id))));
  const cuenta = id => filtrarTab(items, id).length;

  const seleccionado = useMemo(() => items.find(d => d.id === docId) || (extra?.id === docId ? extra : null), [items, docId, extra]);
  useEffect(() => {      // enlace directo a un documento que no está en las primeras 300 filas
    if (!docId || cargando || items.some(d => d.id === docId) || extra?.id === docId) return;
    fetchOficio(docId).then(setExtra).catch(() => { avisar('No se encontró el documento.', 'err'); abrir(null); });
  }, [docId, cargando]); // eslint-disable-line react-hooks/exhaustive-deps

  function abrir(id, opciones = {}) {
    setInicial({ visor: !!opciones.visor, pestana: opciones.pestana || 'documento', accion: opciones.accion || null });
    const p = new URLSearchParams(params);
    if (id) p.set('doc', id); else p.delete('doc');
    setParams(p, { replace: !!id === !!docId });
  }

  async function ejecutar(fn, ok) {
    setOcupado(true);
    try { const r = await fn(); await cargar(); if (ok) avisar(ok); return r; }
    catch (e) { avisar(e.message || 'No se pudo completar la acción.', 'err'); return null; }
    finally { setOcupado(false); }
  }

  function decidir(id, que) {
    if (que === 'aprobar') { setSeleccion(new Set([id])); setConfirmarLote(true); return; }
    abrir(id, { accion: que });
  }

  async function aprobarLote() {
    const ids = [...seleccion]; let ok = 0; const fallos = [];
    setOcupado(true); setConfirmarLote(false);
    for (const id of ids) {
      try { await aprobarPasoOficio(id); ok++; } catch (e) { fallos.push(e.message); }
    }
    await cargar(); setOcupado(false);
    if (fallos.length) avisar(`${ok} aprobados, ${fallos.length} no se pudieron aprobar: ${fallos[0]}`, 'warn'); else avisar(`${ok} documento(s) aprobados.`);
  }

  async function onCrear(f) {
    setOcupado(true);
    try {
      const doc = await crearBorradorOficio({
        institucionId, tipo: f.tipo, titulo: f.titulo.trim(), estudianteId: f.estudiante?.id || null,
        curso: f.curso || null, paralelo: f.paralelo || null, periodo: f.periodo || null, asunto: f.titulo.trim(),
        datosPlantilla: { notas: '' }
      });
      // Hoja oficial con las notas reales del estudiante (mismos constructores de las fichas de SIGEE)
      let aviso = 'Borrador creado con su hoja oficial. Revísala y envíala a ruta.';
      try {
        const tutorNombre = profile?.rolDb === 'docente' ? `${profile?.apellidos || ''} ${profile?.nombres || ''}`.trim() : '';
        const est = f.estudiante ? { ...f.estudiante, curso: f.curso || f.estudiante.curso, paralelo: f.paralelo || '' } : { nombre: '', curso: f.curso, paralelo: f.paralelo };
        const { documento, notas } = await armarDocumentoOficio({
          tipo: f.tipo, estudiante: est, institucion, trimestre: f.trimestre, numero: doc.numero, titulo: f.titulo.trim(), asunto: f.titulo.trim(), tutorNombre
        });
        await guardarBorradorOficio(doc.id, { datos_plantilla: { documento, notas } });
        if (tieneConstructor(f.tipo) && !f.estudiante) aviso = 'Borrador creado. Elige un estudiante para que la hoja traiga sus notas.';
      } catch (e) { aviso = 'Borrador creado, pero no se pudo armar la hoja con las notas: ' + (e.message || 'error'); }
      setNuevo(false); setTab('mios'); await cargar(); abrir(doc.id); avisar(aviso);
    } catch (e) { avisar(e.message || 'No se pudo crear.', 'err'); }
    setOcupado(false);
  }

  function onAccion(nombre, a, b) {
    const d = seleccionado; if (!d) return undefined;
    switch (nombre) {
      case 'guardar': return ejecutar(() => guardarBorradorOficio(d.id, a), 'Borrador guardado.');
      case 'enviar': return ejecutar(async () => { if (b) await guardarBorradorOficio(d.id, a); return enviarOficio(d.id); }, 'Documento enviado a ruta.');
      case 'aprobar': return ejecutar(() => aprobarPasoOficio(d.id), 'Paso aprobado.');
      case 'observar': return ejecutar(() => observarOficio(d.id, a), 'Documento devuelto al emisor.');
      case 'rechazar': return ejecutar(() => rechazarOficio(d.id, a), 'Documento rechazado.');
      case 'corregir': return ejecutar(async () => { await corregirOficio(d.id, { datosPlantilla: a.datos_plantilla, titulo: a.titulo, asunto: a.asunto }); return enviarOficio(d.id); }, 'Corregido y reenviado a ruta.');
      case 'entregar': return ejecutar(() => registrarEntregaOficio(d.id, a), 'Entrega registrada.');
      case 'archivar': return ejecutar(() => archivarOficio(d.id), 'Documento archivado.');
      case 'eliminar':
        if (!window.confirm('¿Eliminar este borrador? No se puede deshacer.')) return undefined;
        return ejecutar(async () => { await eliminarBorradorOficio(d.id); abrir(null); }, 'Borrador eliminado.');
      case 'imprimir': return setImprimir(a);
      case 'seguimiento': return ejecutar(async () => {
        const h = await crearBorradorOficio({
          institucionId, tipo: 'informe_seguimiento', titulo: `Seguimiento · ${d.titulo}`.slice(0, 160), estudianteId: d.estudiante_id,
          curso: d.curso, paralelo: d.paralelo, periodo: d.periodo, datosPlantilla: { notas: '' }, documentoOrigenId: d.id
        });
        setTab('mios'); abrir(h.id);
      }, 'Seguimiento creado como borrador, enlazado al documento de origen.');
      default: return undefined;
    }
  }

  if (!institucionId && !esSuper) {
    return <div className="empty"><span className="ti ti-building" /><p>Selecciona un plantel para ver los oficios.</p></div>;
  }

  const vacio = tab === 'por_cargo' ? 'No tienes documentos pendientes de decisión.' : busqueda || tipo || estado ? 'Ningún documento coincide con los filtros.' : 'Aún no hay documentos.';

  return (
    <div className={'ofd' + (seleccionado ? ' ofd-con-detalle' : '')}>
      <div className="ofd-cab">
        <div>
          <h2>Oficios y tráfico documental</h2>
          <p className="ofd-sub">Un caso, un documento, un PDF por versión de contenido.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setNuevo(true)}><span className="ti ti-plus" /> Nuevo documento</button>
      </div>

      {!cargando && tab === 'mios' && <TableroEmisor r={resEmisor} onAbrir={id => abrir(id)} onEstado={e => setEstado(estado === e ? '' : e)} />}
      {!cargando && tab === 'por_cargo' && <TableroDespacho r={resDespacho} onAbrir={id => abrir(id)} />}
      {!cargando && tab === 'todos' && <TableroTodos carga={cargaPorEstado(items)} total={items.length} />}

      <div className="tabs ofd-tabs" role="tablist">
        {tabs.map(t => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={'tab' + (tab === t.id ? ' on' : '')} onClick={() => setTab(t.id)}>
            {t.label} <span className={'ofd-cuenta' + (t.id === 'por_cargo' && cuenta('por_cargo') ? ' ofd-cuenta-on' : '')}>{cuenta(t.id)}</span>
          </button>
        ))}
      </div>

      <div className="ofd-filtros">
        <div className="ofd-buscar"><span className="ti ti-search" aria-hidden="true" />
          <input className="fc" type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por N°, estudiante o asunto" aria-label="Buscar documentos" /></div>
        <select className="fc" value={tipo} onChange={e => setTipo(e.target.value)} aria-label="Tipo de documento">
          <option value="">Todos los tipos</option>{Object.entries(TIPOS_DOCUMENTO).map(([k, v]) => <option key={k} value={k}>{v.nombre}</option>)}</select>
        <select className="fc" value={estado} onChange={e => setEstado(e.target.value)} aria-label="Estado">
          <option value="">Todos los estados</option>{Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        <ColumnasMenu vis={columnas} onAlternar={alternarColumna} />
        {(busqueda || tipo || estado) && <button className="btn btn-ghost" onClick={() => { setBusqueda(''); setTipo(''); setEstado(''); }}>Limpiar</button>}
      </div>

      {tab === 'por_cargo' && seleccion.size > 0 && (
        <div className="ofd-lote" role="region" aria-label="Acciones en lote">
          <strong>{seleccion.size} seleccionado(s)</strong>
          <span><button className="btn btn-ghost btn-sm" onClick={() => setSeleccion(new Set())}>Quitar selección</button>{' '}
            <button className="btn btn-success btn-sm" disabled={ocupado} onClick={() => setConfirmarLote(true)}>Aprobar seleccionados</button></span>
        </div>
      )}

      <div className="ofd-cuerpo">
        <div className="card ofd-lista">
          {tab === 'por_cargo' && !cargando && (
            <div className="ofd-cola-h">
              <div><h3>Cola de despacho</h3><p className="ofd-sub">Ordenada por tiempo de espera</p></div>
              {enCola.length > 0 && (
                <div className="ofd-pills" role="group" aria-label="Cargo">
                  <button type="button" className="ofd-pill" aria-pressed={!cargoCola} onClick={() => setCargoCola('')}>Todos <span className="ofd-cuenta">{enCola.reduce((a, c) => a + c.n, 0)}</span></button>
                  {enCola.map(c => <button key={c.cargo} type="button" className="ofd-pill" aria-pressed={cargoCola === c.cargo} onClick={() => setCargoCola(c.cargo)}>{etiquetaCargo(c.cargo)} <span className="ofd-cuenta">{c.n}</span></button>)}
                </div>
              )}
              {resDespacho.pendientes.masDe48 > 0 && <div className="ofd-banner" role="alert"><span className="ti ti-alert-triangle" /> {resDespacho.pendientes.masDe48} {resDespacho.pendientes.masDe48 === 1 ? 'documento supera' : 'documentos superan'} las 48 horas en tu despacho. Prioriza los de mayor espera.</div>}
              <div className="ofd-seg" role="group" aria-label="Filtrar la cola">
                {[['todos', 'Todos'], ['vencidos', 'Vencidos'], ['reenviados', 'Reenviados']].map(([k, t]) => <button key={k} type="button" aria-pressed={modoCola === k} onClick={() => setModoCola(k)}>{t}</button>)}
              </div>
            </div>
          )}
          {cargando ? <p className="ofd-muted ofd-pad">Cargando…</p>
            : <OficiosTabla items={lista} seleccionadoId={docId} onSelect={abrir} nombreEst={nombreEst} cedulaEst={cedulaEst} columnas={columnas} vacio={vacio} onDecidir={tab === 'por_cargo' ? decidir : undefined}
                onVer={id => abrir(id, { visor: true })} onRecorrido={id => abrir(id, { pestana: 'recorrido' })}
                seleccion={tab === 'por_cargo' ? seleccion : undefined} onToggle={alternar} onToggleTodos={alternarTodos} />}
        </div>
        {seleccionado && (
          <aside className="ofd-panel">
            <OficioDetalle doc={seleccionado} nombreEst={nombreEst} ocupado={ocupado} onAccion={onAccion} onCerrar={() => abrir(null)}
              institucion={institucion} abrirVisor={inicial.visor} pestanaInicial={inicial.pestana} modoInicial={inicial.accion} relacionados={relacionados(items, seleccionado)} onVisorAbierto={() => setInicial(i => ({ ...i, visor: false }))}
              seguimientos={seguimientosDe(items, seleccionado.id)} origen={items.find(d => d.id === seleccionado.documento_origen_id) || null} onAbrir={abrir} />
          </aside>
        )}
      </div>

      {confirmarLote && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setConfirmarLote(false); }}>
          <div className="modal ofd-modal" role="dialog" aria-modal="true" aria-labelledby="ofd-lote-t">
            <div className="modal-h"><h3 id="ofd-lote-t">Aprobar {seleccion.size} documento(s)</h3></div>
            <div className="modal-b">
              <p className="ofd-sub">Cada aprobación queda registrada con tu nombre y la hora en el recorrido. Revisa la lista antes de confirmar.</p>
              <ul className="ofd-lista-sim">
                {items.filter(d => seleccion.has(d.id)).map(d => <li key={d.id}><span className="ofd-num">{d.numero}</span><span>{d.titulo}</span></li>)}
              </ul>
            </div>
            <div className="modal-f">
              <button className="btn btn-secondary" onClick={() => setConfirmarLote(false)}>Cancelar</button>
              <button className="btn btn-success" onClick={aprobarLote}>Aprobar todos</button>
            </div>
          </div>
        </div>
      )}
      {nuevo && <OficioNuevoModal estudiantes={estudiantes} guardando={ocupado} onCrear={onCrear} onCerrar={() => setNuevo(false)} />}
      {imprimir && seleccionado && <OficioImpresion doc={seleccionado} modo={imprimir} nombreEstudiante={nombreEst(seleccionado.estudiante_id)} institucion={institucion} />}
      {toast && <div className={'toast ' + toast.tipo} role="status">{toast.msg}</div>}
    </div>
  );
}
