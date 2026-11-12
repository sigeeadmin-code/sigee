import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

// Pantalla pública: confirma el demo con el token del correo (RPC confirmar_demo).
// La creación de usuarios (Módulo 3) NO se dispara desde el navegador anónimo.
export default function ConfirmarDemo() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');
  const [estado, setEstado] = useState(token ? 'cargando' : 'error');
  const [mensaje, setMensaje] = useState(token ? '' : 'Enlace no válido.');
  const [codigo, setCodigo] = useState('');

  useEffect(() => {
    if (!token) return;
    let vivo = true;
    (async () => {
      const { data, error } = await supabase.rpc('confirmar_demo', { p_token: token });
      if (!vivo) return;
      if (error || !data?.success) {
        setEstado('error');
        setMensaje(data?.error || 'El enlace expiró o ya fue utilizado.');
        return;
      }
      setCodigo(data.codigo_plantel);
      setEstado('ok');
    })();
    return () => { vivo = false; };
  }, [token]);

  return (
    <div id="login" style={{ justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <div className="lcard" style={{ maxWidth: 460, width: '100%', textAlign: 'center' }}>
        {estado === 'cargando' && <div className="lsub">Activando tu demo…</div>}
        {estado === 'ok' && (
          <>
            <div className="ltitle">¡Demo activado!</div>
            <div className="lsub" style={{ margin: '10px 0 16px' }}>
              Te enviaremos las credenciales de acceso a tu correo.
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: '#34d399', marginBottom: 20 }}>{codigo}</div>
            <button className="lbtn" type="button" onClick={() => navigate('/')}>Ir a iniciar sesión</button>
          </>
        )}
        {estado === 'error' && (
          <>
            <div className="ltitle">No se pudo activar</div>
            <div className="lsub" style={{ margin: '10px 0 20px' }}>{mensaje}</div>
            <button className="lbtn" type="button" onClick={() => navigate('/solicitar-demo')}>Solicitar nuevamente</button>
          </>
        )}
      </div>
    </div>
  );
}
