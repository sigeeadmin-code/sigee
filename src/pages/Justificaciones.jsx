import React, { useEffect, useState, useCallback } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { fetchJustificaciones, crearJustificacion, revisarJustificacion, marcarAsistenciaJustificada } from '../lib/data.js';

export default function Justificaciones() {
  const { profile, institucion, data } = useSession();
  const institucionId = institucion?.id;
  const estudiantes = data?.estudiantes || [];

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ estudiante_id: '', fecha: '', motivo: '' });
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    if (!institucionId) return;
    setLoading(true);
    setItems(await fetchJustificaciones(institucionId));
    setLoading(false);
  }, [institucionId]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const pendientes = items.filter(j => j.estado === 'pendiente').length;
  const nombreEst = id => { const e = estudiantes.find(x => x.id === id); return e ? e.nombre : '—'; };

  async function resolver(j, estado) {
    let motivoRechazo = null;
    if (estado === 'rechazada') {
      motivoRechazo = window.prompt('Motivo del rechazo:');
      if (!motivoRechazo) return;
    }
    try {
      await revisarJustificacion(j.id, estado, profile.id);
      if (estado === 'aprobada') {
        await marcarAsistenciaJustificada(j.estudiante_id, j.fecha);
      }
      setToast({ tipo: 'ok', msg: estado === 'aprobada' ? 'Justificación aprobada.' : 'Justificación rechazada.' });
      await cargar();
    } catch (err) {
      setToast({ tipo: 'err', msg: err.message || 'No se pudo actualizar.' });
    }
  }

  function abrirCrear() {
    setForm({ estudiante_id: estudiantes[0]?.id || '', fecha: '', motivo: '' });
    setModalOpen(true);
  }

  async function crear(e) {
    e.preventDefault();
    if (!form.estudiante_id || !form.fecha || !form.motivo.trim()) return;
    setSaving(true);
    try {
      await crearJustificacion(institucionId, { estudiante_id: form.estudiante_id, fecha: form.fecha, motivo: form.motivo.trim() }, profile.id);
      setModalOpen(false);
      await cargar();
      setToast({ tipo: 'ok', msg: 'Justificación registrada.' });
    } catch (err) {
      setToast({ tipo: 'err', msg: err.message || 'No se pudo registrar.' });
    }
    setSaving(false);
  }

  if (loading) return <p style={{ fontSize: 13, color: 'var(--slate)' }}>Cargando…</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: '0 0 4px' }}>Justificaciones de inasistencia</h2>
          <div style={{ fontSize: 13, color: 'var(--slate)' }}>{pendientes} pendiente(s) · Al aprobar, el pase pasa a estado justificado</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={abrirCrear}><span className="ti ti-plus" /> Nueva justificación</button>
      </div>

      {items.length === 0 ? (
        <div className="empty"><span className="ti ti-file-check" /><p>Sin justificaciones registradas.</p></div>
      ) : (
        <div className="card"><div className="cb" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="data" style={{ width: '100%' }}>
            <thead><tr><th>Falta</th><th>Estudiante</th><th>Motivo</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {items.map(j => (
                <tr key={j.id}>
                  <td className="mono">{j.fecha}</td>
                  <td><strong>{nombreEst(j.estudiante_id)}</strong></td>
                  <td>{j.motivo}</td>
                  <td>
                    <span className={'badge ' + (j.estado === 'pendiente' ? 'b-warn' : j.estado === 'aprobada' ? 'b-ok' : 'b-err')}>
                      {j.estado}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {j.estado === 'pendiente' ? (
                      <>
                        <button className="btn btn-success btn-sm" onClick={() => resolver(j, 'aprobada')}>Aprobar</button>{' '}
                        <button className="btn btn-danger btn-sm" onClick={() => resolver(j, 'rechazada')}>Rechazar</button>
                      </>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      )}

      {modalOpen && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <form className="modal" onSubmit={crear} style={{ maxWidth: 460 }}>
            <div className="modal-h"><h3>Nueva justificación</h3></div>
            <div className="modal-b">
              <div className="form-grid">
                <div className="full">
                  <label className="fl">Estudiante</label>
                  <select className="fc" value={form.estudiante_id} onChange={e => setForm(f => ({ ...f, estudiante_id: e.target.value }))}>
                    {estudiantes.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="fl">Fecha de la falta</label>
                  <input className="fc" type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
                </div>
                <div className="full">
                  <label className="fl">Motivo</label>
                  <textarea className="fc" rows={3} value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-f">
              <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Registrar'}</button>
            </div>
          </form>
        </div>
      )}

      {toast && <div className={'toast ' + (toast.tipo === 'ok' ? 'ok' : 'err')}>{toast.msg}</div>}
    </div>
  );
}
