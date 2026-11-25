import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { supabase, ROLE_GROUP, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase.js';
import { crearMonitorTic } from './ticMonitor.js';
import { API_URL, fetchInstituciones, fetchInstitucionData, fetchDatosGlobales, fetchPermisosPlantel, fetchCursosComoTutor, limpiarCacheConsultas } from './data.js';
import { borrarTodosLosBorradores } from './borradorNotas.js';
import { HUB_KEY, HUB_ADMIN_KEY, HUB_IR_KEY, HUB_RUTA, LUMEN_ID, leerHub, limpiarHub, decidirLogout } from './hubLumen.js';
export const SessionCtx = createContext(null);   // exportado para poder probar pantallas con una sesión de prueba
export const useSession = () => useContext(SessionCtx);
export function SessionProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [instituciones, setInstituciones] = useState([]);
  const [institucion, setInstitucion] = useState(null);
  const [demo, setDemo] = useState({ esDemo: false, hasta: null, vencida: false });
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [recuperando, setRecuperando] = useState(false);   // el usuario llegó por el enlace del correo y debe elegir su nueva contraseña
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
    // Demostración: si la institución es una demo, arranca (o consulta) el conteo de 5 días. No bloquea la carga.
    if (prof.institucion_id) {
      supabase.rpc('demo_iniciar_conteo').then(({ data: hasta, error: eDemo }) => {
        if (eDemo || !hasta) setDemo({ esDemo: false, hasta: null, vencida: false });
        else setDemo({ esDemo: true, hasta, vencida: new Date(hasta) < new Date() });
      }, () => setDemo({ esDemo: false, hasta: null, vencida: false }));
    } else setDemo({ esDemo: false, hasta: null, vencida: false });
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
      setData(await fetchDatosGlobales(insts).catch(e => ({ docentes: [], estudiantes: [], usuarios: [], administrativos: [], tareas: [], errorCarga: e?.message || 'No se pudieron cargar los datos de los planteles.' })));
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
      if (event === 'PASSWORD_RECOVERY') setRecuperando(true);
      if (session?.user) {
        // Supabase vuelve a avisar "sesión iniciada" cada vez que la pestaña recupera el foco y al renovar el token (cada hora).
        // Si es el MISMO usuario ya cargado, no se recarga nada ni se muestra "Cargando…": hacerlo destruía la pantalla abierta
        // (notas sin guardar, curso elegido) y era lo que dejaba el módulo en blanco o lo reiniciaba.
        if (usuarioCargado.current === session.user.id && event !== 'USER_UPDATED') return;
        setLoading(true); loadForUser(session.user);
      } else { usuarioCargado.current = null; setProfile(null); setData(null); setDemo({ esDemo: false, hasta: null, vencida: false }); setLoading(false); }
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [loadForUser]);
  const login = useCallback(async (email, password) => {
    setError('');
    limpiarHub();   // un inicio de sesión nuevo siempre empieza sin rastros de una prueba anterior del Hub
    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
    if (!authErr) { try { sessionStorage.setItem(HUB_IR_KEY, '1'); } catch { /* sin storage */ } }   // si es Super Admin, App lo lleva al Hub
    if (authErr) {
      // Soporte TIC: deja constancia del intento fallido (IP y correo). Nunca debe impedir mostrar el error.
      try { supabase.rpc('tic_login_fallido', { p_email: email }).then(() => {}, () => {}); } catch { /* sin registro */ }
      setError('Correo o contraseña incorrectos.'); throw authErr;
    }
  }, []);
  // Recuperar / cambiar contraseña con confirmación por correo: el enlace del correo abre una sesión de recuperación
  // y la app pide la nueva contraseña (RestablecerClave). Nunca revela si el correo existe.
  const solicitarRecuperacion = useCallback(async (email) => {
    const { error: e } = await supabase.auth.resetPasswordForEmail(String(email || '').trim(), { redirectTo: window.location.origin });
    if (e && /rate|limit|seconds|many/i.test(e.message || '')) throw new Error('Ya se envió un enlace hace poco. Espera unos minutos antes de pedir otro.');
    // cualquier otro resultado se trata igual (existe o no): así no se puede averiguar qué correos están registrados
  }, []);
  const cambiarClave = useCallback(async (nueva) => {
    const { error: e } = await supabase.auth.updateUser({ password: nueva });
    if (e) throw new Error(/same|different/i.test(e.message || '') ? 'La nueva contraseña debe ser distinta de la anterior.' : /weak|short|least/i.test(e.message || '') ? 'La contraseña no cumple los requisitos de seguridad.' : (e.message || 'No se pudo cambiar la contraseña.'));
    try { await supabase.auth.signOut({ scope: 'others' }); } catch { /* cerrar las demás sesiones es un refuerzo; no impide el cambio */ }
  }, []);
  const terminarRecuperacion = useCallback(() => {
    setRecuperando(false);
    try { window.history.replaceState(null, '', window.location.pathname); } catch { /* sin history */ }
  }, []);
  // scope 'local': cerrar sesión aquí NO invalida las sesiones de la misma cuenta abiertas en otras pestañas o dispositivos
  const monitorTic = useRef(null);
  const limpiezaLocal = async (motivo) => {
    try { await monitorTic.current?.cerrar(motivo); } catch { /* no bloquea el cierre */ }
    try { borrarTodosLosBorradores(); limpiarCacheConsultas(); } catch { /* es solo limpieza */ }   // equipo compartido: no deja notas ni datos del usuario anterior
  };
  const logout = useCallback(async () => {
    // Hub de Colegio Lumen: si el Super Admin está probando un usuario demo, al cerrar sesión vuelve al Hub (no al login).
    const volverAlHub = decidirLogout({ hub: leerHub(), rolDb: profile?.rolDb, institucionId: profile?.institucion_id }) === 'volver_hub';
    await limpiezaLocal('logout');
    await supabase.auth.signOut({ scope: 'local' });
    if (volverAlHub) {
      // El flag NO se borra: lo usa el Hub. Se recupera la sesión del Admin Global guardada al entrar al usuario demo.
      let recuperada = false;
      try {
        const adm = JSON.parse(sessionStorage.getItem(HUB_ADMIN_KEY) || 'null');
        if (adm?.access_token && adm?.refresh_token) { const { error: eSes } = await supabase.auth.setSession({ access_token: adm.access_token, refresh_token: adm.refresh_token }); recuperada = !eSes; if (eSes) console.warn('[Hub] no se pudo recuperar la sesión del Admin Global:', eSes.message); }
        else console.warn('[Hub] no hay sesión del Admin Global guardada');
      } catch (eRec) { console.warn('[Hub] error al recuperar la sesión del Admin Global:', eRec?.message || eRec); }   // si no se puede recuperar, login normal
      if (recuperada) { window.location.href = HUB_RUTA; return; }
      limpiarHub();
    }
  }, [profile]);
  // Hub: entra a una cuenta demo de Colegio Lumen. El servidor (solo Super Admin) entrega un acceso de un solo uso; no hay contraseñas en la web.
  const entrarComoDemo = useCallback(async (rolHub) => {
    const { data: ses } = await supabase.auth.getSession();
    const s = ses?.session;
    if (!s || profile?.rolDb !== 'super_admin') throw new Error('Solo el Admin Global puede entrar desde el Hub.');
    let r; let body = {};
    try {
      r = await fetch(`${API_URL}/hub/entrar`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.access_token}` }, body: JSON.stringify({ rol: rolHub }) });
      body = await r.json().catch(() => ({}));
    } catch { throw new Error('No hay conexión con el servidor.'); }
    if (!r.ok || !body.token_hash) throw new Error(body.error || 'No se pudo abrir la cuenta demo.');
    // Se guarda la sesión del Admin Global (solo en esta pestaña) para volver al Hub sin pasar por el login.
    sessionStorage.setItem(HUB_ADMIN_KEY, JSON.stringify({ access_token: s.access_token, refresh_token: s.refresh_token }));
    sessionStorage.setItem(HUB_KEY, JSON.stringify({ active: true, institutionId: LUMEN_ID, adminEmail: profile.email }));
    await limpiezaLocal('cambio_sesion');
    const { error: eOtp } = await supabase.auth.verifyOtp({ token_hash: body.token_hash, type: 'magiclink' });
    if (eOtp) { limpiarHub(); throw new Error('No se pudo iniciar la sesión demo: ' + eOtp.message); }
    window.location.assign('/');   // recarga limpia con la sesión del usuario demo
  }, [profile]);
  // Hub: cierre completo (borra el rastro del Hub, cierra sesión y va al login).
  const cerrarSesionCompleta = useCallback(async () => {
    limpiarHub();
    await limpiezaLocal('logout');
    await supabase.auth.signOut({ scope: 'local' });
    window.location.href = '/';
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
    if (profile?.rolDb === 'super_admin') {
      setData(await fetchDatosGlobales(instituciones).catch(e => ({ docentes: [], estudiantes: [], usuarios: [], administrativos: [], tareas: [], errorCarga: e?.message || 'No se pudieron cargar los datos de los planteles.' })));
    }
  }, [profile, instituciones]);
  return (
    <SessionCtx.Provider value={{ loading, profile, demo, entrarComoDemo, cerrarSesionCompleta, instituciones, institucion, data, error, login, logout, recuperando, solicitarRecuperacion, cambiarClave, terminarRecuperacion, refrescarDatos, permisos, esTutor, recargarPermisos: () => cargarPermisos(profile, profile?.institucion_id) }}>
      {children}
    </SessionCtx.Provider>
  );
}
