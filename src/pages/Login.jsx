import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import LoginHero from '../components/LoginHero.jsx';
import { fetchContenidoFrontend, API_URL } from '../lib/data.js';
import { CONTENIDO_DEFAULTS, mezclarContenido } from '../lib/contenidoBase.js';
import { CARGOS_DEMO, validarSolicitudDemo, solicitarDemo } from '../lib/demoApi.js';
import '../login-nuevo.css';

const INTENTOS_KEY = 'sigee_login_intentos';
const MAX_INTENTOS = 5;
const BLOQUEO_BASE_MS = 30_000;
const WHATSAPP_ADMIN = (import.meta.env.VITE_WHATSAPP_ADMIN || '').replace(/\D/g, '');

function leerEstadoIntentos() {
  try {
    const raw = localStorage.getItem(INTENTOS_KEY);
    if (!raw) return { fallos: 0, bloqueos: 0, bloqueadoHasta: 0 };
    return JSON.parse(raw);
  } catch {
    return { fallos: 0, bloqueos: 0, bloqueadoHasta: 0 };
  }
}
function guardarEstadoIntentos(estado) {
  try { localStorage.setItem(INTENTOS_KEY, JSON.stringify(estado)); } catch { /* ignore */ }
}

const DEMO_VACIO = { nombre: '', cedula: '', email: '', institucion: '', cargo: '', telefono: '', acepta: false, sitio_web: '' };

export default function Login() {
  const { login, error, solicitarRecuperacion } = useSession();
  const [modo, setModo] = useState('entrar');                       // 'entrar' | 'recuperar' | 'demo'
  const [envio, setEnvio] = useState({ estado: 'inicio', msg: '', hasta: 0 });
  const [ahora, setAhora] = useState(Date.now());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bloqueadoHasta, setBloqueadoHasta] = useState(() => leerEstadoIntentos().bloqueadoHasta || 0);
  const [segundosRestantes, setSegundosRestantes] = useState(0);
  const [contenido, setContenido] = useState(CONTENIDO_DEFAULTS);

  // Solicitud de demo
  const [d, setD] = useState(DEMO_VACIO);
  const [errs, setErrs] = useState({});
  const [demoEstado, setDemoEstado] = useState({ fase: 'form', msg: '' });   // form | enviando | listo
  const formDemoRef = useRef(null);
  const simulado = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('simulado') === '1';

  useEffect(() => { if (envio.estado !== 'enviado') return undefined; const t = setInterval(() => setAhora(Date.now()), 1000); return () => clearInterval(t); }, [envio.estado]);
  const esperaReenvio = Math.max(0, Math.ceil((envio.hasta - ahora) / 1000));

  useEffect(() => {
    let vivo = true;
    fetchContenidoFrontend().then(filas => { if (vivo) setContenido(mezclarContenido(filas)); }).catch(() => {});
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    if (!bloqueadoHasta) { setSegundosRestantes(0); return; }
    const tick = () => {
      const restante = Math.ceil((bloqueadoHasta - Date.now()) / 1000);
      setSegundosRestantes(restante > 0 ? restante : 0);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [bloqueadoHasta]);

  const registrarFallo = useCallback(() => {
    const estado = leerEstadoIntentos();
    const fallos = estado.fallos + 1;
    if (fallos >= MAX_INTENTOS) {
      const bloqueos = estado.bloqueos + 1;
      const duracion = BLOQUEO_BASE_MS * Math.pow(2, estado.bloqueos);
      const nuevo = Date.now() + duracion;
      guardarEstadoIntentos({ fallos: 0, bloqueos, bloqueadoHasta: nuevo });
      setBloqueadoHasta(nuevo);
    } else {
      guardarEstadoIntentos({ ...estado, fallos });
    }
  }, []);

  const registrarExito = useCallback(() => {
    guardarEstadoIntentos({ fallos: 0, bloqueos: 0, bloqueadoHasta: 0 });
    setBloqueadoHasta(0);
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    if (segundosRestantes > 0) return;
    setBusy(true);
    try { await login(email, password); registrarExito(); } catch { registrarFallo(); }
    setBusy(false);
  }

  async function pedirEnlace(e) {
    e.preventDefault();
    if (!email.trim() || envio.estado === 'enviando' || esperaReenvio > 0) return;
    setEnvio({ estado: 'enviando', msg: '', hasta: 0 });
    try { await solicitarRecuperacion(email); setAhora(Date.now()); setEnvio({ estado: 'enviado', msg: '', hasta: Date.now() + 60000 }); }
    catch (err) { setEnvio({ estado: 'error', msg: err.message, hasta: 0 }); }
  }

  function cambiar(campo, valor) {
    setD(prev => ({ ...prev, [campo]: valor }));
    if (errs[campo]) setErrs(prev => { const n = { ...prev }; delete n[campo]; return n; });
  }

  async function enviarDemo(e) {
    e.preventDefault();
    if (demoEstado.fase === 'enviando') return;
    const problemas = validarSolicitudDemo(d);
    setErrs(problemas);
    const primero = Object.keys(problemas)[0];
    if (primero) {
      const el = formDemoRef.current?.querySelector(`[name="${primero}"]`);
      if (el) el.focus();
      return;
    }
    setDemoEstado({ fase: 'enviando', msg: '' });
    const r = await solicitarDemo(d, { apiUrl: API_URL, simulado });
    if (r.ok) setDemoEstado({ fase: 'listo', msg: '' });
    else setDemoEstado({ fase: 'form', msg: r.mensaje });
  }

  function abrirModo(m) {
    setModo(m);
    setEnvio({ estado: 'inicio', msg: '', hasta: 0 });
    setErrs({});
    setDemoEstado({ fase: 'form', msg: '' });
    if (m === 'entrar') setD(DEMO_VACIO);
  }

  const bloqueado = segundosRestantes > 0;

  return (
    <div className="lg">
      <LoginHero c={contenido} />

      <main className="lg-panel">
        {modo === 'entrar' && (
          <form onSubmit={onSubmit} className="lg-tarjeta" noValidate={false}>
            <h2>Iniciar sesión</h2>
            <p className="lg-sub">Ingresa con las credenciales que te entregó tu institución.</p>

            {error && !bloqueado && <div className="lg-aviso lg-aviso-err" role="alert">{error}</div>}
            {bloqueado && (
              <div className="lg-aviso lg-aviso-err" role="alert">
                Demasiados intentos fallidos. Espera {segundosRestantes} s para volver a intentar.
              </div>
            )}

            <div className="lg-campo">
              <label htmlFor="lg-email">Correo electrónico</label>
              <input id="lg-email" type="email" autoComplete="username" placeholder="usuario@colegio.edu.ec"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="lg-campo lg-clave">
              <label htmlFor="lg-pass">Contraseña</label>
              <input id="lg-pass" type={showPass ? 'text' : 'password'} autoComplete="current-password"
                value={password} onChange={e => setPassword(e.target.value)} required />
              <button type="button" className="lg-ojo" onClick={() => setShowPass(s => !s)}
                aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPass}>
                <span className={showPass ? 'ti ti-eye-off' : 'ti ti-eye'} aria-hidden="true" />
              </button>
            </div>
            <div style={{ textAlign: 'right', margin: '-6px 0 16px' }}>
              <button type="button" className="lg-link" onClick={() => abrirModo('recuperar')}>¿Olvidaste tu contraseña?</button>
            </div>
            <button className="lg-btn" type="submit" disabled={busy || bloqueado}>
              {bloqueado ? `Bloqueado (${segundosRestantes} s)` : busy ? 'Ingresando…' : 'Ingresar al sistema'}
            </button>

            <div className="lg-sep">¿Tu institución aún no usa SIGEE?</div>
            <button type="button" className="lg-btn lg-btn-sec" onClick={() => abrirModo('demo')}>Solicitar demo de 5 días</button>
            <p className="lg-demo-nota">Recibirás un enlace de activación en tu correo. Los 5 días empiezan en tu primer ingreso.</p>
          </form>
        )}

        {modo === 'recuperar' && (
          <form onSubmit={pedirEnlace} className="lg-tarjeta">
            <h2>Recuperar contraseña</h2>
            <p className="lg-sub">Te enviaremos un enlace al correo para confirmar que eres tú y elegir una nueva contraseña.</p>
            {envio.estado === 'error' && <div className="lg-aviso lg-aviso-err" role="alert">{envio.msg}</div>}
            {envio.estado === 'enviado' && (
              <div className="lg-aviso lg-aviso-ok" role="status">
                Si el correo está registrado, recibirás un enlace en unos minutos. Revisa también la carpeta de spam. El enlace vence en 1 hora y solo funciona una vez.
              </div>
            )}
            <div className="lg-campo">
              <label htmlFor="lg-rec-email">Correo electrónico</label>
              <input id="lg-rec-email" type="email" autoComplete="email" placeholder="usuario@colegio.edu.ec"
                value={email} onChange={e => setEmail(e.target.value)} autoFocus required />
            </div>
            <button className="lg-btn" type="submit" disabled={envio.estado === 'enviando' || esperaReenvio > 0}>
              {envio.estado === 'enviando' ? 'Enviando…' : esperaReenvio > 0 ? `Reenviar en ${esperaReenvio} s` : envio.estado === 'enviado' ? 'Reenviar enlace' : 'Enviar enlace al correo'}
            </button>
            <button type="button" className="lg-link lg-volver" onClick={() => abrirModo('entrar')}>Volver a iniciar sesión</button>
          </form>
        )}

        {modo === 'demo' && demoEstado.fase !== 'listo' && (
          <form onSubmit={enviarDemo} className="lg-tarjeta" ref={formDemoRef} noValidate>
            <h2>Solicitar demo de 5 días</h2>
            <p className="lg-sub">Probarás SIGEE con una institución de ejemplo completa. Usaremos estos datos para enviarte el acceso y controlar el uso de la demostración.</p>

            {demoEstado.msg && <div className="lg-aviso lg-aviso-err" role="alert">{demoEstado.msg}</div>}

            <div className="lg-campo">
              <label htmlFor="dm-nombre">Nombres y apellidos</label>
              <input id="dm-nombre" name="nombre" autoComplete="name" value={d.nombre} onChange={e => cambiar('nombre', e.target.value)}
                aria-invalid={!!errs.nombre} aria-describedby={errs.nombre ? 'dm-nombre-e' : undefined} />
              {errs.nombre && <span id="dm-nombre-e" className="lg-err-campo">{errs.nombre}</span>}
            </div>
            <div className="lg-fila2">
              <div className="lg-campo">
                <label htmlFor="dm-cedula">Cédula</label>
                <input id="dm-cedula" name="cedula" inputMode="numeric" maxLength={10} autoComplete="off" value={d.cedula}
                  onChange={e => cambiar('cedula', e.target.value.replace(/\D/g, ''))}
                  aria-invalid={!!errs.cedula} aria-describedby={errs.cedula ? 'dm-cedula-e' : undefined} />
                {errs.cedula && <span id="dm-cedula-e" className="lg-err-campo">{errs.cedula}</span>}
              </div>
              <div className="lg-campo">
                <label htmlFor="dm-tel">WhatsApp <span style={{ fontWeight: 400, color: 'var(--suave)' }}>(opcional)</span></label>
                <input id="dm-tel" name="telefono" type="tel" inputMode="tel" autoComplete="tel" value={d.telefono}
                  onChange={e => cambiar('telefono', e.target.value)}
                  aria-invalid={!!errs.telefono} aria-describedby={errs.telefono ? 'dm-tel-e' : undefined} />
                {errs.telefono && <span id="dm-tel-e" className="lg-err-campo">{errs.telefono}</span>}
              </div>
            </div>
            <div className="lg-campo">
              <label htmlFor="dm-email">Correo electrónico</label>
              <input id="dm-email" name="email" type="email" autoComplete="email" value={d.email} onChange={e => cambiar('email', e.target.value)}
                aria-invalid={!!errs.email} aria-describedby={errs.email ? 'dm-email-e' : 'dm-email-a'} />
              {errs.email ? <span id="dm-email-e" className="lg-err-campo">{errs.email}</span>
                : <span id="dm-email-a" className="lg-ayuda">Este correo será el administrador de tu demo.</span>}
            </div>
            <div className="lg-campo">
              <label htmlFor="dm-inst">Institución</label>
              <input id="dm-inst" name="institucion" autoComplete="organization" value={d.institucion} onChange={e => cambiar('institucion', e.target.value)}
                aria-invalid={!!errs.institucion} aria-describedby={errs.institucion ? 'dm-inst-e' : undefined} />
              {errs.institucion && <span id="dm-inst-e" className="lg-err-campo">{errs.institucion}</span>}
            </div>
            <div className="lg-campo">
              <label htmlFor="dm-cargo">Cargo</label>
              <select id="dm-cargo" name="cargo" value={d.cargo} onChange={e => cambiar('cargo', e.target.value)}
                aria-invalid={!!errs.cargo} aria-describedby={errs.cargo ? 'dm-cargo-e' : undefined}>
                <option value="">Elige tu cargo</option>
                {CARGOS_DEMO.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {errs.cargo && <span id="dm-cargo-e" className="lg-err-campo">{errs.cargo}</span>}
            </div>

            {/* Trampa para bots: oculta a personas. El servidor descarta toda solicitud que la traiga llena. */}
            <div className="lg-trampa" aria-hidden="true">
              <label htmlFor="dm-web">No llenar este campo</label>
              <input id="dm-web" name="sitio_web" tabIndex={-1} autoComplete="off" value={d.sitio_web} onChange={e => cambiar('sitio_web', e.target.value)} />
            </div>

            <label className="lg-check">
              <input type="checkbox" name="acepta" checked={d.acepta} onChange={e => cambiar('acepta', e.target.checked)}
                aria-invalid={!!errs.acepta} aria-describedby={errs.acepta ? 'dm-acepta-e' : undefined} />
              <span>Acepto que SIGEE guarde mis datos y la dirección IP desde la que solicito la demo, para controlar el acceso.</span>
            </label>
            {errs.acepta && <span id="dm-acepta-e" className="lg-err-campo" style={{ marginTop: -10, marginBottom: 12 }}>{errs.acepta}</span>}

            <button className="lg-btn" type="submit" disabled={demoEstado.fase === 'enviando'}>
              {demoEstado.fase === 'enviando' ? 'Enviando solicitud…' : 'Solicitar demo de 5 días'}
            </button>
            <button type="button" className="lg-link lg-volver" onClick={() => abrirModo('entrar')}>Volver a iniciar sesión</button>
          </form>
        )}

        {modo === 'demo' && demoEstado.fase === 'listo' && (
          <div className="lg-tarjeta lg-exito" role="status">
            <h2>Revisa tu correo</h2>
            <p className="lg-sub" style={{ marginBottom: 0 }}>
              Enviamos un enlace de activación a <strong>{d.email.trim().toLowerCase()}</strong>.
            </p>
            <ol className="lg-pasos">
              <li>Abre el enlace en las próximas 24 horas.</li>
              <li>Recibirás las credenciales de tu institución de ejemplo.</li>
              <li>Tus 5 días empiezan en tu primer ingreso.</li>
            </ol>
            <p className="lg-sub">
              Si el enlace vence, comunícate con el administrador
              {WHATSAPP_ADMIN ? <> por <a className="lg-link" href={`https://wa.me/${WHATSAPP_ADMIN}`} target="_blank" rel="noreferrer">WhatsApp</a></> : ''}.
            </p>
            <button type="button" className="lg-btn lg-btn-sec" onClick={() => abrirModo('entrar')}>Volver a iniciar sesión</button>
          </div>
        )}
      </main>
    </div>
  );
}
