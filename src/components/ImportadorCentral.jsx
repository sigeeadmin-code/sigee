import React, { useRef, useState } from 'react';
import { leerArchivo } from '../lib/leerHojas.js';
import { leerMatriz, leerObjetos } from '../lib/importCentral.js';
import { cedulasExistentesCentral, importarCentral } from '../lib/data.js';

const overlay = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 70, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '4vh 12px', overflowY: 'auto' };
const caja = { background: 'var(--card, #fff)', borderRadius: 14, width: '100%', maxWidth: 820, boxShadow: '0 20px 50px rgba(0,0,0,.28)' };
const MAX_ARCHIVO_MB = 25;

// Importa un archivo (Excel, CSV o JSON) a una base central. Solo Super Admin.
export default function ImportadorCentral({ cfg, autorId, onClose, onTerminar }) {
  const [paso, setPaso] = useState('archivo');   // archivo → revision → importando → resultado
  const [error, setError] = useState('');
  const [leyendo, setLeyendo] = useState(false);
  const [nombre, setNombre] = useState('');
  const [lectura, setLectura] = useState(null);
  const [existentes, setExistentes] = useState(new Set());
  const [progreso, setProgreso] = useState({ hecho: 0, total: 1 });
  const [resultado, setResultado] = useState(null);
  const entrada = useRef(null);
  const esBase = cfg.tabla.startsWith('base_');

  async function elegir(file) {
    if (!file) return;
    setError(''); setLeyendo(true);
    try {
      if (file.size > MAX_ARCHIVO_MB * 1024 * 1024) throw new Error(`El archivo pesa más de ${MAX_ARCHIVO_MB} MB.`);
      let r;
      if (/\.json$/i.test(file.name)) {
        let datos;
        try { datos = JSON.parse(await file.text()); } catch { throw new Error('El JSON no es válido.'); }
        r = leerObjetos(cfg, datos);
      } else {
        const libro = await leerArchivo(file);
        if (!libro.length) throw new Error('El archivo no tiene datos.');
        // se usa la hoja que más registros válidos entregue
        const lecturas = libro.map(h => ({ hoja: h.nombre, r: leerMatriz(cfg, h.matriz) }));
        const buenas = lecturas.filter(x => !x.r.error);
        if (!buenas.length) throw new Error(lecturas[0].r.error);
        r = buenas.reduce((a, b) => (b.r.filas.length > a.r.filas.length ? b : a)).r;
      }
      if (r.error) throw new Error(r.error);
      if (!r.filas.length) throw new Error('No encontré registros válidos en el archivo.');
      setExistentes(await cedulasExistentesCentral(cfg));
      setNombre(file.name); setLectura(r); setPaso('revision');
    } catch (e) { setError(e.message || String(e)); }
    setLeyendo(false);
    if (entrada.current) entrada.current.value = '';
  }

  const filas = lectura?.filas || [];
  const yaExisten = filas.filter(f => f.cedula && existentes.has(f.cedula)).length;
  const nuevos = filas.length - yaExisten;
  const conTitulos = filas.filter(f => f.titulos?.length).length;

  async function importar() {
    setPaso('importando'); setProgreso({ hecho: 0, total: filas.length });
    try {
      const res = await importarCentral(cfg, filas, { existentes, autorId, onProgreso: setProgreso });
      setResultado(res);
    } catch (e) { setResultado({ nuevos: 0, actualizados: 0, omitidos: 0, fallos: [{ filas: filas.length, motivo: e.message || String(e) }] }); }
    setPaso('resultado');
    onTerminar?.();
  }

  const cerrar = () => { if (paso !== 'importando') onClose(); };

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) cerrar(); }}>
      <div style={caja}>
        <div className="ch"><h3>⬆️ Importar · {cfg.titulo}</h3><button className="btn btn-ghost btn-sm" onClick={cerrar} disabled={paso === 'importando'}>✕</button></div>
        <div className="cb">
          {error && <div className="lerr" style={{ display: 'flex', marginBottom: 12 }}>{error}</div>}

          {paso === 'archivo' && (
            <div>
              <p style={{ fontSize: 13, marginTop: 0 }}>
                Sube un archivo <strong>Excel, CSV o JSON</strong>. Las columnas pueden venir en cualquier orden; reconozco “Cédula”, “Apellidos y nombres”, {cfg.campos.slice(2, 5).map(c => `“${c.t}”`).join(', ')}…
                {cfg.tabla === 'base_docentes' && <> Si un docente tiene varios títulos, repite su cédula en una fila por título (columnas “Título”, “Institución del título”, “N° de registro”…).</>}
              </p>
              <p style={{ fontSize: 12.5, color: 'var(--slate)' }}>
                {esBase
                  ? 'Si la cédula ya existe, solo se completan los datos que traiga el archivo: una celda vacía no borra nada y no se cambia el plantel asignado.'
                  : 'Si la cédula ya está registrada en esta lista, esa fila se omite.'}{' '}
                Antes de guardar verás un resumen.
              </p>
              <input ref={entrada} type="file" accept=".xlsx,.xls,.csv,.json" onChange={e => elegir(e.target.files?.[0])} disabled={leyendo} />
              {leyendo && <p style={{ fontSize: 13 }}>Leyendo el archivo…</p>}
            </div>
          )}

          {paso === 'revision' && lectura && (
            <div>
              <p style={{ margin: '0 0 10px', fontSize: 13 }}><strong>{nombre}</strong> · {lectura.totalFilas.toLocaleString('es-EC')} filas leídas</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                <div className="card" style={{ margin: 0, padding: '10px 16px' }}><div style={{ fontSize: 22, fontWeight: 800 }}>{nuevos.toLocaleString('es-EC')}</div><div style={{ fontSize: 11.5, color: 'var(--slate)' }}>nuevos</div></div>
                <div className="card" style={{ margin: 0, padding: '10px 16px' }}><div style={{ fontSize: 22, fontWeight: 800 }}>{yaExisten.toLocaleString('es-EC')}</div><div style={{ fontSize: 11.5, color: 'var(--slate)' }}>{esBase ? 'ya existen (se completan)' : 'ya existen (se omiten)'}</div></div>
                {cfg.tabla === 'base_docentes' && <div className="card" style={{ margin: 0, padding: '10px 16px' }}><div style={{ fontSize: 22, fontWeight: 800 }}>{conTitulos.toLocaleString('es-EC')}</div><div style={{ fontSize: 11.5, color: 'var(--slate)' }}>con títulos</div></div>}
                <div className="card" style={{ margin: 0, padding: '10px 16px' }}><div style={{ fontSize: 22, fontWeight: 800 }}>{lectura.omitidas.length}</div><div style={{ fontSize: 11.5, color: 'var(--slate)' }}>filas omitidas</div></div>
              </div>

              {lectura.columnas && (
                <p style={{ fontSize: 12.5, margin: '0 0 10px' }}>
                  <strong>Columnas reconocidas:</strong> {lectura.columnas.filter(c => c.campo).map(c => c.encabezado).join(', ') || '—'}
                  {lectura.columnas.some(c => !c.campo) && <><br /><span style={{ color: 'var(--slate)' }}>Ignoradas: {lectura.columnas.filter(c => !c.campo).map(c => c.encabezado).join(', ')}</span></>}
                </p>
              )}
              {lectura.omitidas.length > 0 && (
                <details style={{ marginBottom: 10, fontSize: 12.5 }}>
                  <summary>Ver filas omitidas ({lectura.omitidas.length})</summary>
                  <ul style={{ margin: '6px 0 0 18px' }}>{lectura.omitidas.slice(0, 15).map((o, i) => <li key={i}>Fila {o.fila}: {o.motivo}</li>)}{lectura.omitidas.length > 15 && <li>… y {lectura.omitidas.length - 15} más</li>}</ul>
                </details>
              )}
              {lectura.avisos.length > 0 && (
                <details style={{ marginBottom: 10, fontSize: 12.5 }}>
                  <summary>Avisos ({lectura.avisos.length})</summary>
                  <ul style={{ margin: '6px 0 0 18px' }}>{lectura.avisos.slice(0, 15).map((o, i) => <li key={i}>Fila {o.fila}: {o.motivo}</li>)}</ul>
                </details>
              )}

              <div style={{ overflowX: 'auto', marginBottom: 14 }}>
                <table className="tbl" style={{ width: '100%' }}>
                  <thead><tr>{cfg.columnas.map(c => <th key={c.k}>{c.t}</th>)}</tr></thead>
                  <tbody>{filas.slice(0, 5).map((f, i) => <tr key={i}>{cfg.columnas.map(c => <td key={c.k}>{(c.calc ? c.calc(f) : f[c.k]) ?? '—'}</td>)}</tr>)}</tbody>
                </table>
                <div style={{ fontSize: 11.5, color: 'var(--slate)', marginTop: 4 }}>Primeras 5 filas de {filas.length.toLocaleString('es-EC')}.</div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => { setPaso('archivo'); setLectura(null); }}>Elegir otro archivo</button>
                <button className="btn btn-primary" onClick={importar} disabled={!esBase && nuevos === 0}>Importar {(esBase ? filas.length : nuevos).toLocaleString('es-EC')} registros</button>
              </div>
            </div>
          )}

          {paso === 'importando' && (
            <div style={{ padding: '16px 0' }}>
              <p style={{ fontSize: 13 }}>Guardando… {progreso.hecho.toLocaleString('es-EC')} de {progreso.total.toLocaleString('es-EC')}. No cierres esta ventana.</p>
              <div style={{ height: 10, background: 'var(--line, #e2e8f0)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, Math.round((progreso.hecho / Math.max(1, progreso.total)) * 100))}%`, height: '100%', background: 'var(--brand, #0891b2)', transition: 'width .2s' }} />
              </div>
            </div>
          )}

          {paso === 'resultado' && resultado && (
            <div>
              <p style={{ fontSize: 14, marginTop: 0 }}>
                {resultado.fallos.length === 0 ? '✅ Importación terminada.' : '⚠️ Importación terminada con problemas.'}
              </p>
              <ul style={{ fontSize: 13, margin: '0 0 12px 18px' }}>
                <li>{resultado.nuevos.toLocaleString('es-EC')} registros nuevos</li>
                {esBase && <li>{resultado.actualizados.toLocaleString('es-EC')} registros completados</li>}
                {!esBase && <li>{resultado.omitidos.toLocaleString('es-EC')} omitidos por estar ya registrados</li>}
                {lectura?.omitidas.length > 0 && <li>{lectura.omitidas.length} filas del archivo omitidas por datos faltantes</li>}
              </ul>
              {resultado.fallos.map((f, i) => <div key={i} className="lerr" style={{ display: 'flex', marginBottom: 6 }}>{f.filas} registros no se guardaron: {f.motivo}</div>)}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="btn btn-primary" onClick={onClose}>Cerrar</button></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
