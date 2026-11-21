import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { API_URL } from '../lib/data.js';
import { ESTADOS_DEMO, linkActivacion, diasRestantes, whatsappUrl, mailtoUrl, mensajeBienvenida, mensajeCredenciales } from '../lib/demoAdmin.js';

const CUPO = 50;
const FILTROS = [
  ['todas', 'Todas'], ['pendientes', 'Por entregar'], ['activas', 'Activas'], ['vencidas', 'Vencidas'], ['expiradas', 'Link vencido']
];
const fmt = (d) => d ? new Date(d).toLocaleString('es-EC', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

function avisarMenu() { try { window.dispatchEvent(new Event('sigee:demos')); } catch { /* sin efecto */ } }

export default function DemosAdmin() {
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState('todas');
  const [buscar, setBuscar] = useState('');
  const [ocupado, setOcupado] = useState('');
  const [aviso, setAviso] = useState('');
  const [msg, setMsg] = useState(null);       // { fila, link, whatsapp, asunto, cuerpo }
  const [cred, setCred] = useState(null);     // { fila, cuentas, url, texto }

  const cargar = useCallback(async () => {
    setError('');
    const { data, error: e } = await supabase.rpc('demo_listar');
    if (e) { setError('No se pudieron cargar las solicitudes: ' + e.message); setCargando(false); return; }
    setFilas(Array.isArray(data) ? data : []);
    setCargando(false);
  }, []);
  useEffect(() => { cargar(); const id = setInterval(cargar, 60000); return () => clearInterval(id); }, [cargar]);

  const conteo = useMemo(() => {
    const c = { pendientes: 0, activas: 0, vencidas: 0, expiradas: 0 };
    for (const f of filas) {
      if (f.estado === 'pendiente_confirmacion') c.pendientes++;
      else if (['confirmado', 'activo'].includes(f.estado)) c.activas++;
      else if (['vencido', 'bloqueado'].includes(f.estado)) c.vencidas++;
      else if (f.estado === 'expirada') c.expiradas++;
    }
    return c;
  }, [filas]);

  const visibles = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return filas.filter(f => {
      const okF = filtro === 'todas' || (filtro === 'pendientes' && f.estado === 'pendiente_confirmacion')
        || (filtro === 'activas' && ['confirmado', 'activo'].includes(f.estado))
        || (filtro === 'vencidas' && ['vencido', 'bloqueado'].includes(f.estado)) || (filtro === 'expiradas' && f.estado === 'expirada');
      if (!okF) return false;
      return !q || [f.nombre_completo, f.email, f.empresa, f.cedula, f.telefono].some(v => String(v || '').toLowerCase().includes(q));
    });
  }, [filas, filtro, buscar]);

  const abrirMensaje = (fila, token) => {
    const link = linkActivacion(window.location.origin, token);
    const m = mensajeBienvenida({ nombre: fila.nombre_completo, institucion: fila.empresa, link });
    setMsg({ fila, link, whatsapp: m.whatsapp, asunto: m.asunto, cuerpo: m.cuerpoCorreo });
  };
  const generarLink = async (fila) => {
    setOcupado(fila.id); setAviso('');
    const { data: token, error: e } = await supabase.rpc('demo_generar_link', { p_solicitud: fila.id });
    setOcupado('');
    if (e) { setAviso('No se pudo generar el link: ' + e.message); return; }
    avisarMenu(); await cargar(); abrirMensaje(fila, token);
  };
  const extender = async (fila) => {
    setOcupado(fila.id); setAviso('');
    const { error: e } = await supabase.rpc('demo_extender', { p_solicitud: fila.id, p_dias: 5 });
    setOcupado(''); if (e) { setAviso('No se pudo extender: ' + e.message); return; }
    setAviso('Demostración extendida 5 días.'); await cargar();
  };
  const bloquear = async (fila) => {
    if (!window.confirm(`¿Bloquear la demostración de ${fila.nombre_completo}? Perderá el acceso de inmediato.`)) return;
    setOcupado(fila.id); setAviso('');
    const { error: e } = await supabase.rpc('demo_bloquear', { p_solicitud: fila.id });
    setOcupado(''); if (e) { setAviso('No se pudo bloquear: ' + e.message); return; }
    setAviso('Demostración bloqueada.'); await cargar();
  };
  const restablecer = async (fila) => {
    if (!window.confirm('Se generarán contraseñas nuevas para las 8 cuentas de esta demostración y las anteriores dejarán de servir. ¿Continuar?')) return;
    setOcupado(fila.id); setAviso('');
    try {
      const { data: ses } = await supabase.auth.getSession();
      const r = await fetch(`${API_URL}/demo/admin/credenciales`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ses?.session?.access_token}` }, body: JSON.stringify({ solicitud_id: fila.id }) });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) { setAviso(body.error || 'No se pudieron restablecer las claves.'); return; }
      setCred({ fila, cuentas: body.cuentas, url: body.url, texto: mensajeCredenciales({ nombre: fila.nombre_completo, url: body.url, cuentas: body.cuentas }) });
    } catch { setAviso('No hay conexión con el servidor.'); } finally { setOcupado(''); }
  };
  const copiar = async (t, etiqueta) => { try { await navigator.clipboard.writeText(t); setAviso(`${etiqueta} copiado.`); } catch { setAviso('No se pudo copiar: selecciona el texto y cópialo manualmente.'); } };

  const acciones = (f) => {
    const b = ocupado === f.id;
    if (f.estado === 'pendiente_confirmacion') return f.token_vigente
      ? <><button className="btn btn-primary btn-sm" disabled={b} onClick={() => abrirMensaje(f, f.token_vigente)}>Ver link y mensaje</button></>
      : <button className="btn btn-primary btn-sm" disabled={b} onClick={() => generarLink(f)}>{b ? '…' : 'Generar link de activación'}</button>;
    if (f.estado === 'expirada') return <button className="btn btn-primary btn-sm" disabled={b} onClick={() => generarLink(f)}>{b ? '…' : 'Generar link nuevo'}</button>;
    if (['confirmado', 'activo'].includes(f.estado)) return <>
      <button className="btn btn-secondary btn-sm" disabled={b} onClick={() => restablecer(f)}>Restablecer claves</button>
      {f.estado === 'activo' && <button className="btn btn-ghost btn-sm" disabled={b} onClick={() => extender(f)}>+5 días</button>}
      <button className="btn btn-ghost btn-sm" disabled={b} onClick={() => bloquear(f)}>Bloquear</button></>;
    if (['vencido', 'bloqueado'].includes(f.estado)) return <button className="btn btn-secondary btn-sm" disabled={b} onClick={() => extender(f)}>Reactivar 5 días</button>;
    return <span style={{ color: 'var(--slate)', fontSize: 12 }}>—</span>;
  };

  return (
    <div className="page-demos">
      <div className="dm-cab">
        <div>
          <h2 className="dm-h">Solicitudes de demo</h2>
          <p className="dm-sub">Quienes piden una demostración desde el login. Genera su link de activación y envíaselo por WhatsApp o correo.</p>
        </div>
        <button className="btn btn-secondary" onClick={() => { setCargando(true); cargar(); }}>Actualizar</button>
      </div>

      <div className="dm-kpis">
        <div className="dm-kpi dm-kpi-pend"><span>Por entregar</span><strong>{conteo.pendientes}</strong></div>
        <div className="dm-kpi"><span>Activas</span><strong>{conteo.activas}<small> / {CUPO}</small></strong></div>
        <div className="dm-kpi"><span>Vencidas</span><strong>{conteo.vencidas}</strong></div>
        <div className="dm-kpi"><span>Link vencido</span><strong>{conteo.expiradas}</strong></div>
      </div>

      <div className="dm-barra">
        <div className="dm-filtros" role="tablist" aria-label="Filtrar solicitudes">
          {FILTROS.map(([k, t]) => <button key={k} role="tab" aria-selected={filtro === k} className={'dm-filtro' + (filtro === k ? ' on' : '')} onClick={() => setFiltro(k)}>{t}</button>)}
        </div>
        <input className="dm-buscar" type="search" placeholder="Buscar por nombre, correo, institución o cédula" value={buscar} onChange={e => setBuscar(e.target.value)} aria-label="Buscar solicitudes" />
      </div>

      {aviso && <div className="dm-aviso" role="status">{aviso}</div>}
      {error && <div className="dm-aviso dm-aviso-err" role="alert">{error}</div>}

      <div className="card dm-tabla">
        {cargando ? <div className="dm-vacio">Cargando solicitudes…</div> : visibles.length === 0 ? (
          <div className="dm-vacio">{filas.length === 0 ? 'Aún no hay solicitudes. Cuando alguien pida una demo desde el login, aparecerá aquí y verás un aviso en el menú.' : 'No hay solicitudes con ese filtro.'}</div>
        ) : (
          <div className="dm-scroll">
            <table>
              <thead><tr><th>Solicitante</th><th>Institución y cargo</th><th>Contacto</th><th>Solicitada</th><th>Estado</th><th>Tiempo</th><th aria-label="Acciones" /></tr></thead>
              <tbody>
                {visibles.map(f => {
                  const e = ESTADOS_DEMO[f.estado] || { txt: f.estado, color: '#4a5b73', bg: '#e9eff7' };
                  const d = diasRestantes(f.demo_hasta);
                  return (
                    <tr key={f.id}>
                      <td><strong>{f.nombre_completo}</strong><div className="dm-peq">Cédula {f.cedula || '—'}</div></td>
                      <td>{f.empresa}<div className="dm-peq">{f.cargo || '—'}</div></td>
                      <td><div>{f.email}</div>{f.telefono && <a className="dm-peq dm-wa" href={whatsappUrl(f.telefono, '')} target="_blank" rel="noreferrer">WhatsApp {f.telefono}</a>}</td>
                      <td>{fmt(f.fecha_solicitud)}<div className="dm-peq">IP {f.ip || '—'}</div></td>
                      <td><span className="badge" style={{ color: e.color, background: e.bg }}>{e.txt}</span></td>
                      <td>{f.estado === 'pendiente_confirmacion' && f.token_vigente ? <span className="dm-peq">Link vence {fmt(f.token_expira_en)}</span>
                        : f.demo_hasta ? <span className={d !== null && d <= 1 ? 'dm-venc' : ''}>{d !== null && d > 0 ? `${d} día${d === 1 ? '' : 's'}` : 'Terminó'}<div className="dm-peq">hasta {fmt(f.demo_hasta)}</div></span>
                        : f.estado === 'confirmado' ? <span className="dm-peq">Aún no ingresa</span> : '—'}</td>
                      <td><div className="dm-acciones">{acciones(f)}</div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {msg && (
        <div className="dm-modal-bg" role="dialog" aria-modal="true" aria-label="Link y mensaje de bienvenida" onClick={(e) => { if (e.target === e.currentTarget) setMsg(null); }}>
          <div className="dm-modal">
            <div className="dm-modal-cab"><h3>Link de activación para {msg.fila.nombre_completo}</h3><button className="dm-x" onClick={() => setMsg(null)} aria-label="Cerrar">×</button></div>
            <p className="dm-sub">Válido por 24 horas y de un solo uso. Quien lo abra y pulse «Activar» recibirá sus credenciales.</p>
            <label className="dm-lbl">Link</label>
            <div className="dm-linea"><input readOnly value={msg.link} onFocus={e => e.target.select()} aria-label="Link de activación" /><button className="btn btn-secondary btn-sm" onClick={() => copiar(msg.link, 'Link')}>Copiar</button></div>

            <h4>Mensaje por WhatsApp</h4>
            <textarea rows={9} value={msg.whatsapp} onChange={e => setMsg({ ...msg, whatsapp: e.target.value })} aria-label="Mensaje de WhatsApp" />
            <div className="dm-linea">
              <button className="btn btn-secondary btn-sm" onClick={() => copiar(msg.whatsapp, 'Mensaje')}>Copiar mensaje</button>
              <a className="btn btn-primary btn-sm" href={whatsappUrl(msg.fila.telefono, msg.whatsapp)} target="_blank" rel="noreferrer">Abrir WhatsApp</a>
            </div>

            <h4>Mensaje por correo</h4>
            <label className="dm-lbl">Para</label><input readOnly value={msg.fila.email} aria-label="Destinatario" />
            <label className="dm-lbl">Asunto</label><input value={msg.asunto} onChange={e => setMsg({ ...msg, asunto: e.target.value })} aria-label="Asunto" />
            <label className="dm-lbl">Mensaje</label><textarea rows={9} value={msg.cuerpo} onChange={e => setMsg({ ...msg, cuerpo: e.target.value })} aria-label="Mensaje de correo" />
            <div className="dm-linea">
              <button className="btn btn-secondary btn-sm" onClick={() => copiar(msg.asunto, 'Asunto')}>Copiar asunto</button>
              <button className="btn btn-secondary btn-sm" onClick={() => copiar(msg.cuerpo, 'Mensaje')}>Copiar mensaje</button>
              <a className="btn btn-primary btn-sm" href={mailtoUrl(msg.fila.email, msg.asunto, msg.cuerpo)}>Abrir correo</a>
            </div>
          </div>
        </div>
      )}

      {cred && (
        <div className="dm-modal-bg" role="dialog" aria-modal="true" aria-label="Credenciales de la demostración" onClick={(e) => { if (e.target === e.currentTarget) setCred(null); }}>
          <div className="dm-modal">
            <div className="dm-modal-cab"><h3>Credenciales nuevas · {cred.fila.nombre_completo}</h3><button className="dm-x" onClick={() => setCred(null)} aria-label="Cerrar">×</button></div>
            <p className="dm-sub">Las contraseñas anteriores ya no sirven. No se guardan en ningún lugar: cópialas ahora.</p>
            <div className="dm-cred">{cred.cuentas.map(c => <div key={c.email}><strong>{c.rol}</strong><code>{c.email}</code><code>{c.password}</code></div>)}</div>
            <div className="dm-linea">
              <button className="btn btn-secondary btn-sm" onClick={() => copiar(cred.texto, 'Credenciales')}>Copiar mensaje con credenciales</button>
              <a className="btn btn-primary btn-sm" href={whatsappUrl(cred.fila.telefono, cred.texto)} target="_blank" rel="noreferrer">Abrir WhatsApp</a>
              <a className="btn btn-ghost btn-sm" href={mailtoUrl(cred.fila.email, 'Credenciales de tu demostración de SIGEE', cred.texto)}>Abrir correo</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
