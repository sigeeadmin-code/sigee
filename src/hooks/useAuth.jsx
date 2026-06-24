import { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      else setProfile(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    // Actualizar último acceso
    if (data.user) {
      await supabase.from('profiles').update({ ultimo_acceso: new Date().toISOString() }).eq('id', data.user.id)
    }
    return data
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  const rol = profile?.rol ?? null
  const isSuperAdmin = rol === 'super_admin'
  const isAdmin = rol === 'admin_plantel' || isSuperAdmin
  const isDocente = rol === 'docente' || isAdmin
  const isAlumno = rol === 'alumno'
  const isPadre = rol === 'padre'

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut, rol, isSuperAdmin, isAdmin, isDocente, isAlumno, isPadre }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
