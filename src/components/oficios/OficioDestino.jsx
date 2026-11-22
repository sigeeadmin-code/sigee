import React from 'react';
import { etiquetaCargo } from '../../lib/oficiosDocumental.js';
import { CARGOS_DESTINO } from '../../lib/oficiosVista.js';

const norm = d => ({
  destinatario: d?.destinatario ? { tipo: d.destinatario.tipo, cargo: d.destinatario.cargo || null, nombre: d.destinatario.nombre || null } : null,
  copias: [...(d?.copias || [])].sort()
});
/** Destino que ya tiene el documento, en el formato del editor. */
export const destinoDeDoc = doc => ({ destinatario: doc?.destinatario || null, copias: (doc?.copias_conocimiento || []).map(c => c.cargo) });
export const mismoDestino = (a, b) => JSON.stringify(norm(a)) === JSON.stringify(norm(b));

const aValor = d => (!d ? '' : d.tipo === 'cargo' ? 'cargo:' + d.cargo : d.tipo);
const deValor = (v, nombre) => (v === 'familia' ? { tipo: 'familia' } : v === 'externo' ? { tipo: 'externo', nombre: nombre || '' } : v.startsWith('cargo:') ? { tipo: 'cargo', cargo: v.slice(6) } : null);

/**
 * Selector de «dirigido a» y «de conocimiento». El primero decide quién recibe el oficio (si es un cargo que no está en la
 * ruta, firma al final); el segundo, quiénes reciben copia y marcan «tomé conocimiento» sin frenar el trámite.
 */
export function DestinoEditor({ valor, onChange, ruta = [], disabled }) {
  const base = ruta.filter(p => !p.agregado_por_destino).map(p => p.cargo);
  const dest = valor.destinatario; const cargoDest = dest?.tipo === 'cargo' ? dest.cargo : null;
  const agregaPaso = cargoDest && !base.includes(cargoDest);
  const cambiarDest = v => {
    const d = deValor(v, dest?.nombre);
    const copias = valor.copias.filter(c => c !== d?.cargo);        // quien va como destinatario no necesita copia
    onChange({ destinatario: d, copias });
  };
  const alternar = c => onChange({ ...valor, copias: valor.copias.includes(c) ? valor.copias.filter(x => x !== c) : [...valor.copias, c] });
  return (
    <fieldset className="ofd-destino" disabled={disabled}>
      <legend>Destino del documento</legend>
      <div className="ofd-destino-g">
        <div>
          <label className="fl" htmlFor="ofd-dirigido">Dirigido a</label>
          <select id="ofd-dirigido" className="fc" value={aValor(dest)} onChange={e => cambiarDest(e.target.value)}>
            <option value="" disabled>Selecciona el destinatario…</option>
            <option value="familia">Representante legal (familia)</option>
            {CARGOS_DESTINO.map(c => <option key={c} value={'cargo:' + c}>{etiquetaCargo(c)}</option>)}
            <option value="externo">Otra persona o institución</option>
          </select>
          {dest?.tipo === 'externo' && <input className="fc ofd-destino-ext" value={dest.nombre || ''} maxLength={120} placeholder="Nombre de la persona o institución"
            onChange={e => onChange({ ...valor, destinatario: { tipo: 'externo', nombre: e.target.value } })} aria-label="Nombre del destinatario" />}
          <small className="ofd-ayuda">{agregaPaso ? `Se agregará la firma de ${etiquetaCargo(cargoDest)} al final de la ruta.` : dest?.tipo === 'familia' ? 'Al aprobarse se registra la entrega al representante y luego se archiva.' : cargoDest ? 'Ese cargo ya está en la ruta.' : ' '}</small>
        </div>
        <div>
          <span className="fl" id="ofd-conoc-l">De conocimiento (copia)</span>
          <div className="ofd-conoc" role="group" aria-labelledby="ofd-conoc-l">
            {CARGOS_DESTINO.map(c => {
              const firma = base.includes(c) || c === cargoDest;
              return (
                <label key={c} className={'ofd-conoc-i' + (firma ? ' ofd-conoc-off' : '')} title={firma ? 'Ya firma o recibe el documento' : undefined}>
                  <input type="checkbox" checked={valor.copias.includes(c)} disabled={firma} onChange={() => alternar(c)} /> {etiquetaCargo(c)}
                </label>
              );
            })}
          </div>
          <small className="ofd-ayuda">Reciben el documento y marcan «tomé conocimiento»; no frenan el trámite.</small>
        </div>
      </div>
    </fieldset>
  );
}

/** Aviso para quien recibió una copia: acuse de conocimiento con nota opcional. */
export function ConocimientoBox({ ocupado, onConfirmar }) {
  const [nota, setNota] = React.useState('');
  return (
    <div className="ofd-callout ofd-callout-info" role="status">
      <strong>Este documento llegó a tu cargo para conocimiento</strong>
      <p>No necesitas aprobarlo. Al marcarlo, queda registrado con tu nombre y la hora.</p>
      <div className="ofd-conoc-acc">
        <input className="fc" value={nota} maxLength={300} onChange={e => setNota(e.target.value)} placeholder="Nota (opcional)" aria-label="Nota de conocimiento" />
        <button type="button" className="btn btn-primary btn-sm" disabled={ocupado} onClick={() => onConfirmar(nota.trim() || null)}><span className="ti ti-eye-check" /> Tomé conocimiento</button>
      </div>
    </div>
  );
}
