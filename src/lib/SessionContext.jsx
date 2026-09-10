import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, ROLE_GROUP } from './supabase.js';
import { fetchInstituciones, fetchInstitucionData } from './data.js';
const SessionCtx = createContext(null);
export const useSession = () => useContext(SessionCtx);
export function SessionProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [instituciones, setInstituciones] = useState([]);
  const [institucion, setInstitucion] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const loadForUser = useCallback(async (authUser) => {
    const { data: prof, error: profErr } = await supabase
      .from('profiles').select('*').eq('id', authUser.id).single();
    if (profErr || !prof) { setError('No se encontró el perfil del usuario.'); setLoading(false); return; }
    const rol = ROLE_GROUP[prof.rol] || prof.rol;
    const isSuperAdmin = rol === 'super_admin';
    setProfile({ ...prof, rol, rolDb: prof.rol });
    const insts = await fetchInstituciones(prof.institucion_id, isSuperAdmin);
    setInstituciones(insts);
    // Para super_admin sin institución asignada, no asumimos ningún plantel
    // al azar (insts trae las 300 instituciones) — se queda en "alcance global".
    // Para el resto de roles, insts solo trae su propia institución, así que
    // el fallback a insts[0] sigue siendo seguro.
    setInstitucion(
      insts.find(i => i.id === prof.institucion_id) || (isSuperAdmin ? null : insts[0]) || null
    );
    if (prof.institucion_id) {
      const d = await fetchInstitucionData(prof.institucion_id);
      setData(d);
    } else {
      setData({ docentes: [], estudiantes: [], usuarios: [], administrativos: [], tareas: [] });
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) loadForUser(session.user);
      else setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) { setLoading(true); loadForUser(session.user); }
      else { setProfile(null); setData(null); setLoading(false); }
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [loadForUser]);
  const login = useCallback(async (email, password) => {
    setError('');
    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
    if (authErr) { setError('Correo o contraseña incorrectos.'); throw authErr; }
  }, []);
  const logout = useCallback(async () => { await supabase.auth.signOut(); }, []);
  // Vuelve a traer docentes/estudiantes/usuarios/etc. desde Supabase sin recargar toda la sesión.
  // Se debe llamar después de crear/editar/borrar registros, para que si el usuario navega a
  // otra pantalla y regresa, no vea una versión vieja en caché de los datos.
  const refrescarDatos = useCallback(async () => {
    if (!profile?.institucion_id) return;
    const d = await fetchInstitucionData(profile.institucion_id);
    setData(d);
  }, [profile]);
  return (
    <SessionCtx.Provider value={{ loading, profile, instituciones, institucion, data, error, login, logout, refrescarDatos }}>
      {children}
    </SessionCtx.Provider>
  );
}
