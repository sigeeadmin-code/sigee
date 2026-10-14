import React, { useEffect, useRef, useState } from 'react';
import { buscarEstudiantesAsistencia } from '../lib/data.js';

// Búsqueda rápida de estudiantes por nombre o cédula (cualquier orden de palabras, sin importar tildes).
export default function BuscadorEstudianteAsistencia({ institucionId, paraleloIds = null, onSelect, placeholder = 'Buscar estudiante por nombre o cédula…' }) {
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState('');
  const [activo, setActivo] = useState(0);
  const caja = useRef(null);
  const ultima = useRef(0);

  useEffect(() => {
    const consulta = texto.trim();
    if (consulta.length < 2) { setResultados([]); setBuscando(false); setError(''); return; }
    setBuscando(true);
    const id = ++ultima.current;
    const t = setTimeout(async () => {
      try {
        const r = await buscarEstudiantesAsistencia(institucionId, consulta, { paraleloIds });
        if (id === ultima.current) { setResultados(r); setActivo(0); setError(''); }
      } catch (e) { if (id === ultima.current) { setResultados([]); setError('No se pudo buscar: ' + (e.message || e)); } }
      if (id === ultima.current) setBuscando(false);
    }, 250);
    return () => clearTimeout(t);
  }, [texto, institucionId, paraleloIds]);

  // se cierra al hacer clic fuera
  useEffect(() => {
    const fuera = e => { if (caja.current && !caja.current.contains(e.target)) setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, []);

  function elegir(est) {
    setAbierto(false); setTexto(''); setResultados([]);
    onSelect(est);
  }
  function teclas(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActivo(a => Math.min(a + 1, resultados.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && resultados[activo]) { e.preventDefault(); elegir(resultados[activo]); }
    else if (e.key === 'Escape') setAbierto(false);
  }

  const mostrar = abierto && texto.trim().length >= 2;
  return (
    <div ref={caja} style={{ position: 'relative', maxWidth: 520, marginBottom: 12 }}>
      <div style={{ position: 'relative' }}>
        <span className="ti ti-search" style={{ position: 'absolute', left: 12, top: 11, color: 'var(--slate)' }} />
        <input
          className="fc" style={{ paddingLeft: 36, width: '100%' }} value={texto} placeholder={placeholder} autoComplete="off"
          onChange={e => { setTexto(e.target.value); setAbierto(true); }} onFocus={() => setAbierto(true)} onKeyDown={teclas}
        />
      </div>
      {mostrar && (
        <div className="card" style={{ position: 'absolute', zIndex: 30, left: 0, right: 0, top: '100%', marginTop: 4, maxHeight: 340, overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,.18)' }}>
          {buscando && <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--slate)' }}>Buscando…</div>}
          {!buscando && error && <div style={{ padding: '10px 14px', fontSize: 13, color: '#b91c1c' }}>{error}</div>}
          {!buscando && !error && resultados.length === 0 && <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--slate)' }}>Sin resultados para “{texto.trim()}”.</div>}
          {resultados.map((r, i) => (
            <div key={r.id} onMouseDown={e => { e.preventDefault(); elegir(r); }} onMouseEnter={() => setActivo(i)}
              style={{ padding: '8px 14px', cursor: 'pointer', background: i === activo ? 'rgba(8,145,178,.1)' : undefined, borderBottom: '1px solid var(--line, #eee)' }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{r.nombre}</div>
              <div style={{ fontSize: 11.5, color: 'var(--slate)' }}>{r.cedula || 'Sin cédula'}{r.curso ? ` · ${r.curso}` : ''}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
