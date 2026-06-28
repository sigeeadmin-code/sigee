import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const PERIODOS_TIPO = ['1er Quimestre','2do Quimestre','Supletorio','Remedial','Gracia','Anual']
const ESCALA = [
  {min:9,   max:10, lbl:'Excelente',  code:'DA', c:'#15803d', bg:'rgba(22,163,74,.1)'},
  {min:8,   max:8.99,lbl:'Muy Bueno', code:'AA', c:'#0F2B5B', bg:'rgba(15,43,91,.08)'},
  {min:7,   max:7.99,lbl:'Bueno',     code:'AA', c:'#0891B2', bg:'rgba(8,145,178,.08)'},
  {min:5,   max:6.99,lbl:'Regular',   code:'PA', c:'#D97706', bg:'rgba(217,119,6,.1)'},
  {min:0,   max:4.99,lbl:'Insuficiente',code:'NA',c:'#DC2626',bg:'rgba(220,38,38,.08)'},
]
function getEscala(n){ return ESCALA.find(e=>n>=e.min&&n<=e.max)||ESCALA[4] }
function calcProm(p1,p2,ex){
  const a=parseFloat(p1),b=parseFloat(p2),c=parseFloat(ex)
  if(isNaN(a)||isNaN(b)||isNaN(c)) return null
  return Math.round((a+b+c)/3*100)/100
}

export default function Calificaciones() {
  const [cursos,    setCursos]    = useState([])
  const [materias,  setMaterias]  = useState([])
  const [periodos,  setPeriodos]  = useState([])
  const [matriculas,setMatriculas]= useState([])
  const [califs,    setCalifs]    = useState([])
  const [loading,   setLoading]   = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [alert,     setAlert]     = useState(null)
  const [tab,       setTab]       = useState('ingreso') // ingreso | resumen | escala
  const [sel, setSel] = useState({ curso:'', materia:'', periodo:'', anio:'2025-2026' })
  const [notas, setNotas] = useState({}) // {matricula_id: {p1,p2,ex,obs}}

  useEffect(()=>{ loadBase() },[])
  useEffect(()=>{ if(sel.curso) loadMaterias(sel.curso) },[sel.curso])
  useEffect(()=>{ if(sel.curso&&sel.materia&&sel.periodo) loadCalifs() },[sel.curso,sel.materia,sel.periodo])

  const loadBase = async () => {
    const [{ data:c },{ data:p }] = await Promise.all([
      supabase.from('cursos').select('id,nombre,grado,paralelo,nivel').eq('activo',true).order('grado'),
      supabase.from('periodos_academicos').select('id,periodo,anio_lectivo,abierto').order('created_at',{ascending:false})
    ])
    setCursos(c||[])
    setPeriodos(p||[])
    if(c?.length) setSel(s=>({...s,curso:c[0].id}))
    if(p?.length) setSel(s=>({...s,periodo:p[0].id}))
  }

  const loadMaterias = async (cid) => {
    const { data } = await supabase.from('materias')
      .select('id,nombre,codigo').eq('curso_id',cid).eq('activo',true).order('nombre')
    setMaterias(data||[])
    if(data?.length) setSel(s=>({...s,materia:data[0].id}))
  }

  const loadCalifs = async () => {
    setLoading(true)
    // Cargar matrículas del curso
    const { data:mats } = await supabase.from('matriculas')
      .select('id, estudiantes(id,apellidos,nombres,cedula)')
      .eq('curso_id',sel.curso).eq('estado','Activa').order('estudiantes(apellidos)')
    setMatriculas(mats||[])
    // Cargar calificaciones existentes
    if(sel.materia && sel.periodo) {
      const { data:ca } = await supabase.from('calificaciones')
        .select('*')
        .eq('materia_id',sel.materia)
        .eq('periodo_id',sel.periodo)
      const map = {}
      ;(ca||[]).forEach(c=>{ map[c.matricula_id]={p1:c.parcial1??'',p2:c.parcial2??'',ex:c.examen??'',obs:c.observaciones??'',id:c.id} })
      setNotas(map)
    }
    setLoading(false)
  }

  const updateNota = (mid,field,val) => {
    const num = parseFloat(val)
    if(val!==''&&(isNaN(num)||num<0||num>10)) return
    setNotas(n=>({...n,[mid]:{...n[mid],[field]:val}}))
  }

  const markAll = (estado) => {
    const newN = {}
    matriculas.forEach(m=>{ newN[m.id]={...(notas[m.id]||{})} })
    if(estado==='presente') matriculas.forEach(m=>{ newN[m.id]={...newN[m.id],p1:'10',p2:'10',ex:'10'} })
    setNotas(newN)
  }

  const handleSave = async () => {
    const periodoObj = periodos.find(p=>p.id===sel.periodo)
    setSaving(true)
    const rows = matriculas.map(m=>{
      const n = notas[m.id]||{}
      const prom = calcProm(n.p1,n.p2,n.ex)
      return {
        matricula_id: m.id,
        materia_id: sel.materia,
        periodo_id: sel.periodo,
        anio_lectivo: sel.anio,
        periodo: periodoObj?.periodo||'',
        parcial1: n.p1!==''?parseFloat(n.p1):null,
        parcial2: n.p2!==''?parseFloat(n.p2):null,
        examen:   n.ex!==''?parseFloat(n.ex):null,
        promedio: prom,
        estado: 'Registrada',
        observaciones: n.obs||null
      }
    }).filter(r=>r.parcial1!==null||r.parcial2!==null||r.examen!==null)

    if(!rows.length) { setSaving(false); return setAlert({type:'warn',msg:'Ingresa al menos una nota antes de guardar.'}) }

    // Upsert — actualizar si existe, insertar si no
    const { error } = await supabase.from('calificaciones').upsert(rows, {
      onConflict: 'matricula_id,materia_id,periodo',
      ignoreDuplicates: false
    })
    setSaving(false)
    if(error) return setAlert({type:'error',msg:error.message})
    setAlert({type:'ok',msg:`✅ ${rows.length} calificaciones guardadas correctamente`})
    setTimeout(()=>setAlert(null),5000)
    loadCalifs()
  }

  const promedios = matriculas.map(m=>{
    const n=notas[m.id]||{}
    return { ...m, prom:calcProm(n.p1,n.p2,n.ex) }
  })
  const aprobados   = promedios.filter(x=>x.prom!==null&&x.prom>=7).length
  const reprobados  = promedios.filter(x=>x.prom!==null&&x.prom<7).length
  const promCurso   = promedios.filter(x=>x.prom!==null).length
    ? Math.round(promedios.filter(x=>x.prom!==null).reduce((s,x)=>s+x.prom,0)/promedios.filter(x=>x.prom!==null).length*100)/100
    : null

  const cursoSel  = cursos.find(c=>c.id===sel.curso)
  const periodoSel= periodos.find(p=>p.id===sel.periodo)
  const materiaSel= materias.find(m=>m.id===sel.materia)

  return (
    <div>
      {/* Contexto */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
        {[
          {lbl:'Curso',id:'curso',opts:cursos.map(c=>({v:c.id,l:`${c.grado} "${c.paralelo}" — ${c.nivel}`}))},
          {lbl:'Período',id:'periodo',opts:periodos.map(p=>({v:p.id,l:`${p.periodo} ${p.anio_lectivo}${p.abierto?' 🟢':' ⚪'}`}))},
          {lbl:'Materia',id:'materia',opts:materias.map(m=>({v:m.id,l:m.nombre}))},
          {lbl:'Año lectivo',id:'anio',opts:[{v:'2025-2026',l:'2025-2026'},{v:'2024-2025',l:'2024-2025'}]},
        ].map(f=>(
          <div key={f.id}>
            <div style={{fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:4}}>{f.lbl}</div>
            <select value={sel[f.id]} onChange={e=>setSel(s=>({...s,[f.id]:e.target.value}))}
              style={{width:'100%',height:34,border:'0.5px solid #E5E7EB',borderRadius:7,padding:'0 8px',fontSize:12,background:'#fff'}}>
              <option value="">Seleccionar…</option>
              {f.opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
        ))}
      </div>

      {alert&&(
        <div style={{borderRadius:8,padding:'10px 14px',fontSize:12,display:'flex',alignItems:'center',gap:7,marginBottom:12,
          background:alert.type==='ok'?'rgba(22,163,74,.08)':alert.type==='warn'?'rgba(217,119,6,.08)':'rgba(220,38,38,.06)',
          border:`0.5px solid ${alert.type==='ok'?'rgba(22,163,74,.25)':alert.type==='warn'?'rgba(217,119,6,.2)':'rgba(220,38,38,.2)'}`,
          color:alert.type==='ok'?'#15803d':alert.type==='warn'?'#D97706':'#B91C1C'}}>
          <i className={`ti ti-${alert.type==='ok'?'circle-check':alert.type==='warn'?'alert-triangle':'alert-circle'}`} style={{fontSize:14}}/>{alert.msg}
        </div>
      )}

      {/* Tabs */}
      <div style={{display:'flex',gap:3,background:'#F3F4F6',padding:3,borderRadius:8,width:'fit-content',marginBottom:14}}>
        {[['ingreso','📝 Pase de notas'],['resumen','📊 Resumen'],['escala','📏 Escala MINEDUC']].map(([id,lbl])=>(
          <button key={id} onClick={()=>setTab(id)}
            style={{padding:'5px 14px',borderRadius:5,border:'none',fontSize:11,cursor:'pointer',
              background:tab===id?'#fff':'transparent',color:tab===id?'#0F2B5B':'#6B7280',
              fontWeight:tab===id?600:500,boxShadow:tab===id?'0 1px 2px rgba(0,0,0,.07)':'none'}}>{lbl}</button>
        ))}
      </div>

      {/* INGRESO */}
      {tab==='ingreso'&&(
        <div style={{background:'#fff',border:'0.5px solid #E5E7EB',borderRadius:12,overflow:'hidden'}}>
          <div style={{padding:'12px 16px',borderBottom:'0.5px solid #F3F4F6',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
            <div>
              <span style={{fontSize:12,fontWeight:600,color:'#0F2B5B'}}>
                {cursoSel?`${cursoSel.grado} "${cursoSel.paralelo}"`:''} · {materiaSel?.nombre||''} · {periodoSel?.periodo||''}
              </span>
              <div style={{fontSize:10,color:'#9CA3AF',marginTop:2}}>Escala 0–10 · Aprobado ≥ 7 · Fórmula: (P1 + P2 + Examen) ÷ 3 · Art. 185 LOEI</div>
            </div>
            <div style={{display:'flex',gap:6,alignItems:'center'}}>
              <span style={{fontSize:10,background:'rgba(15,43,91,.06)',color:'#0F2B5B',padding:'3px 8px',borderRadius:5,border:'0.5px solid rgba(15,43,91,.15)'}}>
                {aprobados} aprobados · {reprobados} reprobados
              </span>
              <button onClick={handleSave} disabled={saving||!sel.curso||!sel.materia||!sel.periodo}
                style={{height:30,padding:'0 14px',background:saving?'#6B7280':'#0F2B5B',border:'none',borderRadius:6,color:'#fff',fontSize:11,cursor:saving?'not-allowed':'pointer',display:'flex',alignItems:'center',gap:4}}>
                <i className={`ti ti-${saving?'loader':'device-floppy'}`} style={{fontSize:12}}/>{saving?'Guardando…':'Guardar notas'}
              </button>
            </div>
          </div>

          {!sel.curso||!sel.materia||!sel.periodo?(
            <div style={{padding:32,textAlign:'center',color:'#9CA3AF',fontSize:12}}>
              <i className="ti ti-chart-line" style={{fontSize:36,color:'#D1D5DB',display:'block',marginBottom:10}}/>
              Selecciona curso, período y materia para cargar la nómina
            </div>
          ):loading?(
            <div style={{padding:28,textAlign:'center',color:'#9CA3AF',fontSize:12}}>Cargando nómina…</div>
          ):matriculas.length===0?(
            <div style={{padding:32,textAlign:'center',color:'#9CA3AF',fontSize:12}}>
              <i className="ti ti-school" style={{fontSize:32,color:'#D1D5DB',display:'block',marginBottom:8}}/>
              Sin matrículas activas en este curso. Registra matrículas primero.
            </div>
          ):(
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead>
                  <tr style={{background:'#F9FAFB'}}>
                    <th style={{textAlign:'left',padding:'8px 12px',fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',borderBottom:'0.5px solid #F3F4F6',width:36}}>#</th>
                    <th style={{textAlign:'left',padding:'8px 12px',fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',borderBottom:'0.5px solid #F3F4F6'}}>Estudiante</th>
                    <th style={{textAlign:'center',padding:'8px 12px',fontSize:10,fontWeight:600,color:'#0F2B5B',textTransform:'uppercase',letterSpacing:'.4px',borderBottom:'0.5px solid #F3F4F6'}}>Parcial 1<br/><span style={{fontSize:9,fontWeight:400,color:'#9CA3AF'}}>/10</span></th>
                    <th style={{textAlign:'center',padding:'8px 12px',fontSize:10,fontWeight:600,color:'#0F2B5B',textTransform:'uppercase',letterSpacing:'.4px',borderBottom:'0.5px solid #F3F4F6'}}>Parcial 2<br/><span style={{fontSize:9,fontWeight:400,color:'#9CA3AF'}}>/10</span></th>
                    <th style={{textAlign:'center',padding:'8px 12px',fontSize:10,fontWeight:600,color:'#0F2B5B',textTransform:'uppercase',letterSpacing:'.4px',borderBottom:'0.5px solid #F3F4F6'}}>Examen<br/><span style={{fontSize:9,fontWeight:400,color:'#9CA3AF'}}>/10</span></th>
                    <th style={{textAlign:'center',padding:'8px 12px',fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',borderBottom:'0.5px solid #F3F4F6'}}>Promedio</th>
                    <th style={{textAlign:'left',padding:'8px 12px',fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',borderBottom:'0.5px solid #F3F4F6'}}>Observación</th>
                  </tr>
                </thead>
                <tbody>
                  {matriculas.map((m,i)=>{
                    const n=notas[m.id]||{}
                    const prom=calcProm(n.p1,n.p2,n.ex)
                    const esc=prom!==null?getEscala(prom):null
                    const est=m.estudiantes
                    return(
                      <tr key={m.id} style={{borderBottom:'0.5px solid #F9FAFB'}}>
                        <td style={{padding:'8px 12px',fontSize:10,color:'#9CA3AF'}}>{i+1}</td>
                        <td style={{padding:'8px 12px'}}>
                          <div style={{fontWeight:500,fontSize:12}}>{est?.apellidos}, {est?.nombres}</div>
                          <div style={{fontSize:10,color:'#9CA3AF',fontFamily:'monospace'}}>{est?.cedula||''}</div>
                        </td>
                        {['p1','p2','ex'].map(field=>(
                          <td key={field} style={{padding:'6px 8px',textAlign:'center'}}>
                            <input
                              type="number" min="0" max="10" step="0.01"
                              value={n[field]??''}
                              onChange={e=>updateNota(m.id,field,e.target.value)}
                              placeholder="—"
                              style={{width:64,height:30,border:`0.5px solid ${n[field]!==''&&n[field]!==undefined?(parseFloat(n[field])>=7?'rgba(22,163,74,.4)':'rgba(220,38,38,.4)'):'#E5E7EB'}`,
                                borderRadius:6,textAlign:'center',fontSize:13,fontWeight:600,
                                background:n[field]!==''&&n[field]!==undefined?(parseFloat(n[field])>=7?'rgba(22,163,74,.05)':'rgba(220,38,38,.04)'):'#F9FAFB',
                                color:n[field]!==''&&n[field]!==undefined?(parseFloat(n[field])>=7?'#15803d':'#DC2626'):'#374151'}}
                            />
                          </td>
                        ))}
                        <td style={{padding:'8px',textAlign:'center'}}>
                          {prom!==null?(
                            <span style={{fontSize:14,fontWeight:700,padding:'3px 10px',borderRadius:7,background:esc?.bg,color:esc?.c}}>
                              {prom.toFixed(2)}
                            </span>
                          ):<span style={{fontSize:11,color:'#D1D5DB'}}>—</span>}
                        </td>
                        <td style={{padding:'6px 8px'}}>
                          <input value={n.obs||''} onChange={e=>updateNota(m.id,'obs',e.target.value)}
                            placeholder="Observación…"
                            style={{width:'100%',height:28,border:'0.5px solid #E5E7EB',borderRadius:5,padding:'0 8px',fontSize:11,background:'#F9FAFB',color:'#6B7280'}}/>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div style={{padding:'12px 16px',borderTop:'0.5px solid #F3F4F6',display:'flex',justifyContent:'flex-end',gap:8}}>
                <button onClick={()=>setNotas({})} style={{height:30,padding:'0 12px',border:'0.5px solid #E5E7EB',borderRadius:6,background:'#fff',fontSize:11,cursor:'pointer'}}>
                  <i className="ti ti-eraser" style={{fontSize:12,marginRight:4}}/>Limpiar
                </button>
                <button onClick={handleSave} disabled={saving}
                  style={{height:30,padding:'0 14px',background:saving?'#6B7280':'#0F2B5B',border:'none',borderRadius:6,color:'#fff',fontSize:11,cursor:saving?'not-allowed':'pointer',display:'flex',alignItems:'center',gap:4}}>
                  <i className={`ti ti-${saving?'loader':'device-floppy'}`} style={{fontSize:12}}/>{saving?'Guardando…':'Guardar calificaciones'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* RESUMEN */}
      {tab==='resumen'&&(
        <div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
            {[
              {val:matriculas.length,  lbl:'Total estudiantes', c:'#0F2B5B'},
              {val:aprobados,          lbl:'Aprobados ≥ 7',     c:'#16A34A'},
              {val:reprobados,         lbl:'Reprobados < 7',    c:'#DC2626'},
              {val:promCurso?.toFixed(2)||'—', lbl:'Promedio del curso', c:'#534AB7'},
            ].map((s,i)=>(
              <div key={i} style={{background:'#F9FAFB',borderRadius:10,padding:12,border:'0.5px solid #E5E7EB',textAlign:'center'}}>
                <div style={{fontSize:22,fontWeight:700,color:s.c}}>{s.val}</div>
                <div style={{fontSize:10,color:'#9CA3AF',marginTop:2}}>{s.lbl}</div>
              </div>
            ))}
          </div>

          {/* Distribución por rango */}
          <div style={{background:'#fff',border:'0.5px solid #E5E7EB',borderRadius:12,padding:16,marginBottom:14}}>
            <div style={{fontSize:12,fontWeight:600,color:'#0F2B5B',marginBottom:12}}>Distribución por rango</div>
            <div style={{display:'flex',alignItems:'flex-end',gap:8,height:100}}>
              {ESCALA.map((e,i)=>{
                const cnt=promedios.filter(x=>x.prom!==null&&x.prom>=e.min&&x.prom<=e.max).length
                const max=Math.max(...ESCALA.map(r=>promedios.filter(x=>x.prom!==null&&x.prom>=r.min&&x.prom<=r.max).length),1)
                return(
                  <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                    <span style={{fontSize:11,fontWeight:600,color:'#6B7280'}}>{cnt}</span>
                    <div style={{width:'100%',background:e.bg,borderRadius:'4px 4px 0 0',height:Math.max(cnt/max*80,4),border:`0.5px solid ${e.c}22`}}/>
                    <span style={{fontSize:9,color:'#9CA3AF',textAlign:'center'}}>{e.min}–{e.max}</span>
                    <span style={{fontSize:9,color:e.c,fontWeight:600}}>{e.lbl}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Tabla resumen */}
          <div style={{background:'#fff',border:'0.5px solid #E5E7EB',borderRadius:12,overflow:'hidden'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr>
                {['#','Estudiante','P1','P2','Examen','Promedio','Resultado'].map(h=>(
                  <th key={h} style={{textAlign:'left',padding:'0 12px 8px',fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',borderBottom:'0.5px solid #F3F4F6'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {promedios.map((m,i)=>{
                  const n=notas[m.id]||{}
                  const esc=m.prom!==null?getEscala(m.prom):null
                  return(
                    <tr key={m.id} style={{borderBottom:'0.5px solid #F9FAFB'}}>
                      <td style={{padding:'8px 12px',fontSize:10,color:'#9CA3AF'}}>{i+1}</td>
                      <td style={{padding:'8px 12px',fontWeight:500}}>{m.estudiantes?.apellidos}, {m.estudiantes?.nombres}</td>
                      {['p1','p2','ex'].map(f=><td key={f} style={{padding:'8px 12px',textAlign:'center',fontFamily:'monospace'}}>{n[f]||'—'}</td>)}
                      <td style={{padding:'8px 12px',textAlign:'center'}}>
                        {m.prom!==null?<span style={{fontSize:13,fontWeight:700,color:esc?.c}}>{m.prom.toFixed(2)}</span>:<span style={{color:'#D1D5DB'}}>—</span>}
                      </td>
                      <td style={{padding:'8px 12px'}}>
                        {m.prom!==null?<span style={{fontSize:10,padding:'2px 7px',borderRadius:9,fontWeight:500,background:esc?.bg,color:esc?.c}}>{m.prom>=7?'Aprobado':'Reprobado'}</span>:<span style={{color:'#D1D5DB',fontSize:11}}>Sin notas</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ESCALA */}
      {tab==='escala'&&(
        <div style={{background:'#fff',border:'0.5px solid #E5E7EB',borderRadius:12,padding:20}}>
          <div style={{fontSize:12,fontWeight:600,color:'#0F2B5B',marginBottom:14,display:'flex',alignItems:'center',gap:5}}>
            <i className="ti ti-ruler"/>Escala de valoración — Acuerdo Ministerial MINEDUC-ME-2021-00095-A
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10,marginBottom:18}}>
            {ESCALA.map((e,i)=>(
              <div key={i} style={{padding:14,borderRadius:10,background:e.bg,border:`0.5px solid ${e.c}33`,textAlign:'center'}}>
                <div style={{fontSize:18,fontWeight:800,color:e.c}}>{e.min}–{e.max}</div>
                <div style={{fontSize:12,fontWeight:600,color:e.c,marginTop:4}}>{e.lbl}</div>
                <div style={{fontSize:10,color:e.c,marginTop:2,opacity:.7}}>Código: {e.code}</div>
              </div>
            ))}
          </div>
          <div style={{background:'rgba(15,43,91,.04)',borderRadius:9,padding:'12px 16px',fontSize:12,color:'#374151',lineHeight:1.7,border:'0.5px solid rgba(15,43,91,.12)'}}>
            <div><strong style={{color:'#0F2B5B'}}>Fórmula quimestral:</strong> Promedio = (Parcial 1 + Parcial 2 + Examen) ÷ 3</div>
            <div><strong style={{color:'#0F2B5B'}}>Nota mínima de aprobación:</strong> 7.00 / 10.00</div>
            <div><strong style={{color:'#0F2B5B'}}>Escala:</strong> Números decimales de 0.00 a 10.00 con redondeo a 2 decimales</div>
            <div><strong style={{color:'#0F2B5B'}}>Períodos:</strong> 1er Quimestre · 2do Quimestre · Supletorio · Remedial · Gracia · Anual</div>
            <div><strong style={{color:'#0F2B5B'}}>DA</strong> = Domina los Aprendizajes · <strong style={{color:'#0F2B5B'}}>AA</strong> = Alcanza los Aprendizajes · <strong style={{color:'#0F2B5B'}}>PA</strong> = Próximo a Alcanzar · <strong style={{color:'#0F2B5B'}}>NA</strong> = No Alcanza</div>
          </div>
        </div>
      )}
    </div>
  )
}
