import React, { useEffect, useRef, useState } from 'react';
import { etiquetaCargo, etiquetaTipo } from '../../lib/oficiosDocumental.js';
import { fmtFecha, LIMITE_VERSIONES, numObservaciones, semaforoEspera, fmtEspera } from '../../lib/oficiosVista.js';
import { EsperaTag, EstadoBadge } from './OficioUI.jsx';

/** Columnas que el usuario puede mostrar u ocultar (N°, Documento y Acciones son fijas). */
export const COLUMNAS = [
  { k: 'estudiante', t: 'Estudiante', def: true },
  { k: 'tipo', t: 'Tipo', def: false },
  { k: 'curso', t: 'Curso', def: false },
  { k: 'estado', t: 'Estado', def: true },
  { k: 'despacho', t: 'Paso actual', def: true },
  { k: 'version', t: 'Versión', def: true },
  { k: 'espera', t: 'En trámite', def: true },
  { k: 'fecha', t: 'Actualizado', def: false }
];
const CLAVE_COLS = 'sigee_oficios_columnas_v2';

/** Columnas visibles, recordadas en este navegador. */
export function useColumnas() {
  const [vis, setVis] = useState(() => {
    try { const g = JSON.parse(localStorage.getItem(CLAVE_COLS) || 'null'); if (Array.isArray(g)) return new Set(g); } catch { /* sin almacenamiento */ }
    return new Set(COLUMNAS.filter(c => c.def).map(c => c.k));
  });
  const alternar = k => setVis(s => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); try { localStorage.setItem(CLAVE_COLS, JSON.stringify([...n])); } catch { /* sin almacenamiento */ } return n; });
  return [vis, alternar];
}

/** Botón «Columnas n/N» con la lista de casillas. */
export function ColumnasMenu({ vis, onAlternar }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = e => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
    const esc = e => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', fuera); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc); };
  }, [abierto]);
  return (
    <div className="ofd-cols" ref={ref}>
      <button type="button" className="btn btn-secondary" aria-haspopup="true" aria-expanded={abierto} onClick={() => setAbierto(v => !v)}>
        <span className="ti ti-columns" /> Columnas <span className="ofd-cuenta">{vis.size}/{COLUMNAS.length}</span>
      </button>
      {abierto && (
        <div className="ofd-cols-menu" role="menu">
          {COLUMNAS.map(c => (
            <label key={c.k} role="menuitemcheckbox" aria-checked={vis.has(c.k)}><input type="checkbox" checked={vis.has(c.k)} onChange={() => onAlternar(c.k)} /> {c.t}</label>
          ))}
        </div>
      )}
    </div>
  );
}

/** Pasos de la ruta como segmentos de color. */
export function PasosMini({ doc }) {
  const ruta = doc.ruta || [];
  if (!ruta.length || doc.estado === 'borrador') return null;
  return (
    <span className="ofd-pasos" aria-hidden="true">
      {ruta.map((p, i) => {
        const actual = i === doc.paso_actual && doc.estado === 'en_ruta';
        return <i key={i} className={p.estado_paso === 'aprobado' ? 'ofd-p-ok' : p.estado_paso === 'observado' ? 'ofd-p-warn' : actual ? 'ofd-p-now' : ''} />;
      })}
    </span>
  );
}

/**
 * Lista de documentos. Un solo marcado: tabla en pantallas anchas y tarjetas apiladas en móvil
 * (las celdas llevan data-label y el CSS las convierte). Columnas configurables y decisiones en línea.
 */
export default function OficiosTabla({ items, seleccionadoId, onSelect, nombreEst, cedulaEst = () => '', vacio, seleccion, onToggle, onToggleTodos, onVer, onRecorrido, columnas, onDecidir }) {
  const v = columnas || new Set(COLUMNAS.map(c => c.k));
  const conLote = !!seleccion;
  const habilitados = items.filter(d => d.puede_actuar);
  const todos = conLote && habilitados.length > 0 && habilitados.every(d => seleccion.has(d.id));
  if (!items.length) return <div className="empty"><span className="ti ti-file-text" /><p>{vacio || 'No hay documentos para mostrar.'}</p></div>;
  return (
    <div className="ofd-tabla-wrap">
      <table className="data ofd-tabla">
        <thead>
          <tr>
            {conLote && <th className="ofd-c-sel"><input type="checkbox" checked={todos} disabled={!habilitados.length} onChange={() => onToggleTodos(habilitados)} aria-label="Seleccionar todos los pendientes" /></th>}
            <th>N°</th><th>Documento</th>
            {v.has('estudiante') && <th className="ofd-c-estudiante">Estudiante</th>}
            {v.has('tipo') && <th className="ofd-c-tipo">Tipo</th>}
            {v.has('curso') && <th className="ofd-c-curso">Curso</th>}
            {v.has('estado') && <th className="ofd-c-estado">Estado</th>}
            {v.has('despacho') && <th className="ofd-c-despacho">Paso actual</th>}
            {v.has('version') && <th className="ofd-c-version">Versión</th>}
            {v.has('espera') && <th className="ofd-c-espera">En trámite</th>}
            {v.has('fecha') && <th className="ofd-c-fecha">Actualizado</th>}
            <th className="ofd-c-acc">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.map(d => {
            const paso = d.estado === 'en_ruta' ? (d.ruta || [])[d.paso_actual] : null;
            const devol = numObservaciones(d);
            const nota = d.estado === 'observado' ? (d.historial_recorrido || []).slice().reverse().find(h => h.accion === 'observado')?.comentario : null;
            return (
              <tr key={d.id} className={(seleccionadoId === d.id ? 'ofd-sel ' : '') + (d.puede_actuar ? 'ofd-pend' : '')}>
                {conLote && (
                  <td className="ofd-c-sel">
                    <input type="checkbox" checked={seleccion.has(d.id)} disabled={!d.puede_actuar} onChange={() => onToggle(d.id)} aria-label={`Seleccionar ${d.numero || d.titulo}`} />
                  </td>
                )}
                <td data-label="N°" className="ofd-num">{d.numero || 'Sin número'}</td>
                <td data-label="Documento" className="ofd-doc">
                  <button type="button" className="ofd-abrir" onClick={() => onSelect(d.id)} aria-label={`Abrir ${d.titulo || 'documento'}`}><strong>{d.titulo || 'Sin título'}</strong></button>
                  {!v.has('tipo') && <small>{etiquetaTipo(d.tipo)}{d.es_seguimiento && ' · seguimiento'}</small>}
                  {nota && <small className="ofd-nota">{nota}</small>}
                </td>
                {v.has('estudiante') && (
                  <td data-label="Estudiante" className="ofd-est ofd-c-estudiante">
                    <span>{nombreEst(d.estudiante_id)}</span>
                    {cedulaEst(d.estudiante_id) && <small className="ofd-mono">{cedulaEst(d.estudiante_id)}</small>}
                    {!v.has('curso') && <small>{[d.curso, d.paralelo].filter(Boolean).join(' ')}</small>}
                  </td>
                )}
                {v.has('tipo') && <td data-label="Tipo" className="ofd-c-tipo"><span className="ofd-chip">{etiquetaTipo(d.tipo)}</span></td>}
                {v.has('curso') && <td data-label="Curso" className="ofd-c-curso">{[d.curso, d.paralelo].filter(Boolean).join(' ') || '—'}</td>}
                {v.has('estado') && <td data-label="Estado" className="ofd-c-estado"><EstadoBadge estado={d.estado} /></td>}
                {v.has('despacho') && (
                  <td data-label="Paso actual" className="ofd-c-despacho">
                    {paso ? <><span>{etiquetaCargo(paso.cargo)}</span><PasosMini doc={d} /></> : d.estado === 'observado' ? <><span>Emisor</span><PasosMini doc={d} /></> : <span className="ofd-muted">Ruta cerrada</span>}
                  </td>
                )}
                {v.has('version') && (
                  <td data-label="Versión" className="ofd-c-version">
                    <span className={'ofd-chip' + (d.version > LIMITE_VERSIONES ? ' ofd-chip-err' : '')}>v{d.version}</span>
                    {devol > 0 && <small>{devol} devol.</small>}
                  </td>
                )}
                {v.has('espera') && <td data-label="En trámite" className="ofd-c-espera"><EsperaTag doc={d} /></td>}
                {v.has('fecha') && <td data-label="Actualizado" className="ofd-fecha ofd-c-fecha">{fmtFecha(d.updated_at)}</td>}
                <td className="ofd-c-acc">
                  <span className="ofd-acc">
                    <button type="button" className="ofd-ico" title="Ver documento" aria-label={`Ver documento ${d.numero || ''}`} onClick={() => onVer(d.id)}><span className="ti ti-eye" /></button>
                    <button type="button" className="ofd-ico" title="Seguir el recorrido" aria-label={`Seguir el recorrido de ${d.numero || 'este documento'}`} onClick={() => onRecorrido(d.id)}><span className="ti ti-route" /></button>
                    {d.puede_actuar && onDecidir && (<>
                      <button type="button" className="ofd-ico ofd-ico-ok" title="Aprobar" aria-label={`Aprobar ${d.numero || ''}`} onClick={() => onDecidir(d.id, 'aprobar')}><span className="ti ti-check" /></button>
                      <button type="button" className="ofd-ico ofd-ico-warn" title="Observar" aria-label={`Observar ${d.numero || ''}`} onClick={() => onDecidir(d.id, 'observar')}><span className="ti ti-message-exclamation" /></button>
                      <button type="button" className="ofd-ico ofd-ico-err" title="Rechazar" aria-label={`Rechazar ${d.numero || ''}`} onClick={() => onDecidir(d.id, 'rechazar')}><span className="ti ti-ban" /></button>
                    </>)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
export { semaforoEspera, fmtEspera };
