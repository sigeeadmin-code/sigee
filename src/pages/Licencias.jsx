import React, { useEffect, useState, useCallback } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import {
  fetchLicenciasParalelo, crearLicenciaParalelo, actualizarTarifaLicencia,
  fetchPagosLicencia, fetchPagosPendientesGlobal, reportarPagoMeses, revisarPagoLicencia,
  fetchGradosConParalelos
} from '../lib/data.js';

const ROLES_PLANTEL = ['admin_plantel', 'secretario'];
const ROLES_GLOBAL = ['super_admin', 'supervisor_general', 'contador_general'];
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const ESTADO_BADGE = { pendiente_revision: ['b-warn', 'Pendiente'], aprobado: ['b-ok', 'Aprobado'], rechazado: ['b-err', 'Rechazado'] };

export default function Licencias() {
  const { profile, institucion } = useSession();
  const institucionId = institucion?.id;
  const esGlobal = !institucionId && ROLES_GLOBAL.includes(profile.rolDb);
  const esPlantel = ROLES_PLANTEL.includes(profile.rolDb) || profile.rolDb === 'super_admin';

  if (esGlobal) return <VistaGlobal profile={profile} />;
  if (institucionId && esPlantel) return <VistaPlantel profile={profile} institucionId={institucionId} />;
  return <div className="empty"><span className="ti ti-lock" /><p>Solo Dirección/Secretaría del plantel o el equipo administrativo de SIGEE pueden ver este módulo.</p></div>;
}

/* ───────────────────── Vista del plantel ───────────────────── */
function VistaPlantel({ profile, institucionId }) {
  const [licencias, setLicencias] = useState([]);
  const [gradosPar, setGradosPar] = useState([]);
  const [pagosPorLicencia, setPagosPorLicencia] = useState({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [modalPago, setModalPago] = useState(null); // licencia seleccionada
  const [form, setForm] = useState({ anio: new Date().getFullYear(), meses: [], monto: '', comprobante_num: '' });
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    const [lic, gp] = await Promise.all([fetchLicenciasParalelo(institucionId), fetchGradosConParalelos(institucionId)]);
    setLicencias(lic);
    setGradosPar(gp);
    const entries = await Promise.all(lic.map(async l => [l.id, await fetchPagosLicencia(l.id)]));
    setPagosPorLicencia(Object.fromEntries(entries));
    setLoading(false);
  }, [institucionId]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }, [toast]);

  const paralelosSinLicencia = [];
  gradosPar.forEach(g => (g.paralelos || []).forEach(p => {
    if (!licencias.some(l => l.paralelo_id === p.id)) paralelosSinLicencia.push({ grado: g, paralelo: p });
  }));

  async function registrar(gradoId, paraleloId) {
    try {
      await crearLicenciaParalelo(institucionId, gradoId, paraleloId, 5.00, profile.id);
      await cargar();
      setToast({ tipo: 'ok', msg: 'Paralelo registrado para facturación. Ahora reporta el pago con su comprobante.' });
    } catch (err) {
      setToast({ tipo: 'err', msg: err.message || 'No se pudo registrar.' });
    }
  }

  function abrirPago(lic) {
    setForm({ anio: new Date().getFullYear(), meses: [], monto: String(lic.tarifa_mensual), comprobante_num: '' });
    setModalPago(lic);
  }
  function toggleMes(m) {
    setForm(f => ({ ...f, meses: f.meses.includes(m) ? f.meses.filter(x => x !== m) : [...f.meses, m].sort((a, b) => a - b) }));
  }
  async function enviarPago(e) {
    e.preventDefault();
    if (!form.meses.length || !form.comprobante_num.trim() || !form.monto) {
      setToast({ tipo: 'err', msg: 'Seleccione al menos un mes, el monto y el número de comprobante.' });
      return;
    }
    setSaving(true);
    try {
      await reportarPagoMeses(modalPago.id, form.meses, Number(form.anio), Number(form.monto), form.comprobante_num.trim(), profile.id);
      setModalPago(null);
      await cargar();
      setToast({ tipo: 'ok', msg: 'Pago reportado. Queda pendiente de revisión por el equipo de SIGEE.' });
    } catch (err) {
      setToast({ tipo: 'err', msg: err.message?.includes('duplicate') ? 'Ya reportaste un pago para alguno de esos meses.' : (err.message || 'No se pudo reportar el pago.') });
    }
    setSaving(false);
  }

  if (loading) return <p style={{ fontSize: 13, color: 'var(--slate)' }}>Cargando…</p>;

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ margin: '0 0 4px' }}>Licencias y activación por paralelo</h2>
        <div style={{ fontSize: 13, color: 'var(--slate)' }}>Cada paralelo se activa mes a mes reportando el pago con su número de comprobante. El equipo de SIGEE revisa y aprueba.</div>
      </div>

      {paralelosSinLicencia.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="ch"><h3>Paralelos sin registrar para facturación</h3></div>
          <div className="cb">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {paralelosSinLicencia.map(({ grado, paralelo }) => (
                <button key={paralelo.id} className="btn btn-secondary btn-sm" onClick={() => registrar(grado.id, paralelo.id)}>
                  <span className="ti ti-plus" /> {grado.nombre} {paralelo.nombre}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="ch"><h3>Mis paralelos</h3></div>
        <div className="cb">
          {licencias.length === 0 ? (
            <div className="empty"><span className="ti ti-credit-card" /><p>Todavía no has registrado ningún paralelo para facturación.</p></div>
          ) : licencias.map(lic => {
            const pagos = pagosPorLicencia[lic.id] || [];
            return (
              <div key={lic.id} style={{ border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: '12px 14px', marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <strong>{lic.grado_nombre} {lic.paralelo_nombre}</strong>
                    <span className={'badge ' + (lic.activo_mes_actual ? 'b-ok' : 'b-warn')} style={{ marginLeft: 8 }}>
                      {lic.activo_mes_actual ? 'Activo este mes' : 'Sin activar este mes'}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--slate)', marginLeft: 8 }}>${Number(lic.tarifa_mensual).toFixed(2)}/mes</span>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => abrirPago(lic)}><span className="ti ti-upload" /> Reportar pago</button>
                </div>
                {pagos.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                    {pagos.map(p => {
                      const [cls, label] = ESTADO_BADGE[p.estado] || ['b-muted', p.estado];
                      return <span key={p.id} className={'badge ' + cls} title={'Comprobante ' + p.comprobante_num}>{MESES[p.mes - 1]} {p.anio} · {label}</span>;
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {modalPago && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setModalPago(null); }}>
          <form className="modal" onSubmit={enviarPago} style={{ maxWidth: 480 }}>
            <div className="modal-h"><h3>Reportar pago · {modalPago.grado_nombre} {modalPago.paralelo_nombre}</h3></div>
            <div className="modal-b">
              <div className="form-grid">
                <div className="full">
                  <label className="fl">Año</label>
                  <input className="fc" type="number" value={form.anio} onChange={e => setForm(f => ({ ...f, anio: e.target.value }))} />
                </div>
                <div className="full">
                  <label className="fl">Meses pagados</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {MESES.map((m, i) => (
                      <button type="button" key={m}
                        className={'btn btn-sm ' + (form.meses.includes(i + 1) ? 'btn-primary' : 'btn-ghost')}
                        onClick={() => toggleMes(i + 1)}>{m}</button>
                    ))}
                  </div>
                </div>
                <div className="full">
                  <label className="fl">Monto pagado por mes ($)</label>
                  <input className="fc" type="number" step="0.01" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} />
                </div>
                <div className="full">
                  <label className="fl">N.º de comprobante</label>
                  <input className="fc" value={form.comprobante_num} onChange={e => setForm(f => ({ ...f, comprobante_num: e.target.value }))} placeholder="Ej. 001-002-000123" />
                </div>
              </div>
            </div>
            <div className="modal-f">
              <button type="button" className="btn btn-secondary" onClick={() => setModalPago(null)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Enviando…' : 'Enviar para revisión'}</button>
            </div>
          </form>
        </div>
      )}

      {toast && <div className={'toast ' + (toast.tipo === 'ok' ? 'ok' : 'err')}>{toast.msg}</div>}
    </div>
  );
}

/* ───────────────────── Vista global (admin SIGEE) ───────────────────── */
function VistaGlobal({ profile }) {
  const [pendientes, setPendientes] = useState([]);
  const [todas, setTodas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [revisando, setRevisando] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    const [pend, lic] = await Promise.all([fetchPagosPendientesGlobal(), fetchLicenciasParalelo(null)]);
    setPendientes(pend);
    setTodas(lic);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }, [toast]);

  async function revisar(pagoId, aprobado) {
    setRevisando(pagoId);
    try {
      await revisarPagoLicencia(pagoId, aprobado, profile.id, null);
      await cargar();
      setToast({ tipo: 'ok', msg: aprobado ? 'Pago aprobado — paralelo activado para ese mes.' : 'Pago rechazado.' });
    } catch (err) {
      setToast({ tipo: 'err', msg: err.message || 'No se pudo procesar.' });
    }
    setRevisando(null);
  }

  if (loading) return <p style={{ fontSize: 13, color: 'var(--slate)' }}>Cargando…</p>;

  const activosHoy = todas.filter(l => l.activo_mes_actual).length;
  const ingresoConfirmado = todas.filter(l => l.activo_mes_actual).reduce((s, l) => s + Number(l.tarifa_mensual), 0);

  const porInstitucion = {};
  todas.forEach(l => {
    const k = l.institucion_nombre;
    (porInstitucion[k] ||= { registrados: 0, activos: 0 }).registrados += 1;
    if (l.activo_mes_actual) porInstitucion[k].activos += 1;
  });
  const filas = Object.entries(porInstitucion).sort((a, b) => b[1].registrados - a[1].registrados);

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ margin: '0 0 4px' }}>Licencias y activación — panel global</h2>
        <div style={{ fontSize: 13, color: 'var(--slate)' }}>Revisa comprobantes y aprueba la activación mensual de cada paralelo.</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          ['Paralelos registrados', todas.length],
          ['Activos este mes', activosHoy],
          ['Pagos pendientes de revisión', pendientes.length],
          ['Ingreso confirmado del mes', '$' + ingresoConfirmado.toFixed(2)]
        ].map(([label, val]) => (
          <div key={label} className="card"><div className="cb">
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--brandD)' }}>{val}</div>
            <div style={{ fontSize: 12, color: 'var(--slate)' }}>{label}</div>
          </div></div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="ch"><h3>Comprobantes pendientes de revisión</h3></div>
        <div className="cb">
          {pendientes.length === 0 ? (
            <div className="empty"><span className="ti ti-circle-check" /><p>No hay pagos pendientes de revisión.</p></div>
          ) : pendientes.map(p => (
            <div key={p.id} style={{ border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: '12px 14px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <strong>{p.licencias_paralelo?.institucion?.nombre}</strong> — {p.licencias_paralelo?.grado?.nombre} {p.licencias_paralelo?.paralelo?.nombre}
                <div style={{ fontSize: 12, color: 'var(--slate)' }}>
                  {MESES[p.mes - 1]} {p.anio} · ${Number(p.monto).toFixed(2)} · Comprobante: {p.comprobante_num}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-danger btn-sm" disabled={revisando === p.id} onClick={() => revisar(p.id, false)}>Rechazar</button>
                <button className="btn btn-primary btn-sm" disabled={revisando === p.id} onClick={() => revisar(p.id, true)}>Aprobar y activar</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card"><div className="cb" style={{ padding: 0, overflowX: 'auto' }}>
        {filas.length === 0 ? (
          <div className="empty"><span className="ti ti-chart-bar" /><p>Todavía no hay paralelos registrados.</p></div>
        ) : (
          <table className="data" style={{ width: '100%' }}>
            <thead><tr><th>Plantel</th><th>Paralelos registrados</th><th>Activos este mes</th></tr></thead>
            <tbody>
              {filas.map(([nombre, v]) => (
                <tr key={nombre}><td><strong>{nombre}</strong></td><td>{v.registrados}</td><td>{v.activos}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div></div>

      {toast && <div className={'toast ' + (toast.tipo === 'ok' ? 'ok' : 'err')}>{toast.msg}</div>}
    </div>
  );
}
