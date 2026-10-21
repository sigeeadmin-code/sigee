import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { listarFichasControl, obtenerFichaControl, revisarFichaControl } from '../lib/data.js';
import { TIPOS_FICHA } from '../lib/fichasRendimiento.js';
import { normalizar } from '../lib/rendimiento.js';
import FichaDocumentoModal from './FichaDocumentoModal.jsx';

const ESTADOS = { borrador: ['Borrador', '#64748b'], impresa: ['Impresa · por revisar', '#0369a1'], revisada: ['Revisada', '#15803d'], observada: ['Observada', '#b91c1c'] };
const ROLES = { docente: 'Docente', admin_plantel: 'Administración', supervisor_plantel: 'Supervisión', inspector_general: 'Inspección general', secretario: 'Secretaría', super_admin: 'Super Admin', supervisor_general: 'Supervisión general' };
const fecha = iso => (iso ? new Date(iso).toLocaleString('es-EC', { timeZone: 'America/Guayaquil', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '—');

function Chip({ estado }) { const [t, c] = ESTADOS[estado] || [estado, '#64748b']; return <span style={{ background: c + '1a', color: c, border: `1px solid ${c}44`, borderRadius: 999, padding: '1px 9px', fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{t}</span>; }

/**
 * Registro de oficios y fichas emitidos (control de las autoridades y del tutor).
 *  puedeRevisar: autoridades (aprueban u observan). Para el docente tutor se muestran solo los de su curso o los suyos.
 */
export default function FichasEmitidas({ institucion, puedeRevisar = false, recargar = 0, titulo = 'Oficios y fichas de seguimiento emitidos' }) {
  const [lista, setLista] = useState(null); const [error, setError] = useState('');
  const [estado, setEstado] = useState(''); const [tipo, setTipo] = useState(''); const [q, setQ] = useState('');
  const [abierto, setAbierto] = useState(null);     // fila con revisión desplegada
  const [obs, setObs] = useState(''); const [trabajando, setTrabajando] = useState(false);
  const [editor, setEditor] = useState(null);

  const cargar = useCallback(async () => {
    if (!institucion?.id) return;
    try { setLista(await listarFichasControl(institucion.id)); setError(''); } catch (e) { setError(e.message || 'No se pudo cargar el registro.'); }
  }, [institucion?.id]);
  useEffect(() => { cargar(); }, [cargar, recargar]);

  const vis = useMemo(() => (lista || []).filter(f => (!estado || f.estado === estado) && (!tipo || f.tipo === tipo) && (!q.trim() || normalizar(`${f.apellidos} ${f.nombres} ${f.cedula || ''} ${f.titulo} ${f.creado_por_nombre}`).includes(normalizar(q)))), [lista, estado, tipo, q]);
  const cuenta = useMemo(() => { const c = { total: 0, porRevisar: 0, observadas: 0, revisadas: 0 }; for (const f of lista || []) { c.total++; if (f.estado === 'impresa') c.porRevisar++; if (f.estado === 'observada') c.observadas++; if (f.estado === 'revisada') c.revisadas++; } return c; }, [lista]);

  async function abrir(f) {
    try { const full = await obtenerFichaControl(f.id); setEditor({ fila: f, registro: { id: f.id, tipo: f.tipo, estado: f.estado, contenido: full.contenido } }); }
    catch (e) { setError(e.message || 'No se pudo abrir el documento.'); }
  }
  async function revisar(f, nuevo) {
    setTrabajando(true);
    try { await revisarFichaControl(f.id, nuevo, obs); setAbierto(null); setObs(''); await cargar(); } catch (e) { setError(e.message || 'No se pudo registrar la revisión.'); }
    setTrabajando(false);
  }

  return (
    <div className="card" style={{ margin: 0, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 800 }}>{titulo}</div>
          <div style={{ fontSize: 12, color: 'var(--slate)' }}>{puedeRevisar ? 'Control de la autoridad: quién emitió cada documento, cuándo y cuántas veces se imprimió. Apruébalo u obsérvalo.' : 'Los documentos que emitiste y los de tu curso, con su estado de revisión.'}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="fc" style={{ width: 190 }} placeholder="Buscar…" value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar documentos" />
          <select className="fc" style={{ width: 'auto' }} value={tipo} onChange={e => setTipo(e.target.value)} aria-label="Tipo"><option value="">Todos los tipos</option>{Object.entries(TIPOS_FICHA).map(([k, v]) => <option key={k} value={k}>{v.corto}</option>)}</select>
          <select className="fc" style={{ width: 'auto' }} value={estado} onChange={e => setEstado(e.target.value)} aria-label="Estado"><option value="">Todos los estados</option>{Object.entries(ESTADOS).map(([k, [t]]) => <option key={k} value={k}>{t}</option>)}</select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 12.5, marginBottom: 10 }}>
        <span><strong>{cuenta.total}</strong> emitidos</span><span style={{ color: '#0369a1' }}><strong>{cuenta.porRevisar}</strong> por revisar</span>
        <span style={{ color: '#b91c1c' }}><strong>{cuenta.observadas}</strong> observados</span><span style={{ color: '#15803d' }}><strong>{cuenta.revisadas}</strong> revisados</span>
      </div>
      {error && <div style={{ color: 'var(--red)', marginBottom: 8 }}>{error}</div>}
      <div style={{ overflowX: 'auto' }}>
        <table className="data" style={{ width: '100%' }}>
          <thead><tr><th>Fecha</th><th>Estudiante</th><th>Documento</th><th>Emitido por</th><th>Estado</th><th style={{ textAlign: 'center' }}>Impresiones</th><th /></tr></thead>
          <tbody>
            {lista === null && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--slate)', padding: 18 }}>Cargando…</td></tr>}
            {vis.map(f => (
              <React.Fragment key={f.id}>
                <tr>
                  <td style={{ fontSize: 12 }}>{fecha(f.creado_at)}</td>
                  <td style={{ fontWeight: 600, fontSize: 13 }}>{f.apellidos} {f.nombres}<div style={{ fontWeight: 400, fontSize: 11.5, color: 'var(--slate)' }}>{f.curso} {f.paralelo}{f.jornada ? ` · ${f.jornada}` : ''}</div></td>
                  <td style={{ fontSize: 12.5 }}>{TIPOS_FICHA[f.tipo]?.corto || f.tipo}{f.numero ? ` Nro. ${f.numero}` : ''}<div style={{ fontSize: 11.5, color: 'var(--slate)' }}>{f.periodo_evaluativo ? `Trimestre ${f.periodo_evaluativo.slice(1)}` : ''}</div></td>
                  <td style={{ fontSize: 12.5 }}>{f.creado_por_nombre || '—'}<div style={{ fontSize: 11.5, color: 'var(--slate)' }}>{ROLES[f.creado_rol] || f.creado_rol}</div></td>
                  <td><Chip estado={f.estado} />{f.revisado_at && <div style={{ fontSize: 11, color: 'var(--slate)' }}>{f.revisado_por_nombre} · {fecha(f.revisado_at)}</div>}{f.observacion_revision && <div style={{ fontSize: 11.5, color: f.estado === 'observada' ? '#b91c1c' : 'var(--slate)', maxWidth: 220 }} title={f.observacion_revision}>“{f.observacion_revision}”</div>}</td>
                  <td style={{ textAlign: 'center' }}>{f.veces_impresa}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => abrir(f)}>Abrir</button>{' '}
                    {puedeRevisar && <button className="btn btn-secondary btn-sm" onClick={() => { setAbierto(abierto === f.id ? null : f.id); setObs(f.observacion_revision || ''); }}>Revisar</button>}
                  </td>
                </tr>
                {abierto === f.id && (
                  <tr><td colSpan={7} style={{ background: 'var(--page, #f1f5f9)' }}>
                    <div style={{ display: 'grid', gap: 8, padding: 6 }}>
                      <textarea className="fc" rows={2} value={obs} onChange={e => setObs(e.target.value)} maxLength={400} placeholder="Observación para quien emitió el documento (opcional si lo apruebas)" />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-primary btn-sm" disabled={trabajando} onClick={() => revisar(f, 'revisada')}>✓ Aprobar (revisada)</button>
                        <button className="btn btn-secondary btn-sm" disabled={trabajando || !obs.trim()} onClick={() => revisar(f, 'observada')} title={!obs.trim() ? 'Escribe la observación' : ''}>Observar</button>
                      </div>
                    </div>
                  </td></tr>
                )}
              </React.Fragment>
            ))}
            {lista !== null && !vis.length && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--slate)', padding: 22 }}>{lista.length ? 'Ningún documento coincide con el filtro.' : 'Todavía no se ha emitido ningún oficio ni ficha.'}</td></tr>}
          </tbody>
        </table>
      </div>
      {editor && (
        <FichaDocumentoModal institucion={institucion} trimestre={editor.fila.periodo_evaluativo || 'T1'} registro={editor.registro} tipos={[editor.fila.tipo]}
          estudiante={{ id: editor.fila.estudiante_id, apellidos: editor.fila.apellidos, nombres: editor.fila.nombres, cedula: editor.fila.cedula, curso: editor.fila.curso, paralelo: editor.fila.paralelo, jornada: editor.fila.jornada }}
          onClose={() => setEditor(null)} onGuardado={cargar} />
      )}
    </div>
  );
}
