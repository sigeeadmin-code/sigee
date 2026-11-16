import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../lib/SessionContext.jsx';
import '../asistencia-reportes.css';

// Página pública con capturas reales de una institución de ejemplo (datos ficticios). No necesita sesión.
// cfg = { titulo, nota, h1, lede, pantallas[], familia: {titulo, texto} | null, cierre: {titulo, texto} }
export default function PaginaPublica({ cfg }) {
  const { titulo, nota, h1, lede, pantallas: PANTALLAS, familia, cierre } = cfg;
  const { profile } = useSession();
  useEffect(() => {
    const previo = document.title;
    document.title = titulo;
    window.scrollTo(0, 0);
    return () => { document.title = previo; };
  }, [titulo]);

  return (
    <div className="ar">
      <a className="ar-salto" href="#contenido">Saltar al contenido</a>
      <header className="ar-barra">
        <Link to="/" className="ar-marca" aria-label="SIGEE, ir al inicio">
          <span className="ar-logo" aria-hidden="true">S</span><span>SIGEE</span>
        </Link>
        <nav className="ar-acciones" aria-label="Acciones">
          <Link to="/" className="ar-enlace">{profile ? 'Ir al sistema' : 'Iniciar sesión'}</Link>
          {!profile && <Link to="/?demo=1" className="ar-btn">Solicitar demo</Link>}
        </nav>
      </header>

      <main id="contenido">
        <section className="ar-hero">
          <div className="ar-hero-int">
            <p className="ar-nota">{nota}</p>
            <h1>{h1}</h1>
            <p className="ar-lede">{lede}</p>
            <nav className="ar-indice" aria-label="Pantallas del módulo">
              {PANTALLAS.map(p => <a key={p.id} href={`#${p.id}`}><span>{p.n}</span>{p.corto}</a>)}
            </nav>
          </div>
        </section>

        {PANTALLAS.map((p, i) => (
          <section key={p.id} id={p.id} className={'ar-bloque' + (i % 2 ? ' ar-alt' : '')} aria-labelledby={`${p.id}-t`}>
            <div className="ar-bloque-int">
              <div className="ar-texto">
                <p className="ar-num"><span>{p.n}</span> · {p.quien}</p>
                <h2 id={`${p.id}-t`}>{p.titulo}</h2>
                <p>{p.texto}</p>
                <ul>{p.puntos.map(t => <li key={t}>{t}</li>)}</ul>
              </div>
              <figure className="ar-fig">
                <div className="ar-marco">
                  <div className="ar-marco-barra">{p.barra}</div>
                  <a href={p.img} target="_blank" rel="noreferrer" aria-label={`Abrir la captura «${p.barra}» en tamaño completo`}>
                    <img src={p.img} width={p.w} height={p.h} alt={p.alt} loading={i === 0 ? 'eager' : 'lazy'} decoding="async" />
                  </a>
                </div>
                <figcaption>Captura de una institución de ejemplo con datos ficticios.</figcaption>
              </figure>
            </div>
          </section>
        ))}

        {familia && (
          <section className="ar-familia" aria-labelledby="fam-t">
            <div className="ar-bloque-int ar-familia-int">
              <h2 id="fam-t">{familia.titulo}</h2>
              <p>{familia.texto}</p>
            </div>
          </section>
        )}

        <section className="ar-cierre" aria-labelledby="cierre-t">
          <div className="ar-cierre-int">
            <h2 id="cierre-t">{cierre.titulo}</h2>
            <p>{cierre.texto}</p>
            <div className="ar-cierre-btns">
              <Link to="/?demo=1" className="ar-btn ar-btn-ambar">Solicitar demo de 5 días</Link>
              <Link to="/" className="ar-enlace ar-enlace-claro">{profile ? 'Ir al sistema' : 'Volver a iniciar sesión'}</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="ar-pie">SIGEE · Sistema de gestión educativa</footer>
    </div>
  );
}
