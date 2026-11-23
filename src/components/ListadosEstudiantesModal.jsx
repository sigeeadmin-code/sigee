import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { API_URL } from '../lib/data.js';
import { crearClienteBackend } from '../lib/backend.js';
import { descargarLibro } from '../lib/exportLibro.js';
import { supabase } from '../lib/supabase.js';
import { libroExcel, htmlImprimible, textoNoLectivos, TITULOS } from '../lib/listadosReporte.js';

const GESTION = ['inspector_general', 'supervisor_plantel', 'admin_plantel', 'secretario', 'super_admin'];
const TIPOS = [
  { id: 'resumen_docente', label: 'Resumen de asistencia y faltas por materia', desc: 'Por curso, paralelo y materia: estudiantes, asistencias, atrasos, faltas y % de asistencia. Para el docente cuenta solo las materias a su cargo.', roles: ['docente', ...GESTION] },
  { id: 'junta_curso', label: 'Reporte para Junta de Curso', desc: 'Lista del curso con faltas, atrasos, justificadas y % de asistencia de cada estudiante, y espacios para observaciones y firma del representante.', roles: ['docente', ...GESTION] },
  { id: 'resumen_inspector', label: 'Resumen consolidado (Inspector)', desc: 'Totales por curso y paralelo: estudiantes, hombres, mujeres, asistencias y faltas. Vista global del plantel.', roles: GESTION },
  { id: 'asistencia', label: 'Lista de Asistencia del Curso', desc: 'Marcas por día lectivo (✓ presente, F falta, A atraso, J justificado). Ideal para pasar lista y juntas.', roles: ['docente', ...GESTION] },
  { id: 'nomina_oficial', label: 'Nómina Oficial (estilo Ministerio)', desc: 'Listado formal con cédula, sexo y estado de matrícula. Solo el docente tutor la genera.', roles: ['docente', ...GESTION] }
];
const TIPOS_CON_ESTUDIANTES = ['asistencia', 'junta_curso'];

const hoy = () => new Date().toISOString().slice(0, 10);
const inicioMes = () => { const d = new Date(); return new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1)).toISOString().slice(0, 10); };

/**
 * Listados para imprimir o descargar. Si se abre desde Asistencia se le pasan los cursos y paralelos visibles
 * (opcionesCursos: [{id, nombre, paralelos:[{id, nombre, jornada}]}]) para que el docente solo vea los suyos.
 */
export default function ListadosEstudiantesModal({ onClose, paraleloIdInicial = '', gradoIdInicial = '', tituloContexto = '', opcionesCursos = null, tipoInicial = '' }) {
  const { profile, institucion, data } = useSession();
  const rol = profile?.rolDb || profile?.rol || '';

  const tiposDisponibles = useMemo(() => TIPOS.filter(t => t.roles.includes(rol)), [rol]);
  const [tipo, setTipo] = useState(tipoInicial || (rol === 'docente' ? 'resumen_docente' : rol === 'inspector_general' || rol === 'supervisor_plantel' ? 'resumen_inspector' : tiposDisponibles[0]?.id || 'nomina_oficial'));
  const [modoFecha, setModoFecha] = useState('rango');
  const [fechaInicio, setFechaInicio] = useState(inicioMes());
  const [fechaFin, setFechaFin] = useState(hoy());
  const [semana, setSemana] = useState(hoy());
  const [paraleloId, setParaleloId] = useState(paraleloIdInicial || '');
  const [gradoId, setGradoId] = useState(gradoIdInicial || '');
  const [sexo, setSexo] = useState('');
  const [jornada, setJornada] = useState('');
  const [estado, setEstado] = useState('activa');
  const [soloConFaltas, setSoloConFaltas] = useState(false);
  const [pctMax, setPctMax] = useState('');
  const [avanzados, setAvanzados] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null);
  const [filtrosTexto, setFiltrosTexto] = useState([]);

  const cursos = useMemo(() => {
    const lista = opcionesCursos || (data?.grados || []).map(g => ({ id: g.id, nombre: g.nombre, paralelos: (data?.paralelos || []).filter(p => p.grado_id === g.id) }));
    return [...lista].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
  }, [opcionesCursos, data?.grados, data?.paralelos]);
  const paralelos = useMemo(() => {
    const todos = cursos.flatMap(c => (c.paralelos || []).map(p => ({ ...p, gradoId: c.id })));
    const lista = gradoId ? todos.filter(p => p.gradoId === gradoId) : todos;
    return [...lista].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
  }, [cursos, gradoId]);

  useEffect(() => {
    if (paraleloId && gradoId && !paralelos.some(p => p.id === paraleloId)) setParaleloId('');
  }, [gradoId, paraleloId, paralelos]);

  const llamarBackend = useMemo(() => crearClienteBackend({
    apiUrl: API_URL, getSession: () => supabase.auth.getSession(), refreshSession: () => supabase.auth.refreshSession()
  }), []);

  const limpiar = fn => v => { fn(v); setResultado(null); };

  async function generar() {
    setError(''); setResultado(null); setCargando(true);
    try {
      const body = {
        tipo, paralelo_id: paraleloId || undefined, grado_id: gradoId || undefined, sexo: sexo || undefined,
        jornada: jornada || undefined, estado: estado || 'activa'
      };
      if (TIPOS_CON_ESTUDIANTES.includes(tipo)) {
        if (soloConFaltas) body.solo_con_faltas = true;
        if (pctMax !== '') body.pct_max = Number(pctMax);
      }
      if (modoFecha === 'semana') body.semana = semana; else { body.fecha_inicio = fechaInicio; body.fecha_fin = fechaFin; }
      if (rol === 'super_admin' && institucion?.id) body.institucion_id = institucion.id;

      const textos = [];
      const g = cursos.find(c => c.id === gradoId); if (g) textos.push(`Curso: ${g.nombre}`);
      const p = paralelos.find(x => x.id === paraleloId); if (p) textos.push(`Paralelo ${p.nombre}`);
      if (jornada) textos.push(`Jornada ${jornada}`);
      if (sexo) textos.push(sexo === 'F' ? 'Solo mujeres' : 'Solo hombres');
      if (estado && estado !== 'activa') textos.push(`Matrícula ${estado}`);
      if (TIPOS_CON_ESTUDIANTES.includes(tipo) && soloConFaltas) textos.push('Solo con faltas');
      if (TIPOS_CON_ESTUDIANTES.includes(tipo) && pctMax !== '') textos.push(`Asistencia ≤ ${pctMax} %`);
      setFiltrosTexto(textos);

      setResultado(await llamarBackend('POST', '/reportes/listados', body));
    } catch (e) {
      setError(e.message || 'No se pudo generar el listado.');
    }
    setCargando(false);
  }

  const ctx = { tituloContexto, filtrosTexto };
  function exportarExcel() {
    if (!resultado) return;
    const { nombreArchivo, hojas } = libroExcel(resultado, ctx);
    descargarLibro(nombreArchivo, hojas);
  }
  function imprimir() {
    if (!resultado) return;
    const w = window.open('', '_blank');
    if (!w) { setError('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes e inténtalo de nuevo.'); return; }
    w.document.write(htmlImprimible(resultado, ctx));
    w.document.close();
  }

  const notaRol = rol === 'docente'
    ? 'Verás los cursos donde dictas clases o eres tutor. Los números cuentan solo tus materias; la nómina con cédulas es solo para el docente tutor.'
    : rol === 'inspector_general' || rol === 'supervisor_plantel'
      ? 'Como inspector puedes generar el resumen consolidado de todos los cursos o filtrar por curso, paralelo, jornada y fechas.'
      : '';
  const cal = resultado?.meta?.calendario;
  const noLect = textoNoLectivos(cal);
  const tot = resultado?.totales;
  const cantidad = resultado?.meta?.total_estudiantes ?? (resultado?.resumen || resultado?.estudiantes || []).length;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 12px', overflowY: 'auto' }}>
      <div className="modal" style={{ maxWidth: 680, width: '100%', margin: '0 auto', borderRadius: 'var(--r3)', boxShadow: 'var(--sh3)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ background: 'linear-gradient(135deg, #0c1c30 0%, #112540 50%, #0e7490 100%)', color: '#fff', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Reportes e impresión</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{tituloContexto || 'Asistencia y faltas · Junta de curso · Resumen del inspector · Nómina'}</div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} style={{ color: '#fff', borderColor: 'rgba(255,255,255,.25)' }}><span className="ti ti-x" /></button>
        </div>

        <div style={{ padding: '16px 20px', display: 'grid', gap: 14 }}>
          {notaRol && <div style={{ padding: '10px 12px', borderRadius: 'var(--r)', background: 'var(--brandL)', color: 'var(--brandD)', border: '1px solid var(--brandXL)', fontSize: 12.5 }}>{notaRol}</div>}
          {error && <div style={{ padding: '10px 12px', borderRadius: 'var(--r)', background: 'var(--redL)', color: 'var(--redD)', border: '1px solid #fca5a5', fontSize: 13 }}>{error}</div>}

          <div>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Tipo de reporte</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {tiposDisponibles.map(t => (
                <label key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 'var(--r2)', cursor: 'pointer', border: tipo === t.id ? '2px solid var(--brand)' : '1px solid var(--line)', background: tipo === t.id ? 'var(--brandL)' : 'var(--page)' }}>
                  <input type="radio" name="tipoListado" checked={tipo === t.id} onChange={() => { setTipo(t.id); setResultado(null); }} style={{ marginTop: 3 }} />
                  <div><div style={{ fontWeight: 700, fontSize: 13.5 }}>{t.label}</div><div style={{ fontSize: 12, color: 'var(--slate)' }}>{t.desc}</div></div>
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="fl">Curso / Grado</label>
              <select className="fc" value={gradoId} onChange={e => { setGradoId(e.target.value); setParaleloId(''); setResultado(null); }}>
                <option value="">Todos</option>
                {cursos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="fl">Paralelo</label>
              <select className="fc" value={paraleloId} onChange={e => limpiar(setParaleloId)(e.target.value)}>
                <option value="">Todos</option>
                {paralelos.map(p => <option key={p.id} value={p.id}>{p.nombre}{p.jornada ? ` (${p.jornada})` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="fl">Modo de fechas</label>
              <select className="fc" value={modoFecha} onChange={e => limpiar(setModoFecha)(e.target.value)}>
                <option value="rango">Rango de fechas</option>
                <option value="semana">Por semana</option>
              </select>
            </div>
            {modoFecha === 'semana' ? (
              <div><label className="fl">Semana (cualquier día)</label><input className="fc" type="date" value={semana} onChange={e => limpiar(setSemana)(e.target.value)} /></div>
            ) : <div />}
          </div>
          {modoFecha === 'rango' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label className="fl">Desde</label><input className="fc" type="date" value={fechaInicio} onChange={e => limpiar(setFechaInicio)(e.target.value)} /></div>
              <div><label className="fl">Hasta</label><input className="fc" type="date" value={fechaFin} onChange={e => limpiar(setFechaFin)(e.target.value)} /></div>
            </div>
          )}

          <div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAvanzados(v => !v)}>{avanzados ? '▾' : '▸'} Filtros avanzados</button>
            {avanzados && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                <div>
                  <label className="fl">Jornada</label>
                  <select className="fc" value={jornada} onChange={e => limpiar(setJornada)(e.target.value)}>
                    <option value="">Todas</option><option>Matutina</option><option>Vespertina</option><option>Nocturna</option>
                  </select>
                </div>
                <div>
                  <label className="fl">Sexo</label>
                  <select className="fc" value={sexo} onChange={e => limpiar(setSexo)(e.target.value)}>
                    <option value="">Todos</option><option value="M">Masculino</option><option value="F">Femenino</option>
                  </select>
                </div>
                <div>
                  <label className="fl">Estado de matrícula</label>
                  <select className="fc" value={estado} onChange={e => limpiar(setEstado)(e.target.value)}>
                    <option value="activa">Activa</option><option value="retirada">Retirada</option><option value="trasladada">Trasladada</option><option value="promovida">Promovida</option><option value="repite">Repite</option>
                  </select>
                </div>
                <div>
                  <label className="fl">% de asistencia máximo</label>
                  <input className="fc" type="number" min="0" max="100" placeholder="Ej. 80" value={pctMax} disabled={!TIPOS_CON_ESTUDIANTES.includes(tipo)} onChange={e => limpiar(setPctMax)(e.target.value)} />
                </div>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, gridColumn: '1 / -1', opacity: TIPOS_CON_ESTUDIANTES.includes(tipo) ? 1 : 0.5 }}>
                  <input type="checkbox" checked={soloConFaltas} disabled={!TIPOS_CON_ESTUDIANTES.includes(tipo)} onChange={e => limpiar(setSoloConFaltas)(e.target.checked)} />
                  Solo estudiantes con faltas
                </label>
                {!TIPOS_CON_ESTUDIANTES.includes(tipo) && <div style={{ gridColumn: '1 / -1', fontSize: 11.5, color: 'var(--slate)' }}>Los filtros por faltas y % de asistencia aplican a la Lista de Asistencia y al Reporte para Junta de Curso.</div>}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="button" className="btn btn-primary" disabled={cargando} onClick={generar}>{cargando ? 'Generando…' : 'Generar reporte'}</button>
          </div>

          {resultado && (
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, display: 'grid', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{TITULOS[resultado.tipo]}</div>
              <div style={{ fontSize: 13, color: 'var(--slate)' }}>
                <strong>{cantidad}</strong> {resultado.tipo === 'resumen_docente' ? 'estudiantes en los cursos' : 'estudiante(s)'}
                {resultado.meta?.rango && <> · {resultado.meta.rango.desde} → {resultado.meta.rango.hasta}</>}
                {resultado.meta?.tutor && <> · Tutor: {resultado.meta.tutor}</>}
              </div>
              {cal && (
                <div style={{ fontSize: 12.5, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-soft, #f4f6f8)' }}>
                  <strong>Calendario académico:</strong> {cal.dias_lectivos} día(s) lectivo(s) de {cal.dias_del_rango} del rango.
                  {noLect.length > 0 && <div style={{ marginTop: 4 }}>No lectivos: {noLect.join('; ')}</div>}
                  {cal.recuperaciones?.length > 0 && <div style={{ marginTop: 4 }}>Recuperaciones: {cal.recuperaciones.map(r => r.descripcion || r.desde).join('; ')}</div>}
                  {cal.dias_lectivos === 0 && <div style={{ marginTop: 4, color: 'var(--redD)' }}>El rango no tiene días lectivos: no habrá asistencias que contar.</div>}
                </div>
              )}
              {tot && (
                <div style={{ fontSize: 12.5 }}>
                  Totales: asistencias <strong>{tot.presentes}</strong> · atrasos <strong>{tot.atrasos}</strong> · faltas <strong>{tot.faltas}</strong> · justificadas <strong>{tot.justificadas}</strong>
                  {tot.pct_asistencia !== null && tot.pct_asistencia !== undefined && <> · asistencia <strong>{String(tot.pct_asistencia).replace('.', ',')} %</strong></>}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-primary" onClick={exportarExcel}>⬇️ Descargar Excel</button>
                <button type="button" className="btn btn-secondary" onClick={imprimir}>🖨️ Imprimir / PDF</button>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--slate)' }}>
                El Excel y la impresión llevan el encabezado del plantel (nombre, AMIE, régimen), el período, el calendario académico aplicado y los filtros usados.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
