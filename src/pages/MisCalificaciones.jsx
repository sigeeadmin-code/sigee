import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import {
  fetchHijosDeRepresentante, fetchEstudianteIdPorProfile, fetchBoletaEstudiante, fetchNombreDocente
} from '../lib/data.js';
import { escalaDAAPA, aDos } from '../lib/calificaciones.js';
import { documentoBoletas, materiasParaBoleta } from '../lib/boletaHTML.js';

const ESTADO_BADGE = { aprobado: 'b-ok', supletorio: 'b-warn', remedial: 'b-err', pendiente: 'b-muted' };
const ESTADO_LABEL = { aprobado: 'Aprobado', supletorio: 'Supletorio', remedial: 'Remedial', pendiente: 'En curso' };
const OPCIONES_BOLETA = [['anual', 'Informe final anual'], ['T1', '1er Trimestre'], ['T2', '2do Trimestre'], ['T3', '3er Trimestre']];
const fmt = n => (n === null || n === undefined ? '—' : Number(n).toFixed(2));

/** Vista de SOLO LECTURA: el estudiante o el representante ven únicamente las notas definitivas del estudiante. */
export default function MisCalificaciones() {
  const { profile, institucion, data } = useSession();
  const esPadre = profile.rolDb === 'padre';
  const periodo = data?.periodoActivo;
  const [hijos, setHijos] = useState([]);
  const [estudianteId, setEstudianteId] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tipoBoleta, setTipoBoleta] = useState('anual');
  const [aviso, setAviso] = useState(null);

  useEffect(() => {
    let activo = true;
    (async () => {
      setLoading(true);
      if (esPadre) {
        const h = await fetchHijosDeRepresentante(profile.id);
        if (!activo) return;
        setHijos(h); setEstudianteId(h[0]?.id || null);
        if (!h.length) setLoading(false);
      } else {
        const id = await fetchEstudianteIdPorProfile(profile.id);
        if (!activo) return;
        setEstudianteId(id);
        if (!id) setLoading(false);
      }
    })();
    return () => { activo = false; };
  }, [esPadre, profile.id]);

  useEffect(() => {
    if (!estudianteId || !periodo) { if (!estudianteId) return; setLoading(false); return; }
    let activo = true;
    setLoading(true);
    fetchBoletaEstudiante(estudianteId, periodo.id).then(r => { if (activo) { setInfo(r); setLoading(false); } });
    return () => { activo = false; };
  }, [estudianteId, periodo?.id]);

  const materias = useMemo(
    () => (info?.cargas ? materiasParaBoleta(info.cargas, info.notas, info.mejoras) : []),
    [info]
  );
  const general = useMemo(() => {
    const vals = materias.map(m => m.final).filter(v => v !== null && v !== undefined);
    return vals.length ? aDos(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  }, [materias]);

  const imprimir = async () => {
    const w = window.open('', '_blank'); // dentro del clic, para que no lo bloquee el navegador
    if (!w) { setAviso('El navegador bloqueó la ventana. Permite ventanas emergentes para este sitio e inténtalo de nuevo.'); return; }
    w.document.write('<p style="font-family:sans-serif;padding:20px">Generando boleta…</p>');
    try {
      const tutorNombre = await fetchNombreDocente(info.paralelo?.tutor_docente_id);
      const fecha = new Date().toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: 'numeric' });
      const e = info.estudiante;
      const html = documentoBoletas([{
        institucion, periodoNombre: periodo.nombre, cursoNombre: info.grado?.nombre || '', paraleloNombre: info.paralelo?.nombre || '',
        tutorNombre, tipo: tipoBoleta, fechaEmision: fecha,
        estudiante: { nombre: `${e.apellidos || ''} ${e.nombres || ''}`.trim(), cedula: e.cedula || '' },
        materias
      }], 'Boleta de calificaciones');
      w.document.open(); w.document.write(html); w.document.close();
      setTimeout(() => { try { w.focus(); w.print(); } catch (err) { /* se puede imprimir manualmente */ } }, 500);
    } catch (err) {
      w.close();
      setAviso('No se pudo generar la boleta: ' + (err.message || err));
    }
  };

  if (loading) return <p style={{ fontSize: 13, color: 'var(--slate)' }}>Cargando…</p>;
  if (esPadre && hijos.length === 0) return <div className="empty"><span className="ti ti-users" /><p>No hay ningún estudiante vinculado a tu cuenta todavía.</p></div>;
  if (!periodo) return <div className="empty"><span className="ti ti-report" /><p>No hay un período lectivo activo.</p></div>;
  if (!info || !info.matricula) return <div className="empty"><span className="ti ti-report" /><p>Sin matrícula activa en el período actual.</p></div>;
  if (info.grado?.nivel !== 'BGU') {
    return <div className="empty"><span className="ti ti-report" /><p>Las calificaciones y boletas de tu nivel se habilitarán en una próxima etapa.</p></div>;
  }

  const e = info.estudiante;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: '0 0 4px' }}>Calificaciones · {e.nombres} {e.apellidos}</h2>
          <div style={{ fontSize: 13, color: 'var(--slate)' }}>{info.grado?.nombre} "{info.paralelo?.nombre}" · {periodo.nombre}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="fc" style={{ width: 'auto' }} value={tipoBoleta} onChange={ev => setTipoBoleta(ev.target.value)}>
            {OPCIONES_BOLETA.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" onClick={imprimir}>🖨 Ver / imprimir boleta</button>
        </div>
      </div>

      {esPadre && hijos.length > 1 && (
        <div className="card" style={{ marginBottom: 14 }}><div className="cb">
          <label className="fl">Estudiante</label>
          <select className="fc" value={estudianteId || ''} onChange={ev => setEstudianteId(ev.target.value)}>
            {hijos.map(h => <option key={h.id} value={h.id}>{h.nombre}</option>)}
          </select>
        </div></div>
      )}

      {aviso && <div className="card" style={{ marginBottom: 12, borderColor: 'var(--red)' }}><div className="cb" style={{ fontSize: 13, color: 'var(--red)' }}>{aviso}</div></div>}

      {materias.length === 0
        ? <div className="empty"><span className="ti ti-report" /><p>Tu curso todavía no tiene materias asignadas.</p></div>
        : (
          <div className="card"><div className="cb" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="data">
              <thead><tr>
                <th>Asignatura</th>
                <th style={{ textAlign: 'center' }}>1er Trim.</th><th style={{ textAlign: 'center' }}>2do Trim.</th><th style={{ textAlign: 'center' }}>3er Trim.</th>
                <th style={{ textAlign: 'center' }}>Promedio</th><th style={{ textAlign: 'center' }}>Equiv.</th>
                <th style={{ textAlign: 'center' }}>Supletorio</th><th style={{ textAlign: 'center' }}>Estado</th>
              </tr></thead>
              <tbody>
                {materias.map(m => {
                  const eq = escalaDAAPA(m.final);
                  return (
                    <tr key={m.nombre}>
                      <td>{m.nombre}</td>
                      {m.trims.map((t, i) => <td key={i} style={{ textAlign: 'center', color: t !== null && t < 7 ? 'var(--red)' : undefined }}>{fmt(t)}</td>)}
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{fmt(m.final)}</td>
                      <td style={{ textAlign: 'center' }}>{m.final === null ? '—' : <span className={'badge ' + eq.cls} title={eq.label}>{eq.c}</span>}</td>
                      <td style={{ textAlign: 'center' }}>{fmt(m.supletorio)}</td>
                      <td style={{ textAlign: 'center' }}><span className={'badge ' + ESTADO_BADGE[m.estado]}>{ESTADO_LABEL[m.estado]}</span></td>
                    </tr>
                  );
                })}
                <tr style={{ fontWeight: 700 }}>
                  <td>PROMEDIO GENERAL</td><td colSpan={3} />
                  <td style={{ textAlign: 'center' }}>{fmt(general)}</td>
                  <td style={{ textAlign: 'center' }}>{general === null ? '—' : escalaDAAPA(general).c}</td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
            <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--slate)' }}>
              Solo se muestran notas definitivas. Escala: DA 9–10 · AA 7–8.99 · PA 4.01–6.99 · NA ≤ 4.
            </div>
          </div></div>
        )}
    </div>
  );
}
