import { useState, useEffect } from 'react'
import { getAll, getCount } from '../lib/supabase'

const sitColors = {
  Nombramiento: { bg: 'rgba(15,43,91,.08)', color: '#0F2B5B' },
  Contrato: { bg: 'rgba(217,119,6,.1)', color: '#D97706' },
  Reemplazo: { bg: 'rgba(220,38,38,.08)', color: '#DC2626' },
  Provisional: { bg: 'rgba(107,114,128,.1)', color: '#6B7280' }
}

export default function Docentes() {
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const load = async () => {
      const [rows, cnt] = await Promise.all([
        getAll('docentes', { select: 'apellidos,nombres,cedula,situacion_laboral,categoria,escalafon,activo', order: 'apellidos', limit: 100 }),
        getCount('docentes')
      ])
      setData(rows); setTotal(cnt); setLoading(false)
    }
    load()
  }, [])

  const filtered = data.filter(d =>
    !search || `${d.apellidos} ${d.nombres} ${d.cedula}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <i className="ti ti-search" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', fontSize: 13 }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Buscar entre ${total} docentes...`}
          style={{ width: '100%', height: 34, border: '0.5px solid #E5E7EB', borderRadius: 7, padding: '0 10px 0 28px', fontSize: 12, background: '#F9FAFB', boxSizing: 'border-box' }} />
      </div>
      <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #F3F4F6' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#0F2B5B' }}><i className="ti ti-users" style={{ marginRight: 5 }} />{filtered.length} de {total} docentes</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr>
              {['#','Nombre','Cédula','Situación','Categoría','Escalafón','Estado'].map(h =>
                <th key={h} style={{ textAlign: 'left', padding: '0 12px 8px', fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '0.5px solid #F3F4F6' }}>{h}</th>
              )}
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 28, color: '#9CA3AF' }}>Cargando desde Supabase…</td></tr>
                : filtered.map((d, i) => {
                  const sc = sitColors[d.situacion_laboral] || { bg: 'rgba(107,114,128,.1)', color: '#6B7280' }
                  return (
                    <tr key={i} style={{ borderBottom: '0.5px solid #F9FAFB' }}>
                      <td style={{ padding: '9px 12px', fontSize: 10, color: '#9CA3AF' }}>{i+1}</td>
                      <td style={{ padding: '9px 12px', fontWeight: 500 }}>{d.apellidos}, {d.nombres}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 11, color: '#6B7280' }}>{d.cedula}</td>
                      <td style={{ padding: '9px 12px' }}><span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 9, background: sc.bg, color: sc.color, fontWeight: 500 }}>{d.situacion_laboral || '—'}</span></td>
                      <td style={{ padding: '9px 12px', color: '#6B7280' }}>{d.categoria || '—'}</td>
                      <td style={{ padding: '9px 12px', fontWeight: 600, color: '#0F2B5B' }}>{d.escalafon || '—'}</td>
                      <td style={{ padding: '9px 12px' }}><span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 9, background: d.activo ? 'rgba(22,163,74,.1)' : 'rgba(220,38,38,.08)', color: d.activo ? '#15803d' : '#DC2626', fontWeight: 500 }}>{d.activo ? 'Activo' : 'Inactivo'}</span></td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
