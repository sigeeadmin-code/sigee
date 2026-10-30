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
import { filtrarOficios, filtrarTab, fmtDias, fmtEspera, resumenOficios, TABS } from '../lib/oficiosVista.js';
import { useEstudiantesEmisor } from '../lib/useEstudiantesEmisor.js';
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
  const [imprimir, setImprimir] = useState(null);
  const [extra, setExtra] = useState(null);       // documento abierto por enlace que no está en la lista

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

  const lista = useMemo(
    () => filtrarOficios(filtrarTab(items, tab || 'mios'), { q: busqueda, tipo, estado, nombreEstudiante: nombreEst }),
    [items, tab, busqueda, tipo, estado, nombreEst]
  );
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
      default: return undefined;
    }
  }

  useEffect(() => {
    if (!imprimir) return undefined;
    document.body.classList.add('imprimiendo-oficio');
    const fin = () => { document.body.classList.remove('imprimiendo-oficio'); setImprimir(null); };
    window.addEventListener('afterprint', fin, { once: true });
    const t = setTimeout(() => window.print(), 200);
    return () => { clearTimeout(t); window.removeEventListener('afterprint', fin); document.body.classList.remove('imprimiendo-oficio'); };
  }, [imprimir]);

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

      <div className="ofd-cuerpo">
        <div className="card ofd-lista">
          {cargando ? <p className="ofd-muted ofd-pad">Cargando…</p>
            : <OficiosTabla items={lista} seleccionadoId={docId} onSelect={abrir} nombreEst={nombreEst} vacio={vacio} />}
        </div>
        {seleccionado && (
          <aside className="ofd-panel">
            <OficioDetalle doc={seleccionado} nombreEst={nombreEst} ocupado={ocupado} onAccion={onAccion} onCerrar={() => abrir(null)} />
          </aside>
        )}
      </div>

      {nuevo && <OficioNuevoModal estudiantes={estudiantes} guardando={ocupado} onCrear={onCrear} onCerrar={() => setNuevo(false)} />}
      {imprimir && seleccionado && <OficioImpresion doc={seleccionado} modo={imprimir} nombreEstudiante={nombreEst(seleccionado.estudiante_id)} institucion={institucion} />}
      {toast && <div className={'toast ' + toast.tipo} role="status">{toast.msg}</div>}
    </div>
  );
}
