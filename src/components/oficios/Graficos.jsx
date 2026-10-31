import React from 'react';
import { etiquetaCargo, etiquetaEstado } from '../../lib/oficiosDocumental.js';
import { SLA_HORAS } from '../../lib/oficiosVista.js';

const nice = max => { if (max <= 4) return 4; const p = 10 ** Math.floor(Math.log10(max)); const m = max / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; };
const TONO_ESTADO = { borrador: '#64748b', observado: 'var(--amber)', en_ruta: 'var(--brand)', aprobado_final: 'var(--green)', entregado: 'var(--green)', archivado: '#94a3b8', rechazado: 'var(--red)' };

/** Horas promedio de espera por cargo, con la meta (SLA) marcada. */
export function BarrasEspera({ datos }) {
  if (!datos.length) return <p className="ofd-muted">Aún no hay decisiones registradas en los últimos 30 días.</p>;
  const tope = Math.max(SLA_HORAS * 2, nice(Math.max(...datos.map(d => d.horas)) * 1.1));
  const x = h => (h / tope) * 100;
  return (
    <div className="ofd-bh" role="img" aria-label={'Espera media por cargo: ' + datos.map(d => `${etiquetaCargo(d.cargo)} ${d.horas.toFixed(0)} h`).join(', ')}>
      <div className="ofd-bh-sla" style={{ left: `calc(112px + (100% - 160px) * ${SLA_HORAS / tope})` }}><span>Meta {SLA_HORAS} h</span></div>
      {datos.map(d => (
        <div className="ofd-bh-f" key={d.cargo}>
          <span className="ofd-bh-l">{etiquetaCargo(d.cargo)}</span>
          <span className="ofd-bh-pista"><span className={'ofd-bh-b ' + (d.horas > SLA_HORAS ? 'ofd-b-warn' : 'ofd-b-ok')} style={{ width: x(d.horas) + '%' }} /></span>
          <span className="ofd-bh-v">{d.horas < 10 ? d.horas.toFixed(1).replace('.', ',') : Math.round(d.horas)} h</span>
        </div>
      ))}
    </div>
  );
}

const diaCorto = k => { const [y, m, d] = k.split('-').map(Number); const f = new Date(y, m - 1, d); return `${['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][f.getDay()]} ${d}`; };

/** Llegadas y resoluciones por día (dos líneas). */
export function LineaDiaria({ serie }) {
  const W = 600, H = 190, L = 28, R = 24, T = 10, B = 26;
  const max = nice(Math.max(1, ...serie.flatMap(s => [s.llegadas, s.resueltos])));
  const px = i => L + (i * (W - L - R)) / Math.max(1, serie.length - 1);
  const py = v => T + (1 - v / max) * (H - T - B);
  const ruta = k => serie.map((s, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${py(s[k]).toFixed(1)}`).join(' ');
  const area = k => `${ruta(k)} L${px(serie.length - 1)},${py(0)} L${px(0)},${py(0)} Z`;
  const pasos = [0, max / 2, max];
  const total = k => serie.reduce((a, s) => a + s[k], 0);
  return (
    <div>
      <div className="ofd-leyenda"><span><i className="ofd-pt ofd-pt-llega" /> Llegaron ({total('llegadas')})</span><span><i className="ofd-pt ofd-pt-res" /> Resueltos ({total('resueltos')})</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} className="ofd-linea-svg" role="img" aria-label={`Llegadas y resoluciones de los últimos ${serie.length} días`}>
        {pasos.map(v => <g key={v}><line x1={L} x2={W - R} y1={py(v)} y2={py(v)} className="ofd-grid" /><text x={L - 6} y={py(v) + 4} textAnchor="end" className="ofd-eje">{Math.round(v)}</text></g>)}
        <path d={area('llegadas')} className="ofd-area-llega" /><path d={ruta('llegadas')} className="ofd-lin-llega" />
        <path d={area('resueltos')} className="ofd-area-res" /><path d={ruta('resueltos')} className="ofd-lin-res" />
        {serie.map((s, i) => (i % 2 === (serie.length - 1) % 2) && <text key={s.clave} x={px(i)} y={H - 7} textAnchor="middle" className="ofd-eje">{diaCorto(s.clave)}</text>)}
      </svg>
    </div>
  );
}

/** Carga por estado (barras verticales). */
export function BarrasEstado({ datos }) {
  const max = nice(Math.max(1, ...datos.map(d => d.n)));
  return (
    <div className="ofd-bv" role="img" aria-label={'Carga por estado: ' + datos.map(d => `${etiquetaEstado(d.estado)} ${d.n}`).join(', ')}>
      <div className="ofd-bv-cols">
        {datos.map(d => (
          <div className="ofd-bv-c" key={d.estado}>
            <span className="ofd-bv-n">{d.n}</span>
            <span className="ofd-bv-b" style={{ height: `${Math.max(d.n ? 6 : 2, (d.n / max) * 100)}%`, background: TONO_ESTADO[d.estado] }} />
            <span className="ofd-bv-l">{etiquetaEstado(d.estado)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
