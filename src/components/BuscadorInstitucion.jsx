import React, { useEffect, useMemo, useRef, useState } from 'react';
import { buscarInstituciones } from '../lib/busquedaInstituciones.js';

/**
 * Selector de institución con búsqueda por nombre o por código AMIE.
 * No admite texto libre: hay que ELEGIR una institución de la lista (así no se puede crear un usuario en un plantel mal escrito).
 * Una vez elegida se muestra con su AMIE para poder verificarla de un vistazo.
 */
export default function BuscadorInstitucion({ instituciones, value, onChange, cargando = false }) {
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const caja = useRef(null);

  const elegida = useMemo(() => (instituciones || []).find(i => i.id === value) || null, [instituciones, value]);
  const resultados = useMemo(() => buscarInstituciones(instituciones, texto, 30), [instituciones, texto]);

  useEffect(() => { setActivo(0); }, [texto]);
  useEffect(() => {
    const fuera = e => { if (caja.current && !caja.current.contains(e.target)) setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, []);

  function elegir(inst) {
    onChange(inst.id, inst);
    setTexto(''); setAbierto(false);
  }
  function onKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAbierto(true); setActivo(a => Math.min(a + 1, resultados.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { if (abierto && resultados[activo]) { e.preventDefault(); elegir(resultados[activo]); } }   // Enter nunca envía el formulario mientras se busca
    else if (e.key === 'Escape') { if (abierto) { e.stopPropagation(); setAbierto(false); } }
  }

  if (elegida) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--green, #16a34a)', background: 'rgba(22,163,74,.07)', borderRadius: 10, padding: '8px 10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={elegida.nombre}>{elegida.nombre}</div>
          <div style={{ fontSize: 11.5, color: 'var(--slate)' }}>
            AMIE <strong style={{ fontFamily: 'monospace' }}>{elegida.amie || '—'}</strong>
            {(elegida.canton || elegida.provincia) ? ` · ${[elegida.canton, elegida.provincia].filter(Boolean).join(', ')}` : ''}
          </div>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange('', null)}>Cambiar</button>
      </div>
    );
  }

  const hayTexto = texto.trim().length > 0;
  return (
    <div ref={caja} style={{ position: 'relative' }}>
      <input
        className="fc" value={texto} autoComplete="off"
        placeholder={cargando ? 'Cargando instituciones…' : 'Busca por nombre o por código AMIE…'}
        onChange={e => { setTexto(e.target.value); setAbierto(true); }}
        onFocus={() => setAbierto(true)}
        onKeyDown={onKeyDown}
        role="combobox" aria-expanded={abierto} aria-autocomplete="list"
      />
      {abierto && hayTexto && (
        <div role="listbox" style={{ position: 'absolute', zIndex: 20, left: 0, right: 0, top: 'calc(100% + 4px)', maxHeight: 260, overflowY: 'auto', background: 'var(--card, #fff)', border: '1px solid var(--line)', borderRadius: 10, boxShadow: '0 10px 28px rgba(0,0,0,.18)' }}>
          {resultados.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--slate)' }}>
              Sin resultados para “{texto.trim()}”. Prueba con parte del nombre o con el código AMIE completo.
            </div>
          ) : resultados.map((i, k) => (
            <div key={i.id} role="option" aria-selected={k === activo}
              onMouseEnter={() => setActivo(k)}
              onMouseDown={e => { e.preventDefault(); elegir(i); }}
              style={{ padding: '8px 12px', cursor: 'pointer', background: k === activo ? 'rgba(79,70,229,.09)' : undefined, borderBottom: '1px solid var(--line)' }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{i.nombre}</div>
              <div style={{ fontSize: 11.5, color: 'var(--slate)' }}>
                AMIE <span style={{ fontFamily: 'monospace' }}>{i.amie || '—'}</span>
                {(i.canton || i.provincia) ? ` · ${[i.canton, i.provincia].filter(Boolean).join(', ')}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}
      {!hayTexto && !cargando && <div style={{ fontSize: 11.5, color: 'var(--slate)', marginTop: 4 }}>Escribe y elige de la lista. Hay {instituciones?.length || 0} instituciones activas.</div>}
    </div>
  );
}
