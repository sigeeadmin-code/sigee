import React, { useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { supabase } from '../lib/supabase.js';
import { validarClave } from '../lib/claveSegura.js';
import CampoClaveNueva from '../components/CampoClaveNueva.jsx';

/**
 * Pantalla a la que llega quien abrió el enlace del correo (recuperar u cambiar contraseña).
 * Reemplaza a la app mientras dure la recuperación, así nadie entra al sistema sin haber elegido su nueva contraseña.
 */
export default function RestablecerClave() {
  const { cambiarClave, terminarRecuperacion, logout } = useSession();
  const [clave, setClave] = useState('');
  const [conf, setConf] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [listo, setListo] = useState(false);
  const [correo, setCorreo] = useState('');
  React.useEffect(() => { supabase.auth.getUser().then(({ data }) => setCorreo(data?.user?.email || '')); }, []);
  const v = validarClave(clave, conf, correo);

  async function enviar(e) {
    e.preventDefault();
    if (!v.ok || busy) return;
    setBusy(true); setError('');
    try { await cambiarClave(clave); setListo(true); }
    catch (err) { setError(err.message); }
    setBusy(false);
  }
  async function cancelar() { await logout(); terminarRecuperacion(); }

  return (
    <div id="login">
      <div className="l-right" style={{ width: '100%', borderLeft: 'none' }}>
        {listo ? (
          <div className="lcard">
            <div className="lbrand"><div className="ltitle">Contraseña actualizada</div>
              <div className="lsub">Ya puedes usar tu nueva contraseña. Por seguridad, se cerraron las demás sesiones abiertas de tu cuenta.</div></div>
            <button className="lbtn" type="button" onClick={terminarRecuperacion}>Entrar al sistema <span className="ti ti-arrow-right" /></button>
          </div>
        ) : (
          <form className="lcard" onSubmit={enviar}>
            <div className="lbrand"><div className="ltitle">Elige tu nueva contraseña</div>
              <div className="lsub">{correo ? <>Cuenta: <strong>{correo}</strong></> : 'Confirmaste tu identidad por correo electrónico.'}</div></div>
            {error && <div className="lerr" style={{ display: 'flex' }}>{error}</div>}
            <CampoClaveNueva clave={clave} confirmacion={conf} onClave={setClave} onConfirmacion={setConf} correo={correo} />
            <button className="lbtn" type="submit" disabled={!v.ok || busy}>{busy ? 'Guardando…' : 'Guardar nueva contraseña'}</button>
            <button type="button" className="cn-enlace" onClick={cancelar}>Cancelar y salir</button>
          </form>
        )}
      </div>
    </div>
  );
}
