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
import { filtrarOficios, filtrarTab, fmtDias, fmtEspera, ordenarPorEspera, resumenOficios, seguimientosDe, TABS } from '../lib/oficiosVista.js';
import { useEstudiantesEmisor } from '../lib/useEstudiantesEmisor.js';
import { useImpresionOficio } from '../lib/useImpresionOficio.js';
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
  const [confirmarLote, setConfirmarLote] = useState(false);       // documento abierto por enlace que no está en la lista

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

  const resumen = useMemo(() => resumenOficios(items), [items]);

  // Pestaña inicial: «Por mi cargo» si hay pendientes; si no, lo propio. Solo la primera vez.
  useEffect(() => {
    if (tab || cargando) return;
    setTab(resumen.porCargo > 0 ? 'por_cargo' : 'mios');
  }, [cargando, tab, resumen.porCargo]);

  const lista = useMemo(() => {
    const base = filtrarOficios(filtrarTab(items, tab || 'mios'), { q: busqueda, tipo, estado, nombreEstudiante: nombreEst });
    return tab === 'por_cargo' ? ordenarPorEspera(base) : base;     // despacho: lo más antiguo primero
  }, [items, tab, busqueda, tipo, estado, nombreEst]);
  useEffect(() => { setSeleccion(new Set()); }, [tab, items]);        // la selección no sobrevive a un cambio de vista o de datos
  const alternar = id => setSeleccion(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const alternarTodos = hab => setSeleccion(s => (hab.every(d => s.has(d.id)) ? new Set() : new Set(hab.map(d => d.id))));
  const cuenta = id => filtrarTab(items, id).length;

  const seleccionado = useMemo(() => items.find(d => d.id === docId) || (extra?.id === docId ? extra : null), [items, docId, extra]);
  useEffect(() => {      // enlace directo a un documento que no está en las primeras 300 filas
    if (!docId || cargando || items.some(d => d.id === docId) || extra?.id === docId) return;
    fetchOficio(docId).then(setExtra).catch(() => { avisar('No se encontró el documento.', 'err'); abrir(null); });
  }, [docId, cargando]); // eslint-disable-line react-hooks/exhaustive-deps

  function abrir(id) {
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
        curso: f.curso || null, paralelo: f.paralelo || null, periodo: f.periodo || null,
        datosPlantilla: { notas: '' }
      });
      setNuevo(false); setTab('mios'); await cargar(); abrir(doc.id); avisar('Borrador creado. Redacta el contenido y envíalo a ruta.');
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

      <div className="ofd-kpis">
        <button type="button" className={'metric m-blue ofd-kpi' + (tab === 'por_cargo' ? ' on' : '')} onClick={() => setTab('por_cargo')}>
          <div className="m-lbl">Por mi cargo</div><div className="m-val">{resumen.porCargo}</div>
          <div className="m-sub">{resumen.porCargo ? `Espera máxima ${fmtEspera(resumen.esperaMaxSeg)}` : 'Nada pendiente'}</div>
        </button>
        <button type="button" className={'metric m-amber ofd-kpi' + (tab === 'mios' && estado === 'observado' ? ' on' : '')} onClick={() => { setTab('mios'); setEstado('observado'); }}>
          <div className="m-lbl">Observados por corregir</div><div className="m-val">{resumen.observadosMios}</div>
          <div className="m-sub">{resumen.observadosMios ? 'Devueltos a ti' : 'Al día'}</div>
        </button>
        <button type="button" className="metric m-teal ofd-kpi" onClick={() => { setTab(tabs.some(t => t.id === 'todos') ? 'todos' : 'mios'); setEstado('en_ruta'); }}>
          <div className="m-lbl">En ruta</div><div className="m-val">{resumen.enRuta}</div>
          <div className="m-sub">{resumen.sobreSla ? `${resumen.sobreSla} sobre la meta de 24 h` : 'Dentro de la meta'}</div>
        </button>
        <div className="metric m-green ofd-kpi">
          <div className="m-lbl">Trámite promedio</div><div className="m-val">{fmtDias(resumen.tramiteMedioDias)}</div>
          <div className="m-sub">{resumen.versionAlta ? `${resumen.versionAlta} con más de 5 versiones` : 'Documentos cerrados'}</div>
        </div>
      </div>

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
          {cargando ? <p className="ofd-muted ofd-pad">Cargando…</p>
            : <OficiosTabla items={lista} seleccionadoId={docId} onSelect={abrir} nombreEst={nombreEst} vacio={vacio}
                seleccion={tab === 'por_cargo' ? seleccion : undefined} onToggle={alternar} onToggleTodos={alternarTodos} />}
        </div>
        {seleccionado && (
          <aside className="ofd-panel">
            <OficioDetalle doc={seleccionado} nombreEst={nombreEst} ocupado={ocupado} onAccion={onAccion} onCerrar={() => abrir(null)}
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
