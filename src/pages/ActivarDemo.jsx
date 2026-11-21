import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../lib/data.js';
import '../asistencia-reportes.css';
import '../activar-demo.css';

// Página pública del link de activación. NO activa al abrirse (los visores de enlaces de WhatsApp o correo podrían gastarlo):
// la persona debe pulsar el botón.
export default function ActivarDemo() {
  const token = typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('token') || '') : '';
  const [fase, setFase] = useState(token ? 'listo' : 'invalido');   // listo | activando | ok | error | invalido
  const [error, setError] = useState('');
  const [res, setRes] = useState(null);
  const [copiado, setCopiado] = useState('');

  useEffect(() => { const previo = document.title; document.title = 'Activar demostración · SIGEE'; return () => { document.title = previo; }; }, []);

  async function activar() {
    setFase('activando'); setError('');
    try {
      const r = await fetch(`${API_URL}/demo/activar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
      const body = await r.json().catch(() => ({}));
      if (!r.ok || !body.ok) { setError(body.error || 'No pudimos activar la demostración. Inténtalo de nuevo.'); setFase('error'); return; }
      setRes(body); setFase('ok');
    } catch { setError('No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.'); setFase('error'); }
  }
  async function copiar(texto, id) {
    try { await navigator.clipboard.writeText(texto); setCopiado(id); setTimeout(() => setCopiado(''), 1800); } catch { /* sin portapapeles */ }
  }
  const todo = res ? `SIGEE · Demostración\nIngresa en: ${res.url}\n\n` + res.cuentas.map(c => `${c.rol}\nUsuario: ${c.email}\nContraseña: ${c.password}`).join('\n\n') : '';

  return (
    <div className="ar ad">
      <header className="ar-barra">
        <Link to="/" className="ar-marca" aria-label="SIGEE, ir al inicio"><span className="ar-logo" aria-hidden="true">S</span><span>SIGEE</span></Link>
      </header>
      <main className="ad-main">
        {(fase === 'listo' || fase === 'activando' || fase === 'error') && (
          <section className="ad-card" aria-labelledby="ad-t">
            <h1 id="ad-t">Activa tu demostración de SIGEE</h1>
            <p>Al activarla, crearemos una institución de ejemplo para ti, con cursos, docentes, estudiantes y horarios ficticios, y tus accesos para cada panel.</p>
            <ul className="ad-lista">
              <li>Recibirás 8 cuentas: administración, supervisión, contabilidad, inspección, DECE, docente, estudiante y familia.</li>
              <li>Tus 5 días empiezan cuando ingreses por primera vez.</li>
              <li>Las contraseñas se muestran una sola vez: guárdalas.</li>
            </ul>
            {fase === 'error' && <div className="ad-aviso ad-aviso-err" role="alert">{error}</div>}
            <button className="ar-btn ad-btn" onClick={activar} disabled={fase === 'activando'}>{fase === 'activando' ? 'Creando tu demostración… (puede tardar unos segundos)' : fase === 'error' ? 'Intentar de nuevo' : 'Activar mi demostración'}</button>
          </section>
        )}
        {fase === 'invalido' && (
          <section className="ad-card" aria-labelledby="ad-t">
            <h1 id="ad-t">Enlace no válido</h1>
            <p>Este enlace está incompleto. Pide a quien te lo envió que te lo comparta de nuevo, o comunícate con el administrador de SIGEE.</p>
            <Link to="/" className="ar-btn ad-btn">Ir al inicio</Link>
          </section>
        )}
        {fase === 'ok' && res && (
          <section className="ad-card ad-card-ancha" aria-labelledby="ad-t">
            <h1 id="ad-t">Tu demostración está lista</h1>
            <div className="ad-aviso ad-aviso-ok" role="status">Guarda estas credenciales ahora: por seguridad no se vuelven a mostrar. Tus {res.dias} días empiezan cuando ingreses por primera vez.</div>
            <div className="ad-tabla" role="table" aria-label="Credenciales de la demostración">
              {res.cuentas.map((c, i) => (
                <div className="ad-fila" role="row" key={c.email}>
                  <div className="ad-rol" role="cell"><strong>{c.rol}</strong>{i === 0 && <span className="ad-tag">Tu cuenta principal</span>}</div>
                  <div className="ad-dato" role="cell"><span>Usuario</span><code>{c.email}</code></div>
                  <div className="ad-dato" role="cell"><span>Contraseña</span><code>{c.password}</code></div>
                  <button className="ad-copiar" onClick={() => copiar(`Usuario: ${c.email}\nContraseña: ${c.password}`, c.email)} aria-label={`Copiar credenciales de ${c.rol}`}>{copiado === c.email ? 'Copiado' : 'Copiar'}</button>
                </div>
              ))}
            </div>
            <div className="ad-acciones">
              <button className="ar-btn" onClick={() => copiar(todo, 'todo')}>{copiado === 'todo' ? 'Copiado' : 'Copiar todas las credenciales'}</button>
              <a className="ar-btn ad-btn-sec" href={res.url || '/'}>Ir al sistema</a>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
