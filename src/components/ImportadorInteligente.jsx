import React, { useMemo, useRef, useState } from 'react';
import { leerArchivo, MAX_FILAS } from '../lib/leerHojas.js';
import {
  analizarHoja, convertirFilas, marcarDuplicados, camposAActualizar, CAMPOS_COMPLETABLES,
  resolverCurso, ESQUEMAS
} from '../lib/importacionInteligente.js';
import { exportarFilasExcel } from '../lib/cargaMasiva.js';

const overlay = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 70, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '3vh 12px', overflowY: 'auto' };
const caja = { background: 'var(--card, #fff)', borderRadius: 14, width: '100%', maxWidth: 1040, boxShadow: '0 20px 50px rgba(0,0,0,.28)' };
const NOMBRES = { docentes: ['docente', 'docentes'], estudiantes: ['estudiante', 'estudiantes'] };
const plural = (n, tipo) => `${n} ${NOMBRES[tipo][n === 1 ? 0 : 1]}`;

function Confianza({ m }) {
  if (!m.campo) return <span className="badge b-muted">Sin asignar</span>;
  const alta = m.confianza >= 0.85, media = m.confianza >= 0.7;
  return (
    <span className={'badge ' + (alta ? 'b-ok' : media ? 'b-warn' : 'b-err')} title={m.origen === 'contenido' ? 'Lo deduje por los datos de la columna, no por su título' : 'Lo deduje por el título de la columna'}>
      {alta ? 'Segura' : media ? 'Revisar' : 'Dudosa'} · {m.origen === 'contenido' ? 'por contenido' : 'por título'}
    </span>
  );
}

/**
 * Asistente de carga masiva INTELIGENTE.
 *  tipo: 'docentes' | 'estudiantes'
 *  cargarExistentes(): Promise<registros ya guardados>   ·   grados / periodoId: solo estudiantes (curso y matrícula)
 *  guardar({ nuevos, completar, onProgreso }): Promise<resultado>   ·   onTerminar(): refresca la pantalla de fondo
 */
export default function ImportadorInteligente({ tipo, cargarExistentes, grados = [], periodoId = null, guardar, onClose, onTerminar }) {
  const [paso, setPaso] = useState('archivo');           // archivo → mapeo → revision → importando → resultado
  const [error, setError] = useState('');
  const [leyendo, setLeyendo] = useState(false);
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [hojas, setHojas] = useState([]);
  const [iHoja, setIHoja] = useState(0);
  const [analisis, setAnalisis] = useState(null);
  const [mapeo, setMapeo] = useState([]);
  const [orden, setOrden] = useState('apellidos');
  const [existentes, setExistentes] = useState(null);
  const [completarVacios, setCompletarVacios] = useState(false);
  const [filtro, setFiltro] = useState('todas');
  const [progreso, setProgreso] = useState({ fase: '', hecho: 0, total: 1 });
  const [resultado, setResultado] = useState(null);
  const entrada = useRef(null);

  const campos = ESQUEMAS[tipo].campos;
  const usadas = useMemo(() => new Set(mapeo.filter(m => m.campo).map(m => m.campo)), [mapeo]);
  const tieneNombre = ['nombre_completo'].some(c => usadas.has(c)) || ((usadas.has('nombres') || usadas.has('nombre1')) && (usadas.has('apellidos') || usadas.has('apellido1')));

  async function elegirArchivo(file) {
    if (!file) return;
    setError(''); setLeyendo(true);
    try {
      const libro = await leerArchivo(file);
      if (!libro.length) throw new Error('El archivo no tiene datos.');
      const ordenadas = libro.map(h => ({ ...h, a: analizarHoja(h.matriz, tipo) }));
      // la hoja con más columnas reconocidas es la más probable
      const mejor = ordenadas.reduce((b, h, i) => (h.a.mapeo.filter(m => m.campo).length > ordenadas[b].a.mapeo.filter(m => m.campo).length ? i : b), 0);
      setHojas(ordenadas); setNombreArchivo(file.name);
      usarHoja(ordenadas, mejor);
      setPaso('mapeo');
    } catch (e) { setError('No pude leer el archivo: ' + (e.message || e)); }
    setLeyendo(false);
    if (entrada.current) entrada.current.value = '';
  }
  function usarHoja(lista, i) {
    setIHoja(i); setAnalisis(lista[i].a); setMapeo(lista[i].a.mapeo); setOrden(lista[i].a.orden);
  }
  function cambiarCampo(indice, campo) {
    setMapeo(ms => ms.map(m => {
      if (m.indice === indice) return { ...m, campo: campo || null, confianza: campo ? 1 : 0, origen: campo ? 'encabezado' : null };
      if (campo && m.campo === campo) return { ...m, campo: null, confianza: 0, origen: null };   // un campo = una columna
      return m;
    }));
  }

  // ───── revisión ─────
  const registros = useMemo(() => {
    if (paso !== 'revision' && paso !== 'importando' && paso !== 'resultado') return [];
    if (!analisis || !existentes) return [];
    const base = convertirFilas(analisis.filas, mapeo, tipo, { orden, filaInicial: (analisis.filaEncabezado >= 0 ? analisis.filaEncabezado : 0) + 2 });
    const conDup = marcarDuplicados(base, existentes);
    return conDup.map(r => {
      if (tipo !== 'estudiantes' || r.error) return r;
      const c = resolverCurso(r.cursoTxt, r.paraleloTxt, grados);
      return { ...r, gradoId: c.gradoId, paraleloId: c.paraleloId, avisos: c.aviso ? [...r.avisos, c.aviso + ' (se creó sin matrícula)'] : r.avisos, cursoTxt: r.cursoTxt };
    });
  }, [paso, analisis, mapeo, orden, existentes, tipo, grados]);

  const estado = r => (r.error ? 'omitida' : r.duplicado?.tipo === 'archivo' ? 'repetida' : r.duplicado?.tipo === 'existente' ? 'existe' : 'nueva');
  const cuentas = useMemo(() => {
    const c = { total: registros.length, nueva: 0, existe: 0, repetida: 0, omitida: 0, conAvisos: 0 };
    registros.forEach(r => { c[estado(r)]++; if (!r.error && r.avisos.length) c.conAvisos++; });
    return c;
  }, [registros]);

  const paraGuardar = useMemo(() => {
    const nuevos = registros.filter(r => estado(r) === 'nueva').map(r => ({ fila: r.fila, datos: r.datos, gradoId: r.gradoId || null, paraleloId: r.paraleloId || null, representante: r.representante }));
    const existentesPorId = Object.fromEntries((existentes || []).map(e => [e.id, e]));
    const completar = completarVacios
      ? registros.filter(r => estado(r) === 'existe').map(r => ({ fila: r.fila, id: r.duplicado.id, cambios: camposAActualizar(existentesPorId[r.duplicado.id], r.datos, CAMPOS_COMPLETABLES[tipo]) })).filter(c => Object.keys(c.cambios).length)
      : [];
    return { nuevos, completar };
  }, [registros, existentes, completarVacios, tipo]);

  async function irARevision() {
    setError('');
    if (!tieneNombre) { setError('Necesito al menos una columna con el nombre y otra con el apellido (o una con “apellidos y nombres” juntos).'); return; }
    if (analisis.filas.length > MAX_FILAS) { setError(`El archivo tiene ${analisis.filas.length} filas; el máximo por carga es ${MAX_FILAS}. Divídelo en partes.`); return; }
    try {
      setExistentes(await cargarExistentes());
      setPaso('revision');
    } catch (e) { setError('No pude consultar los registros actuales: ' + (e.message || e)); }
  }

  async function importar() {
    if (!paraGuardar.nuevos.length && !paraGuardar.completar.length) return;
    setPaso('importando'); setProgreso({ fase: 'Preparando', hecho: 0, total: 1 });
    try {
      const r = await guardar({ ...paraGuardar, onProgreso: setProgreso });
      setResultado(r); setPaso('resultado');
      onTerminar?.(r);
    } catch (e) { setError('La carga se interrumpió: ' + (e.message || e) + '. Lo ya guardado se conserva; revisa la lista antes de volver a intentar.'); setPaso('revision'); }
  }

  function descargarInforme() {
    const filas = [];
    const fallos = Object.fromEntries((resultado?.fallos || []).map(f => [f.fila, f.motivo]));
    registros.forEach(r => {
      const e = estado(r);
      const nombre = `${r.datos?.apellidos || ''} ${r.datos?.nombres || ''}`.trim();
      let res = 'Creada';
      if (e === 'omitida') res = 'No se importó: ' + r.error;
      else if (e === 'repetida') res = `No se importó: repetida en el archivo (${r.duplicado.por === 'cedula' ? 'misma cédula' : 'mismo nombre'})`;
      else if (e === 'existe') res = (paraGuardar.completar.some(c => c.fila === r.fila) ? 'Ya existía: se completaron sus campos vacíos' : `Ya existía (${r.duplicado.por === 'cedula' ? 'misma cédula' : 'mismo nombre'}): no se cambió`);
      if (fallos[r.fila]) res = 'Falló al guardar: ' + fallos[r.fila];
      filas.push({ 'Fila en el archivo': r.fila, 'Apellidos y nombres': nombre, 'Cédula': r.datos?.cedula || '', 'Resultado': res, 'Avisos / datos que quedaron vacíos': (r.avisos || []).join(' · ') });
    });
    exportarFilasExcel(`informe_carga_${tipo}.xlsx`, filas);
  }

  const visibles = registros.filter(r => (filtro === 'todas' ? true : filtro === 'avisos' ? (!r.error && r.avisos.length) : estado(r) === filtro)).slice(0, 200);
  const ocupado = paso === 'importando';

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget && !ocupado && paso !== 'revision') onClose(); }}>
      <div style={caja}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div>
            <h3 style={{ margin: 0 }}>✨ Carga inteligente de {NOMBRES[tipo][1]}</h3>
            <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 2 }}>
              {['Archivo', 'Columnas', 'Revisión', 'Importación'].map((t, i) => {
                const actual = { archivo: 0, mapeo: 1, revision: 2, importando: 3, resultado: 3 }[paso];
                return <span key={t} style={{ fontWeight: i === actual ? 700 : 400, color: i === actual ? 'var(--brand, #4f46e5)' : undefined }}>{i ? '  ›  ' : ''}{i + 1}. {t}</span>;
              })}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={ocupado}>✕</button>
        </div>

        <div style={{ padding: 20 }}>
          {error && <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 13 }}>{error}</div>}

          {/* 1 · ARCHIVO */}
          {paso === 'archivo' && (
            <div>
              <p style={{ fontSize: 13.5, margin: '0 0 14px' }}>
                Sube tu lista tal como la tengas (Excel o CSV). <strong>Las columnas pueden estar en cualquier orden y llamarse como quieras</strong>:
                yo detecto cuál es la cédula, el nombre, el teléfono, etc., y las acomodo en los campos del sistema. Lo que falte queda vacío para completarlo después.
              </p>
              <div
                onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); elegirArchivo(e.dataTransfer.files?.[0]); }}
                onClick={() => entrada.current?.click()}
                style={{ border: '2px dashed var(--line)', borderRadius: 14, padding: '38px 16px', textAlign: 'center', cursor: 'pointer', background: 'var(--page, #f5f7fc)' }}>
                <div style={{ fontSize: 30 }}>📄</div>
                <div style={{ fontWeight: 700, marginTop: 6 }}>{leyendo ? 'Leyendo el archivo…' : 'Arrastra aquí tu archivo o haz clic para elegirlo'}</div>
                <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 4 }}>.xlsx · .xls · .csv · hasta {MAX_FILAS} filas</div>
                <input ref={entrada} type="file" accept=".xlsx,.xls,.csv,.txt" style={{ display: 'none' }} onChange={e => elegirArchivo(e.target.files?.[0])} />
              </div>
            </div>
          )}

          {/* 2 · COLUMNAS */}
          {paso === 'mapeo' && analisis && (
            <div>
              <p style={{ fontSize: 13.5, margin: '0 0 6px' }}>
                <strong>{nombreArchivo}</strong> · {analisis.filas.length} filas de datos
                {analisis.filaEncabezado > 0 ? ` (los títulos están en la fila ${analisis.filaEncabezado + 1}; ignoré lo de arriba)` : ''}.
                Así entendí tus columnas; corrige lo que no esté bien.
              </p>
              {analisis.avisos.map(a => <div key={a} style={{ fontSize: 12.5, color: '#92400e', marginBottom: 6 }}>⚠ {a}</div>)}
              {hojas.length > 1 && (
                <div style={{ margin: '8px 0 12px' }}>
                  <label className="fl">Hoja del libro</label>
                  <select className="fc" style={{ maxWidth: 280 }} value={iHoja} onChange={e => usarHoja(hojas, Number(e.target.value))}>
                    {hojas.map((h, i) => <option key={h.nombre} value={i}>{h.nombre} ({h.a.filas.length} filas)</option>)}
                  </select>
                </div>
              )}
              <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflowX: 'auto', margin: '10px 0' }}>
                <table className="data" style={{ width: '100%' }}>
                  <thead><tr><th>Columna de tu archivo</th><th>Ejemplos</th><th style={{ minWidth: 250 }}>Va en el campo…</th><th>Detección</th></tr></thead>
                  <tbody>
                    {mapeo.map(m => (
                      <tr key={m.indice}>
                        <td style={{ fontWeight: 600 }}>{m.encabezado || <span className="muted">(sin título)</span>}</td>
                        <td style={{ fontSize: 12, color: 'var(--slate)', maxWidth: 260 }}>{m.ejemplos.join(' · ') || '—'}</td>
                        <td>
                          <select className="fc" value={m.campo || ''} onChange={e => cambiarCampo(m.indice, e.target.value)}>
                            <option value="">— No importar esta columna —</option>
                            {campos.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                          </select>
                        </td>
                        <td><Confianza m={m} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(usadas.has('nombre_completo') || usadas.has('rep_nombre_completo')) && (
                <div style={{ marginBottom: 10, fontSize: 13 }}>
                  <label className="fl">En las columnas de “apellidos y nombres” juntos, ¿qué va primero?</label>
                  <select className="fc" style={{ maxWidth: 360 }} value={orden} onChange={e => setOrden(e.target.value)}>
                    <option value="apellidos">Primero los apellidos (PÉREZ GÓMEZ JUAN CARLOS)</option>
                    <option value="nombres">Primero los nombres (Juan Carlos Pérez Gómez)</option>
                  </select>
                </div>
              )}
              {!tieneNombre && <div style={{ fontSize: 13, color: '#991b1b', marginBottom: 8 }}>Falta indicar dónde están los nombres y los apellidos.</div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <button className="btn btn-secondary" onClick={() => { setPaso('archivo'); setError(''); }}>← Otro archivo</button>
                <button className="btn btn-primary" onClick={irARevision} disabled={!tieneNombre}>Continuar → revisar</button>
              </div>
            </div>
          )}

          {/* 3 · REVISIÓN */}
          {paso === 'revision' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 14 }}>
                {[['nueva', 'Se crearán', cuentas.nueva, '#16a34a'], ['existe', 'Ya existen', cuentas.existe, '#2563eb'], ['repetida', 'Repetidas en el archivo', cuentas.repetida, '#d97706'], ['omitida', 'No se pueden crear', cuentas.omitida, '#dc2626'], ['avisos', 'Con datos vacíos o avisos', cuentas.conAvisos, '#7c3aed']].map(([k, et, n, color]) => (
                  <button key={k} type="button" onClick={() => setFiltro(filtro === k ? 'todas' : k)}
                    style={{ textAlign: 'left', border: '1px solid ' + (filtro === k ? color : 'var(--line)'), borderRadius: 10, padding: '10px 12px', background: filtro === k ? color + '14' : 'var(--card, #fff)', cursor: 'pointer' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color }}>{n}</div>
                    <div style={{ fontSize: 12, color: 'var(--slate)' }}>{et}</div>
                  </button>
                ))}
              </div>
              {cuentas.existe > 0 && (
                <label style={{ display: 'block', fontSize: 13, margin: '0 0 12px', padding: '10px 12px', borderRadius: 10, background: 'var(--page, #f5f7fc)' }}>
                  <input type="checkbox" checked={completarVacios} onChange={e => setCompletarVacios(e.target.checked)} /> <strong>Completar los campos vacíos</strong> de los {cuentas.existe} que ya existen con lo que traiga el archivo.
                  <span style={{ color: 'var(--slate)' }}> Nunca cambia un dato que ya esté guardado{completarVacios ? ` · se completarían ${paraGuardar.completar.length}` : ''}.</span>
                </label>
              )}
              <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'auto', maxHeight: 360 }}>
                <table className="data" style={{ width: '100%' }}>
                  <thead><tr><th>Fila</th><th>Apellidos y nombres</th><th>Cédula</th>{tipo === 'estudiantes' && <th>Curso</th>}<th>Resultado</th><th>Avisos</th></tr></thead>
                  <tbody>
                    {visibles.map(r => {
                      const e = estado(r);
                      const [txt, cls] = { nueva: ['Se creará', 'b-ok'], existe: ['Ya existe', 'b-info'], repetida: ['Repetida', 'b-warn'], omitida: ['No se crea', 'b-err'] }[e];
                      const vacioTxt = <span className="muted">—</span>;
                      return (
                        <tr key={r.fila}>
                          <td style={{ fontSize: 12 }}>{r.fila}</td>
                          <td>{`${r.datos.apellidos || ''} ${r.datos.nombres || ''}`.trim() || vacioTxt}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.datos.cedula || vacioTxt}</td>
                          {tipo === 'estudiantes' && <td style={{ fontSize: 12 }}>{r.cursoTxt ? `${r.cursoTxt}${r.paraleloTxt ? ' ' + r.paraleloTxt : ''}${r.gradoId && r.paraleloId ? ' ✓' : ''}` : vacioTxt}</td>}
                          <td><span className={'badge ' + cls}>{txt}</span>{e === 'existe' && <span style={{ fontSize: 11, color: 'var(--slate)', marginLeft: 6 }}>{r.duplicado.por === 'cedula' ? 'misma cédula' : 'mismo nombre'}</span>}</td>
                          <td style={{ fontSize: 11.5, color: r.error ? '#991b1b' : '#92400e' }}>{r.error || r.avisos.join(' · ')}</td>
                        </tr>
                      );
                    })}
                    {!visibles.length && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 16 }}>No hay filas en este filtro.</td></tr>}
                  </tbody>
                </table>
              </div>
              {registros.length > 200 && <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 6 }}>Se muestran las primeras 200 filas del filtro; la carga procesa todas.</div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" onClick={() => { setPaso('mapeo'); setError(''); }}>← Cambiar columnas</button>
                <button className="btn btn-success" onClick={importar} disabled={!paraGuardar.nuevos.length && !paraGuardar.completar.length}>
                  ✅ Importar {plural(paraGuardar.nuevos.length, tipo)}{paraGuardar.completar.length ? ` y completar ${paraGuardar.completar.length}` : ''}
                </button>
              </div>
            </div>
          )}

          {/* 4 · IMPORTANDO */}
          {paso === 'importando' && (
            <div style={{ padding: '30px 0', textAlign: 'center' }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>{progreso.fase || 'Importando'}…</div>
              <div style={{ height: 12, background: 'var(--line)', borderRadius: 8, overflow: 'hidden', maxWidth: 420, margin: '0 auto' }}>
                <div style={{ height: '100%', width: `${Math.min(100, Math.round((progreso.hecho / Math.max(1, progreso.total)) * 100))}%`, background: 'var(--brand, #4f46e5)', transition: 'width .3s' }} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 8 }}>{progreso.hecho} de {progreso.total} · no cierres esta ventana</div>
            </div>
          )}

          {/* 5 · RESULTADO */}
          {paso === 'resultado' && resultado && (
            <div>
              <div style={{ fontSize: 15, marginBottom: 12 }}>
                <strong>{plural(resultado.creados, tipo)}</strong> {resultado.creados === 1 ? 'creado' : 'creados'}
                {resultado.completados ? <> · <strong>{resultado.completados}</strong> completados</> : null}
                {resultado.matriculas ? <> · <strong>{resultado.matriculas}</strong> matriculados</> : null}
                {resultado.representantes ? <> · <strong>{resultado.representantes}</strong> representantes nuevos</> : null}.
              </div>
              {(resultado.fallos?.length > 0) && (
                <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 12.5, color: '#991b1b' }}>
                  {resultado.fallos.length} fila(s) no se pudieron guardar: {resultado.fallos.slice(0, 5).map(f => `fila ${f.fila} (${f.motivo})`).join(' · ')}{resultado.fallos.length > 5 ? ' …' : ''}. Están detalladas en el informe.
                </div>
              )}
              {(resultado.avisos?.length > 0) && (
                <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, background: '#fffbeb', border: '1px solid #fde68a', fontSize: 12.5, color: '#92400e' }}>
                  {resultado.avisos.slice(0, 5).map((a, i) => <div key={i}>{a.fila ? `Fila ${a.fila}: ` : ''}{a.motivo}</div>)}
                </div>
              )}
              <p style={{ fontSize: 13, color: 'var(--slate)', margin: '0 0 14px' }}>
                Los datos que no venían en el archivo, o que no eran válidos, quedaron vacíos: puedes completarlos desde la ficha de cada persona o volviendo a cargar un archivo más completo con la opción de completar campos vacíos.
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" onClick={descargarInforme}>⬇️ Descargar informe (Excel)</button>
                <button className="btn btn-primary" onClick={onClose}>Listo</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
