import React, { useEffect, useState, useCallback } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import {
  fetchHermanosAutomaticos, fetchHermanosManual, crearHermanoManual, eliminarHermanoManual
} from '../lib/data.js';

const ROLES_GESTIONAN = ['admin_plantel', 'secretario', 'supervisor_plantel', 'inspector_general', 'super_admin'];
const ROLES_GLOBAL = ['super_admin', 'supervisor_general', 'contador_general'];

export default function Encadenamiento() {
  const { profile, institucion, instituciones, data } = useSession();
  const institucionId = institucion?.id;
  // Igual que el resto del sistema (ver SessionContext): un admin de nivel SIGEE
  // sin plantel asignado tiene institucionId null → alcance global.
  const esGlobal = !institucionId && ROLES_GLOBAL.includes(profile.rolDb);
  const puedeGestionar = ROLES_GESTIONAN.includes(profile.rolDb);
  const estudiantes = data?.estudiantes || [];

  const [automaticos, setAutomaticos] = useState([]);
  const [manuales, setManuales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ estudiante_a: '', estudiante_b: '', motivo: '' });
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    if (!institucionId && !esGlobal) return;
    setLoading(true);
    const idParaFiltrar = esGlobal ? null : institucionId;
    const [auto, man] = await Promise.all([
      fetchHermanosAutomaticos(idParaFiltrar),
      fetchHermanosManual(idParaFiltrar)
    ]);
    setAutomaticos(auto);
    setManuales(man);
    setLoading(false);
  }, [institucionId, esGlobal]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const nombreEst = id => {
    const e = estudiantes.find(x => x.id === id);
    return e ? `${e.nombre}${e.curso ? ` (${e.curso}${e.paralelo || ''})` : ''}` : '—';
  };

  function abrirCrear() {
    setForm({ estudiante_a: '', estudiante_b: '', motivo: '' });
    setModalOpen(true);
  }

  async function crear(e) {
    e.preventDefault();
    if (!form.estudiante_a || !form.estudiante_b || form.estudiante_a === form.estudiante_b) {
      setToast({ tipo: 'err', msg: 'Seleccione dos estudiantes distintos.' });
      return;
    }
    setSaving(true);
    try {
      await crearHermanoManual(institucionId, form.estudiante_a, form.estudiante_b, form.motivo.trim(), profile.id);
      setModalOpen(false);
      await cargar();
      setToast({ tipo: 'ok', msg: 'Hermanos encadenados correctamente.' });
    } catch (err) {
      setToast({ tipo: 'err', msg: err.message?.includes('duplicate') ? 'Ya están encadenados.' : (err.message || 'No se pudo encadenar.') });
    }
    setSaving(false);
  }

  async function desvincular(id) {
    if (!window.confirm('¿Desvincular este grupo familiar?')) return;
    try {
      await eliminarHermanoManual(id);
      await cargar();
      setToast({ tipo: 'ok', msg: 'Grupo desvinculado.' });
    } catch (err) {
      setToast({ tipo: 'err', msg: err.message || 'No se pudo desvincular.' });
    }
  }

  if (!puedeGestionar && !esGlobal) {
    return <div className="empty"><span className="ti ti-lock" /><p>Solo Dirección, Secretaría o Inspección pueden gestionar el encadenamiento de hermanos.</p></div>;
  }
  if (loading) return <p style={{ fontSize: 13, color: 'var(--slate)' }}>Cargando…</p>;

  // ── Vista estadística global (super_admin / supervisor_general / contador_general) ──
  if (esGlobal) {
    const nombreInst = Object.fromEntries((instituciones || []).map(i => [i.id, i.nombre]));
    const porInstitucion = {};
    automaticos.forEach(g => {
      const k = g.institucion_id;
      (porInstitucion[k] ||= { grupos_auto: 0, estudiantes_auto: 0, vinculos_manual: 0 }).grupos_auto += 1;
      porInstitucion[k].estudiantes_auto += g.total_estudiantes;
    });
    manuales.forEach(h => {
      const k = h.institucion_id;
      (porInstitucion[k] ||= { grupos_auto: 0, estudiantes_auto: 0, vinculos_manual: 0 }).vinculos_manual += 1;
    });
    const filas = Object.entries(porInstitucion)
      .map(([id, v]) => ({ id, nombre: nombreInst[id] || 'Institución sin nombre', ...v }))
      .sort((a, b) => (b.grupos_auto + b.vinculos_manual) - (a.grupos_auto + a.vinculos_manual));

    const totalGrupos = automaticos.length;
    const totalEstudiantesAuto = automaticos.reduce((s, g) => s + g.total_estudiantes, 0);
    const totalManual = manuales.length;
    const totalPlanteles = filas.length;

    return (
      <div>
        <div style={{ marginBottom: 14 }}>
          <h2 style={{ margin: '0 0 4px' }}>Encadenamiento de hermanos — vista global</h2>
          <div style={{ fontSize: 13, color: 'var(--slate)' }}>Estadísticas de todos los planteles de la Zona 7. La gestión (vincular/desvincular) se hace desde la sesión de cada plantel.</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
          {[
            ['Planteles con encadenamientos', totalPlanteles],
            ['Grupos detectados automáticamente', totalGrupos],
            ['Estudiantes en grupos automáticos', totalEstudiantesAuto],
            ['Vínculos manuales registrados', totalManual]
          ].map(([label, val]) => (
            <div key={label} className="card"><div className="cb">
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--brandD)' }}>{val}</div>
              <div style={{ fontSize: 12, color: 'var(--slate)' }}>{label}</div>
            </div></div>
          ))}
        </div>

        <div className="card"><div className="cb" style={{ padding: 0, overflowX: 'auto' }}>
          {filas.length === 0 ? (
            <div className="empty"><span className="ti ti-chart-bar" /><p>Todavía no hay encadenamientos registrados en ningún plantel.</p></div>
          ) : (
            <table className="data" style={{ width: '100%' }}>
              <thead><tr><th>Plantel</th><th>Grupos automáticos</th><th>Estudiantes (auto)</th><th>Vínculos manuales</th><th>Total identificados</th></tr></thead>
              <tbody>
                {filas.map(f => (
                  <tr key={f.id}>
                    <td><strong>{f.nombre}</strong></td>
                    <td>{f.grupos_auto}</td>
                    <td>{f.estudiantes_auto}</td>
                    <td>{f.vinculos_manual}</td>
                    <td>{f.grupos_auto + f.vinculos_manual}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div></div>
      </div>
    );
  }

  // ── Vista de un plantel (admin_plantel, secretario, inspector, etc.) ──
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: '0 0 4px' }}>Encadenamiento de hermanos</h2>
          <div style={{ fontSize: 13, color: 'var(--slate)' }}>Vincula estudiantes de la misma familia en el plantel (útil para representantes y comunicados).</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={abrirCrear}><span className="ti ti-plus" /> Vincular hermanos</button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="ch"><h3>Detectados automáticamente</h3></div>
        <div className="cb">
          <div style={{ fontSize: 12, color: 'var(--slate)', marginBottom: 10 }}>
            Estudiantes que ya comparten representante en el sistema — no requieren acción, se detectan solos.
          </div>
          {automaticos.length === 0 ? (
            <div className="empty"><span className="ti ti-users" /><p>Ningún grupo detectado todavía (ningún representante tiene 2+ hijos registrados).</p></div>
          ) : automaticos.map(g => (
            <div key={g.representante_id} style={{ border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: '12px 14px', marginBottom: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Familia · {g.total_estudiantes} hermano(s)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {g.estudiantes.map(id => <span key={id} className="chip">{nombreEst(id)}</span>)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="ch"><h3>Vínculos manuales</h3></div>
        <div className="cb">
          <div style={{ fontSize: 12, color: 'var(--slate)', marginBottom: 10 }}>
            Para hermanos con representantes distintos (p. ej. padres separados) que la detección automática no cubre.
          </div>
          {manuales.length === 0 ? (
            <div className="empty"><span className="ti ti-link" /><p>Sin vínculos manuales registrados.</p></div>
          ) : manuales.map(h => (
            <div key={h.id} style={{ border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: '12px 14px', marginBottom: 10 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
                <span className="chip">{nombreEst(h.estudiante_a)}</span>
                <span className="chip">{nombreEst(h.estudiante_b)}</span>
              </div>
              {h.motivo && <div style={{ fontSize: 12, color: 'var(--slate)' }}>{h.motivo}</div>}
              <div style={{ fontSize: 11, color: 'var(--slateL)', marginTop: 6 }}>
                {h.created_at ? new Date(h.created_at).toLocaleDateString() : ''}
                <button className="btn btn-danger btn-sm" style={{ marginLeft: 8 }} onClick={() => desvincular(h.id)}>Desvincular</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {modalOpen && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <form className="modal" onSubmit={crear} style={{ maxWidth: 460 }}>
            <div className="modal-h"><h3>Vincular hermanos</h3></div>
            <div className="modal-b">
              <div className="form-grid">
                <div className="full">
                  <label className="fl">Estudiante A</label>
                  <select className="fc" value={form.estudiante_a} onChange={e => setForm(f => ({ ...f, estudiante_a: e.target.value }))}>
                    <option value="">— Seleccione —</option>
                    {estudiantes.map(e => <option key={e.id} value={e.id}>{e.nombre} ({e.curso}{e.paralelo})</option>)}
                  </select>
                </div>
                <div className="full">
                  <label className="fl">Estudiante B</label>
                  <select className="fc" value={form.estudiante_b} onChange={e => setForm(f => ({ ...f, estudiante_b: e.target.value }))}>
                    <option value="">— Seleccione —</option>
                    {estudiantes.map(e => <option key={e.id} value={e.id}>{e.nombre} ({e.curso}{e.paralelo})</option>)}
                  </select>
                </div>
                <div className="full">
                  <label className="fl">Motivo (opcional)</label>
                  <input className="fc" placeholder="Ej. padres separados, representantes distintos" value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-f">
              <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Encadenar'}</button>
            </div>
          </form>
        </div>
      )}

      {toast && <div className={'toast ' + (toast.tipo === 'ok' ? 'ok' : 'err')}>{toast.msg}</div>}
    </div>
  );
}
