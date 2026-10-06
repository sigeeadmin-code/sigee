import React, { useState } from 'react';
import { restablecerContrasenas } from '../lib/data.js';
import { generarClave } from '../lib/claves.js';
import { exportarFilasExcel } from '../lib/cargaMasiva.js';

const overlay = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 80, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 12px', overflowY: 'auto' };
const caja = { background: 'var(--card, #fff)', borderRadius: 14, width: '100%', boxShadow: '0 20px 50px rgba(0,0,0,.28)' };

/**
 * Restablece la contraseña de una o varias cuentas (Super Admin y Administrador de Plantel).
 *  usuarios: [{ id, nombre, email }]  ·  onClose(huboCambios)
 * Con una sola cuenta también se puede corregir el correo (útil si se escribió mal al crearla).
 */
export default function RestablecerClaveModal({ usuarios, onClose }) {
  const uno = usuarios.length === 1;
  const [claves, setClaves] = useState(() => Object.fromEntries(usuarios.map(u => [u.id, generarClave()])));
  const [correo, setCorreo] = useState(usuarios[0]?.email || '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [resultados, setResultados] = useState(null);

  async function ejecutar() {
    setError('');
    if (Object.values(claves).some(c => String(c).length < 8)) { setError('Cada contraseña debe tener al menos 8 caracteres.'); return; }
    if (uno && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo.trim())) { setError('Escribe un correo válido.'); return; }
    if (!uno && !window.confirm(`Se cambiarán las contraseñas de ${usuarios.length} cuentas. Las contraseñas anteriores dejarán de funcionar.\n\n¿Continuar?`)) return;
    setGuardando(true);
    try {
      const cambioCorreo = uno && correo.trim().toLowerCase() !== String(usuarios[0].email || '').toLowerCase();
      const r = await restablecerContrasenas(usuarios.map(u => ({ user_id: u.id, password: claves[u.id], ...(cambioCorreo ? { email: correo.trim().toLowerCase() } : {}) })));
      const porId = Object.fromEntries(r.map(x => [x.user_id, x]));
      setResultados(usuarios.map(u => ({ ...u, email: uno ? correo.trim().toLowerCase() : u.email, ok: !!porId[u.id]?.ok, error: porId[u.id]?.error || (porId[u.id] ? '' : 'Sin respuesta del servidor'), clave: claves[u.id] })));
    } catch (e) { setError(e.message || 'No se pudo restablecer la contraseña.'); }
    setGuardando(false);
  }

  const exitosas = (resultados || []).filter(r => r.ok);
  const textoCredenciales = exitosas.map(r => `${r.nombre}\n  Correo: ${r.email}\n  Contraseña: ${r.clave}`).join('\n\n');

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget && !guardando && !resultados) onClose(false); }}>
      <div style={{ ...caja, maxWidth: uno ? 480 : 720 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
          <h3 style={{ margin: 0 }}>{resultados ? 'Contraseñas restablecidas' : uno ? `Restablecer contraseña · ${usuarios[0].nombre}` : `Restablecer contraseñas · ${usuarios.length} cuentas`}</h3>
        </div>
        <div style={{ padding: 20 }}>
          {!resultados ? (
            <>
              <p style={{ fontSize: 13, margin: '0 0 12px' }}>
                Se asignará una contraseña nueva y la anterior dejará de funcionar. <strong>Entrégala a la persona por un canal seguro</strong>; después de este paso no se podrá volver a consultar.
              </p>
              {uno ? (
                <div className="form-grid">
                  <div className="full">
                    <label className="fl">Correo (con él inicia sesión)</label>
                    <input className="fc" type="email" value={correo} onChange={e => setCorreo(e.target.value)} />
                    <div style={{ fontSize: 11.5, color: 'var(--slate)', marginTop: 3 }}>Si estaba mal escrito, corrígelo aquí.</div>
                  </div>
                  <div className="full">
                    <label className="fl">Contraseña nueva</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input className="fc" style={{ fontFamily: 'monospace' }} value={claves[usuarios[0].id]} onChange={e => setClaves({ [usuarios[0].id]: e.target.value })} />
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setClaves({ [usuarios[0].id]: generarClave() })}>Generar otra</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ border: '1px solid var(--line)', borderRadius: 10, maxHeight: 340, overflowY: 'auto' }}>
                  <table className="data" style={{ width: '100%' }}>
                    <thead><tr><th>Nombre</th><th>Correo</th><th>Contraseña nueva</th></tr></thead>
                    <tbody>{usuarios.map(u => (
                      <tr key={u.id}><td>{u.nombre}</td><td style={{ fontSize: 12 }}>{u.email}</td><td style={{ fontFamily: 'monospace' }}>{claves[u.id]}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
              {error && <div style={{ marginTop: 12, fontSize: 13, color: 'var(--red)' }}>{error}</div>}
            </>
          ) : (
            <>
              <p style={{ fontSize: 13, margin: '0 0 12px' }}>
                {exitosas.length} de {resultados.length} contraseña(s) restablecida(s). <strong>Copia o descarga estos datos ahora</strong>: no se podrán volver a ver.
              </p>
              <div style={{ border: '1px solid var(--line)', borderRadius: 10, maxHeight: 320, overflowY: 'auto' }}>
                <table className="data" style={{ width: '100%' }}>
                  <thead><tr><th>Nombre</th><th>Correo</th><th>Contraseña</th><th /></tr></thead>
                  <tbody>{resultados.map(r => (
                    <tr key={r.id}>
                      <td>{r.nombre}</td><td style={{ fontSize: 12 }}>{r.email}</td>
                      <td style={{ fontFamily: 'monospace' }}>{r.ok ? r.clave : '—'}</td>
                      <td>{r.ok ? <span className="badge b-ok">Listo</span> : <span className="badge b-err" title={r.error}>Error: {r.error}</span>}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </>
          )}
        </div>
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          {!resultados ? (
            <>
              <button className="btn btn-secondary" onClick={() => onClose(false)} disabled={guardando}>Cancelar</button>
              <button className="btn btn-primary" onClick={ejecutar} disabled={guardando}>{guardando ? 'Restableciendo…' : uno ? 'Restablecer contraseña' : `Restablecer ${usuarios.length} contraseñas`}</button>
            </>
          ) : (
            <>
              {exitosas.length > 0 && <button className="btn btn-secondary" onClick={() => navigator.clipboard?.writeText(textoCredenciales)}>📋 Copiar</button>}
              {exitosas.length > 0 && !uno && (
                <button className="btn btn-secondary" onClick={() => exportarFilasExcel('contrasenas_nuevas.xlsx', exitosas.map(r => ({ Nombre: r.nombre, Correo: r.email, 'Contraseña nueva': r.clave })))}>⬇️ Descargar Excel</button>
              )}
              <button className="btn btn-primary" onClick={() => onClose(exitosas.length > 0)}>Listo</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
