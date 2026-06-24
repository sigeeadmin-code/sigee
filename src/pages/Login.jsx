import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const [email, setEmail] = useState('sigee.admin@gmail.com')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError('Correo o contraseña incorrectos. Verifica tus credenciales.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0F2B5B 0%, #1A3A6E 60%, #0F2B5B 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, position: 'relative', overflow: 'hidden' }}>
      {/* Decoración fondo */}
      <div style={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,209,0,.06)' }} />
      <div style={{ position: 'absolute', bottom: -60, left: -60, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,.04)' }} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, background: '#FFD100', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', boxShadow: '0 8px 24px rgba(255,209,0,.3)' }}>
            <i className="ti ti-school" style={{ fontSize: 32, color: '#0F2B5B' }} />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', letterSpacing: '.5px' }}>SIGEE</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginTop: 4 }}>Sistema de Gestión Educativa Ecuatoriana</div>
        </div>

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 32, boxShadow: '0 24px 64px rgba(0,0,0,.25)' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1A2B4A', marginBottom: 4 }}>Iniciar sesión</div>
          <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 24 }}>Ingresa tus credenciales institucionales</div>

          {error && (
            <div style={{ background: 'rgba(220,38,38,.06)', border: '0.5px solid rgba(220,38,38,.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#B91C1C', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 7 }}>
              <i className="ti ti-alert-circle" style={{ fontSize: 14, flexShrink: 0 }} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 5 }}>
                Correo electrónico
              </label>
              <div style={{ position: 'relative' }}>
                <i className="ti ti-mail" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: '#9CA3AF' }} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="correo@ejemplo.com"
                  style={{ width: '100%', height: 40, border: '0.5px solid #E5E7EB', borderRadius: 8, padding: '0 10px 0 34px', fontSize: 13, color: '#1A2B4A', background: '#F9FAFB', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 5 }}>
                Contraseña
              </label>
              <div style={{ position: 'relative' }}>
                <i className="ti ti-lock" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: '#9CA3AF' }} />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  style={{ width: '100%', height: 40, border: '0.5px solid #E5E7EB', borderRadius: 8, padding: '0 36px 0 34px', fontSize: 13, color: '#1A2B4A', background: '#F9FAFB', boxSizing: 'border-box' }}
                />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: '#9CA3AF' }}>
                  <i className={`ti ${showPass ? 'ti-eye-off' : 'ti-eye'}`} style={{ fontSize: 15 }} />
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', height: 42, background: loading ? '#6B7280' : '#0F2B5B', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background .15s' }}
            >
              {loading ? (
                <><i className="ti ti-loader" style={{ fontSize: 16 }} />Ingresando…</>
              ) : (
                <><i className="ti ti-login" style={{ fontSize: 16 }} />Ingresar al sistema</>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: 'rgba(255,255,255,.35)' }}>
          SIGEE v1.0 · Ecuador 2025–2026 · Supabase Cloud
        </div>
      </div>
    </div>
  )
}
