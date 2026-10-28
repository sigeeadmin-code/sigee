import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import {
  fetchBandejaNotif, marcarNotifLeidas, fetchAudienciaNotif, fetchEstadisticasNotif, fetchLectoresNotif,
  enviarNotificacionPro, fijarNotificacion, borrarNotificacion
} from '../lib/data.js';
import * as N from '../lib/notificaciones.js';

// ───────────────────────── Piezas de apoyo ─────────────────────────
const fmtN = v => (v === null || v === undefined ? '—' : Number(v).toLocaleString('es-EC'));
const fmtFechaHora = iso => (iso ? new Date(iso).toLocaleString('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const avisarCambio = () => { try { window.dispatchEvent(new CustomEvent('sigee:notif-leidas')); } catch { /* sin efecto */ } };

function Insignia({ prioridad }) {
  const p = N.PRIORIDAD[prioridad] || N.PRIORIDAD.normal;
  return <span className="nt-badge" style={{ color: p.color, background: p.fondo }}><span className={p.icon} />{p.label}</span>;
}
function Esqueleto({ n = 4 }) { return <div>{Array.from({ length: n }).map((_, i) => <div key={i} className="nt-skel" />)}</div>; }
function Vacio({ icono = 'ti ti-bell-off', titulo, children }) {
  return <div className="nt-empty"><span className={icono} /><div className="nt-empty-t">{titulo}</div><div>{children}</div></div>;
}
function Kpi({ icono, titulo, valor, nota, color = 'var(--brand2)' }) {
  return (
    <div className="nt-kpi" style={{ '--c': color }}>
      <span className={'nt-kpi-i ' + icono} />
      <div><div className="nt-kpi-v">{valor}</div><div className="nt-kpi-t">{titulo}</div>{nota && <div className="nt-kpi-n">{nota}</div>}</div>
    </div>
  );
}
function Progreso({ pct, color }) {
  const v = Math.max(0, Math.min(100, Number(pct) || 0));
  return <div className="nt-prog" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}><div style={{ width: v + '%', background: color }} /></div>;
}
function Texto({ texto }) {
  // Texto plano con enlaces http(s) seguros: nunca se inserta HTML.
  return <>{N.partirEnlaces(texto).map((p, i) => p.t === 'enlace'
    ? <a key={i} href={p.v} target="_blank" rel="noopener noreferrer">{p.v}</a>
    : <React.Fragment key={i}>{p.v}</React.Fragment>)}</>;
}
const autorTexto = n => (n.es_mia ? 'Enviada por ti' : (n.autor || N.ETIQUETA_ROL[n.autor_rol] || 'Dirección del plantel'));

function TarjetaNotif({ n, onAbrir, mostrarDestino }) {
  const cat = N.CATEGORIA[n.categoria] || N.CATEGORIA.general; const pr = N.PRIORIDAD[n.prioridad] || N.PRIORIDAD.normal;
  const nueva = !n.leida && !n.es_mia;
  return (
    <div className={'nt-item' + (nueva ? ' nueva' : '')} role="button" tabIndex={0} onClick={() => onAbrir(n)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(n); } }} aria-label={`${nueva ? 'No leída: ' : ''}${n.titulo}`}>
      <span className="nt-bar" style={{ background: n.prioridad === 'normal' ? 'transparent' : pr.color }} />
      <div className="nt-ico" style={{ background: n.prioridad === 'normal' ? 'var(--brand2L)' : pr.fondo, color: n.prioridad === 'normal' ? 'var(--brand2)' : pr.color }}><span className={cat.icon} /></div>
      <div className="nt-body">
        <div className="nt-top">
          <span className="nt-title" style={{ fontWeight: nueva ? 700 : 600 }}>{n.titulo}</span>
          {nueva && <span className="nt-new">Nueva</span>}
          {n.fijada && <span className="ti ti-pin-filled nt-pin" title="Fijada" />}
          <span className="nt-time">{N.tiempoRelativo(n.created_at)}</span>
        </div>
        <div className="nt-ext">{N.extracto(n.cuerpo, 150)}</div>
        <div className="nt-meta">
          <span>{autorTexto(n)}</span><span>·</span><span>{cat.label}</span>
          {n.prioridad !== 'normal' && <Insignia prioridad={n.prioridad} />}
          {mostrarDestino && <span className="nt-dest"><span className="ti ti-users" /> {N.etiquetaDestinatarios(n.para_roles, (n.para_paralelos || []).length)}</span>}
        </div>
      </div>
      {nueva && <span className="nt-dot" aria-hidden="true" />}
    </div>
  );
}

function Modal({ titulo, onClose, children, ancho = 640, pie }) {
  useEffect(() => { const f = e => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={onClose}>
      <div className="modal nt-modal" role="dialog" aria-modal="true" aria-label={titulo} style={{ maxWidth: ancho }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-h"><span className="modal-t">{titulo}</span><button className="btn btn-secondary btn-sm" onClick={onClose} aria-label="Cerrar"><span className="ti ti-x" /></button></div>
        <div className="modal-b">{children}</div>
        {pie && <div className="modal-f">{pie}</div>}
      </div>
    </div>
  );
}

// ───────────────────────── Quién leyó ─────────────────────────
function LectoresModal({ notif, onClose }) {
  const [lista, setLista] = useState(null); const [err, setErr] = useState(''); const [vista, setVista] = useState('sin_leer'); const [q, setQ] = useState('');
  useEffect(() => { let vivo = true; fetchLectoresNotif(notif.id).then(d => vivo && setLista(d || [])).catch(e => vivo && setErr(e.message)); return () => { vivo = false; }; }, [notif.id]);
  const leyeron = (lista || []).filter(x => x.leida_at); const pendientes = (lista || []).filter(x => !x.leida_at);
  const base = vista === 'sin_leer' ? pendientes : leyeron;
  const mostrar = base.filter(x => !q.trim() || x.nombre.toLowerCase().includes(q.trim().toLowerCase()));
  const copiar = async () => { try { await navigator.clipboard.writeText(pendientes.map(x => x.nombre).join('\n')); } catch { /* sin portapapeles */ } };
  return (
    <Modal titulo={`Lectura · ${notif.titulo}`} onClose={onClose} ancho={620}>
      {err && <div className="nt-err">{err}</div>}
      {!lista && !err && <Esqueleto n={5} />}
      {lista && (<>
        <div className="nt-seg" role="tablist">
          <button role="tab" aria-selected={vista === 'sin_leer'} className={vista === 'sin_leer' ? 'on' : ''} onClick={() => setVista('sin_leer')}>Sin leer ({pendientes.length})</button>
          <button role="tab" aria-selected={vista === 'leyeron'} className={vista === 'leyeron' ? 'on' : ''} onClick={() => setVista('leyeron')}>Leyeron ({leyeron.length})</button>
        </div>
        <div style={{ display: 'flex', gap: 8, margin: '10px 0' }}>
          <input className="fc" placeholder="Buscar persona…" value={q} onChange={e => setQ(e.target.value)} style={{ flex: 1 }} />
          {vista === 'sin_leer' && pendientes.length > 0 && <button className="btn btn-secondary btn-sm" onClick={copiar} title="Copiar los nombres para dar seguimiento"><span className="ti ti-copy" /> Copiar</button>}
        </div>
        <div className="nt-lista-lectores">
          {mostrar.length ? mostrar.map((x, i) => (
            <div key={i} className="nt-lector"><span className="nt-av">{(x.nombre[0] || '?').toUpperCase()}</span>
              <div style={{ flex: 1, minWidth: 0 }}><div className="nt-lector-n">{x.nombre}</div><div className="nt-lector-g">{N.ETIQUETA_GRUPO[x.grupo] || x.grupo}</div></div>
              <span className="nt-lector-t">{x.leida_at ? fmtFechaHora(x.leida_at) : 'Pendiente'}</span></div>
          )) : <Vacio icono="ti ti-circle-check" titulo={vista === 'sin_leer' ? '¡Todos la leyeron!' : 'Nadie la ha leído aún'}>{q ? 'Ninguna persona coincide con la búsqueda.' : ''}</Vacio>}
        </div>
      </>)}
    </Modal>
  );
}

// ───────────────────────── Lector de una notificación ─────────────────────────
function LectorModal({ n, rolDb, onClose, onCambio }) {
  const [ocupado, setOcupado] = useState(false); const [err, setErr] = useState(''); const [lectores, setLectores] = useState(false); const [confirmaBorrar, setConfirmaBorrar] = useState(false);
  const cat = N.CATEGORIA[n.categoria] || N.CATEGORIA.general;
  const gestiona = n.es_mia || rolDb === 'admin_plantel' || rolDb === 'super_admin';
  const veLectores = n.es_mia || N.esDireccion(rolDb);
  const fijar = async () => { setOcupado(true); try { await fijarNotificacion(n.id, !n.fijada); onCambio('fijada', { ...n, fijada: !n.fijada }); } catch (e) { setErr(e.message); } setOcupado(false); };
  const borrar = async () => { setOcupado(true); try { await borrarNotificacion(n.id); onCambio('borrada', n); onClose(); } catch (e) { setErr(e.message); setOcupado(false); } };
  return (
    <>
      <Modal titulo="Notificación" onClose={onClose} ancho={680}
        pie={<>
          {veLectores && <button className="btn btn-secondary btn-sm" onClick={() => setLectores(true)}><span className="ti ti-eye-check" /> Quién leyó</button>}
          {gestiona && <button className="btn btn-secondary btn-sm" disabled={ocupado} onClick={fijar}><span className={n.fijada ? 'ti ti-pin-off' : 'ti ti-pin'} /> {n.fijada ? 'Desfijar' : 'Fijar arriba'}</button>}
          {gestiona && !confirmaBorrar && <button className="btn btn-secondary btn-sm" style={{ color: 'var(--red)' }} onClick={() => setConfirmaBorrar(true)}><span className="ti ti-trash" /> Eliminar</button>}
          {gestiona && confirmaBorrar && <button className="btn btn-sm" style={{ background: 'var(--red)', color: '#fff' }} disabled={ocupado} onClick={borrar}>Sí, eliminar</button>}
          <span style={{ flex: 1 }} /><button className="btn btn-primary btn-sm" onClick={onClose}>Cerrar</button>
        </>}>
        <div className="nt-reader-head">
          <div className="nt-ico" style={{ background: 'var(--brand2L)', color: 'var(--brand2)', width: 44, height: 44, fontSize: 20 }}><span className={cat.icon} /></div>
          <div style={{ minWidth: 0 }}>
            <h2 className="nt-reader-t">{n.titulo}</h2>
            <div className="nt-meta"><span>{autorTexto(n)}</span><span>·</span><span>{fmtFechaHora(n.created_at)}</span><span>·</span><span>{cat.label}</span>{n.prioridad !== 'normal' && <Insignia prioridad={n.prioridad} />}{n.fijada && <span className="nt-badge" style={{ color: '#4338ca', background: '#e0e7ff' }}><span className="ti ti-pin-filled" />Fijada</span>}</div>
            {(n.es_mia || N.esDireccion(rolDb)) && <div className="nt-meta" style={{ marginTop: 4 }}><span className="nt-dest"><span className="ti ti-users" /> {N.etiquetaDestinatarios(n.para_roles, (n.para_paralelos || []).length)}</span></div>}
          </div>
        </div>
        <div className="nt-reader-body"><Texto texto={n.cuerpo} /></div>
        {n.expira_at && <div className="nt-reader-foot"><span className="ti ti-clock" /> Visible hasta el {new Date(n.expira_at).toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' })}</div>}
        {err && <div className="nt-err">{err}</div>}
      </Modal>
      {lectores && <LectoresModal notif={n} onClose={() => setLectores(false)} />}
    </>
  );
}

// ───────────────────────── Bandeja ─────────────────────────
function BandejaTab({ institucionId, rolDb, puedeEnviarMsg, onNueva, onConteo }) {
  const [items, setItems] = useState(null); const [err, setErr] = useState('');
  const [filtro, setFiltro] = useState('todas'); const [q, setQ] = useState(''); const [categoria, setCategoria] = useState('');
  const [abierta, setAbierta] = useState(null);
  const cargar = useCallback(async () => { try { setItems(await fetchBandejaNotif(institucionId)); setErr(''); } catch (e) { setErr(e.message); setItems(prev => prev || []); } }, [institucionId]);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    const alAviso = e => { const t = e && e.detail && e.detail.tabla; if (t === 'notificaciones' || t === '*') cargar(); };
    window.addEventListener('sigee:avisos', alAviso);
    const id = setInterval(cargar, 120000);
    return () => { window.removeEventListener('sigee:avisos', alAviso); clearInterval(id); };
  }, [cargar]);
  const conteo = useMemo(() => N.contarBandeja(items), [items]);
  useEffect(() => { if (onConteo) onConteo(conteo); }, [conteo.no_leidas]); // eslint-disable-line react-hooks/exhaustive-deps
  const visibles = useMemo(() => N.filtrarBandeja(items, { filtro, q, categoria }), [items, filtro, q, categoria]);
  const secciones = useMemo(() => N.agruparBandeja(visibles), [visibles]);
  const marcarLocal = ids => setItems(prev => (prev || []).map(x => (ids.includes(x.id) ? { ...x, leida: true, leida_at: x.leida_at || new Date().toISOString() } : x)));
  const abrir = async n => {
    setAbierta(n);
    if (!n.leida && !n.es_mia) { marcarLocal([n.id]); try { await marcarNotifLeidas([n.id]); avisarCambio(); } catch { /* se reintenta al recargar */ } }
  };
  const marcarTodas = async () => {
    const ids = (items || []).filter(x => !x.leida && !x.es_mia).map(x => x.id);
    if (!ids.length) return; marcarLocal(ids);
    try { await marcarNotifLeidas(ids); avisarCambio(); } catch (e) { setErr(e.message); cargar(); }
  };
  const alCambio = (tipo, n) => {
    if (tipo === 'borrada') setItems(prev => (prev || []).filter(x => x.id !== n.id));
    if (tipo === 'fijada') { setItems(prev => (prev || []).map(x => (x.id === n.id ? { ...x, fijada: n.fijada } : x))); setAbierta(n); }
    avisarCambio();
  };
  const filtros = [['todas', 'Todas', conteo.todas], ['no_leidas', 'No leídas', conteo.no_leidas], ['importantes', 'Importantes', conteo.importantes], ['urgentes', 'Urgentes', conteo.urgentes]];
  if (puedeEnviarMsg) filtros.push(['mias', 'Enviadas por mí', conteo.mias]);
  return (
    <div>
      <div className="nt-toolbar">
        <div className="nt-search"><span className="ti ti-search" /><input placeholder="Buscar en tus notificaciones…" value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar" />{q && <button onClick={() => setQ('')} aria-label="Borrar búsqueda"><span className="ti ti-x" /></button>}</div>
        <select className="fc" value={categoria} onChange={e => setCategoria(e.target.value)} aria-label="Categoría" style={{ maxWidth: 180 }}>
          <option value="">Todas las categorías</option>{N.CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <button className="btn btn-secondary btn-sm" onClick={marcarTodas} disabled={!conteo.no_leidas}><span className="ti ti-checks" /> Marcar todas como leídas</button>
      </div>
      <div className="nt-chips" role="tablist" aria-label="Filtros">
        {filtros.map(([id, label, n]) => <button key={id} role="tab" aria-selected={filtro === id} className={'nt-chip' + (filtro === id ? ' on' : '')} onClick={() => setFiltro(id)}>{label}<b>{n}</b></button>)}
      </div>
      {err && <div className="nt-err">{err}</div>}
      {!items ? <Esqueleto n={5} /> : !visibles.length ? (
        items.length === 0
          ? <Vacio icono="ti ti-bell-check" titulo="Todo al día">Aún no tienes notificaciones. Cuando el plantel envíe un comunicado, aparecerá aquí al instante.{puedeEnviarMsg && <div style={{ marginTop: 12 }}><button className="btn btn-primary btn-sm" onClick={onNueva}><span className="ti ti-send" /> Enviar la primera</button></div>}</Vacio>
          : <Vacio icono="ti ti-filter-off" titulo="Sin resultados">Ninguna notificación coincide con los filtros elegidos.<div style={{ marginTop: 10 }}><button className="btn btn-secondary btn-sm" onClick={() => { setFiltro('todas'); setQ(''); setCategoria(''); }}>Quitar filtros</button></div></Vacio>
      ) : secciones.map(s => (
        <section key={s.seccion} className="nt-sec">
          <div className="nt-sec-h">{s.seccion === 'Fijadas' && <span className="ti ti-pin-filled" />}{s.seccion}<span>{s.items.length}</span></div>
          <div className="nt-list">{s.items.map(n => <TarjetaNotif key={n.id} n={n} onAbrir={abrir} mostrarDestino={n.es_mia || N.esDireccion(rolDb)} />)}</div>
        </section>
      ))}
      {abierta && <LectorModal n={abierta} rolDb={rolDb} onClose={() => setAbierta(null)} onCambio={alCambio} />}
    </div>
  );
}

// ───────────────────────── Redactar ─────────────────────────
function SelectorCursos({ cursos, valor, onChange, permitidos }) {
  const visibles = cursos.map(c => ({ ...c, paralelos: permitidos ? c.paralelos.filter(p => permitidos.includes(p.id)) : c.paralelos })).filter(c => c.paralelos.length);
  const todos = visibles.flatMap(c => c.paralelos.map(p => p.id));
  const alternar = id => onChange(valor.includes(id) ? valor.filter(x => x !== id) : [...valor, id]);
  if (!visibles.length) return <div className="nt-hint">{permitidos ? 'No tienes cursos asignados todavía.' : 'Este plantel aún no tiene cursos.'}</div>;
  return (
    <div className="nt-cursos">
      <div className="nt-cursos-acc">
        <button type="button" className="nt-link" onClick={() => onChange(todos)}>Todos los cursos</button><span>·</span>
        <button type="button" className="nt-link" onClick={() => onChange([])}>Ninguno</button>
        <span className="nt-hint" style={{ marginLeft: 'auto' }}>{valor.length ? `${valor.length} seleccionado${valor.length === 1 ? '' : 's'}` : 'Sin elegir = todo el plantel'}</span>
      </div>
      {visibles.map(c => (
        <div key={c.grado.id} className="nt-curso-fila">
          <div className="nt-curso-g">{c.grado.nombre}</div>
          <div className="nt-curso-p">{c.paralelos.map(p => <button type="button" key={p.id} className={'nt-par' + (valor.includes(p.id) ? ' on' : '')} aria-pressed={valor.includes(p.id)} onClick={() => alternar(p.id)}>{p.nombre}</button>)}</div>
        </div>
      ))}
    </div>
  );
}

function RedactarTab({ institucionId, rolDb, profile, data, onEnviada }) {
  const [form, setForm] = useState(N.formularioVacio);
  const [aud, setAud] = useState(null); const [calc, setCalc] = useState(false);
  const [intento, setIntento] = useState(false); const [enviando, setEnviando] = useState(false); const [errEnvio, setErrEnvio] = useState(''); const [confirmar, setConfirmar] = useState(false);
  const set = patch => setForm(f => ({ ...f, ...patch }));
  const esDocente = rolDb === 'docente';
  const cursos = useMemo(() => {
    const grados = (data?.grados || []).slice().sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || String(a.nombre).localeCompare(String(b.nombre)));
    const ids = new Set(grados.map(g => g.id));
    const pars = (data?.paralelos || []).filter(p => ids.has(p.grado_id));
    return grados.map(g => ({ grado: g, paralelos: pars.filter(p => p.grado_id === g.id).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre))) })).filter(c => c.paralelos.length);
  }, [data]);
  const permitidos = useMemo(() => {
    if (!esDocente) return null;
    const yo = (data?.docentes || []).find(d => d.profileId === profile.id);
    const ids = new Set((yo?.cargas || []).map(c => c.paraleloId));
    (data?.paralelos || []).forEach(p => { if (yo && p.tutor_docente_id === yo.id) ids.add(p.id); });
    return [...ids];
  }, [data, esDocente, profile.id]);
  const aplicaCursos = form.todos || form.destinos.some(d => ['docente', 'alumno', 'padre'].includes(d));
  const clave = JSON.stringify([form.todos, form.destinos, aplicaCursos ? form.paralelos : []]);
  useEffect(() => {
    const roles = form.todos ? ['all'] : form.destinos;
    if (!roles.length || !institucionId) { setAud(null); return undefined; }
    let vivo = true;
    const t = setTimeout(async () => {
      setCalc(true);
      try { const d = await fetchAudienciaNotif(roles, aplicaCursos ? form.paralelos : null, institucionId); if (vivo) setAud(d); } catch { if (vivo) setAud(null); }
      if (vivo) setCalc(false);
    }, 450);
    return () => { vivo = false; clearTimeout(t); };
  }, [clave, institucionId]); // eslint-disable-line react-hooks/exhaustive-deps
  const errores = useMemo(() => N.validarFormulario(form, { rolDb, paralelosPermitidos: permitidos }), [form, rolDb, permitidos]);
  const alternarDestino = id => set({ destinos: form.destinos.includes(id) ? form.destinos.filter(x => x !== id) : [...form.destinos, id], todos: false });
  const realEnviar = async () => {
    setEnviando(true); setErrEnvio('');
    try { await enviarNotificacionPro(N.armarNotificacion(form, institucionId)); setForm(N.formularioVacio()); setIntento(false); setAud(null); setConfirmar(false); onEnviada(); }
    catch (e) { setErrEnvio(e.message); setConfirmar(false); }
    setEnviando(false);
  };
  const enviar = () => {
    setIntento(true); setErrEnvio('');
    if (errores.length) return;
    if (N.requiereConfirmacion(form, aud && aud.total)) { setConfirmar(true); return; }
    realEnviar();
  };
  const vista = { id: 'previa', titulo: form.titulo.trim() || 'Título de la notificación', cuerpo: form.cuerpo.trim() || 'Aquí verás cómo se mostrará el mensaje a quienes lo reciban.', prioridad: form.prioridad, categoria: form.categoria,
    fijada: form.fijada, created_at: new Date().toISOString(), es_mia: false, leida: false, autor: 'Tú', para_roles: form.todos ? ['all'] : form.destinos, para_paralelos: aplicaCursos ? form.paralelos : [] };
  const mañana = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (!institucionId) return <Vacio icono="ti ti-building" titulo="Elige un plantel">Selecciona un plantel en la parte superior para enviar notificaciones.</Vacio>;
  return (
    <div className="nt-redactar">
      <div className="nt-form">
        <div className="card"><div className="cb">
          <div className="nt-lbl">Plantillas rápidas <span className="nt-hint">(opcional, puedes editarlas)</span></div>
          <div className="nt-tpl">{N.PLANTILLAS.filter(p => !esDocente || p.destinos.every(d => d === 'alumno' || d === 'padre')).map(p => <button type="button" key={p.id} className="nt-chip" onClick={() => setForm(f => N.aplicarPlantilla(f, p))}><span className={(N.CATEGORIA[p.categoria] || {}).icon} />{p.nombre}</button>)}</div>
        </div></div>

        <div className="card"><div className="cb">
          <label className="nt-lbl" htmlFor="nt-titulo">Título <span className="nt-cnt" style={{ color: form.titulo.length > N.TITULO_MAX ? 'var(--red)' : undefined }}>{form.titulo.length}/{N.TITULO_MAX}</span></label>
          <input id="nt-titulo" className="fc" value={form.titulo} maxLength={N.TITULO_MAX + 20} onChange={e => set({ titulo: e.target.value })} placeholder="Ej.: Reunión de padres de familia" />
          <label className="nt-lbl" htmlFor="nt-cuerpo" style={{ marginTop: 14 }}>Mensaje <span className="nt-cnt" style={{ color: form.cuerpo.length > N.CUERPO_MAX ? 'var(--red)' : undefined }}>{form.cuerpo.length}/{N.CUERPO_MAX}</span></label>
          <textarea id="nt-cuerpo" className="fc" rows={7} value={form.cuerpo} onChange={e => set({ cuerpo: e.target.value })} placeholder="Escribe el comunicado. Los enlaces que empiecen con https:// se podrán abrir con un clic." style={{ resize: 'vertical', lineHeight: 1.5 }} />
        </div></div>

        <div className="card"><div className="cb">
          <div className="nt-lbl">¿A quién va dirigida?</div>
          <div className="nt-dest-grid">
            {!esDocente && <button type="button" className={'nt-dest-btn todos' + (form.todos ? ' on' : '')} aria-pressed={form.todos} onClick={() => set({ todos: !form.todos, destinos: [] })}><span className="ti ti-world" />Todo el plantel</button>}
            {N.gruposPermitidos(rolDb).map(g => <button type="button" key={g.id} className={'nt-dest-btn' + (form.destinos.includes(g.id) ? ' on' : '')} aria-pressed={form.destinos.includes(g.id)} disabled={form.todos} onClick={() => alternarDestino(g.id)}><span className={g.icon} />{g.label}</button>)}
          </div>
          {aplicaCursos && (<>
            <div className="nt-lbl" style={{ marginTop: 16 }}>Cursos {esDocente ? <span className="nt-hint">(solo tus cursos)</span> : <span className="nt-hint">(opcional: limita estudiantes, padres y docentes a estos cursos)</span>}</div>
            <SelectorCursos cursos={cursos} valor={form.paralelos} onChange={v => set({ paralelos: v })} permitidos={permitidos} />
          </>)}
        </div></div>

        <div className="card"><div className="cb">
          <div className="nt-grid2">
            <div><div className="nt-lbl">Prioridad</div>
              <div className="nt-seg">{N.prioridadesPermitidas(rolDb).map(p => <button type="button" key={p.id} className={form.prioridad === p.id ? 'on' : ''} onClick={() => set({ prioridad: p.id })} style={form.prioridad === p.id ? { color: p.color } : undefined}><span className={p.icon} /> {p.label}</button>)}</div></div>
            <div><div className="nt-lbl">Categoría</div>
              <select className="fc" value={form.categoria} onChange={e => set({ categoria: e.target.value })}>{N.categoriasPermitidas(rolDb).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
            <div><div className="nt-lbl">Dejar de mostrar después de <span className="nt-hint">(opcional)</span></div>
              <input type="date" className="fc" min={mañana} value={form.expira} onChange={e => set({ expira: e.target.value })} /></div>
            <label className="nt-check"><input type="checkbox" checked={form.fijada} onChange={e => set({ fijada: e.target.checked })} /><span><b>Fijar arriba</b><span className="nt-hint">Aparece primero en la bandeja.</span></span></label>
          </div>
        </div></div>
      </div>

      <div className="nt-side">
        <div className="nt-sticky">
          <div className="card"><div className="cb">
            <div className="nt-lbl">Así lo verán</div>
            <TarjetaNotif n={vista} onAbrir={() => {}} mostrarDestino />
          </div></div>
          <div className="card"><div className="cb">
            <div className="nt-lbl">Alcance estimado</div>
            {!form.todos && !form.destinos.length ? <div className="nt-hint">Elige los destinatarios para ver a cuántas personas llegará.</div> : (
              <>
                <div className="nt-alc"><span className="nt-alc-n">{calc ? '…' : aud ? fmtN(aud.total) : '—'}</span><span>persona{aud && Number(aud.total) === 1 ? '' : 's'}</span></div>
                {aud && aud.por_grupo && <div className="nt-pills">{Object.entries(aud.por_grupo).map(([g, c]) => <span key={g} className="nt-pill">{N.ETIQUETA_GRUPO[g] || g}: <b>{fmtN(c)}</b></span>)}</div>}
                {aud && Number(aud.total) === 0 && <div className="nt-warn"><span className="ti ti-alert-triangle" /> Nadie recibiría este mensaje con la selección actual.</div>}
              </>
            )}
          </div></div>
          {intento && errores.length > 0 && <div className="nt-err"><b>Revisa antes de enviar:</b><ul>{errores.map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
          {errEnvio && <div className="nt-err">{errEnvio}</div>}
          <button className="btn btn-primary nt-enviar" onClick={enviar} disabled={enviando}>{enviando ? 'Enviando…' : <><span className="ti ti-send" /> Enviar notificación</>}</button>
        </div>
      </div>

      {confirmar && (
        <Modal titulo="Confirmar envío" onClose={() => setConfirmar(false)} ancho={480}
          pie={<><button className="btn btn-secondary btn-sm" onClick={() => setConfirmar(false)}>Revisar</button><span style={{ flex: 1 }} /><button className="btn btn-primary btn-sm" onClick={realEnviar} disabled={enviando}><span className="ti ti-send" /> Sí, enviar ahora</button></>}>
          <p style={{ margin: '0 0 8px' }}>Vas a enviar <b>«{form.titulo.trim()}»</b> a <b>{aud ? fmtN(aud.total) : 'varias'}</b> persona{aud && Number(aud.total) === 1 ? '' : 's'}.</p>
          <div className="nt-meta"><Insignia prioridad={form.prioridad} /><span className="nt-dest"><span className="ti ti-users" /> {N.etiquetaDestinatarios(form.todos ? ['all'] : form.destinos, aplicaCursos ? form.paralelos.length : 0)}</span></div>
          <p className="nt-hint" style={{ marginTop: 10 }}>Llegará de inmediato a quienes estén conectados. Podrás eliminarla después, pero no deshacer que ya fue leída.</p>
        </Modal>
      )}
    </div>
  );
}

// ───────────────────────── Estadísticas ─────────────────────────
function GraficoActividad({ dias }) {
  const W = 720; const H = 230; const L = 36; const R = 10; const T = 14; const B = 30; const n = dias.length || 1;
  const max = Math.max(1, ...dias.map(d => Math.max(Number(d.enviadas) || 0, Number(d.lecturas) || 0)));
  const tope = Math.max(4, Math.ceil(max * 1.15));
  const paso = (W - L - R) / n; const bw = Math.max(3, Math.min(20, paso * 0.6));
  const y = v => T + (H - T - B) * (1 - v / tope); const x = i => L + paso * i + paso / 2;
  const marcas = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(tope * f));
  const cadaX = Math.max(1, Math.ceil(n / 8));
  const puntos = dias.map((d, i) => `${x(i).toFixed(1)},${y(Number(d.enviadas) || 0).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="nt-chart" role="img" aria-label="Notificaciones enviadas y lecturas por día">
      {marcas.map((m, i) => <g key={i}><line x1={L} x2={W - R} y1={y(m)} y2={y(m)} stroke="#e2e8f0" strokeDasharray={i ? '3 4' : undefined} /><text x={L - 6} y={y(m) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{m}</text></g>)}
      {dias.map((d, i) => { const h = (H - T - B) * ((Number(d.lecturas) || 0) / tope); return <rect key={d.dia} x={x(i) - bw / 2} y={H - B - h} width={bw} height={h} rx="2" fill="#2dd4bf" opacity=".85"><title>{`${d.dia}: ${d.lecturas} lecturas · ${d.enviadas} enviadas`}</title></rect>; })}
      <polyline points={puntos} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinejoin="round" />
      {dias.map((d, i) => (Number(d.enviadas) > 0 ? <circle key={d.dia} cx={x(i)} cy={y(Number(d.enviadas))} r="3.5" fill="#6366f1" stroke="#fff" strokeWidth="1.5"><title>{`${d.dia}: ${d.enviadas} enviadas`}</title></circle> : null))}
      {dias.map((d, i) => (i % cadaX === 0 ? <text key={'l' + d.dia} x={x(i)} y={H - 10} textAnchor="middle" fontSize="10" fill="#64748b">{d.dia.slice(8, 10)}/{d.dia.slice(5, 7)}</text> : null))}
    </svg>
  );
}
const BarraDist = ({ filas }) => {
  const total = filas.reduce((a, f) => a + f.valor, 0) || 1;
  return (
    <div>
      <div className="nt-stack">{filas.filter(f => f.valor > 0).map(f => <span key={f.id} style={{ width: (f.valor / total) * 100 + '%', background: f.color }} title={`${f.label}: ${f.valor}`} />)}</div>
      <div className="nt-pills" style={{ marginTop: 8 }}>{filas.map(f => <span key={f.id} className="nt-pill"><i style={{ background: f.color }} />{f.label}: <b>{f.valor}</b></span>)}</div>
    </div>
  );
};

function EstadisticasTab({ institucionId, rolDb }) {
  const [dias, setDias] = useState(30); const [d, setD] = useState(null); const [err, setErr] = useState(''); const [lectores, setLectores] = useState(null);
  const cargar = useCallback(async () => { try { setD(await fetchEstadisticasNotif(institucionId, dias)); setErr(''); } catch (e) { setErr(e.message); } }, [institucionId, dias]);
  useEffect(() => { setD(null); cargar(); }, [cargar]);
  useEffect(() => {
    let t = null;
    const f = () => { clearTimeout(t); t = setTimeout(cargar, 1200); };
    window.addEventListener('sigee:notif-leidas', f); window.addEventListener('sigee:avisos', f);
    return () => { clearTimeout(t); window.removeEventListener('sigee:notif-leidas', f); window.removeEventListener('sigee:avisos', f); };
  }, [cargar]);
  if (!institucionId) return <Vacio icono="ti ti-building" titulo="Elige un plantel">Selecciona un plantel para ver sus estadísticas.</Vacio>;
  const r = d && d.resumen; const estado = N.estadoLectura(r ? r.tasa_lectura : null);
  const prio = d ? N.PRIORIDADES.map(p => ({ id: p.id, label: p.label, color: p.color, valor: Number((d.por_prioridad || {})[p.id]) || 0 })) : [];
  const cats = d ? N.CATEGORIAS.map((c, i) => ({ id: c.id, label: c.label, color: ['#6366f1', '#0891b2', '#f59e0b', '#64748b', '#10b981', '#ef4444'][i], valor: Number((d.por_categoria || {})[c.id]) || 0 })) : [];
  return (
    <div>
      <div className="nt-toolbar">
        <div className="nt-hint" style={{ flex: 1 }}>{d && d.alcance === 'propias' ? 'Estadísticas de las notificaciones que tú enviaste.' : 'Estadísticas de las notificaciones enviadas en el plantel.'}</div>
        <select className="fc" value={dias} onChange={e => setDias(Number(e.target.value))} style={{ maxWidth: 170 }} aria-label="Período">{[7, 14, 30, 60, 90, 180].map(x => <option key={x} value={x}>Últimos {x} días</option>)}</select>
        <button className="btn btn-secondary btn-sm" onClick={cargar}><span className="ti ti-refresh" /> Actualizar</button>
      </div>
      {err && <div className="nt-err">{err}</div>}
      {!d && !err && <Esqueleto n={4} />}
      {d && (<>
        {r.sin_leer_48h > 0 && <div className="nt-warn" style={{ marginBottom: 12 }}><span className="ti ti-alert-triangle" /> <b>{r.sin_leer_48h}</b> notificación{r.sin_leer_48h === 1 ? '' : 'es'} con menos de la mitad de lectura después de 48 horas. Revisa la tabla de abajo y da seguimiento a quienes no la han leído.</div>}
        <div className="nt-kpis">
          <Kpi icono="ti ti-send" titulo="Enviadas" valor={fmtN(r.enviadas)} nota={`${r.urgentes} urgentes · ${r.importantes} importantes`} color="#6366f1" />
          <Kpi icono="ti ti-users" titulo="Personas alcanzadas" valor={fmtN(r.destinatarios)} nota="suma de destinatarios" color="#0891b2" />
          <Kpi icono="ti ti-eye-check" titulo="Tasa de lectura" valor={r.tasa_lectura === null ? '—' : r.tasa_lectura + ' %'} nota={estado.texto} color={estado.color} />
          <Kpi icono="ti ti-clock-hour-4" titulo="Tiempo medio hasta leer" valor={r.horas_medias_lectura === null ? '—' : `${r.horas_medias_lectura} h`} nota="desde el envío" color="#f59e0b" />
          <Kpi icono="ti ti-mail-opened" titulo="Pendientes de leer" valor={fmtN(Math.max(0, r.destinatarios - r.lecturas))} nota={`${fmtN(r.lecturas)} lecturas registradas`} color="#ef4444" />
        </div>
        <div className="card nt-card"><div className="cb">
          <div className="nt-card-h"><b>Actividad por día</b><span className="nt-leyenda"><i style={{ background: '#6366f1' }} />Enviadas<i style={{ background: '#2dd4bf' }} />Lecturas</span></div>
          {Number(r.enviadas) === 0 && Number(r.lecturas) === 0 ? <Vacio icono="ti ti-chart-bar-off" titulo="Sin actividad en este período">Envía una notificación para empezar a ver estadísticas.</Vacio> : <GraficoActividad dias={d.por_dia || []} />}
        </div></div>
        <div className="nt-grid2 nt-gap">
          <div className="card nt-card"><div className="cb">
            <div className="nt-card-h"><b>Lectura por grupo</b></div>
            {(d.por_grupo || []).length ? (d.por_grupo || []).map(gr => { const e = N.estadoLectura(gr.tasa); return (
              <div key={gr.grupo} className="nt-fila-g"><div className="nt-fila-t"><span>{N.ETIQUETA_GRUPO[gr.grupo] || gr.grupo}</span><span><b style={{ color: e.color }}>{gr.tasa === null ? '—' : gr.tasa + ' %'}</b> <span className="nt-hint">{fmtN(gr.lecturas)} de {fmtN(gr.destinatarios)}</span></span></div><Progreso pct={gr.tasa} color={e.color} /></div>); })
              : <div className="nt-hint">Aún no hay lecturas que mostrar.</div>}
          </div></div>
          <div className="card nt-card"><div className="cb">
            <div className="nt-card-h"><b>Cómo se reparten</b></div>
            <div className="nt-lbl">Por prioridad</div><BarraDist filas={prio} />
            <div className="nt-lbl" style={{ marginTop: 16 }}>Por categoría</div><BarraDist filas={cats} />
          </div></div>
        </div>
        <div className="card nt-card"><div className="cb" style={{ padding: 0 }}>
          <div className="nt-card-h" style={{ padding: '14px 16px 8px' }}><b>Detalle de lo enviado</b><span className="nt-hint">Toca una fila para ver quién leyó</span></div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data" style={{ minWidth: 720 }}>
              <thead><tr><th>Notificación</th><th>Fecha</th><th>Destino</th><th style={{ textAlign: 'right' }}>Destinatarios</th><th style={{ width: 190 }}>Lectura</th></tr></thead>
              <tbody>{(d.notificaciones || []).length ? d.notificaciones.map(n => { const e = N.estadoLectura(n.tasa); return (
                <tr key={n.id} className="nt-row" onClick={() => setLectores(n)} tabIndex={0} onKeyDown={ev => { if (ev.key === 'Enter') setLectores(n); }}>
                  <td><div style={{ fontWeight: 600 }}>{n.titulo}</div><div className="nt-meta">{n.prioridad !== 'normal' && <Insignia prioridad={n.prioridad} />}<span>{(N.CATEGORIA[n.categoria] || {}).label}</span>{n.autor && rolDb !== 'docente' && <><span>·</span><span>{n.autor}</span></>}</div></td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtFechaHora(n.created_at)}</td>
                  <td>{N.etiquetaDestinatarios(n.para_roles, (n.para_paralelos || []).length)}</td>
                  <td style={{ textAlign: 'right' }}>{fmtN(n.destinatarios)}</td>
                  <td><div className="nt-fila-t"><b style={{ color: e.color }}>{n.tasa === null ? '—' : n.tasa + ' %'}</b><span className="nt-hint">{fmtN(n.leidas)}/{fmtN(n.destinatarios)}</span></div><Progreso pct={n.tasa} color={e.color} /></td>
                </tr>); }) : <tr><td colSpan={5}><Vacio icono="ti ti-send-off" titulo="Todavía no enviaste notificaciones en este período" /></td></tr>}</tbody>
            </table>
          </div>
        </div></div>
      </>)}
      {lectores && <LectoresModal notif={lectores} onClose={() => setLectores(null)} />}
    </div>
  );
}

// ───────────────────────── Página ─────────────────────────
const SUBTITULO = { Notificaciones: 'Comunicación oficial del plantel, en tiempo real.', Anuncios: 'Avisos de tus cursos y del plantel.', Comunicados: 'Comunicados del plantel para ti y tu familia.' };
export default function Notificaciones({ title = 'Notificaciones' }) {
  const { profile, institucion, data } = useSession();
  const rolDb = profile.rolDb; const institucionId = institucion?.id || null;
  const puedeEnviarMsg = N.puedeEnviar(rolDb); const verStats = N.puedeVerEstadisticas(rolDb);
  const [tab, setTab] = useState('bandeja'); const [conteo, setConteo] = useState({ no_leidas: 0 }); const [okEnvio, setOkEnvio] = useState(false);
  const tabs = [['bandeja', 'Bandeja', 'ti ti-inbox']];
  if (puedeEnviarMsg) tabs.push(['redactar', 'Redactar', 'ti ti-pencil-plus']);
  if (verStats) tabs.push(['estadisticas', 'Enviadas y estadísticas', 'ti ti-chart-bar']);
  useEffect(() => { if (!okEnvio) return undefined; const t = setTimeout(() => setOkEnvio(false), 6000); return () => clearTimeout(t); }, [okEnvio]);
  return (
    <div className="nt-page">
      <div className="nt-hero">
        <div>
          <div className="nt-hero-k"><span className="ti ti-bell-ringing" /> {title}</div>
          <h1>{SUBTITULO[title] || SUBTITULO.Notificaciones}</h1>
          <div className="nt-hero-s">{conteo.no_leidas > 0 ? <><b>{conteo.no_leidas}</b> sin leer</> : 'Estás al día'}{institucion?.nombre ? <> · {institucion.nombre}</> : null}</div>
        </div>
        {puedeEnviarMsg && tab !== 'redactar' && <button className="nt-hero-btn" onClick={() => setTab('redactar')}><span className="ti ti-send" /> Nueva notificación</button>}
      </div>
      {tabs.length > 1 && <div className="nt-tabs" role="tablist">{tabs.map(([id, label, icono]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}><span className={icono} />{label}</button>)}</div>}
      {okEnvio && <div className="nt-ok" role="status"><span className="ti ti-circle-check" /> Notificación enviada. Ya está llegando a sus destinatarios.</div>}
      {!institucionId && tab === 'bandeja'
        ? <Vacio icono="ti ti-building" titulo="Elige un plantel">Selecciona un plantel en la parte superior para ver sus notificaciones.</Vacio>
        : tab === 'bandeja'
          ? <BandejaTab institucionId={institucionId} rolDb={rolDb} puedeEnviarMsg={puedeEnviarMsg} onNueva={() => setTab('redactar')} onConteo={setConteo} />
          : tab === 'redactar' ? <RedactarTab institucionId={institucionId} rolDb={rolDb} profile={profile} data={data} onEnviada={() => { setOkEnvio(true); setTab(verStats ? 'estadisticas' : 'bandeja'); }} />
            : <EstadisticasTab institucionId={institucionId} rolDb={rolDb} />}
    </div>
  );
}
