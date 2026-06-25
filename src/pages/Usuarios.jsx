import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const SUPA = import.meta.env.VITE_SUPABASE_URL
const KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY

const ROL_INFO = {
  super_admin:   { emoji:'👑', label:'Super Admin',       badge:'#856800',   bg:'rgba(255,209,0,.15)' },
  admin_plantel: { emoji:'🏫', label:'Admin Plantel',     badge:'#0F2B5B',   bg:'rgba(15,43,91,.08)'  },
  docente:       { emoji:'📚', label:'Docente',           badge:'#15803d',   bg:'rgba(22,163,74,.1)'  },
  alumno:        { emoji:'🎓', label:'Alumno',            badge:'#534AB7',   bg:'rgba(83,74,183,.08)' },
  padre:         { emoji:'👨‍👧', label:'Representante',   badge:'#D97706',   bg:'rgba(217,119,6,.1)'  },
}
const EST_COLORS = { activo:'#15803d', inactivo:'#6B7280', suspendido:'#DC2626' }

const PERMS = {
  super_admin:   ['Dashboard completo','Todos los planteles','Todos los docentes','Todos los estudiantes','Crear/editar usuarios','Todos los reportes','Configuración del sistema','Abrir/cerrar períodos','Matrículas','Calificaciones','Asistencia','Horarios','WhatsApp'],
  admin_plantel: ['Dashboard de su plantel','Su plantel','Docentes de su plantel','Estudiantes de su plantel','Crear usuarios docente/alumno','Reportes de su plantel','Períodos','Matrículas','Calificaciones','Asistencia','Horarios','WhatsApp'],
  docente:       ['Dashboard docente','Sus cursos','Sus estudiantes','Ingresar calificaciones propias','Registrar asistencia propia','Ver sus horarios','Perfil propio','WhatsApp'],
  alumno:        ['Dashboard alumno','Ver sus calificaciones','Ver su horario','Ver su asistencia','Perfil propio'],
  padre:         ['Dashboard padre','Calificaciones del representado','Horario del representado','Asistencia del representado'],
}

function initials(name) {
  return (name||'?').split(' ').filter((_,i)=>i<2).map(w=>w[0]||'').join('').toUpperCase()||'?'
}

function generatePassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
  return Array.from({length:12},()=>chars[Math.floor(Math.random()*chars.length)]).join('')
}

export default function Usuarios() {
  const { isSuperAdmin } = useAuth()
  const [tab, setTab] = useState('lista')
  const [users, setUsers] = useState([])
  const [filtered, setFiltered] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState(null)
  const [formAlert, setFormAlert] = useState(null)
  const [search, setSearch] = useState('')
  const [rolFilter, setRolFilter] = useState('')
  const [selectedRol, setSelectedRol] = useState('docente')
  const [showPass, setShowPass] = useState(false)
  const [form, setForm] = useState({ nombre:'', email:'', password:'', cedula:'', telefono:'', estado:'activo', plantel_id:'' })

  useEffect(() => { loadUsers() }, [])

  useEffect(() => {
    let f = users
    if (search) f = f.filter(u => `${u.nombre_completo} ${u.email} ${u.cedula||''}`.toLowerCase().includes(search.toLowerCase()))
    if (rolFilter) f = f.filter(u => u.rol === rolFilter)
    setFiltered(f)
  }, [search, rolFilter, users])

  const loadUsers = async () => {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('created_at')
    setUsers(data||[])
    setLoading(false)
  }

  const showMsg = (type, msg, box='main') => {
    if (box==='main') setAlert({type,msg})
    else setFormAlert({type,msg})
    setTimeout(()=>{ if(box==='main') setAlert(null); else setFormAlert(null) }, 5000)
  }

  const handleCreate = async () => {
    if (!form.nombre.trim()) return showMsg('error','Nombre completo requerido','form')
    if (!form.email.includes('@')) return showMsg('error','Email válido requerido','form')
    if (form.password.length < 8) return showMsg('error','Contraseña mínima: 8 caracteres','form')
    setSaving(true)
    try {
      // Crear usuario en Supabase Auth
      const res = await fetch(`${SUPA}/auth/v1/admin/users`, {
        method: 'POST',
        headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          email_confirm: true,
          user_metadata: { nombre_completo: form.nombre, rol: selectedRol }
        })
      })
      const data = await res.json()
      if (res.status === 201 || res.status === 200) {
        // Actualizar perfil con datos adicionales
        if (data.id) {
          await supabase.from('profiles').update({
            rol: selectedRol,
            estado: form.estado,
            cedula: form.cedula||null,
            telefono: form.telefono||null,
            nombre_completo: form.nombre
          }).eq('id', data.id)
        }
        showMsg('ok', `✅ Usuario "${form.nombre}" creado con rol ${selectedRol}`, 'form')
        setForm({ nombre:'', email:'', password:'', cedula:'', telefono:'', estado:'activo', plantel_id:'' })
        await loadUsers()
        setTimeout(() => setTab('lista'), 2000)
      } else {
        let msg = data.message || data.msg || 'Error al crear'
        if (msg.includes('already registered')) msg = 'Ya existe un usuario con ese email'
        if (msg.includes('weak_password')) msg = 'Contraseña débil — usa mayúsculas, números y símbolos'
        showMsg('error', msg, 'form')
      }
    } catch(e) { showMsg('error', e.message, 'form') }
    setSaving(false)
  }

  const toggleStatus = async (id, current) => {
    const newStatus = current === 'activo' ? 'suspendido' : 'activo'
    await supabase.from('profiles').update({ estado: newStatus }).eq('id', id)
    await loadUsers()
    showMsg('ok', `Estado actualizado a ${newStatus}`)
  }

  const stats = {
    total: users.length,
    activos: users.filter(u=>u.estado==='activo').length,
    admins: users.filter(u=>['super_admin','admin_plantel'].includes(u.rol)).length,
    docentes: users.filter(u=>u.rol==='docente').length,
    otros: users.filter(u=>['alumno','padre'].includes(u.rol)).length,
  }

  const cardStyle = (color, border) => ({
    background: '#F9FAFB', borderRadius: 10, padding: 12,
    position: 'relative', overflow: 'hidden', border: '0.5px solid #E5E7EB'
  })

  return (
    <div>
      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:16 }}>
        {[
          { val:stats.total,   lbl:'Total usuarios',  ico:'ti-users',         c:'#0F2B5B', b:'#0F2B5B' },
          { val:stats.activos, lbl:'Activos',          ico:'ti-circle-check',  c:'#16A34A', b:'#16A34A' },
          { val:stats.admins,  lbl:'Administradores',  ico:'ti-shield-check',  c:'#D97706', b:'#D97706' },
          { val:stats.docentes,lbl:'Docentes',         ico:'ti-users',         c:'#534AB7', b:'#534AB7' },
          { val:stats.otros,   lbl:'Alumnos/Padres',   ico:'ti-school',        c:'#0891B2', b:'#0891B2' },
        ].map((s,i) => (
          <div key={i} style={{ background:'#F9FAFB', borderRadius:10, padding:12, border:'0.5px solid #E5E7EB', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:0, right:0, width:3, height:'100%', background:s.b }} />
            <div style={{ width:28, height:28, borderRadius:6, background:s.c+'22', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:6 }}>
              <i className={`ti ${s.ico}`} style={{ fontSize:14, color:s.c }} />
            </div>
            <div style={{ fontSize:20, fontWeight:700, color:'#1A2B4A' }}>{s.val}</div>
            <div style={{ fontSize:10, color:'#9CA3AF', marginTop:2 }}>{s.lbl}</div>
          </div>
        ))}
      </div>

      {/* Alert */}
      {alert && (
        <div style={{ borderRadius:8, padding:'10px 14px', fontSize:12, display:'flex', alignItems:'center', gap:7, marginBottom:12,
          background: alert.type==='ok'?'rgba(22,163,74,.08)':'rgba(220,38,38,.06)',
          border: `0.5px solid ${alert.type==='ok'?'rgba(22,163,74,.25)':'rgba(220,38,38,.2)'}`,
          color: alert.type==='ok'?'#15803d':'#B91C1C' }}>
          <i className={`ti ti-${alert.type==='ok'?'circle-check':'alert-circle'}`} style={{ fontSize:14 }} />
          <span dangerouslySetInnerHTML={{__html:alert.msg}} />
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', gap:3, background:'#F3F4F6', padding:3, borderRadius:8, width:'fit-content', marginBottom:14 }}>
        {[['lista','Lista de usuarios'],['nuevo','+ Nuevo usuario'],['permisos','Permisos por rol']].map(([id,lbl])=>(
          <button key={id} onClick={()=>setTab(id)} style={{
            padding:'5px 14px', borderRadius:5, border:'none', fontSize:11, cursor:'pointer',
            fontWeight: tab===id?600:500,
            background: tab===id?'#fff':'transparent',
            color: tab===id?'#0F2B5B':'#6B7280',
            boxShadow: tab===id?'0 1px 2px rgba(0,0,0,.07)':'none'
          }}>{lbl}</button>
        ))}
      </div>

      {/* LISTA */}
      {tab==='lista' && (
        <div style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:12, overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:'0.5px solid #F3F4F6', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, flexWrap:'wrap' }}>
            <span style={{ fontSize:12, fontWeight:600, color:'#0F2B5B' }}>
              <i className="ti ti-users" style={{ marginRight:5 }} />{filtered.length} de {users.length} usuarios
            </span>
            <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
              <div style={{ position:'relative' }}>
                <i className="ti ti-search" style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', color:'#9CA3AF', fontSize:12 }} />
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar..." style={{ height:30, border:'0.5px solid #E5E7EB', borderRadius:6, padding:'0 8px 0 26px', fontSize:11, background:'#F9FAFB', width:160 }} />
              </div>
              <select value={rolFilter} onChange={e=>setRolFilter(e.target.value)} style={{ height:30, border:'0.5px solid #E5E7EB', borderRadius:6, fontSize:11, padding:'0 8px', background:'#F9FAFB' }}>
                <option value="">Todos los roles</option>
                {Object.keys(ROL_INFO).map(r=><option key={r} value={r}>{r}</option>)}
              </select>
              <button onClick={()=>setTab('nuevo')} style={{ height:30, padding:'0 12px', background:'#0F2B5B', border:'none', borderRadius:6, color:'#fff', fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
                <i className="ti ti-plus" style={{ fontSize:12 }} />Nuevo
              </button>
            </div>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead><tr>
                {['#','Usuario','Email','Rol','Estado','Último acceso','Acciones'].map(h=>
                  <th key={h} style={{ textAlign:'left', padding:'0 12px 8px', fontSize:10, fontWeight:600, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.4px', borderBottom:'0.5px solid #F3F4F6' }}>{h}</th>
                )}
              </tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={7} style={{ textAlign:'center', padding:28, color:'#9CA3AF' }}>Cargando…</td></tr>
                  : filtered.map((u,i) => {
                    const ri = ROL_INFO[u.rol]||ROL_INFO.docente
                    return (
                      <tr key={u.id} style={{ borderBottom:'0.5px solid #F9FAFB' }}>
                        <td style={{ padding:'9px 12px', fontSize:10, color:'#9CA3AF' }}>{i+1}</td>
                        <td style={{ padding:'9px 12px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <div style={{ width:30, height:30, borderRadius:'50%', background:ri.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:ri.badge, flexShrink:0 }}>
                              {initials(u.nombre_completo)}
                            </div>
                            <div>
                              <div style={{ fontWeight:500 }}>{u.nombre_completo}</div>
                              <div style={{ fontSize:10, color:'#9CA3AF' }}>{u.cedula||''}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding:'9px 12px', color:'#6B7280', fontSize:11 }}>{u.email}</td>
                        <td style={{ padding:'9px 12px' }}>
                          <span style={{ fontSize:10, padding:'2px 7px', borderRadius:9, fontWeight:500, background:ri.bg, color:ri.badge }}>{ri.emoji} {u.rol}</span>
                        </td>
                        <td style={{ padding:'9px 12px' }}>
                          <span style={{ fontSize:10, padding:'2px 7px', borderRadius:9, fontWeight:500, background: u.estado==='activo'?'rgba(22,163,74,.1)':'rgba(220,38,38,.08)', color:EST_COLORS[u.estado]||'#6B7280' }}>{u.estado}</span>
                        </td>
                        <td style={{ padding:'9px 12px', fontSize:10, color:'#9CA3AF' }}>
                          {u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleString('es-EC',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}) : 'Nunca'}
                        </td>
                        <td style={{ padding:'9px 12px' }}>
                          <div style={{ display:'flex', gap:4, justifyContent:'center' }}>
                            <button onClick={()=>toggleStatus(u.id,u.estado)} title={u.estado==='activo'?'Suspender':'Activar'}
                              style={{ width:26, height:26, borderRadius:5, border:'0.5px solid #E5E7EB', background:'#F9FAFB', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#6B7280' }}>
                              <i className={`ti ti-${u.estado==='activo'?'ban':'circle-check'}`} style={{ fontSize:12 }} />
                            </button>
                            <button title="Editar" onClick={()=>{
                                setForm({nombre:u.nombre_completo||'',email:u.email||'',password:'',cedula:u.cedula||'',telefono:u.telefono||'',estado:u.estado||'activo',plantel_id:''})
                                setSelectedRol(u.rol)
                                setTab('nuevo')
                              }}
                              style={{ width:26, height:26, borderRadius:5, border:'0.5px solid #E5E7EB', background:'#F9FAFB', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#6B7280' }}>
                              <i className="ti ti-edit" style={{ fontSize:12 }} />
                            </button>
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

      {/* NUEVO */}
      {tab==='nuevo' && (
        <div style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:12, overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:'0.5px solid #F3F4F6' }}>
            <span style={{ fontSize:12, fontWeight:600, color:'#0F2B5B', display:'flex', alignItems:'center', gap:5 }}>
              <i className="ti ti-user-plus" />Crear nuevo usuario
            </span>
          </div>
          <div style={{ padding:18 }}>
            {/* Selector de rol */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10, fontWeight:600, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:8 }}>Rol del usuario *</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8 }}>
                {Object.entries(ROL_INFO).map(([rol,info])=>(
                  <div key={rol} onClick={()=>setSelectedRol(rol)}
                    style={{ border:`0.5px solid ${selectedRol===rol?'#0F2B5B':'#E5E7EB'}`, borderRadius:8, padding:'10px 6px', cursor:'pointer', textAlign:'center',
                      background: selectedRol===rol?'rgba(15,43,91,.06)':'#F9FAFB', transition:'all .15s' }}>
                    <div style={{ fontSize:20, marginBottom:4 }}>{info.emoji}</div>
                    <div style={{ fontSize:10, fontWeight:600, color:'#1A2B4A' }}>{rol}</div>
                    <div style={{ fontSize:9, color:'#9CA3AF', marginTop:2, lineHeight:1.3 }}>{info.label}</div>
                  </div>
                ))}
              </div>
              {/* Permisos del rol seleccionado */}
              <div style={{ marginTop:8, background:'#F9FAFB', borderRadius:8, padding:'10px 12px', border:'0.5px solid #E5E7EB' }}>
                <div style={{ fontSize:11, fontWeight:600, color:'#0F2B5B', marginBottom:6 }}>
                  {ROL_INFO[selectedRol]?.emoji} Permisos de {selectedRol}:
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:4 }}>
                  {(PERMS[selectedRol]||[]).map((p,i)=>(
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'#374151' }}>
                      <i className="ti ti-circle-check" style={{ fontSize:11, color:'#16A34A', flexShrink:0 }} />{p}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Datos */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              {[
                { id:'nombre', lbl:'Nombre completo', ph:'Apellidos y nombres', req:true },
                { id:'cedula', lbl:'Cédula', ph:'0000000000', mono:true },
              ].map(f=>(
                <div key={f.id}>
                  <div style={{ fontSize:10, fontWeight:600, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:4 }}>{f.lbl}{f.req&&<span style={{color:'#DC2626'}}> *</span>}</div>
                  <input value={form[f.id]} onChange={e=>setForm({...form,[f.id]:e.target.value})} placeholder={f.ph}
                    style={{ width:'100%', height:34, border:'0.5px solid #E5E7EB', borderRadius:7, padding:'0 10px', fontSize:12, background:'#F9FAFB', fontFamily: f.mono?'monospace':'inherit', boxSizing:'border-box' }} />
                </div>
              ))}
              <div style={{ gridColumn:'span 2' }}>
                <div style={{ fontSize:10, fontWeight:600, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:4 }}>Email <span style={{color:'#DC2626'}}>*</span></div>
                <input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="correo@institución.edu.ec"
                  style={{ width:'100%', height:34, border:'0.5px solid #E5E7EB', borderRadius:7, padding:'0 10px', fontSize:12, background:'#F9FAFB', boxSizing:'border-box' }} />
              </div>
              <div>
                <div style={{ fontSize:10, fontWeight:600, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:4 }}>Contraseña <span style={{color:'#DC2626'}}>*</span></div>
                <div style={{ position:'relative' }}>
                  <input type={showPass?'text':'password'} value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Mínimo 8 caracteres"
                    style={{ width:'100%', height:34, border:'0.5px solid #E5E7EB', borderRadius:7, padding:'0 32px 0 10px', fontSize:12, background:'#F9FAFB', boxSizing:'border-box' }} />
                  <button type="button" onClick={()=>setShowPass(!showPass)} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', border:'none', background:'none', cursor:'pointer', color:'#9CA3AF' }}>
                    <i className={`ti ti-${showPass?'eye-off':'eye'}`} style={{ fontSize:14 }} />
                  </button>
                </div>
                <button type="button" onClick={()=>setForm({...form,password:generatePassword()})} style={{ fontSize:10, color:'#0F2B5B', border:'none', background:'none', cursor:'pointer', marginTop:3, display:'flex', alignItems:'center', gap:3 }}>
                  <i className="ti ti-refresh" style={{ fontSize:11 }} />Generar contraseña segura
                </button>
              </div>
              <div>
                <div style={{ fontSize:10, fontWeight:600, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:4 }}>Teléfono</div>
                <input value={form.telefono} onChange={e=>setForm({...form,telefono:e.target.value})} placeholder="09XXXXXXXX"
                  style={{ width:'100%', height:34, border:'0.5px solid #E5E7EB', borderRadius:7, padding:'0 10px', fontSize:12, background:'#F9FAFB', boxSizing:'border-box' }} />
              </div>
              <div>
                <div style={{ fontSize:10, fontWeight:600, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:4 }}>Estado inicial</div>
                <select value={form.estado} onChange={e=>setForm({...form,estado:e.target.value})}
                  style={{ width:'100%', height:34, border:'0.5px solid #E5E7EB', borderRadius:7, padding:'0 10px', fontSize:12, background:'#F9FAFB', boxSizing:'border-box' }}>
                  <option value="activo">Activo — acceso inmediato</option>
                  <option value="inactivo">Inactivo — sin acceso</option>
                  <option value="suspendido">Suspendido</option>
                </select>
              </div>
            </div>

            {formAlert && (
              <div style={{ borderRadius:8, padding:'10px 14px', fontSize:12, display:'flex', alignItems:'center', gap:7, marginBottom:12,
                background:formAlert.type==='ok'?'rgba(22,163,74,.08)':'rgba(220,38,38,.06)',
                border:`0.5px solid ${formAlert.type==='ok'?'rgba(22,163,74,.25)':'rgba(220,38,38,.2)'}`,
                color:formAlert.type==='ok'?'#15803d':'#B91C1C' }}>
                <i className={`ti ti-${formAlert.type==='ok'?'circle-check':'alert-circle'}`} style={{ fontSize:14 }} />
                <span dangerouslySetInnerHTML={{__html:formAlert.msg}} />
              </div>
            )}

            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={()=>setTab('lista')} style={{ height:34, padding:'0 16px', border:'0.5px solid #E5E7EB', borderRadius:7, background:'#fff', fontSize:12, cursor:'pointer' }}>
                Cancelar
              </button>
              <button onClick={handleCreate} disabled={saving}
                style={{ height:34, padding:'0 18px', background:saving?'#6B7280':'#0F2B5B', border:'none', borderRadius:7, color:'#fff', fontSize:12, fontWeight:500, cursor:saving?'not-allowed':'pointer', display:'flex', alignItems:'center', gap:5 }}>
                <i className={`ti ti-${saving?'loader':'user-plus'}`} style={{ fontSize:13 }} />
                {saving?'Creando…':'Crear usuario'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PERMISOS */}
      {tab==='permisos' && (
        <div style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:12, overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:'0.5px solid #F3F4F6' }}>
            <span style={{ fontSize:12, fontWeight:600, color:'#0F2B5B', display:'flex', alignItems:'center', gap:5 }}>
              <i className="ti ti-shield" />Matriz de permisos por rol — SIGEE
            </span>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
              <thead><tr>
                <th style={{ textAlign:'left', padding:'0 12px 8px', fontSize:10, fontWeight:600, color:'#9CA3AF', textTransform:'uppercase', borderBottom:'0.5px solid #F3F4F6', minWidth:160 }}>Módulo</th>
                {Object.entries(ROL_INFO).map(([r,i])=>(
                  <th key={r} style={{ textAlign:'center', padding:'0 8px 8px', fontSize:10, fontWeight:600, color:'#9CA3AF', textTransform:'uppercase', borderBottom:'0.5px solid #F3F4F6' }}>{i.emoji}<br/>{r}</th>
                ))}
              </tr></thead>
              <tbody>
                {[
                  ['Planteles — ver',       ['✅ Todos','✅ El suyo','❌','❌','❌']],
                  ['Planteles — editar',    ['✅','✅ El suyo','❌','❌','❌']],
                  ['Docentes — gestionar',  ['✅ Todos','✅ Su plantel','❌','❌','❌']],
                  ['Estudiantes — ver',     ['✅ Todos','✅ Su plantel','✅ Sus cursos','❌','❌']],
                  ['Estudiantes — crear',   ['✅','✅','❌','❌','❌']],
                  ['Cursos y Materias',     ['✅','✅','👁️ Ver','👁️ Los suyos','❌']],
                  ['Matrículas',            ['✅','✅','❌','👁️ La propia','👁️ Representado']],
                  ['Calificaciones — ver',  ['✅','✅','✅ Sus materias','✅ Las propias','✅ Representado']],
                  ['Calificaciones — editar',['✅','✅','✅ Sus materias','❌','❌']],
                  ['Asistencia — ver',      ['✅','✅','✅ Sus cursos','✅ La propia','✅ Representado']],
                  ['Asistencia — registrar',['✅','✅','✅ Sus cursos','❌','❌']],
                  ['Horarios',              ['✅','✅','✅ Los propios','✅ El propio','✅ Representado']],
                  ['Períodos académicos',   ['✅','✅','👁️ Ver','❌','❌']],
                  ['Usuarios — crear',      ['✅','✅ Limitado','❌','❌','❌']],
                  ['Reportes',              ['✅ Todos','✅ Su plantel','❌','❌','❌']],
                  ['WhatsApp asistencia',   ['✅','✅','✅','❌','❌']],
                  ['Configuración sistema', ['✅','❌','❌','❌','❌']],
                ].map(([modulo,perms],i)=>(
                  <tr key={i} style={{ borderBottom:'0.5px solid #F9FAFB' }}>
                    <td style={{ padding:'8px 12px', fontWeight:500, fontSize:11 }}>{modulo}</td>
                    {perms.map((p,j)=>(
                      <td key={j} style={{ padding:'8px', textAlign:'center', fontSize:11,
                        color: p.startsWith('✅')?'#15803d': p==='❌'?'#D1D5DB': '#D97706' }}>
                        {p}
                      </td>
                    ))}
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
