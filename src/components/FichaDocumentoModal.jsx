import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from '../lib/SessionContext.jsx';
import { fetchDetalleEstudianteCalificaciones, fetchRepresentanteDe, fetchPeriodoActivoNombre, guardarFichaControl } from '../lib/data.js';
import { parcialDesdeActividades } from '../lib/rendimiento.js';
import { construirDocumento, TIPOS_FICHA, OPCIONES_FICHA } from '../lib/fichasRendimiento.js';
import DocumentoEditable from './DocumentoEditable.jsx';

const CLAVE = 'sigee_ficha_opciones_';
const ESTADO_TXT = { borrador: ['Borrador', '#64748b'], impresa: ['Impresa', '#0369a1'], revisada: ['Revisada por la autoridad', '#15803d'], observada: ['Observada por la autoridad', '#b91c1c'] };
const hoyISO = () => new Date().toISOString().slice(0, 10);

/**
 * Editor de oficios y fichas de seguimiento de UN estudiante: se arma con sus notas reales, se edita directamente sobre la
 * hoja, se guarda como borrador y se imprime. Todo queda registrado (quién, cuándo, cuántas veces se imprimió) para las autoridades.
 *  estudiante: { id, apellidos, nombres, cedula, curso, paralelo, jornada } · registro: documento ya guardado (para reabrirlo)
 *  asistencia/periodoAsistencia: datos de asistencia para la ficha del tutor (opcional).
 */
export default function FichaDocumentoModal({ estudiante, institucion, trimestre, tipoInicial = 'oficio_rendimiento', tipos = Object.keys(TIPOS_FICHA), registro = null, asistencia = null, periodoAsistencia = '', tutorNombreDefault = '', onClose, onGuardado }) {
  const { profile } = useSession();
  const idInst = institucion?.id || '';
  const [tipo, setTipo] = useState(registro?.tipo || tipoInicial);
  const [base, setBase] = useState(null);          // { materias, representante, periodoLectivo }
  const [docs, setDocs] = useState(() => (registro ? { [registro.tipo]: registro.contenido } : {}));
  const [ids, setIds] = useState(() => (registro ? { [registro.tipo]: registro.id } : {}));
  const [estados, setEstados] = useState(() => (registro ? { [registro.tipo]: registro.estado } : {}));
  const [opciones, setOpciones] = useState(() => {
    let g = {}; try { g = JSON.parse(localStorage.getItem(CLAVE + idInst) || '{}'); } catch { /* sin almacenamiento */ }
    return { ...OPCIONES_FICHA, ciudad: institucion?.canton || '', ...g, tutorNombre: tutorNombreDefault || g.tutorNombre || '', fecha: hoyISO() };
  });
  const [error, setError] = useState(''); const [msg, setMsg] = useState(''); const [guardando, setGuardando] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);
  const docRef = useRef(null);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const [det, rep, per] = await Promise.all([
          fetchDetalleEstudianteCalificaciones(estudiante.id, trimestre), fetchRepresentanteDe(estudiante.id).catch(() => null), fetchPeriodoActivoNombre(idInst).catch(() => '')
        ]);
        if (!activo) return;
        const materias = (det.materias || []).map(m => ({ materia: m.materia, docente: m.docente, ...parcialDesdeActividades(m.actividades) })).sort((a, b) => a.materia.localeCompare(b.materia, 'es'));
        setBase({ materias, representante: rep, periodoLectivo: per });
      } catch (e) { if (activo) setError(e.message || 'No se pudieron cargar las notas del estudiante.'); }
    })();
    return () => { activo = false; };
  }, [estudiante.id, trimestre, idInst]);
  useEffect(() => { const k = e => { if (e.key === 'Escape' && !imprimiendo) onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose, imprimiendo]);

  const datosBase = useMemo(() => base && ({
    institucion, trimestre, periodoLectivo: base.periodoLectivo, materias: base.materias, asistencia, periodoAsistencia,
    estudiante: { nombre: `${estudiante.apellidos || ''} ${estudiante.nombres || ''}`.trim(), cedula: estudiante.cedula, curso: `${estudiante.curso || ''} ${estudiante.paralelo || ''}`.trim(), jornada: estudiante.jornada || '', representante: base.representante },
    opciones: { ...opciones, fecha: new Date(opciones.fecha + 'T12:00:00') }
  }), [base, institucion, trimestre, asistencia, periodoAsistencia, estudiante, opciones]);

  // Genera el documento del tipo elegido la primera vez que se abre esa pestaña
  useEffect(() => { if (datosBase && !docs[tipo]) setDocs(d => ({ ...d, [tipo]: construirDocumento(tipo, datosBase) })); }, [datosBase, tipo, docs]);
  const doc = docs[tipo];

  const setOp = (k, v) => setOpciones(o => ({ ...o, [k]: v }));
  useEffect(() => { try { const { ciudad, firmanteNombre, firmanteCargo, tutorNombre, mencionarDece } = opciones; localStorage.setItem(CLAVE + idInst, JSON.stringify({ ciudad, firmanteNombre, firmanteCargo, tutorNombre, mencionarDece })); } catch { /* sin almacenamiento */ } }, [opciones, idInst]);
  function regenerar() {
    if (doc && !window.confirm('Se volverá a armar el documento con estos datos y se perderán los cambios que hiciste sobre la hoja. ¿Continuar?')) return;
    setDocs(d => ({ ...d, [tipo]: construirDocumento(tipo, datosBase) }));
  }

  const guardar = useCallback(async (impresa) => {
    setGuardando(true); setError(''); setMsg('');
    try {
      // sale del campo que se esté editando para no perder el último cambio
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      await new Promise(r => setTimeout(r, 0));
      const actual = docRef.current ?? doc;
      const id = await guardarFichaControl({ id: ids[tipo] || null, estudianteId: estudiante.id, tipo, trimestre, numero: actual.numero || opciones.numero || null, titulo: actual.titulo, contenido: actual, impresa });
      setIds(x => ({ ...x, [tipo]: id })); setEstados(x => ({ ...x, [tipo]: impresa ? (x[tipo] === 'revisada' ? 'revisada' : 'impresa') : (x[tipo] === 'revisada' || x[tipo] === 'observada' ? 'borrador' : x[tipo] || 'borrador') }));
      setMsg(impresa ? 'Registrado como impreso en el control de la institución.' : 'Borrador guardado en el control de la institución.');
      onGuardado?.();
      return true;
    } catch (e) { setError(e.message || 'No se pudo guardar.'); return false; }
    finally { setGuardando(false); }
  }, [doc, ids, tipo, estudiante.id, trimestre, opciones.numero, onGuardado]);
  useEffect(() => { docRef.current = doc; }, [doc]);

  async function imprimir() { if (await guardar(true)) setImprimiendo(true); }
  useEffect(() => {
    if (!imprimiendo) return undefined;
    document.body.classList.add('imprimiendo-oficio');
    const fin = () => { document.body.classList.remove('imprimiendo-oficio'); setImprimiendo(false); };
    window.addEventListener('afterprint', fin, { once: true });
    const t = setTimeout(() => window.print(), 150);
    return () => { clearTimeout(t); window.removeEventListener('afterprint', fin); document.body.classList.remove('imprimiendo-oficio'); };
  }, [imprimiendo]);

  const est = ESTADO_TXT[estados[tipo]];
  return (
    <div className="oficio-overlay" onClick={e => { if (e.target === e.currentTarget && !imprimiendo) onClose(); }}>
      <div className="oficio-panel" role="dialog" aria-modal="true" aria-label="Oficio o ficha de seguimiento">
        <div className="oficio-barra">
          <div>
            <div style={{ fontWeight: 800 }}>Oficios y fichas de seguimiento</div>
            <div style={{ fontSize: 12.5, color: 'var(--slate)' }}>{estudiante.apellidos} {estudiante.nombres} · {estudiante.curso} {estudiante.paralelo} · Trimestre {trimestre.slice(1)}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {est && <span style={{ background: est[1] + '1a', color: est[1], border: `1px solid ${est[1]}44`, borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>{est[0]}</span>}
            <button className="btn btn-secondary btn-sm" onClick={() => guardar(false)} disabled={!doc || guardando}>{guardando ? 'Guardando…' : '💾 Guardar borrador'}</button>
            <button className="btn btn-primary btn-sm" onClick={imprimir} disabled={!doc || guardando}>🖨️ Imprimir</button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>✕ Cerrar</button>
          </div>
        </div>
        <div className="oficio-cuerpo">
          <div className="oficio-form">
            <label className="fl">Tipo de documento</label>
            <div style={{ display: 'grid', gap: 6 }}>
              {tipos.map(k => (
                <button key={k} type="button" onClick={() => setTipo(k)} className="card" style={{ margin: 0, padding: '8px 10px', textAlign: 'left', cursor: 'pointer', border: `2px solid ${tipo === k ? 'var(--brand, #0891b2)' : 'var(--line)'}`, background: tipo === k ? 'var(--brandXL, #ecfeff)' : 'var(--white)' }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}><span className={TIPOS_FICHA[k].icono} /> {TIPOS_FICHA[k].corto}{ids[k] ? ' ✓' : ''}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--slate)' }}>{TIPOS_FICHA[k].desc}</div>
                </button>
              ))}
            </div>
            <label className="fl">Número</label><input className="fc" value={opciones.numero} onChange={e => setOp('numero', e.target.value)} placeholder="Ej. 012-2026" />
            <label className="fl">Ciudad</label><input className="fc" value={opciones.ciudad} onChange={e => setOp('ciudad', e.target.value)} />
            <label className="fl">Fecha</label><input className="fc" type="date" value={opciones.fecha} onChange={e => setOp('fecha', e.target.value)} />
            <label className="fl">Docente tutor</label><input className="fc" value={opciones.tutorNombre} onChange={e => setOp('tutorNombre', e.target.value)} placeholder="Nombre del tutor" />
            <label className="fl">Firma la autoridad</label><input className="fc" value={opciones.firmanteNombre} onChange={e => setOp('firmanteNombre', e.target.value)} placeholder="Nombre" />
            <input className="fc" style={{ marginTop: 4 }} value={opciones.firmanteCargo} onChange={e => setOp('firmanteCargo', e.target.value)} placeholder="Cargo" />
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 10, fontSize: 12.5 }}><input type="checkbox" checked={opciones.mencionarDece} onChange={e => setOp('mencionarDece', e.target.checked)} /> Mencionar derivación al DECE si no mejora</label>
            <button className="btn btn-secondary btn-sm" style={{ marginTop: 10, width: '100%' }} onClick={regenerar} disabled={!datosBase}>↻ Volver a armar con estos datos</button>
            <div style={{ fontSize: 11.5, color: 'var(--slate)', marginTop: 10, lineHeight: 1.5 }}>
              Haz clic sobre cualquier texto de la hoja para corregirlo. Marca las casillas, agrega o quita filas y completa lo que falte. Al <strong>imprimir</strong> queda registrado quién lo emitió y cuándo; las autoridades pueden revisarlo.
            </div>
            {msg && <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--green)' }}>{msg}</div>}
            {error && <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--red)' }}>{error}</div>}
          </div>
          <div className="oficio-vista">
            <div className="oficio-scroll">
              {!doc ? <div style={{ padding: 30, color: 'var(--slate)', textAlign: 'center' }}>{error || 'Armando el documento con las notas del estudiante…'}</div>
                : <div className="oficio-zoom"><DocumentoEditable doc={doc} editable onCambio={nd => { docRef.current = nd; setDocs(d => ({ ...d, [tipo]: nd })); }} /></div>}
            </div>
          </div>
        </div>
      </div>
      {imprimiendo && doc && createPortal(<div className="oficio-print"><DocumentoEditable doc={doc} editable={false} /></div>, document.body)}
    </div>
  );
}
