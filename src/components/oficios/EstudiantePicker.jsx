import React, { useMemo, useState } from 'react';

const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Buscador de estudiante (nombre, cédula o curso, en cualquier orden). Sustituye al <select> con todo el plantel. */
export default function EstudiantePicker({ estudiantes, value, onChange, id = 'ofd-est' }) {
  const [q, setQ] = useState('');
  const elegido = estudiantes.find(e => e.id === value);
  const lista = useMemo(() => {
    const t = norm(q).split(/\s+/).filter(Boolean);
    if (!t.length) return [];
    return estudiantes.filter(e => { const p = norm(`${e.nombre} ${e.cedula} ${e.curso} ${e.paralelo}`); return t.every(x => p.includes(x)); }).slice(0, 8);
  }, [q, estudiantes]);

  if (elegido) {
    return (
      <div className="ofd-pick-sel">
        <div><strong>{elegido.nombre}</strong><small>{[elegido.curso, elegido.paralelo].filter(Boolean).join(' ')}{elegido.cedula ? ` · ${elegido.cedula}` : ''}</small></div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { onChange(null); setQ(''); }}>Cambiar</button>
      </div>
    );
  }
  return (
    <div className="ofd-pick">
      <input id={id} className="fc" value={q} onChange={e => setQ(e.target.value)} autoComplete="off"
        placeholder={estudiantes.length ? 'Buscar por nombre, cédula o curso…' : 'No tienes estudiantes asignados'} disabled={!estudiantes.length} />
      {lista.length > 0 && (
        <ul className="ofd-pick-list" role="listbox">
          {lista.map(e => (
            <li key={e.id}>
              <button type="button" role="option" onClick={() => onChange(e)}>
                <strong>{e.nombre}</strong><small>{[e.curso, e.paralelo].filter(Boolean).join(' ')}{e.cedula ? ` · ${e.cedula}` : ''}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q && !lista.length && <small className="ofd-muted">Sin coincidencias.</small>}
    </div>
  );
}
