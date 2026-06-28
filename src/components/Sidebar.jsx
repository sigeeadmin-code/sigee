import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const NAV=[
  {s:'Principal'},
  {to:'/dashboard',     ico:'ti-layout-dashboard',    lbl:'Dashboard',       roles:['super_admin','admin_plantel','docente','alumno','padre']},
  {to:'/planteles',     ico:'ti-building-community',  lbl:'Planteles',       roles:['super_admin','admin_plantel'], badge:'709'},
  {s:'Académico'},
  {to:'/docentes',      ico:'ti-users',               lbl:'Docentes',        roles:['super_admin','admin_plantel'], badge:'100'},
  {to:'/estudiantes',   ico:'ti-school',              lbl:'Estudiantes',     roles:['super_admin','admin_plantel','docente']},
  {to:'/cursos',        ico:'ti-books',               lbl:'Cursos',          roles:['super_admin','admin_plantel','docente']},
  {to:'/materias',      ico:'ti-book',                lbl:'Materias',        roles:['super_admin','admin_plantel','docente']},
  {to:'/matriculas',    ico:'ti-file-certificate',    lbl:'Matrículas',      roles:['super_admin','admin_plantel']},
  {to:'/calificaciones',ico:'ti-chart-line',          lbl:'Calificaciones',  roles:['super_admin','admin_plantel','docente','alumno']},
  {s:'Gestión'},
  {to:'/horarios',      ico:'ti-calendar-time',       lbl:'Horarios',        roles:['super_admin','admin_plantel','docente','alumno','padre']},
  {to:'/periodos',      ico:'ti-calendar-event',      lbl:'Períodos',        roles:['super_admin','admin_plantel']},
  {to:'/asistencia',    ico:'ti-checklist',           lbl:'Asistencia',      roles:['super_admin','admin_plantel','docente']},
  {s:'Sistema'},
  {to:'/usuarios',      ico:'ti-user-cog',            lbl:'Usuarios',        roles:['super_admin']},
  {to:'/reportes',      ico:'ti-report',              lbl:'Reportes',        roles:['super_admin','admin_plantel']},
  {to:'/configuracion', ico:'ti-settings',            lbl:'Configuración',   roles:['super_admin']},
]

export default function Sidebar(){
  const {profile,signOut,rol}=useAuth()
  const navigate=useNavigate()
  const ini=(profile?.nombre_completo||'SA').split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()
  return(
    <aside style={{width:210,background:'#0F2B5B',display:'flex',flexDirection:'column',flexShrink:0,height:'100vh',position:'sticky',top:0}}>
      <div style={{padding:'14px 13px',borderBottom:'0.5px solid rgba(255,255,255,.1)',display:'flex',alignItems:'center',gap:9}}>
        <div style={{width:30,height:30,background:'#FFD100',borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <i className="ti ti-school" style={{fontSize:16,color:'#0F2B5B'}}/>
        </div>
        <div><div style={{fontSize:13,fontWeight:700,color:'#fff'}}>SIGEE</div><div style={{fontSize:9,color:'rgba(255,255,255,.4)'}}>GESTIÓN EDUCATIVA</div></div>
      </div>
      <div style={{padding:'10px 12px',borderBottom:'0.5px solid rgba(255,255,255,.08)',display:'flex',alignItems:'center',gap:8}}>
        <div style={{width:28,height:28,borderRadius:'50%',background:'#FFD100',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'#0F2B5B',flexShrink:0}}>{ini}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:11,fontWeight:500,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{profile?.nombre_completo||'Usuario'}</div>
          <div style={{fontSize:9,color:'rgba(255,209,0,.8)',marginTop:1}}>{rol}</div>
        </div>
      </div>
      <nav style={{flex:1,padding:'8px 6px',overflowY:'auto'}}>
        {NAV.map((item,i)=>{
          if(item.s) return <div key={i} style={{fontSize:9,fontWeight:600,color:'rgba(255,255,255,.3)',letterSpacing:'1.2px',padding:'0 6px',margin:'10px 0 4px',textTransform:'uppercase'}}>{item.s}</div>
          if(item.roles&&!item.roles.includes(rol)) return null
          return(
            <NavLink key={item.to} to={item.to} style={({isActive})=>({
              display:'flex',alignItems:'center',gap:7,padding:'6px 8px',borderRadius:6,
              color:isActive?'#0F2B5B':'rgba(255,255,255,.65)',fontSize:12,textDecoration:'none',
              background:isActive?'#FFD100':'transparent',fontWeight:isActive?600:400,marginBottom:1
            })}>
              <i className={`ti ${item.ico}`} style={{fontSize:14,flexShrink:0}}/>
              <span style={{flex:1}}>{item.lbl}</span>
              {item.badge&&<span style={{fontSize:9,padding:'1px 5px',borderRadius:7,background:'rgba(255,255,255,.12)',color:'rgba(255,255,255,.7)'}}>{item.badge}</span>}
            </NavLink>
          )
        })}
      </nav>
      <button onClick={()=>signOut().then(()=>navigate('/login'))}
        style={{margin:'8px 10px',padding:'8px 10px',border:'none',borderRadius:7,background:'rgba(255,255,255,.08)',color:'rgba(255,255,255,.6)',fontSize:12,cursor:'pointer',display:'flex',alignItems:'center',gap:7}}>
        <i className="ti ti-logout" style={{fontSize:14}}/>Cerrar sesión
      </button>
    </aside>
  )
}
