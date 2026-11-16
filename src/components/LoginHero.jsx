import React from 'react';
import { Link } from 'react-router-dom';

// Puntos de la portada que llevan a una página pública (se reconocen por su texto, que es editable).
const ENLACES = [
  { test: /asistencia\s+y\s+reportes/i, to: '/asistencia-y-reportes' },
  { test: /portal\s+de\s+acceso\s+al\s+estudiante/i, to: '/portal-estudiante' },
  { test: /generaci[oó]n\s+de\s+horarios/i, to: '/generacion-de-horarios' },
  { test: /calificaciones\s+y\s+cartilla/i, to: '/calificaciones-y-cartilla' }
];
const enlaceDe = (texto) => ENLACES.find(e => e.test.test(texto));

// Convierte un celular ecuatoriano escrito como 09XXXXXXXX en enlace a WhatsApp.
function linkificarTelefonos(texto) {
  return String(texto).split(/(\b09\d{8}\b)/g).map((p, i) =>
    /^09\d{8}$/.test(p)
      ? <a key={i} href={`https://wa.me/593${p.slice(1)}`} target="_blank" rel="noreferrer">{p}</a>
      : p);
}

// Hoja de asistencia de ejemplo (datos ficticios). Es decorativa: el significado va en el texto de al lado.
const DIAS = ['L', 'M', 'X', 'J', 'V'];
const FILAS = [
  { n: 'Andrade Mora, Camila', m: ['P', 'P', 'P', 'T', 'P'] },
  { n: 'Bravo Ríos, Mateo', m: ['P', 'A', 'J', 'P', 'P'] },
  { n: 'Cevallos Pico, Valeria', m: ['P', 'P', 'P', 'P', 'P'] },
  { n: 'Delgado Sáenz, Joel', m: ['A', 'A', 'J', 'J', 'P'] },
  { n: 'Espinoza León, Daniela', m: ['P', 'P', 'T', 'P', 'P'] }
];
const NOMBRE_MARCA = { P: 'Presente', A: 'Ausente', J: 'Justificado', T: 'Atraso' };

function HojaAsistencia() {
  return (
    <figure className="lg-hoja" aria-hidden="true">
      <figcaption className="lg-hoja-cab">
        <strong>Asistencia · 2.º BGU «A»</strong>
        <span>Matemática · semana del lunes</span>
      </figcaption>
      <table>
        <thead>
          <tr><th scope="col">Estudiante</th>{DIAS.map(d => <th key={d} scope="col">{d}</th>)}</tr>
        </thead>
        <tbody>
          {FILAS.map(f => (
            <tr key={f.n}>
              <th scope="row">{f.n}</th>
              {f.m.map((x, i) => <td key={i}><span className={'lg-m lg-m-' + x} title={NOMBRE_MARCA[x]}>{x}</span></td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="lg-hoja-pie">
        <span><i className="lg-m lg-m-P">P</i> Presente</span>
        <span><i className="lg-m lg-m-T">T</i> Atraso</span>
        <span><i className="lg-m lg-m-J">J</i> Justificado</span>
        <span><i className="lg-m lg-m-A">A</i> Ausente</span>
      </div>
    </figure>
  );
}

// `c` = textos del módulo «Contenido del sitio» (ya mezclados con los originales).
export default function LoginHero({ c }) {
  const titulo = [c['login.hero.titulo_antes'], c['login.hero.titulo_resaltado'], c['login.hero.titulo_despues']]
    .filter(t => t && t.trim()).join(' ');
  const puntos = [1, 2, 3, 4, 5, 6].map(n => c[`login.hero.chip${n}`]).filter(t => t && t.trim());
  return (
    <section className="lg-hero" aria-label="Presentación de SIGEE">
      <div className="lg-marca">
        <span className="lg-logo" aria-hidden="true">S</span>
        <div>
          <div className="lg-marca-n">{c['login.hero.marca']}</div>
          <div className="lg-marca-s">{c['login.hero.marca_sub']}</div>
        </div>
      </div>
      <div className="lg-hero-cuerpo">
        {c['login.hero.badge'] && <p className="lg-nota">{c['login.hero.badge']}</p>}
        <h1 className="lg-h1">{titulo}</h1>
        {c['login.hero.descripcion'] && <p className="lg-desc">{linkificarTelefonos(c['login.hero.descripcion'])}</p>}
        {puntos.length > 0 && <ul className="lg-puntos">{puntos.map(p => {
          const en = enlaceDe(p);
          return en
            ? <li key={p} className="lg-es-link"><Link to={en.to}>{p}</Link></li>
            : <li key={p}>{p}</li>;
        })}</ul>}
      </div>
      <HojaAsistencia />
    </section>
  );
}
