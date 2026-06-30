import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const sitColors = {
  Nombramiento: { bg: 'rgba(15,43,91,.08)', color: '#0F2B5B' },
  Contrato:     { bg: 'rgba(217,119,6,.1)', color: '#D97706' },
  Reemplazo:    { bg: 'rgba(220,38,38,.08)', color: '#DC2626' },
  Provisional:  { bg: 'rgba(107,114,128,.1)', color: '#6B7280' }
}

function EditDocenteModal({ docente, onClose, onSaved }) {
  const [form, setForm] = useState(Object.assign({}, docente))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const set = (k,v) => setForm(f => Object.assign({}, f, { [k]: v }))

  const handleSave = async () => {
    if (!String(form.apellidos||'').trim() || !String(form.nombres||'').trim()) {
      setErr('Apellidos y nombres son obligatorios'); return
    }
    setSaving(true)
    const payload = {
      apellidos: form.apellidos, nombres: form.nombres, cedula: form.cedula,
      situacion_laboral: form.situacion_laboral, categoria: form.categoria, escalafon: form.escalafon,
      email_personal: form.email_personal, telefono: form.telefono, direccion: form.direccion,
      fecha_nacimiento: form.fecha_nacimiento || null, genero: form.genero, activo: form.activo
    }
    const resp = await supabase.from('docentes').update(payload).eq('id', docente.id)
    setSaving(false)
    if (resp.error) { setErr(resp.error.message); return }
    onSaved()
  }

  const Field = (props) => (
    <div style={{gridColumn: props.span===2 ? 'span 2' : 'auto'}}>
      <div style={{fontSize:10,color:'#9CA3AF',marginBottom:3}}>{props.lbl}</div>
      {props.opts ? (
        <select value={form[props.id]||''} onChange={e=>set(props.id, e.target.value)}
          style={{width:'100%',height:32,border:'0.5px solid #E5E7EB',borderRadius:6,padding:'0 8px',fontSize:12,background:'#F9FAFB'}}>
          <option value="">—</option>
          {props.opts.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={props.type||'text'} value={form[props.id]||''} onChange={e=>set(props.id, e.target.value)}
          style={{width:'100%',height:32,border:'0.5px solid #E5E7EB',borderRadius:6,padding:'0 8px',fontSize:12,background:'#F9FAFB',boxSizing:'border-box',fontFamily:props.id==='cedula'?'monospace':'inherit'}}/>
      )}
    </div>
  )

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1100,padding:20}} onClick={onClose}>
      <div style={{background:'#fff',borderRadius:14,maxWidth:700,width:'100%',maxHeight:'88vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:'16px 20px',borderBottom:'0.5px solid #F3F4F6',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,background:'#fff'}}>
          <span style={{fontSize:14,fontWeight:700,color:'#0F2B5B'}}>
            <i className="ti ti-edit" style={{marginRight:6}}></i>
            Editar Docente
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
            <Field id="fecha_nacimiento" lbl="Fecha de nacimiento" type="date"/>
            <Field id="genero" lbl="Género" opts={['Masculino','Femenino','No especificado']}/>
          </div>

          <div style={{fontSize:10,fontWeight:700,color:'#0F2B5B',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:8,borderBottom:'0.5px solid #F3F4F6',paddingBottom:5}}>Datos profesionales</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:18}}>
            <Field id="situacion_laboral" lbl="Situación laboral" opts={['Nombramiento','Contrato','Reemplazo','Provisional']}/>
            <Field id="categoria" lbl="Categoría" opts={['Docente','Directivo','Administrativo']}/>
            <Field id="escalafon" lbl="Escalafón"/>
          </div>

          <div style={{fontSize:10,fontWeight:700,color:'#0F2B5B',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:8,borderBottom:'0.5px solid #F3F4F6',paddingBottom:5}}>Contacto</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:18}}>
            <Field id="email_personal" lbl="Email personal" type="email" span={2}/>
            <Field id="telefono" lbl="Teléfono"/>
            <Field id="direccion" lbl="Dirección" span={2}/>
          </div>

          <label style={{display:'flex',alignItems:'center',gap:8,fontSize:12,cursor:'pointer',marginBottom:16}}>
            <input type="checkbox" checked={!!form.activo} onChange={e=>set('activo', e.target.checked)}/>
            Docente activo
          </label>

          <div style={{display:'flex',justifyContent:'flex-end',gap:8,paddingTop:10,borderTop:'0.5px solid #F3F4F6'}}>
            <button onClick={onClose} style={{height:34,padding:'0 16px',border:'0.5px solid #E5E7EB',borderRadius:7,background:'#fff',fontSize:12,cursor:'pointer'}}>Cancelar</button>
            <button onClick={handleSave} disabled={saving}
              style={{height:34,padding:'0 18px',background: saving ? '#6B7280' : '#0F2B5B',border:'none',borderRadius:7,color:'#fff',fontSize:12,cursor: saving ? 'not-allowed' : 'pointer',display:'flex',alignItems:'center',gap:5}}>
              <i className={saving ? 'ti ti-loader' : 'ti ti-device-floppy'} style={{fontSize:13}}></i>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Docentes() {
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const [{ data: rows }, cnt] = await Promise.all([
      supabase.from('docentes').select('*').order('apellidos').limit(100),
      supabase.from('docentes').select('*', { count:'exact', head:true })
    ])
    setData(rows||[]); setTotal(cnt.count||0); setLoading(false)
  }

  const filtered = data.filter(d => !search || `${d.apellidos} ${d.nombres} ${d.cedula}`.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div style={{position:'relative',marginBottom:14}}>
        <i className="ti ti-search" style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',color:'#9CA3AF',fontSize:13}}/>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Buscar entre ${total} docentes...`}
          style={{width:'100%',height:34,border:'0.5px solid #E5E7EB',borderRadius:7,padding:'0 10px 0 28px',fontSize:12,background:'#F9FAFB',boxSizing:'border-box'}}/>
      </div>
      <div style={{background:'#fff',border:'0.5px solid #E5E7EB',borderRadius:12,overflow:'hidden'}}>
        <div style={{padding:'12px 16px',borderBottom:'0.5px solid #F3F4F6'}}>
          <span style={{fontSize:12,fontWeight:600,color:'#0F2B5B'}}>
            <i className="ti ti-users" style={{marginRight:5}}/>{filtered.length} de {total} docentes
            <span style={{fontSize:10,color:'#9CA3AF',marginLeft:8,fontWeight:400}}>· clic en editar para modificar datos personales</span>
          </span>
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead><tr>
              {['#','Nombre','Cédula','Situación','Categoría','Escalafón','Estado','Acción'].map(h=>(
                <th key={h} style={{textAlign:'left',padding:'0 12px 8px',fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',borderBottom:'0.5px solid #F3F4F6'}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={8} style={{textAlign:'center',padding:28,color:'#9CA3AF'}}>Cargando desde Supabase…</td></tr>
                : filtered.map((d,i) => {
                  const sc = sitColors[d.situacion_laboral] || { bg: 'rgba(107,114,128,.1)', color: '#6B7280' }
                  return (
                    <tr key={d.id} style={{borderBottom:'0.5px solid #F9FAFB'}}>
                      <td style={{padding:'9px 12px',fontSize:10,color:'#9CA3AF'}}>{i+1}</td>
                      <td style={{padding:'9px 12px',fontWeight:500}}>{d.apellidos}, {d.nombres}</td>
                      <td style={{padding:'9px 12px',fontFamily:'monospace',fontSize:11,color:'#6B7280'}}>{d.cedula}</td>
                      <td style={{padding:'9px 12px'}}><span style={{fontSize:10,padding:'2px 7px',borderRadius:9,fontWeight:500,background:sc.bg,color:sc.color}}>{d.situacion_laboral || '—'}</span></td>
                      <td style={{padding:'9px 12px',color:'#6B7280'}}>{d.categoria || '—'}</td>
                      <td style={{padding:'9px 12px',fontWeight:600,color:'#0F2B5B'}}>{d.escalafon || '—'}</td>
                      <td style={{padding:'9px 12px'}}><span style={{fontSize:10,padding:'2px 7px',borderRadius:9,fontWeight:500,background:d.activo?'rgba(22,163,74,.1)':'rgba(220,38,38,.08)',color:d.activo?'#15803d':'#DC2626'}}>{d.activo?'Activo':'Inactivo'}</span></td>
                      <td style={{padding:'9px 12px'}}>
                        <button onClick={()=>setEditing(d)} title="Editar docente"
                          style={{width:26,height:26,borderRadius:5,border:'0.5px solid #E5E7EB',background:'#F9FAFB',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#0F2B5B'}}>
                          <i className="ti ti-edit" style={{fontSize:12}}/>
                        </button>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <EditDocenteModal docente={editing} onClose={()=>setEditing(null)}
          onSaved={()=>{ setEditing(null); load() }}/>
      )}
    </div>
  )
}
