import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { supabase, ROLE_GROUP, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase.js';
import { crearMonitorTic } from './ticMonitor.js';
import { API_URL, fetchInstituciones, fetchInstitucionData, fetchDatosGlobales, fetchPermisosPlantel, fetchCursosComoTutor, limpiarCacheConsultas } from './data.js';
import { borrarTodosLosBorradores } from './borradorNotas.js';
export const SessionCtx = createContext(null);   // exportado para poder probar pantallas con una sesión de prueba
export const useSession = () => useContext(SessionCtx);
export function SessionProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [instituciones, setInstituciones] = useState([]);
  const [institucion, setInstitucion] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  // Permisos y módulos del plantel (los fija el Admin global / el admin del plantel). Todo desactivado por defecto.
  const [permisos, setPermisos] = useState({ baseDocentes: false, docentesEditanPerfil: false, tutoresEditanEstudiantes: false });
  const [esTutor, setEsTutor] = useState(false);
  const cargarPermisos = useCallback(async (prof, institucionId) => {
    if (!institucionId) { setPermisos({ baseDocentes: false, docentesEditanPerfil: false, tutoresEditanEstudiantes: false }); setEsTutor(false); return; }
    try { setPermisos(await fetchPermisosPlantel(institucionId)); } catch { /* sin permisos: todo desactivado */ }
    if (prof?.rol === 'docente') {
      try {
        const { data: doc } = await supabase.from('docentes').select('id').eq('profile_id', prof.id).maybeSingle();
        setEsTutor(doc ? (await fetchCursosComoTutor(doc.id)).length > 0 : false);
      } catch { setEsTutor(false); }
    } else setEsTutor(false);
  }, []);
  const usuarioCargado = useRef(null);   // id del usuario cuyos datos ya están en pantalla
  const cargandoId = useRef(null);
  const cargarUsuario = useCallback(async (authUser) => {
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
    } else if (isSuperAdmin) {
      // Alcance global: todos los docentes y estudiantes de todos los planteles, con su plantel y AMIE.
      setData(await fetchDatosGlobales(insts).catch(() => ({ docentes: [], estudiantes: [], usuarios: [], administrativos: [], tareas: [] })));
    } else {
      setData({ docentes: [], estudiantes: [], usuarios: [], administrativos: [], tareas: [] });
    }
    await cargarPermisos({ ...prof, rol }, prof.institucion_id);
    usuarioCargado.current = authUser.id;
  }, [cargarPermisos]);
  const loadForUser = useCallback(async (authUser) => {
    if (cargandoId.current === authUser.id) return;       // ya hay una carga de este usuario en curso (arranque + evento de sesión)
    cargandoId.current = authUser.id;
    try { await cargarUsuario(authUser); }
    catch (e) { setError('No se pudo cargar tu información. Revisa tu conexión y recarga la página.'); }   // nunca dejar la pantalla en "Cargando…" para siempre
    finally { cargandoId.current = null; setLoading(false); }
  }, [cargarUsuario]);
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) loadForUser(session.user);
      else setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        // Supabase vuelve a avisar "sesión iniciada" cada vez que la pestaña recupera el foco y al renovar el token (cada hora).
        // Si es el MISMO usuario ya cargado, no se recarga nada ni se muestra "Cargando…": hacerlo destruía la pantalla abierta
        // (notas sin guardar, curso elegido) y era lo que dejaba el módulo en blanco o lo reiniciaba.
        if (usuarioCargado.current === session.user.id && event !== 'USER_UPDATED') return;
        setLoading(true); loadForUser(session.user);
      } else { usuarioCargado.current = null; setProfile(null); setData(null); setLoading(false); }
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [loadForUser]);
  const login = useCallback(async (email, password) => {
    setError('');
    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
    if (authErr) {
      // Soporte TIC: deja constancia del intento fallido (IP y correo). Nunca debe impedir mostrar el error.
      try { supabase.rpc('tic_login_fallido', { p_email: email }).then(() => {}, () => {}); } catch { /* sin registro */ }
      setError('Correo o contraseña incorrectos.'); throw authErr;
    }
  }, []);
  // scope 'local': cerrar sesión aquí NO invalida las sesiones de la misma cuenta abiertas en otras pestañas o dispositivos
  const monitorTic = useRef(null);
  const logout = useCallback(async () => {
    try { await monitorTic.current?.cerrar('logout'); } catch { /* no bloquea el cierre */ }
    try { borrarTodosLosBorradores(); limpiarCacheConsultas(); } catch { /* es solo limpieza */ }   // equipo compartido: no deja notas ni datos del usuario anterior
    await supabase.auth.signOut({ scope: 'local' });
  }, []);
  // Soporte TIC: latido de conexión mientras haya una sesión abierta (entrada, tiempo conectado y latencia).
  useEffect(() => {
    if (!profile?.id) return undefined;
    const m = crearMonitorTic({ supabase, apiUrl: API_URL, urlRest: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY });
    monitorTic.current = m; m.iniciar();
    return () => { m.cerrar('cambio_sesion'); if (monitorTic.current === m) monitorTic.current = null; };
  }, [profile?.id]);
  // Vuelve a traer docentes/estudiantes/usuarios/etc. desde Supabase sin recargar toda la sesión.
  // Se debe llamar después de crear/editar/borrar registros, para que si el usuario navega a
  // otra pantalla y regresa, no vea una versión vieja en caché de los datos.
  const refrescarDatos = useCallback(async () => {
    if (profile?.institucion_id) { setData(await fetchInstitucionData(profile.institucion_id)); return; }
    if (profile?.rolDb === 'super_admin') setData(await fetchDatosGlobales(instituciones));
  }, [profile, instituciones]);
  return (
    <SessionCtx.Provider value={{ loading, profile, instituciones, institucion, data, error, login, logout, refrescarDatos, permisos, esTutor, recargarPermisos: () => cargarPermisos(profile, profile?.institucion_id) }}>
      {children}
    </SessionCtx.Provider>
  );
}
