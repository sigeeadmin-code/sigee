import React from 'react'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const SC = { Fiscal:'#2563eb', Fiscomisional:'#7c3aed', Particular:'#ea580c', Municipal:'#0891b2' }

const FIELDS = [
  {g:'Identificación', f:[
    ['codigo_amie','Código AMIE',1],['nombre','Nombre del plantel',2],
    ['provincia','Provincia',1],['canton','Cantón',1],['parroquia','Parroquia',1],
  ]},
  {g:'Ubicación administrativa', f:[
    ['zona','Zona',1],['distrito_nombre','Nombre del distrito',1],
    ['cod_distrito','Código distrito',1],['cod_circuito','Código circuito',1],
  ]},
  {g:'Características', f:[
    ['sostenimiento','Sostenimiento',1,['Fiscal','Fiscomisional','Particular','Municipal']],
    ['regimen','Régimen',1,['Sierra','Costa','Amazónico','Galápagos']],
    ['jornada','Jornada',1,['Matutina','Vespertina','Nocturna','Completa']],
    ['modalidad','Modalidad',1,['Presencial','Semipresencial','A distancia','Virtual']],
    ['tipo_educacion','Tipo educación',1],['nivel','Nivel',1],
    ['jurisdiccion','Jurisdicción',1],['acceso','Acceso',1],
  ]},
  {g:'Personal y estudiantes', f:[
    ['num_estudiantes','Nº Estudiantes',1,'number'],['num_docentes','Nº Docentes',1,'number'],
    ['doc_nombramiento','Doc. nombramiento',1,'number'],['doc_contrato','Doc. contrato',1,'number'],
    ['doc_reemplazo','Doc. reemplazo',1,'number'],['num_administrativos','Nº Administrativos',1,'number'],
  ]},
  {g:'Autoridades', f:[
    ['aut_director','Director/a',2],['aut_vicerrector','Vicerrector/a',2],
    ['aut_secretario','Secretario/a',1],['aut_inspector','Inspector/a',1],
  ]},
  {g:'Estado', f:[
    ['estado','Estado',1,['Activa','Inactiva','En proceso','Cerrada']],
    ['etnia','Etnia predominante',1],
  ]},
]

function AmieChip({ amie, onClick }) {
  return (
    <span onClick={onClick} style={{
      display:'inline-flex', alignItems:'center', fontFamily:'monospace', fontSize:11, fontWeight:700,
      background:'#eff6ff', color:'#1d4ed8', border:'1px solid #bfdbfe', borderRadius:7,
      padding:'3px 9px', cursor:'pointer', transition:'all .12s'
    }}
    onMouseOver={e=>{e.currentTarget.style.background='#dbeafe';e.currentTarget.style.borderColor='#93c5fd'}}
    onMouseOut={e=>{e.currentTarget.style.background='#eff6ff';e.currentTarget.style.borderColor='#bfdbfe'}}>
      {amie}
    </span>
  )
}

function FichaPlantel({ plantel, onClose, onEdit, hermanos }) {
  const r = plantel
  const est = +r.num_estudiantes||0, doc = +r.num_docentes||0, adm = +r.num_administrativos||0
  const nom=+r.doc_nombramiento||0, con=+r.doc_contrato||0, ree=+r.doc_reemplazo||0
  const total = doc+adm

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:20}} onClick={onClose}>
      <div style={{background:'#fff',borderRadius:16,maxWidth:880,width:'100%',maxHeight:'90vh',overflowY:'auto',boxShadow:'0 24px 64px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
        {/* HERO */}
        <div style={{background:'linear-gradient(135deg,#0F2B5B,#1e3a8a)',borderRadius:'16px 16px 0 0',padding:28,position:'relative',overflow:'hidden',color:'#fff'}}>
          <div style={{position:'absolute',top:-10,right:20,fontSize:120,fontWeight:900,opacity:.06,fontFamily:'monospace',pointerEvents:'none'}}>{r.codigo_amie}</div>
          <button onClick={onClose} style={{position:'absolute',top:14,right:14,width:30,height:30,borderRadius:8,border:'none',background:'rgba(255,255,255,.12)',color:'#fff',cursor:'pointer',fontSize:16,zIndex:2}}>✕</button>
          <div style={{position:'relative',display:'flex',gap:18,alignItems:'flex-start',flexWrap:'wrap'}}>
            <div style={{flexShrink:0,width:72,height:72,borderRadius:12,background:'rgba(255,255,255,.1)',border:'2px dashed rgba(255,255,255,.25)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:30}}>🏫</div>
            <div style={{flex:1,minWidth:200}}>
              <div style={{fontSize:10,letterSpacing:'.14em',textTransform:'uppercase',opacity:.5,marginBottom:6}}>SIGEE · Ficha de Plantel</div>
              <div style={{fontSize:34,fontWeight:900,color:'#93c5fd',fontFamily:'monospace',lineHeight:1}}>{r.codigo_amie}</div>
              <div style={{fontSize:18,fontWeight:700,marginTop:8,lineHeight:1.3}}>{r.nombre}</div>
              <div style={{marginTop:10,display:'flex',gap:7,flexWrap:'wrap'}}>
                <span style={{background:'rgba(255,255,255,.1)',borderRadius:20,padding:'4px 11px',fontSize:11,color:'rgba(255,255,255,.8)'}}>📍 {r.parroquia}, {r.canton}</span>
                {r.cod_distrito&&<span style={{background:'rgba(255,255,255,.1)',borderRadius:20,padding:'4px 11px',fontSize:11,color:'rgba(255,255,255,.8)'}}>🗺 {r.cod_distrito}</span>}
                {r.cod_circuito&&<span style={{background:'rgba(255,255,255,.1)',borderRadius:20,padding:'4px 11px',fontSize:11,color:'rgba(255,255,255,.8)'}}>🔗 {r.cod_circuito}</span>}
              </div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:6,alignItems:'flex-end'}}>
              {r.sostenimiento&&<span style={{background:SC[r.sostenimiento]||'#64748b',color:'#fff',padding:'5px 13px',borderRadius:20,fontSize:11,fontWeight:700}}>{r.sostenimiento}</span>}
              <span style={{background:'#16a34a',color:'#fff',padding:'5px 13px',borderRadius:20,fontSize:11,fontWeight:700}}>● {r.estado||'Activa'}</span>
              {r.jornada&&<span style={{background:'rgba(255,255,255,.1)',color:'rgba(255,255,255,.8)',padding:'5px 13px',borderRadius:20,fontSize:11}}>{r.jornada}</span>}
            </div>
          </div>
        </div>

        <div style={{padding:24}}>
          {/* 3 stat cards */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:14,marginBottom:20}}>
            <div style={{border:'1px solid #93c5fd',background:'linear-gradient(135deg,#eff6ff,#dbeafe)',borderRadius:12,padding:16,textAlign:'center'}}>
              <i className="ti ti-school" style={{fontSize:24,color:'#1d4ed8'}}/>
              <div style={{fontSize:26,fontWeight:800,color:'#1d4ed8',marginTop:4}}>{est.toLocaleString()}</div>
              <div style={{fontSize:11,color:'#1e40af',fontWeight:600,marginTop:2}}>Estudiantes</div>
              <div style={{fontSize:10,background:'#dbeafe',color:'#2563eb',borderRadius:6,padding:'2px 8px',marginTop:6,display:'inline-block'}}>{doc?Math.round(est/doc)+' por docente':'—'}</div>
            </div>
            <div style={{border:'1px solid #86efac',background:'linear-gradient(135deg,#f0fdf4,#dcfce7)',borderRadius:12,padding:16,textAlign:'center'}}>
              <i className="ti ti-users" style={{fontSize:24,color:'#15803d'}}/>
              <div style={{fontSize:26,fontWeight:800,color:'#15803d',marginTop:4}}>{doc.toLocaleString()}</div>
              <div style={{fontSize:11,color:'#166534',fontWeight:600,marginTop:2}}>Docentes</div>
              <div style={{fontSize:10,color:'#166534',marginTop:6,display:'flex',gap:5,justifyContent:'center'}}>
                <span title="Nombramiento">N:{nom}</span><span title="Contrato">C:{con}</span><span title="Reemplazo">R:{ree}</span>
              </div>
            </div>
            <div style={{border:'1px solid #fbbf24',background:'linear-gradient(135deg,#fffbeb,#fef3c7)',borderRadius:12,padding:16,textAlign:'center'}}>
              <div style={{fontSize:24}}>👥</div>
              <div style={{fontSize:26,fontWeight:800,color:'#b45309',marginTop:4}}>{total.toLocaleString()}</div>
              <div style={{fontSize:11,color:'#92400e',fontWeight:600,marginTop:2}}>Personal total</div>
              <div style={{fontSize:10,color:'#92400e',marginTop:6}}>{adm} administrativos</div>
            </div>
          </div>

          {/* Detalles en grid */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20}}>
            {[
              ['Sostenimiento',r.sostenimiento],['Régimen',r.regimen],['Jornada',r.jornada],['Modalidad',r.modalidad],
              ['Nivel',r.nivel],['Jurisdicción',r.jurisdiccion],['Acceso',r.acceso],['Zona',r.zona],
            ].map(([l,v])=>(
              <div key={l} style={{background:'#F9FAFB',borderRadius:8,padding:'8px 12px',border:'0.5px solid #E5E7EB'}}>
                <div style={{fontSize:9,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px'}}>{l}</div>
                <div style={{fontSize:12,fontWeight:500,color:'#1A2B4A',marginTop:2}}>{v||'—'}</div>
              </div>
            ))}
          </div>

          {(r.aut_director||r.aut_vicerrector)&&(
            <div style={{marginBottom:20}}>
              <div style={{fontSize:11,fontWeight:600,color:'#0F2B5B',marginBottom:8}}>Autoridades</div>
              <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                {r.aut_director&&<span style={{fontSize:11,background:'#F3F4F6',borderRadius:7,padding:'5px 10px'}}>👔 Director: {r.aut_director}</span>}
                {r.aut_vicerrector&&<span style={{fontSize:11,background:'#F3F4F6',borderRadius:7,padding:'5px 10px'}}>👔 Vicerrector: {r.aut_vicerrector}</span>}
              </div>
            </div>
          )}

          {hermanos?.length>0&&(
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:600,color:'#0F2B5B',marginBottom:8}}>Otros planteles en {r.canton}</div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {hermanos.map(h=><AmieChip key={h.id} amie={h.codigo_amie} onClick={()=>{}}/>)}
              </div>
            </div>
          )}

          <div style={{display:'flex',justifyContent:'flex-end',gap:8,paddingTop:14,borderTop:'0.5px solid #F3F4F6'}}>
            <button onClick={onClose} style={{height:34,padding:'0 16px',border:'0.5px solid #E5E7EB',borderRadius:7,background:'#fff',fontSize:12,cursor:'pointer'}}>Cerrar</button>
            <button onClick={()=>onEdit(r)} style={{height:34,padding:'0 18px',background:'#0F2B5B',border:'none',borderRadius:7,color:'#fff',fontSize:12,fontWeight:500,cursor:'pointer',display:'flex',alignItems:'center',gap:5}}>
              <i className="ti ti-edit" style={{fontSize:13}}/>Editar plantel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function FieldInput(props) {
  var id = props.id, lbl = props.lbl, span = props.span, opts = props.opts, form = props.form, setForm = props.setForm
  var isSelect = Array.isArray(opts)
  var isNumber = opts === 'number'
  var colSpan = span === 2 ? 'span 2' : 'auto'
  var val = form[id] || ''

  function handleChange(e) {
    var v = e.target.value
    if (isNumber) v = +v
    var next = Object.assign({}, form)
    next[id] = v
    setForm(next)
  }

  var inputEl
  if (isSelect) {
    var optionEls = [React.createElement('option', { key: '_empty', value: '' }, '—')]
    for (var i = 0; i < opts.length; i++) {
      optionEls.push(React.createElement('option', { key: opts[i], value: opts[i] }, opts[i]))
    }
    inputEl = React.createElement('select', {
      value: val, onChange: handleChange,
      style: { width:'100%', height:32, border:'0.5px solid #E5E7EB', borderRadius:6, padding:'0 8px', fontSize:12, background:'#F9FAFB' }
    }, optionEls)
  } else {
    inputEl = React.createElement('input', {
      type: isNumber ? 'number' : 'text', value: val, onChange: handleChange,
      style: { width:'100%', height:32, border:'0.5px solid #E5E7EB', borderRadius:6, padding:'0 8px', fontSize:12, background:'#F9FAFB', boxSizing:'border-box', fontFamily: id==='codigo_amie' ? 'monospace' : 'inherit' }
    })
  }

  return (
    <div style={{gridColumn:colSpan}}>
      <div style={{fontSize:10,color:'#9CA3AF',marginBottom:3}}>{lbl}</div>
      {inputEl}
    </div>
  )
}

function FieldGroup(props) {
  var group = props.group, form = props.form, setForm = props.setForm
  var items = []
  for (var i = 0; i < group.f.length; i++) {
    var row = group.f[i]
    items.push(
      <FieldInput key={row[0]} id={row[0]} lbl={row[1]} span={row[2]} opts={row[3]} form={form} setForm={setForm} />
    )
  }
  return (
    <div style={{marginBottom:18}}>
      <div style={{fontSize:10,fontWeight:700,color:'#0F2B5B',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:8,borderBottom:'0.5px solid #F3F4F6',paddingBottom:5}}>{group.g}</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        {items}
      </div>
    </div>
  )
}

function EditModal({ plantel, onClose, onSaved }) {
  const [form, setForm] = useState(Object.assign({}, plantel))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const handleSave = async () => {
    const amieVal = (form.codigo_amie || '').trim()
    const nombreVal = (form.nombre || '').trim()
    if (!amieVal || !nombreVal) { setErr('Código AMIE y nombre son obligatorios'); return }
    setSaving(true)
    const resp = await supabase.from('planteles').update(form).eq('id', plantel.id)
    setSaving(false)
    if (resp.error) { setErr(resp.error.message); return }
    onSaved()
  }

  const groupEls = []
  for (var i = 0; i < FIELDS.length; i++) {
    groupEls.push(<FieldGroup key={FIELDS[i].g} group={FIELDS[i]} form={form} setForm={setForm} />)
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1100,padding:20}} onClick={onClose}>
      <div style={{background:'#fff',borderRadius:14,maxWidth:760,width:'100%',maxHeight:'88vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:'16px 20px',borderBottom:'0.5px solid #F3F4F6',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,background:'#fff',zIndex:1}}>
          <span style={{fontSize:14,fontWeight:700,color:'#0F2B5B'}}>
            <i className="ti ti-edit" style={{marginRight:6}}></i>
            Editar Plantel - {plantel.codigo_amie}
          </span>
          <button onClick={onClose} style={{border:'none',background:'none',fontSize:18,cursor:'pointer',color:'#9CA3AF'}}>X</button>
        </div>
        <div style={{padding:20}}>
          {err ? <div style={{background:'rgba(220,38,38,.06)',border:'0.5px solid rgba(220,38,38,.2)',borderRadius:8,padding:'9px 12px',fontSize:12,color:'#B91C1C',marginBottom:14}}>{err}</div> : null}
          {groupEls}
          <div style={{display:'flex',justifyContent:'flex-end',gap:8,paddingTop:10,borderTop:'0.5px solid #F3F4F6'}}>
            <button onClick={onClose} style={{height:34,padding:'0 16px',border:'0.5px solid #E5E7EB',borderRadius:7,background:'#fff',fontSize:12,cursor:'pointer'}}>Cancelar</button>
            <button onClick={handleSave} disabled={saving}
              style={{height:34,padding:'0 18px',background: saving ? '#6B7280' : '#0F2B5B',border:'none',borderRadius:7,color:'#fff',fontSize:12,cursor: saving ? 'not-allowed' : 'pointer',display:'flex',alignItems:'center',gap:5}}>
              <i className={saving ? 'ti ti-loader' : 'ti ti-device-floppy'} style={{fontSize:13}}></i>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Planteles() {
  const { isSuperAdmin, isAdmin } = useAuth()
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [ficha, setFicha] = useState(null)
  const [editing, setEditing] = useState(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const [{ data: rows }, cnt] = await Promise.all([
      supabase.from('planteles').select('*').order('provincia').order('nombre').limit(709),
      supabase.from('planteles').select('*', { count:'exact', head:true })
    ])
    setData(rows||[])
    setTotal(cnt.count||0)
    setLoading(false)
  }

  const filtered = data.filter(p =>
    !search || p.nombre?.toLowerCase().includes(search.toLowerCase()) ||
    p.codigo_amie?.includes(search) || p.provincia?.toLowerCase().includes(search.toLowerCase())
  )

  const hermanos = ficha ? data.filter(p => p.canton===ficha.canton && p.id!==ficha.id)
    .sort((a,b)=>(+b.num_estudiantes||0)-(+a.num_estudiantes||0)).slice(0,8) : []

  return (
    <div>
      <div style={{position:'relative',marginBottom:14}}>
        <i className="ti ti-search" style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',color:'#9CA3AF',fontSize:13}}/>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Buscar entre ${total} planteles...`}
          style={{width:'100%',height:34,border:'0.5px solid #E5E7EB',borderRadius:7,padding:'0 10px 0 28px',fontSize:12,background:'#F9FAFB',boxSizing:'border-box'}}/>
      </div>

      <div style={{background:'#fff',border:'0.5px solid #E5E7EB',borderRadius:12,overflow:'hidden'}}>
        <div style={{padding:'12px 16px',borderBottom:'0.5px solid #F3F4F6'}}>
          <span style={{fontSize:12,fontWeight:600,color:'#0F2B5B'}}>
            <i className="ti ti-building-community" style={{marginRight:5}}/>{filtered.length} de {total} planteles
            <span style={{fontSize:10,color:'#9CA3AF',marginLeft:8,fontWeight:400}}>· clic en el código AMIE para ver la ficha completa</span>
          </span>
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead><tr>
              {['AMIE','Nombre','Provincia','Cantón','Sostenimiento','Estado'].map(h=>(
                <th key={h} style={{textAlign:'left',padding:'0 12px 8px',fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.4px',borderBottom:'0.5px solid #F3F4F6'}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {loading?(
                <tr><td colSpan={6} style={{textAlign:'center',padding:28,color:'#9CA3AF'}}>Cargando desde Supabase…</td></tr>
              ):filtered.map((p,i)=>(
                <tr key={p.id} style={{borderBottom:'0.5px solid #F9FAFB'}}>
                  <td style={{padding:'9px 12px'}}><AmieChip amie={p.codigo_amie} onClick={()=>setFicha(p)}/></td>
                  <td style={{padding:'9px 12px',fontWeight:500,maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.nombre}</td>
                  <td style={{padding:'9px 12px',color:'#6B7280'}}>{p.provincia}</td>
                  <td style={{padding:'9px 12px',color:'#6B7280'}}>{p.canton}</td>
                  <td style={{padding:'9px 12px'}}><span style={{fontSize:10,padding:'2px 7px',borderRadius:9,background:'rgba(15,43,91,.08)',color:'#0F2B5B',fontWeight:500}}>{p.sostenimiento||'—'}</span></td>
                  <td style={{padding:'9px 12px'}}><span style={{fontSize:10,padding:'2px 7px',borderRadius:9,fontWeight:500,background:p.activo?'rgba(22,163,74,.1)':'#F3F4F6',color:p.activo?'#15803d':'#9CA3AF'}}>{p.estado||(p.activo?'Activa':'Inactiva')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {ficha && (
        <FichaPlantel plantel={ficha} hermanos={hermanos} onClose={()=>setFicha(null)}
          onEdit={(p)=>{ if(isAdmin){ setEditing(p) } }}/>
      )}
      {editing && (
        <EditModal plantel={editing} onClose={()=>setEditing(null)}
          onSaved={()=>{ setEditing(null); setFicha(null); load() }}/>
      )}
    </div>
  )
}
