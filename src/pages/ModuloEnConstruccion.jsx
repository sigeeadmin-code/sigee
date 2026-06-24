export default function ModuloEnConstruccion({ titulo, icono, descripcion }) {
  return (
    <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, padding: 40, textAlign: 'center' }}>
      <i className={`ti ${icono}`} style={{ fontSize: 44, color: '#D1D5DB', display: 'block', marginBottom: 14 }} />
      <div style={{ fontSize: 16, fontWeight: 600, color: '#1A2B4A', marginBottom: 8 }}>{titulo}</div>
      <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 20, maxWidth: 420, margin: '0 auto 20px', lineHeight: 1.6 }}>{descripcion}</div>
      <div style={{ background: 'rgba(15,43,91,.05)', border: '0.5px solid rgba(15,43,91,.15)', borderRadius: 8, padding: '10px 18px', fontSize: 12, color: '#0F2B5B', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
        <i className="ti ti-database" style={{ fontSize: 14 }} />
        Conectado a Supabase — listo para recibir datos
      </div>
    </div>
  )
}
