import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const DIAS = ['Lunes','Martes','Miércoles','Jueves','Viernes']
const HORAS = ['07:00','07:45','08:30','09:15','10:00','10:45','11:30','12:15','13:00']
const COLORES = ['#0F2B5B','#16A34A','#534AB7','#D97706','#0891B2','#DC2626','#7C3AED','#065F46']
const JORNADAS = ['Matutina','Vespertina','Nocturna']

export default function Horarios() {
  const [cursos,   setCursos]   = useState([])
  const [materias, setMaterias] = useState([])
  const [docentes, setDocentes] = useState([])
  const [horario,  setHorario]  = useState([]) // registros de la tabla horarios
  const [loading,  setLoading]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [alert,    setAlert]    = useState(null)
  const [tab,      setTab]      = useState('grilla') // grilla | lista | nuevo
  const [sel,      setSel]      = useState({ curso:'', anio:'2025-2026' })
  const [form, setForm] = useState({
    dia:'Lunes', hora_inicio:'07:00', hora_fin:'07:45',
    materia_id:'', docente_id:'', aula:'', jornada:'Matutina'
  })

  useEffect(()=>{ loadBase() },[])
  useEffect(()=>{ if(sel.curso){ loadHorario(); loadMaterias() } },[sel.curso])

  const loadBase = async () => {
    const [{ data:c },{ data:d }] = await Promise.all([
      supabase.from('cursos').select('id,nombre,grado,paralelo,nivel').eq('activo',true).order('grado'),
      supabase.from('docentes').select('id,apellidos,nombres').eq('activo',true).order('apellidos').limit(200)
    ])
    setCursos(c||[]); setDocentes(d||[])
    if (c?.length) setSel(s=>({...s,curso:c[0].id}))
  }

  const loadMaterias = async () => {
    const { data } = await supabase.from('materias')
      .select('id,nombre,codigo').eq('curso_id',sel.curso).eq('activo',true).order('nombre')
    setMaterias(data||[])
  }

  const loadHorario = async () => {
    setLoading(true)
    const { data } = await supabase.from('horarios')
      .select('*, materias(nombre,codigo), docentes(apellidos,nombres)')
      .eq('curso_id',sel.curso).order('dia').order('hora_inicio')
    setHorario(data||[])
    setLoading(false)
  }

  const msg = (type,text) => { setAlert({type,text}); setTimeout(()=>setAlert(null),5000) }

  const handleSave = async () => {
    if (!sel.curso) return msg('error','Selecciona un curso')
    if (!form.materia_id) return msg('error','Selecciona una materia')
    setSaving(true)
    const { error } = await supabase.from('horarios').insert({
      curso_id:    sel.curso,
      anio_lectivo:sel.anio,
      dia:         form.dia,
      hora_inicio: form.hora_inicio,
      hora_fin:    form.hora_fin,
      materia_id:  form.materia_id,
      docente_id:  form.docente_id||null,
      aula:        form.aula||null,
      jornada:     form.jornada
    })
    setSaving(false)
    if (error) return msg('error', error.message)
    msg('ok','✅ Bloque agregado al horario')
    setForm(f=>({...f,materia_id:'',docente_id:'',aula:''}))
    loadHorario()
    setTab('grilla')
  }

  const deleteBloque = async (id) => {
    await supabase.from('horarios').delete().eq('id',id)
    loadHorario()
  }

  // Construir grilla: para cada hora x día, buscar el bloque
  const getBloque = (dia, hora) =>
    horario.find(h => h.dia===dia && h.hora_inicio===hora)

  const colorForMateria = (nombre) => {
    if (!nombre) return '#9CA3AF'
    const idx = materias.findIndex(m=>m.nombre===nombre)
    return COLORES[((idx>=0?idx:0)) % COLORES.length]
  }

  const cursoSel = cursos.find(c=>c.id===sel.curso)

  return (
    <div>
      {/* Selector */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:10,marginBottom:14,alignItems:'end'}}>
        <div>
          <div style={{fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:4}}>Curso</div>
          <select value={sel.curso} onChange={e=>setSel(s=>({...s,curso:e.target.value}))}
            style={{width:'100%',height:34,border:'0.5px solid #E5E7EB',borderRadius:7,padding:'0 8px',fontSize:12,background:'#fff'}}>
            <option value="">Seleccionar…</option>
            {cursos.map(c=><option key={c.id} value={c.id}>{c.grado} "{c.paralelo}" — {c.nivel}</option>)}
          </select>
        </div>
        <div>
          <div style={{fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:4}}>Año lectivo</div>
          <select value={sel.anio} onChange={e=>setSel(s=>({...s,anio:e.target.value}))}
            style={{width:'100%',height:34,border:'0.5px solid #E5E7EB',borderRadius:7,padding:'0 8px',fontSize:12,background:'#fff'}}>
            <option>2025-2026</option><option>2024-2025</option>
          </select>
        </div>
        <button onClick={()=>setTab('nuevo')}
          style={{height:34,padding:'0 14px',background:'#0F2B5B',border:'none',borderRadius:7,color:'#fff',fontSize:12,cursor:'pointer',display:'flex',alignItems:'center',gap:4,marginTop:14}}>
          <i className="ti ti-plus" style={{fontSize:13}}/>Agregar bloque
        </button>
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
        {[['grilla','Grilla semanal'],['lista','Lista de bloques'],['nuevo','+ Agregar bloque']].map(([id,lbl])=>(
          <button key={id} onClick={()=>setTab(id)}
            style={{padding:'5px 14px',borderRadius:5,border:'none',fontSize:11,cursor:'pointer',
              background:tab===id?'#fff':'transparent',color:tab===id?'#0F2B5B':'#6B7280',
              fontWeight:tab===id?600:500,boxShadow:tab===id?'0 1px 2px rgba(0,0,0,.07)':'none'}}>{lbl}</button>
        ))}
      </div>

      {/* GRILLA */}
      {tab==='grilla'&&(
        <div style={{background:'#fff',border:'0.5px solid #E5E7EB',borderRadius:12,overflow:'hidden'}}>
          <div style={{padding:'12px 16px',borderBottom:'0.5px solid #F3F4F6'}}>
            <span style={{fontSize:12,fontWeight:600,color:'#0F2B5B'}}>
              {cursoSel?`Horario — ${cursoSel.grado} "${cursoSel.paralelo}" · ${cursoSel.nivel}`:'Selecciona un curso'}
            </span>
            <div style={{fontSize:10,color:'#9CA3AF',marginTop:2}}>{horario.length} bloques registrados · {sel.anio}</div>
          </div>
          {loading?(
            <div style={{padding:28,textAlign:'center',color:'#9CA3AF',fontSize:12}}>Cargando horario…</div>
          ):(
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',minWidth:600}}>
                <thead>
                  <tr>
                    <th style={{padding:'8px 12px',fontSize:10,fontWeight:600,color:'#9CA3AF',textAlign:'center',borderBottom:'0.5px solid #F3F4F6',background:'#F9FAFB',width:80}}>HORA</th>
                    {DIAS.map(d=>(
                      <th key={d} style={{padding:'8px 12px',fontSize:10,fontWeight:600,color:'#0F2B5B',textAlign:'center',borderBottom:'0.5px solid #F3F4F6',background:'#F9FAFB',textTransform:'uppercase',letterSpacing:'.5px'}}>{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {HORAS.slice(0,-1).map((hora,hi)=>(
                    <tr key={hora}>
                      <td style={{padding:'4px 8px',textAlign:'center',fontSize:10,fontWeight:600,color:'#9CA3AF',borderRight:'0.5px solid #F3F4F6',borderBottom:'0.5px solid #F9FAFB',background:'#FAFAFA',verticalAlign:'middle'}}>
                        {hora}<br/><span style={{fontSize:9,color:'#D1D5DB'}}>–{HORAS[hi+1]}</span>
                      </td>
                      {DIAS.map(dia=>{
                        const b = getBloque(dia, hora)
                        const color = b ? colorForMateria(b.materias?.nombre) : '#9CA3AF'
                        return(
                          <td key={dia} style={{padding:3,border:'0.5px solid #F3F4F6',height:54,verticalAlign:'top'}}>
                            {b?(
                              <div style={{height:'100%',padding:'5px 7px',borderRadius:5,background:`${color}12`,borderLeft:`3px solid ${color}`,cursor:'default'}}>
                                <div style={{fontSize:11,fontWeight:600,color,lineHeight:1.2}}>{b.materias?.nombre}</div>
                                <div style={{fontSize:9,color:'#6B7280',marginTop:2}}>{b.docentes?`${b.docentes.apellidos.split(' ')[0]}`:''}{b.aula?' · '+b.aula:''}</div>
                              </div>
                            ):(
                              <div style={{height:'100%',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',borderRadius:5,opacity:.3,transition:'opacity .15s'}}
                                onClick={()=>{setTab('nuevo');setForm(f=>({...f,dia,hora_inicio:hora,hora_fin:HORAS[hi+1]}))}}
                                onMouseOver={e=>e.currentTarget.style.opacity='.7'}
                                onMouseOut={e=>e.currentTarget.style.opacity='.3'}>
                                <i className="ti ti-plus" style={{fontSize:14,color:'#9CA3AF'}}/>
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {horario.length===0&&!loading&&(
            <div style={{padding:20,textAlign:'center',color:'#9CA3AF',fontSize:12,borderTop:'0.5px solid #F3F4F6'}}>
              Sin bloques en el horario. Haz clic en cualquier celda o usa "+ Agregar bloque".
            </div>
          )}
        </div>
      )}

      {/* LISTA */}
      {tab==='lista'&&(
        <div style={{background:'#fff',border:'0.5px solid #E5E7EB',borderRadius:12,overflow:'hidden'}}>
          <div style={{padding:'12px 16px',borderBottom:'0.5px solid #F3F4F6'}}>
            <span style={{fontSize:12,fontWeight:600,color:'#0F2B5B'}}>{horario.length} bloques registrados</span>
          </div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr>
                {['Materia','Día','Inicio','Fin','Docente','Aula','Jornada','Acción'].map(h=>(
                  <th key={h} style={{textAlign:'left',padding:'0 12px 8px',fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',borderBottom:'0.5px solid #F3F4F6'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {horario.length===0?(
                  <tr><td colSpan={8} style={{textAlign:'center',padding:24,color:'#9CA3AF'}}>Sin bloques registrados</td></tr>
                ):horario.map(b=>(
                  <tr key={b.id} style={{borderBottom:'0.5px solid #F9FAFB'}}>
                    <td style={{padding:'8px 12px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <div style={{width:8,height:8,borderRadius:'50%',background:colorForMateria(b.materias?.nombre),flexShrink:0}}/>
                        <span style={{fontWeight:500}}>{b.materias?.nombre||'—'}</span>
                      </div>
                    </td>
                    <td style={{padding:'8px 12px'}}><span style={{fontSize:10,padding:'2px 7px',borderRadius:9,background:'rgba(15,43,91,.08)',color:'#0F2B5B',fontWeight:500}}>{b.dia}</span></td>
                    <td style={{padding:'8px 12px',fontFamily:'monospace',fontSize:11}}>{b.hora_inicio}</td>
                    <td style={{padding:'8px 12px',fontFamily:'monospace',fontSize:11}}>{b.hora_fin}</td>
                    <td style={{padding:'8px 12px',color:'#6B7280',fontSize:11}}>{b.docentes?`${b.docentes.apellidos}, ${b.docentes.nombres}`:'—'}</td>
                    <td style={{padding:'8px 12px',color:'#6B7280'}}>{b.aula||'—'}</td>
                    <td style={{padding:'8px 12px',color:'#6B7280'}}>{b.jornada||'—'}</td>
                    <td style={{padding:'8px 12px'}}>
                      <button onClick={()=>deleteBloque(b.id)}
                        style={{width:26,height:26,borderRadius:5,border:'0.5px solid rgba(220,38,38,.2)',background:'rgba(220,38,38,.06)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#DC2626'}}>
                        <i className="ti ti-trash" style={{fontSize:12}}/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* NUEVO */}
      {tab==='nuevo'&&(
        <div style={{background:'#fff',border:'0.5px solid #E5E7EB',borderRadius:12,padding:20}}>
          <div style={{fontSize:12,fontWeight:600,color:'#0F2B5B',marginBottom:16,display:'flex',alignItems:'center',gap:5}}>
            <i className="ti ti-plus"/>Agregar bloque al horario
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:14}}>
            {[
              {lbl:'Materia',id:'materia_id',type:'select',opts:[{v:'',l:'Seleccionar…'},...materias.map(m=>({v:m.id,l:m.nombre}))]},
              {lbl:'Docente',id:'docente_id',type:'select',opts:[{v:'',l:'Sin asignar'},...docentes.map(d=>({v:d.id,l:`${d.apellidos}, ${d.nombres}`}))]},
              {lbl:'Día',id:'dia',type:'select',opts:DIAS.map(d=>({v:d,l:d}))},
              {lbl:'Hora inicio',id:'hora_inicio',type:'select',opts:HORAS.slice(0,-1).map(h=>({v:h,l:h}))},
              {lbl:'Hora fin',id:'hora_fin',type:'select',opts:HORAS.slice(1).map(h=>({v:h,l:h}))},
              {lbl:'Jornada',id:'jornada',type:'select',opts:JORNADAS.map(j=>({v:j,l:j}))},
              {lbl:'Aula',id:'aula',ph:'Ej: A-101, Lab-C'},
            ].map(f=>(
              <div key={f.id}>
                <div style={{fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:4}}>{f.lbl}</div>
                {f.type==='select'?(
                  <select value={form[f.id]} onChange={e=>setForm({...form,[f.id]:e.target.value})}
                    style={{width:'100%',height:32,border:'0.5px solid #E5E7EB',borderRadius:6,padding:'0 8px',fontSize:12,background:'#F9FAFB',boxSizing:'border-box'}}>
                    {f.opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                ):(
                  <input value={form[f.id]} onChange={e=>setForm({...form,[f.id]:e.target.value})} placeholder={f.ph}
                    style={{width:'100%',height:32,border:'0.5px solid #E5E7EB',borderRadius:6,padding:'0 8px',fontSize:12,background:'#F9FAFB',boxSizing:'border-box'}}/>
                )}
              </div>
            ))}
          </div>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
            <button onClick={()=>setTab('grilla')} style={{height:32,padding:'0 14px',border:'0.5px solid #E5E7EB',borderRadius:6,background:'#fff',fontSize:12,cursor:'pointer'}}>Cancelar</button>
            <button onClick={handleSave} disabled={saving||!sel.curso}
              style={{height:32,padding:'0 16px',background:saving?'#6B7280':'#0F2B5B',border:'none',borderRadius:6,color:'#fff',fontSize:12,cursor:saving?'not-allowed':'pointer',display:'flex',alignItems:'center',gap:4}}>
              <i className={`ti ti-${saving?'loader':'plus'}`} style={{fontSize:13}}/>{saving?'Guardando…':'Agregar bloque'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
