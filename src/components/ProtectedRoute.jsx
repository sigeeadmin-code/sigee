import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function ProtectedRoute({ children, roles }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#F7F9FC' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, background: '#0F2B5B', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <i className="ti ti-school" style={{ fontSize: 24, color: '#FFD100' }} />
          </div>
          <p style={{ color: '#6B7280', fontSize: 14 }}>Cargando SIGEE…</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (roles && profile && !roles.includes(profile.rol)) return <Navigate to="/sin-acceso" replace />

  return children
}
