import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { fetchFichaAsistencia, registrarAviso, registrarOficiosEmitidos, marcarOficioEntregado } from '../lib/data.js';
import OficioFaltasModal from './OficioFaltasModal.jsx';
import { analizarFicha, mensajeWhatsApp, urlWhatsApp, telefonoEcuador, fechaCorta } from '../lib/fichaAsistencia.js';
import { rangoPeriodo, ETIQUETA_CLASE, UMBRALES_DEFECTO, umbralesValidos } from '../lib/asistenciaAnalisis.js';

const PERIODOS = [['todo', 'Todo'], ['semana', 'Semana'], ['mes', 'Mes'], ['mes_anterior', 'Mes anterior'], ['custom', 'Personalizado']];
const COLOR_CLASE = { excelente: ['#dcfce7', '#15803d'], buena: ['#dbeafe', '#1d4ed8'], en_riesgo: ['#fef3c7', '#b45309'], critica: ['#fee2e2', '#b91c1c'], sin_datos: ['#e2e8f0', '#475569'] };
const COLOR_DIA = { falta: ['#fee2e2', '#b91c1c', 'Falta'], justificada: ['#dbeafe', '#1d4ed8', 'Justificada'], atraso: ['#fef3c7', '#b45309', 'Atraso'], presente: ['#dcfce7', '#15803d', 'Presente'] };
const COLOR_ESTADO = { ausente: '#b91c1c', justificado: '#1d4ed8', atraso: '#b45309', presente: '#15803d' };
const pct = v => (v === null || v === undefined ? '—' : `${String(v).replace('.', ',')}%`);
const hoy = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

function Pildora({ colores, texto }) {
  return <span style={{ background: colores[0], color: colores[1], borderRadius: 999, padding: '2px 10px', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}>{texto}</span>;
}
const Tarjeta = ({ valor, etiqueta, sub, color }) => (
  <div className="card" style={{ margin: 0, padding: '10px 14px', flex: '1 1 130px', borderTop: `3px solid ${color}` }}>
    <div style={{ fontSize: 22, fontWeight: 800, color }}>{valor}</div>
    <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate)' }}>{etiqueta}</div>
    {sub && <div style={{ fontSize: 11, color: 'var(--slate)' }}>{sub}</div>}
  </div>
);
function Barras({ items, vacio }) {
  const max = Math.max(1, ...items.map(i => i.valor));
  if (items.every(i => i.valor === 0)) return <div style={{ fontSize: 12, color: 'var(--slate)' }}>{vacio}</div>;
  return (
    <div style={{ display: 'grid', gap: 5 }}>
      {items.map(i => (
        <div key={i.etiqueta} style={{ display: 'grid', gridTemplateColumns: '84px 1fr 28px', alignItems: 'center', gap: 8, fontSize: 12 }}>
          <span>{i.etiqueta}</span>
          <div style={{ height: 10, background: 'var(--line, #e2e8f0)', borderRadius: 5, overflow: 'hidden' }}><div style={{ width: `${(i.valor / max) * 100}%`, height: '100%', background: '#ef4444' }} /></div>
          <strong>{i.valor}</strong>
        </div>
      ))}
    </div>
  );
}

// Ficha de un estudiante: historial por días y por materias, oficios emitidos y avisos por WhatsApp.
export default function FichaAsistenciaModal({ estudiante, onClose }) {
  const { profile, institucion } = useSession();
  const institucionId = institucion?.id;
  const [periodo, setPeriodo] = useState('todo');
  const [custom, setCustom] = useState({ desde: '', hasta: '' });
  const [ficha, setFicha] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('dias');
  const [soloNovedad, setSoloNovedad] = useState(true);
  const [oficio, setOficio] = useState(null);
  const [wa, setWa] = useState(null);                 // { texto, abierto }
  const [aviso, setAviso] = useState('');
  const [trabajando, setTrabajando] = useState(false);

  const { desde, hasta } = useMemo(() => (periodo === 'custom' ? custom : rangoPeriodo(periodo)), [periodo, custom]);
  const umbrales = useMemo(() => {
    try { const u = JSON.parse(localStorage.getItem('sigee_umbrales_asistencia') || 'null'); if (umbralesValidos(u)) return u; } catch { /* sin almacenamiento */ }
    return UMBRALES_DEFECTO;
  }, []);

  const cargar = useCallback(async () => {
    if (!desde || !hasta || desde > hasta) return;
    setCargando(true); setError('');
    try { setFicha(await fetchFichaAsistencia(institucionId, estudiante.id, desde, hasta)); }
    catch (e) { setError(e.message || 'No se pudo cargar la ficha.'); setFicha(null); }
    setCargando(false);
  }, [institucionId, estudiante.id, desde, hasta]);
  useEffect(() => { cargar(); }, [cargar]);

  const an = useMemo(() => (ficha ? analizarFicha(ficha.registros, umbrales) : null), [ficha, umbrales]);
  const faltasInj = an ? an.resumen.fechasFaltas.filter(f => f.tipo === 'injustificada').map(f => f.fecha) : [];
  const telOk = telefonoEcuador(ficha?.representante?.telefono);

  function abrirWhatsApp() {
    const url = urlWhatsApp(ficha.representante?.telefono, wa.texto);
    if (!url) return;
    window.open(url, '_blank', 'noopener');
    setWa(w => ({ ...w, abierto: true }));
  }
  async function registrarEnvio() {
    setTrabajando(true);
    try {
      await registrarAviso(institucionId, estudiante.id, wa.texto, profile.id, hoy());
      setWa(null); setAviso('Aviso por WhatsApp registrado en el historial.');
      await cargar();
    } catch (e) { setAviso('No se pudo registrar: ' + (e.message || e)); }
    setTrabajando(false);
  }
  async function entregado(o) {
    try { await marcarOficioEntregado(o.id); setAviso('Oficio marcado como entregado.'); await cargar(); }
    catch (e) { setAviso('No se pudo actualizar: ' + (e.message || e)); }
  }

  // todo lo que se le comunicó al representante, en orden de fecha
  const comunicaciones = useMemo(() => {
    if (!ficha) return [];
    const L = [];
    ficha.oficios.forEach(o => L.push({
      clave: 'o' + o.id, fecha: o.created_at, tipo: 'Oficio', icono: '📄', oficio: o,
      detalle: `Oficio Nro. ${o.numero || 's/n'} · ${o.dias_falta} ${o.dias_falta === 1 ? 'día' : 'días'} de falta (${fechaCorta(o.periodo_desde)} al ${fechaCorta(o.periodo_hasta)})`,
      estado: o.estado === 'entregado' ? 'Entregado' : 'Emitido'
    }));
    ficha.avisos.forEach(a => L.push({ clave: 'a' + a.id, fecha: a.enviado_at, tipo: 'WhatsApp', icono: '💬', detalle: a.mensaje, estado: 'Registrado' }));
    ficha.justificaciones.forEach(j => L.push({ clave: 'j' + j.id, fecha: j.created_at || j.fecha, tipo: 'Justificación', icono: '📝', detalle: `${fechaCorta(j.fecha)} — ${j.motivo || 'sin motivo'}`, estado: j.estado }));
    return L.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  }, [ficha]);

  const alumnoOficio = an ? [{ ...estudiante, ...an.resumen, representante: ficha.representante }] : [];
  const registrarOficio = items => registrarOficiosEmitidos(institucionId, items, profile.id).then(() => cargar());
  const diasMostrados = an ? (soloNovedad ? an.dias.filter(d => d.estado !== 'presente') : an.dias) : [];

  return (
    <div className="oficio-overlay">
      <div className="oficio-panel" style={{ maxWidth: 1100 }}>
        <div className="oficio-barra" style={{ alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800 }}>{estudiante.nombre}</div>
            <div style={{ fontSize: 12.5, color: 'var(--slate)' }}>
              {estudiante.cedula || 'Sin cédula'} · {estudiante.curso}
              {ficha?.representante && <> · Representante: {`${ficha.representante.nombres} ${ficha.representante.apellidos}`.trim()}{ficha.representante.telefono ? ` · ${ficha.representante.telefono}` : ' · sin teléfono'}</>}
              {ficha && !ficha.representante && ' · sin representante registrado'}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕ Cerrar</button>
        </div>

        <div style={{ overflowY: 'auto', padding: '12px 16px', flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
            {PERIODOS.map(([k, t]) => <button key={k} className={'btn btn-sm ' + (periodo === k ? 'btn-primary' : 'btn-secondary')} onClick={() => setPeriodo(k)}>{t}</button>)}
            {periodo === 'custom' && (<>
              <input className="fc" type="date" style={{ width: 150 }} value={custom.desde} onChange={e => setCustom(c => ({ ...c, desde: e.target.value }))} />
              <input className="fc" type="date" style={{ width: 150 }} value={custom.hasta} onChange={e => setCustom(c => ({ ...c, hasta: e.target.value }))} />
            </>)}
            <span style={{ flex: 1 }} />
            <button className="btn btn-primary btn-sm" disabled={!an || faltasInj.length === 0} onClick={() => setOficio(alumnoOficio)} title="Genera el oficio con las faltas injustificadas del período">📄 Generar oficio</button>
            <button className="btn btn-secondary btn-sm" disabled={!an || faltasInj.length === 0} onClick={() => setWa({ texto: mensajeWhatsApp({ estudiante, representante: ficha.representante, institucion, fechas: faltasInj }), abierto: false })}>💬 Avisar por WhatsApp</button>
          </div>
          {aviso && <div className="card" style={{ margin: '0 0 10px', padding: '8px 12px', fontSize: 13 }}>{aviso}</div>}
          {error && <div className="lerr" style={{ display: 'flex' }}>{error}</div>}
          {cargando && <div className="card cb">Cargando ficha…</div>}

          {wa && ficha && (
            <div className="card" style={{ marginBottom: 12, borderLeft: '4px solid #16a34a' }}>
              <div className="cb">
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Mensaje de WhatsApp</div>
                <textarea className="fc" rows={5} value={wa.texto} onChange={e => setWa(w => ({ ...w, texto: e.target.value }))} />
                {!telOk && <div style={{ color: '#b91c1c', fontSize: 12.5, marginTop: 6 }}>El representante no tiene un celular válido registrado (9 dígitos que empiecen con 9). Corrige el número en el módulo de Estudiantes.</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button className="btn btn-primary btn-sm" disabled={!telOk || !wa.texto.trim()} onClick={abrirWhatsApp}>Abrir WhatsApp</button>
                  {wa.abierto && <>
                    <span style={{ fontSize: 12.5 }}>¿Ya lo enviaste?</span>
                    <button className="btn btn-secondary btn-sm" disabled={trabajando} onClick={registrarEnvio}>Sí, registrar en el historial</button>
                  </>}
                  <button className="btn btn-ghost btn-sm" onClick={() => setWa(null)}>Cancelar</button>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--slate)', marginTop: 6 }}>SIGEE abre WhatsApp con el mensaje listo; no puede confirmar el envío, por eso el registro lo confirmas tú.</div>
              </div>
            </div>
          )}

          {an && !cargando && (
            <>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                <Tarjeta valor={pct(an.resumen.pctAsistencia)} etiqueta="Asistencia" sub={`${an.resumen.dias} días con registro`} color="#2563eb" />
                <Tarjeta valor={an.resumen.faltas} etiqueta="Días de falta" sub="injustificadas" color="#dc2626" />
                <Tarjeta valor={an.resumen.justificadas} etiqueta="Justificados" sub="días" color="#1d4ed8" />
                <Tarjeta valor={an.resumen.atrasos} etiqueta="Atrasos" sub="días" color="#d97706" />
                <Tarjeta valor={an.resumen.rachaMax || '—'} etiqueta="Faltas seguidas" sub={an.resumen.rachaMax > 1 ? `del ${fechaCorta(an.resumen.rachaIni)} al ${fechaCorta(an.resumen.rachaFin)}` : 'máximo'} color="#7c3aed" />
                <div className="card" style={{ margin: 0, padding: '10px 14px', flex: '1 1 130px', borderTop: '3px solid #64748b' }}>
                  <div style={{ marginTop: 4 }}><Pildora colores={COLOR_CLASE[an.resumen.clase]} texto={ETIQUETA_CLASE[an.resumen.clase]} /></div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate)', marginTop: 6 }}>Clasificación</div>
                  <div style={{ fontSize: 11, color: 'var(--slate)' }}>{pct(an.resumen.pctFaltas)} de faltas</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12, marginBottom: 12 }}>
                <div className="card" style={{ margin: 0 }}><div className="cb"><div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Faltas por día de la semana</div>
                  <Barras items={an.porDiaSemana.map(d => ({ etiqueta: d.dia, valor: d.faltas }))} vacio="Sin faltas injustificadas en el período." /></div></div>
                <div className="card" style={{ margin: 0 }}><div className="cb"><div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Faltas por mes</div>
                  <Barras items={an.porMes.map(m => ({ etiqueta: m.etiqueta, valor: m.faltas }))} vacio="Sin faltas injustificadas en el período." /></div></div>
              </div>

              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                {[['dias', `Por días (${an.dias.length})`], ['materias', `Por materias (${an.porMateria.length})`], ['comunicaciones', `Oficios y mensajes (${comunicaciones.length})`]].map(([k, t]) =>
                  <button key={k} className={'btn btn-sm ' + (tab === k ? 'btn-primary' : 'btn-secondary')} onClick={() => setTab(k)}>{t}</button>)}
              </div>

              {tab === 'dias' && (
                <div className="card"><div className="cb" style={{ overflowX: 'auto' }}>
                  <label style={{ fontSize: 12.5, display: 'flex', gap: 6, marginBottom: 8 }}><input type="checkbox" checked={soloNovedad} onChange={e => setSoloNovedad(e.target.checked)} /> Solo días con falta, justificación o atraso</label>
                  <table className="tbl" style={{ width: '100%' }}>
                    <thead><tr><th>Fecha</th><th>Día</th><th>Estado</th><th>Detalle por materia</th></tr></thead>
                    <tbody>
                      {diasMostrados.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20, color: 'var(--slate)' }}>{an.dias.length ? 'Sin días con novedad en este período.' : 'Sin asistencia registrada en este período.'}</td></tr>}
                      {diasMostrados.map(d => (
                        <tr key={d.fecha}>
                          <td className="mono">{fechaCorta(d.fecha)}</td><td>{d.dia}</td>
                          <td><Pildora colores={COLOR_DIA[d.estado]} texto={COLOR_DIA[d.estado][2]} /></td>
                          <td style={{ fontSize: 12.5 }}>
                            {d.estado === 'presente' ? `Presente en las ${d.detalle.length} clases` : d.detalle.filter(x => x.estado !== 'presente').map((x, i) => (
                              <span key={i} style={{ marginRight: 10, color: COLOR_ESTADO[x.estado] }}>{x.materia} <em>({x.estado})</em></span>))}
                            {d.estado !== 'presente' && d.detalle.some(x => x.estado === 'presente') && <span style={{ color: 'var(--slate)' }}>· presente en {d.detalle.filter(x => x.estado === 'presente').length}</span>}
                          </td>
                        </tr>))}
                    </tbody>
                  </table>
                </div></div>
              )}

              {tab === 'materias' && (
                <div className="card"><div className="cb" style={{ overflowX: 'auto' }}>
                  <div style={{ fontSize: 12, color: 'var(--slate)', marginBottom: 6 }}>Clases registradas: {an.clases.total} · ausencias en clase: {an.clases.ausentes} · asistencia por clase: {pct(an.clases.pctAsistencia)}</div>
                  <table className="tbl" style={{ width: '100%' }}>
                    <thead><tr><th>Materia</th><th>Docente</th><th>Clases</th><th>Presente</th><th>Atraso</th><th>Faltas</th><th>Justif.</th><th>% asist.</th></tr></thead>
                    <tbody>
                      {an.porMateria.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 20, color: 'var(--slate)' }}>Sin clases registradas.</td></tr>}
                      {an.porMateria.map(m => (
                        <tr key={m.materia}>
                          <td><strong>{m.materia}</strong></td><td style={{ fontSize: 12 }}>{m.docente || '—'}</td><td>{m.clases}</td><td>{m.presentes}</td><td>{m.atrasos}</td>
                          <td style={{ fontWeight: 700, color: m.faltas ? '#b91c1c' : undefined }}>{m.faltas}</td><td>{m.justificadas}</td><td>{pct(m.pct)}</td>
                        </tr>))}
                    </tbody>
                  </table>
                </div></div>
              )}

              {tab === 'comunicaciones' && (
                <div className="card"><div className="cb" style={{ overflowX: 'auto' }}>
                  <div style={{ fontSize: 12, color: 'var(--slate)', marginBottom: 6 }}>Incluye todo el historial del estudiante, sin importar el período elegido arriba.</div>
                  <table className="tbl" style={{ width: '100%' }}>
                    <thead><tr><th>Fecha</th><th>Tipo</th><th>Detalle</th><th>Estado</th><th /></tr></thead>
                    <tbody>
                      {comunicaciones.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20, color: 'var(--slate)' }}>Aún no se ha enviado ningún oficio ni mensaje de este estudiante.</td></tr>}
                      {comunicaciones.map(c => (
                        <tr key={c.clave}>
                          <td className="mono" style={{ whiteSpace: 'nowrap' }}>{fechaCorta(String(c.fecha).slice(0, 10))}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>{c.icono} {c.tipo}</td>
                          <td style={{ fontSize: 12.5, maxWidth: 420 }}>{c.detalle}</td>
                          <td>{c.estado}</td>
                          <td>{c.oficio && c.oficio.estado === 'emitido' && ['admin_plantel', 'secretario', 'inspector_general', 'super_admin'].includes(profile.rolDb) &&
                            <button className="btn btn-secondary btn-sm" onClick={() => entregado(c.oficio)} title="Cuando el representante firme el acuse de recibo">Marcar entregado</button>}</td>
                        </tr>))}
                    </tbody>
                  </table>
                </div></div>
              )}
            </>
          )}
        </div>
      </div>
      {oficio && <OficioFaltasModal alumnos={oficio} institucion={institucion} periodo={{ desde, hasta }} onClose={() => setOficio(null)} onRegistrar={registrarOficio} />}
    </div>
  );
}
