import React from 'react';
import { bandaDe, fmtNota, enAlerta } from '../lib/rendimiento.js';

/** Etiqueta de nota con el color de su banda (DA/AA/PA/NA). */
export function ChipNota({ valor, grande = false }) {
  const b = bandaDe(valor);
  if (!b) return <span style={{ color: 'var(--slate)' }}>—</span>;
  return <span title={`${b.sigla} · ${b.nombre}`} style={{ background: b.color + '1f', color: b.color, border: `1px solid ${b.color}55`, borderRadius: 999, padding: grande ? '3px 12px' : '1px 9px', fontWeight: 800, fontSize: grande ? 15 : 12.5, whiteSpace: 'nowrap' }}>{fmtNota(valor)}</span>;
}

/** Dona con el reparto por bandas. partes: [{ id, label, valor, color }] */
export function Dona({ partes, centro, subcentro, tam = 170 }) {
  const total = partes.reduce((a, p) => a + p.valor, 0); const R = 62, C = 2 * Math.PI * R; let acum = 0;
  return (
    <div style={{ position: 'relative', width: tam, height: tam, flex: '0 0 auto' }}>
      <svg viewBox="0 0 160 160" width={tam} height={tam} role="img" aria-label="Distribución del rendimiento">
        <circle cx="80" cy="80" r={R} fill="none" stroke="var(--line)" strokeWidth="18" />
        {total > 0 && partes.filter(p => p.valor > 0).map(p => {
          const len = (p.valor / total) * C; const el = <circle key={p.id} cx="80" cy="80" r={R} fill="none" stroke={p.color} strokeWidth="18" strokeDasharray={`${Math.max(0, len - 1.5)} ${C}`} strokeDashoffset={-acum} transform="rotate(-90 80 80)"><title>{`${p.label}: ${p.valor}`}</title></circle>;
          acum += len; return el;
        })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{centro}</div>
        <div style={{ fontSize: 11, color: 'var(--slate)', marginTop: 3 }}>{subcentro}</div>
      </div>
    </div>
  );
}

/** Barras horizontales. items: [{ etiqueta, valor (0-100), texto, color, sub }] */
export function BarrasH({ items, vacio = 'Sin datos todavía.' }) {
  if (!items.length) return <div style={{ color: 'var(--slate)', fontSize: 13, padding: '14px 0' }}>{vacio}</div>;
  return (
    <div style={{ display: 'grid', gap: 9 }}>
      {items.map(it => (
        <div key={it.etiqueta}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12.5, marginBottom: 3 }}>
            <span style={{ fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={it.etiqueta}>{it.etiqueta}</span>
            <span style={{ color: 'var(--slate)', whiteSpace: 'nowrap' }}>{it.texto}</span>
          </div>
          <div style={{ height: 9, borderRadius: 99, background: 'var(--line)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.max(it.valor > 0 ? 3 : 0, Math.min(100, it.valor))}%`, height: '100%', background: it.color, borderRadius: 99, transition: 'width .5s ease' }} />
          </div>
          {it.sub && <div style={{ fontSize: 11, color: 'var(--slate)', marginTop: 2 }}>{it.sub}</div>}
        </div>
      ))}
    </div>
  );
}

/** Mini línea de tendencia (valores 0-10, con la línea de 7). puntos: [[fecha, valor], ...] */
export function Sparkline({ puntos, ancho = 84, alto = 26 }) {
  const v = (puntos || []).map(p => Number(p[1])).filter(n => !Number.isNaN(n));
  if (v.length < 2) return <span style={{ fontSize: 11, color: 'var(--slate)' }}>{v.length ? 'una semana' : '—'}</span>;
  const x = i => 2 + (i / (v.length - 1)) * (ancho - 4); const y = n => 2 + (1 - Math.max(0, Math.min(10, n)) / 10) * (alto - 4);
  const sube = v[v.length - 1] >= v[0]; const color = enAlerta(v[v.length - 1]) ? '#dc2626' : '#15803d';
  return (
    <svg width={ancho} height={alto} role="img" aria-label={sube ? 'Tendencia al alza' : 'Tendencia a la baja'}>
      <line x1="0" x2={ancho} y1={y(7)} y2={y(7)} stroke="var(--line)" strokeDasharray="3 3" />
      <path d={v.map((n, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(n).toFixed(1)}`).join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(v.length - 1)} cy={y(v[v.length - 1])} r="2.6" fill={color} />
    </svg>
  );
}
