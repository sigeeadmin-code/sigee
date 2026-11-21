import React from 'react';
import { useSession } from '../lib/SessionContext.jsx';

export default function DemoVencida() {
  const { logout } = useSession();
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f4f7fb', padding: 24, fontFamily: "'Public Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 480, background: '#fff', border: '1px solid #c9d4e3', borderRadius: 12, padding: 32, textAlign: 'center' }}>
        <h1 style={{ margin: '0 0 10px', fontFamily: "'Newsreader', Georgia, serif", color: '#0f2a4a', fontSize: 30 }}>Tu demostración terminó</h1>
        <p style={{ margin: '0 0 22px', color: '#4a5b73', lineHeight: 1.55 }}>Gracias por probar SIGEE. Tus 5 días de prueba finalizaron. Si quieres continuar o contratar el sistema para tu institución, comunícate con el administrador de SIGEE.</p>
        <button className="btn btn-primary" onClick={logout}>Cerrar sesión</button>
      </div>
    </div>
  );
}
