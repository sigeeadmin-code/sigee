import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../lib/SessionContext.jsx';
import { HUB_ROLES, leerHub, limpiarHub } from '../lib/hubLumen.js';
import '../hub-lumen.css';

// Hub de pruebas de roles de Colegio Lumen. Solo el Super Admin llega aquí (App.jsx lo controla).
export default function HubColegioLumen() {
  const { profile, entrarComoDemo, cerrarSesionCompleta } = useSession();
  const navigate = useNavigate();
  const [entrando, setEntrando] = useState('');
  const [error, setError] = useState('');
  const [volvio] = useState(() => leerHub()?.active === true);   // llegó aquí al cerrar sesión de un usuario demo

  async function entrar(rol) {
    setError(''); setEntrando(rol.id);
    try { await entrarComoDemo(rol.id); }       // si sale bien, la página se recarga con la sesión del usuario demo
    catch (e) { setError(e.message || 'No se pudo entrar.'); setEntrando(''); }
  }
  function volverAlAdminGlobal() { limpiarHub(); navigate('/'); }   // no cierra la sesión del Admin Global

  return (
    <div className="hub">
      <header className="hub-barra">
        <div className="hub-marca"><span className="hub-logo" aria-hidden="true">S</span><span>SIGEE</span></div>
        <div className="hub-acciones">
          <span className="hub-quien" title={profile?.email}>Admin Global · {profile?.email}</span>
          <button className="hub-btn hub-btn-sec" onClick={volverAlAdminGlobal}>← Volver al Admin Global</button>
          <button className="hub-btn hub-btn-ghost" onClick={cerrarSesionCompleta}>Cerrar sesión completa</button>
        </div>
      </header>

      <main className="hub-main">
        <div className="hub-cab">
          <span className="hub-insignia">Institución de demostración</span>
          <h1>Colegio Lumen</h1>
          <p>Hub de pruebas · Acceso a usuarios demo</p>
        </div>

        {volvio && <div className="hub-aviso hub-aviso-ok" role="status">Volviste al Hub. Elige otro rol para seguir probando.</div>}
        {error && <div className="hub-aviso hub-aviso-err" role="alert">{error}</div>}

        <div className="hub-grid">
          {HUB_ROLES.map(rol => {
            const ocupado = entrando === rol.id;
            return (
              <article className={'hub-card' + (rol.pendiente ? ' hub-card-off' : '')} key={rol.id} aria-labelledby={`hub-${rol.id}`}>
                <div className="hub-ico" aria-hidden="true"><span className={'ti ' + rol.icono} /></div>
                <h2 id={`hub-${rol.id}`}>{rol.nombre}</h2>
                <p>{rol.desc}</p>
                {rol.pendiente
                  ? <><button className="hub-btn hub-btn-main" disabled>Cuenta pendiente</button><span className="hub-nota">Aún no existe la cuenta demo de este rol.</span></>
                  : <button className="hub-btn hub-btn-main" onClick={() => entrar(rol)} disabled={!!entrando}>{ocupado ? 'Entrando…' : 'Entrar'}</button>}
              </article>
            );
          })}
        </div>
        <p className="hub-pie">Al cerrar sesión de un usuario demo volverás aquí automáticamente, sin pasar por el login. Los cambios que hagas en Colegio Lumen son reales dentro de esa institución de ejemplo.</p>
      </main>
    </div>
  );
}
