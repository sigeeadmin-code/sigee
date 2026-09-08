import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useSession } from '../lib/SessionContext.jsx';
import { NAV_BY_ROL } from '../lib/nav.js';
import { ROLE_LABELS } from '../lib/supabase.js';
export default function Shell() {
  const { profile, institucion, logout } = useSession();
  const categorias = NAV_BY_ROL[profile.rol] || NAV_BY_ROL.docente;
  const initials = ((profile.nombres?.[0] || '') + (profile.apellidos?.[0] || '')).toUpperCase() || 'U';
  const isGlobal = profile.rol === 'super_admin';
  return (
    <div id="app" style={{ display: 'block' }}>
      <aside className="sidebar">
        <div className="sblogo">
          <div className="lico"><span className="ti ti-school" /></div>
          <div>
            <div className="ltx">{institucion ? institucion.nombre : 'SIGEE'}</div>
            <div className="lsub">{institucion ? 'Portal ' + (ROLE_LABELS[profile.rol] || profile.rol) : 'Zona 7 · El Oro'}</div>
          </div>
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
                  {item.wip && <span className="nbadge">pronto</span>}
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
          <div>
            <div className="topbar-title">{institucion ? institucion.nombre : 'SIGEE'}</div>
          </div>
          <div className="ava" style={{ width: 32, height: 32 }}>{initials}</div>
        </header>
        <div className="content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
