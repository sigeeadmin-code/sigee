import { useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const TITLES = {
  '/dashboard': 'Dashboard',
  '/planteles': 'Planteles',
  '/docentes': 'Docentes',
  '/perfil-docente': 'Perfil del Docente',
  '/estudiantes': 'Estudiantes',
  '/cursos': 'Cursos',
  '/materias': 'Materias',
  '/matriculas': 'Matrículas',
  '/calificaciones': 'Calificaciones',
  '/horarios': 'Horarios',
  '/periodos': 'Períodos Académicos',
  '/asistencia': 'Asistencia',
  '/usuarios': 'Usuarios',
  '/reportes': 'Reportes',
  '/configuracion': 'Configuración',
}

export default function Topbar() {
  const { pathname } = useLocation()
  const { profile } = useAuth()
  const title = TITLES[pathname] || 'SIGEE'
  const crumb = `Inicio / ${title}`

  return (
    <header style={{ height: 52, padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '0.5px solid var(--border)', background: '#fff', flexShrink: 0, position: 'sticky', top: 0, zIndex: 10 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#1A2B4A' }}>{title}</div>
        <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>{crumb}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, background: 'rgba(15,43,91,.07)', color: '#0F2B5B', padding: '3px 9px', borderRadius: 5, border: '0.5px solid rgba(15,43,91,.15)', fontWeight: 500 }}>
          2025–2026
        </span>
        <span style={{ fontSize: 10, background: 'rgba(22,163,74,.08)', color: '#15803d', padding: '3px 9px', borderRadius: 5, border: '0.5px solid rgba(22,163,74,.2)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A', display: 'inline-block' }} />
          Supabase conectado
        </span>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#FFD100', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#0F2B5B' }}>
          {profile?.nombre_completo?.slice(0, 2).toUpperCase() || 'SA'}
        </div>
      </div>
    </header>
  )
}
