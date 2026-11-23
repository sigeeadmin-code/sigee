import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { API_URL } from '../lib/data.js';
import { crearClienteBackend } from '../lib/backend.js';
import { descargarLibro } from '../lib/exportLibro.js';
import { supabase } from '../lib/supabase.js';

const TIPOS = [
  {
    id: 'asistencia',
    label: 'Lista de Asistencia del Curso',
    desc: 'Marcas diarias (✓ presente, F falta, A atraso, J justificado). Ideal para pasar lista y juntas.',
    roles: ['docente', 'inspector_general', 'supervisor_plantel', 'admin_plantel', 'secretario', 'super_admin'],
  },
  {
    id: 'nomina_oficial',
    label: 'Nómina Oficial (estilo Ministerio)',
    desc: 'Listado formal con cédula, sexo y estado de matrícula. Para archivos oficiales y reportes AMIE.',
    roles: ['docente', 'inspector_general', 'supervisor_plantel', 'admin_plantel', 'secretario', 'super_admin'],
  },
  {
    id: 'junta_curso',
    label: 'Lista para Junta de Curso',
    desc: 'Espacios para observaciones académicas, de comportamiento y firma del representante.',
    roles: ['docente', 'inspector_general', 'supervisor_plantel', 'admin_plantel', 'secretario', 'super_admin'],
  },
  {
    id: 'resumen_inspector',
    label: 'Resumen consolidado (Inspector)',
    desc: 'Totales por curso y paralelo: estudiantes, hombres, mujeres. Vista global del plantel.',
    roles: ['inspector_general', 'supervisor_plantel', 'admin_plantel', 'secretario', 'super_admin'],
  },
];

function fechaHoy() {
  return new Date().toISOString().slice(0, 10);
}

function inicioMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function etiquetaDia(iso) {
  const d = new Date(iso + 'T12:00:00');
  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  return `${dias[d.getDay()]} ${d.getDate()}`;
}

function construirEncabezadoExcel(meta, tituloDocumento, extra = []) {
  const inst = meta?.institucion || {};
  const rango = meta?.rango || {};
  const lineas = [
    inst.nombre || 'UNIDAD EDUCATIVA',
    `Código AMIE: ${inst.amie || '—'}  ·  Régimen: ${inst.regimen || '—'}`,
    tituloDocumento,
    `Periodo: ${rango.desde || '—'} al ${rango.hasta || '—'}  ·  Generado: ${new Date(meta?.generado_en || Date.now()).toLocaleString('es-EC')}`,
  ];
  if (meta?.tutor) lineas.push(`Docente tutor: ${meta.tutor}`);
  if (meta?.total_estudiantes != null) lineas.push(`Total de estudiantes: ${meta.total_estudiantes}`);
  for (const e of extra) if (e) lineas.push(e);
  lineas.push(''); // fila en blanco antes de la tabla
  return lineas;
}

export default function ListadosEstudiantesModal({
  onClose,
  paraleloIdInicial = '',
  gradoIdInicial = '',
  tituloContexto = '',
}) {
  const { profile, institucion, data } = useSession();
  const rol = profile?.rolDb || profile?.rol || '';

  const tiposDisponibles = useMemo(
    () => TIPOS.filter(t => t.roles.includes(rol) || rol === 'super_admin'),
    [rol]
  );

  const [tipo, setTipo] = useState(tiposDisponibles[0]?.id || 'nomina_oficial');
  const [modoFecha, setModoFecha] = useState('rango');
  const [fechaInicio, setFechaInicio] = useState(inicioMes());
  const [fechaFin, setFechaFin] = useState(fechaHoy());
  const [semana, setSemana] = useState(fechaHoy());
  const [paraleloId, setParaleloId] = useState(paraleloIdInicial || '');
  const [gradoId, setGradoId] = useState(gradoIdInicial || '');
  const [sexo, setSexo] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null);

  const cursos = useMemo(() => {
    const gr = data?.grados || [];
    return [...gr].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
  }, [data?.grados]);

  const paralelos = useMemo(() => {
    let list = data?.paralelos || [];
    if (gradoId) list = list.filter(p => p.grado_id === gradoId);
    return [...list].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
  }, [data?.paralelos, gradoId]);

  useEffect(() => {
    if (paraleloId && gradoId) {
      const p = (data?.paralelos || []).find(x => x.id === paraleloId);
      if (p && p.grado_id !== gradoId) setParaleloId('');
    }
  }, [gradoId, paraleloId, data?.paralelos]);

  // Si se abre desde Curso Tutor, preseleccionar el paralelo
  useEffect(() => {
    if (paraleloIdInicial) setParaleloId(paraleloIdInicial);
    if (gradoIdInicial) setGradoId(gradoIdInicial);
  }, [paraleloIdInicial, gradoIdInicial]);

  const llamarBackend = useMemo(() => {
    return crearClienteBackend({
      apiUrl: API_URL,
      getSession: () => supabase.auth.getSession(),
      refreshSession: () => supabase.auth.refreshSession(),
    });
  }, []);

  async function generar() {
    setError('');
    setResultado(null);
    setCargando(true);
    try {
      const body = {
        tipo,
        paralelo_id: paraleloId || undefined,
        grado_id: gradoId || undefined,
        sexo: sexo || undefined,
        estado: 'activa',
      };
      if (modoFecha === 'semana') {
        body.semana = semana;
      } else {
        body.fecha_inicio = fechaInicio;
        body.fecha_fin = fechaFin;
      }
      if (rol === 'super_admin' && institucion?.id) {
        body.institucion_id = institucion.id;
      }

      const dataResp = await llamarBackend('POST', '/reportes/listados', body);
      setResultado(dataResp);
    } catch (e) {
      setError(e.message || 'No se pudo generar el listado.');
    }
    setCargando(false);
  }

  function tituloDocumento() {
    return {
      asistencia: 'REGISTRO DE ASISTENCIA DEL CURSO',
      nomina_oficial: 'NÓMINA OFICIAL DE ESTUDIANTES POR CURSO Y PARALELO',
      junta_curso: 'LISTA PARA JUNTA DE CURSO',
      resumen_inspector: 'RESUMEN CONSOLIDADO DE ASISTENCIA POR CURSO Y PARALELO',
    }[resultado?.tipo] || 'LISTADO DE ESTUDIANTES';
  }

  function exportarExcel() {
    if (!resultado) return;
    const meta = resultado.meta || {};
    const rango = meta.rango || {};
    const nombreBase = {
      asistencia: 'Lista_Asistencia',
      nomina_oficial: 'Nomina_Oficial',
      junta_curso: 'Lista_Junta_Curso',
      resumen_inspector: 'Resumen_Inspector',
    }[resultado.tipo] || 'Listado';

    const encabezado = construirEncabezadoExcel(meta, tituloDocumento(), [
      tituloContexto || null,
    ]);

    if (resultado.tipo === 'asistencia') {
      const dias = meta.dias || [];
      const cols = ['N°', 'Cédula', 'Apellidos y Nombres', ...dias.map(etiquetaDia), 'Faltas', 'Atrasos', 'Observaciones'];
      const filas = (resultado.estudiantes || []).map(e => {
        const row = {
          'N°': e.n,
          'Cédula': e.cedula,
          'Apellidos y Nombres': e.nombre_completo,
          'Faltas': e.faltas,
          'Atrasos': e.atrasos,
          'Observaciones': e.observaciones || '',
        };
        dias.forEach(d => { row[etiquetaDia(d)] = (e.marcas || {})[d] || ''; });
        return row;
      });
      descargarLibro(`${nombreBase}_${rango.desde || ''}_${rango.hasta || ''}.xlsx`, [{
        nombre: 'Asistencia',
        filas,
        cols,
        encabezado,
      }]);
      return;
    }

    if (resultado.tipo === 'resumen_inspector') {
      const cols = ['Curso', 'Paralelo', 'Jornada', 'Total Est.', 'Hombres', 'Mujeres'];
      const filas = (resultado.resumen || []).map(r => ({
        'Curso': r.curso,
        'Paralelo': r.paralelo,
        'Jornada': r.jornada || '',
        'Total Est.': r.total_estudiantes,
        'Hombres': r.hombres,
        'Mujeres': r.mujeres,
      }));
      descargarLibro(`${nombreBase}_${rango.desde || ''}.xlsx`, [{ nombre: 'Resumen', filas, cols, encabezado }]);
      return;
    }

    if (resultado.tipo === 'junta_curso') {
      const cols = ['N°', 'Apellidos y Nombres', 'Sexo', 'Observaciones Académicas', 'Observaciones de Comportamiento', 'Firma Representante'];
      const filas = (resultado.estudiantes || []).map(e => ({
        'N°': e.n,
        'Apellidos y Nombres': e.nombre_completo,
        'Sexo': e.sexo,
        'Observaciones Académicas': '',
        'Observaciones de Comportamiento': '',
        'Firma Representante': '',
      }));
      descargarLibro(`${nombreBase}_${rango.desde || ''}.xlsx`, [{ nombre: 'Junta de Curso', filas, cols, encabezado }]);
      return;
    }

    // nómina oficial
    const cols = ['N°', 'Cédula', 'Apellidos y Nombres Completos', 'Sexo', 'Estado de Matrícula', 'Curso', 'Paralelo'];
    const filas = (resultado.estudiantes || []).map(e => ({
      'N°': e.n,
      'Cédula': e.cedula,
      'Apellidos y Nombres Completos': e.nombre_completo,
      'Sexo': e.sexo,
      'Estado de Matrícula': e.estado_matricula,
      'Curso': e.curso,
      'Paralelo': e.paralelo,
    }));
    descargarLibro(`${nombreBase}_${rango.desde || ''}.xlsx`, [{ nombre: 'Nómina Oficial', filas, cols, encabezado }]);
  }

  function imprimirPDF() {
    if (!resultado) return;
    const meta = resultado.meta || {};
    const inst = meta.institucion || {};
    const rango = meta.rango || {};
    const titulo = tituloDocumento();

    let tablaHtml = '';
    if (resultado.tipo === 'asistencia') {
      const dias = meta.dias || [];
      const thDias = dias.map(d => `<th style="padding:4px 6px;border:1px solid #ccc;font-size:10px">${etiquetaDia(d)}</th>`).join('');
      const filas = (resultado.estudiantes || []).map(e => {
        const tds = dias.map(d => `<td style="text-align:center;border:1px solid #ccc;padding:3px">${(e.marcas || {})[d] || ''}</td>`).join('');
        return `<tr>
          <td style="border:1px solid #ccc;padding:3px 6px;text-align:center">${e.n}</td>
          <td style="border:1px solid #ccc;padding:3px 6px">${e.cedula}</td>
          <td style="border:1px solid #ccc;padding:3px 6px">${e.nombre_completo}</td>
          ${tds}
          <td style="border:1px solid #ccc;padding:3px 6px;text-align:center">${e.faltas}</td>
          <td style="border:1px solid #ccc;padding:3px 6px;text-align:center">${e.atrasos}</td>
        </tr>`;
      }).join('');
      tablaHtml = `<table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead><tr style="background:#1F4E79;color:#fff">
          <th style="padding:6px;border:1px solid #1F4E79">N°</th>
          <th style="padding:6px;border:1px solid #1F4E79">Cédula</th>
          <th style="padding:6px;border:1px solid #1F4E79">Apellidos y Nombres</th>
          ${thDias}
          <th style="padding:6px;border:1px solid #1F4E79">Faltas</th>
          <th style="padding:6px;border:1px solid #1F4E79">Atrasos</th>
        </tr></thead><tbody>${filas}</tbody></table>`;
    } else if (resultado.tipo === 'resumen_inspector') {
      const filas = (resultado.resumen || []).map(r => `
        <tr>
          <td style="border:1px solid #ccc;padding:5px 8px">${r.curso}</td>
          <td style="border:1px solid #ccc;padding:5px 8px;text-align:center">${r.paralelo}</td>
          <td style="border:1px solid #ccc;padding:5px 8px;text-align:center">${r.jornada || ''}</td>
          <td style="border:1px solid #ccc;padding:5px 8px;text-align:center">${r.total_estudiantes}</td>
          <td style="border:1px solid #ccc;padding:5px 8px;text-align:center">${r.hombres}</td>
          <td style="border:1px solid #ccc;padding:5px 8px;text-align:center">${r.mujeres}</td>
        </tr>`).join('');
      tablaHtml = `<table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:#1F4E79;color:#fff">
          <th style="padding:8px;border:1px solid #1F4E79">Curso</th>
          <th style="padding:8px;border:1px solid #1F4E79">Paralelo</th>
          <th style="padding:8px;border:1px solid #1F4E79">Jornada</th>
          <th style="padding:8px;border:1px solid #1F4E79">Total</th>
          <th style="padding:8px;border:1px solid #1F4E79">Hombres</th>
          <th style="padding:8px;border:1px solid #1F4E79">Mujeres</th>
        </tr></thead><tbody>${filas}</tbody></table>`;
    } else {
      const esJunta = resultado.tipo === 'junta_curso';
      const filas = (resultado.estudiantes || []).map(e => esJunta
        ? `<tr>
            <td style="border:1px solid #ccc;padding:6px 8px;text-align:center">${e.n}</td>
            <td style="border:1px solid #ccc;padding:6px 8px">${e.nombre_completo}</td>
            <td style="border:1px solid #ccc;padding:6px 8px;text-align:center">${e.sexo}</td>
            <td style="border:1px solid #ccc;padding:6px 8px;height:28px"></td>
            <td style="border:1px solid #ccc;padding:6px 8px;height:28px"></td>
            <td style="border:1px solid #ccc;padding:6px 8px;height:28px"></td>
          </tr>`
        : `<tr>
            <td style="border:1px solid #ccc;padding:5px 8px;text-align:center">${e.n}</td>
            <td style="border:1px solid #ccc;padding:5px 8px">${e.cedula}</td>
            <td style="border:1px solid #ccc;padding:5px 8px">${e.nombre_completo}</td>
            <td style="border:1px solid #ccc;padding:5px 8px;text-align:center">${e.sexo}</td>
            <td style="border:1px solid #ccc;padding:5px 8px;text-align:center">${e.estado_matricula}</td>
          </tr>`
      ).join('');
      tablaHtml = esJunta
        ? `<table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead><tr style="background:#1F4E79;color:#fff">
              <th style="padding:8px;border:1px solid #1F4E79">N°</th>
              <th style="padding:8px;border:1px solid #1F4E79">Apellidos y Nombres</th>
              <th style="padding:8px;border:1px solid #1F4E79">Sexo</th>
              <th style="padding:8px;border:1px solid #1F4E79">Obs. Académicas</th>
              <th style="padding:8px;border:1px solid #1F4E79">Obs. Comportamiento</th>
              <th style="padding:8px;border:1px solid #1F4E79">Firma Representante</th>
            </tr></thead><tbody>${filas}</tbody></table>`
        : `<table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead><tr style="background:#1F4E79;color:#fff">
              <th style="padding:8px;border:1px solid #1F4E79">N°</th>
              <th style="padding:8px;border:1px solid #1F4E79">Cédula</th>
              <th style="padding:8px;border:1px solid #1F4E79">Apellidos y Nombres Completos</th>
              <th style="padding:8px;border:1px solid #1F4E79">Sexo</th>
              <th style="padding:8px;border:1px solid #1F4E79">Estado</th>
            </tr></thead><tbody>${filas}</tbody></table>`;
    }

    const cursoTxt = (resultado.estudiantes?.[0]?.curso || '') + (resultado.estudiantes?.[0]?.paralelo ? ' · Paralelo ' + resultado.estudiantes[0].paralelo : '');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${titulo}</title>
      <style>
        @page { margin: 12mm; }
        body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; padding: 16px; }
        h1 { font-size: 14px; color: #1F4E79; margin: 0 0 4px; text-align: center; }
        .sub { font-size: 11px; text-align: center; color: #444; margin-bottom: 4px; }
        .meta { font-size: 11px; text-align: center; margin-bottom: 12px; }
        .pie { margin-top: 18px; font-size: 11px; display: flex; justify-content: space-between; gap: 24px; }
        .firma { margin-top: 28px; text-align: center; font-size: 11px; }
      </style></head><body>
      <h1>${inst.nombre || 'UNIDAD EDUCATIVA'}</h1>
      <div class="sub">Código AMIE: ${inst.amie || '—'} · Régimen: ${inst.regimen || '—'}</div>
      <h1 style="margin-top:10px">${titulo}</h1>
      <div class="meta">
        ${cursoTxt ? 'Curso: <strong>' + cursoTxt + '</strong> · ' : ''}
        ${meta.tutor ? 'Docente Tutor: <strong>' + meta.tutor + '</strong> · ' : ''}
        Periodo: ${rango.desde || ''} al ${rango.hasta || ''}<br>
        Total estudiantes: <strong>${meta.total_estudiantes ?? (resultado.estudiantes || resultado.resumen || []).length}</strong>
        · Generado: ${new Date(meta.generado_en || Date.now()).toLocaleString('es-EC')}
      </div>
      ${tablaHtml}
      <div class="pie">
        <div class="firma">_____________________________<br>Firma Docente Tutor</div>
        <div class="firma">_____________________________<br>Firma Inspector / Autoridad</div>
      </div>
      <script>window.onload=function(){window.print();}</script>
      </body></html>`;

    const w = window.open('', '_blank');
    if (!w) {
      setError('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes e inténtalo de nuevo.');
      return;
    }
    w.document.write(html);
    w.document.close();
  }

  const notaRol = rol === 'docente'
    ? 'Como docente/tutor solo verás los paralelos de los que eres tutor. Usa la Lista de Asistencia o la Nómina para presentar el resumen de faltas de tu curso.'
    : rol === 'inspector_general' || rol === 'supervisor_plantel'
      ? 'Como inspector puedes generar el resumen consolidado de todos los cursos o filtrar por curso/paralelo.'
      : '';

  return (
    <div className="modal-overlay" onClick={onClose} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 12px', overflowY: 'auto' }}>
      <div
        className="modal"
        style={{ maxWidth: 640, width: '100%', margin: '0 auto', borderRadius: 'var(--r3)', boxShadow: 'var(--sh3)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          background: 'linear-gradient(135deg, #0c1c30 0%, #112540 50%, #0e7490 100%)',
          color: '#fff', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Imprimir / Exportar listados</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
              {tituloContexto || 'Asistencia · Nómina oficial · Junta de curso · Resumen inspector'}
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} style={{ color: '#fff', borderColor: 'rgba(255,255,255,.25)' }}>
            <span className="ti ti-x" />
          </button>
        </div>

        <div style={{ padding: '16px 20px', display: 'grid', gap: 14 }}>
          {notaRol && (
            <div style={{ padding: '10px 12px', borderRadius: 'var(--r)', background: 'var(--brandL)', color: 'var(--brandD)', border: '1px solid var(--brandXL)', fontSize: 12.5 }}>
              {notaRol}
            </div>
          )}

          {error && (
            <div style={{ padding: '10px 12px', borderRadius: 'var(--r)', background: 'var(--redL)', color: 'var(--redD)', border: '1px solid #fca5a5', fontSize: 13 }}>
              {error}
            </div>
          )}

          <div>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Tipo de listado</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {tiposDisponibles.map(t => (
                <label key={t.id} style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px',
                  borderRadius: 'var(--r2)', cursor: 'pointer',
                  border: tipo === t.id ? '2px solid var(--brand)' : '1px solid var(--line)',
                  background: tipo === t.id ? 'var(--brandL)' : 'var(--page)',
                }}>
                  <input type="radio" name="tipoListado" checked={tipo === t.id} onChange={() => { setTipo(t.id); setResultado(null); }} style={{ marginTop: 3 }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{t.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--slate)' }}>{t.desc}</div>
                  </div>
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
              <select className="fc" value={paraleloId} onChange={e => { setParaleloId(e.target.value); setResultado(null); }}>
                <option value="">Todos</option>
                {paralelos.map(p => <option key={p.id} value={p.id}>{p.nombre}{p.jornada ? ` (${p.jornada})` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="fl">Sexo</label>
              <select className="fc" value={sexo} onChange={e => { setSexo(e.target.value); setResultado(null); }}>
                <option value="">Todos</option>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
              </select>
            </div>
            <div>
              <label className="fl">Modo de fechas</label>
              <select className="fc" value={modoFecha} onChange={e => { setModoFecha(e.target.value); setResultado(null); }}>
                <option value="rango">Rango de fechas</option>
                <option value="semana">Por semana</option>
              </select>
            </div>
          </div>

          {modoFecha === 'rango' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label className="fl">Desde</label>
                <input className="fc" type="date" value={fechaInicio} onChange={e => { setFechaInicio(e.target.value); setResultado(null); }} />
              </div>
              <div>
                <label className="fl">Hasta</label>
                <input className="fc" type="date" value={fechaFin} onChange={e => { setFechaFin(e.target.value); setResultado(null); }} />
              </div>
            </div>
          ) : (
            <div>
              <label className="fl">Semana (cualquier día de la semana)</label>
              <input className="fc" type="date" value={semana} onChange={e => { setSemana(e.target.value); setResultado(null); }} />
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="button" className="btn btn-primary" disabled={cargando} onClick={generar}>
              {cargando ? 'Generando…' : 'Generar listado'}
            </button>
          </div>

          {resultado && (
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, display: 'grid', gap: 10 }}>
              <div style={{ fontSize: 13, color: 'var(--slate)' }}>
                Listo · <strong>{resultado.meta?.total_estudiantes ?? (resultado.estudiantes || resultado.resumen || []).length}</strong> registro(s)
                {resultado.meta?.rango && <> · {resultado.meta.rango.desde} → {resultado.meta.rango.hasta}</>}
                {resultado.meta?.tutor && <> · Tutor: {resultado.meta.tutor}</>}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-primary" onClick={exportarExcel}>
                  ⬇️ Descargar Excel
                </button>
                <button type="button" className="btn btn-secondary" onClick={imprimirPDF}>
                  🖨️ Imprimir / PDF
                </button>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--slate)' }}>
                El Excel incluye el encabezado de la institución (nombre, AMIE, periodo y tutor), igual que la impresión.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
