import React, { useState } from 'react';
import { reglasClave, fuerzaClave } from '../lib/claveSegura.js';

const NIVELES = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Fuerte'];
const COLORES = ['#ef4444', '#ef4444', '#f59e0b', '#22c55e', '#16a34a'];

/**
 * Par «nueva contraseña + confirmar» con requisitos en vivo. Se usa en la pantalla de restablecer.
 * Los estilos son los del login (.lfield) para verse igual en la pantalla de acceso.
 */
export default function CampoClaveNueva({ clave, confirmacion, onClave, onConfirmacion, correo }) {
  const [ver, setVer] = useState(false);
  const reglas = reglasClave(clave, correo);
  const f = fuerzaClave(clave);
  return (
    <>
      <div className="lfield lpass-wrap">
        <label htmlFor="nc-nueva">Nueva contraseña</label>
        <input id="nc-nueva" type={ver ? 'text' : 'password'} value={clave} onChange={e => onClave(e.target.value)} autoComplete="new-password" autoFocus required />
        <button type="button" className="lpass-toggle" onClick={() => setVer(v => !v)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}><span className={ver ? 'ti ti-eye-off' : 'ti ti-eye'} /></button>
      </div>
      {clave && (
        <div className="cn-fuerza" aria-live="polite">
          <div className="cn-barra"><i style={{ width: `${(f / 4) * 100}%`, background: COLORES[f] }} /></div>
          <span style={{ color: COLORES[f] }}>{NIVELES[f]}</span>
        </div>
      )}
      <ul className="cn-reglas">
        {reglas.map(r => <li key={r.id} className={r.ok ? 'ok' : ''}><span className={r.ok ? 'ti ti-circle-check' : 'ti ti-circle'} aria-hidden="true" /> {r.texto}</li>)}
      </ul>
      <div className="lfield">
        <label htmlFor="nc-conf">Confirmar contraseña</label>
        <input id="nc-conf" type={ver ? 'text' : 'password'} value={confirmacion} onChange={e => onConfirmacion(e.target.value)} autoComplete="new-password" required />
        {confirmacion && clave !== confirmacion && <small className="cn-aviso">Las contraseñas no coinciden.</small>}
      </div>
    </>
  );
}
