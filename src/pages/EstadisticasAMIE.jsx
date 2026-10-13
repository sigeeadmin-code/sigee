import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { fetchAmiePlanteles } from '../lib/data.js';
import { descargarLibro } from '../lib/exportLibro.js';
import { contar, totales, agruparCantones, filtrar, nivelCorto, miles } from '../lib/estadisticasAmie.js';

const ROLES_GLOBALES = ['super_admin', 'supervisor_general'];
const PALETA = ['#2563eb', '#16a34a', '#7c3aed', '#d97706', '#0d9488', '#dc2626', '#0891b2', '#be185d'];
const COLOR_SOST = { Fiscal: '#2563eb', Particular: '#d97706', Fiscomisional: '#7c3aed', Municipal: '#16a34a', 'Sin dato': '#94a3b8' };

const Tarjeta = ({ valor, etiqueta, sub, color }) => (
  <div className="card" style={{ margin: 0, padding: '12px 16px', minWidth: 150, flex: '1 1 150px', borderTop: `3px solid ${color}` }}>
    <div style={{ fontSize: 26, fontWeight: 800, color }}>{valor}</div>
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate)' }}>{etiqueta}</div>
    {sub && <div style={{ fontSize: 11.5, color: 'var(--slate)' }}>{sub}</div>}
  </div>
);

function Barras({ datos, color, max = 8, corto }) {
  const filas = datos.slice(0, max);
  const tope = Math.max(...filas.map(d => d.n), 1);
  return (
    <div>
      {filas.map((d, i) => (
        <div key={d.clave} style={{ marginBottom: 11 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600 }} title={d.clave}>{corto ? nivelCorto(d.clave) : d.clave}</span>
            <span style={{ fontSize: 12, color: 'var(--slate)', whiteSpace: 'nowrap' }}>{d.n} ({String(d.pct).replace('.', ',')}%)</span>
          </div>
          <div style={{ height: 8, borderRadius: 6, background: '#e2e8f0', overflow: 'hidden' }}>
            <div style={{ width: `${(d.n / tope) * 100}%`, height: '100%', background: (typeof color === 'function' ? color(d.clave, i) : color) || PALETA[i % PALETA.length] }} />
          </div>
        </div>
      ))}
      {datos.length > max && <div style={{ fontSize: 11.5, color: 'var(--slate)' }}>… y {datos.length - max} más</div>}
      {!datos.length && <div style={{ color: 'var(--slate)', fontSize: 13 }}>Sin datos.</div>}
    </div>
  );
}

function Jornadas({ datos }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      {datos.map((d, i) => (
        <div key={d.clave} style={{ background: PALETA[i % PALETA.length] + '18', border: `2px solid ${PALETA[i % PALETA.length]}44`, borderRadius: 10, padding: '12px 14px', textAlign: 'center', flex: '1 1 110px' }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: PALETA[i % PALETA.length] }}>{d.n}</div>
          <div style={{ fontSize: 11, color: 'var(--slate)', marginTop: 3 }}>{d.clave}</div>
        </div>
      ))}
      {!datos.length && <div style={{ color: 'var(--slate)', fontSize: 13 }}>Sin datos.</div>}
    </div>
  );
}

const Insignia = ({ sost }) => (
  <span style={{ background: (COLOR_SOST[sost] || '#94a3b8') + '22', color: COLOR_SOST[sost] || '#475569', borderRadius: 999, padding: '2px 10px', fontWeight: 700, fontSize: 11.5, whiteSpace: 'nowrap' }}>{sost}</span>
);

function Fila({ k, v }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
      <div style={{ width: 150, color: 'var(--slate)', flexShrink: 0 }}>{k}</div>
      <div style={{ fontWeight: 600, wordBreak: 'break-word' }}>{v || '—'}</div>
    </div>
  );
}

export default function EstadisticasAMIE() {
  const { profile } = useSession();
  const permitido = ROLES_GLOBALES.includes(profile?.rolDb);

  const [todos, setTodos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [sost, setSost] = useState('');
  const [canton, setCanton] = useState('');
  const [nivel, setNivel] = useState('');
  const [jornada, setJornada] = useState('');
  const [parroquia, setParroquia] = useState('');
  const [texto, setTexto] = useState('');
  const [fichaId, setFichaId] = useState('');

  useEffect(() => {
    if (!permitido) return undefined;
    let vivo = true;
    (async () => {
      try { const f = await fetchAmiePlanteles(); if (vivo) setTodos(f); }
      catch (e) { if (vivo) setError(e.message || 'No se pudo cargar el catálogo AMIE.'); }
      if (vivo) setCargando(false);
    })();
    return () => { vivo = false; };
  }, [permitido]);

  const base = useMemo(() => filtrar(todos, { sostenimiento: sost }), [todos, sost]);          // filtro de sostenimiento (zona)
  const delCanton = useMemo(() => (canton ? filtrar(base, { canton }) : base), [base, canton]);
  const lista = useMemo(() => filtrar(delCanton, { nivel, jornada, parroquia, texto }), [delCanton, nivel, jornada, parroquia, texto]);
  const t = useMemo(() => totales(delCanton), [delCanton]);
  const cantones = useMemo(() => agruparCantones(base), [base]);
  const sostenimientos = useMemo(() => contar(todos, 'sostenimiento').map(x => x.clave), [todos]);
  const ficha = useMemo(() => todos.find(p => p.id === fichaId) || null, [todos, fichaId]);
  const hayRef = t.estudiantesRef > 0 || t.docentesRef > 0;

  function elegirCanton(c) { setCanton(c); setNivel(''); setJornada(''); setParroquia(''); setTexto(''); setFichaId(''); }

  function exportar() {
    if (!canton) {
      descargarLibro('estadisticas-amie-zona7-cantones.xlsx', [
        { nombre: 'Cantones', filas: cantones.map(c => ({ Cantón: c.canton, Planteles: c.planteles, Parroquias: c.parroquias, ...Object.fromEntries(sostenimientos.map(s => [s, c.sostenimientos[s] || 0])), 'Estudiantes (SIGEE)': c.estudiantesSistema, 'Docentes (SIGEE)': c.docentesSistema, 'Estudiantes (AMIE)': c.estudiantesRef || '', 'Docentes (AMIE)': c.docentesRef || '' })) },
        { nombre: 'Planteles', filas: base.map(p => ({ AMIE: p.amie, Plantel: p.nombre, Cantón: p.canton, Parroquia: p.parroquia, Sostenimiento: p.sostenimiento, Nivel: p.nivel_educativo, Jornada: p.jornada })) }
      ]);
      return;
    }
    descargarLibro(`estadisticas-amie-${canton.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.xlsx`, [
      { nombre: 'Planteles', filas: lista.map(p => ({ AMIE: p.amie, Plantel: p.nombre, Parroquia: p.parroquia, Sostenimiento: p.sostenimiento, Nivel: p.nivel_educativo, Jornada: p.jornada, 'Estudiantes (SIGEE)': p.estudiantes_sistema, 'Docentes (SIGEE)': p.docentes_sistema, 'Administrativos (SIGEE)': p.administrativos_sistema })) }
    ]);
  }

  if (!permitido) return <div className="card cb">Esta pantalla es del Super Admin y del supervisor general de la zona.</div>;

  const titulo = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
      <div>
        <h2 style={{ margin: 0 }}><span className="ti ti-chart-pie" /> Estadísticas AMIE{canton ? ` · ${canton}` : ''}</h2>
        <p style={{ color: 'var(--slate)', margin: '4px 0 0', fontSize: 13 }}>
          {canton ? 'Cantón de la Zona 7 · El Oro' : 'Zona 7 · El Oro — catálogo de establecimientos educativos'}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {canton && <button className="btn btn-secondary" onClick={() => elegirCanton('')}>← Todos los cantones</button>}
        <button className="btn btn-secondary" onClick={exportar} disabled={!todos.length}>⬇️ Excel</button>
      </div>
    </div>
  );

  const filtroSost = (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="cb" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="fl" style={{ margin: 0 }}>Sostenimiento</span>
        {['', ...sostenimientos].map(s => <button key={s || 'todos'} className={'btn btn-sm ' + (sost === s ? 'btn-primary' : 'btn-secondary')} onClick={() => setSost(s)}>{s || 'Todos'}</button>)}
      </div>
    </div>
  );

  if (cargando) return <div>{titulo}<div className="card cb">Cargando el catálogo de planteles…</div></div>;
  if (error) return <div>{titulo}<div className="lerr" style={{ display: 'flex' }}>{error}</div></div>;

  const kpis = (
    <>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <Tarjeta valor={miles(t.planteles)} etiqueta="Planteles" color="#2563eb" />
        {!canton && <Tarjeta valor={cantones.length} etiqueta="Cantones" color="#0d9488" />}
        <Tarjeta valor={miles(t.estudiantesSistema)} etiqueta="Estudiantes en SIGEE" sub={hayRef ? `AMIE: ${miles(t.estudiantesRef)}` : undefined} color="#16a34a" />
        <Tarjeta valor={miles(t.docentesSistema)} etiqueta="Docentes en SIGEE" sub={hayRef ? `AMIE: ${miles(t.docentesRef)}` : undefined} color="#7c3aed" />
        <Tarjeta valor={miles(t.administrativosSistema)} etiqueta="Administrativos en SIGEE" color="#d97706" />
        <Tarjeta valor={t.conFinanzas} etiqueta="Con módulo financiero" sub="planteles particulares habilitados" color="#be185d" />
      </div>
      {!hayRef && <div style={{ fontSize: 12, color: 'var(--slate)', marginBottom: 12 }}>El catálogo AMIE todavía no trae el número de estudiantes y docentes por plantel; se muestran los registrados en SIGEE.</div>}
    </>
  );

  const graficos = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12, marginBottom: 12 }}>
      <div className="card"><div className="ch"><h3>📊 Por sostenimiento</h3></div><div className="cb"><Barras datos={contar(delCanton, 'sostenimiento')} color={k => COLOR_SOST[k]} /></div></div>
      <div className="card"><div className="ch"><h3>📚 Por nivel educativo</h3></div><div className="cb"><Barras datos={contar(delCanton, 'nivel_educativo')} corto /></div></div>
      <div className="card"><div className="ch"><h3>🕐 Por jornada</h3></div><div className="cb"><Jornadas datos={contar(delCanton, 'jornada')} /></div></div>
    </div>
  );

  // ── Zona: todos los cantones ──
  if (!canton) {
    return (
      <div>
        {titulo}{filtroSost}{kpis}{graficos}
        <div className="card"><div className="ch"><h3>🏙️ Cantones de El Oro ({cantones.length})</h3></div>
          <div className="cb" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="data">
              <thead><tr><th>Cantón</th><th>Planteles</th><th>Parroquias</th>{sostenimientos.map(s => <th key={s}>{s}</th>)}<th>Estud. SIGEE</th><th>Doc. SIGEE</th></tr></thead>
              <tbody>
                {cantones.map(c => (
                  <tr key={c.canton} onClick={() => elegirCanton(c.canton)} style={{ cursor: 'pointer' }}>
                    <td><strong>{c.canton}</strong></td><td><strong>{c.planteles}</strong></td><td>{c.parroquias}</td>
                    {sostenimientos.map(s => <td key={s}>{c.sostenimientos[s] || 0}</td>)}
                    <td>{miles(c.estudiantesSistema)}</td><td>{miles(c.docentesSistema)}</td>
                  </tr>
                ))}
                {!cantones.length && <tr><td colSpan={5 + sostenimientos.length} style={{ textAlign: 'center', padding: 18, color: 'var(--slate)' }}>Sin planteles con ese filtro.</td></tr>}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '0 16px 12px', fontSize: 12, color: 'var(--slate)' }}>Toca un cantón para ver sus parroquias y planteles.</div>
        </div>
      </div>
    );
  }

  // ── Detalle de un cantón ──
  const niveles = contar(delCanton, 'nivel_educativo');
  const jornadas = contar(delCanton, 'jornada');
  const parroquias = contar(delCanton, 'parroquia');
  return (
    <div>
      {titulo}{filtroSost}{kpis}{graficos}
      <div className="card" style={{ marginBottom: 12 }}><div className="ch"><h3>📍 Por parroquia</h3></div><div className="cb"><Barras datos={parroquias} color="#0d9488" max={12} /></div></div>
      <div className="card">
        <div className="ch" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <h3>🏫 Planteles del cantón {canton} ({lista.length})</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select className="fc" value={parroquia} onChange={e => setParroquia(e.target.value)}><option value="">Todas las parroquias</option>{parroquias.map(p => <option key={p.clave} value={p.clave}>{p.clave}</option>)}</select>
            <select className="fc" value={nivel} onChange={e => setNivel(e.target.value)}><option value="">Todos los niveles</option>{niveles.map(p => <option key={p.clave} value={p.clave}>{nivelCorto(p.clave, 40)}</option>)}</select>
            <select className="fc" value={jornada} onChange={e => setJornada(e.target.value)}><option value="">Todas las jornadas</option>{jornadas.map(p => <option key={p.clave} value={p.clave}>{p.clave}</option>)}</select>
            <input className="fc" placeholder="Nombre o AMIE…" value={texto} onChange={e => setTexto(e.target.value)} />
          </div>
        </div>
        <div className="cb" style={{ padding: 0, overflowX: 'auto', maxHeight: 520 }}>
          <table className="data">
            <thead><tr><th>#</th><th>AMIE</th><th>Plantel</th><th>Parroquia</th><th>Sostenimiento</th><th>Nivel</th><th>Jornada</th><th>Estud.</th><th>Doc.</th><th>Adm.</th></tr></thead>
            <tbody>
              {lista.slice(0, 400).map((p, i) => (
                <tr key={p.id} onClick={() => setFichaId(p.id === fichaId ? '' : p.id)} style={{ cursor: 'pointer', background: p.id === fichaId ? '#eff6ff' : undefined }}>
                  <td style={{ color: 'var(--slate)' }}>{i + 1}</td><td><strong>{p.amie}</strong></td>
                  <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.nombre}>{p.nombre}</td>
                  <td>{p.parroquia}</td><td><Insignia sost={p.sostenimiento} /></td>
                  <td style={{ fontSize: 11.5, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.nivel_educativo}>{p.nivel_educativo}</td>
                  <td style={{ fontSize: 11.5 }}>{p.jornada}</td>
                  <td style={{ textAlign: 'center' }}>{p.estudiantes_ref || p.estudiantes_sistema || '—'}</td>
                  <td style={{ textAlign: 'center' }}>{p.docentes_ref || p.docentes_sistema || '—'}</td>
                  <td style={{ textAlign: 'center' }}>{p.administrativos_sistema || '—'}</td>
                </tr>
              ))}
              {!lista.length && <tr><td colSpan={10} style={{ textAlign: 'center', padding: 18, color: 'var(--slate)' }}>Ningún plantel con esos filtros.</td></tr>}
            </tbody>
          </table>
          {lista.length > 400 && <div style={{ padding: 10, fontSize: 12, color: 'var(--slate)' }}>Se muestran los primeros 400; usa los filtros o descarga el Excel.</div>}
        </div>
        <div style={{ padding: '0 16px 12px', fontSize: 12, color: 'var(--slate)' }}>Toca un plantel para ver su ficha.</div>
      </div>

      {ficha && (
        <div className="card" style={{ marginTop: 12, borderLeft: '4px solid #2563eb' }}>
          <div className="ch" style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <h3>🏫 {ficha.nombre}</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setFichaId('')}>Cerrar</button>
          </div>
          <div className="cb" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '0 28px' }}>
            <div>
              <Fila k="AMIE" v={ficha.amie} /><Fila k="Cantón" v={ficha.canton} /><Fila k="Parroquia" v={ficha.parroquia} />
              <Fila k="Sostenimiento" v={ficha.sostenimiento} /><Fila k="Régimen" v={ficha.regimen} /><Fila k="Nivel educativo" v={ficha.nivel_educativo} />
              <Fila k="Jornada" v={ficha.jornada} /><Fila k="Estado AMIE" v={ficha.estado_amie} />
            </div>
            <div>
              <Fila k="Zona" v={ficha.zona} /><Fila k="Distrito" v={ficha.distrito_nombre} /><Fila k="Circuito" v={ficha.circuito} />
              <Fila k="Rector/a" v={ficha.rector} /><Fila k="Teléfono" v={ficha.telefono} /><Fila k="Dirección" v={ficha.direccion} />
              <Fila k="Módulo financiero" v={ficha.finanzas_habilitado ? 'Habilitado' : 'No habilitado'} />
              <Fila k="Registrados en SIGEE" v={`${ficha.estudiantes_sistema} estudiantes · ${ficha.docentes_sistema} docentes · ${ficha.administrativos_sistema} administrativos`} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
