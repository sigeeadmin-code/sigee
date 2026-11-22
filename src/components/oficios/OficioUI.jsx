import React, { useState } from 'react';
import { ACCIONES_HISTORIAL, badgeEstado, etiquetaCargo, etiquetaEstado } from '../../lib/oficiosDocumental.js';
import { copiasDe, etiquetaDestinatario, eventosRecorrido, fasesFinales, fmtEspera, fmtFecha, semaforoEspera } from '../../lib/oficiosVista.js';

/** Estado del documento. */
export const EstadoBadge = ({ estado }) => <span className={'badge ' + badgeEstado(estado)}>{etiquetaEstado(estado)}</span>;

/** Tiempo que lleva el documento en el despacho actual (solo si sigue abierto en ruta). */
export function EsperaTag({ doc }) {
  if (doc.estado !== 'en_ruta' || doc.espera_seg == null) return <span className="ofd-muted">—</span>;
  return <span className={'ofd-espera ofd-' + semaforoEspera(doc.espera_seg)}>{fmtEspera(doc.espera_seg)}</span>;
}

/** Ruta de autoridades + cierre (entrega y archivo): horizontal en pantallas anchas, vertical en móvil (solo CSS). */
export function RutaStepper({ doc }) {
  const ruta = doc.ruta || [];
  if (!ruta.length) return null;
  const fases = fasesFinales(doc);
  const destCargo = doc.destinatario?.tipo === 'cargo' ? doc.destinatario.cargo : null;
  const copias = copiasDe(doc);
  return (
    <>
      <ol className="ofd-ruta" aria-label="Ruta de aprobación, entrega y archivo">
        {ruta.map((p, i) => {
          const actual = i === doc.paso_actual && doc.estado === 'en_ruta';
          const est = p.estado_paso === 'aprobado' ? 'ok' : p.estado_paso === 'observado' ? 'warn' : actual ? 'now' : 'wait';
          return (
            <li key={i} className={'ofd-paso ofd-paso-' + est} aria-current={actual ? 'step' : undefined}>
              <span className="ofd-paso-dot" aria-hidden="true">
                {est === 'ok' ? <span className="ti ti-check" /> : est === 'warn' ? <span className="ti ti-alert-triangle" /> : i + 1}
              </span>
              <span className="ofd-paso-txt">
                <strong>{etiquetaCargo(p.cargo)}</strong>
                <small>{est === 'ok' ? 'Aprobó' : est === 'warn' ? 'Observó' : actual ? 'Le toca' : 'Pendiente'}{destCargo === p.cargo ? ' · destinatario' : ''}</small>
              </span>
            </li>
          );
        })}
        {fases.map(f => (
          <li key={f.clave} className={'ofd-paso ofd-paso-fin ofd-paso-' + (f.estado === 'hecho' ? 'ok' : f.estado === 'ahora' ? 'now' : 'wait')} aria-current={f.estado === 'ahora' ? 'step' : undefined}>
            <span className="ofd-paso-dot" aria-hidden="true">{f.estado === 'hecho' ? <span className="ti ti-check" /> : <span className={'ti ' + (f.clave === 'entrega' ? 'ti-package' : 'ti-archive')} />}</span>
            <span className="ofd-paso-txt"><strong>{f.etiqueta}</strong><small>{f.estado === 'hecho' ? 'Hecho' : f.estado === 'ahora' ? 'Le toca' : 'Pendiente'}</small></span>
          </li>
        ))}
      </ol>
      {(doc.destinatario || copias.length > 0) && (
        <div className="ofd-dist" aria-label="Destino del documento">
          <span><b>Dirigido a:</b> {etiquetaDestinatario(doc.destinatario)}</span>
          {copias.length > 0 && <span><b>De conocimiento:</b> {copias.map(c => (
            <span key={c.cargo} className={'ofd-copia ' + (c.visto ? 'ofd-copia-ok' : 'ofd-copia-pend')} title={c.visto ? `Tomó conocimiento${c.por ? ': ' + c.por : ''} · ${fmtFecha(c.visto_at)}` : 'Aún no toma conocimiento'}>
              {c.visto ? '✓ ' : '⏳ '}{c.etiqueta}</span>))}</span>}
        </div>
      )}
    </>
  );
}

/** Historial inmutable del recorrido, del más reciente al más antiguo. */
export function Recorrido({ historial }) {
  const h = [...(historial || [])].reverse();      // recibe eventosRecorrido(doc): historial + acuses de conocimiento
  if (!h.length) return <p className="ofd-muted">Sin movimientos todavía.</p>;
  return (
    <ul className="ofd-linea">
      {h.map((x, i) => (
        <li key={i} className={'ofd-ev ofd-ev-' + x.accion}>
          <div className="ofd-ev-top">
            <strong>{ACCIONES_HISTORIAL[x.accion] || x.accion}</strong>
            <span>{etiquetaCargo(x.cargo)}{x.usuario_nombre ? ` · ${x.usuario_nombre}` : ''}</span>
          </div>
          {x.comentario && <p className="ofd-ev-c">{x.comentario}</p>}
          <div className="ofd-ev-meta">
            <time>{fmtFecha(x.fecha_accion)}</time>
            {x.tiempo_espera != null && <span>espera {fmtEspera(x.tiempo_espera)}</span>}
            {x.version_pdf != null && <span>v{x.version_pdf}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Pide un motivo obligatorio (observar / rechazar): reemplaza window.prompt y funciona igual en móvil. */
export function MotivoForm({ etiqueta, placeholder, boton, tono = 'secondary', disabled, onConfirmar, onCancelar }) {
  const [motivo, setMotivo] = useState('');
  const listo = motivo.trim().length >= 5;
  return (
    <div className="ofd-motivo">
      <label className="fl" htmlFor="ofd-motivo">{etiqueta}</label>
      <textarea id="ofd-motivo" className="fc" rows={3} autoFocus value={motivo} placeholder={placeholder}
        onChange={e => setMotivo(e.target.value)} />
      <div className="ofd-motivo-f">
        <button className="btn btn-ghost btn-sm" type="button" onClick={onCancelar}>Cancelar</button>
        <button className={'btn btn-sm btn-' + tono} type="button" disabled={!listo || disabled} onClick={() => onConfirmar(motivo.trim())}>{boton}</button>
      </div>
      {!listo && motivo.length > 0 && <small className="ofd-muted">Escribe al menos 5 caracteres.</small>}
    </div>
  );
}
