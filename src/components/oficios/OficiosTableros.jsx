import React from 'react';
import { etiquetaCargo, etiquetaTipo } from '../../lib/oficiosDocumental.js';
import { fmtDias, fmtEspera, META_TRAMITE_DIAS, SLA_HORAS } from '../../lib/oficiosVista.js';
import { BarrasEspera, BarrasEstado, LineaDiaria } from './Graficos.jsx';

/** Tarjeta de indicador: etiqueta, valor, explicación y, si aplica, accesos directos. */
export function Kpi({ etiqueta, valor, unidad, tono = '', sub, children, onClick, span = 3 }) {
  const Raiz = onClick ? 'button' : 'div';
  return (
    <Raiz type={onClick ? 'button' : undefined} className={'ofd-k ofd-span-' + span + (onClick ? ' ofd-k-btn' : '')} onClick={onClick}>
      <span className="ofd-k-l">{etiqueta}</span>
      <span className={'ofd-k-v ' + tono}>{valor}{unidad && <small>{unidad}</small>}</span>
      {sub && <span className="ofd-k-s">{sub}</span>}
      {children}
    </Raiz>
  );
}
const Panel = ({ titulo, sub, span = 6, children }) => (
  <section className={'ofd-k ofd-g ofd-span-' + span}><h3>{titulo}</h3>{sub && <p className="ofd-k-s">{sub}</p>}{children}</section>
);
const NumLink = ({ n, onAbrir }) => <button type="button" className="ofd-link ofd-num" onClick={() => onAbrir(n.id)}>{n.numero}{n.version > 5 ? ` · v${n.version}` : ''}</button>;

/** «Mis documentos»: lo que el emisor debe corregir o seguir. */
export function TableroEmisor({ r, onAbrir, onEstado }) {
  const { observados, enRuta, borradores, versionAlta, tramite, carga } = r;
  return (
    <div className="ofd-tablero" aria-label="Indicadores de mis documentos">
      <Kpi span={4} etiqueta="Observados por corregir" valor={observados.n} tono={observados.n ? 'ofd-t-warn' : 'ofd-t-ok'} onClick={() => onEstado('observado')}
        sub={observados.n ? `Devueltos por las autoridades. El más antiguo lleva ${observados.masAntiguoDias} ${observados.masAntiguoDias === 1 ? 'día' : 'días'} sin corregir.` : 'No tienes documentos devueltos.'} />
      <Kpi span={4} etiqueta="En ruta" valor={enRuta.n} tono="ofd-t-info" onClick={() => onEstado('en_ruta')}
        sub={enRuta.n ? `Esperando firma en ${enRuta.cargos.map(etiquetaCargo).join(', ') || 'revisión'}.` : 'Nada en revisión ahora.'} />
      <Kpi span={4} etiqueta="Borradores" valor={borradores.n} onClick={() => onEstado('borrador')}
        sub={borradores.n ? 'Sin enviar a la ruta.' : 'No tienes borradores.'} />
      {observados.n > 0 && (
        <section className="ofd-k ofd-span-12 ofd-lista-obs"><span className="ofd-k-l">Corregir primero</span>
          <span className="ofd-chips">{observados.items.map(o => <NumLink key={o.id} n={o} onAbrir={onAbrir} />)}</span></section>
      )}
      <Kpi span={3} etiqueta={`Versión mayor a 5`} valor={versionAlta.n} tono={versionAlta.n ? 'ofd-t-err' : 'ofd-t-ok'}
        sub={versionAlta.doc ? `${versionAlta.doc.numero} va por la versión ${versionAlta.doc.version}: revisar con Inspección.` : 'Ningún documento acumula devoluciones en exceso.'} />
      <Kpi span={3} etiqueta="Tiempo medio de trámite" valor={fmtDias(tramite.medioDias).replace(' d', '')} unidad={tramite.medioDias == null ? '' : ' días'}
        tono={tramite.dentroMeta === false ? 'ofd-t-warn' : 'ofd-t-ok'} sub={`Meta institucional: ${META_TRAMITE_DIAS} días.${tramite.medioDias == null ? ' Aún no hay trámites cerrados.' : ''}`} />
      <Panel span={6} titulo="Carga por estado" sub="Tus documentos"><BarrasEstado datos={carga} /></Panel>
    </div>
  );
}

/** «Por mi cargo»: pendientes de decisión, esperas y ritmo de despacho. */
export function TableroDespacho({ r, onAbrir }) {
  const p = r.pendientes;
  return (
    <div className="ofd-tablero" aria-label="Indicadores de mi despacho">
      <Kpi span={4} etiqueta="Pendientes en mi despacho" valor={p.n} tono="ofd-t-info"
        sub={p.masDe48 ? `${p.masDe48} llevan más de 48 horas esperando tu decisión.` : p.n ? 'Ninguno supera las 48 horas.' : 'Estás al día.'}>
        {p.n > 0 && <span className="ofd-chips ofd-sem"><b className="ofd-t-ok">{p.ok} dentro de 24 h</b><b className="ofd-t-warn">{p.warn} entre 24 y 48 h</b><b className="ofd-t-err">{p.err} sobre 48 h</b></span>}
      </Kpi>
      <Kpi span={4} etiqueta="Espera máxima" valor={r.maxima ? fmtEspera(r.maxima.seg) : '—'} tono={r.maxima && r.maxima.seg / 3600 >= SLA_HORAS ? 'ofd-t-err' : ''}
        sub={r.maxima ? <>Documento <NumLink n={r.maxima} onAbrir={onAbrir} /> sin resolver.</> : 'Sin documentos esperando.'} />
      <Kpi span={4} etiqueta="Espera media" valor={r.mediaSeg == null ? '—' : Math.round(r.mediaSeg / 3600)} unidad={r.mediaSeg == null ? '' : ' h'} tono={r.sobreSla ? 'ofd-t-warn' : 'ofd-t-ok'}
        sub={r.mediaSeg == null ? 'Sin pendientes.' : r.sobreSla ? `Sobre la meta de ${SLA_HORAS} h.` : `Dentro de la meta de ${SLA_HORAS} h.`} />
      <Kpi span={4} etiqueta="Resueltos hoy" valor={r.resueltosHoy.n} tono="ofd-t-ok"
        sub={`${r.resueltosHoy.aprobados} aprobados y ${r.resueltosHoy.observados} observados. Ritmo semanal: ${r.ritmoSemanal.toFixed(1).replace('.', ',')} por día.`} />
      <Kpi span={8} etiqueta="Devoluciones de la semana" valor={r.devolucionesSemana.n}
        sub={`De ${r.devolucionesSemana.despachados} documentos despachados. Tasa de ${r.devolucionesSemana.tasa.toFixed(1).replace('.', ',')} %.`} />
      <Panel span={6} titulo="Espera media por cargo" sub="Horas entre la llegada al despacho y la decisión · últimos 30 días"><BarrasEspera datos={r.esperaPorCargo} /></Panel>
      <Panel span={6} titulo="Llegadas y resoluciones por día" sub="Documentos que ingresan a mi cargo frente a los que despaché"><LineaDiaria serie={r.serieDiaria} /></Panel>
    </div>
  );
}

/** Resumen de «Todos»: carga por estado de todo el plantel. */
export function TableroTodos({ carga, total }) {
  return <div className="ofd-tablero"><Panel span={12} titulo="Carga por estado" sub={`${total} documentos del plantel`}><BarrasEstado datos={carga} /></Panel></div>;
}
export { etiquetaTipo };
