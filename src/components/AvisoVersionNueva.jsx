import React, { useEffect, useState } from 'react';
import { hayVersionNueva, consultarVersionPublicada } from '../lib/versionNueva.js';

// Si SIGEE se actualiza mientras alguien tiene la pantalla abierta (algo normal), esa pestaña sigue con el código viejo
// hasta recargar. Este aviso lo detecta cada 3 minutos y al volver a la pestaña, y ofrece actualizar con un clic.
const MI_VERSION = typeof __ID_VERSION__ !== 'undefined' ? __ID_VERSION__ : null;

export default function AvisoVersionNueva() {
  const [nueva, setNueva] = useState(false);
  useEffect(() => {
    if (!MI_VERSION) return undefined;
    let vivo = true;
    const revisar = async () => { const p = await consultarVersionPublicada(); if (vivo && hayVersionNueva(MI_VERSION, p)) setNueva(true); };
    revisar();
    const t = setInterval(revisar, 3 * 60 * 1000);
    const alVolver = () => { if (document.visibilityState === 'visible') revisar(); };
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('focus', revisar);
    return () => { vivo = false; clearInterval(t); document.removeEventListener('visibilitychange', alVolver); window.removeEventListener('focus', revisar); };
  }, []);
  if (!nueva) return null;
  return (
    <div role="alert" style={{ position: 'fixed', left: 12, right: 12, bottom: 12, zIndex: 100, maxWidth: 520, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: '#1e293b', color: '#fff', boxShadow: '0 10px 30px rgba(0,0,0,.35)', fontSize: 13 }}>
      <span style={{ flex: 1 }}>Hay una <strong>versión nueva</strong> de SIGEE. Actualiza para evitar errores al guardar.</span>
      <button className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>Actualizar ahora</button>
    </div>
  );
}
