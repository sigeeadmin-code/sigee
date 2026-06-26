import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const PERIODOS_TIPO = ['1er Quimestre','2do Quimestre','Supletorio','Remedial','Gracia','Anual']

function ProgBar({ pct, color }) {
  return (
    <div style={{ height:5, background:'#F3F4F6', borderRadius:3, overflow:'hidden', marginTop:5 }}>
      <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:3, transition:'width .5s' }} />
    </div>
  )
}

export default function Periodos() {
  const [periodos, setPeriodos] = useState([])
  const [planteles, setPlanteles] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState(null)
  const [form, setForm] = useState({
    plantel_id: '', anio_lectivo: '2025-2026', periodo: '1er Quimestre',
    fecha_inicio: '', fecha_fin: '', abierto: false
  })

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const [{ data: per }, { data: pla }] = await Promise.all([
      supabase.from('periodos_academicos').select('*, planteles(nombre,codigo_amie)').order('created_at', { ascending: false }),
      supabase.from('planteles').select('id,nombre,codigo_amie').order('nombre').limit(100)
    ])
    setPeriodos(per||[])
    setPlanteles(pla||[])
    if (pla?.length && !form.plantel_id) setForm(f => ({...f, plantel_id: pla[0].id}))
    setLoading(false)
  }

  const msg = (type, text) => { setAlert({type,text}); setTimeout(()=>setAlert(null),5000) }

  const calcProgress = (inicio, fin) => {
    if (!inicio || !fin) return 0
    const total = new Date(fin) - new Date(inicio)
    const elapsed = new Date() - new Date(inicio)
    return Math.min(100, Math.max(0, Math.round(elapsed/total*100)))
  }

  const toggleAbierto = async (id, current) => {
    if (!current) {
      // Cerrar todos los demás primero
      await supabase.from('periodos_academicos').update({ abierto: false }).neq('id', id)
    }
    const { error } = await supabase.from('periodos_academicos').update({ abierto: !current }).eq('id', id)
    if (error) return msg('error', error.message)
    msg('ok', `Período ${!current ? 'abierto' : 'cerrado'} correctamente`)
    load()
  }

  const handleSave = async () => {
    if (!form.plantel_id) return msg('error', 'Selecciona un plantel')
    if (!form.periodo) return msg('error', 'Selecciona el período')
    setSaving(true)
    if (form.abierto) {
      await supabase.from('periodos_academicos').update({ abierto: false }).eq('abierto', true)
    }
    const { error } = await supabase.from('periodos_academicos').insert({
      plantel_id: form.plantel_id,
      anio_lectivo: form.anio_lectivo,
      periodo: form.periodo,
      fecha_inicio: form.fecha_inicio || null,
      fecha_fin: form.fecha_fin || null,
      abierto: form.abierto
    })
    setSaving(false)
    if (error) return msg('error', error.message)
    msg('ok', `✅ Período "${form.periodo}" creado correctamente`)
    setForm(f => ({...f, periodo:'1er Quimestre', fecha_inicio:'', fecha_fin:'', abierto:false}))
    load()
  }

  const abiertos = periodos.filter(p => p.abierto).length
  const cerrados = periodos.filter(p => !p.abierto).length

  return (
    <div>
      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16 }}>
        {[
          { val:periodos.length, lbl:'Total períodos',  ico:'ti-calendar', c:'#0F2B5B' },
          { val:abiertos,        lbl:'Abiertos',        ico:'ti-lock-open', c:'#16A34A' },
          { val:cerrados,        lbl:'Cerrados',        ico:'ti-lock',      c:'#6B7280' },
          { val:'2025-2026',     lbl:'Año lectivo',     ico:'ti-school',    c:'#D97706' },
        ].map((s,i) => (
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
          <i className={`ti ti-${alert.type==='ok'?'circle-check':'alert-circle'}`} style={{ fontSize:14 }} />
          {alert.text}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:14 }}>
        {/* LISTA */}
        <div>
          <div style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:12, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:'0.5px solid #F3F4F6' }}>
              <span style={{ fontSize:12, fontWeight:600, color:'#0F2B5B', display:'flex', alignItems:'center', gap:5 }}>
                <i className="ti ti-calendar-event" />Períodos académicos registrados
              </span>
            </div>
            {loading ? (
              <div style={{ padding:28, textAlign:'center', color:'#9CA3AF', fontSize:12 }}>Cargando…</div>
            ) : periodos.length === 0 ? (
              <div style={{ padding:32, textAlign:'center' }}>
                <i className="ti ti-calendar-off" style={{ fontSize:36, color:'#D1D5DB', display:'block', marginBottom:10 }} />
                <p style={{ fontSize:13, color:'#9CA3AF', marginBottom:12 }}>Sin períodos registrados. Crea el primero.</p>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, padding:14 }}>
                {periodos.map(p => {
                  const pct = calcProgress(p.fecha_inicio, p.fecha_fin)
                  const isOpen = p.abierto
                  return (
                    <div key={p.id} style={{ border:`0.5px solid ${isOpen?'rgba(22,163,74,.3)':'#E5E7EB'}`, borderRadius:10, padding:14, background:isOpen?'rgba(22,163,74,.02)':'#fff' }}>
                      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:8 }}>
                        <div>
                          <div style={{ fontSize:13, fontWeight:600, color:'#1A2B4A' }}>{p.periodo}</div>
                          <div style={{ fontSize:11, color:'#9CA3AF', marginTop:2 }}>{p.anio_lectivo} · {p.planteles?.nombre || '—'}</div>
                        </div>
                        <span style={{ fontSize:10, padding:'2px 8px', borderRadius:9, fontWeight:500,
                          background:isOpen?'rgba(22,163,74,.1)':'#F3F4F6',
                          color:isOpen?'#15803d':'#9CA3AF' }}>
                          {isOpen ? '🟢 Abierto' : '⚪ Cerrado'}
                        </span>
                      </div>
                      {p.fecha_inicio && (
                        <>
                          <div style={{ fontSize:10, color:'#9CA3AF', display:'flex', justifyContent:'space-between', marginTop:6 }}>
                            <span>{new Date(p.fecha_inicio).toLocaleDateString('es-EC')}</span>
                            <span>{pct}%</span>
                            <span>{p.fecha_fin ? new Date(p.fecha_fin).toLocaleDateString('es-EC') : '—'}</span>
                          </div>
                          <ProgBar pct={pct} color={isOpen?'#16A34A':'#9CA3AF'} />
                        </>
                      )}
                      <button onClick={()=>toggleAbierto(p.id, p.abierto)}
                        style={{ marginTop:10, width:'100%', height:28, borderRadius:6, border:`0.5px solid ${isOpen?'rgba(22,163,74,.3)':'#E5E7EB'}`, background:isOpen?'rgba(22,163,74,.06)':'#F9FAFB', fontSize:11, cursor:'pointer', color:isOpen?'#15803d':'#6B7280', display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
                        <i className={`ti ti-${isOpen?'lock':'lock-open'}`} style={{ fontSize:12 }} />
                        {isOpen ? 'Cerrar período' : 'Abrir período'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* FORM */}
        <div style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:12, overflow:'hidden', height:'fit-content' }}>
          <div style={{ padding:'12px 16px', borderBottom:'0.5px solid #F3F4F6' }}>
            <span style={{ fontSize:12, fontWeight:600, color:'#0F2B5B', display:'flex', alignItems:'center', gap:5 }}>
              <i className="ti ti-plus" />Nuevo período
            </span>
          </div>
          <div style={{ padding:14, display:'flex', flexDirection:'column', gap:10 }}>
            {[
              { lbl:'Plantel', id:'plantel_id', type:'select', opts: planteles.map(p=>({v:p.id,l:`${p.nombre} (${p.codigo_amie})`})) },
              { lbl:'Año lectivo', id:'anio_lectivo', ph:'2025-2026' },
              { lbl:'Período', id:'periodo', type:'select', opts: PERIODOS_TIPO.map(p=>({v:p,l:p})) },
              { lbl:'Fecha inicio', id:'fecha_inicio', type:'date' },
              { lbl:'Fecha fin', id:'fecha_fin', type:'date' },
            ].map(f => (
              <div key={f.id}>
                <div style={{ fontSize:10, fontWeight:600, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:4 }}>{f.lbl}</div>
                {f.type==='select' ? (
                  <select value={form[f.id]} onChange={e=>setForm({...form,[f.id]:e.target.value})}
                    style={{ width:'100%', height:32, border:'0.5px solid #E5E7EB', borderRadius:6, padding:'0 8px', fontSize:11, background:'#F9FAFB', boxSizing:'border-box' }}>
                    {f.opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                ) : (
                  <input type={f.type||'text'} value={form[f.id]} onChange={e=>setForm({...form,[f.id]:e.target.value})} placeholder={f.ph}
                    style={{ width:'100%', height:32, border:'0.5px solid #E5E7EB', borderRadius:6, padding:'0 8px', fontSize:11, background:'#F9FAFB', boxSizing:'border-box' }} />
                )}
              </div>
            ))}
            <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, cursor:'pointer' }}>
              <input type="checkbox" checked={form.abierto} onChange={e=>setForm({...form,abierto:e.target.checked})} />
              Abrir período inmediatamente
            </label>
            <button onClick={handleSave} disabled={saving}
              style={{ height:34, background:saving?'#6B7280':'#0F2B5B', border:'none', borderRadius:7, color:'#fff', fontSize:12, fontWeight:500, cursor:saving?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
              <i className={`ti ti-${saving?'loader':'device-floppy'}`} style={{ fontSize:13 }} />
              {saving?'Guardando…':'Crear período'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
