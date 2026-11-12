import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

// Pantalla pública (sin sesión): solicita un demo de 5 días vía RPC solicitar_demo.
export default function SolicitarDemo() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', nombre_completo: '', empresa: '', telefono: '', cargo: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);

  const cambiar = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function enviar(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { data, error: rpcError } = await supabase.rpc('solicitar_demo', {
      p_email: form.email,
      p_nombre_completo: form.nombre_completo,
      p_empresa: form.empresa,
      p_telefono: form.telefono || null,
      p_cargo: form.cargo || null,
    });
    setBusy(false);
    if (rpcError || !data?.success) {
      setError(data?.error || 'No se pudo procesar la solicitud. Intenta de nuevo en unos minutos.');
      return;
    }
    setOk(true);
  }

  return (
    <div id="login" style={{ justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 520 }}>
        {ok ? (
          <div className="lcard">
            <div className="lbrand">
              <div className="ltitle">Revisa tu correo</div>
              <div className="lsub">
                Enviamos un enlace de confirmación a <b style={{ color: '#34d399' }}>{form.email}</b>. Es válido por 24 horas.
              </div>
            </div>
            <button className="lbtn" type="button" onClick={() => navigate('/')}>Volver al inicio de sesión</button>
          </div>
        ) : (
          <form onSubmit={enviar} className="lcard">
            <div className="lbrand">
              <div className="ltitle">Solicitar demo gratuito</div>
              <div className="lsub">5 días de acceso completo a todos los roles · sin tarjeta</div>
            </div>
            {error && <div className="lerr" style={{ display: 'flex' }}>{error}</div>}
            <div className="lfield"><label>Correo electrónico *</label>
              <input type="email" name="email" required value={form.email} onChange={cambiar} placeholder="tu@colegio.edu.ec" /></div>
            <div className="lfield"><label>Nombre completo *</label>
              <input type="text" name="nombre_completo" required value={form.nombre_completo} onChange={cambiar} placeholder="Juan Pérez" /></div>
            <div className="lfield"><label>Institución *</label>
              <input type="text" name="empresa" required value={form.empresa} onChange={cambiar} placeholder="Unidad Educativa Ejemplo" /></div>
            <div className="lfield"><label>Teléfono</label>
              <input type="tel" name="telefono" value={form.telefono} onChange={cambiar} placeholder="099 123 4567" /></div>
            <div className="lfield"><label>Cargo</label>
              <input type="text" name="cargo" value={form.cargo} onChange={cambiar} placeholder="Rector, Coordinador…" /></div>
            <button className="lbtn" type="submit" disabled={busy}>{busy ? 'Procesando…' : 'Solicitar mi demo de 5 días'}</button>
            <button type="button" className="cn-enlace" onClick={() => navigate('/')}>← Volver al inicio de sesión</button>
          </form>
        )}
      </div>
    </div>
  );
}
