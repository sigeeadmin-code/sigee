import React, { useEffect, useState, useCallback } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { fetchCalendario, crearEventoCalendario, eliminarEventoCalendario } from '../lib/data.js';

const TIPOS = ['Vacaciones', 'Festivo', 'Institucional', 'Receso'];
const TIPO_BADGE = { Vacaciones: 'b-info', Festivo: 'b-err', Institucional: 'b-warn', Receso: 'b-muted' };

function hoyISO() { return new Date().toISOString().slice(0, 10); }

export default function Calendario() {
  const { profile, institucion, data } = useSession();
  const institucionId = institucion?.id;
  const periodoActivo = data?.periodoActivo;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ tipo: 'Festivo', fecha_inicio: hoyISO(), fecha_fin: hoyISO(), descripcion: '' });
  const [saving, setSaving] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState('');

  const cargar = useCallback(async () => {
    if (!institucionId) return;
    setLoading(true);
    setItems(await fetchCalendario(institucionId));
    setLoading(false);
  }, [institucionId]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function abrirCrear() {
    setForm({ tipo: 'Festivo', fecha_inicio: hoyISO(), fecha_fin: hoyISO(), descripcion: '' });
    setModalOpen(true);
  }

  async function crear(e) {
    e.preventDefault();
    if (!form.fecha_inicio || !form.fecha_fin) return;
    setSaving(true);
    try {
      await crearEventoCalendario(institucionId, {
        periodo_id: periodoActivo?.id || null, tipo: form.tipo,
        fecha_inicio: form.fecha_inicio, fecha_fin: form.fecha_fin, descripcion: form.descripcion.trim() || null
      }, profile.id);
      setModalOpen(false);
      await cargar();
      setToast({ tipo: 'ok', msg: 'Evento agregado.' });
    } catch (err) {
      setToast({ tipo: 'err', msg: err.message || 'No se pudo guardar.' });
    }
    setSaving(false);
  }

  async function eliminar(ev) {
    if (!window.confirm(`¿Eliminar "${ev.descripcion || ev.tipo}"?`)) return;
    try {
      await eliminarEventoCalendario(ev.id);
      await cargar();
      setToast({ tipo: 'ok', msg: 'Evento eliminado.' });
    } catch (err) {
      setToast({ tipo: 'err', msg: err.message || 'No se pudo eliminar.' });
    }
  }

  const filtrados = filtroTipo ? items.filter(e => e.tipo === filtroTipo) : items;
  const conteos = TIPOS.reduce((acc, t) => ({ ...acc, [t]: items.filter(e => e.tipo === t).length }), {});

  if (loading) return <p style={{ fontSize: 13, color: 'var(--slate)' }}>Cargando…</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: '0 0 4px' }}>Calendario académico</h2>
          <div style={{ fontSize: 13, color: 'var(--slate)' }}>{institucion?.nombre} · {periodoActivo?.nombre || 'Sin período activo'}</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={abrirCrear}><span className="ti ti-plus" /> Nuevo evento</button>
      </div>

      <div className="grid-4">
        {TIPOS.map(t => (
          <div key={t} className="card" style={{ padding: 14, cursor: 'pointer', outline: filtroTipo === t ? '2px solid var(--brand)' : 'none' }}
            onClick={() => setFiltroTipo(f => f === t ? '' : t)}>
            <div style={{ fontSize: 11, color: 'var(--slate)' }}>{t}</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{conteos[t]}</div>
          </div>
        ))}
      </div>

      {filtrados.length === 0 ? (
        <div className="empty"><span className="ti ti-calendar" /><p>Sin eventos {filtroTipo ? `de tipo "${filtroTipo}"` : 'registrados'}.</p></div>
      ) : (
        <div className="card"><div className="cb" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="data" style={{ width: '100%' }}>
            <thead><tr><th>Tipo</th><th>Desde</th><th>Hasta</th><th>Descripción</th><th /></tr></thead>
            <tbody>
              {filtrados
                .sort((a, b) => (a.fecha_inicio || '').localeCompare(b.fecha_inicio || ''))
                .map(ev => (
                  <tr key={ev.id}>
                    <td><span className={'badge ' + (TIPO_BADGE[ev.tipo] || 'b-muted')}>{ev.tipo}</span></td>
                    <td className="mono">{ev.fecha_inicio}</td>
                    <td className="mono">{ev.fecha_fin}</td>
                    <td>{ev.descripcion || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => eliminar(ev)}>Eliminar</button>
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
            <div className="modal-h"><h3>Nuevo evento</h3></div>
            <div className="modal-b">
              <div className="form-grid">
                <div className="full">
                  <label className="fl">Tipo</label>
                  <select className="fc" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                    {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="fl">Desde</label>
                  <input className="fc" type="date" value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} />
                </div>
                <div>
                  <label className="fl">Hasta</label>
                  <input className="fc" type="date" value={form.fecha_fin} onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))} />
                </div>
                <div className="full">
                  <label className="fl">Descripción</label>
                  <input className="fc" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Ej: Día de la Independencia" />
                </div>
              </div>
            </div>
            <div className="modal-f">
              <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Crear'}</button>
            </div>
          </form>
        </div>
      )}

      {toast && <div className={'toast ' + (toast.tipo === 'ok' ? 'ok' : 'err')}>{toast.msg}</div>}
    </div>
  );
}
