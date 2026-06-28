import { useState, useEffect } from 'react'
import { supabase, getCount } from '../lib/supabase'

const REPORTE_CARDS = [
  { id:'planteles',    ico:'ti-building-community', title:'Planteles por provincia', desc:'Distribución geográfica de planteles',                    color:'#0F2B5B' },
  { id:'docentes',     ico:'ti-users',              title:'Nómina de docentes',       desc:'Listado con situación laboral y categoría',               color:'#16A34A' },
  { id:'titulos',      ico:'ti-certificate',        title:'Títulos académicos',        desc:'Títulos por tipo, nivel e institución',                   color:'#534AB7' },
  { id:'estudiantes',  ico:'ti-school',             title:'Estudiantes matriculados',  desc:'Listado con datos personales y representante',           color:'#D97706' },
  { id:'calificaciones',ico:'ti-chart-line',        title:'Reporte de calificaciones', desc:'Promedios por curso, materia y período',                 color:'#0891B2' },
  { id:'asistencia',   ico:'ti-checklist',          title:'Reporte de asistencia',     desc:'Presentes, ausentes, tardanzas y justificadas por curso', color:'#DC2626' },
]

export default function Reportes() {
  const [stats, setStats]         = useState({})
  const [activeRep, setActiveRep] = useState('planteles')
  const [repData, setRepData]     = useState([])
  const [loading, setLoading]     = useState(false)
  const [loadingStats, setLoadingStats] = useState(true)
  const [search, setSearch]       = useState('')
  const [filtro, setFiltro]       = useState('')

  useEffect(()=>{ loadStats() },[])
  useEffect(()=>{ loadReporte(activeRep) },[activeRep])

  const loadStats = async () => {
    setLoadingStats(true)
    const [nP,nD,nT,nE,nM,nC,nA] = await Promise.all([
      getCount('planteles'), getCount('docentes'), getCount('docente_titulos'),
      getCount('estudiantes'), getCount('matriculas'), getCount('calificaciones'), getCount('asistencia')
    ])
    setStats({ planteles:nP, docentes:nD, titulos:nT, estudiantes:nE, matriculas:nM, calificaciones:nC, asistencia:nA })
    setLoadingStats(false)
  }

  const loadReporte = async (id) => {
    setLoading(true); setRepData([]); setSearch(''); setFiltro('')
    let data = []
    if (id==='planteles') {
      const { data:d } = await supabase.from('planteles')
        .select('codigo_amie,nombre,provincia,canton,sostenimiento,activo').order('provincia').order('nombre').limit(200)
      data = d||[]
    } else if (id==='docentes') {
      const { data:d } = await supabase.from('docentes')
        .select('apellidos,nombres,cedula,situacion_laboral,categoria,escalafon,activo').order('apellidos').limit(200)
      data = d||[]
    } else if (id==='titulos') {
      const { data:d } = await supabase.from('docente_titulos')
        .select('titulo,tipo_nivel,institucion,anio,senescyt').order('tipo_nivel').limit(200)
      data = d||[]
    } else if (id==='estudiantes') {
      const { data:d } = await supabase.from('estudiantes')
        .select('apellidos,nombres,cedula,genero,provincia,nombre_representante,telefono_representante,activo').order('apellidos').limit(200)
      data = d||[]
    } else if (id==='calificaciones') {
      const { data:d } = await supabase.from('calificaciones')
        .select('anio_lectivo,periodo,parcial1,parcial2,examen,promedio,estado, matriculas(estudiantes(apellidos,nombres)), materias(nombre)')
        .order('anio_lectivo').limit(200)
      data = d||[]
    } else if (id==='asistencia') {
      const { data:d } = await supabase.from('asistencia')
        .select('fecha,presente,justificada,tardanza,observacion, matriculas(estudiantes(apellidos,nombres))')
        .order('fecha',{ascending:false}).limit(200)
      data = d||[]
    }
    setRepData(data)
    setLoading(false)
  }

  const filterData = () => {
    let d = repData
    if (search) {
      const q = search.toLowerCase()
      d = d.filter(r => JSON.stringify(r).toLowerCase().includes(q))
    }
    if (filtro) {
      if (activeRep==='planteles') d = d.filter(r=>r.provincia===filtro)
      if (activeRep==='docentes')  d = d.filter(r=>r.situacion_laboral===filtro)
      if (activeRep==='titulos')   d = d.filter(r=>r.tipo_nivel===filtro)
    }
    return d
  }

  const filtered = filterData()

  // Para planteles: agrupar por provincia
  const byProvincia = activeRep==='planteles'
    ? [...new Set(repData.map(r=>r.provincia))].sort().map(pv=>({
        pv, cnt: repData.filter(r=>r.provincia===pv).length
      }))
    : []
  const maxCnt = Math.max(...byProvincia.map(p=>p.cnt),1)

  const card = REPORTE_CARDS.find(r=>r.id===activeRep)

  return (
    <div>
      {/* Stats globales */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:8,marginBottom:16}}>
        {[
          {lbl:'Planteles',   val:stats.planteles,     c:'#0F2B5B'},
          {lbl:'Docentes',    val:stats.docentes,      c:'#16A34A'},
          {lbl:'Títulos',     val:stats.titulos,       c:'#534AB7'},
          {lbl:'Estudiantes', val:stats.estudiantes,   c:'#D97706'},
          {lbl:'Matrículas',  val:stats.matriculas,    c:'#0891B2'},
          {lbl:'Calificaciones',val:stats.calificaciones,c:'#DC2626'},
          {lbl:'Asistencia',  val:stats.asistencia,    c:'#065F46'},
        ].map((s,i)=>(
          <div key={i} style={{background:'#F9FAFB',borderRadius:9,padding:'10px 10px',border:'0.5px solid #E5E7EB',textAlign:'center',position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',top:0,right:0,width:3,height:'100%',background:s.c}}/>
            <div style={{fontSize:loadingStats?14:18,fontWeight:700,color:s.c}}>{loadingStats?'…':s.val}</div>
            <div style={{fontSize:9,color:'#9CA3AF',marginTop:2}}>{s.lbl}</div>
          </div>
        ))}
      </div>

      {/* Selector de reportes */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:16}}>
        {REPORTE_CARDS.map(r=>(
          <div key={r.id} onClick={()=>setActiveRep(r.id)}
            style={{border:`0.5px solid ${activeRep===r.id?r.color:'#E5E7EB'}`,borderRadius:10,padding:14,cursor:'pointer',
              background:activeRep===r.id?`${r.color}08`:'#fff',transition:'all .15s'}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{width:36,height:36,borderRadius:8,background:`${r.color}18`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <i className={`ti ${r.ico}`} style={{fontSize:18,color:r.color}}/>
              </div>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:activeRep===r.id?r.color:'#1A2B4A'}}>{r.title}</div>
                <div style={{fontSize:10,color:'#9CA3AF',marginTop:2}}>{r.desc}</div>
              </div>
              {activeRep===r.id&&<div style={{marginLeft:'auto',width:8,height:8,borderRadius:'50%',background:r.color,flexShrink:0}}/>}
            </div>
          </div>
        ))}
      </div>

      {/* Reporte activo */}
      <div style={{background:'#fff',border:'0.5px solid #E5E7EB',borderRadius:12,overflow:'hidden'}}>
        {/* Header */}
        <div style={{padding:'12px 16px',borderBottom:'0.5px solid #F3F4F6',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8,background:`${card?.color}04`}}>
          <div>
            <span style={{fontSize:13,fontWeight:600,color:card?.color,display:'flex',alignItems:'center',gap:6}}>
              <i className={`ti ${card?.ico}`}/>{card?.title}
            </span>
            <div style={{fontSize:10,color:'#9CA3AF',marginTop:2}}>{filtered.length} registros · Datos en tiempo real desde Supabase</div>
          </div>
          <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
            <div style={{position:'relative'}}>
              <i className="ti ti-search" style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',color:'#9CA3AF',fontSize:12}}/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar en el reporte..."
                style={{height:30,border:'0.5px solid #E5E7EB',borderRadius:6,padding:'0 8px 0 26px',fontSize:11,background:'#F9FAFB',width:180}}/>
            </div>
            {activeRep==='planteles'&&(
              <select value={filtro} onChange={e=>setFiltro(e.target.value)}
                style={{height:30,border:'0.5px solid #E5E7EB',borderRadius:6,fontSize:11,padding:'0 8px',background:'#F9FAFB'}}>
                <option value="">Todas las provincias</option>
                {[...new Set(repData.map(r=>r.provincia))].sort().map(p=><option key={p}>{p}</option>)}
              </select>
            )}
            {activeRep==='docentes'&&(
              <select value={filtro} onChange={e=>setFiltro(e.target.value)}
                style={{height:30,border:'0.5px solid #E5E7EB',borderRadius:6,fontSize:11,padding:'0 8px',background:'#F9FAFB'}}>
                <option value="">Todas las situaciones</option>
                {['Nombramiento','Contrato','Reemplazo','Provisional'].map(s=><option key={s}>{s}</option>)}
              </select>
            )}
            <button onClick={()=>loadReporte(activeRep)}
              style={{height:30,padding:'0 10px',border:'0.5px solid #E5E7EB',borderRadius:6,background:'#F9FAFB',fontSize:11,cursor:'pointer',display:'flex',alignItems:'center',gap:3,color:'#374151'}}>
              <i className="ti ti-refresh" style={{fontSize:12}}/>Actualizar
            </button>
          </div>
        </div>

        {/* Chart provincia */}
        {activeRep==='planteles'&&!filtro&&byProvincia.length>0&&(
          <div style={{padding:'14px 16px',borderBottom:'0.5px solid #F3F4F6',background:'#FAFAFA'}}>
            <div style={{fontSize:11,fontWeight:600,color:'#0F2B5B',marginBottom:10}}>Distribución por provincia</div>
            <div style={{display:'flex',flexDirection:'column',gap:5}}>
              {byProvincia.slice(0,8).map(({pv,cnt})=>(
                <div key={pv} style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:11,color:'#374151',minWidth:120}}>{pv}</span>
                  <div style={{flex:1,height:8,background:'#F3F4F6',borderRadius:4,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${cnt/maxCnt*100}%`,background:'#0F2B5B',borderRadius:4,transition:'width .5s'}}/>
                  </div>
                  <span style={{fontSize:11,fontWeight:600,color:'#0F2B5B',minWidth:30,textAlign:'right'}}>{cnt}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabla datos */}
        {loading?(
          <div style={{padding:32,textAlign:'center',color:'#9CA3AF',fontSize:12}}>Cargando desde Supabase…</div>
        ):filtered.length===0?(
          <div style={{padding:32,textAlign:'center',color:'#9CA3AF',fontSize:12}}>
            <i className={`ti ${card?.ico}`} style={{fontSize:36,color:'#D1D5DB',display:'block',marginBottom:10}}/>
            Sin datos. {activeRep==='estudiantes'||activeRep==='calificaciones'||activeRep==='asistencia'?'Registra datos primero.':''}
          </div>
        ):(
          <div style={{overflowX:'auto'}}>
            {activeRep==='planteles'&&(
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr>
                  {['AMIE','Nombre','Provincia','Cantón','Sostenimiento','Estado'].map(h=>(
                    <th key={h} style={{textAlign:'left',padding:'0 12px 8px',fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',borderBottom:'0.5px solid #F3F4F6'}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtered.map((r,i)=>(
                    <tr key={i} style={{borderBottom:'0.5px solid #F9FAFB'}}>
                      <td style={{padding:'8px 12px',fontFamily:'monospace',fontSize:11,color:'#6B7280'}}>{r.codigo_amie}</td>
                      <td style={{padding:'8px 12px',fontWeight:500,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.nombre}</td>
                      <td style={{padding:'8px 12px',color:'#6B7280'}}>{r.provincia}</td>
                      <td style={{padding:'8px 12px',color:'#6B7280'}}>{r.canton}</td>
                      <td style={{padding:'8px 12px'}}><span style={{fontSize:10,padding:'2px 7px',borderRadius:9,background:'rgba(15,43,91,.08)',color:'#0F2B5B',fontWeight:500}}>{r.sostenimiento||'—'}</span></td>
                      <td style={{padding:'8px 12px'}}><span style={{fontSize:10,padding:'2px 7px',borderRadius:9,fontWeight:500,background:r.activo?'rgba(22,163,74,.1)':'#F3F4F6',color:r.activo?'#15803d':'#9CA3AF'}}>{r.activo?'Activa':'Inactiva'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {activeRep==='docentes'&&(
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr>
                  {['Nombre','Cédula','Situación','Categoría','Escalafón','Estado'].map(h=>(
                    <th key={h} style={{textAlign:'left',padding:'0 12px 8px',fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',borderBottom:'0.5px solid #F3F4F6'}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtered.map((r,i)=>{
                    const sitC={Nombramiento:'rgba(15,43,91,.08)',Contrato:'rgba(217,119,6,.1)',Reemplazo:'rgba(220,38,38,.08)'}
                    const sitT={Nombramiento:'#0F2B5B',Contrato:'#D97706',Reemplazo:'#DC2626'}
                    return(
                      <tr key={i} style={{borderBottom:'0.5px solid #F9FAFB'}}>
                        <td style={{padding:'8px 12px',fontWeight:500}}>{r.apellidos}, {r.nombres}</td>
                        <td style={{padding:'8px 12px',fontFamily:'monospace',fontSize:11,color:'#6B7280'}}>{r.cedula||'—'}</td>
                        <td style={{padding:'8px 12px'}}><span style={{fontSize:10,padding:'2px 7px',borderRadius:9,fontWeight:500,background:sitC[r.situacion_laboral]||'#F3F4F6',color:sitT[r.situacion_laboral]||'#9CA3AF'}}>{r.situacion_laboral||'—'}</span></td>
                        <td style={{padding:'8px 12px',color:'#6B7280'}}>{r.categoria||'—'}</td>
                        <td style={{padding:'8px 12px',fontWeight:600,color:'#0F2B5B'}}>{r.escalafon||'—'}</td>
                        <td style={{padding:'8px 12px'}}><span style={{fontSize:10,padding:'2px 7px',borderRadius:9,fontWeight:500,background:r.activo?'rgba(22,163,74,.1)':'#F3F4F6',color:r.activo?'#15803d':'#9CA3AF'}}>{r.activo?'Activo':'Inactivo'}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            {activeRep==='titulos'&&(
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr>
                  {['Título','Tipo','Institución','Año','SENESCYT'].map(h=>(
                    <th key={h} style={{textAlign:'left',padding:'0 12px 8px',fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',borderBottom:'0.5px solid #F3F4F6'}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtered.map((r,i)=>(
                    <tr key={i} style={{borderBottom:'0.5px solid #F9FAFB'}}>
                      <td style={{padding:'8px 12px',fontWeight:500,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.titulo||'—'}</td>
                      <td style={{padding:'8px 12px'}}><span style={{fontSize:10,padding:'2px 7px',borderRadius:9,fontWeight:500,background:r.tipo_nivel==='Cuarto Nivel'?'rgba(83,74,183,.08)':'rgba(15,43,91,.08)',color:r.tipo_nivel==='Cuarto Nivel'?'#534AB7':'#0F2B5B'}}>{r.tipo_nivel||'—'}</span></td>
                      <td style={{padding:'8px 12px',color:'#6B7280',fontSize:11,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.institucion||'—'}</td>
                      <td style={{padding:'8px 12px',fontFamily:'monospace',fontSize:11}}>{r.anio||'—'}</td>
                      <td style={{padding:'8px 12px',fontFamily:'monospace',fontSize:10,color:'#9CA3AF'}}>{r.senescyt||'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {activeRep==='estudiantes'&&(
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr>
                  {['Estudiante','Cédula','Género','Provincia','Representante','Teléfono','Estado'].map(h=>(
                    <th key={h} style={{textAlign:'left',padding:'0 12px 8px',fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',borderBottom:'0.5px solid #F3F4F6'}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtered.map((r,i)=>(
                    <tr key={i} style={{borderBottom:'0.5px solid #F9FAFB'}}>
                      <td style={{padding:'8px 12px',fontWeight:500}}>{r.apellidos}, {r.nombres}</td>
                      <td style={{padding:'8px 12px',fontFamily:'monospace',fontSize:11,color:'#6B7280'}}>{r.cedula||'—'}</td>
                      <td style={{padding:'8px 12px',color:'#6B7280'}}>{r.genero||'—'}</td>
                      <td style={{padding:'8px 12px',color:'#6B7280'}}>{r.provincia||'—'}</td>
                      <td style={{padding:'8px 12px',fontSize:11}}>{r.nombre_representante||'—'}</td>
                      <td style={{padding:'8px 12px',fontFamily:'monospace',fontSize:11,color:'#6B7280'}}>{r.telefono_representante||'—'}</td>
                      <td style={{padding:'8px 12px'}}><span style={{fontSize:10,padding:'2px 7px',borderRadius:9,fontWeight:500,background:r.activo?'rgba(22,163,74,.1)':'#F3F4F6',color:r.activo?'#15803d':'#9CA3AF'}}>{r.activo?'Activo':'Inactivo'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {activeRep==='calificaciones'&&(
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr>
                  {['Estudiante','Materia','Período','P1','P2','Examen','Promedio','Estado'].map(h=>(
                    <th key={h} style={{textAlign:'left',padding:'0 12px 8px',fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',borderBottom:'0.5px solid #F3F4F6'}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtered.map((r,i)=>{
                    const ap=r.promedio>=7
                    return(
                      <tr key={i} style={{borderBottom:'0.5px solid #F9FAFB'}}>
                        <td style={{padding:'8px 12px',fontWeight:500}}>{r.matriculas?.estudiantes?.apellidos}, {r.matriculas?.estudiantes?.nombres}</td>
                        <td style={{padding:'8px 12px',color:'#6B7280'}}>{r.materias?.nombre||'—'}</td>
                        <td style={{padding:'8px 12px'}}><span style={{fontSize:10,padding:'2px 7px',borderRadius:9,background:'rgba(15,43,91,.08)',color:'#0F2B5B',fontWeight:500}}>{r.periodo}</span></td>
                        <td style={{padding:'8px 12px',textAlign:'center',fontFamily:'monospace'}}>{r.parcial1??'—'}</td>
                        <td style={{padding:'8px 12px',textAlign:'center',fontFamily:'monospace'}}>{r.parcial2??'—'}</td>
                        <td style={{padding:'8px 12px',textAlign:'center',fontFamily:'monospace'}}>{r.examen??'—'}</td>
                        <td style={{padding:'8px 12px',textAlign:'center'}}>
                          {r.promedio!==null?<span style={{fontSize:13,fontWeight:700,color:ap?'#15803d':'#DC2626'}}>{parseFloat(r.promedio).toFixed(2)}</span>:'—'}
                        </td>
                        <td style={{padding:'8px 12px'}}><span style={{fontSize:10,padding:'2px 7px',borderRadius:9,fontWeight:500,background:r.estado==='Registrada'?'rgba(15,43,91,.08)':'rgba(22,163,74,.1)',color:r.estado==='Registrada'?'#0F2B5B':'#15803d'}}>{r.estado}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            {activeRep==='asistencia'&&(
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr>
                  {['Fecha','Estudiante','Presente','Justificada','Tardanza','Observación'].map(h=>(
                    <th key={h} style={{textAlign:'left',padding:'0 12px 8px',fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',borderBottom:'0.5px solid #F3F4F6'}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtered.map((r,i)=>(
                    <tr key={i} style={{borderBottom:'0.5px solid #F9FAFB'}}>
                      <td style={{padding:'8px 12px',fontFamily:'monospace',fontSize:11}}>{r.fecha}</td>
                      <td style={{padding:'8px 12px',fontWeight:500}}>{r.matriculas?.estudiantes?.apellidos}, {r.matriculas?.estudiantes?.nombres}</td>
                      <td style={{padding:'8px 12px',textAlign:'center'}}>{r.presente?'✅':'❌'}</td>
                      <td style={{padding:'8px 12px',textAlign:'center'}}>{r.justificada?'📄':'—'}</td>
                      <td style={{padding:'8px 12px',textAlign:'center'}}>{r.tardanza?'⏰':'—'}</td>
                      <td style={{padding:'8px 12px',color:'#6B7280',fontSize:11}}>{r.observacion||'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Footer */}
        {filtered.length>0&&(
          <div style={{padding:'10px 16px',borderTop:'0.5px solid #F3F4F6',display:'flex',alignItems:'center',justifyContent:'space-between',background:'#FAFAFA'}}>
            <span style={{fontSize:11,color:'#9CA3AF'}}>{filtered.length} registros mostrados · Datos en tiempo real</span>
            <span style={{fontSize:10,color:'#9CA3AF',display:'flex',alignItems:'center',gap:4}}>
              <span style={{width:6,height:6,borderRadius:'50%',background:'#16A34A',display:'inline-block',animation:'pulse 2s infinite'}}/>
              Conectado a Supabase
            </span>
          </div>
        )}
      </div>
      <style>{`@keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.3);opacity:.6}}`}</style>
    </div>
  )
}
