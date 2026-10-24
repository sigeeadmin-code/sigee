import React from 'react';

// Red de seguridad: si una pantalla falla al dibujarse, en vez de dejar TODA la aplicación en blanco se muestra este aviso
// y el usuario puede reintentar sin perder la sesión. Se reinicia solo al cambiar de pantalla (prop `reinicio`).
export default class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    // Mejor esfuerzo: deja constancia en la consola del navegador para poder diagnosticar.
    try { console.error('[SIGEE] Error de pantalla:', error, info?.componentStack); } catch { /* sin consola */ }
  }
  componentDidUpdate(prev) {
    if (this.state.error && prev.reinicio !== this.props.reinicio) this.setState({ error: null });
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="empty" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <span className="ti ti-alert-triangle" style={{ fontSize: 32 }} />
        <h3 style={{ margin: '12px 0 6px' }}>Esta pantalla tuvo un problema</h3>
        <p style={{ color: 'var(--slate)', marginBottom: 16 }}>Tu sesión sigue abierta y tus datos guardados están a salvo. Puedes reintentar o volver al inicio.</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => this.setState({ error: null })}>Reintentar</button>
          <button className="btn" onClick={() => window.location.assign('/')}>Ir al inicio</button>
        </div>
      </div>
    );
  }
}
