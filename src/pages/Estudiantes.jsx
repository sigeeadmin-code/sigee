import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const PROVINCIAS = ['Azuay','Bolívar','Cañar','Carchi','Chimborazo','Cotopaxi','El Oro','Esmeraldas','Galápagos','Guayas','Imbabura','Loja','Los Ríos','Manabí','Morona Santiago','Napo','Orellana','Pastaza','Pichincha','Santa Elena','Santo Domingo','Sucumbíos','Tungurahua','Zamora Chinchipe']
const GENEROS = ['Masculino','Femenino','No especificado']
const ETNIAS = ['Mestizo/a','Indígena','Afroecuatoriano/a','Montubio/a','Blanco/a','Otro']

const STEPS = ['Identificación','Representante','Domicilio','Confirmar']

function initials(ap, no) {
  return [(ap||'').split(' ')[0][0], (no||'').split(' ')[0][0]].join('').toUpperCase()
}

export default function Estudiantes() {
  const [tab, setTab]             = useState('lista')
  const [step, setStep]           = useState(0)
  const [estudiantes, setEst]     = useState([])
  const [planteles, setPlanteles] = useState([])
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [alert, setAlert]         = useState(null)
  const [search, setSearch]       = useState('')
  const [form, setForm] = useState({
    cedula:'', apellidos:'', nombres:'', fecha_nacimiento:'', genero:'No especificado',
    nacionalidad:'Ecuatoriana', etnia:'', discapacidad:false, tipo_discapacidad:'', porcentaje_discapacidad:'',
    nombre_representante:'', cedula_representante:'', telefono_representante:'', email_representante:'',
    provincia:'Pichincha', canton:'', parroquia:'', direccion:'', plantel_id:'', activo:true
  })

  useEffect(()=>{ load() },[])

  const load = async () => {
    setLoading(true)
    const [{ data:e, count }, { data:p }] = await Promise.all([
      supabase.from('estudiantes').select('*', { count:'exact' }).order('apellidos').limit(100),
      supabase.from('planteles').select('id,nombre,codigo_amie').order('nombre').limit(100)
    ])
    setEst(e||[]); setTotal(count||0); setPlanteles(p||[])
    if (p?.length && !form.plantel_id) setForm(f=>({...f,plantel_id:p[0].id}))
    setLoading(false)
  }

  const msg = (type, text) => { setAlert({type,text}); setTimeout(()=>setAlert(null),6000) }

  const validate = (s) => {
    if (s===0) {
      if (!form.apellidos.trim()) return msg('error','Apellidos requeridos')
      if (!form.nombres.trim()) return msg('error','Nombres requeridos')
      if (!form.genero) return msg('error','Género requerido')
      return true
    }
    if (s===1) {
      if (!form.nombre_representante.trim()) return msg('error','Nombre del representante requerido')
      if (!form.telefono_representante.trim()) return msg('error','Teléfono del representante requerido')
      return true
    }
    return true
  }

  const next = () => { if (validate(step)) setStep(s=>Math.min(s+1,3)) }
  const back = () => setStep(s=>Math.max(s-1,0))

  const handleSave = async () => {
    setSaving(true)
    const payload = {
      cedula: form.cedula||null,
      apellidos: form.apellidos.trim(),
      nombres: form.nombres.trim(),
      nombre_completo: `${form.apellidos.trim()} ${form.nombres.trim()}`,
      fecha_nacimiento: form.fecha_nacimiento||null,
      genero: form.genero||'No especificado',
      nacionalidad: form.nacionalidad||'Ecuatoriana',
      etnia: form.etnia||null,
      discapacidad: form.discapacidad,
      tipo_discapacidad: form.discapacidad?form.tipo_discapacidad:null,
      porcentaje_discapacidad: form.discapacidad&&form.porcentaje_discapacidad?parseFloat(form.porcentaje_discapacidad):null,
      nombre_representante: form.nombre_representante||null,
      cedula_representante: form.cedula_representante||null,
      telefono_representante: form.telefono_representante||null,
      email_representante: form.email_representante||null,
      provincia: form.provincia||null,
      canton: form.canton||null,
      parroquia: form.parroquia||null,
      direccion: form.direccion||null,
      plantel_id: form.plantel_id||null,
      activo: true
    }
    const { error } = await supabase.from('estudiantes').insert(payload)
    setSaving(false)
    if (error) {
      let m = error.message
      if (m.includes('unique') || m.includes('duplicate')) m = 'Ya existe un estudiante con esa cédula'
      return msg('error', m)
    }
    msg('ok', `✅ Estudiante "${form.apellidos}, ${form.nombres}" registrado exitosamente`)
    setForm(f=>({...f,cedula:'',apellidos:'',nombres:'',fecha_nacimiento:'',nombre_representante:'',cedula_representante:'',telefono_representante:'',email_representante:'',canton:'',parroquia:'',direccion:'',discapacidad:false}))
    setStep(0)
    setTab('lista')
    load()
  }

  const filtered = estudiantes.filter(e =>
    !search || `${e.apellidos} ${e.nombres} ${e.cedula||''}`.toLowerCase().includes(search.toLowerCase())
  )

  const Field = ({lbl,id,type='text',ph,opts,req,span}) => (
    <div style={{gridColumn:span?`span ${span}`:'auto'}}>
      <div style={{fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:4}}>
        {lbl}{req&&<span style={{color:'#DC2626'}}> *</span>}
      </div>
      {type==='select'?(
        <select value={form[id]} onChange={e=>setForm({...form,[id]:e.target.value})}
          style={{width:'100%',height:34,border:'0.5px solid #E5E7EB',borderRadius:7,padding:'0 10px',fontSize:12,background:'#F9FAFB',boxSizing:'border-box'}}>
          {opts.map(o=><option key={o.v||o} value={o.v||o}>{o.l||o}</option>)}
        </select>
      ):(
        <input type={type} value={form[id]} onChange={e=>setForm({...form,[id]:e.target.value})} placeholder={ph}
          style={{width:'100%',height:34,border:'0.5px solid #E5E7EB',borderRadius:7,padding:'0 10px',fontSize:12,background:'#F9FAFB',boxSizing:'border-box',fontFamily:type==='text'&&(id==='cedula'||id==='cedula_representante')?'monospace':'inherit'}}/>
      )}
    </div>
  )

  return (
    <div>
      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:16}}>
        {[
          {val:total,                              lbl:'Total estudiantes', ico:'ti-school',   c:'#0F2B5B'},
          {val:estudiantes.filter(e=>e.activo).length, lbl:'Activos',      ico:'ti-check',   c:'#16A34A'},
          {val:estudiantes.filter(e=>e.discapacidad).length, lbl:'Con discapacidad', ico:'ti-wheelchair', c:'#534AB7'},
          {val:planteles.length,                   lbl:'Planteles',        ico:'ti-building-community', c:'#D97706'},
        ].map((s,i)=>(
          <div key={i} style={{background:'#F9FAFB',borderRadius:10,padding:12,border:'0.5px solid #E5E7EB',position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',top:0,right:0,width:3,height:'100%',background:s.c}}/>
            <div style={{width:28,height:28,borderRadius:6,background:s.c+'22',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:6}}>
              <i className={`ti ${s.ico}`} style={{fontSize:14,color:s.c}}/>
            </div>
            <div style={{fontSize:20,fontWeight:700,color:'#1A2B4A'}}>{s.val}</div>
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
        {[['lista','Lista'],['nuevo','+ Nuevo estudiante']].map(([id,lbl])=>(
          <button key={id} onClick={()=>{setTab(id);if(id==='nuevo')setStep(0)}}
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
              <i className="ti ti-school"/>{filtered.length} de {total} estudiantes
            </span>
            <div style={{display:'flex',gap:6}}>
              <div style={{position:'relative'}}>
                <i className="ti ti-search" style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',color:'#9CA3AF',fontSize:12}}/>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nombre o cédula..."
                  style={{height:30,border:'0.5px solid #E5E7EB',borderRadius:6,padding:'0 8px 0 26px',fontSize:11,background:'#F9FAFB',width:200}}/>
              </div>
              <button onClick={()=>setTab('nuevo')}
                style={{height:30,padding:'0 12px',background:'#0F2B5B',border:'none',borderRadius:6,color:'#fff',fontSize:11,cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
                <i className="ti ti-plus" style={{fontSize:12}}/>Nuevo
              </button>
            </div>
          </div>
          {loading?(
            <div style={{padding:28,textAlign:'center',color:'#9CA3AF',fontSize:12}}>Cargando desde Supabase…</div>
          ):filtered.length===0?(
            <div style={{padding:36,textAlign:'center'}}>
              <i className="ti ti-school" style={{fontSize:40,color:'#D1D5DB',display:'block',marginBottom:10}}/>
              <p style={{fontSize:13,color:'#9CA3AF',marginBottom:14}}>Sin estudiantes registrados.<br/>Registra el primero.</p>
              <button onClick={()=>setTab('nuevo')} style={{padding:'8px 18px',background:'#0F2B5B',border:'none',borderRadius:7,color:'#fff',fontSize:12,cursor:'pointer'}}>
                Registrar primer estudiante
              </button>
            </div>
          ):(
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr>
                  {['#','Estudiante','Cédula','Género','Representante','Teléfono','Estado'].map(h=>(
                    <th key={h} style={{textAlign:'left',padding:'0 12px 8px',fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',borderBottom:'0.5px solid #F3F4F6'}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtered.map((e,i)=>(
                    <tr key={e.id} style={{borderBottom:'0.5px solid #F9FAFB'}}>
                      <td style={{padding:'9px 12px',fontSize:10,color:'#9CA3AF'}}>{i+1}</td>
                      <td style={{padding:'9px 12px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{width:30,height:30,borderRadius:'50%',background:'rgba(15,43,91,.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'#0F2B5B',flexShrink:0}}>
                            {initials(e.apellidos,e.nombres)}
                          </div>
                          <div>
                            <div style={{fontWeight:500}}>{e.apellidos}, {e.nombres}</div>
                            <div style={{fontSize:10,color:'#9CA3AF'}}>{e.fecha_nacimiento||''}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{padding:'9px 12px',fontFamily:'monospace',fontSize:11,color:'#6B7280'}}>{e.cedula||'—'}</td>
                      <td style={{padding:'9px 12px',color:'#6B7280'}}>{e.genero||'—'}</td>
                      <td style={{padding:'9px 12px',fontSize:11}}>{e.nombre_representante||'—'}</td>
                      <td style={{padding:'9px 12px',fontSize:11,color:'#6B7280'}}>{e.telefono_representante||'—'}</td>
                      <td style={{padding:'9px 12px'}}>
                        <span style={{fontSize:10,padding:'2px 7px',borderRadius:9,fontWeight:500,background:e.activo?'rgba(22,163,74,.1)':'#F3F4F6',color:e.activo?'#15803d':'#9CA3AF'}}>{e.activo?'Activo':'Inactivo'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* REGISTRO — 4 pasos */}
      {tab==='nuevo'&&(
        <div>
          {/* Steps indicator */}
          <div style={{display:'flex',gap:0,marginBottom:20}}>
            {STEPS.map((s,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',flex:1}}>
                <div style={{width:28,height:28,borderRadius:'50%',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,transition:'all .2s',
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

            {/* STEP 0 — Identificación */}
            {step===0&&(
              <>
                <div style={{fontSize:12,fontWeight:600,color:'#0F2B5B',marginBottom:16,display:'flex',alignItems:'center',gap:5}}>
                  <i className="ti ti-id-badge"/>Datos de identificación
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
                  <Field lbl="Cédula de identidad" id="cedula" ph="0000000000"/>
                  <Field lbl="Nacionalidad" id="nacionalidad" type="select" opts={['Ecuatoriana','Colombiana','Peruana','Venezolana','Otra'].map(v=>({v,l:v}))}/>
                  <Field lbl="Apellidos" id="apellidos" ph="Apellido Apellido" req/>
                  <Field lbl="Nombres" id="nombres" ph="Nombre Nombre" req/>
                  <Field lbl="Fecha de nacimiento" id="fecha_nacimiento" type="date"/>
                  <Field lbl="Género" id="genero" type="select" req opts={GENEROS.map(v=>({v,l:v}))}/>
                  <Field lbl="Autoidentificación étnica" id="etnia" type="select" opts={[{v:'',l:'Sin especificar'},...ETNIAS.map(v=>({v,l:v}))]}/>
                  <Field lbl="Plantel" id="plantel_id" type="select" opts={planteles.map(p=>({v:p.id,l:`${p.nombre} (${p.codigo_amie})`}))}/>
                </div>
                <div style={{background:'#F9FAFB',borderRadius:8,padding:'10px 14px',marginBottom:14}}>
                  <label style={{display:'flex',alignItems:'center',gap:8,fontSize:12,cursor:'pointer'}}>
                    <input type="checkbox" checked={form.discapacidad} onChange={e=>setForm({...form,discapacidad:e.target.checked})}/>
                    <span style={{fontWeight:500}}>El estudiante tiene discapacidad</span>
                  </label>
                  {form.discapacidad&&(
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:10}}>
                      <Field lbl="Tipo de discapacidad" id="tipo_discapacidad" type="select" opts={[{v:'',l:'Seleccionar...'},'Visual','Auditiva','Física/Motora','Intelectual','Psicosocial','Multidiscapacidad'].map(v=>typeof v==='string'?{v,l:v}:v)}/>
                      <Field lbl="Porcentaje (%)" id="porcentaje_discapacidad" type="number" ph="0-100"/>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* STEP 1 — Representante */}
            {step===1&&(
              <>
                <div style={{fontSize:12,fontWeight:600,color:'#0F2B5B',marginBottom:16,display:'flex',alignItems:'center',gap:5}}>
                  <i className="ti ti-users"/>Datos del representante legal
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  <Field lbl="Nombre completo del representante" id="nombre_representante" ph="Apellidos y nombres" req span={2}/>
                  <Field lbl="Cédula del representante" id="cedula_representante" ph="0000000000"/>
                  <Field lbl="Teléfono / Celular" id="telefono_representante" ph="09XXXXXXXX" req/>
                  <Field lbl="Email del representante" id="email_representante" type="email" ph="correo@ejemplo.com" span={2}/>
                </div>
              </>
            )}

            {/* STEP 2 — Domicilio */}
            {step===2&&(
              <>
                <div style={{fontSize:12,fontWeight:600,color:'#0F2B5B',marginBottom:16,display:'flex',alignItems:'center',gap:5}}>
                  <i className="ti ti-map-pin"/>Domicilio del estudiante
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  <Field lbl="Provincia" id="provincia" type="select" opts={PROVINCIAS.map(v=>({v,l:v}))}/>
                  <Field lbl="Cantón" id="canton" ph="Nombre del cantón"/>
                  <Field lbl="Parroquia" id="parroquia" ph="Nombre de la parroquia"/>
                  <Field lbl="Dirección" id="direccion" ph="Calle principal y número"/>
                </div>
              </>
            )}

            {/* STEP 3 — Confirmar */}
            {step===3&&(
              <>
                <div style={{fontSize:12,fontWeight:600,color:'#0F2B5B',marginBottom:16,display:'flex',alignItems:'center',gap:5}}>
                  <i className="ti ti-clipboard-check"/>Confirmar registro
                </div>
                {/* Preview card */}
                <div style={{background:'linear-gradient(135deg,#0F2B5B,#1e4080)',borderRadius:12,padding:18,color:'#fff',marginBottom:14,position:'relative',overflow:'hidden'}}>
                  <div style={{position:'absolute',top:-20,right:-20,width:80,height:80,borderRadius:'50%',background:'rgba(255,209,0,.08)'}}/>
                  <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
                    <div style={{width:48,height:48,borderRadius:'50%',background:'#FFD100',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:700,color:'#0F2B5B'}}>
                      {initials(form.apellidos,form.nombres)}
                    </div>
                    <div>
                      <div style={{fontSize:16,fontWeight:700}}>{form.apellidos}, {form.nombres}</div>
                      <div style={{fontSize:11,color:'rgba(255,255,255,.6)'}}>Cédula: {form.cedula||'—'} · {form.genero}</div>
                    </div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,paddingTop:14,borderTop:'0.5px solid rgba(255,255,255,.15)'}}>
                    {[
                      {l:'Representante',v:form.nombre_representante||'—'},
                      {l:'Teléfono',v:form.telefono_representante||'—'},
                      {l:'Provincia',v:form.provincia||'—'},
                      {l:'Cantón',v:form.canton||'—'},
                      {l:'Discapacidad',v:form.discapacidad?`Sí (${form.tipo_discapacidad||'—'})`: 'No'},
                      {l:'Nacionalidad',v:form.nacionalidad||'—'},
                    ].map((it,i)=>(
                      <div key={i}>
                        <div style={{fontSize:9,color:'rgba(255,255,255,.5)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:2}}>{it.l}</div>
                        <div style={{fontSize:12,fontWeight:500}}>{it.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Nav buttons */}
            <div style={{display:'flex',gap:8,justifyContent:'space-between',marginTop:16}}>
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
                  <i className={`ti ti-${saving?'loader':'device-floppy'}`} style={{fontSize:13}}/>{saving?'Guardando…':'Guardar estudiante'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
