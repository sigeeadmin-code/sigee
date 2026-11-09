import React, { useEffect, useMemo, useState } from 'react';
import { fetchTicSesionesIp, bloquearTicIp } from '../lib/data.js';
import { descargarLibro } from '../lib/exportLibro.js';
import { clasificarIpCompartida, NIVELES_IP, resumirIpDesdeSesiones, formatoDuracion, navegadorCorto } from '../lib/tic.js';

const fmtF = v => (v ? new Date(v).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Guayaquil' }) : '—');
const ROLES = { super_admin: 'Super Admin', admin_plantel: 'Admin plantel', secretario: 'Secretaría', supervisor_general: 'Supervisor', supervisor_plantel: 'Supervisor plantel', contador_general: 'Contador', contador_plantel: 'Contador plantel', administrativo: 'Administrativo', inspector_general: 'Inspector', dece: 'DECE', docente: 'Docente', estudiante: 'Estudiante', padre: 'Representante' };

/**
 * Panel lateral «Origen de la IP»: quién la usó, cuándo, con qué riesgo y qué se puede hacer.
 * La ubicación (país/ciudad/ISP) NO se inventa: requiere un servicio GeoIP externo.
 */
export default function PanelOrigenIp({ ip, desde, hasta, inst, bloqueada, onBloqueada, onClose }) {
  const [ses, setSes] = useState(null);
  const [err, setErr] = useState('');
  const [motivo, setMotivo] = useState('');
  const [horas, setHoras] = useState('24');
  const [busy, setBusy] = useState(false);
  const [hecho, setHecho] = useState(!!bloqueada);

  useEffect(() => {
    let vivo = true; setSes(null); setErr('');
    fetchTicSesionesIp({ ip, desde, hasta, inst, limite: 500 })
      .then(r => { if (vivo) setSes((r || []).filter(s => s.ip === ip)); })      // el RPC acepta prefijos; aquí queremos la IP exacta
      .catch(e => { if (vivo) setErr(e.message); });
    return () => { vivo = false; };
  }, [ip, desde, hasta, inst]);
  useEffect(() => { const k = e => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);

  const resumen = useMemo(() => (ses ? resumirIpDesdeSesiones(ses) : null), [ses]);
  const riesgo = useMemo(() => (resumen ? clasificarIpCompartida(resumen) : null), [resumen]);
  const nivel = riesgo ? NIVELES_IP[riesgo.nivel] : null;

  async function bloquear() {
    if (!window.confirm(`¿Bloquear la IP ${ip}${horas === 'siempre' ? ' de forma permanente' : ` por ${horas} h`}? Todas las cuentas que entren desde esa red quedarán sin acceso.`)) return;
    setBusy(true); setErr('');
    try { await bloquearTicIp(ip, motivo.trim() || 'IP compartida por varias cuentas', horas === 'siempre' ? null : Number(horas)); setHecho(true); onBloqueada?.(ip); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  }
  function exportar() {
    descargarLibro(`ip_${ip.replace(/[^0-9a-f.:]/gi, '_')}.xlsx`, [
      { nombre: 'Sesiones', cols: ['Usuario', 'Correo', 'Rol', 'Plantel', 'Entrada', 'Salida', 'Minutos', 'Navegador'],
        filas: (ses || []).map(s => ({ Usuario: s.nombre, Correo: s.email, Rol: ROLES[s.rol] || s.rol, Plantel: s.plantel, Entrada: fmtF(s.inicio), Salida: s.fin ? fmtF(s.fin) : (s.abierta ? 'Abierta' : '—'), Minutos: s.minutos, Navegador: navegadorCorto(s.user_agent) })) }
    ]);
  }

  return (
    <aside className="pl" role="dialog" aria-modal="false" aria-label={`Origen de la IP ${ip}`}>
      <header className="pl-h">
        <div className="pl-t"><span className="ofd-num" style={{ fontSize: 15 }}>{ip}</span>
          {nivel && <span style={{ background: nivel.fondo, color: nivel.color, borderRadius: 999, padding: '2px 10px', fontWeight: 700, fontSize: 12 }}>{nivel.texto}</span>}
          {hecho && <span className="badge b-err">Bloqueada</span>}</div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Cerrar"><span className="ti ti-x" /></button>
      </header>
      <div className="pl-b">
        {err && <div className="lerr" style={{ display: 'flex' }}>{err}</div>}
        {!ses && !err && <p className="ofd-muted">Cargando…</p>}
        {resumen && (<>
          {riesgo && <div className="ofd-callout" style={{ background: nivel.fondo, color: nivel.color, borderColor: 'transparent' }}><strong>{nivel.texto}:</strong> {riesgo.motivo}</div>}
          <dl className="ofd-meta">
            <div><dt>Usuarios distintos</dt><dd>{resumen.n_usuarios}</dd></div>
            <div><dt>Planteles</dt><dd>{resumen.n_planteles}</dd></div>
            <div><dt>Sesiones en el rango</dt><dd>{resumen.n_sesiones}</dd></div>
            <div><dt>En madrugada (00–05 h)</dt><dd>{resumen.nocturnas}</dd></div>
            <div><dt>Primera</dt><dd>{fmtF(resumen.primera)}</dd></div>
            <div><dt>Última</dt><dd>{fmtF(resumen.ultima)}</dd></div>
          </dl>
          <p className="ofd-sub" style={{ margin: 0 }}><span className="ti ti-map-pin" /> País, ciudad y proveedor: pendiente de conectar un servicio GeoIP. No se muestran datos supuestos.</p>

          <h4 className="ofd-sec">Cuentas que usaron esta IP</h4>
          <div style={{ overflowX: 'auto' }}>
            <table className="data" style={{ width: '100%' }}>
              <thead><tr><th>Usuario</th><th>Rol</th><th>Plantel</th><th>Ses.</th><th>Última</th></tr></thead>
              <tbody>{resumen.usuarios.map(u => <tr key={u.user_id || u.email}><td style={{ fontSize: 12.5 }}><strong>{u.nombre || '—'}</strong><div style={{ fontSize: 11, color: 'var(--slate)' }}>{u.email}</div></td><td style={{ fontSize: 12 }}>{ROLES[u.rol] || u.rol}</td><td style={{ fontSize: 12 }}>{u.plantel || '—'}</td><td>{u.sesiones}</td><td style={{ fontSize: 12 }}>{fmtF(u.ultima)}</td></tr>)}</tbody>
            </table>
          </div>

          <h4 className="ofd-sec">Entradas y salidas</h4>
          <ul className="ofd-linea">
            {ses.slice(0, 40).map(s => (
              <li key={s.id} className="ofd-ev">
                <div className="ofd-ev-top"><strong>{s.nombre || s.email}</strong><span>{ROLES[s.rol] || s.rol}{s.plantel ? ` · ${s.plantel}` : ''}</span></div>
                <div className="ofd-ev-meta"><time>{fmtF(s.inicio)}</time><span>{s.abierta ? 'Abierta ahora' : s.fin ? `salió ${fmtF(s.fin)}` : 'sin cierre'}</span><span>{formatoDuracion(Number(s.minutos))}</span><span>{navegadorCorto(s.user_agent)}</span></div>
              </li>
            ))}
          </ul>
          {ses.length > 40 && <p className="ofd-muted">Se muestran las 40 más recientes de {ses.length}. El Excel trae todas.</p>}

          <h4 className="ofd-sec">Acciones</h4>
          {resumen.n_usuarios >= 3 && !hecho && <div className="ofd-callout ofd-callout-warn">Esta IP la usan {resumen.n_usuarios} cuentas: puede ser la red de un plantel. Bloquearla dejaría sin acceso a todas.</div>}
          {!hecho ? (
            <div className="ofd-motivo">
              <label className="fl" htmlFor="pl-motivo">Motivo (queda registrado)</label>
              <input id="pl-motivo" className="fc" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej. credenciales compartidas" maxLength={300} />
              <label className="fl" htmlFor="pl-horas">Duración</label>
              <select id="pl-horas" className="fc" value={horas} onChange={e => setHoras(e.target.value)}><option value="1">1 hora</option><option value="24">24 horas</option><option value="168">7 días</option><option value="siempre">Permanente</option></select>
              <div className="ofd-motivo-f"><button type="button" className="btn btn-secondary btn-sm" onClick={exportar} disabled={!ses.length}>⬇️ Excel de sesiones</button>
                <button type="button" className="btn btn-danger btn-sm" onClick={bloquear} disabled={busy}>{busy ? 'Bloqueando…' : 'Bloquear IP'}</button></div>
            </div>
          ) : <div className="ofd-motivo-f"><button type="button" className="btn btn-secondary btn-sm" onClick={exportar} disabled={!ses.length}>⬇️ Excel de sesiones</button></div>}
        </>)}
      </div>
    </aside>
  );
}
