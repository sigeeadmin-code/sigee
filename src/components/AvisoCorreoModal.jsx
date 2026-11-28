import React, { useMemo, useState } from 'react';
import { enviarAvisoPorCorreo } from '../lib/data.js';
import { construirAvisoVista, urlMailto } from '../lib/avisoInasistencia.js';

/** Confirmación del aviso por correo (equivalente a «Avisar» de WhatsApp). Muestra a quién y qué se envía antes de enviar.
 *  correoConfigurado: true = el servidor envía; false = se ofrece abrir el correo del usuario; null = aún no se sabe. */
export default function AvisoCorreoModal({ item, institucionNombre, demo, correoConfigurado, onClose, onEnviado }) {
  const [estado, setEstado] = useState({ fase: 'revisar', error: '', yaEnviado: false, resultado: null });
  const [enviando, setEnviando] = useState(false);
  const vista = useMemo(() => construirAvisoVista({ institucion: institucionNombre, estudiante: item.nombre, curso: item.curso, fecha: item.fecha }), [item, institucionNombre]);
  const sinEnvioAutomatico = correoConfigurado === false && !demo;

  async function enviar(reenviar = false) {
    setEnviando(true);
    try {
      const r = await enviarAvisoPorCorreo({ estudianteId: item.estudianteId, fecha: item.fecha, reenviar });
      setEstado({ fase: 'listo', error: '', yaEnviado: false, resultado: r });
      onEnviado?.(item, r);
    } catch (e) {
      const msg = e?.message || String(e);
      if (e?.status === 409 || /ya se envi/i.test(msg)) setEstado({ fase: 'revisar', error: msg, yaEnviado: true, resultado: null });
      else setEstado({ fase: 'revisar', error: msg, yaEnviado: false, resultado: null });
    }
    setEnviando(false);
  }

  const r = estado.resultado;
  return (
    <div className="modal-bg" onClick={() => !enviando && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Avisar por correo" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <h3>✉️ Avisar por correo</h3>

        {estado.fase === 'listo' ? (
          <div style={{ padding: '10px 12px', borderRadius: 8, background: r?.simulado ? 'var(--amberXL)' : 'var(--greenL)', color: r?.simulado ? 'var(--amberD)' : 'var(--greenD)', fontSize: 14 }} role="status">
            {r?.simulado
              ? <>Demostración: <strong>no se envió ningún correo</strong>. Así se habría enviado a <strong>{(r.destinos || []).join(', ') || item.correoRep}</strong>.</>
              : <>✔ Correo enviado a <strong>{(r?.destinos || []).join(', ')}</strong>. Quedó registrado como aviso en la ficha del estudiante.</>}
          </div>
        ) : (
          <>
            <p style={{ fontSize: 13.5, margin: '0 0 8px' }}>
              <strong>{item.nombre}</strong> · {item.curso} · inasistencia del <strong>{item.fecha}</strong><br />
              Para: <strong>{item.correoRep}</strong>{item.representante ? <> ({item.representante})</> : null}
            </p>
            <div style={{ border: '1px solid var(--line)', borderRadius: 8, background: 'var(--page)', padding: 12, fontSize: 13 }}>
              <div style={{ fontSize: 12, color: 'var(--slate)', marginBottom: 4 }}>Asunto</div>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>{vista.asunto}</div>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{vista.texto}</div>
            </div>
            {demo && <p style={{ fontSize: 12.5, marginTop: 8, color: 'var(--amberD)' }}>Estás en una demostración: se mostrará cómo se enviaría, pero no se manda ningún correo.</p>}
            {sinEnvioAutomatico && (
              <p style={{ fontSize: 12.5, marginTop: 8, color: 'var(--amberD)' }}>
                El envío automático aún no está activado en el servidor. Puedes abrir tu programa de correo con este mensaje ya escrito.
              </p>
            )}
            {estado.error && (
              <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 8 }} role="alert">
                {estado.error}
                {estado.yaEnviado && <> <button className="btn btn-secondary btn-sm" disabled={enviando} onClick={() => enviar(true)}>Reenviar de todos modos</button></>}
              </p>
            )}
          </>
        )}

        <div className="modal-f">
          <button className="btn btn-secondary" disabled={enviando} onClick={onClose}>{estado.fase === 'listo' ? 'Cerrar' : 'Cancelar'}</button>
          {estado.fase !== 'listo' && (sinEnvioAutomatico
            ? <a className="btn btn-primary" href={urlMailto(item.correoRep, vista)}>Abrir en mi correo</a>
            : <button className="btn btn-primary" disabled={enviando} onClick={() => enviar(false)}>{enviando ? 'Enviando…' : demo ? 'Simular envío' : 'Enviar correo'}</button>)}
        </div>
      </div>
    </div>
  );
}
