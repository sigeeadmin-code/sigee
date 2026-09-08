import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from '../lib/SessionContext.jsx';

const DEMO_ROLES = [
  { key: 'super_admin', title: 'Super Admin', desc: 'Todos los planteles · Global', bg: '#f59e0b', fg: '#1e1305', email: 'sigee.admin@gmail.com' },
  { key: 'admin_plantel', title: 'Admin Plantel', desc: 'Gestión de su institución', bg: '#2563eb', fg: '#fff', email: 'demo.adminplantel@sigee.test' },
  { key: 'supervisor_plantel', title: 'Supervisor Plantel', desc: 'Supervisión académica del plantel', bg: '#0891b2', fg: '#fff', email: 'demo.supervisorplantel@sigee.test' },
  { key: 'contador_plantel', title: 'Contador Plantel', desc: 'Finanzas del plantel', bg: '#b45309', fg: '#fff', email: 'demo.contadorplantel@sigee.test' },
  { key: 'inspector', title: 'Inspector General', desc: 'Asistencia · WhatsApp · Disciplina', bg: '#4338ca', fg: '#fff', email: 'demo.inspector@sigee.test' },
  { key: 'docente', title: 'Docente', desc: 'Asistencia · Notas · Tareas', bg: '#059669', fg: '#fff', email: 'demo.docente@sigee.test' },
  { key: 'alumno', title: 'Alumno', desc: 'Notas · Horario · Tareas', bg: '#0d9488', fg: '#fff', email: 'demo.estudiante@sigee.test' },
  { key: 'padre', title: 'Padre / Madre', desc: 'Seguimiento del representado', bg: '#7c3aed', fg: '#fff', email: 'demo.padre@sigee.test' }
];
const DEMO_PASSWORD = 'Sigee2026Demo!';

const INTENTOS_KEY = 'sigee_login_intentos';
const MAX_INTENTOS = 5;
const BLOQUEO_BASE_MS = 30_000;

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

export default function Login() {
  const { login, error } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bloqueadoHasta, setBloqueadoHasta] = useState(() => leerEstadoIntentos().bloqueadoHasta || 0);
  const [segundosRestantes, setSegundosRestantes] = useState(0);

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
      const bloqueadoHastaNuevo = Date.now() + duracion;
      guardarEstadoIntentos({ fallos: 0, bloqueos, bloqueadoHasta: bloqueadoHastaNuevo });
      setBloqueadoHasta(bloqueadoHastaNuevo);
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
    try {
      await login(email, password);
      registrarExito();
    } catch {
      registrarFallo();
    }
    setBusy(false);
  }

  function usarDemo(rol) {
    setEmail(rol.email);
    setPassword(DEMO_PASSWORD);
  }

  return (
    <div id="login">
      <div className="l-left">
        <div className="ll-body">
          <span className="ll-badge"><span className="ti ti-map-pin" /> Zona 7 · El Oro · Ecuador</span>
          <div className="ll-logo">S</div>
          <div className="ll-title">SIGEE</div>
          <div className="ll-sub">Sistema de Gestión Educativa Pro Max<br />Multi-tenant · Fiscales &amp; Particulares</div>
          <div className="ll-divider" />
          <div className="ll-features">
            <div className="ll-feat">
              <div className="ll-feat-ico">🏫</div>
              <div className="ll-feat-txt"><strong>Multi-plantel</strong>Admin global + dashboards por institución</div>
            </div>
            <div className="ll-feat">
              <div className="ll-feat-ico">📊</div>
              <div className="ll-feat-txt"><strong>Calificaciones &amp; Asistencia</strong>Art. 26 R-LOEI · Reportes MINEDUC</div>
            </div>
            <div className="ll-feat">
              <div className="ll-feat-ico">💰</div>
              <div className="ll-feat-txt"><strong>Finanzas (solo particulares)</strong>Cuotas, becas, caja y contabilidad</div>
            </div>
            <div className="ll-feat">
              <div className="ll-feat-ico">🎨</div>
              <div className="ll-feat-txt"><strong>Branding por plantel</strong>Logo, eslogan y AMIE editables</div>
            </div>
          </div>
        </div>
      </div>

      <div className="l-right">
        <form onSubmit={onSubmit} className="lcard">
          <div className="lbrand">
            <div className="ltitle">Bienvenido de vuelta</div>
            <div className="lsub">Ingrese con sus credenciales institucionales</div>
          </div>

          {error && !segundosRestantes && <div className="lerr" style={{ display: 'flex' }}>{error}</div>}
          {segundosRestantes > 0 && (
            <div className="lerr" style={{ display: 'flex' }}>
              <span className="ti ti-lock" /> Demasiados intentos fallidos. Espera {segundosRestantes}s para volver a intentar.
            </div>
          )}

          <div className="lfield">
            <label>Correo electrónico</label>
            <input type="email" placeholder="usuario@colegio.edu.ec" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="lfield lpass-wrap">
            <label>Contraseña</label>
            <input id="login-pass" type={showPass ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
            <button type="button" className="lpass-toggle" onClick={() => setShowPass(s => !s)} aria-label="Mostrar contraseña">
              <span className={showPass ? 'ti ti-eye-off' : 'ti ti-eye'} />
            </button>
          </div>

          <button className="lbtn" type="submit" disabled={busy || segundosRestantes > 0}>
            {segundosRestantes > 0
              ? `Bloqueado (${segundosRestantes}s)`
              : busy ? 'Ingresando…' : <>Ingresar al sistema <span className="ti ti-arrow-right" /></>}
          </button>

          <div className="l-or">Acceso rápido de demostración</div>
          <div className="demo-grid">
            {DEMO_ROLES.map(r => (
              <button
                type="button"
                key={r.key}
                className="demo-card"
                style={{ background: r.bg, color: r.fg, opacity: segundosRestantes > 0 ? 0.5 : 1, cursor: segundosRestantes > 0 ? 'not-allowed' : 'pointer' }}
                onClick={() => segundosRestantes === 0 && usarDemo(r)}
                disabled={segundosRestantes > 0}
              >
                <div className="dc-title">{r.title}</div>
                <div className="dc-desc">{r.desc}</div>
              </button>
            ))}
          </div>
          <div style={{ textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,.25)', marginTop: 14 }}>
            Cuentas de demostración reales · un clic te deja listo para ingresar
          </div>
        </form>
      </div>
    </div>
  );
}
