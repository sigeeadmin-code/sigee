import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, getCount, getAll } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const StatCard = ({ icon, value, label, color, border }) => (
  <div style={{ background: '#F9FAFB', borderRadius: 10, padding: 14, position: 'relative', overflow: 'hidden', border: '0.5px solid #E5E7EB' }}>
    <div style={{ position: 'absolute', top: 0, right: 0, width: 3, height: '100%', background: border }} />
    <div style={{ width: 30, height: 30, borderRadius: 7, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
      <i className={`ti ${icon}`} style={{ fontSize: 15, color: '#fff' }} />
    </div>
    <div style={{ fontSize: 22, fontWeight: 700, color: '#1A2B4A', lineHeight: 1 }}>{value ?? <span style={{ fontSize: 14, color: '#9CA3AF' }}>…</span>}</div>
    <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 3 }}>{label}</div>
  </div>
)

export default function Dashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({})
  const [planteles, setPlanteles] = useState([])
  const [docentes, setDocentes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [nP, nD, nT, nE, nM, pls, docs] = await Promise.all([
          getCount('planteles'),
          getCount('docentes'),
          getCount('docente_titulos'),
          getCount('estudiantes'),
          getCount('matriculas'),
          getAll('planteles', { select: 'codigo_amie,nombre,provincia,canton', order: 'nombre', limit: 8 }),
          getAll('docentes', { select: 'apellidos,nombres,situacion_laboral,activo', order: 'apellidos', limit: 6 }),
        ])
        setStats({ planteles: nP, docentes: nD, titulos: nT, estudiantes: nE, matriculas: nM })
        setPlanteles(pls)
        setDocentes(docs)
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const hora = new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })
  const fecha = new Date().toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div>
      {/* Bienvenida */}
      <div style={{ background: 'linear-gradient(135deg,#0F2B5B,#1e4080)', borderRadius: 12, padding: '18px 22px', marginBottom: 18, color: '#fff', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,209,0,.08)' }} />
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>{fecha} · {hora}</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Bienvenido, {profile?.nombre_completo?.split(' ')[0] || 'Admin'} 👋</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', marginTop: 3 }}>Panel de control SIGEE · Año lectivo 2025–2026 · 2do Quimestre abierto</div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 18 }}>
        <StatCard icon="ti-building-community" value={stats.planteles} label="Planteles" color="#0F2B5B" border="#0F2B5B" />
        <StatCard icon="ti-users" value={stats.docentes} label="Docentes" color="#16A34A" border="#16A34A" />
        <StatCard icon="ti-certificate" value={stats.titulos} label="Títulos" color="#534AB7" border="#534AB7" />
        <StatCard icon="ti-school" value={stats.estudiantes} label="Estudiantes" color="#D97706" border="#D97706" />
        <StatCard icon="ti-file-certificate" value={stats.matriculas} label="Matrículas" color="#DC2626" border="#DC2626" />
      </div>

      {/* Accesos rápidos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 18 }}>
        {[
          { icon: 'ti-school', label: 'Nuevo estudiante', to: '/estudiantes', color: '#0F2B5B' },
          { icon: 'ti-file-certificate', label: 'Nueva matrícula', to: '/matriculas', color: '#16A34A' },
          { icon: 'ti-chart-line', label: 'Calificaciones', to: '/calificaciones', color: '#534AB7' },
          { icon: 'ti-checklist', label: 'Asistencia', to: '/asistencia', color: '#D97706' },
        ].map(q => (
          <div key={q.to} onClick={() => navigate(q.to)} style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, padding: '14px 12px', textAlign: 'center', cursor: 'pointer', transition: 'box-shadow .15s' }}
            onMouseOver={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.08)'}
            onMouseOut={e => e.currentTarget.style.boxShadow = 'none'}>
            <i className={`ti ${q.icon}`} style={{ fontSize: 22, color: q.color, display: 'block', marginBottom: 6 }} />
            <span style={{ fontSize: 11, color: '#6B7280' }}>{q.label}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Planteles */}
        <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#0F2B5B', display: 'flex', alignItems: 'center', gap: 5 }}><i className="ti ti-building-community" />Planteles registrados</span>
            <button onClick={() => navigate('/planteles')} style={{ fontSize: 11, color: '#0F2B5B', border: 'none', background: 'none', cursor: 'pointer' }}>Ver todos →</button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead><tr>
              {['AMIE','Nombre','Provincia'].map(h => <th key={h} style={{ textAlign: 'left', padding: '0 12px 8px', fontSize: 9, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '0.5px solid #F3F4F6' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={3} style={{ textAlign: 'center', padding: 20, color: '#9CA3AF' }}>Cargando…</td></tr>
                : planteles.map((p, i) => (
                  <tr key={i} style={{ borderBottom: '0.5px solid #F9FAFB' }}>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 10, color: '#6B7280' }}>{p.codigo_amie}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 500, color: '#1A2B4A', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</td>
                    <td style={{ padding: '8px 12px', color: '#6B7280' }}>{p.provincia}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Docentes */}
        <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#0F2B5B', display: 'flex', alignItems: 'center', gap: 5 }}><i className="ti ti-users" />Docentes registrados</span>
            <button onClick={() => navigate('/docentes')} style={{ fontSize: 11, color: '#0F2B5B', border: 'none', background: 'none', cursor: 'pointer' }}>Ver todos →</button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead><tr>
              {['Nombre','Situación','Estado'].map(h => <th key={h} style={{ textAlign: 'left', padding: '0 12px 8px', fontSize: 9, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '0.5px solid #F3F4F6' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={3} style={{ textAlign: 'center', padding: 20, color: '#9CA3AF' }}>Cargando…</td></tr>
                : docentes.map((d, i) => (
                  <tr key={i} style={{ borderBottom: '0.5px solid #F9FAFB' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 500, color: '#1A2B4A' }}>{d.apellidos}, {d.nombres}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 9, background: 'rgba(15,43,91,.08)', color: '#0F2B5B', fontWeight: 500 }}>{d.situacion_laboral || '—'}</span>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 9, background: d.activo ? 'rgba(22,163,74,.1)' : 'rgba(220,38,38,.08)', color: d.activo ? '#15803d' : '#DC2626', fontWeight: 500 }}>{d.activo ? 'Activo' : 'Inactivo'}</span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
