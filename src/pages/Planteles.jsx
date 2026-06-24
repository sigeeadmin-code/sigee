import { useState, useEffect } from 'react'
import { getAll, getCount } from '../lib/supabase'

export default function Planteles() {
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const load = async () => {
      const [rows, cnt] = await Promise.all([
        getAll('planteles', { select: 'codigo_amie,nombre,provincia,canton,sostenimiento,activo', order: 'provincia', limit: 100 }),
        getCount('planteles')
      ])
      setData(rows); setTotal(cnt); setLoading(false)
    }
    load()
  }, [])

  const filtered = data.filter(p =>
    !search || p.nombre?.toLowerCase().includes(search.toLowerCase()) ||
    p.codigo_amie?.includes(search) || p.provincia?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <i className="ti ti-search" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', fontSize: 13 }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Buscar entre ${total} planteles...`}
          style={{ width: '100%', height: 34, border: '0.5px solid #E5E7EB', borderRadius: 7, padding: '0 10px 0 28px', fontSize: 12, background: '#F9FAFB', boxSizing: 'border-box' }} />
      </div>
      <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #F3F4F6' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#0F2B5B' }}>
            <i className="ti ti-building-community" style={{ marginRight: 5 }} />{filtered.length} de {total} planteles
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr>
              {['AMIE','Nombre','Provincia','Cantón','Sostenimiento','Estado'].map(h =>
                <th key={h} style={{ textAlign: 'left', padding: '0 12px 8px', fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '0.5px solid #F3F4F6' }}>{h}</th>
              )}
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 28, color: '#9CA3AF' }}>Cargando desde Supabase…</td></tr>
                : filtered.map((p, i) => (
                <tr key={i} style={{ borderBottom: '0.5px solid #F9FAFB' }}>
                  <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 11, color: '#6B7280' }}>{p.codigo_amie}</td>
                  <td style={{ padding: '9px 12px', fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</td>
                  <td style={{ padding: '9px 12px', color: '#6B7280' }}>{p.provincia}</td>
                  <td style={{ padding: '9px 12px', color: '#6B7280' }}>{p.canton}</td>
                  <td style={{ padding: '9px 12px' }}><span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 9, background: 'rgba(15,43,91,.08)', color: '#0F2B5B', fontWeight: 500 }}>{p.sostenimiento || '—'}</span></td>
                  <td style={{ padding: '9px 12px' }}><span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 9, background: p.activo ? 'rgba(22,163,74,.1)' : 'rgba(220,38,38,.08)', color: p.activo ? '#15803d' : '#DC2626', fontWeight: 500 }}>{p.activo ? 'Activa' : 'Inactiva'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
