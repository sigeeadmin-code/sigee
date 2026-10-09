import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { fetchCalendario, crearEventoCalendario, eliminarEventoCalendario, evaluarDia } from '../lib/data.js';
import { fetchGradosConParalelos } from '../lib/data.js';
import { TIPOS_EVENTO, TIPO_LABEL, TIPO_BADGE, hoyISO } from '../lib/calendario.js';
import { resumenAnioLectivo } from '../lib/calendarioResumen.js';

export default function Calendario() {
  const { profile, institucion, data } = useSession();
  const institucionId = institucion?.id;
  const periodoActivo = data?.periodoActivo;

  const [items, setItems] = useState([]);
  const [grados, setGrados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ tipo: 'evento', fecha_inicio: hoyISO(), fecha_fin: hoyISO(), descripcion: '', paralelo_id: '' });
  const [saving, setSaving] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState('');

  const [testFecha, setTestFecha] = useState(hoyISO());
  const [testParalelo, setTestParalelo] = useState('');

  const cargar = useCallback(async () => {
    if (!institucionId) return;
    setLoading(true);
    const [ev, gr] = await Promise.all([fetchCalendario(institucionId), fetchGradosConParalelos(institucionId)]);
    setItems(ev);
    setGrados(gr);
    setLoading(false);
  }, [institucionId]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function abrirCrear() {
    setForm({ tipo: 'evento', fecha_inicio: hoyISO(), fecha_fin: hoyISO(), descripcion: '', paralelo_id: '' });
    setModalOpen(true);
  }

  async function crear(e) {
    e.preventDefault();
    if (!form.fecha_inicio || !form.fecha_fin) return;
    setSaving(true);
    try {
      await crearEventoCalendario(institucionId, {
        periodo_id: periodoActivo?.id || null, tipo: form.tipo,
        fecha_inicio: form.fecha_inicio, fecha_fin: form.fecha_fin,
        descripcion: form.descripcion.trim() || null,
        paralelo_id: form.paralelo_id || null
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
    const aviso = ev.origen === 'oficial' ? '\n\nEs parte del calendario oficial del Ministerio de Educación; se quitará solo en este plantel.' : '';
    if (!window.confirm(`¿Eliminar "${ev.descripcion || TIPO_LABEL[ev.tipo]}"?${aviso}`)) return;
    try {
      await eliminarEventoCalendario(ev.id);
      await cargar();
      setToast({ tipo: 'ok', msg: 'Evento eliminado.' });
    } catch (err) {
      setToast({ tipo: 'err', msg: err.message || 'No se pudo eliminar.' });
    }
  }

  const paralelosPlano = grados.flatMap(g => g.paralelos.map(p => ({ id: p.id, label: `${g.nombre} ${p.nombre}` })));
  const nombreParalelo = id => paralelosPlano.find(p => p.id === id)?.label;

  const filtrados = filtroTipo ? items.filter(e => e.tipo === filtroTipo) : items;
  const conteos = TIPOS_EVENTO.reduce((acc, t) => ({ ...acc, [t]: items.filter(e => e.tipo === t).length }), {});

  const resultadoTest = evaluarDia(testFecha, items, periodoActivo, testParalelo || null);
  const anio = useMemo(() => resumenAnioLectivo(items, hoyISO()), [items]);

  if (loading) return <p style={{ fontSize: 13, color: 'var(--slate)' }}>Cargando…</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: '0 0 4px' }}>Calendario académico</h2>
          <div style={{ fontSize: 13, color: 'var(--slate)' }}>
            {institucion?.nombre} · {periodoActivo ? `${periodoActivo.nombre} (${periodoActivo.fecha_inicio} a ${periodoActivo.fecha_fin})` : 'Sin período activo'}
            {institucion?.regimen ? ` · Régimen ${institucion.regimen}` : ''}
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={abrirCrear}><span className="ti ti-plus" /> Nuevo evento</button>
      </div>

      {!periodoActivo && (
        <div className="card" style={{ marginBottom: 14, borderColor: 'var(--amber)' }}>
          <div className="cb" style={{ fontSize: 13 }}>
            No hay un período lectivo activo — el calendario no puede validar fechas contra un año lectivo.
            Ve a <strong>Académico → Períodos</strong> para crear/activar uno.
          </div>
        </div>
      )}

      {anio && <ResumenAnio anio={anio} />}

      <div className="grid-4">
        {TIPOS_EVENTO.map(t => (
          <div key={t} className="card" style={{ padding: 14, cursor: 'pointer', outline: filtroTipo === t ? '2px solid var(--brand)' : 'none' }}
            onClick={() => setFiltroTipo(f => f === t ? '' : t)}>
            <div style={{ fontSize: 11, color: 'var(--slate)' }}>{TIPO_LABEL[t]}</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{conteos[t]}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="ch"><h3>Probar día</h3></div>
        <div className="cb" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div><label className="fl">Fecha</label><input className="fc" type="date" value={testFecha} onChange={e => setTestFecha(e.target.value)} style={{ width: 160 }} /></div>
          <div>
            <label className="fl">Curso (opcional)</label>
            <select className="fc" value={testParalelo} onChange={e => setTestParalelo(e.target.value)} style={{ width: 200 }}>
              <option value="">Toda la institución</option>
              {paralelosPlano.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <span className={'badge ' + (resultadoTest.ok ? 'b-ok' : 'b-err')} style={{ padding: '8px 12px' }}>{resultadoTest.msg}</span>
        </div>
      </div>

      {filtrados.length === 0 ? (
        <div className="empty"><span className="ti ti-calendar" /><p>Sin eventos {filtroTipo ? `de tipo "${TIPO_LABEL[filtroTipo]}"` : 'registrados'}.</p></div>
      ) : (
        <div className="card"><div className="cb" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="data" style={{ width: '100%' }}>
            <thead><tr><th>Tipo</th><th>Desde</th><th>Hasta</th><th>Descripción</th><th>Alcance</th><th /></tr></thead>
            <tbody>
              {filtrados
                .slice()
                .sort((a, b) => (a.fecha_inicio || '').localeCompare(b.fecha_inicio || ''))
                .map(ev => (
                  <tr key={ev.id}>
                    <td><span className={'badge ' + (TIPO_BADGE[ev.tipo] || 'b-muted')}>{TIPO_LABEL[ev.tipo]}</span></td>
                    <td className="mono">{ev.fecha_inicio}</td>
                    <td className="mono">{ev.fecha_fin}</td>
                    <td>{ev.descripcion || '—'}{ev.origen === 'oficial' && <span className="badge b-info" style={{ marginLeft: 8 }} title="Calendario oficial del Ministerio de Educación">Oficial</span>}</td>
                    <td style={{ fontSize: 12 }}>{ev.paralelo_id ? (nombreParalelo(ev.paralelo_id) || 'Curso eliminado') : <span className="badge b-muted">Toda la institución</span>}</td>
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
                    {TIPOS_EVENTO.map(t => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
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
                <div className="full">
                  <label className="fl">Alcance</label>
                  <select className="fc" value={form.paralelo_id} onChange={e => setForm(f => ({ ...f, paralelo_id: e.target.value }))}>
                    <option value="">Toda la institución</option>
                    {paralelosPlano.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                  <div style={{ fontSize: 11, color: 'var(--slate)', marginTop: 4 }}>Deja "Toda la institución" salvo que este evento (por ejemplo una excepción o recuperación) aplique solo a un curso específico.</div>
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

const fechaCorta = f => (f ? `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}` : '—');

// Tarjetas con los períodos académicos del año lectivo y cuántos días lectivos van y faltan.
function ResumenAnio({ anio }) {
  const pct = anio.total ? Math.round((anio.transcurridos / anio.total) * 100) : 0;
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="ch" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ margin: 0 }}>Año lectivo {anio.inicio.slice(0, 4)}–{anio.fin.slice(0, 4)}</h3>
        <span style={{ fontSize: 12.5, color: 'var(--slate)' }}>
          {fechaCorta(anio.inicio)} al {fechaCorta(anio.fin)} · {anio.total} días lectivos · van {anio.transcurridos} ({pct}%) y faltan {anio.restantes}
        </span>
      </div>
      <div className="cb">
        <div style={{ height: 8, background: 'var(--line, #e2e8f0)', borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ width: pct + '%', height: '100%', background: 'var(--brand, #0891b2)' }} />
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {anio.periodos.map(p => (
            <div key={p.inicio} className="card" style={{ margin: 0, padding: '10px 14px', flex: '1 1 200px', outline: p.actual ? '2px solid var(--brand)' : 'none' }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{p.nombre}{p.actual ? ' · en curso' : ''}</div>
              <div style={{ fontSize: 11.5, color: 'var(--slate)' }}>{fechaCorta(p.inicio)} al {fechaCorta(p.fin)}</div>
              <div style={{ fontSize: 13, marginTop: 4 }}><strong>{p.total}</strong> días lectivos{p.actual ? ` · faltan ${p.restantes}` : p.restantes === 0 ? ' · terminado' : ''}</div>
            </div>
          ))}
        </div>
        {anio.proximoNoLectivo && (
          <div style={{ fontSize: 12.5, color: 'var(--slate)', marginTop: 10 }}>
            Próximo día no lectivo: <strong>{anio.proximoNoLectivo.descripcion}</strong> ({fechaCorta(anio.proximoNoLectivo.desde)}{anio.proximoNoLectivo.hasta !== anio.proximoNoLectivo.desde ? ` al ${fechaCorta(anio.proximoNoLectivo.hasta)}` : ''}).
          </div>
        )}
      </div>
    </div>
  );
}
