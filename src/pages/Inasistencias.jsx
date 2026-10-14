import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { fetchInasistencias, registrarAviso, fetchFichaAsistencia, registrarOficiosEmitidos, enviarOficioPorCorreo } from '../lib/data.js';
import OficioFaltasModal from '../components/OficioFaltasModal.jsx';
import { analizarFicha } from '../lib/fichaAsistencia.js';

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function haceDias(n) { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); }

function linkWhatsapp(telefono, nombreAlumno, fecha) {
  const tel = (telefono || '').replace(/\D/g, '').replace(/^0/, '');
  const msg = encodeURIComponent(`Estimado/a representante: le informamos que ${nombreAlumno} registró una inasistencia el ${fecha}. Por favor justificar si corresponde.`);
  return `https://wa.me/593${tel}?text=${msg}`;
}

export default function Inasistencias() {
  const { profile, institucion } = useSession();
  const institucionId = institucion?.id;
  const [dias, setDias] = useState(7);
  const [filtro, setFiltro] = useState('pendientes'); // pendientes | avisadas | todas
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(null);
  const [toast, setToast] = useState(null);
  const [oficio, setOficio] = useState(null);   // { alumnos, periodo } mientras el modal del oficio está abierto
  const [armando, setArmando] = useState(null);

  const cargar = useCallback(async () => {
    if (!institucionId) return;
    setLoading(true);
    const rows = await fetchInasistencias(institucionId, haceDias(dias));
    setItems(rows);
    setLoading(false);
  }, [institucionId, dias]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }, [toast]);

  async function marcarAvisado(item) {
    setEnviando(item.asistenciaId);
    try {
      await registrarAviso(institucionId, item.estudianteId,
        `Inasistencia del ${item.fecha} — ${item.curso}.`, profile.id, item.fecha);
      setItems(list => list.map(x => x.asistenciaId === item.asistenciaId ? { ...x, avisado: true } : x));
      setToast({ tipo: 'ok', msg: 'Marcado como avisado.' });
    } catch (err) {
      setToast({ tipo: 'err', msg: err.message || 'No se pudo registrar el aviso.' });
    }
    setEnviando(null);
  }

  function abrirWhatsappYMarcar(item) {
    if (!item.telefonoRep) { setToast({ tipo: 'err', msg: 'Este estudiante no tiene un representante con teléfono registrado.' }); return; }
    window.open(linkWhatsapp(item.telefonoRep, item.nombre, item.fecha), '_blank', 'noopener,noreferrer');
    marcarAvisado(item);
  }


  // Oficio de un estudiante con sus faltas del rango elegido arriba; se puede imprimir o enviar por correo al representante.
  async function abrirOficio(item) {
    setArmando(item.estudianteId);
    try {
      const desde = haceDias(dias), hasta = iso(new Date());
      const ficha = await fetchFichaAsistencia(institucionId, item.estudianteId, desde, hasta);
      const an = analizarFicha(ficha.registros);
      if (an.resumen.faltas === 0) { setToast({ tipo: 'err', msg: 'Este estudiante no tiene faltas injustificadas en el período (pueden estar ya justificadas).' }); setArmando(null); return; }
      setOficio({
        periodo: { desde, hasta },
        alumnos: [{ id: item.estudianteId, nombre: item.nombre, cedula: item.cedula, curso: item.curso, ...an.resumen, representante: ficha.representante, correoRep: ficha.correoRep }]
      });
    } catch (err) {
      setToast({ tipo: 'err', msg: err.message || 'No se pudo preparar el oficio.' });
    }
    setArmando(null);
  }
  const registrarOficio = items => registrarOficiosEmitidos(institucionId, items, profile.id);

  const filtrados = useMemo(() => {
    if (filtro === 'pendientes') return items.filter(i => !i.avisado);
    if (filtro === 'avisadas') return items.filter(i => i.avisado);
    return items;
  }, [items, filtro]);

  const pendientesCount = items.filter(i => !i.avisado).length;

  if (loading) return <p style={{ fontSize: 13, color: 'var(--slate)' }}>Cargando…</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: '0 0 4px' }}>Inasistencias</h2>
          <div style={{ fontSize: 13, color: 'var(--slate)' }}>{institucion?.nombre} · Avisos a representantes por WhatsApp y oficios por correo electrónico</div>
        </div>
        <select className="fc" value={dias} onChange={e => setDias(Number(e.target.value))} style={{ width: 160 }}>
          <option value={7}>Últimos 7 días</option>
          <option value={15}>Últimos 15 días</option>
          <option value={30}>Últimos 30 días</option>
        </select>
      </div>

      <div className="grid-3" style={{ marginBottom: 14 }}>
        <div className="metric m-red"><div className="m-lbl">Total ausencias</div><div className="m-val">{items.length}</div></div>
        <div className="metric m-amber"><div className="m-lbl">Pendientes de avisar</div><div className="m-val">{pendientesCount}</div></div>
        <div className="metric m-green"><div className="m-lbl">Ya avisadas</div><div className="m-val">{items.length - pendientesCount}</div></div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[['pendientes', 'Pendientes'], ['avisadas', 'Ya avisadas'], ['todas', 'Todas']].map(([v, label]) => (
          <button key={v} className={'btn btn-sm ' + (filtro === v ? 'btn-primary' : 'btn-secondary')} onClick={() => setFiltro(v)}>{label}</button>
        ))}
      </div>

      {filtrados.length === 0 ? (
        <div className="empty"><span className="ti ti-message-circle" /><p>{filtro === 'pendientes' ? '¡Al día! No hay avisos pendientes.' : 'Sin registros en este filtro.'}</p></div>
      ) : (
        <div className="card"><div className="cb" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="data" style={{ width: '100%' }}>
            <thead><tr><th>Fecha</th><th>Estudiante</th><th>Curso</th><th>Representante</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {filtrados.map(item => (
                <tr key={item.asistenciaId}>
                  <td className="mono">{item.fecha}</td>
                  <td>{item.nombre}</td>
                  <td>{item.curso}</td>
                  <td style={{ fontSize: 12 }}>
                    {item.representante || <span style={{ color: 'var(--slate)' }}>Sin representante vinculado</span>}
                    {item.representante && !item.telefonoRep && <div style={{ color: 'var(--red)' }}>Sin teléfono</div>}
                    {item.representante && !item.correoRep && <div style={{ color: 'var(--slate)' }}>Sin correo</div>}
                  </td>
                  <td>{item.avisado ? <span className="badge b-ok">Avisado</span> : <span className="badge b-warn">Pendiente</span>}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary btn-sm" disabled={armando === item.estudianteId} onClick={() => abrirOficio(item)}
                        title="Genera el oficio con las faltas del período; puedes imprimirlo o enviarlo por correo al representante">
                        ✉️ Oficio
                      </button>
                    </div>
                    {!item.avisado && (
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 6 }}>
                        <button className="btn btn-success btn-sm" disabled={!item.telefonoRep || enviando === item.asistenciaId}
                          onClick={() => abrirWhatsappYMarcar(item)}>
                          <span className="ti ti-brand-whatsapp" /> Avisar
                        </button>
                        <button className="btn btn-ghost btn-sm" disabled={enviando === item.asistenciaId}
                          onClick={() => marcarAvisado(item)} title="Ya lo avisé por otro medio (llamada, en persona)">
                          Marcar avisado
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      )}

      {oficio && <OficioFaltasModal alumnos={oficio.alumnos} institucion={institucion} periodo={oficio.periodo} onClose={() => setOficio(null)} onRegistrar={registrarOficio} onEnviarCorreo={enviarOficioPorCorreo} />}

      {toast && <div className={'toast ' + (toast.tipo === 'ok' ? 'ok' : 'err')}>{toast.msg}</div>}
    </div>
  );
}
