import React, { useEffect, useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { supabase, ROLE_GROUP, ROLE_LABELS } from '../lib/supabase.js';

const ESPERA_S = 60;
const ocultar = c => { const [u, d] = String(c || '').split('@'); return d ? `${u.slice(0, 2)}${'•'.repeat(Math.max(2, u.length - 2))}@${d}` : ''; };

/** Configuración de la cuenta: datos básicos y cambio de contraseña confirmado por correo electrónico. */
export default function Configuracion() {
  const { profile, institucion, solicitarRecuperacion } = useSession();
  const [correo, setCorreo] = useState(profile?.email || '');
  const [estado, setEstado] = useState({ fase: 'inicio', msg: '' });      // inicio | enviando | enviado | error
  const [hasta, setHasta] = useState(0);
  const [ahora, setAhora] = useState(Date.now());

  useEffect(() => { supabase.auth.getUser().then(({ data }) => { if (data?.user?.email) setCorreo(data.user.email); }); }, []);
  useEffect(() => { if (estado.fase !== 'enviado') return undefined; const t = setInterval(() => setAhora(Date.now()), 1000); return () => clearInterval(t); }, [estado.fase]);
  const espera = Math.max(0, Math.ceil((hasta - ahora) / 1000));

  async function enviar() {
    if (!correo || estado.fase === 'enviando' || espera > 0) return;
    setEstado({ fase: 'enviando', msg: '' });
    try { await solicitarRecuperacion(correo); const h = Date.now() + ESPERA_S * 1000; setAhora(Date.now()); setHasta(h); setEstado({ fase: 'enviado', msg: '' }); }
    catch (e) { setEstado({ fase: 'error', msg: e.message }); }
  }

  const nombre = [profile?.nombres, profile?.apellidos].filter(Boolean).join(' ') || '—';
  const rol = ROLE_LABELS[ROLE_GROUP[profile?.rolDb]] || profile?.rolDb || '—';
  return (
    <div style={{ maxWidth: 720 }}>
      <h2 style={{ margin: '0 0 4px' }}><span className="ti ti-settings" /> Configuración</h2>
      <p style={{ color: 'var(--slate)', margin: '0 0 14px', fontSize: 13 }}>Tu cuenta y tu seguridad</p>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="ch"><h3>Mi cuenta</h3></div>
        <div className="cb">
          <dl className="ofd-meta">
            <div><dt>Nombre</dt><dd>{nombre}</dd></div>
            <div><dt>Rol</dt><dd>{rol}</dd></div>
            <div><dt>Correo</dt><dd>{correo || '—'}</dd></div>
            <div><dt>Institución</dt><dd>{institucion?.nombre || (profile?.rolDb === 'super_admin' ? 'Todos los planteles' : '—')}</dd></div>
          </dl>
        </div>
      </div>

      <div className="card">
        <div className="ch"><h3>Contraseña</h3></div>
        <div className="cb" style={{ fontSize: 13.5 }}>
          <p style={{ margin: '0 0 10px' }}>
            Para proteger tu cuenta, el cambio de contraseña se <strong>confirma por correo electrónico</strong>: te enviamos un enlace a <strong>{ocultar(correo) || 'tu correo'}</strong>.
            Al abrirlo podrás elegir la nueva contraseña. Si no fuiste tú quien lo pidió, ignora el mensaje: tu contraseña actual no cambia.
          </p>
          {estado.fase === 'error' && <div className="lerr" style={{ display: 'flex', marginBottom: 10 }}>{estado.msg}</div>}
          {estado.fase === 'enviado' && (
            <div className="ofd-callout" style={{ background: '#ecfdf5', color: '#065f46', borderColor: '#6ee7b7', marginBottom: 10 }} role="status">
              <strong>Enlace enviado.</strong> Revisa tu correo (y la carpeta de spam). El enlace vence en 1 hora y solo funciona una vez.
            </div>
          )}
          <button className="btn btn-primary" onClick={enviar} disabled={!correo || estado.fase === 'enviando' || espera > 0}>
            {estado.fase === 'enviando' ? 'Enviando…' : espera > 0 ? `Reenviar en ${espera}s` : estado.fase === 'enviado' ? 'Reenviar enlace' : 'Enviar enlace de confirmación'}
          </button>
        </div>
      </div>
    </div>
  );
}
