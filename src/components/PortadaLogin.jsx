import React from 'react';

const ICONOS = ['📋', '📄', '📊', '📅', '🖨️', '🔒'];

// Portada del login (panel izquierdo). Los textos vienen del módulo
// "Contenido del sitio"; `c` es el objeto clave→texto ya mezclado con los originales.
export default function PortadaLogin({ c, vistaPrevia = false }) {
  return (
    <div className={'l-left hero' + (vistaPrevia ? ' hero-prev' : '')}>
      <div className="hero-brand">
        <div className="hero-logo">📊</div>
        <div>
          <div className="hero-marca">{c['login.hero.marca']}</div>
          <div className="hero-marca-sub">{c['login.hero.marca_sub']}</div>
        </div>
      </div>
      <div className="hero-body">
        {c['login.hero.badge'] && <span className="hero-badge"><i />{c['login.hero.badge']}</span>}
        <h1 className="hero-h1">
          {c['login.hero.titulo_antes']}{' '}
          <em>{c['login.hero.titulo_resaltado']}</em>{' '}
          {c['login.hero.titulo_despues']}
        </h1>
        {c['login.hero.descripcion'] && <p className="hero-desc">{c['login.hero.descripcion']}</p>}
        <div className="hero-chips">
          {[1, 2, 3, 4, 5, 6].map(n => {
            const t = c[`login.hero.chip${n}`];
            return t && t.trim() ? <span key={n} className="hero-chip"><span>{ICONOS[n - 1]}</span>{t}</span> : null;
          })}
        </div>
      </div>
    </div>
  );
}
