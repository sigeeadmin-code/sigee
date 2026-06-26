import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const NIVELES = ['Inicial','Educación Básica','Bachillerato','Popular Permanente','Especial']
const GRADOS  = ['1ro','2do','3ro','4to','5to','6to','7mo','8vo','9no','10mo']
const PARALELOS = ['A','B','C','D','E']
const JORNADAS  = ['Matutina','Vespertina','Nocturna','Completa']
const NIVEL_COLOR = { 'Inicial':'#0891B2','Educación Básica':'#0F2B5B','Bachillerato':'#534AB7','Popular Permanente':'#D97706','Especial':'#16A34A' }

export default function Cursos() {
  const [cursos, setCursos] = useState([])
  const [planteles, setPlanteles] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState(null)
  const [view, setView] = useState('grid') // grid | list | nuevo
  const [form, setForm] = useState({ plantel_id:'', nombre:'', nivel:'Educación Básica', grado:'8vo', paralelo:'A', jornada:'Matutina', anio_lectivo:'2025-2026', activo:true })

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const [{ data:c },{ data:p }] = await Promise.all([
      supabase.from('cursos').select('*, planteles(nombre,codigo_amie)').order('nivel').order('grado').order('paralelo'),
      supabase.from('planteles').select('id,nombre,codigo_amie').order('nombre').limit(100)
    ])
    setCursos(c||[]); setPlanteles(p||[])
    if (p?.length && !form.plantel_id) setForm(f=>({...f,plantel_id:p[0].id}))
    setLoading(false)
  }

  const msg = (type, text) => { setAlert({type,text}); setTimeout(()=>setAlert(null),5000) }

  const handleSave = async () => {
    if (!form.plantel_id) return msg('error','Selecciona un plantel')
    if (!form.nombre.trim()) {
      const nombre = `${form.grado} "${form.paralelo}" — ${form.nivel}`
      setForm(f=>({...f,nombre}))
    }
    setSaving(true)
    const { error } = await supabase.from('cursos').insert({
      plantel_id: form.plantel_id,
      nombre: form.nombre || `${form.grado} "${form.paralelo}" — ${form.nivel}`,
      nivel: form.nivel,
      grado: form.grado,
      paralelo: form.paralelo,
      jornada: form.jornada,
      anio_lectivo: form.anio_lectivo,
      activo: form.activo
    })
    setSaving(false)
    if (error) return msg('error', error.message)
    msg('ok', `✅ Curso "${form.grado} \\"${form.paralelo}\\"" creado correctamente`)
    setForm(f=>({...f,nombre:'',grado:'8vo',paralelo:'A'}))
    load()
    setView('grid')
  }

  const toggleActivo = async (id, current) => {
    await supabase.from('cursos').update({ activo: !current }).eq('id', id)
    load()
  }

  const activos = cursos.filter(c=>c.activo).length

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16 }}>
        {[
          { val:cursos.length, lbl:'Total cursos',    ico:'ti-books',    c:'#0F2B5B' },
          { val:activos,       lbl:'Activos',         ico:'ti-check',    c:'#16A34A' },
          { val:cursos.filter(c=>c.nivel==='Educación Básica').length, lbl:'Básica', ico:'ti-school', c:'#0891B2' },
          { val:cursos.filter(c=>c.nivel==='Bachillerato').length, lbl:'Bachillerato', ico:'ti-certificate', c:'#534AB7' },
        ].map((s,i)=>(
          <div key={i} style={{ background:'#F9FAFB', borderRadius:10, padding:12, border:'0.5px solid #E5E7EB', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:0, right:0, width:3, height:'100%', background:s.c }} />
            <div style={{ width:28, height:28, borderRadius:6, background:s.c+'22', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:6 }}>
              <i className={`ti ${s.ico}`} style={{ fontSize:14, color:s.c }} />
            </div>
            <div style={{ fontSize:20, fontWeight:700, color:'#1A2B4A' }}>{s.val}</div>
            <div style={{ fontSize:10, color:'#9CA3AF', marginTop:2 }}>{s.lbl}</div>
          </div>
        ))}
      </div>

      {alert && (
        <div style={{ borderRadius:8, padding:'10px 14px', fontSize:12, display:'flex', alignItems:'center', gap:7, marginBottom:12,
          background:alert.type==='ok'?'rgba(22,163,74,.08)':'rgba(220,38,38,.06)',
          border:`0.5px solid ${alert.type==='ok'?'rgba(22,163,74,.25)':'rgba(220,38,38,.2)'}`,
          color:alert.type==='ok'?'#15803d':'#B91C1C' }}>
          <i className={`ti ti-${alert.type==='ok'?'circle-check':'alert-circle'}`} style={{ fontSize:14 }} />{alert.text}
        </div>
      )}

      <div style={{ display:'flex', gap:3, background:'#F3F4F6', padding:3, borderRadius:8, width:'fit-content', marginBottom:14 }}>
        {[['grid','Tarjetas'],['list','Lista'],['nuevo','+ Nuevo curso']].map(([id,lbl])=>(
          <button key={id} onClick={()=>setView(id)} style={{ padding:'5px 14px', borderRadius:5, border:'none', fontSize:11, cursor:'pointer',
            background:view===id?'#fff':'transparent', color:view===id?'#0F2B5B':'#6B7280',
            fontWeight:view===id?600:500, boxShadow:view===id?'0 1px 2px rgba(0,0,0,.07)':'none' }}>{lbl}</button>
        ))}
      </div>

      {/* GRID */}
      {view==='grid' && (
        loading ? <div style={{ textAlign:'center', padding:28, color:'#9CA3AF' }}>Cargando…</div>
        : cursos.length===0 ? (
          <div style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:12, padding:36, textAlign:'center' }}>
            <i className="ti ti-books" style={{ fontSize:40, color:'#D1D5DB', display:'block', marginBottom:10 }} />
            <p style={{ fontSize:13, color:'#9CA3AF', marginBottom:14 }}>Sin cursos. Crea el primero.</p>
            <button onClick={()=>setView('nuevo')} style={{ padding:'8px 18px', background:'#0F2B5B', border:'none', borderRadius:7, color:'#fff', fontSize:12, cursor:'pointer' }}>Crear primer curso</button>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:10 }}>
            {cursos.map(c=>{
              const nc = NIVEL_COLOR[c.nivel]||'#0F2B5B'
              return (
                <div key={c.id} style={{ border:`0.5px solid ${c.activo?'#E5E7EB':'#F3F4F6'}`, borderRadius:10, overflow:'hidden', background:c.activo?'#fff':'#F9FAFB', opacity:c.activo?1:.7 }}>
                  <div style={{ height:4, background:nc }} />
                  <div style={{ padding:14 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                      <div>
                        <div style={{ fontSize:16, fontWeight:700, color:'#1A2B4A' }}>{c.grado}</div>
                        <div style={{ fontSize:10, color:'#9CA3AF', marginTop:1 }}>{c.nivel}</div>
                      </div>
                      <div style={{ width:32, height:32, borderRadius:8, background:nc, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'#fff' }}>{c.paralelo}</div>
                    </div>
                    <div style={{ fontSize:11, color:'#6B7280', marginBottom:4 }}>{c.jornada} · {c.anio_lectivo}</div>
                    <div style={{ fontSize:10, color:'#9CA3AF', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.planteles?.nombre||'—'}</div>
                    <div style={{ marginTop:10, display:'flex', gap:4 }}>
                      <span style={{ fontSize:9, padding:'2px 7px', borderRadius:8, background:c.activo?'rgba(22,163,74,.1)':'#F3F4F6', color:c.activo?'#15803d':'#9CA3AF', fontWeight:500 }}>{c.activo?'Activo':'Inactivo'}</span>
                    </div>
                    <button onClick={()=>toggleActivo(c.id,c.activo)} style={{ marginTop:8, width:'100%', height:26, borderRadius:5, border:'0.5px solid #E5E7EB', background:'#F9FAFB', fontSize:10, cursor:'pointer', color:'#6B7280' }}>
                      {c.activo?'Desactivar':'Activar'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* LIST */}
      {view==='list' && (
        <div style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:12, overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead><tr>
                {['Curso','Nivel','Grado','Paralelo','Jornada','Año','Plantel','Estado'].map(h=>
                  <th key={h} style={{ textAlign:'left', padding:'0 12px 8px', fontSize:10, fontWeight:600, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.4px', borderBottom:'0.5px solid #F3F4F6' }}>{h}</th>
                )}
              </tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={8} style={{ textAlign:'center', padding:24, color:'#9CA3AF' }}>Cargando…</td></tr>
                : cursos.map((c,i)=>(
                  <tr key={c.id} style={{ borderBottom:'0.5px solid #F9FAFB' }}>
                    <td style={{ padding:'9px 12px', fontWeight:500 }}>{c.nombre}</td>
                    <td style={{ padding:'9px 12px' }}><span style={{ fontSize:10, padding:'2px 7px', borderRadius:9, background:(NIVEL_COLOR[c.nivel]||'#0F2B5B')+'22', color:NIVEL_COLOR[c.nivel]||'#0F2B5B', fontWeight:500 }}>{c.nivel}</span></td>
                    <td style={{ padding:'9px 12px', fontWeight:600, color:'#0F2B5B' }}>{c.grado}</td>
                    <td style={{ padding:'9px 12px', fontWeight:700 }}>{c.paralelo}</td>
                    <td style={{ padding:'9px 12px', color:'#6B7280' }}>{c.jornada}</td>
                    <td style={{ padding:'9px 12px', color:'#6B7280', fontSize:11 }}>{c.anio_lectivo}</td>
                    <td style={{ padding:'9px 12px', color:'#9CA3AF', fontSize:11, maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.planteles?.nombre||'—'}</td>
                    <td style={{ padding:'9px 12px' }}><span style={{ fontSize:10, padding:'2px 7px', borderRadius:9, background:c.activo?'rgba(22,163,74,.1)':'#F3F4F6', color:c.activo?'#15803d':'#9CA3AF', fontWeight:500 }}>{c.activo?'Activo':'Inactivo'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* NUEVO */}
      {view==='nuevo' && (
        <div style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:12, padding:20 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#0F2B5B', marginBottom:16, display:'flex', alignItems:'center', gap:5 }}>
            <i className="ti ti-plus" />Crear nuevo curso
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
            {[
              { lbl:'Plantel', id:'plantel_id', type:'select', opts:planteles.map(p=>({v:p.id,l:`${p.nombre} (${p.codigo_amie})`})) },
              { lbl:'Nombre del curso', id:'nombre', ph:'Ej: 8vo "A" — Básica Superior' },
              { lbl:'Nivel educativo', id:'nivel', type:'select', opts:NIVELES.map(n=>({v:n,l:n})) },
              { lbl:'Grado', id:'grado', type:'select', opts:GRADOS.map(g=>({v:g,l:g})) },
              { lbl:'Paralelo', id:'paralelo', type:'select', opts:PARALELOS.map(p=>({v:p,l:p})) },
              { lbl:'Jornada', id:'jornada', type:'select', opts:JORNADAS.map(j=>({v:j,l:j})) },
              { lbl:'Año lectivo', id:'anio_lectivo', ph:'2025-2026' },
            ].map(f=>(
              <div key={f.id}>
                <div style={{ fontSize:10, fontWeight:600, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:4 }}>{f.lbl}</div>
                {f.type==='select' ? (
                  <select value={form[f.id]} onChange={e=>setForm({...form,[f.id]:e.target.value})}
                    style={{ width:'100%', height:32, border:'0.5px solid #E5E7EB', borderRadius:6, padding:'0 8px', fontSize:12, background:'#F9FAFB', boxSizing:'border-box' }}>
                    {f.opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                ) : (
                  <input value={form[f.id]} onChange={e=>setForm({...form,[f.id]:e.target.value})} placeholder={f.ph}
                    style={{ width:'100%', height:32, border:'0.5px solid #E5E7EB', borderRadius:6, padding:'0 8px', fontSize:12, background:'#F9FAFB', boxSizing:'border-box' }} />
                )}
              </div>
            ))}
            <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, cursor:'pointer', alignSelf:'end', paddingBottom:4 }}>
              <input type="checkbox" checked={form.activo} onChange={e=>setForm({...form,activo:e.target.checked})} />
              Curso activo
            </label>
          </div>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <button onClick={()=>setView('grid')} style={{ height:32, padding:'0 14px', border:'0.5px solid #E5E7EB', borderRadius:6, background:'#fff', fontSize:12, cursor:'pointer' }}>Cancelar</button>
            <button onClick={handleSave} disabled={saving}
              style={{ height:32, padding:'0 16px', background:saving?'#6B7280':'#0F2B5B', border:'none', borderRadius:6, color:'#fff', fontSize:12, cursor:saving?'not-allowed':'pointer', display:'flex', alignItems:'center', gap:4 }}>
              <i className={`ti ti-${saving?'loader':'device-floppy'}`} style={{ fontSize:13 }} />{saving?'Guardando…':'Crear curso'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
