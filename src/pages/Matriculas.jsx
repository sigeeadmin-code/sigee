import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const ESTADOS = ['Activa','Retirada','Promovida','Reprobada','Trasladada','Anulada']
const EST_COLORS = {
  Activa:    {bg:'rgba(22,163,74,.1)',  color:'#15803d'},
  Retirada:  {bg:'rgba(220,38,38,.08)', color:'#DC2626'},
  Promovida: {bg:'rgba(83,74,183,.08)', color:'#534AB7'},
  Reprobada: {bg:'rgba(220,38,38,.08)', color:'#DC2626'},
  Trasladada:{bg:'rgba(217,119,6,.1)',  color:'#D97706'},
  Anulada:   {bg:'#F3F4F6',            color:'#9CA3AF'},
}
const JORNADAS = ['Matutina','Vespertina','Nocturna','Completa']

const STEPS = ['Estudiante','Curso','Datos','Confirmar']

function genNumMatricula() {
  const yr = new Date().getFullYear()
  const rnd = String(Math.floor(Math.random()*9000)+1000)
  return `MAT-${yr}-${rnd}`
}

export default function Matriculas() {
  const [tab, setTab]         = useState('lista')
  const [step, setStep]       = useState(0)
  const [matriculas, setMat]  = useState([])
  const [estudiantes, setEst] = useState([])
  const [cursos, setCursos]   = useState([])
  const [planteles, setPla]   = useState([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [alert, setAlert]     = useState(null)
  const [search, setSearch]   = useState('')
  const [estSearch, setEstSearch] = useState('')
  const [estResults, setEstResults] = useState([])
  const [selectedEst, setSelectedEst] = useState(null)
  const [selectedCurso, setSelectedCurso] = useState(null)
  const [form, setForm] = useState({
    anio_lectivo:'2025-2026', numero_matricula: genNumMatricula(),
    jornada:'Matutina', estado:'Activa', fecha_matricula: new Date().toISOString().split('T')[0],
    observaciones:''
  })

  useEffect(()=>{ load() },[])

  const load = async () => {
    setLoading(true)
    const [{ data:m, count },{ data:c },{ data:p }] = await Promise.all([
      supabase.from('matriculas')
        .select('*, estudiantes(apellidos,nombres,cedula), cursos(nombre,grado,paralelo), planteles(nombre)', {count:'exact'})
        .order('created_at',{ascending:false}).limit(100),
      supabase.from('cursos').select('id,nombre,grado,paralelo,nivel,jornada').eq('activo',true).order('grado'),
      supabase.from('planteles').select('id,nombre,codigo_amie').order('nombre').limit(100)
    ])
    setMat(m||[]); setTotal(count||0); setCursos(c||[]); setPla(p||[])
    setLoading(false)
  }

  const msg = (type,text) => { setAlert({type,text}); setTimeout(()=>setAlert(null),6000) }

  const searchEstudiante = async (q) => {
    setEstSearch(q)
    if (q.length < 2) { setEstResults([]); return }
    const { data } = await supabase.from('estudiantes')
      .select('id,apellidos,nombres,cedula')
      .or(`apellidos.ilike.%${q}%,nombres.ilike.%${q}%,cedula.ilike.%${q}%`)
      .limit(8)
    setEstResults(data||[])
  }

  const next = () => {
    if (step===0 && !selectedEst) return msg('error','Selecciona un estudiante')
    if (step===1 && !selectedCurso) return msg('error','Selecciona un curso')
    setStep(s=>Math.min(s+1,3))
  }
  const back = () => setStep(s=>Math.max(s-1,0))

  const handleSave = async () => {
    if (!selectedEst || !selectedCurso) return msg('error','Faltan datos requeridos')
    setSaving(true)
    const { error } = await supabase.from('matriculas').insert({
      estudiante_id:   selectedEst.id,
      plantel_id:      selectedCurso.plantel_id || planteles[0]?.id,
      curso_id:        selectedCurso.id,
      anio_lectivo:    form.anio_lectivo,
      numero_matricula:form.numero_matricula,
      nivel:           selectedCurso.nivel||null,
      grado:           selectedCurso.grado||null,
      paralelo:        selectedCurso.paralelo||null,
      jornada:         form.jornada,
      estado:          form.estado,
      fecha_matricula: form.fecha_matricula,
      observaciones:   form.observaciones||null
    })
    if (!error) {
      // Insertar en curso_estudiantes también
      await supabase.from('curso_estudiantes').insert({
        curso_id: selectedCurso.id,
        estudiante_id: selectedEst.id,
        anio_lectivo: form.anio_lectivo,
        activo: true
      })
    }
    setSaving(false)
    if (error) {
      let m = error.message
      if (m.includes('duplicate')||m.includes('unique')) m = 'Este estudiante ya está matriculado en este curso'
      return msg('error', m)
    }
    msg('ok',`✅ Matrícula ${form.numero_matricula} registrada para ${selectedEst.apellidos}, ${selectedEst.nombres}`)
    setSelectedEst(null); setSelectedCurso(null); setEstSearch(''); setEstResults([])
    setForm(f=>({...f,numero_matricula:genNumMatricula(),observaciones:''}))
    setStep(0); setTab('lista'); load()
  }

  const filtered = matriculas.filter(m =>
    !search || `${m.estudiantes?.apellidos} ${m.estudiantes?.nombres} ${m.numero_matricula||''}`.toLowerCase().includes(search.toLowerCase())
  )

  const porEstado = ESTADOS.reduce((acc,e) => ({ ...acc, [e]: matriculas.filter(m=>m.estado===e).length }),{})

  return (
    <div>
      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:8,marginBottom:16}}>
        {[
          {val:total,              lbl:'Total',     c:'#0F2B5B'},
          {val:porEstado.Activa||0,lbl:'Activas',   c:'#16A34A'},
          {val:porEstado.Promovida||0,lbl:'Promovidas',c:'#534AB7'},
          {val:porEstado.Retirada||0, lbl:'Retiradas',c:'#DC2626'},
          {val:porEstado.Reprobada||0,lbl:'Reprobadas',c:'#D97706'},
          {val:cursos.length,      lbl:'Cursos',    c:'#0891B2'},
        ].map((s,i)=>(
          <div key={i} style={{background:'#F9FAFB',borderRadius:10,padding:10,border:'0.5px solid #E5E7EB',position:'relative',overflow:'hidden',textAlign:'center'}}>
            <div style={{position:'absolute',top:0,right:0,width:3,height:'100%',background:s.c}}/>
            <div style={{fontSize:18,fontWeight:700,color:s.c}}>{s.val}</div>
            <div style={{fontSize:10,color:'#9CA3AF',marginTop:2}}>{s.lbl}</div>
          </div>
        ))}
      </div>

      {alert&&(
        <div style={{borderRadius:8,padding:'10px 14px',fontSize:12,display:'flex',alignItems:'center',gap:7,marginBottom:12,
          background:alert.type==='ok'?'rgba(22,163,74,.08)':'rgba(220,38,38,.06)',
          border:`0.5px solid ${alert.type==='ok'?'rgba(22,163,74,.25)':'rgba(220,38,38,.2)'}`,
          color:alert.type==='ok'?'#15803d':'#B91C1C'}}>
          <i className={`ti ti-${alert.type==='ok'?'circle-check':'alert-circle'}`} style={{fontSize:14}}/>{alert.text}
        </div>
      )}

      {/* Tabs */}
      <div style={{display:'flex',gap:3,background:'#F3F4F6',padding:3,borderRadius:8,width:'fit-content',marginBottom:14}}>
        {[['lista','Lista de matrículas'],['nueva','+ Nueva matrícula']].map(([id,lbl])=>(
          <button key={id} onClick={()=>{setTab(id);if(id==='nueva')setStep(0)}}
            style={{padding:'5px 14px',borderRadius:5,border:'none',fontSize:11,cursor:'pointer',
              background:tab===id?'#fff':'transparent',color:tab===id?'#0F2B5B':'#6B7280',
              fontWeight:tab===id?600:500,boxShadow:tab===id?'0 1px 2px rgba(0,0,0,.07)':'none'}}>{lbl}</button>
        ))}
      </div>

      {/* LISTA */}
      {tab==='lista'&&(
        <div style={{background:'#fff',border:'0.5px solid #E5E7EB',borderRadius:12,overflow:'hidden'}}>
          <div style={{padding:'12px 16px',borderBottom:'0.5px solid #F3F4F6',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}>
            <span style={{fontSize:12,fontWeight:600,color:'#0F2B5B',display:'flex',alignItems:'center',gap:5}}>
              <i className="ti ti-file-certificate"/>{filtered.length} de {total} matrículas
            </span>
            <div style={{display:'flex',gap:6}}>
              <div style={{position:'relative'}}>
                <i className="ti ti-search" style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',color:'#9CA3AF',fontSize:12}}/>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por estudiante o Nº..."
                  style={{height:30,border:'0.5px solid #E5E7EB',borderRadius:6,padding:'0 8px 0 26px',fontSize:11,background:'#F9FAFB',width:220}}/>
              </div>
              <button onClick={()=>setTab('nueva')}
                style={{height:30,padding:'0 12px',background:'#0F2B5B',border:'none',borderRadius:6,color:'#fff',fontSize:11,cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
                <i className="ti ti-plus" style={{fontSize:12}}/>Nueva
              </button>
            </div>
          </div>
          {loading?(
            <div style={{padding:28,textAlign:'center',color:'#9CA3AF',fontSize:12}}>Cargando desde Supabase…</div>
          ):filtered.length===0?(
            <div style={{padding:36,textAlign:'center'}}>
              <i className="ti ti-file-certificate" style={{fontSize:40,color:'#D1D5DB',display:'block',marginBottom:10}}/>
              <p style={{fontSize:13,color:'#9CA3AF',marginBottom:4}}>Sin matrículas registradas.</p>
              <p style={{fontSize:12,color:'#9CA3AF',marginBottom:14}}>Necesitas estudiantes y cursos registrados primero.</p>
              <button onClick={()=>setTab('nueva')} style={{padding:'8px 18px',background:'#0F2B5B',border:'none',borderRadius:7,color:'#fff',fontSize:12,cursor:'pointer'}}>
                Registrar primera matrícula
              </button>
            </div>
          ):(
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr>
                  {['Nº Matrícula','Estudiante','Curso','Año','Jornada','Fecha','Estado'].map(h=>(
                    <th key={h} style={{textAlign:'left',padding:'0 12px 8px',fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',borderBottom:'0.5px solid #F3F4F6'}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtered.map(m=>{
                    const ec = EST_COLORS[m.estado]||EST_COLORS.Anulada
                    return (
                      <tr key={m.id} style={{borderBottom:'0.5px solid #F9FAFB'}}>
                        <td style={{padding:'9px 12px',fontFamily:'monospace',fontSize:11,fontWeight:600,color:'#0F2B5B'}}>{m.numero_matricula||'—'}</td>
                        <td style={{padding:'9px 12px',fontWeight:500}}>{m.estudiantes?`${m.estudiantes.apellidos}, ${m.estudiantes.nombres}`:'—'}</td>
                        <td style={{padding:'9px 12px'}}>
                          {m.cursos?<span style={{fontSize:10,padding:'2px 7px',borderRadius:9,background:'rgba(15,43,91,.08)',color:'#0F2B5B',fontWeight:500}}>{m.cursos.grado} "{m.cursos.paralelo}"</span>:'—'}
                        </td>
                        <td style={{padding:'9px 12px',color:'#6B7280',fontSize:11}}>{m.anio_lectivo}</td>
                        <td style={{padding:'9px 12px',color:'#6B7280'}}>{m.jornada||'—'}</td>
                        <td style={{padding:'9px 12px',color:'#6B7280',fontSize:11}}>{m.fecha_matricula||'—'}</td>
                        <td style={{padding:'9px 12px'}}>
                          <span style={{fontSize:10,padding:'2px 7px',borderRadius:9,fontWeight:500,background:ec.bg,color:ec.color}}>{m.estado}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* NUEVA MATRÍCULA — 4 pasos */}
      {tab==='nueva'&&(
        <div>
          {/* Steps */}
          <div style={{display:'flex',gap:0,marginBottom:20}}>
            {STEPS.map((s,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',flex:1}}>
                <div style={{width:28,height:28,borderRadius:'50%',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,
                  background:i<step?'#16A34A':i===step?'#0F2B5B':'#F3F4F6',
                  color:i<step?'#fff':i===step?'#FFD100':'#9CA3AF',
                  border:`2px solid ${i<step?'#16A34A':i===step?'#0F2B5B':'#E5E7EB'}`}}>
                  {i<step?<i className="ti ti-check" style={{fontSize:11}}/>:i+1}
                </div>
                <span style={{fontSize:11,marginLeft:6,color:i===step?'#0F2B5B':'#9CA3AF',fontWeight:i===step?600:400,whiteSpace:'nowrap'}}>{s}</span>
                {i<3&&<div style={{flex:1,height:1,background:i<step?'#16A34A':'#E5E7EB',margin:'0 8px'}}/>}
              </div>
            ))}
          </div>

          <div style={{background:'#fff',border:'0.5px solid #E5E7EB',borderRadius:12,padding:20}}>

            {/* STEP 0 — Buscar estudiante */}
            {step===0&&(
              <>
                <div style={{fontSize:12,fontWeight:600,color:'#0F2B5B',marginBottom:14,display:'flex',alignItems:'center',gap:5}}>
                  <i className="ti ti-school"/>Buscar estudiante
                </div>
                {selectedEst?(
                  <div style={{background:'rgba(22,163,74,.05)',border:'0.5px solid rgba(22,163,74,.25)',borderRadius:9,padding:'12px 14px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div style={{width:36,height:36,borderRadius:'50%',background:'rgba(15,43,91,.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'#0F2B5B'}}>
                        {(selectedEst.apellidos[0]||'')+(selectedEst.nombres[0]||'')}
                      </div>
                      <div>
                        <div style={{fontWeight:600,fontSize:13}}>{selectedEst.apellidos}, {selectedEst.nombres}</div>
                        <div style={{fontSize:11,color:'#6B7280'}}>Cédula: {selectedEst.cedula||'—'}</div>
                      </div>
                    </div>
                    <button onClick={()=>setSelectedEst(null)} style={{border:'none',background:'none',cursor:'pointer',color:'#9CA3AF',fontSize:18}}>
                      <i className="ti ti-x"/>
                    </button>
                  </div>
                ):(
                  <div style={{position:'relative'}}>
                    <i className="ti ti-search" style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'#9CA3AF',fontSize:14}}/>
                    <input value={estSearch} onChange={e=>searchEstudiante(e.target.value)}
                      placeholder="Escribe apellidos, nombres o cédula..."
                      style={{width:'100%',height:40,border:'0.5px solid #E5E7EB',borderRadius:8,padding:'0 12px 0 32px',fontSize:13,background:'#F9FAFB',boxSizing:'border-box'}}/>
                    {estResults.length>0&&(
                      <div style={{border:'0.5px solid #E5E7EB',borderRadius:8,overflow:'hidden',marginTop:4,background:'#fff',boxShadow:'0 4px 12px rgba(0,0,0,.08)'}}>
                        {estResults.map(e=>(
                          <div key={e.id} onClick={()=>{setSelectedEst(e);setEstSearch('');setEstResults([])}}
                            style={{padding:'10px 14px',cursor:'pointer',borderBottom:'0.5px solid #F9FAFB',fontSize:12}}
                            onMouseOver={ev=>ev.currentTarget.style.background='#F9FAFB'}
                            onMouseOut={ev=>ev.currentTarget.style.background=''}>
                            <div style={{fontWeight:500}}>{e.apellidos}, {e.nombres}</div>
                            <div style={{fontSize:10,color:'#9CA3AF'}}>Cédula: {e.cedula||'—'}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {estSearch.length>=2&&estResults.length===0&&(
                      <div style={{marginTop:8,padding:'10px 14px',background:'#F9FAFB',borderRadius:8,fontSize:12,color:'#9CA3AF',border:'0.5px solid #E5E7EB'}}>
                        Sin resultados para "{estSearch}". ¿<span style={{color:'#0F2B5B',cursor:'pointer',textDecoration:'underline'}} onClick={()=>window.open('/estudiantes','_self')}>Registrar nuevo estudiante</span>?
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* STEP 1 — Seleccionar curso */}
            {step===1&&(
              <>
                <div style={{fontSize:12,fontWeight:600,color:'#0F2B5B',marginBottom:14,display:'flex',alignItems:'center',gap:5}}>
                  <i className="ti ti-books"/>Seleccionar curso
                </div>
                {cursos.length===0?(
                  <div style={{textAlign:'center',padding:24,color:'#9CA3AF',fontSize:12}}>
                    <i className="ti ti-books" style={{fontSize:32,display:'block',marginBottom:8,color:'#D1D5DB'}}/>
                    No hay cursos activos. <a href="/cursos" style={{color:'#0F2B5B'}}>Crea cursos primero →</a>
                  </div>
                ):(
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:8}}>
                    {cursos.map(c=>(
                      <div key={c.id} onClick={()=>setSelectedCurso(c)}
                        style={{border:`0.5px solid ${selectedCurso?.id===c.id?'#0F2B5B':'#E5E7EB'}`,borderRadius:10,padding:14,cursor:'pointer',
                          background:selectedCurso?.id===c.id?'rgba(15,43,91,.05)':'#fff',transition:'all .15s'}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
                          <div>
                            <div style={{fontSize:16,fontWeight:700,color:'#1A2B4A'}}>{c.grado}</div>
                            <div style={{fontSize:10,color:'#9CA3AF'}}>{c.nivel}</div>
                          </div>
                          <div style={{width:28,height:28,borderRadius:7,background:'#0F2B5B',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'#FFD100'}}>
                            {c.paralelo}
                          </div>
                        </div>
                        <div style={{fontSize:10,color:'#6B7280'}}>{c.jornada}</div>
                        {selectedCurso?.id===c.id&&(
                          <div style={{marginTop:6,fontSize:10,color:'#16A34A',fontWeight:500,display:'flex',alignItems:'center',gap:3}}>
                            <i className="ti ti-circle-check" style={{fontSize:11}}/>Seleccionado
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* STEP 2 — Datos matrícula */}
            {step===2&&(
              <>
                <div style={{fontSize:12,fontWeight:600,color:'#0F2B5B',marginBottom:14,display:'flex',alignItems:'center',gap:5}}>
                  <i className="ti ti-file-certificate"/>Datos de la matrícula
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  {[
                    {lbl:'Número de matrícula',id:'numero_matricula',ph:'MAT-2026-0001'},
                    {lbl:'Fecha de matrícula',id:'fecha_matricula',type:'date'},
                    {lbl:'Año lectivo',id:'anio_lectivo',ph:'2025-2026'},
                    {lbl:'Jornada',id:'jornada',type:'select',opts:JORNADAS},
                    {lbl:'Estado',id:'estado',type:'select',opts:ESTADOS},
                  ].map(f=>(
                    <div key={f.id}>
                      <div style={{fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:4}}>{f.lbl}</div>
                      {f.type==='select'?(
                        <select value={form[f.id]} onChange={e=>setForm({...form,[f.id]:e.target.value})}
                          style={{width:'100%',height:34,border:'0.5px solid #E5E7EB',borderRadius:7,padding:'0 10px',fontSize:12,background:'#F9FAFB',boxSizing:'border-box'}}>
                          {f.opts.map(o=><option key={o} value={o}>{o}</option>)}
                        </select>
                      ):(
                        <input type={f.type||'text'} value={form[f.id]} onChange={e=>setForm({...form,[f.id]:e.target.value})} placeholder={f.ph}
                          style={{width:'100%',height:34,border:'0.5px solid #E5E7EB',borderRadius:7,padding:'0 10px',fontSize:12,background:'#F9FAFB',boxSizing:'border-box',fontFamily:f.id==='numero_matricula'?'monospace':'inherit'}}/>
                      )}
                    </div>
                  ))}
                  <div>
                    <div style={{fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:4}}>Observaciones</div>
                    <input value={form.observaciones} onChange={e=>setForm({...form,observaciones:e.target.value})} placeholder="Notas opcionales..."
                      style={{width:'100%',height:34,border:'0.5px solid #E5E7EB',borderRadius:7,padding:'0 10px',fontSize:12,background:'#F9FAFB',boxSizing:'border-box'}}/>
                  </div>
                </div>
              </>
            )}

            {/* STEP 3 — Confirmar */}
            {step===3&&(
              <>
                <div style={{fontSize:12,fontWeight:600,color:'#0F2B5B',marginBottom:14,display:'flex',alignItems:'center',gap:5}}>
                  <i className="ti ti-clipboard-check"/>Confirmar matrícula
                </div>
                {/* Tarjeta de matrícula */}
                <div style={{background:'linear-gradient(135deg,#0F2B5B,#1e4080)',borderRadius:14,padding:20,color:'#fff',marginBottom:14,position:'relative',overflow:'hidden'}}>
                  <div style={{position:'absolute',top:-30,right:-30,width:120,height:120,borderRadius:'50%',background:'rgba(255,209,0,.08)'}}/>
                  <div style={{position:'absolute',bottom:-20,left:-20,width:80,height:80,borderRadius:'50%',background:'rgba(255,255,255,.04)'}}/>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
                    <div style={{width:40,height:40,background:'#FFD100',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <i className="ti ti-school" style={{fontSize:20,color:'#0F2B5B'}}/>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:9,color:'rgba(255,255,255,.5)',textTransform:'uppercase',letterSpacing:'.5px'}}>Nº de Matrícula</div>
                      <div style={{fontSize:14,fontWeight:700,color:'#FFD100',fontFamily:'monospace'}}>{form.numero_matricula}</div>
                    </div>
                  </div>
                  <div style={{fontSize:16,fontWeight:700,marginBottom:3}}>
                    {selectedEst?`${selectedEst.apellidos}, ${selectedEst.nombres}`:'—'}
                  </div>
                  <div style={{fontSize:11,color:'rgba(255,255,255,.6)',marginBottom:16}}>
                    Cédula: {selectedEst?.cedula||'—'}
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,paddingTop:14,borderTop:'0.5px solid rgba(255,255,255,.15)'}}>
                    {[
                      {l:'Curso',v:selectedCurso?`${selectedCurso.grado} "${selectedCurso.paralelo}"`: '—'},
                      {l:'Año lectivo',v:form.anio_lectivo},
                      {l:'Fecha',v:form.fecha_matricula},
                      {l:'Jornada',v:form.jornada},
                      {l:'Estado',v:form.estado},
                      {l:'Nivel',v:selectedCurso?.nivel||'—'},
                    ].map((it,i)=>(
                      <div key={i}>
                        <div style={{fontSize:9,color:'rgba(255,255,255,.5)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:2}}>{it.l}</div>
                        <div style={{fontSize:12,fontWeight:500}}>{it.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{fontSize:12,color:'#6B7280',background:'rgba(15,43,91,.04)',borderRadius:8,padding:'10px 14px',border:'0.5px solid rgba(15,43,91,.12)'}}>
                  <i className="ti ti-info-circle" style={{fontSize:13,marginRight:5,verticalAlign:'-1px',color:'#0F2B5B'}}/>
                  Al confirmar se creará la matrícula y se asociará el estudiante al curso en <strong>curso_estudiantes</strong>.
                </div>
              </>
            )}

            {/* Nav */}
            <div style={{display:'flex',gap:8,justifyContent:'space-between',marginTop:18}}>
              <button onClick={()=>step===0?setTab('lista'):back()}
                style={{height:34,padding:'0 16px',border:'0.5px solid #E5E7EB',borderRadius:7,background:'#fff',fontSize:12,cursor:'pointer',display:'flex',alignItems:'center',gap:5}}>
                <i className="ti ti-arrow-left" style={{fontSize:13}}/>{step===0?'Cancelar':'Atrás'}
              </button>
              {step<3?(
                <button onClick={next}
                  style={{height:34,padding:'0 18px',background:'#0F2B5B',border:'none',borderRadius:7,color:'#fff',fontSize:12,fontWeight:500,cursor:'pointer',display:'flex',alignItems:'center',gap:5}}>
                  Siguiente<i className="ti ti-arrow-right" style={{fontSize:13}}/>
                </button>
              ):(
                <button onClick={handleSave} disabled={saving}
                  style={{height:34,padding:'0 20px',background:saving?'#6B7280':'#16A34A',border:'none',borderRadius:7,color:'#fff',fontSize:12,fontWeight:500,cursor:saving?'not-allowed':'pointer',display:'flex',alignItems:'center',gap:5}}>
                  <i className={`ti ti-${saving?'loader':'device-floppy'}`} style={{fontSize:13}}/>{saving?'Guardando…':'Registrar matrícula'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
