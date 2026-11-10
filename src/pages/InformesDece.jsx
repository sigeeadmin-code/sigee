import React, { useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';

/**
 * Módulo DECE – Informes Individuales
 * Conforme a la normativa del Ministerio de Educación del Ecuador:
 * - Plan de Intervención Individual
 * - Registro de Sesión / Seguimiento
 * - Informe de Seguimiento
 * - Informe de Cierre de Caso
 * - Informe de Derivación
 *
 * Multi-tenant: solo muestra datos del plantel de la sesión.
 */
const TIPOS_INFORME = [
  { id: 'plan_intervencion', label: 'Plan de Intervención Individual', icon: 'ti ti-clipboard-list' },
  { id: 'registro_sesion', label: 'Registro de Sesión / Seguimiento', icon: 'ti ti-notes' },
  { id: 'informe_seguimiento', label: 'Informe de Seguimiento', icon: 'ti ti-report-analytics' },
  { id: 'informe_cierre', label: 'Informe de Cierre de Caso', icon: 'ti ti-circle-check' },
  { id: 'informe_derivacion', label: 'Informe de Derivación', icon: 'ti ti-arrow-forward-up' },
];

export default function InformesDece() {
  const { data, institucion, profile } = useSession();
  const [busqueda, setBusqueda] = useState('');
  const [fCurso, setFCurso] = useState('');
  const [seleccionado, setSeleccionado] = useState(null);
  const [tipoInforme, setTipoInforme] = useState(null);
  const [borrador, setBorrador] = useState({});

  const estudiantes = (data?.estudiantes || []).filter(e => {
    if (institucion?.id && e.institucionId && e.institucionId !== institucion.id) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      if (!e.nombre?.toLowerCase().includes(q) && !(e.cedula || '').includes(q)) return false;
    }
    if (fCurso && `${e.curso} ${e.paralelo}`.trim() !== fCurso) return false;
    return true;
  });

  const cursos = [...new Set((data?.estudiantes || []).map(e => `${e.curso} ${e.paralelo}`.trim()).filter(c => c && c !== '—'))].sort();

  function abrirNuevoInforme(est, tipo) {
    setSeleccionado(est);
    setTipoInforme(tipo);
    setBorrador({
      estudianteId: est.id,
      estudianteNombre: est.nombre,
      tipo: tipo.id,
      fecha: new Date().toISOString().slice(0, 10),
      problemas: '',
      objetivos: '',
      actividades: '',
      responsables: profile?.nombre || profile?.email || 'Profesional DECE',
      indicadores: '',
      observaciones: '',
      acuerdos: '',
      avances: '',
    });
  }

  function cerrar() {
    setSeleccionado(null);
    setTipoInforme(null);
    setBorrador({});
  }

  function guardarBorrador() {
    // Placeholder: en producción se persistiría en tabla dece_informes (multi-tenant por institucion_id)
    alert(`Informe "${tipoInforme?.label}" guardado para ${seleccionado?.nombre}.\n\n(En la siguiente iteración se conectará a la base de datos.)`);
    cerrar();
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>Informes Individuales DECE</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--slate)', fontSize: 13 }}>
            Genera planes de intervención, registros de sesión, seguimientos, cierres y derivaciones de forma independiente del oficio docente.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          className="input"
          placeholder="Buscar por nombre o cédula…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{ minWidth: 220 }}
        />
        <select className="input" value={fCurso} onChange={e => setFCurso(e.target.value)}>
          <option value="">Todos los cursos</option>
          {cursos.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="card" style={{ overflow: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Cédula</th>
              <th>Curso</th>
              <th>Estado</th>
              <th style={{ textAlign: 'right' }}>Generar informe</th>
            </tr>
          </thead>
          <tbody>
            {estudiantes.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--slate)', padding: 24 }}>No hay estudiantes con los filtros actuales.</td></tr>
            )}
            {estudiantes.map(e => (
              <tr key={e.id}>
                <td><strong>{e.nombre}</strong></td>
                <td>{e.cedula || '—'}</td>
                <td>{e.curso} {e.paralelo}</td>
                <td>
                  <span className={`badge ${e.activo ? 'badge-success' : 'badge-muted'}`}>
                    {e.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    {TIPOS_INFORME.map(t => (
                      <button
                        key={t.id}
                        className="btn btn-secondary btn-sm"
                        title={t.label}
                        onClick={() => abrirNuevoInforme(e, t)}
                      >
                        <span className={t.icon} style={{ marginRight: 4 }} />
                        {t.label.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {seleccionado && tipoInforme && (
        <div className="modal-overlay" onClick={cerrar}>
          <div className="modal" style={{ maxWidth: 640, width: '95%' }} onClick={ev => ev.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>{tipoInforme.label}</h3>
              <button className="btn btn-ghost" onClick={cerrar}>✕</button>
            </div>
            <p style={{ marginTop: 0, color: 'var(--slate)', fontSize: 13 }}>
              Estudiante: <strong>{seleccionado.nombre}</strong> · {seleccionado.curso} {seleccionado.paralelo}
            </p>

            <div style={{ display: 'grid', gap: 10 }}>
              <label>
                Fecha
                <input className="input" type="date" value={borrador.fecha || ''} onChange={e => setBorrador(b => ({ ...b, fecha: e.target.value }))} />
              </label>
              <label>
                Problemas / Motivo de atención
                <textarea className="input" rows={2} value={borrador.problemas || ''} onChange={e => setBorrador(b => ({ ...b, problemas: e.target.value }))} />
              </label>
              <label>
                Objetivos
                <textarea className="input" rows={2} value={borrador.objetivos || ''} onChange={e => setBorrador(b => ({ ...b, objetivos: e.target.value }))} />
              </label>
              <label>
                Actividades / Intervención
                <textarea className="input" rows={3} value={borrador.actividades || ''} onChange={e => setBorrador(b => ({ ...b, actividades: e.target.value }))} />
              </label>
              <label>
                Responsables
                <input className="input" value={borrador.responsables || ''} onChange={e => setBorrador(b => ({ ...b, responsables: e.target.value }))} />
              </label>
              <label>
                Indicadores de logro / Avances
                <textarea className="input" rows={2} value={borrador.avances || ''} onChange={e => setBorrador(b => ({ ...b, avances: e.target.value }))} />
              </label>
              <label>
                Observaciones / Acuerdos
                <textarea className="input" rows={2} value={borrador.observaciones || ''} onChange={e => setBorrador(b => ({ ...b, observaciones: e.target.value }))} />
              </label>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={cerrar}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarBorrador}>Guardar informe</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
