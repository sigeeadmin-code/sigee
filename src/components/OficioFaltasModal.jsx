import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { construirOficio, OPCIONES_OFICIO, numeroCorrelativo } from '../lib/oficioFaltas.js';
import { usarMargenesA4 } from '../lib/impresion.js';

const CLAVE = 'sigee_oficio_faltas_';
const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export function Hoja({ of }) {
  return (
    <div className="oficio-hoja">
      <div className="of-cab">
        <div className="of-inst">{of.encabezado.institucion}</div>
        {(of.encabezado.amie || of.encabezado.ubicacion) && <div className="of-sub">{[of.encabezado.amie && `AMIE ${of.encabezado.amie}`, of.encabezado.ubicacion].filter(Boolean).join(' · ')}</div>}
      </div>
      <div className="of-titulo">{of.titulo}</div>
      <div className="of-fecha">{of.lugarFecha}</div>
      <div className="of-dest">{of.destinatario.map((l, i) => <div key={i} style={i === 1 || i === 2 ? { fontWeight: 700 } : undefined}>{l}</div>)}</div>
      <div className="of-asunto"><strong>ASUNTO:</strong> {of.asunto}</div>
      <p>{of.saludo}</p>
      {of.advertencia && <p className="of-aviso">{of.advertencia}</p>}
      {of.parrafos.map((p, i) => <p key={i}>{p}</p>)}
      {of.filas.length > 0 && (
        <table className="of-tabla">
          <thead><tr><th style={{ width: 36 }}>N°</th><th>Fecha</th><th>Día</th><th>Situación</th></tr></thead>
          <tbody>{of.filas.map(f => <tr key={f.n}><td>{f.n}</td><td>{f.fecha}</td><td>{f.dia}</td><td>{f.situacion}</td></tr>)}</tbody>
        </table>
      )}
      <p><strong>{of.totales}</strong>{of.racha ? ` ${of.racha}` : ''}</p>
      {of.baseLegal && <p>{of.baseLegal}</p>}
      <p>{of.solicitud}{of.dece ? ` ${of.dece}` : ''}</p>
      {of.notaAdicional && <p>{of.notaAdicional}</p>}
      <p>{of.cierre[0]}</p>
      <p>{of.cierre[1]}</p>
      <div className="of-firma">
        <div className="of-linea" />
        <div><strong>{of.firmante.nombre}</strong></div>
        {of.firmante.cargo && <div>{of.firmante.cargo}</div>}
        <div>{of.firmante.institucion}</div>
      </div>
      <div className="of-acuse">
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{of.acuse[0]}</div>
        {of.acuse.slice(1).map((l, i) => <div key={i}>{l}</div>)}
      </div>
      {of.baseNormativa && <div className="of-pie">Base normativa: {of.baseNormativa}.</div>}
    </div>
  );
}

// Vista previa editable del oficio de inasistencias, uno por estudiante, con impresión / guardado en PDF.
export default function OficioFaltasModal({ alumnos, institucion, periodo, onClose, onRegistrar, onEnviarCorreo }) {
  const idInst = institucion?.id || 'x';
  const [indice, setIndice] = useState(0);
  const [imprimiendo, setImprimiendo] = useState(null);   // null | 'uno' | 'todos'
  const [correlativo, setCorrelativo] = useState(true);
  const [registrar, setRegistrar] = useState(true);
  const [constancia, setConstancia] = useState('');
  const [correo, setCorreo] = useState({ enviando: false, msg: '', error: false });
  const [op, setOp] = useState(() => {
    let guardado = {};
    try { guardado = JSON.parse(localStorage.getItem(CLAVE + idInst) || '{}'); } catch { /* sin almacenamiento */ }
    return { ...OPCIONES_OFICIO, ciudad: institucion?.canton || '', firmanteNombre: '', ...guardado, fechaEmision: hoyISO() };
  });
  const set = (k, v) => setOp(o => ({ ...o, [k]: v }));

  // se recuerdan los datos de la institución (no el número ni la fecha) para el siguiente oficio
  useEffect(() => {
    try {
      const { ciudad, firmanteNombre, firmanteCargo, plazoDias, mencionarDece, incluirBaseLegal } = op;
      localStorage.setItem(CLAVE + idInst, JSON.stringify({ ciudad, firmanteNombre, firmanteCargo, plazoDias, mencionarDece, incluirBaseLegal }));
    } catch { /* sin almacenamiento */ }
  }, [op.ciudad, op.firmanteNombre, op.firmanteCargo, op.plazoDias, op.mencionarDece, op.incluirBaseLegal, idInst]);

  const fechaEmision = useMemo(() => { const [a, m, d] = op.fechaEmision.split('-').map(Number); return new Date(a, (m || 1) - 1, d || 1); }, [op.fechaEmision]);
  const oficios = useMemo(() => alumnos.map((a, i) => construirOficio({
    institucion, alumno: a, periodo,
    opciones: { ...op, fechaEmision, numero: correlativo ? numeroCorrelativo(op.numero, i) : op.numero }
  })), [alumnos, institucion, periodo, op, fechaEmision, correlativo]);

  const actual = Math.min(indice, Math.max(0, oficios.length - 1));

  // imprimir: se deja visible solo la zona de oficios (ver reglas @media print en styles.css)
  useEffect(() => {
    if (!imprimiendo) return;
    document.body.classList.add('imprimiendo-oficio');
    const quitarMargenes = usarMargenesA4();   // márgenes en cada hoja impresa (ver lib/impresion.js)
    const fin = () => { document.body.classList.remove('imprimiendo-oficio'); quitarMargenes(); setImprimiendo(null); };
    window.addEventListener('afterprint', fin, { once: true });
    const t = setTimeout(() => window.print(), 150);
    return () => { clearTimeout(t); window.removeEventListener('afterprint', fin); document.body.classList.remove('imprimiendo-oficio'); quitarMargenes(); };
  }, [imprimiendo]);

  // al imprimir queda constancia en el historial de cada estudiante (como "emitido")
  async function iniciarImpresion(modo) {
    const lista = modo === 'todos' ? oficios.map((of, i) => [alumnos[i], of]) : [[alumnos[actual], oficios[actual]]];
    setImprimiendo(modo);
    if (!onRegistrar || !registrar) return;
    try {
      await onRegistrar(lista.map(([a, of]) => ({
        estudianteId: a.id, numero: of.numero, fechaEmision: op.fechaEmision, periodoDesde: periodo.desde, periodoHasta: periodo.hasta,
        diasFalta: a.faltas, fechas: (a.fechasFaltas || []).filter(f => f.tipo === 'injustificada').map(f => f.fecha),
        firmante: op.firmanteNombre, cargo: op.firmanteCargo
      })));
      setConstancia(`Quedó registrado en el historial (${lista.length} ${lista.length === 1 ? 'oficio' : 'oficios'}).`);
    } catch (e) { setConstancia('No se pudo registrar en el historial: ' + (e.message || e)); }
  }


  // Envío por correo: el servidor toma el destinatario de los representantes del estudiante; aquí solo se pide el envío.
  async function enviarPorCorreo(modo) {
    const idx = modo === 'todos' ? alumnos.map((_, i) => i) : [actual];
    const con = idx.filter(i => alumnos[i].correoRep);
    if (!con.length) { setCorreo({ enviando: false, error: true, msg: 'El representante no tiene un correo electrónico válido registrado. Agrégalo en el módulo de Estudiantes.' }); return; }
    setCorreo({ enviando: true, error: false, msg: `Enviando ${con.length === 1 ? 'el oficio' : `${con.length} oficios`}…` });
    let ok = 0; const fallos = [];
    for (const i of con) {
      const a = alumnos[i];
      try {
        await onEnviarCorreo({
          estudianteId: a.id, oficio: oficios[i],
          registro: registrar ? {
            numero: oficios[i].numero, fechaEmision: op.fechaEmision, periodoDesde: periodo.desde, periodoHasta: periodo.hasta,
            diasFalta: a.faltas, fechas: (a.fechasFaltas || []).filter(f => f.tipo === 'injustificada').map(f => f.fecha),
            firmante: op.firmanteNombre, cargo: op.firmanteCargo
          } : null
        });
        ok++;
      } catch (e) { fallos.push(`${a.nombre}: ${e.message || e}`); }
    }
    const sin = idx.length - con.length;
    const partes = [];
    if (ok) partes.push(`Enviado por correo (${ok}). ${registrar ? 'Quedó registrado en el historial.' : ''}`.trim());
    if (sin) partes.push(`${sin} sin correo de representante.`);
    if (fallos.length) partes.push('No se pudo enviar: ' + fallos.join(' | '));
    setCorreo({ enviando: false, error: fallos.length > 0 && !ok, msg: partes.join(' ') });
  }

  const aImprimir = imprimiendo === 'todos' ? oficios : imprimiendo === 'uno' ? [oficios[actual]] : [];
  const nombreAlumno = alumnos[actual]?.nombre;

  return (
    <div className="oficio-overlay print-hide-oficio">
      <div className="oficio-panel">
        <div className="oficio-barra">
          <strong>📄 Oficio de inasistencias — vista previa</strong>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕ Cerrar</button>
        </div>
        <div className="oficio-cuerpo">
          <div className="oficio-form">
            <label className="fl">Nro. de oficio</label>
            <input className="fc" value={op.numero} placeholder="Ej.: 012-2026" onChange={e => set('numero', e.target.value)} />
            {alumnos.length > 1 && (
              <label style={{ fontSize: 12, display: 'flex', gap: 6, margin: '6px 0' }}>
                <input type="checkbox" checked={correlativo} onChange={e => setCorrelativo(e.target.checked)} /> Numerar correlativamente (012, 013, 014…)
              </label>
            )}
            <label className="fl">Ciudad</label>
            <input className="fc" value={op.ciudad} onChange={e => set('ciudad', e.target.value)} />
            <label className="fl">Fecha del oficio</label>
            <input className="fc" type="date" value={op.fechaEmision} onChange={e => set('fechaEmision', e.target.value || hoyISO())} />
            <label className="fl">Firma: nombre</label>
            <input className="fc" value={op.firmanteNombre} placeholder="Ej.: Lcdo. Juan Pérez" onChange={e => set('firmanteNombre', e.target.value)} />
            <label className="fl">Firma: cargo</label>
            <input className="fc" value={op.firmanteCargo} onChange={e => set('firmanteCargo', e.target.value)} />
            <label className="fl">Plazo para justificar (días hábiles; 0 = sin plazo)</label>
            <input className="fc" type="number" min="0" max="30" value={op.plazoDias} onChange={e => set('plazoDias', Math.max(0, Math.min(30, Number(e.target.value) || 0)))} />
            <div style={{ display: 'grid', gap: 6, margin: '10px 0', fontSize: 12.5 }}>
              <label><input type="checkbox" checked={op.incluirBaseLegal} onChange={e => set('incluirBaseLegal', e.target.checked)} /> Incluir base legal (art. 171 del Reglamento a la LOEI)</label>
              <label><input type="checkbox" checked={op.incluirJustificadas} onChange={e => set('incluirJustificadas', e.target.checked)} /> Listar también las faltas justificadas</label>
              <label><input type="checkbox" checked={op.mencionarDece} onChange={e => set('mencionarDece', e.target.checked)} /> Mencionar el apoyo del DECE</label>
            </div>
            <label className="fl">Nota adicional (opcional)</label>
            <textarea className="fc" rows={4} value={op.notaAdicional} placeholder="Texto libre que se agrega antes de la despedida" onChange={e => set('notaAdicional', e.target.value)} />
            <p style={{ fontSize: 11.5, color: 'var(--slate)', marginTop: 10 }}>
              Se cuentan días de clase (no horas). Revisa el texto antes de imprimir: la autoridad de la institución es quien firma y responde por su contenido.
            </p>
          </div>

          <div className="oficio-vista">
            <div className="oficio-nav">
              {oficios.length > 1 ? (
                <>
                  <button className="btn btn-secondary btn-sm" disabled={actual === 0} onClick={() => setIndice(actual - 1)}>‹ Anterior</button>
                  <span style={{ fontSize: 13 }}>{actual + 1} de {oficios.length} · <strong>{nombreAlumno}</strong></span>
                  <button className="btn btn-secondary btn-sm" disabled={actual + 1 >= oficios.length} onClick={() => setIndice(actual + 1)}>Siguiente ›</button>
                </>
              ) : <span style={{ fontSize: 13 }}><strong>{nombreAlumno}</strong></span>}
              <span style={{ flex: 1 }} />
              {onEnviarCorreo && <button className="btn btn-success btn-sm" disabled={correo.enviando} onClick={() => enviarPorCorreo('uno')} title={alumnos[actual]?.correoRep ? `Se envía a ${alumnos[actual].correoRep}` : 'El representante no tiene correo registrado'}>✉️ Enviar por correo</button>}
              {onEnviarCorreo && oficios.length > 1 && <button className="btn btn-success btn-sm" disabled={correo.enviando} onClick={() => enviarPorCorreo('todos')}>✉️ Enviar los {oficios.length}</button>}
              <button className="btn btn-secondary btn-sm" onClick={() => iniciarImpresion('uno')}>🖨️ Imprimir este</button>
              {oficios.length > 1 && <button className="btn btn-primary btn-sm" onClick={() => iniciarImpresion('todos')}>🖨️ Imprimir los {oficios.length}</button>}
            </div>
            <div className="oficio-scroll"><div className="oficio-zoom">{oficios[actual] && <Hoja of={oficios[actual]} />}</div></div>
            <div style={{ fontSize: 11.5, color: 'var(--slate)', padding: '6px 2px' }}>
              En el cuadro de impresión elige “Guardar como PDF” para obtener el archivo.
              {onRegistrar && <label style={{ marginLeft: 12 }}><input type="checkbox" checked={registrar} onChange={e => setRegistrar(e.target.checked)} /> Registrar en el historial del estudiante al imprimir</label>}
              {constancia && <strong style={{ marginLeft: 12 }}>{constancia}</strong>}
            </div>
            {onEnviarCorreo && (
              <div style={{ fontSize: 12, padding: '2px 2px 6px', color: correo.error ? '#b91c1c' : 'var(--slate)' }}>
                {alumnos[actual]?.correoRep ? <>Correo del representante: <strong>{alumnos[actual].correoRep}</strong>. El oficio llega con tu correo como “Responder a” y con el acuse de recibo en el cuerpo del mensaje.</> : <span style={{ color: '#b45309' }}>Este estudiante no tiene correo de representante registrado.</span>}
                {correo.msg && <div style={{ marginTop: 3, fontWeight: 700 }}>{correo.msg}</div>}
              </div>
            )}
          </div>
        </div>
      </div>
      {imprimiendo && createPortal(<div className="oficio-print">{aImprimir.map((of, i) => <Hoja key={i} of={of} />)}</div>, document.body)}
    </div>
  );
}
