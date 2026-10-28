import React, { useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../lib/SessionContext.jsx';
import { NAV_BY_ROL, itemVisibleParaRolDb } from '../lib/nav.js';
import { ROLE_LABELS, supabase } from '../lib/supabase.js';
import { crearAvisosEnVivo } from '../lib/avisosEnVivo.js';
import { fetchNoLeidasNotif } from '../lib/data.js';
import { grupoDeRol, esParaGrupo } from '../lib/notificaciones.js';
import ErrorBoundary from '../components/ErrorBoundary.jsx';
export default function Shell() {
  const { profile, institucion, logout, permisos, esTutor } = useSession();
  const MENU_MINIMO = [
    { cat: 'Principal', items: [{ to: '/', label: 'Dashboard', icon: 'ti ti-layout-dashboard' }] },
    { cat: 'Sistema', items: [{ to: '/configuracion', label: 'Configuración', icon: 'ti ti-settings' }] }
  ];
  // Ítems condicionales: 'Mis estudiantes' solo aparece al docente que es tutor de algún curso.
  const categorias = (NAV_BY_ROL[profile.rol] || MENU_MINIMO)
    .map(g => ({ ...g, items: g.items.filter(it => (it.requiere !== 'tutor' || esTutor) && itemVisibleParaRolDb(it, profile.rolDb)) }))
    .filter(g => g.items.length);
  const initials = ((profile.nombres?.[0] || '') + (profile.apellidos?.[0] || '')).toUpperCase() || 'U';
  const isGlobal = profile.rol === 'super_admin';
  const [navOpen, setNavOpen] = React.useState(false);
  const location = useLocation();

  // Avisos en vivo: notificaciones y justificaciones nuevas de este plantel aparecen solas (sin recargar). Es un extra opcional:
  // si falla o se apaga con VITE_REALTIME=off, SIGEE funciona igual. Las pantallas interesadas escuchan el evento 'sigee:avisos'.
  const [aviso, setAviso] = React.useState(null);
  const [noLeidas, setNoLeidas] = React.useState(0);
  const navigate = useNavigate();
  const grupoNotif = grupoDeRol(profile.rolDb);
  const rutaNotif = (categorias.flatMap(g => g.items).find(it => ['/notificaciones', '/anuncios', '/comunicados'].includes(it.to)) || {}).to;
  const institucionIdVivo = institucion?.id;
  // Contador de notificaciones sin leer en el menú: se actualiza al llegar un aviso, al leer y cada 3 minutos.
  useEffect(() => {
    if (!institucionIdVivo || !rutaNotif) { setNoLeidas(0); return undefined; }
    let vivo = true;
    const cargar = async () => { try { const n = await fetchNoLeidasNotif(institucionIdVivo); if (vivo) setNoLeidas(n); } catch { /* el contador es un extra */ } };
    cargar();
    window.addEventListener('sigee:avisos', cargar); window.addEventListener('sigee:notif-leidas', cargar);
    const id = setInterval(cargar, 180000);
    return () => { vivo = false; clearInterval(id); window.removeEventListener('sigee:avisos', cargar); window.removeEventListener('sigee:notif-leidas', cargar); };
  }, [institucionIdVivo, rutaNotif]);
  useEffect(() => {
    if (import.meta.env.VITE_REALTIME === 'off' || !institucionIdVivo || !profile?.id) return undefined;
    const vivo = crearAvisosEnVivo(supabase, {
      institucionId: institucionIdVivo, perfilId: profile.id,
      alAviso: a => {
        try { window.dispatchEvent(new CustomEvent('sigee:avisos', { detail: a })); } catch { /* sin efecto */ }
        // Las notificaciones solo avisan a quien van dirigidas (la dirección recibe todas por permisos, pero no todas son para ella)
        if (a.tabla === 'notificaciones' && a.registro && !esParaGrupo(a.registro.para_roles, grupoNotif)) return;
        if (a.texto) setAviso({ texto: a.texto, ruta: a.tabla === 'notificaciones' ? rutaNotif : null, urgente: !!(a.registro && a.registro.prioridad === 'urgente') });
      }
    });
    vivo.iniciar();
    return () => vivo.detener();
  }, [institucionIdVivo, profile?.id, grupoNotif, rutaNotif]);
  useEffect(() => { if (!aviso) return undefined; const t = setTimeout(() => setAviso(null), 6000); return () => clearTimeout(t); }, [aviso]);

  // Cierra el menú móvil automáticamente al navegar a otra pantalla.
  useEffect(() => { setNavOpen(false); }, [location.pathname]);

  return (
    <div id="app" style={{ display: 'block' }}>
      {navOpen && <div className="sidebar-backdrop" onClick={() => setNavOpen(false)} />}
      <aside className={'sidebar' + (navOpen ? ' open' : '')}>
        <div className="sblogo">
          <div className="lico"><span className="ti ti-school" /></div>
          <div>
            <div className="ltx">{institucion ? institucion.nombre : 'SIGEE'}</div>
            <div className="lsub">{institucion ? 'Portal ' + (ROLE_LABELS[profile.rol] || profile.rol) : 'Zona 7 · El Oro'}</div>
          </div>
          <button className="sidebar-close" onClick={() => setNavOpen(false)} aria-label="Cerrar menú">
            <span className="ti ti-x" />
          </button>
        </div>
        <div className="sbuser">
          <div className="ava">{initials}</div>
          <div>
            <div className="unm">{`${profile.nombres || ''} ${profile.apellidos || ''}`.trim() || profile.email}</div>
            <div className="url">{ROLE_LABELS[profile.rol] || profile.rol}</div>
          </div>
        </div>
        {isGlobal && (
          <div id="amieCtxBar">
            <span className="ctx-global-badge">Alcance global</span>
          </div>
        )}
        <nav className="sbnav">
          {categorias.map(group => (
            <React.Fragment key={group.cat}>
              <div className="ncat">{group.cat}</div>
              {group.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => 'ni' + (isActive ? ' on' : '')}
                >
                  <span className={'ico ' + item.icon} />
                  {item.label}
                  {['/notificaciones', '/anuncios', '/comunicados'].includes(item.to) && noLeidas > 0 && <span className="nav-count" aria-label={`${noLeidas} sin leer`}>{noLeidas > 99 ? '99+' : noLeidas}</span>}
                  {item.wip && <span className="nbadge">pronto</span>}
                  {item.modulo === 'base_docentes' && !permisos?.baseDocentes && <span className="nbadge" title="Lo activa el administrador global de SIGEE">desactivado</span>}
                </NavLink>
              ))}
            </React.Fragment>
          ))}
        </nav>
        <div className="sb-foot">
          <button className="btn-logout" onClick={logout}>
            <span className="ti ti-logout" /> Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="menu-btn" onClick={() => setNavOpen(true)} aria-label="Abrir menú">
              <span className="ti ti-menu-2" />
            </button>
            <div className="topbar-title">{institucion ? institucion.nombre : 'SIGEE'}</div>
          </div>
          <div className="ava" style={{ width: 32, height: 32 }}>{initials}</div>
        </header>
        <div className="content">
          <ErrorBoundary reinicio={location.pathname}><Outlet /></ErrorBoundary>
        </div>
      </main>
      {aviso && (
        <div role="status" onClick={() => { if (aviso.ruta) navigate(aviso.ruta); setAviso(null); }} style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 60, background: aviso.urgente ? '#b91c1c' : '#0f172a', color: '#fff', padding: '10px 14px', borderRadius: 10, fontSize: 13, maxWidth: 320, boxShadow: '0 6px 20px rgba(0,0,0,.25)', cursor: 'pointer' }}>
          <span className="ti ti-bell" style={{ marginRight: 8 }} />{aviso.texto}
        </div>
      )}
    </div>
  );
}
