import React, { useRef, useState } from 'react';

const W = 800, PAD = { l: 38, r: 12, t: 12, b: 26 };

/**
 * Gráfico lineal en SVG (sin librerías). Eje Y siempre en % (0-100).
 * series: [{ id, label, color, puntos: [{ valor, pct, texto }] }] — todas con el mismo número de puntos.
 * etiquetas: texto del eje X por punto. marcas: índices a resaltar (picos). umbral: línea horizontal en %.
 */
export default function GraficoLineas({ series, etiquetas, alto = 230, marcas = [], umbral = null, umbralTexto = null, cadaX = 6, titulo, fmtY = g => `${g}%`, seleccion = null, onSeleccionar = null }) {
  const ref = useRef(null);
  const [idx, setIdx] = useState(null);
  const n = etiquetas.length;
  const H = alto, iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const x = i => PAD.l + (n <= 1 ? 0 : (i / (n - 1)) * iw);
  const y = pct => PAD.t + ih - (Math.max(0, Math.min(100, pct)) / 100) * ih;
  const ruta = pts => pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.pct).toFixed(1)}`).join(' ');

  function mover(e) {
    const r = ref.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setIdx(Math.max(0, Math.min(n - 1, Math.round(((px - PAD.l) / iw) * (n - 1)))));
  }

  return (
    <div style={{ position: 'relative' }}>
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={titulo}
        onMouseMove={mover} onMouseLeave={() => setIdx(null)} onClick={() => { if (onSeleccionar && idx != null) onSeleccionar(idx); }} style={{ display: 'block', touchAction: 'pan-y', cursor: onSeleccionar ? 'pointer' : 'default' }} onTouchStart={e => mover(e.touches[0])} onTouchMove={e => mover(e.touches[0])}>
        {[0, 25, 50, 75, 100].map(g => (
          <g key={g}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(g)} y2={y(g)} stroke="var(--line)" strokeDasharray={g ? '3 4' : ''} />
            <text x={PAD.l - 6} y={y(g) + 4} textAnchor="end" fontSize="11" fill="var(--slate)">{fmtY(g)}</text>
          </g>
        ))}
        {umbral != null && <g><line x1={PAD.l} x2={W - PAD.r} y1={y(umbral)} y2={y(umbral)} stroke="var(--red)" strokeDasharray="6 4" opacity=".7" /><text x={W - PAD.r} y={y(umbral) - 4} textAnchor="end" fontSize="10.5" fill="var(--red)">{umbralTexto ?? `umbral ${umbral}%`}</text></g>}
        {etiquetas.map((t, i) => (i % cadaX === 0 || i === n - 1) && <text key={i} x={x(i)} y={H - 7} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fontSize="11" fill="var(--slate)">{t}</text>)}
        {series.length === 1 && <path d={`${ruta(series[0].puntos)} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={series[0].color} opacity=".12" />}
        {series.map(s => <path key={s.id} d={ruta(s.puntos)} fill="none" stroke={s.color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />)}
        {series.flatMap(s => marcas.map(i => <circle key={s.id + i} cx={x(i)} cy={y(s.puntos[i].pct)} r="4.5" fill="var(--white)" stroke="var(--red)" strokeWidth="2.2" />))}
        {seleccion != null && seleccion < n && <g><rect x={x(seleccion) - 10} y={PAD.t} width={20} height={ih} fill="var(--brand, #0891b2)" opacity=".12" rx="4" /><line x1={x(seleccion)} x2={x(seleccion)} y1={PAD.t} y2={PAD.t + ih} stroke="var(--brand, #0891b2)" strokeWidth="2" /></g>}
        {idx != null && <g>
          <line x1={x(idx)} x2={x(idx)} y1={PAD.t} y2={PAD.t + ih} stroke="var(--slate)" opacity=".5" />
          {series.map(s => <circle key={s.id} cx={x(idx)} cy={y(s.puntos[idx].pct)} r="4" fill={s.color} />)}
        </g>}
      </svg>
      {idx != null && (
        <div style={{ position: 'absolute', top: 4, left: `${Math.min(70, Math.max(0, (x(idx) / W) * 100 - 8))}%`, background: 'var(--ink)', color: '#fff', borderRadius: 8, padding: '6px 10px', fontSize: 12, pointerEvents: 'none', boxShadow: '0 6px 18px rgba(0,0,0,.25)', whiteSpace: 'nowrap', zIndex: 2 }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>{etiquetas[idx]}</div>
          {series.map(s => <div key={s.id}><span style={{ color: s.color }}>●</span> {s.label}: <strong>{s.puntos[idx].texto}</strong></div>)}
        </div>
      )}
    </div>
  );
}
