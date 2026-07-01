import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const ROL_INFO = {
  super_admin:   { emoji:'👑', label:'Super Admin',     color:'#856800', bg:'rgba(255,209,0,.15)' },
  admin_plantel: { emoji:'🏫', label:'Admin Plantel',   color:'#0F2B5B', bg:'rgba(15,43,91,.08)'  },
  docente:       { emoji:'📚', label:'Docente',         color:'#15803d', bg:'rgba(22,163,74,.1)'  },
  alumno:        { emoji:'🎓', label:'Alumno',          color:'#534AB7', bg:'rgba(83,74,183,.08)' },
  padre:         { emoji:'👨', label:'Representante',   color:'#D97706', bg:'rgba(217,119,6,.1)'  },
}
const ROL_NEEDS_PLANTEL = ['admin_plantel','docente','alumno','padre']
const PERMS = {
  super_admin:   ['Dashboard completo','Todos los planteles','Crear usuarios','Config del sistema','Todos los reportes'],
  admin_plantel: ['Dashboard de su plantel','Su plantel','Docentes del plantel','Matrículas','Reportes del plantel'],
  docente:       ['Sus cursos','Calificaciones propias','Asistencia propia','Sus horarios','WhatsApp'],
  alumno:        ['Ver sus notas','Ver su horario','Ver su asistencia','Perfil propio'],
  padre:         ['Notas del representado','Horario del representado','Asistencia del representado'],
}

function initials(n){ return (n||'?').split(' ').filter((_,i)=>i<2).map(w=>w[0]||'').join('').toUpperCase()||'?' }
function genPass(){
  const c='ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
  return Array.from({length:12},()=>c[Math.floor(Math.random()*c.length)]).join('')
}
function passStrength(v){
  let s=0
  if(v.length>=8)s++; if(v.length>=12)s++
  if(/[A-Z]/.test(v))s++; if(/[0-9]/.test(v))s++; if(/[^A-Za-z0-9]/.test(v))s++
  const l=[{c:'#DC2626',t:'Muy débil'},{c:'#DC2626',t:'Débil'},{c:'#D97706',t:'Regular'},{c:'#D97706',t:'Buena'},{c:'#16A34A',t:'Muy fuerte'}]
  return l[Math.min(s,4)]
}

export default function Usuarios() {
  const [tab, setTab]         = useState('lista')
  const [users, setUsers]     = useState([])
  const [planteles, setPlanteles] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [alert, setAlert]     = useState(null)
  const [formAlert, setFormAlert] = useState(null)
  const [search, setSearch]   = useState('')
  const [rolFilter, setRolFilter] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [showPass, setShowPass] = useState(false)
  const [showCreated, setShowCreated] = useState(null) // credenciales del usuario recién creado
  const [plantelSearch, setPlantelSearch] = useState('')
  const [showPlantelDrop, setShowPlantelDrop] = useState(false)
  const [selectedPlantel, setSelectedPlantel] = useState(null)
  const [form, setForm] = useState({
    nombre:'', email:'', password:'', cedula:'', telefono:'', estado:'activo', rol:'docente'
  })

  useEffect(()=>{ loadAll() },[])

  const loadAll = async () => {
    setLoading(true)
    const [{ data:u },{ data:p }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at'),
      supabase.from('planteles').select('id,codigo_amie,nombre,provincia').order('nombre').limit(709)
    ])
    setUsers(u||[]); setPlanteles(p||[]); setLoading(false)
  }

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    const mQ = !q || `${u.nombre_completo} ${u.email} ${u.cedula||''}`.toLowerCase().includes(q)
    const mR = !rolFilter || u.rol===rolFilter
    return mQ && mR
  })

  const msg = (type,text,box='main') => {
    if(box==='main') setAlert({type,text})
    else setFormAlert({type,text})
    setTimeout(()=>{ if(box==='main')setAlert(null); else setFormAlert(null) },6000)
  }

  const resetForm = () => {
    setForm({nombre:'',email:'',password:'',cedula:'',telefono:'',estado:'activo',rol:'docente'})
    setSelectedPlantel(null); setPlantelSearch(''); setEditingId(null); setFormAlert(null); setShowPass(false)
  }

  const handleCreate = async () => {
    if(!form.nombre.trim()) return msg('error','Nombre completo requerido','form')
    if(!form.email.includes('@')) return msg('error','Email válido requerido','form')
    if(form.password.length<8) return msg('error','Contraseña mínima 8 caracteres','form')
    setSaving(true)
    const { data, error } = await supabase.rpc('create_auth_user',{
      p_email:           form.email.trim(),
      p_password:        form.password,
      p_nombre_completo: form.nombre.trim(),
      p_rol:             form.rol,
      p_cedula:          form.cedula||null,
      p_telefono:        form.telefono||null,
      p_estado:          form.estado,
      p_plantel_id:      selectedPlantel?.id||null
    })
    setSaving(false)
    if(error) return msg('error',error.message,'form')
    if(data?.error) return msg('error',data.error,'form')
    // Mostrar credenciales creadas
    setShowCreated({
      email: form.email.trim(),
      password: form.password,
      nombre: form.nombre.trim(),
      rol: form.rol,
      plantel: selectedPlantel?.codigo_amie||'—'
    })
    resetForm()
    await loadAll()
    setTab('lista')
  }

  const handleUpdate = async () => {
    if(!form.nombre.trim()) return msg('error','Nombre requerido','form')
    const { error } = await supabase.from('profiles').update({
      nombre_completo: form.nombre.trim(), rol: form.rol,
      estado: form.estado, cedula: form.cedula||null, telefono: form.telefono||null,
      plantel_id: selectedPlantel?.id||null
    }).eq('id', editingId)
    if(error) return msg('error',error.message,'form')
    if(form.password && form.password.length>=8){
      await supabase.rpc('reset_user_password',{p_user_id:editingId,p_password:form.password})
    }
    msg('ok',`Usuario actualizado correctamente`,'form')
    resetForm(); await loadAll()
    setTimeout(()=>setTab('lista'),1500)
  }

  const handleEdit = (u) => {
    setEditingId(u.id)
    setForm({nombre:u.nombre_completo||'',email:u.email||'',password:'',cedula:u.cedula||'',telefono:u.telefono||'',estado:u.estado||'activo',rol:u.rol||'docente'})
    if(u.plantel_id){
      const p=planteles.find(x=>x.id===u.plantel_id)
      setSelectedPlantel(p||null)
    } else { setSelectedPlantel(null) }
    setTab('nuevo'); setFormAlert(null)
  }

  const handleDelete = async (u) => {
    if(!window.confirm(`Eliminar "${u.nombre_completo}" (${u.email})?`)) return
    await supabase.from('profiles').delete().eq('id',u.id)
    msg('ok',`Usuario eliminado`)
    loadAll()
  }

  const toggleStatus = async (id,current) => {
    const ns=current==='activo'?'suspendido':'activo'
    await supabase.from('profiles').update({estado:ns}).eq('id',id)
    loadAll()
    msg('ok',`Estado → ${ns}`)
  }

  const plantelesFiltered = plantelSearch.length >= 1
    ? planteles.filter(p =>
        p.codigo_amie?.toLowerCase().includes(plantelSearch.toLowerCase()) ||
        p.nombre?.toLowerCase().includes(plantelSearch.toLowerCase()) ||
        p.provincia?.toLowerCase().includes(plantelSearch.toLowerCase())
      ).slice(0, 12)
    : planteles.slice(0, 6)

  const stats = { total:users.length, activos:users.filter(u=>u.estado==='activo').length, admins:users.filter(u=>['super_admin','admin_plantel'].includes(u.rol)).length, docentes:users.filter(u=>u.rol==='docente').length }

  const Alrt = ({d}) => d ? (
    <div style={{borderRadius:8,padding:'10px 14px',fontSize:12,display:'flex',alignItems:'center',gap:7,marginBottom:12,
      background:d.type==='ok'?'rgba(22,163,74,.08)':'rgba(220,38,38,.06)',
      border:`0.5px solid ${d.type==='ok'?'rgba(22,163,74,.25)':'rgba(220,38,38,.2)'}`,
      color:d.type==='ok'?'#15803d':'#B91C1C'}}>
      <i className={`ti ti-${d.type==='ok'?'circle-check':'alert-circle'}`} style={{fontSize:14}}/>
      <span dangerouslySetInnerHTML={{__html:d.text}}/>
    </div>
  ) : null

  return (
    <div>
      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:16}}>
        {[{val:stats.total,lbl:'Total',c:'#0F2B5B',ico:'ti-users'},{val:stats.activos,lbl:'Activos',c:'#16A34A',ico:'ti-circle-check'},{val:stats.admins,lbl:'Administradores',c:'#D97706',ico:'ti-shield-check'},{val:stats.docentes,lbl:'Docentes',c:'#534AB7',ico:'ti-users'}].map((s,i)=>(
          <div key={i} style={{background:'#F9FAFB',borderRadius:10,padding:12,border:'0.5px solid #E5E7EB',position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',top:0,right:0,width:3,height:'100%',background:s.c}}/>
            <div style={{width:28,height:28,borderRadius:6,background:s.c+'22',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:6}}><i className={`ti ${s.ico}`} style={{fontSize:14,color:s.c}}/></div>
            <div style={{fontSize:20,fontWeight:700,color:'#1A2B4A'}}>{s.val}</div>
            <div style={{fontSize:10,color:'#9CA3AF',marginTop:2}}>{s.lbl}</div>
          </div>
        ))}
      </div>

      <Alrt d={alert}/>

      {/* Credenciales recién creadas */}
      {showCreated && (
        <div style={{background:'linear-gradient(135deg,#0F2B5B,#1e4080)',borderRadius:12,padding:18,color:'#fff',marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:600,color:'#FFD100',marginBottom:10,display:'flex',alignItems:'center',gap:6}}>
            <i className="ti ti-circle-check" style={{fontSize:14}}/>Usuario creado exitosamente — guarda estas credenciales
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            {[['Nombre',showCreated.nombre],['Email',showCreated.email],['Contraseña',showCreated.password],['Rol',showCreated.rol],['Plantel',showCreated.plantel]].map(([l,v])=>(
              <div key={l} style={{background:'rgba(255,255,255,.08)',borderRadius:8,padding:'8px 12px'}}>
                <div style={{fontSize:9,color:'rgba(255,255,255,.5)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:2}}>{l}</div>
                <div style={{fontSize:12,fontWeight:600,fontFamily:['Contraseña','Email'].includes(l)?'monospace':'inherit'}}>{v}</div>
              </div>
            ))}
          </div>
          <button onClick={()=>setShowCreated(null)} style={{marginTop:12,background:'rgba(255,255,255,.1)',border:'0.5px solid rgba(255,255,255,.2)',borderRadius:6,color:'#fff',padding:'5px 14px',fontSize:11,cursor:'pointer'}}>
            Ya guardé las credenciales ×
          </button>
        </div>
      )}

      {/* Tabs */}
      <div style={{display:'flex',gap:3,background:'#F3F4F6',padding:3,borderRadius:8,width:'fit-content',marginBottom:14}}>
        {[['lista','Lista'],['nuevo',editingId?'Editar usuario':'+ Nuevo usuario'],['permisos','Permisos']].map(([id,lbl])=>(
          <button key={id} onClick={()=>{ if(id==='nuevo'&&tab==='nuevo'&&!editingId)resetForm(); setTab(id) }}
            style={{padding:'5px 14px',borderRadius:5,border:'none',fontSize:11,cursor:'pointer',
              background:tab===id?'#fff':'transparent',color:tab===id?'#0F2B5B':'#6B7280',
              fontWeight:tab===id?600:500,boxShadow:tab===id?'0 1px 2px rgba(0,0,0,.07)':'none'}}>{lbl}</button>
        ))}
      </div>

      {/* LISTA */}
      {tab==='lista' && (
        <div style={{background:'#fff',border:'0.5px solid #E5E7EB',borderRadius:12,overflow:'hidden'}}>
          <div style={{padding:'12px 16px',borderBottom:'0.5px solid #F3F4F6',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}>
            <span style={{fontSize:12,fontWeight:600,color:'#0F2B5B'}}>{filtered.length} de {users.length} usuarios</span>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              <div style={{position:'relative'}}>
                <i className="ti ti-search" style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',color:'#9CA3AF',fontSize:12}}/>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar..."
                  style={{height:30,border:'0.5px solid #E5E7EB',borderRadius:6,padding:'0 8px 0 26px',fontSize:11,background:'#F9FAFB',width:160}}/>
              </div>
              <select value={rolFilter} onChange={e=>setRolFilter(e.target.value)}
                style={{height:30,border:'0.5px solid #E5E7EB',borderRadius:6,fontSize:11,padding:'0 8px',background:'#F9FAFB'}}>
                <option value="">Todos los roles</option>
                {Object.keys(ROL_INFO).map(r=><option key={r} value={r}>{r}</option>)}
              </select>
              <button onClick={()=>{resetForm();setTab('nuevo')}}
                style={{height:30,padding:'0 12px',background:'#0F2B5B',border:'none',borderRadius:6,color:'#fff',fontSize:11,cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
                <i className="ti ti-plus" style={{fontSize:12}}/>Nuevo
              </button>
            </div>
          </div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr>
                {['#','Usuario','Email','Rol','Plantel','Estado','Último acceso','Acciones'].map(h=>(
                  <th key={h} style={{textAlign:'left',padding:'0 12px 8px',fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',borderBottom:'0.5px solid #F3F4F6'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {loading?<tr><td colSpan={8} style={{textAlign:'center',padding:28,color:'#9CA3AF'}}>Cargando…</td></tr>
                :filtered.map((u,i)=>{
                  const ri=ROL_INFO[u.rol]||ROL_INFO.docente
                  const plantel=planteles.find(p=>p.id===u.plantel_id)
                  return(
                    <tr key={u.id} style={{borderBottom:'0.5px solid #F9FAFB'}}>
                      <td style={{padding:'9px 12px',fontSize:10,color:'#9CA3AF'}}>{i+1}</td>
                      <td style={{padding:'9px 12px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{width:30,height:30,borderRadius:'50%',background:ri.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:ri.color,flexShrink:0}}>{initials(u.nombre_completo)}</div>
                          <div>
                            <div style={{fontWeight:500}}>{u.nombre_completo||'—'}</div>
                            <div style={{fontSize:10,color:'#9CA3AF'}}>{u.cedula||''}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{padding:'9px 12px',color:'#6B7280',fontSize:11}}>{u.email}</td>
                      <td style={{padding:'9px 12px'}}><span style={{fontSize:10,padding:'2px 7px',borderRadius:9,fontWeight:500,background:ri.bg,color:ri.color}}>{ri.emoji} {u.rol}</span></td>
                      <td style={{padding:'9px 12px'}}>
                        {plantel?<span style={{fontFamily:'monospace',fontSize:10,fontWeight:700,background:'#eff6ff',color:'#1d4ed8',border:'0.5px solid #bfdbfe',borderRadius:5,padding:'2px 6px'}}>{plantel.codigo_amie}</span>
                          :<span style={{fontSize:10,color:'#9CA3AF'}}>—</span>}
                      </td>
                      <td style={{padding:'9px 12px'}}>
                        <span style={{fontSize:10,padding:'2px 7px',borderRadius:9,fontWeight:500,
                          background:u.estado==='activo'?'rgba(22,163,74,.1)':u.estado==='suspendido'?'rgba(220,38,38,.08)':'#F3F4F6',
                          color:u.estado==='activo'?'#15803d':u.estado==='suspendido'?'#DC2626':'#9CA3AF'}}>{u.estado}</span>
                      </td>
                      <td style={{padding:'9px 12px',fontSize:10,color:'#9CA3AF'}}>
                        {u.ultimo_acceso?new Date(u.ultimo_acceso).toLocaleString('es-EC',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}):'Nunca'}
                      </td>
                      <td style={{padding:'9px 12px'}}>
                        <div style={{display:'flex',gap:4}}>
                          <button onClick={()=>handleEdit(u)} title="Editar" style={{width:26,height:26,borderRadius:5,border:'0.5px solid #E5E7EB',background:'#F9FAFB',cursor:'pointer',color:'#0F2B5B'}}><i className="ti ti-edit" style={{fontSize:12}}/></button>
                          <button onClick={()=>toggleStatus(u.id,u.estado)} title={u.estado==='activo'?'Suspender':'Activar'} style={{width:26,height:26,borderRadius:5,border:'0.5px solid #E5E7EB',background:'#F9FAFB',cursor:'pointer',color:'#6B7280'}}><i className={`ti ti-${u.estado==='activo'?'ban':'circle-check'}`} style={{fontSize:12}}/></button>
                          <button onClick={()=>handleDelete(u)} title="Eliminar" style={{width:26,height:26,borderRadius:5,border:'0.5px solid rgba(220,38,38,.2)',background:'rgba(220,38,38,.04)',cursor:'pointer',color:'#DC2626'}}><i className="ti ti-trash" style={{fontSize:12}}/></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* NUEVO / EDITAR */}
      {tab==='nuevo' && (
        <div style={{background:'#fff',border:'0.5px solid #E5E7EB',borderRadius:12,overflow:'hidden'}}>
          <div style={{padding:'13px 16px',borderBottom:'0.5px solid #F3F4F6',display:'flex',alignItems:'center',gap:6}}>
            <i className={`ti ti-${editingId?'edit':'user-plus'}`} style={{fontSize:14,color:'#0F2B5B'}}/>
            <span style={{fontSize:13,fontWeight:600,color:'#0F2B5B'}}>{editingId?'Editar usuario':'Crear nuevo usuario'}</span>
          </div>
          <div style={{padding:18}}>

            {/* Selector de rol */}
            <div style={{marginBottom:16}}>
              <div style={{fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:8}}>Rol del usuario *</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8,marginBottom:10}}>
                {Object.entries(ROL_INFO).map(([rol,info])=>(
                  <div key={rol} onClick={()=>setForm({...form,rol})}
                    style={{border:`${form.rol===rol?'1.5px':'0.5px'} solid ${form.rol===rol?'#0F2B5B':'#E5E7EB'}`,borderRadius:8,padding:'10px 5px',cursor:'pointer',textAlign:'center',background:form.rol===rol?'rgba(15,43,91,.07)':'#F9FAFB',transition:'all .13s'}}>
                    <div style={{fontSize:18,marginBottom:3}}>{info.emoji}</div>
                    <div style={{fontSize:9,fontWeight:600,color:'#1A2B4A'}}>{rol}</div>
                    <div style={{fontSize:8,color:'#9CA3AF',marginTop:1}}>{info.label}</div>
                  </div>
                ))}
              </div>
              <div style={{background:'#F9FAFB',borderRadius:8,padding:'9px 12px',border:'0.5px solid #E5E7EB'}}>
                <div style={{fontSize:10,fontWeight:600,color:'#0F2B5B',marginBottom:5}}>Permisos de {form.rol}:</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:3}}>
                  {(PERMS[form.rol]||[]).map((p,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'center',gap:4,fontSize:10,color:'#374151'}}>
                      <i className="ti ti-circle-check" style={{fontSize:10,color:'#16A34A',flexShrink:0}}/>{p}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Selector de plantel por AMIE */}
            {ROL_NEEDS_PLANTEL.includes(form.rol) && (
              <div style={{marginBottom:16}}>
                <div style={{fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:6}}>
                  Plantel (AMIE) {form.rol==='admin_plantel'||form.rol==='docente'?'*':''}
                </div>
                {selectedPlantel ? (
                  <div style={{background:'rgba(22,163,74,.06)',border:'0.5px solid rgba(22,163,74,.25)',borderRadius:8,padding:'10px 14px',display:'flex',alignItems:'center',gap:10}}>
                    <span style={{fontFamily:'monospace',fontSize:12,fontWeight:700,background:'#eff6ff',color:'#1d4ed8',border:'0.5px solid #bfdbfe',borderRadius:6,padding:'3px 9px'}}>{selectedPlantel.codigo_amie}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:500}}>{selectedPlantel.nombre}</div>
                      <div style={{fontSize:10,color:'#6B7280'}}>{selectedPlantel.provincia}</div>
                    </div>
                    <button onClick={()=>setSelectedPlantel(null)} style={{border:'none',background:'none',cursor:'pointer',color:'#9CA3AF',fontSize:18,padding:0}}>×</button>
                  </div>
                ) : (
                  <div style={{position:'relative'}} onBlur={()=>setTimeout(()=>setShowPlantelDrop(false),200)}>
                    <div style={{position:'relative'}}>
                      <i className="ti ti-search" style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',color:'#9CA3AF',fontSize:13}}/>
                      <input value={plantelSearch} onChange={e=>{setPlantelSearch(e.target.value);setShowPlantelDrop(true)}}
                        onFocus={()=>setShowPlantelDrop(true)}
                        placeholder="Buscar por código AMIE, nombre o provincia..."
                        style={{width:'100%',height:38,border:`1.5px solid ${showPlantelDrop?'#0F2B5B':'#E5E7EB'}`,borderRadius:7,padding:'0 10px 0 32px',fontSize:12,background:'#fff',boxSizing:'border-box',outline:'none'}}/>
                    </div>
                    {showPlantelDrop && (
                      <div style={{position:'absolute',left:0,right:0,top:40,background:'#fff',border:'1px solid #0F2B5B',borderRadius:8,zIndex:200,boxShadow:'0 8px 24px rgba(0,0,0,.12)',maxHeight:280,overflowY:'auto'}}>
                        <div style={{padding:'7px 12px',fontSize:10,color:'#6B7280',borderBottom:'0.5px solid #F3F4F6',background:'#F9FAFB',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                          <span><strong style={{color:'#0F2B5B'}}>{plantelesFiltered.length}</strong> de {planteles.length} planteles {plantelSearch?'encontrados':'(escribe para filtrar)'}</span>
                          <span style={{fontFamily:'monospace',fontSize:9,color:'#9CA3AF'}}>709 planteles disponibles</span>
                        </div>
                        <div onMouseDown={()=>{setSelectedPlantel(null);setPlantelSearch('');setShowPlantelDrop(false)}}
                          style={{padding:'9px 12px',cursor:'pointer',borderBottom:'0.5px solid #F9FAFB',display:'flex',alignItems:'center',gap:10,fontSize:12,background:'#FFFBEB'}}
                          onMouseOver={e=>e.currentTarget.style.background='#FEF3C7'}
                          onMouseOut={e=>e.currentTarget.style.background='#FFFBEB'}>
                          <span style={{fontFamily:'monospace',fontSize:11,fontWeight:700,background:'#FEF3C7',color:'#D97706',border:'0.5px solid #FDE68A',borderRadius:5,padding:'2px 7px',flexShrink:0}}>BASE</span>
                          <div>
                            <div style={{fontWeight:500,fontSize:12,color:'#D97706'}}>Sin plantel asignado — Docente base</div>
                            <div style={{fontSize:10,color:'#9CA3AF'}}>El usuario no queda asignado a ningún plantel</div>
                          </div>
                        </div>
                        {plantelesFiltered.map(p=>(
                          <div key={p.id} onMouseDown={()=>{setSelectedPlantel(p);setPlantelSearch('');setShowPlantelDrop(false)}}
                            style={{padding:'9px 12px',cursor:'pointer',borderBottom:'0.5px solid #F9FAFB',display:'flex',alignItems:'center',gap:10,fontSize:12}}
                            onMouseOver={e=>e.currentTarget.style.background='#F9FAFB'}
                            onMouseOut={e=>e.currentTarget.style.background=''}>
                            <span style={{fontFamily:'monospace',fontSize:11,fontWeight:700,background:'#eff6ff',color:'#1d4ed8',border:'0.5px solid #bfdbfe',borderRadius:5,padding:'2px 7px',flexShrink:0}}>{p.codigo_amie}</span>
                            <div>
                              <div style={{fontWeight:500,fontSize:12}}>{p.nombre}</div>
                              <div style={{fontSize:10,color:'#9CA3AF'}}>{p.provincia}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <button onClick={()=>{setSelectedPlantel(null)}} style={{marginTop:4,fontSize:10,color:'#D97706',border:'none',background:'none',cursor:'pointer',padding:0,display:'flex',alignItems:'center',gap:3}}>
                      <i className="ti ti-user" style={{fontSize:10}}/> O asignar como docente base sin plantel (sin AMIE)
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Datos personales */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
              <div style={{gridColumn:'span 2'}}>
                <div style={{fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:4}}>Nombre completo *</div>
                <input value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} placeholder="Apellidos y nombres"
                  style={{width:'100%',height:34,border:'0.5px solid #E5E7EB',borderRadius:7,padding:'0 10px',fontSize:12,background:'#F9FAFB',boxSizing:'border-box'}}/>
              </div>
              <div>
                <div style={{fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:4}}>Cédula</div>
                <input value={form.cedula} onChange={e=>setForm({...form,cedula:e.target.value})} placeholder="0000000000"
                  style={{width:'100%',height:34,border:'0.5px solid #E5E7EB',borderRadius:7,padding:'0 10px',fontSize:12,background:'#F9FAFB',fontFamily:'monospace',boxSizing:'border-box'}}/>
              </div>
              <div>
                <div style={{fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:4}}>Teléfono</div>
                <input value={form.telefono} onChange={e=>setForm({...form,telefono:e.target.value})} placeholder="09XXXXXXXX"
                  style={{width:'100%',height:34,border:'0.5px solid #E5E7EB',borderRadius:7,padding:'0 10px',fontSize:12,background:'#F9FAFB',boxSizing:'border-box'}}/>
              </div>
              <div style={{gridColumn:'span 2'}}>
                <div style={{fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:4}}>Correo electrónico *</div>
                <input type="email" value={form.email} onChange={e=>!editingId&&setForm({...form,email:e.target.value})} placeholder="correo@plantel.edu.ec"
                  readOnly={!!editingId} style={{width:'100%',height:34,border:'0.5px solid #E5E7EB',borderRadius:7,padding:'0 10px',fontSize:12,background:editingId?'#F3F4F6':'#F9FAFB',boxSizing:'border-box'}}/>
                {editingId&&<div style={{fontSize:10,color:'#9CA3AF',marginTop:2}}>El email no se puede cambiar</div>}
              </div>
            </div>

            {/* Contraseña */}
            <div style={{background:'rgba(15,43,91,.04)',border:'0.5px solid rgba(15,43,91,.12)',borderRadius:9,padding:14,marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:600,color:'#0F2B5B',marginBottom:10}}>
                {editingId?'Nueva contraseña (dejar vacío para no cambiar)':'Contraseña de acceso *'}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:8,alignItems:'end'}}>
                <div>
                  <div style={{position:'relative'}}>
                    <input type={showPass?'text':'password'} value={form.password}
                      onChange={e=>setForm({...form,password:e.target.value})}
                      placeholder={editingId?'Dejar vacío para no cambiar':'Mínimo 8 caracteres'}
                      style={{width:'100%',height:36,border:'0.5px solid #E5E7EB',borderRadius:7,padding:'0 36px 0 12px',fontSize:13,background:'#fff',boxSizing:'border-box',fontFamily:'monospace'}}/>
                    <button type="button" onClick={()=>setShowPass(!showPass)}
                      style={{position:'absolute',right:9,top:'50%',transform:'translateY(-50%)',border:'none',background:'none',cursor:'pointer',color:'#9CA3AF'}}>
                      <i className={`ti ti-${showPass?'eye-off':'eye'}`} style={{fontSize:15}}/>
                    </button>
                  </div>
                  {form.password && (()=>{
                    const s=passStrength(form.password)
                    return <div style={{display:'flex',alignItems:'center',gap:6,marginTop:5}}>
                      <div style={{height:4,flex:1,background:'#F3F4F6',borderRadius:2,overflow:'hidden'}}>
                        <div style={{height:'100%',width:form.password.length>=12?'100%':form.password.length>=8?'60%':'30%',background:s.c,transition:'all .3s'}}/>
                      </div>
                      <span style={{fontSize:10,color:s.c,fontWeight:500,flexShrink:0}}>{s.t}</span>
                    </div>
                  })()}
                </div>
                <button type="button" onClick={()=>{const p=genPass();setForm({...form,password:p});setShowPass(true)}}
                  style={{height:36,padding:'0 14px',background:'#0F2B5B',border:'none',borderRadius:7,color:'#FFD100',fontSize:11,cursor:'pointer',display:'flex',alignItems:'center',gap:5,whiteSpace:'nowrap'}}>
                  <i className="ti ti-refresh" style={{fontSize:12}}/>Generar
                </button>
              </div>
              {form.password && showPass && (
                <div style={{marginTop:8,background:'rgba(220,38,38,.06)',border:'0.5px solid rgba(220,38,38,.2)',borderRadius:6,padding:'6px 10px',fontSize:11,color:'#B91C1C',display:'flex',alignItems:'center',gap:5}}>
                  <i className="ti ti-alert-triangle" style={{fontSize:12}}/>
                  Copia esta contraseña ahora — no podrás verla después de guardar
                </div>
              )}
            </div>

            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:4}}>Estado</div>
              <select value={form.estado} onChange={e=>setForm({...form,estado:e.target.value})}
                style={{height:34,border:'0.5px solid #E5E7EB',borderRadius:7,padding:'0 10px',fontSize:12,background:'#F9FAFB',width:'100%'}}>
                <option value="activo">Activo — acceso inmediato</option>
                <option value="inactivo">Inactivo — sin acceso</option>
                <option value="suspendido">Suspendido</option>
              </select>
            </div>

            <Alrt d={formAlert}/>

            <div style={{display:'flex',gap:8,justifyContent:'flex-end',paddingTop:10,borderTop:'0.5px solid #F3F4F6'}}>
              <button onClick={()=>{resetForm();setTab('lista')}} style={{height:34,padding:'0 16px',border:'0.5px solid #E5E7EB',borderRadius:7,background:'#fff',fontSize:12,cursor:'pointer'}}>{editingId?'Cancelar edición':'Cancelar'}</button>
              <button onClick={editingId?handleUpdate:handleCreate} disabled={saving}
                style={{height:34,padding:'0 18px',background:saving?'#6B7280':'#0F2B5B',border:'none',borderRadius:7,color:'#fff',fontSize:12,fontWeight:500,cursor:saving?'not-allowed':'pointer',display:'flex',alignItems:'center',gap:5}}>
                <i className={`ti ti-${saving?'loader':editingId?'device-floppy':'user-plus'}`} style={{fontSize:13}}/>
                {saving?(editingId?'Actualizando…':'Creando…'):(editingId?'Guardar cambios':'Crear usuario')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PERMISOS */}
      {tab==='permisos' && (
        <div style={{background:'#fff',border:'0.5px solid #E5E7EB',borderRadius:12,overflow:'hidden'}}>
          <div style={{padding:'12px 16px',borderBottom:'0.5px solid #F3F4F6'}}><span style={{fontSize:12,fontWeight:600,color:'#0F2B5B',display:'flex',alignItems:'center',gap:5}}><i className="ti ti-shield"/>Matriz de permisos por rol</span></div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
              <thead><tr>
                <th style={{textAlign:'left',padding:'0 12px 8px',fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',borderBottom:'0.5px solid #F3F4F6',minWidth:160}}>Módulo</th>
                {Object.entries(ROL_INFO).map(([r,i])=>(
                  <th key={r} style={{textAlign:'center',padding:'0 8px 8px',fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',borderBottom:'0.5px solid #F3F4F6'}}>{i.emoji}<br/>{r}</th>
                ))}
              </tr></thead>
              <tbody>
                {[['Planteles',['✅ Todos','✅ El suyo','❌','❌','❌']],['Docentes',['✅','✅ Su plantel','❌','❌','❌']],['Estudiantes',['✅','✅','✅ Sus cursos','❌','❌']],['Matrículas',['✅','✅','❌','👁 La propia','👁 Representado']],['Calificaciones ver',['✅','✅','✅ Sus materias','✅ Las propias','✅ Representado']],['Calificaciones editar',['✅','✅','✅ Sus materias','❌','❌']],['Asistencia',['✅','✅','✅ Sus cursos','✅ La propia','✅ Representado']],['Horarios',['✅','✅','✅ Los propios','✅ El propio','✅ Representado']],['Periodos',['✅','✅','👁 Ver','❌','❌']],['Usuarios',['✅','✅ Limitado','❌','❌','❌']],['Reportes',['✅ Todos','✅ Su plantel','❌','❌','❌']],['Configuracion',['✅','❌','❌','❌','❌']],['WhatsApp',['✅','✅','✅','❌','❌']]].map(([m,p],i)=>(
                  <tr key={i} style={{borderBottom:'0.5px solid #F9FAFB'}}>
                    <td style={{padding:'7px 12px',fontWeight:500}}>{m}</td>
                    {p.map((v,j)=><td key={j} style={{padding:'7px 8px',textAlign:'center',color:v.startsWith('✅')?'#15803d':v==='❌'?'#D1D5DB':'#D97706'}}>{v}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
