import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const CARGOS = ['Rector/a','Vicerrector/a','Secretario/a','Inspector/a','Contador/a','Bibliotecario/a','Conserje','Guardia']
const SITUACIONES = ['NOMBRAMIENTO','CONTRATO','NOMBRAMIENTO PROVISIONAL','COM. SERV. SIN SUELDO']
const SIT_COLOR = {
  'NOMBRAMIENTO': { bg:'rgba(15,43,91,.08)', c:'#0F2B5B' },
  'CONTRATO': { bg:'rgba(217,119,6,.1)', c:'#D97706' },
  'NOMBRAMIENTO PROVISIONAL': { bg:'rgba(8,145,178,.08)', c:'#0891B2' },
  'COM. SERV. SIN SUELDO': { bg:'rgba(83,74,183,.08)', c:'#534AB7' },
}

function EditAdmModal({ adm, planteles, onClose, onSaved }) {
  const [form, setForm] = useState(Object.assign({}, adm))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const set = (k,v) => setForm(f => Object.assign({}, f, { [k]: v }))

  const handleSave = async () => {
    if (!String(form.nombres||'').trim() || !String(form.apellidos||'').trim()) { setErr('Nombres y apellidos requeridos'); return }
    setSaving(true)
    const payload = {
      nombres: form.nombres, apellidos: form.apellidos, cedula: form.cedula||null,
      cargo: form.cargo, situacion: form.situacion, departamento: form.departamento||null,
      genero: form.genero||null, fecha_ingreso: form.fecha_ingreso||null,
      email_personal: form.email_personal||null, telefono: form.telefono||null,
      direccion: form.direccion||null, plantel_id: form.plantel_id||null, activo: form.activo
    }
    const resp = adm.id
      ? await supabase.from('administrativos').update(payload).eq('id', adm.id)
      : await supabase.from('administrativos').insert(payload)
    setSaving(false)
    if (resp.error) { setErr(resp.error.message); return }
    onSaved()
  }

  const Field = (p) => (
    <div style={{gridColumn: p.span===2 ? 'span 2' : 'auto'}}>
      <div style={{fontSize:10,color:'#9CA3AF',marginBottom:3}}>{p.lbl}</div>
      {p.opts ? (
        <select value={form[p.id]||''} onChange={e=>set(p.id,e.target.value)}
          style={{width:'100%',height:32,border:'0.5px solid #E5E7EB',borderRadius:6,padding:'0 8px',fontSize:12,background:'#F9FAFB'}}>
          <option value="">—</option>
          {p.opts.map(o => <option key={o.v||o} value={o.v||o}>{o.l||o}</option>)}
        </select>
      ) : (
        <input type={p.type||'text'} value={form[p.id]||''} onChange={e=>set(p.id,e.target.value)}
          style={{width:'100%',height:32,border:'0.5px solid #E5E7EB',borderRadius:6,padding:'0 8px',fontSize:12,background:'#F9FAFB',boxSizing:'border-box',fontFamily:p.id==='cedula'?'monospace':'inherit'}}/>
      )}
    </div>
  )

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1100,padding:20}} onClick={onClose}>
      <div style={{background:'#fff',borderRadius:14,maxWidth:700,width:'100%',maxHeight:'88vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:'16px 20px',borderBottom:'0.5px solid #F3F4F6',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,background:'#fff'}}>
          <span style={{fontSize:14,fontWeight:700,color:'#0F2B5B'}}>
            <i className={adm.id ? 'ti ti-edit' : 'ti ti-user-plus'} style={{marginRight:6}}></i>
            {adm.id ? 'Editar Administrativo' : 'Nuevo Administrativo'}
          </span>
          <button onClick={onClose} style={{border:'none',background:'none',fontSize:18,cursor:'pointer',color:'#9CA3AF'}}>×</button>
        </div>
        <div style={{padding:20}}>
          {err ? <div style={{background:'rgba(220,38,38,.06)',border:'0.5px solid rgba(220,38,38,.2)',borderRadius:8,padding:'9px 12px',fontSize:12,color:'#B91C1C',marginBottom:14}}>{err}</div> : null}

          <div style={{fontSize:10,fontWeight:700,color:'#0F2B5B',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:8,borderBottom:'0.5px solid #F3F4F6',paddingBottom:5}}>Identificación</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:18}}>
            <Field id="apellidos" lbl="Apellidos"/>
            <Field id="nombres" lbl="Nombres"/>
            <Field id="cedula" lbl="Cédula"/>
            <Field id="genero" lbl="Género" opts={['Masculino','Femenino']}/>
          </div>

          <div style={{fontSize:10,fontWeight:700,color:'#0F2B5B',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:8,borderBottom:'0.5px solid #F3F4F6',paddingBottom:5}}>Asignación y cargo</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:18}}>
            <Field id="plantel_id" lbl="Plantel (AMIE)" span={2} opts={planteles.map(p=>({v:p.id,l:`${p.codigo_amie} — ${p.nombre}`}))}/>
            <Field id="cargo" lbl="Cargo" opts={CARGOS}/>
            <Field id="situacion" lbl="Situación laboral" opts={SITUACIONES}/>
            <Field id="departamento" lbl="Departamento"/>
            <Field id="fecha_ingreso" lbl="Fecha de ingreso" type="date"/>
          </div>

          <div style={{fontSize:10,fontWeight:700,color:'#0F2B5B',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:8,borderBottom:'0.5px solid #F3F4F6',paddingBottom:5}}>Contacto</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:18}}>
            <Field id="email_personal" lbl="Email" type="email"/>
            <Field id="telefono" lbl="Teléfono"/>
            <Field id="direccion" lbl="Dirección" span={2}/>
          </div>

          <label style={{display:'flex',alignItems:'center',gap:8,fontSize:12,cursor:'pointer',marginBottom:16}}>
            <input type="checkbox" checked={!!form.activo} onChange={e=>set('activo',e.target.checked)}/>
            Administrativo activo
          </label>

          <div style={{display:'flex',justifyContent:'flex-end',gap:8,paddingTop:10,borderTop:'0.5px solid #F3F4F6'}}>
            <button onClick={onClose} style={{height:34,padding:'0 16px',border:'0.5px solid #E5E7EB',borderRadius:7,background:'#fff',fontSize:12,cursor:'pointer'}}>Cancelar</button>
            <button onClick={handleSave} disabled={saving}
              style={{height:34,padding:'0 18px',background: saving ? '#6B7280' : '#0F2B5B',border:'none',borderRadius:7,color:'#fff',fontSize:12,cursor: saving ? 'not-allowed' : 'pointer',display:'flex',alignItems:'center',gap:5}}>
              <i className={saving ? 'ti ti-loader' : 'ti ti-device-floppy'} style={{fontSize:13}}></i>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Administrativos() {
  const [data, setData] = useState([])
  const [planteles, setPlanteles] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroPlantel, setFiltroPlantel] = useState('')
  const [filtroCargo, setFiltroCargo] = useState('')
  const [editing, setEditing] = useState(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const [{ data: rows }, { data: pls }] = await Promise.all([
      supabase.from('administrativos').select('*, planteles(codigo_amie,nombre)').eq('desvinculado', false).order('apellidos'),
      supabase.from('planteles').select('id,codigo_amie,nombre').order('nombre').limit(709)
    ])
    setData(rows||[]); setPlanteles(pls||[]); setLoading(false)
  }

  const handleDesvincular = async (a) => {
    if (!window.confirm(`¿Retirar a ${a.nombres} ${a.apellidos} de su plantel?`)) return
    await supabase.from('administrativos').update({ desvinculado:true }).eq('id', a.id)
    load()
  }
  const handleDelete = async (a) => {
    if (!window.confirm(`¿Eliminar definitivamente a ${a.nombres} ${a.apellidos}?`)) return
    await supabase.from('administrativos').delete().eq('id', a.id)
    load()
  }

  const filtered = data.filter(a => {
    const q = search.toLowerCase()
    const matchQ = !q || `${a.nombres} ${a.apellidos} ${a.cedula||''}`.toLowerCase().includes(q)
    const matchP = !filtroPlantel || a.plantel_id === filtroPlantel
    const matchC = !filtroCargo || a.cargo === filtroCargo
    return matchQ && matchP && matchC
  })

  const sinAsignar = data.filter(a => !a.plantel_id).length

  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
        {[
          {val:data.length, lbl:'Total administrativos', c:'#0F2B5B'},
          {val:data.filter(a=>a.activo).length, lbl:'Activos', c:'#16A34A'},
          {val:sinAsignar, lbl:'Sin plantel asignado', c:'#D97706'},
          {val:planteles.length, lbl:'Planteles disponibles', c:'#534AB7'},
        ].map((s,i)=>(
          <div key={i} style={{background:'#F9FAFB',borderRadius:10,padding:12,border:'0.5px solid #E5E7EB',position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',top:0,right:0,width:3,height:'100%',background:s.c}}/>
            <div style={{fontSize:22,fontWeight:700,color:s.c}}>{s.val}</div>
            <div style={{fontSize:10,color:'#9CA3AF',marginTop:2}}>{s.lbl}</div>
          </div>
        ))}
      </div>

      <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
        <div style={{position:'relative',flex:1,minWidth:160}}>
          <i className="ti ti-search" style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',color:'#9CA3AF',fontSize:13}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nombre o cédula..."
            style={{width:'100%',height:34,border:'0.5px solid #E5E7EB',borderRadius:7,padding:'0 10px 0 28px',fontSize:12,background:'#F9FAFB',boxSizing:'border-box'}}/>
        </div>
        <select value={filtroPlantel} onChange={e=>setFiltroPlantel(e.target.value)}
          style={{height:34,border:'0.5px solid #E5E7EB',borderRadius:7,fontSize:12,padding:'0 10px',background:'#F9FAFB'}}>
          <option value="">Todos los planteles</option>
          <option value="__none__" disabled>— Filtrar por AMIE —</option>
          {planteles.map(p=><option key={p.id} value={p.id}>{p.codigo_amie} — {p.nombre}</option>)}
        </select>
        <select value={filtroCargo} onChange={e=>setFiltroCargo(e.target.value)}
          style={{height:34,border:'0.5px solid #E5E7EB',borderRadius:7,fontSize:12,padding:'0 10px',background:'#F9FAFB'}}>
          <option value="">Todos los cargos</option>
          {CARGOS.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={()=>setEditing({})}
          style={{height:34,padding:'0 14px',background:'#0F2B5B',border:'none',borderRadius:7,color:'#fff',fontSize:12,cursor:'pointer',display:'flex',alignItems:'center',gap:5}}>
          <i className="ti ti-plus" style={{fontSize:13}}/>Nuevo administrativo
        </button>
      </div>

      <div style={{background:'#fff',border:'0.5px solid #E5E7EB',borderRadius:12,overflow:'hidden'}}>
        <div style={{padding:'12px 16px',borderBottom:'0.5px solid #F3F4F6'}}>
          <span style={{fontSize:12,fontWeight:600,color:'#0F2B5B'}}>{filtered.length} de {data.length} administrativos</span>
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead><tr>
              {['AMIE','Plantel','Cédula','Nombre','Cargo','Situación','Departamento','Acciones'].map(h=>(
                <th key={h} style={{textAlign:'left',padding:'0 12px 8px',fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',borderBottom:'0.5px solid #F3F4F6'}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={8} style={{textAlign:'center',padding:28,color:'#9CA3AF'}}>Cargando…</td></tr>
              : filtered.length===0 ? <tr><td colSpan={8} style={{textAlign:'center',padding:28,color:'#9CA3AF'}}>Sin resultados</td></tr>
              : filtered.map(a => {
                const sc = SIT_COLOR[a.situacion] || { bg:'#F3F4F6', c:'#9CA3AF' }
                return (
                  <tr key={a.id} style={{borderBottom:'0.5px solid #F9FAFB'}}>
                    <td style={{padding:'9px 12px'}}>
                      {a.planteles ? <span style={{fontFamily:'monospace',fontSize:11,fontWeight:700,background:'#eff6ff',color:'#1d4ed8',border:'1px solid #bfdbfe',borderRadius:7,padding:'3px 9px'}}>{a.planteles.codigo_amie}</span>
                        : <span style={{fontSize:10,color:'#D97706',background:'rgba(217,119,6,.08)',padding:'3px 8px',borderRadius:7}}>Sin asignar</span>}
                    </td>
                    <td style={{padding:'9px 12px',fontSize:11,color:'#6B7280',maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.planteles?.nombre||'—'}</td>
                    <td style={{padding:'9px 12px',fontFamily:'monospace',fontSize:11,color:'#6B7280'}}>{a.cedula||'—'}</td>
                    <td style={{padding:'9px 12px',fontWeight:500}}>{a.apellidos}, {a.nombres}</td>
                    <td style={{padding:'9px 12px',color:'#6B7280'}}>{a.cargo||'—'}</td>
                    <td style={{padding:'9px 12px'}}><span style={{fontSize:10,padding:'2px 7px',borderRadius:9,fontWeight:500,background:sc.bg,color:sc.c}}>{a.situacion}</span></td>
                    <td style={{padding:'9px 12px',color:'#6B7280',fontSize:11}}>{a.departamento||'—'}</td>
                    <td style={{padding:'9px 12px'}}>
                      <div style={{display:'flex',gap:4}}>
                        <button onClick={()=>setEditing(a)} title="Editar" style={{width:26,height:26,borderRadius:5,border:'0.5px solid #E5E7EB',background:'#F9FAFB',cursor:'pointer',color:'#0F2B5B'}}><i className="ti ti-edit" style={{fontSize:12}}/></button>
                        <button onClick={()=>handleDesvincular(a)} title="Retirar" style={{width:26,height:26,borderRadius:5,border:'0.5px solid rgba(217,119,6,.2)',background:'rgba(217,119,6,.05)',cursor:'pointer',color:'#D97706'}}><i className="ti ti-logout" style={{fontSize:12}}/></button>
                        <button onClick={()=>handleDelete(a)} title="Eliminar" style={{width:26,height:26,borderRadius:5,border:'0.5px solid rgba(220,38,38,.2)',background:'rgba(220,38,38,.04)',cursor:'pointer',color:'#DC2626'}}><i className="ti ti-trash" style={{fontSize:12}}/></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editing && <EditAdmModal adm={editing} planteles={planteles} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);load()}}/>}
    </div>
  )
}
