import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const MATERIAS_BASE = [
  'Matemáticas','Lengua y Literatura','Ciencias Naturales','Ciencias Sociales',
  'Inglés','Educación Física','Física','Química','Biología','Historia',
  'Filosofía','Emprendimiento','Educación Cultural y Artística','Informática'
]
const COLORES = ['#0F2B5B','#16A34A','#534AB7','#D97706','#0891B2','#DC2626','#7C3AED','#065F46']

export default function Materias() {
  const [materias, setMaterias]   = useState([])
  const [cursos, setCursos]       = useState([])
  const [docentes, setDocentes]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [alert, setAlert]         = useState(null)
  const [search, setSearch]       = useState('')
  const [filtroCurso, setFiltroCurso] = useState('')
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm] = useState({
    curso_id:'', docente_id:'', nombre:'', codigo:'', horas_semanales:4, activo:true
  })

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const [{ data:m },{ data:c },{ data:d }] = await Promise.all([
      supabase.from('materias')
        .select('*, cursos(nombre,grado,paralelo,nivel), docentes(apellidos,nombres)')
        .order('created_at', { ascending:false }),
      supabase.from('cursos').select('id,nombre,grado,paralelo,nivel').eq('activo',true).order('grado'),
      supabase.from('docentes').select('id,apellidos,nombres').eq('activo',true).order('apellidos').limit(200)
    ])
    setMaterias(m||[])
    setCursos(c||[])
    setDocentes(d||[])
    if (c?.length && !form.curso_id) setForm(f=>({...f, curso_id: c[0].id}))
    setLoading(false)
  }

  const msg = (type, text) => { setAlert({type,text}); setTimeout(()=>setAlert(null),5000) }

  const handleSave = async () => {
    if (!form.curso_id) return msg('error','Selecciona un curso')
    if (!form.nombre.trim()) return msg('error','El nombre de la materia es requerido')
    setSaving(true)
    const { error } = await supabase.from('materias').insert({
      curso_id: form.curso_id,
      docente_id: form.docente_id || null,
      nombre: form.nombre.trim(),
      codigo: form.codigo.trim() || null,
      horas_semanales: parseInt(form.horas_semanales)||4,
      activo: form.activo
    })
    setSaving(false)
    if (error) return msg('error', error.message)
    msg('ok', `✅ Materia "${form.nombre}" creada correctamente`)
    setForm(f=>({...f, nombre:'', codigo:'', horas_semanales:4}))
    setShowForm(false)
    load()
  }

  const toggleActivo = async (id, current) => {
    await supabase.from('materias').update({ activo:!current }).eq('id', id)
    load()
  }

  const filtered = materias.filter(m => {
    const q = search.toLowerCase()
    const matchSearch = !q || m.nombre?.toLowerCase().includes(q) || m.codigo?.toLowerCase().includes(q)
    const matchCurso = !filtroCurso || m.curso_id === filtroCurso
    return matchSearch && matchCurso
  })

  const totalHoras = filtered.reduce((s,m) => s+(m.horas_semanales||0), 0)

  const colorFor = (nombre) => COLORES[MATERIAS_BASE.indexOf(nombre) % COLORES.length] || '#6B7280'

  return (
    <div>
      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:16}}>
        {[
          {val:materias.length,            lbl:'Total materias',    ico:'ti-book',    c:'#0F2B5B'},
          {val:materias.filter(m=>m.activo).length, lbl:'Activas', ico:'ti-check',   c:'#16A34A'},
          {val:totalHoras,                 lbl:'Horas / semana',    ico:'ti-clock',   c:'#534AB7'},
          {val:cursos.length,              lbl:'Cursos disponibles',ico:'ti-books',   c:'#D97706'},
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

      {alert && (
        <div style={{borderRadius:8,padding:'10px 14px',fontSize:12,display:'flex',alignItems:'center',gap:7,marginBottom:12,
          background:alert.type==='ok'?'rgba(22,163,74,.08)':'rgba(220,38,38,.06)',
          border:`0.5px solid ${alert.type==='ok'?'rgba(22,163,74,.25)':'rgba(220,38,38,.2)'}`,
          color:alert.type==='ok'?'#15803d':'#B91C1C'}}>
          <i className={`ti ti-${alert.type==='ok'?'circle-check':'alert-circle'}`} style={{fontSize:14}}/>{alert.text}
        </div>
      )}

      {/* Toolbar */}
      <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
        <div style={{position:'relative',flex:1,minWidth:160}}>
          <i className="ti ti-search" style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',color:'#9CA3AF',fontSize:13}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar materia..."
            style={{width:'100%',height:32,border:'0.5px solid #E5E7EB',borderRadius:7,padding:'0 8px 0 28px',fontSize:12,background:'#F9FAFB',boxSizing:'border-box'}}/>
        </div>
        <select value={filtroCurso} onChange={e=>setFiltroCurso(e.target.value)}
          style={{height:32,border:'0.5px solid #E5E7EB',borderRadius:7,fontSize:11,padding:'0 8px',background:'#F9FAFB'}}>
          <option value="">Todos los cursos</option>
          {cursos.map(c=><option key={c.id} value={c.id}>{c.grado} "{c.paralelo}" — {c.nivel}</option>)}
        </select>
        <button onClick={()=>setShowForm(!showForm)}
          style={{height:32,padding:'0 14px',background:'#0F2B5B',border:'none',borderRadius:7,color:'#fff',fontSize:11,cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
          <i className={`ti ti-${showForm?'x':'plus'}`} style={{fontSize:13}}/>{showForm?'Cancelar':'Nueva materia'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{background:'#fff',border:'0.5px solid #E5E7EB',borderRadius:12,padding:18,marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:600,color:'#0F2B5B',marginBottom:14,display:'flex',alignItems:'center',gap:5}}>
            <i className="ti ti-plus"/>Agregar nueva materia
          </div>
          {/* Sugerencias rápidas */}
          <div style={{marginBottom:12}}>
            <div style={{fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:6}}>Sugerencias rápidas</div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {MATERIAS_BASE.map(m=>(
                <button key={m} onClick={()=>setForm(f=>({...f,nombre:m,codigo:m.slice(0,3).toUpperCase()+'-01'}))}
                  style={{padding:'3px 10px',borderRadius:6,border:'0.5px solid #E5E7EB',background:form.nombre===m?'#0F2B5B':'#F9FAFB',
                    color:form.nombre===m?'#fff':'#374151',fontSize:11,cursor:'pointer'}}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:12}}>
            {[
              {lbl:'Curso',id:'curso_id',type:'select',opts:cursos.map(c=>({v:c.id,l:`${c.grado} "${c.paralelo}" — ${c.nivel}`}))},
              {lbl:'Nombre de la materia',id:'nombre',ph:'Ej: Matemáticas'},
              {lbl:'Código',id:'codigo',ph:'Ej: MAT-01'},
              {lbl:'Docente responsable',id:'docente_id',type:'select',opts:[{v:'',l:'Sin asignar'},...docentes.map(d=>({v:d.id,l:`${d.apellidos}, ${d.nombres}`}))]},
              {lbl:'Horas / semana',id:'horas_semanales',type:'number',ph:'4'},
            ].map(f=>(
              <div key={f.id}>
                <div style={{fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:4}}>{f.lbl}</div>
                {f.type==='select'?(
                  <select value={form[f.id]} onChange={e=>setForm({...form,[f.id]:e.target.value})}
                    style={{width:'100%',height:32,border:'0.5px solid #E5E7EB',borderRadius:6,padding:'0 8px',fontSize:12,background:'#F9FAFB',boxSizing:'border-box'}}>
                    {f.opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                ):(
                  <input type={f.type||'text'} value={form[f.id]} onChange={e=>setForm({...form,[f.id]:e.target.value})} placeholder={f.ph}
                    style={{width:'100%',height:32,border:'0.5px solid #E5E7EB',borderRadius:6,padding:'0 8px',fontSize:12,background:'#F9FAFB',boxSizing:'border-box'}}/>
                )}
              </div>
            ))}
            <div style={{display:'flex',alignItems:'flex-end',paddingBottom:4}}>
              <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,cursor:'pointer'}}>
                <input type="checkbox" checked={form.activo} onChange={e=>setForm({...form,activo:e.target.checked})}/>
                Materia activa
              </label>
            </div>
          </div>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
            <button onClick={()=>setShowForm(false)} style={{height:32,padding:'0 14px',border:'0.5px solid #E5E7EB',borderRadius:6,background:'#fff',fontSize:12,cursor:'pointer'}}>Cancelar</button>
            <button onClick={handleSave} disabled={saving}
              style={{height:32,padding:'0 16px',background:saving?'#6B7280':'#0F2B5B',border:'none',borderRadius:6,color:'#fff',fontSize:12,cursor:saving?'not-allowed':'pointer',display:'flex',alignItems:'center',gap:4}}>
              <i className={`ti ti-${saving?'loader':'device-floppy'}`} style={{fontSize:13}}/>{saving?'Guardando…':'Guardar materia'}
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      <div style={{background:'#fff',border:'0.5px solid #E5E7EB',borderRadius:12,overflow:'hidden'}}>
        <div style={{padding:'12px 16px',borderBottom:'0.5px solid #F3F4F6'}}>
          <span style={{fontSize:12,fontWeight:600,color:'#0F2B5B',display:'flex',alignItems:'center',gap:5}}>
            <i className="ti ti-book"/>{filtered.length} materias {filtroCurso?'en este curso':'en total'} · {totalHoras} horas/semana
          </span>
        </div>
        {loading?(
          <div style={{padding:28,textAlign:'center',color:'#9CA3AF',fontSize:12}}>Cargando desde Supabase…</div>
        ) : filtered.length===0?(
          <div style={{padding:32,textAlign:'center'}}>
            <i className="ti ti-book-off" style={{fontSize:36,color:'#D1D5DB',display:'block',marginBottom:10}}/>
            <p style={{fontSize:13,color:'#9CA3AF',marginBottom:12}}>
              {cursos.length===0?'Primero crea un curso para poder agregar materias.':'Sin materias. Usa el botón "Nueva materia" para comenzar.'}
            </p>
            {cursos.length===0&&<button onClick={()=>window.location.href='/cursos'} style={{padding:'8px 16px',background:'#0F2B5B',border:'none',borderRadius:7,color:'#fff',fontSize:12,cursor:'pointer'}}>Ir a Cursos →</button>}
          </div>
        ):(
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr>
                {['Materia','Código','Curso','Docente','Horas/sem','Estado','Acciones'].map(h=>(
                  <th key={h} style={{textAlign:'left',padding:'0 12px 8px',fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',borderBottom:'0.5px solid #F3F4F6'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtered.map(m=>{
                  const color = colorFor(m.nombre)
                  return (
                    <tr key={m.id} style={{borderBottom:'0.5px solid #F9FAFB'}}>
                      <td style={{padding:'9px 12px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{width:8,height:8,borderRadius:'50%',background:color,flexShrink:0}}/>
                          <span style={{fontWeight:500}}>{m.nombre}</span>
                        </div>
                      </td>
                      <td style={{padding:'9px 12px',fontFamily:'monospace',fontSize:11,color:'#6B7280'}}>{m.codigo||'—'}</td>
                      <td style={{padding:'9px 12px'}}>
                        {m.cursos?<span style={{fontSize:10,padding:'2px 7px',borderRadius:9,background:'rgba(15,43,91,.08)',color:'#0F2B5B',fontWeight:500}}>{m.cursos.grado} "{m.cursos.paralelo}"</span>:'—'}
                      </td>
                      <td style={{padding:'9px 12px',color:'#6B7280',fontSize:11}}>{m.docentes?`${m.docentes.apellidos}, ${m.docentes.nombres}`:'Sin asignar'}</td>
                      <td style={{padding:'9px 12px',textAlign:'center',fontWeight:600,color:'#0F2B5B'}}>{m.horas_semanales||0}h</td>
                      <td style={{padding:'9px 12px'}}>
                        <span style={{fontSize:10,padding:'2px 7px',borderRadius:9,fontWeight:500,background:m.activo?'rgba(22,163,74,.1)':'#F3F4F6',color:m.activo?'#15803d':'#9CA3AF'}}>{m.activo?'Activa':'Inactiva'}</span>
                      </td>
                      <td style={{padding:'9px 12px'}}>
                        <button onClick={()=>toggleActivo(m.id,m.activo)}
                          style={{width:26,height:26,borderRadius:5,border:'0.5px solid #E5E7EB',background:'#F9FAFB',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#6B7280'}}>
                          <i className={`ti ti-${m.activo?'ban':'circle-check'}`} style={{fontSize:12}}/>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
