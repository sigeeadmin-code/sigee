import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const ESTADOS = [
  { val:'presente',    lbl:'P', color:'#15803d', bg:'rgba(22,163,74,.12)'  },
  { val:'ausente',     lbl:'A', color:'#DC2626', bg:'rgba(220,38,38,.1)'   },
  { val:'tardanza',    lbl:'T', color:'#D97706', bg:'rgba(217,119,6,.1)'   },
  { val:'justificada', lbl:'J', color:'#0891B2', bg:'rgba(8,145,178,.1)'   },
]

function buildWALink(tel, msg) {
  const num = (tel||'').replace(/\D/g,'')
  const full = num.startsWith('593') ? num : '593' + (num.startsWith('0') ? num.slice(1) : num)
  return `https://wa.me/${full}?text=${encodeURIComponent(msg)}`
}

function buildMailLink(email, nombre, fecha, estado) {
  const sub = `Asistencia de ${nombre} — ${fecha}`
  const body = `Estimado/a representante,\n\nLe informamos que ${nombre} registró estado "${estado}" el día ${fecha}.\n\nAtentamente,\nCoordinación Académica — SIGEE`
  return `mailto:${email}?subject=${encodeURIComponent(sub)}&body=${encodeURIComponent(body)}`
}

export default function Asistencia() {
  const [tab, setTab]         = useState('pase')
  const [cursos, setCursos]   = useState([])
  const [matriculas, setMat]  = useState([])
  const [historial, setHist]  = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [alert, setAlert]     = useState(null)
  const [estados, setEstados] = useState({}) // {matricula_id: 'presente'|'ausente'|'tardanza'|'justificada'}
  const [obs, setObs]         = useState({}) // {matricula_id: string}
  const [sel, setSel]         = useState({ curso:'', fecha: new Date().toISOString().split('T')[0], jornada:'Matutina' })

  useEffect(() => { loadCursos() }, [])
  useEffect(() => { if (sel.curso) loadMatriculas() }, [sel.curso])
  useEffect(() => { if (sel.curso && sel.fecha) loadHistorial() }, [sel.curso, sel.fecha])

  const loadCursos = async () => {
    const { data } = await supabase.from('cursos').select('id,nombre,grado,paralelo,nivel').eq('activo',true).order('grado')
    setCursos(data||[])
    if (data?.length) setSel(s=>({...s, curso: data[0].id}))
  }

  const loadMatriculas = async () => {
    setLoading(true)
    const { data } = await supabase.from('matriculas')
      .select('id, estudiantes(id,apellidos,nombres,cedula,telefono_representante,email_representante,nombre_representante)')
      .eq('curso_id', sel.curso).eq('estado','Activa').order('estudiantes(apellidos)')
    setMat(data||[])
    // Inicializar todos como presente
    const init = {}
    ;(data||[]).forEach(m => { init[m.id] = 'presente' })
    setEstados(init)
    setObs({})
    setLoading(false)
  }

  const loadHistorial = async () => {
    const inicioMes = sel.fecha.slice(0,7) + '-01'
    const { data } = await supabase.from('asistencia')
      .select('*, matriculas!inner(curso_id, estudiantes(apellidos,nombres))')
      .eq('matriculas.curso_id', sel.curso)
      .gte('fecha', inicioMes)
      .order('fecha', { ascending:false })
    setHist(data||[])
  }

  const msg = (type, text) => { setAlert({type,text}); setTimeout(()=>setAlert(null),5000) }

  const markAll = (val) => {
    const n = {}
    matriculas.forEach(m => { n[m.id] = val })
    setEstados(n)
  }

  const handleSave = async () => {
    if (!sel.curso || !sel.fecha) return msg('error','Selecciona curso y fecha')
    setSaving(true)
    const rows = matriculas.map(m => ({
      matricula_id:  m.id,
      fecha:         sel.fecha,
      presente:      estados[m.id] === 'presente',
      justificada:   estados[m.id] === 'justificada',
      tardanza:      estados[m.id] === 'tardanza',
      observacion:   obs[m.id] || null
    }))
    const { error } = await supabase.from('asistencia').upsert(rows, {
      onConflict: 'matricula_id,fecha',
      ignoreDuplicates: false
    })
    setSaving(false)
    if (error) return msg('error', error.message)
    const presentes  = rows.filter(r=>r.presente).length
    const ausentes   = rows.filter(r=>!r.presente&&!r.justificada&&!r.tardanza).length
    const tard       = rows.filter(r=>r.tardanza).length
    const just       = rows.filter(r=>r.justificada).length
    msg('ok', `✅ Asistencia guardada — ${presentes}P · ${ausentes}A · ${tard}T · ${just}J`)
    loadHistorial()
  }

  const enviarWA = (m) => {
    const est = m.estudiantes
    const nombre = `${est.apellidos}, ${est.nombres}`
    const estado = estados[m.id] || 'ausente'
    const msg = `Estimado/a representante,\n\nLe comunicamos que *${nombre}* registró estado *${estado.toUpperCase()}* el día *${sel.fecha}*.\n\nAtentamente,\n_Coordinación Académica — SIGEE_`
    const link = buildWALink(est.telefono_representante, msg)
    window.open(link, '_blank')
  }

  const cursoSel = cursos.find(c=>c.id===sel.curso)
  const pres  = Object.values(estados).filter(e=>e==='presente').length
  const aus   = Object.values(estados).filter(e=>e==='ausente').length
  const tard  = Object.values(estados).filter(e=>e==='tardanza').length
  const just  = Object.values(estados).filter(e=>e==='justificada').length
  const ausentesHoy = matriculas.filter(m=>estados[m.id]==='ausente'||estados[m.id]==='tardanza')

  return (
    <div>
      {/* Contexto */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr auto',gap:10,marginBottom:14,alignItems:'end'}}>
        <div>
          <div style={{fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:4}}>Curso</div>
          <select value={sel.curso} onChange={e=>setSel(s=>({...s,curso:e.target.value}))}
            style={{width:'100%',height:34,border:'0.5px solid #E5E7EB',borderRadius:7,padding:'0 8px',fontSize:12,background:'#fff'}}>
            <option value="">Seleccionar…</option>
            {cursos.map(c=><option key={c.id} value={c.id}>{c.grado} "{c.paralelo}" — {c.nivel}</option>)}
          </select>
        </div>
        <div>
          <div style={{fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:4}}>Fecha</div>
          <input type="date" value={sel.fecha} onChange={e=>setSel(s=>({...s,fecha:e.target.value}))}
            style={{width:'100%',height:34,border:'0.5px solid #E5E7EB',borderRadius:7,padding:'0 8px',fontSize:12,background:'#fff'}}/>
        </div>
        <div>
          <div style={{fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:4}}>Jornada</div>
          <select value={sel.jornada} onChange={e=>setSel(s=>({...s,jornada:e.target.value}))}
            style={{width:'100%',height:34,border:'0.5px solid #E5E7EB',borderRadius:7,padding:'0 8px',fontSize:12,background:'#fff'}}>
            {['Matutina','Vespertina','Nocturna'].map(j=><option key={j}>{j}</option>)}
          </select>
        </div>
        <button onClick={handleSave} disabled={saving||!sel.curso}
          style={{height:34,padding:'0 16px',background:saving?'#6B7280':'#0F2B5B',border:'none',borderRadius:7,color:'#fff',fontSize:12,cursor:saving?'not-allowed':'pointer',display:'flex',alignItems:'center',gap:5,marginTop:14}}>
          <i className={`ti ti-${saving?'loader':'device-floppy'}`} style={{fontSize:13}}/>{saving?'Guardando…':'Guardar'}
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

      {/* Stats rápidas */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:14}}>
        {[
          {val:pres, lbl:'Presentes',   c:'#15803d', bg:'rgba(22,163,74,.1)'},
          {val:aus,  lbl:'Ausentes',    c:'#DC2626', bg:'rgba(220,38,38,.08)'},
          {val:tard, lbl:'Tardanzas',   c:'#D97706', bg:'rgba(217,119,6,.1)'},
          {val:just, lbl:'Justificadas',c:'#0891B2', bg:'rgba(8,145,178,.08)'},
        ].map((s,i)=>(
          <div key={i} style={{background:s.bg,borderRadius:9,padding:10,textAlign:'center'}}>
            <div style={{fontSize:20,fontWeight:700,color:s.c}}>{s.val}</div>
            <div style={{fontSize:10,color:s.c,marginTop:2,opacity:.8}}>{s.lbl}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:3,background:'#F3F4F6',padding:3,borderRadius:8,width:'fit-content',marginBottom:14}}>
        {[['pase','📋 Pase de lista'],['whatsapp','💬 WhatsApp'],['historial','📅 Historial']].map(([id,lbl])=>(
          <button key={id} onClick={()=>setTab(id)}
            style={{padding:'5px 14px',borderRadius:5,border:'none',fontSize:11,cursor:'pointer',
              background:tab===id?'#fff':'transparent',color:tab===id?'#0F2B5B':'#6B7280',
              fontWeight:tab===id?600:500,boxShadow:tab===id?'0 1px 2px rgba(0,0,0,.07)':'none'}}>{lbl}</button>
        ))}
      </div>

      {/* PASE DE LISTA */}
      {tab==='pase'&&(
        <div style={{background:'#fff',border:'0.5px solid #E5E7EB',borderRadius:12,overflow:'hidden'}}>
          <div style={{padding:'10px 16px',borderBottom:'0.5px solid #F3F4F6',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8,background:'#F9FAFB'}}>
            <span style={{fontSize:12,fontWeight:600,color:'#0F2B5B'}}>
              {cursoSel?`${cursoSel.grado} "${cursoSel.paralelo}"`:''} · {sel.fecha}
            </span>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              <span style={{fontSize:11,color:'#6B7280'}}>Marcar todos:</span>
              {ESTADOS.map(e=>(
                <button key={e.val} onClick={()=>markAll(e.val)}
                  style={{padding:'3px 10px',borderRadius:6,border:`0.5px solid ${e.color}44`,background:e.bg,color:e.color,fontSize:11,cursor:'pointer',fontWeight:500}}>
                  {e.lbl}
                </button>
              ))}
            </div>
          </div>
          {loading?(
            <div style={{padding:28,textAlign:'center',color:'#9CA3AF',fontSize:12}}>Cargando nómina…</div>
          ):matriculas.length===0?(
            <div style={{padding:32,textAlign:'center',color:'#9CA3AF',fontSize:12}}>
              <i className="ti ti-checklist" style={{fontSize:36,color:'#D1D5DB',display:'block',marginBottom:10}}/>
              Sin matrículas en este curso. Registra matrículas primero.
            </div>
          ):(
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr>
                  {['#','Estudiante','Estado de asistencia','Observación'].map(h=>(
                    <th key={h} style={{textAlign:'left',padding:'0 12px 8px',fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',borderBottom:'0.5px solid #F3F4F6'}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {matriculas.map((m,i)=>{
                    const est=m.estudiantes
                    const est_val=estados[m.id]||'presente'
                    return(
                      <tr key={m.id} style={{borderBottom:'0.5px solid #F9FAFB',background:est_val==='ausente'?'rgba(220,38,38,.02)':est_val==='tardanza'?'rgba(217,119,6,.02)':''}}>
                        <td style={{padding:'8px 12px',fontSize:10,color:'#9CA3AF'}}>{i+1}</td>
                        <td style={{padding:'8px 12px'}}>
                          <div style={{fontWeight:500}}>{est?.apellidos}, {est?.nombres}</div>
                          <div style={{fontSize:10,color:'#9CA3AF'}}>{est?.cedula||''}</div>
                        </td>
                        <td style={{padding:'8px 12px'}}>
                          <div style={{display:'flex',gap:6}}>
                            {ESTADOS.map(e=>(
                              <button key={e.val} onClick={()=>setEstados(s=>({...s,[m.id]:e.val}))}
                                style={{width:36,height:30,borderRadius:6,border:`0.5px solid ${est_val===e.val?e.color:'#E5E7EB'}`,
                                  background:est_val===e.val?e.bg:'#F9FAFB',color:est_val===e.val?e.color:'#9CA3AF',
                                  fontSize:12,fontWeight:700,cursor:'pointer',transition:'all .12s'}}>
                                {e.lbl}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td style={{padding:'8px 12px'}}>
                          <input value={obs[m.id]||''} onChange={e=>setObs(o=>({...o,[m.id]:e.target.value}))}
                            placeholder={est_val==='ausente'?'Motivo de ausencia…':est_val==='justificada'?'Documento de justificación…':'Observación…'}
                            style={{width:'100%',height:28,border:'0.5px solid #E5E7EB',borderRadius:5,padding:'0 8px',fontSize:11,background:'#F9FAFB'}}/>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* WHATSAPP */}
      {tab==='whatsapp'&&(
        <div>
          <div style={{background:'rgba(37,211,102,.06)',border:'0.5px solid rgba(37,211,102,.25)',borderRadius:9,padding:'10px 14px',fontSize:12,color:'#15803d',marginBottom:12,display:'flex',alignItems:'center',gap:7}}>
            <i className="ti ti-brand-whatsapp" style={{fontSize:14}}/>
            Notificaciones por WhatsApp — sin API de pago · usa wa.me nativo · se abre WhatsApp en el dispositivo
          </div>
          {ausentesHoy.length===0?(
            <div style={{background:'#fff',border:'0.5px solid #E5E7EB',borderRadius:12,padding:32,textAlign:'center',color:'#9CA3AF',fontSize:12}}>
              <i className="ti ti-circle-check" style={{fontSize:36,color:'#D1D5DB',display:'block',marginBottom:10}}/>
              {matriculas.length===0?'Sin estudiantes. Selecciona un curso con matrículas.':'¡Sin ausencias ni tardanzas hoy! Todos presentes.'}
            </div>
          ):(
            <div style={{background:'#fff',border:'0.5px solid #E5E7EB',borderRadius:12,overflow:'hidden'}}>
              <div style={{padding:'12px 16px',borderBottom:'0.5px solid #F3F4F6',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <span style={{fontSize:12,fontWeight:600,color:'#0F2B5B'}}>
                  {ausentesHoy.length} estudiante(s) con ausencia/tardanza — {sel.fecha}
                </span>
                <button onClick={()=>ausentesHoy.forEach((m,i)=>setTimeout(()=>enviarWA(m),i*800))}
                  style={{height:30,padding:'0 14px',background:'#25D366',border:'none',borderRadius:6,color:'#fff',fontSize:11,cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
                  <i className="ti ti-brand-whatsapp" style={{fontSize:13}}/>Enviar a todos ({ausentesHoy.length})
                </button>
              </div>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr>
                  {['Estudiante','Estado','Representante','Teléfono','Acciones'].map(h=>(
                    <th key={h} style={{textAlign:'left',padding:'0 12px 8px',fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',borderBottom:'0.5px solid #F3F4F6'}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {ausentesHoy.map(m=>{
                    const est=m.estudiantes
                    const ev=ESTADOS.find(e=>e.val===estados[m.id])
                    return(
                      <tr key={m.id} style={{borderBottom:'0.5px solid #F9FAFB'}}>
                        <td style={{padding:'9px 12px',fontWeight:500}}>{est?.apellidos}, {est?.nombres}</td>
                        <td style={{padding:'9px 12px'}}>
                          <span style={{fontSize:10,padding:'2px 8px',borderRadius:9,fontWeight:700,background:ev?.bg,color:ev?.color}}>{ev?.lbl} {estados[m.id]}</span>
                        </td>
                        <td style={{padding:'9px 12px',color:'#6B7280',fontSize:11}}>{est?.nombre_representante||'—'}</td>
                        <td style={{padding:'9px 12px',fontFamily:'monospace',fontSize:11,color:'#6B7280'}}>{est?.telefono_representante||'—'}</td>
                        <td style={{padding:'9px 12px'}}>
                          <div style={{display:'flex',gap:5}}>
                            <button onClick={()=>enviarWA(m)} disabled={!est?.telefono_representante}
                              style={{height:28,padding:'0 10px',background:est?.telefono_representante?'#25D366':'#E5E7EB',border:'none',borderRadius:6,color:est?.telefono_representante?'#fff':'#9CA3AF',fontSize:11,cursor:est?.telefono_representante?'pointer':'not-allowed',display:'flex',alignItems:'center',gap:3}}>
                              <i className="ti ti-brand-whatsapp" style={{fontSize:12}}/>WA
                            </button>
                            {est?.email_representante&&(
                              <a href={buildMailLink(est.email_representante,`${est.apellidos} ${est.nombres}`,sel.fecha,estados[m.id]||'ausente')} target="_blank"
                                style={{height:28,padding:'0 10px',background:'rgba(15,43,91,.08)',border:'none',borderRadius:6,color:'#0F2B5B',fontSize:11,cursor:'pointer',display:'flex',alignItems:'center',gap:3,textDecoration:'none'}}>
                                <i className="ti ti-mail" style={{fontSize:12}}/>Email
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* HISTORIAL */}
      {tab==='historial'&&(
        <div style={{background:'#fff',border:'0.5px solid #E5E7EB',borderRadius:12,overflow:'hidden'}}>
          <div style={{padding:'12px 16px',borderBottom:'0.5px solid #F3F4F6'}}>
            <span style={{fontSize:12,fontWeight:600,color:'#0F2B5B',display:'flex',alignItems:'center',gap:5}}>
              <i className="ti ti-calendar-month"/>Historial del mes · {sel.fecha?.slice(0,7)}
            </span>
          </div>
          {historial.length===0?(
            <div style={{padding:24,textAlign:'center',color:'#9CA3AF',fontSize:12}}>Sin registros de asistencia este mes.</div>
          ):(
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr>
                  {['Fecha','Estudiante','Estado','Justificada','Tardanza','Observación'].map(h=>(
                    <th key={h} style={{textAlign:'left',padding:'0 12px 8px',fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',borderBottom:'0.5px solid #F3F4F6'}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {historial.slice(0,100).map((a,i)=>{
                    const estado = a.presente?'presente':a.justificada?'justificada':a.tardanza?'tardanza':'ausente'
                    const ev = ESTADOS.find(e=>e.val===estado)
                    return(
                      <tr key={i} style={{borderBottom:'0.5px solid #F9FAFB'}}>
                        <td style={{padding:'8px 12px',fontFamily:'monospace',fontSize:11}}>{a.fecha}</td>
                        <td style={{padding:'8px 12px',fontWeight:500}}>{a.matriculas?.estudiantes?.apellidos}, {a.matriculas?.estudiantes?.nombres}</td>
                        <td style={{padding:'8px 12px'}}>
                          <span style={{fontSize:10,padding:'2px 7px',borderRadius:9,fontWeight:500,background:ev?.bg,color:ev?.color}}>{estado}</span>
                        </td>
                        <td style={{padding:'8px 12px',textAlign:'center'}}>{a.justificada?'✅':'—'}</td>
                        <td style={{padding:'8px 12px',textAlign:'center'}}>{a.tardanza?'⚠️':'—'}</td>
                        <td style={{padding:'8px 12px',color:'#6B7280',fontSize:11}}>{a.observacion||'—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
