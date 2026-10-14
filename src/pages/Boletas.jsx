import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { supabase } from '../lib/supabase.js';
import {
  fetchGradosConParalelos, fetchEstudiantesParalelo, fetchMateriasParalelo, fetchNotasParalelo,
  fetchCedulasEstudiantes, fetchNombreDocente, fetchCatalogoNivel
} from '../lib/data.js';
import { usaEvaluacionNumerica } from '../lib/calificaciones.js';
import { documentoBoletas, materiasParaBoleta, promedioGeneralBoleta } from '../lib/boletaHTML.js';
import { nivelCanonico, NIVEL_LABEL, ordenarPorCatalogo } from '../lib/niveles.js';

const ROLES_VEN = ['super_admin', 'admin_plantel', 'secretario', 'supervisor_plantel', 'supervisor_general', 'inspector_general', 'docente'];
const INFORMES = [['T1', '1er Trimestre'], ['T2', '2do Trimestre'], ['T3', '3er Trimestre'], ['anual', 'Informe final anual']];
const f2 = n => (n === null || n === undefined ? '—' : Number(n).toFixed(2));

// Boletas por curso, individuales y trimestrales (1er, 2do, 3er trimestre e informe final anual).
// Las ve el docente TUTOR de cada curso (con TODAS las materias del curso, no solo las suyas) y la administración / supervisión del plantel.
export default function Boletas() {
  const { profile, institucion, data } = useSession();
  const rolDb = profile.rolDb;
  const esDocente = rolDb === 'docente';
  const periodoActivo = data?.periodoActivo;
  const [grados, setGrados] = useState([]);
  const [misDocenteId, setMisDocenteId] = useState(null);
  const [catalogo, setCatalogo] = useState(null);
  const [gradoId, setGradoId] = useState('');
  const [paraleloId, setParaleloId] = useState('');
  const [informe, setInforme] = useState('T1');
  const [cargando, setCargando] = useState(true);
  const [cargandoCurso, setCargandoCurso] = useState(false);
  const [curso, setCurso] = useState({ alumnos: [], cargas: [], notas: [], mejoras: [] });
  const [aviso, setAviso] = useState('');

  // Cursos disponibles: administración y supervisión ven todos; el docente solo aquellos de los que es TUTOR.
  useEffect(() => {
    if (!institucion?.id || !ROLES_VEN.includes(rolDb)) { setCargando(false); return undefined; }
    let vivo = true;
    (async () => {
      setCargando(true);
      try {
        const [gr, cat] = await Promise.all([fetchGradosConParalelos(institucion.id), fetchCatalogoNivel(institucion.id)]);
        let docId = null;
        if (esDocente) {
          const { data: d } = await supabase.from('docentes').select('id').eq('profile_id', profile.id).maybeSingle();
          docId = d?.id || null;
        }
        if (!vivo) return;
        const visibles = gr.filter(g => usaEvaluacionNumerica(g))
          .map(g => ({ ...g, paralelos: esDocente ? g.paralelos.filter(p => docId && p.tutor_docente_id === docId) : g.paralelos }))
          .filter(g => g.paralelos.length);
        setMisDocenteId(docId); setCatalogo(cat); setGrados(visibles);
        if (visibles[0]) { setGradoId(visibles[0].id); setParaleloId(visibles[0].paralelos[0].id); }
      } catch (e) { if (vivo) setAviso(e.message || 'No se pudieron cargar los cursos.'); }
      if (vivo) setCargando(false);
    })();
    return () => { vivo = false; };
  }, [institucion?.id, rolDb, esDocente, profile.id]);

  const gradoSel = grados.find(g => g.id === gradoId);
  const paraleloSel = gradoSel?.paralelos.find(p => p.id === paraleloId);
  const nivelCanon = nivelCanonico(gradoSel);

  // Estudiantes, TODAS las materias del curso y sus notas
  useEffect(() => {
    if (!paraleloId || !periodoActivo) { setCurso({ alumnos: [], cargas: [], notas: [], mejoras: [] }); return undefined; }
    let vivo = true;
    setCargandoCurso(true); setAviso('');
    (async () => {
      try {
        const [alumnos, cargasTodas] = await Promise.all([fetchEstudiantesParalelo(paraleloId, periodoActivo.id), fetchMateriasParalelo(paraleloId, periodoActivo.id)]);
        const cargas = cargasTodas.filter(c => c.docenteId);          // materias con docente asignado
        const { notas, mejoras } = await fetchNotasParalelo(cargas.map(c => c.id));
        if (vivo) setCurso({ alumnos, cargas, notas, mejoras });
      } catch (e) { if (vivo) setAviso('No se pudo cargar el curso: ' + (e.message || e)); }
      if (vivo) setCargandoCurso(false);
    })();
    return () => { vivo = false; };
  }, [paraleloId, periodoActivo?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const cargasOrdenadas = useMemo(
    () => (catalogo && nivelCanon && catalogo[nivelCanon] ? ordenarPorCatalogo(curso.cargas, catalogo[nivelCanon].nombres) : curso.cargas),
    [curso.cargas, catalogo, nivelCanon]
  );
  const filas = useMemo(() => curso.alumnos.map(a => {
    const materias = materiasParaBoleta(cargasOrdenadas, curso.notas.filter(n => n.estudiante_id === a.id), curso.mejoras.filter(m => m.estudiante_id === a.id));
    return { a, materias, gen: Object.fromEntries(['T1', 'T2', 'T3', 'anual'].map(t => [t, promedioGeneralBoleta(materias, t)])) };
  }), [curso.alumnos, cargasOrdenadas, curso.notas, curso.mejoras]);

  const imprimir = async soloId => {
    const w = window.open('', '_blank');
    if (!w) { setAviso('El navegador bloqueó la ventana. Permite ventanas emergentes para este sitio e inténtalo de nuevo.'); return; }
    w.document.write('<p style="font-family:sans-serif;padding:20px">Generando boletas…</p>');
    try {
      const lista = filas.filter(f => !soloId || f.a.id === soloId);
      const [cedulas, tutorNombre] = await Promise.all([fetchCedulasEstudiantes(lista.map(f => f.a.id)), fetchNombreDocente(paraleloSel?.tutor_docente_id)]);
      const fecha = new Date().toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: 'numeric' });
      const datos = lista.map(f => ({
        institucion, periodoNombre: periodoActivo.nombre, cursoNombre: gradoSel?.nombre || '', paraleloNombre: paraleloSel?.nombre || '',
        nivel: nivelCanon, nivelNombre: nivelCanon ? NIVEL_LABEL[nivelCanon] : '', tutorNombre, tipo: informe, fechaEmision: fecha,
        estudiante: { nombre: f.a.nombre, cedula: cedulas[f.a.id] || '' },
        materias: f.materias
      }));
      w.document.open();
      w.document.write(documentoBoletas(datos, `Boletas ${gradoSel?.nombre || ''} ${paraleloSel?.nombre || ''}`));
      w.document.close();
      setTimeout(() => { try { w.focus(); w.print(); } catch (e) { /* el usuario puede imprimir manualmente */ } }, 500);
    } catch (e) {
      w.close(); setAviso('No se pudieron generar las boletas: ' + (e.message || e));
    }
  };

  if (!ROLES_VEN.includes(rolDb)) return <div className="empty"><span className="ti ti-lock" /><p>Las boletas las ven el docente tutor de cada curso y la administración del plantel.</p></div>;
  if (!institucion?.id) return <div className="empty"><span className="ti ti-building" /><p>Entra a un plantel para ver sus boletas.</p></div>;
  if (cargando) return <p style={{ fontSize: 13, color: 'var(--slate)' }}>Cargando…</p>;
  if (!periodoActivo) return <div className="card"><div className="cb"><p className="muted">No hay un período lectivo activo.</p></div></div>;
  if (!grados.length) {
    return <div className="empty"><span className="ti ti-report" /><p>{esDocente ? 'No eres docente tutor de ningún curso de 8vo EGB a 3ro Bachillerato en este período.' : 'No hay cursos de 8vo EGB a 3ro Bachillerato en este plantel.'}</p></div>;
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 4px' }}>Boletas</h2>
      <div style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 14 }}>
        {institucion.nombre} · {periodoActivo.nombre} · Por curso, individuales y trimestrales
      </div>
      {aviso && <div className="lerr" style={{ display: 'flex', marginBottom: 12 }}>{aviso}</div>}

      <div className="card" style={{ marginBottom: 14 }}><div className="cb">
        <div className="form-grid">
          <div><label className="fl">Curso</label>
            <select className="fc" value={gradoId} onChange={e => { setGradoId(e.target.value); setParaleloId(grados.find(g => g.id === e.target.value)?.paralelos[0]?.id || ''); }}>
              {grados.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
            </select></div>
          <div><label className="fl">Paralelo</label>
            <select className="fc" value={paraleloId} onChange={e => setParaleloId(e.target.value)}>
              {(gradoSel?.paralelos || []).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select></div>
          <div><label className="fl">Informe</label>
            <select className="fc" value={informe} onChange={e => setInforme(e.target.value)}>
              {INFORMES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select></div>
        </div>
      </div></div>

      <div className="card">
        <div className="cb" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <strong style={{ fontSize: 14 }}>{gradoSel?.nombre} “{paraleloSel?.nombre}”</strong>
          <span className="muted" style={{ fontSize: 12.5 }}>{filas.length} estudiante{filas.length === 1 ? '' : 's'} · {cargasOrdenadas.length} materia{cargasOrdenadas.length === 1 ? '' : 's'}</span>
          <span style={{ flex: 1 }} />
          <button className="btn btn-primary btn-sm" disabled={!filas.length || cargandoCurso} onClick={() => imprimir(null)}
            title="Imprime una boleta por estudiante (una por página) del informe elegido">
            🖨 Imprimir boletas del curso ({INFORMES.find(i => i[0] === informe)[1]})
          </button>
        </div>
        <div className="cb" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="data" style={{ width: '100%' }}>
            <thead><tr>
              <th>#</th><th>Estudiante</th>
              <th style={{ textAlign: 'center' }}>1er Trim.</th><th style={{ textAlign: 'center' }}>2do Trim.</th><th style={{ textAlign: 'center' }}>3er Trim.</th>
              <th style={{ textAlign: 'center' }}>Promedio anual</th><th style={{ textAlign: 'center' }}>Boleta</th>
            </tr></thead>
            <tbody>
              {cargandoCurso && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 20 }}>Cargando notas…</td></tr>}
              {!cargandoCurso && filas.length === 0 && <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 20 }}>No hay estudiantes matriculados en este paralelo.</td></tr>}
              {!cargandoCurso && filas.map((f, i) => (
                <tr key={f.a.id}>
                  <td className="muted">{i + 1}</td><td><strong>{f.a.nombre}</strong></td>
                  {['T1', 'T2', 'T3', 'anual'].map(t => <td key={t} style={{ textAlign: 'center', fontWeight: t === 'anual' ? 700 : 400 }}>{f2(f.gen[t])}</td>)}
                  <td style={{ textAlign: 'center' }}><button className="btn btn-secondary btn-sm" onClick={() => imprimir(f.a.id)} title="Ver / imprimir la boleta de este estudiante">📄 Ver / imprimir</button></td>
                </tr>))}
            </tbody>
          </table>
        </div>
        <div className="cb muted" style={{ fontSize: 12 }}>
          Solo constan notas definitivas. Los promedios son generales del estudiante (todas las materias del curso). Escala: DA 9–10 · AA 7–8.99 · PA 4.01–6.99 · NA ≤ 4.
        </div>
      </div>
    </div>
  );
}
