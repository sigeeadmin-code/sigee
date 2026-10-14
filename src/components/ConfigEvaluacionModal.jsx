import React, { useMemo, useState } from 'react';
import { configPorDefecto, pesosConfig, validarConfig } from '../lib/calificaciones.js';

const SECCIONES = [
  ['ind', '📑 Aportes Individuales', 'Nombre del aporte', 'Agregar aporte'],
  ['grp', '👥 Aportes Grupales', 'Nombre del aporte', 'Agregar aporte'],
  ['sum', '🏆 Evaluación Sumativa (30%)', 'Nombre de la evaluación', 'Agregar evaluación sumativa']
];
const MAX_RUBROS = 12;
const fmt1 = n => Number(n).toFixed(1);

/**
 * Modal "Configuración de Evaluación" (aportes, N° de actividades y pesos; formativa 70% + sumativa 30%).
 * Si la materia ya tiene notas (bloqueada = true) solo se pueden renombrar los rubros y cambiar su N° de casilleros:
 * agregar, quitar o cambiar el peso de un rubro dañaría las notas ya registradas.
 */
export default function ConfigEvaluacionModal({ cfgInicial, bloqueada, guardando, onGuardar, onClose }) {
  const [cfg, setCfg] = useState(() => JSON.parse(JSON.stringify(cfgInicial)));
  const [error, setError] = useState('');
  const t = useMemo(() => pesosConfig(cfg), [cfg]);
  const errores = useMemo(() => validarConfig({
    ind: cfg.ind.map(g => ({ ...g, n: Number(g.n), nombre: String(g.nombre).trim() })),
    grp: cfg.grp.map(g => ({ ...g, n: Number(g.n), nombre: String(g.nombre).trim() })),
    sum: cfg.sum.map(g => ({ ...g, n: Number(g.n), nombre: String(g.nombre).trim() }))
  }), [cfg]);
  const nombres = [...cfg.ind, ...cfg.grp, ...cfg.sum].map(g => String(g.nombre).trim().toLowerCase());
  const repetidos = new Set(nombres).size !== nombres.length;
  const okPesos = Math.abs(t.formativo - 70) < 0.005 && Math.abs(t.sumativo - 30) < 0.005;
  const valido = errores.length === 0 && !repetidos && cfg.sum.length > 0 && cfg.ind.length + cfg.grp.length > 0;

  const cambiar = (tipo, i, campo, valor) => setCfg(c => ({ ...c, [tipo]: c[tipo].map((g, k) => (k === i ? { ...g, [campo]: valor } : g)) }));
  const agregar = tipo => setCfg(c => (c[tipo].length >= MAX_RUBROS ? c : { ...c, [tipo]: [...c[tipo], { nombre: tipo === 'sum' ? 'Nueva evaluación' : 'Nuevo aporte', n: 1, peso: 0 }] }));
  const quitar = (tipo, i) => setCfg(c => ({ ...c, [tipo]: c[tipo].filter((_, k) => k !== i) }));
  const restaurar = () => { if (window.confirm('¿Restaurar la plantilla institucional? Se perderán los cambios que no hayas guardado.')) setCfg(configPorDefecto()); };

  const guardar = async () => {
    setError('');
    if (!valido) { setError(repetidos ? 'Hay dos rubros con el mismo nombre.' : errores[0] || 'Revisa la configuración.'); return; }
    try {
      await onGuardar({
        ind: cfg.ind.map(g => ({ nombre: String(g.nombre).trim(), n: Number(g.n), peso: Number(g.peso) })),
        grp: cfg.grp.map(g => ({ nombre: String(g.nombre).trim(), n: Number(g.n), peso: Number(g.peso) })),
        sum: cfg.sum.map(g => ({ nombre: String(g.nombre).trim(), n: Number(g.n), peso: Number(g.peso) }))
      });
    } catch (e) { setError(e.message || 'No se pudo guardar.'); }
  };

  const celda = { border: '1px solid var(--line, #dbe2ef)', borderRadius: 8, padding: '8px 10px', fontSize: 14, background: '#fff', width: '100%' };
  const fila = (tipo, g, i) => (
    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 68px 78px 34px', gap: 8, alignItems: 'center', marginBottom: 8 }}>
      <input style={celda} value={g.nombre} maxLength={60} onChange={e => cambiar(tipo, i, 'nombre', e.target.value)} />
      <input style={{ ...celda, textAlign: 'center' }} type="number" min="1" max="10" step="1" title="N° de actividades (1 a 10)" value={g.n} onChange={e => cambiar(tipo, i, 'n', e.target.value)} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input style={{ ...celda, textAlign: 'center', background: bloqueada ? '#f1f5f9' : '#fff' }} type="number" min="0" max="100" step="0.5" disabled={bloqueada} title="Peso %" value={g.peso} onChange={e => cambiar(tipo, i, 'peso', e.target.value)} />
        <span style={{ fontSize: 12, color: 'var(--slate)' }}>%</span>
      </div>
      <button type="button" className="btn btn-ghost btn-sm" disabled={bloqueada} title={bloqueada ? 'Hay notas guardadas: no se pueden quitar rubros' : 'Eliminar'} onClick={() => quitar(tipo, i)}>🗑️</button>
    </div>
  );
  const encabezado = etiqueta => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 68px 78px 34px', gap: 8, fontSize: 11.5, fontWeight: 700, color: 'var(--slate)', marginBottom: 4 }}>
      <div>{etiqueta}</div><div style={{ textAlign: 'center' }}>N° Act.</div><div>Peso %</div><div />
    </div>
  );

  return (
    <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget && !guardando) onClose(); }}>
      <div className="modal" style={{ maxWidth: 820, width: '96vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <h3 style={{ margin: 0 }}>⚙️ Configuración de Evaluación</h3>
            <div style={{ fontSize: 12.5, color: 'var(--slate)', marginTop: 2 }}>Define los aportes, número de actividades y porcentajes (Formativa 70% + Sumativa 30%)</div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={guardando} aria-label="Cerrar">✕</button>
        </div>
        <div className="modal-b" style={{ overflowY: 'auto' }}>
          <div style={{ borderLeft: '4px solid ' + (okPesos ? '#2f9e44' : '#e8590c'), background: okPesos ? '#ebfbee' : '#fff4e6', borderRadius: 6, padding: '10px 14px', fontSize: 13.5, marginBottom: 14 }}>
            {okPesos ? '✅' : '⚠️'} <strong>Formativa (individuales + grupales):</strong> {fmt1(t.formativo)}%{!okPesos && Math.abs(t.formativo - 70) >= 0.005 ? ' (debe sumar 70%)' : ''} · <strong>Sumativa:</strong> {fmt1(t.sumativo)}%{!okPesos && Math.abs(t.sumativo - 30) >= 0.005 ? ' (debe sumar 30%)' : ''} · <strong>Total:</strong> {fmt1(t.total)}%
          </div>
          {bloqueada && (
            <div style={{ background: '#f1f5f9', borderRadius: 6, padding: '8px 12px', fontSize: 12.5, marginBottom: 14 }}>
              🔒 Esta materia ya tiene notas guardadas. Puedes renombrar los rubros y cambiar su N° de casilleros (sin quitar los que ya tienen notas); agregar, quitar o cambiar pesos queda bloqueado.
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 24 }}>
            {SECCIONES.slice(0, 2).map(([tipo, titulo, etq, textoAgregar]) => (
              <div key={tipo}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{titulo}</div>
                {encabezado(etq)}
                {cfg[tipo].map((g, i) => fila(tipo, g, i))}
                <button type="button" className="btn btn-secondary btn-sm" disabled={bloqueada || cfg[tipo].length >= MAX_RUBROS} onClick={() => agregar(tipo)}>＋ {textoAgregar}</button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{SECCIONES[2][1]}</div>
            {encabezado(SECCIONES[2][2])}
            {cfg.sum.map((g, i) => fila('sum', g, i))}
            <button type="button" className="btn btn-secondary btn-sm" disabled={bloqueada || cfg.sum.length >= MAX_RUBROS} onClick={() => agregar('sum')}>＋ {SECCIONES[2][3]}</button>
          </div>
          {(error || (!valido && errores.length > 0 && okPesos)) && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 12 }}>{error || errores[0]}</p>}
          {repetidos && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 8 }}>Hay dos rubros con el mismo nombre; cada nombre debe ser distinto.</p>}
        </div>
        <div className="modal-f" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <button type="button" className="btn btn-secondary" disabled={bloqueada || guardando} onClick={restaurar} title={bloqueada ? 'Bloqueado: la materia ya tiene notas' : ''}>↺ Restaurar Plantilla</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary" disabled={guardando} onClick={onClose}>Cancelar</button>
            <button type="button" className="btn btn-primary" disabled={guardando || !valido} onClick={guardar} title={valido ? '' : 'La configuración debe sumar 70% + 30% y no tener errores'}>{guardando ? 'Guardando…' : '💾 Guardar Configuración'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
