import React, { useEffect, useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { fetchContenidoFrontend, guardarContenidoFrontend } from '../lib/data.js';
import PortadaLogin from '../components/PortadaLogin.jsx';
import { CONTENIDO_DEFAULTS, CONTENIDO_CAMPOS, mezclarContenido, cambiosContenido, portadaActiva } from '../lib/contenidoBase.js';

// Módulo exclusivo del Super Admin para cambiar los textos del frontend.
// Hoy cubre la portada del login; se amplía agregando claves en contenidoBase.js.
export default function ContenidoSitio() {
  const { profile } = useSession();
  const [guardado, setGuardado] = useState(CONTENIDO_DEFAULTS);   // lo que hay en la base
  const [form, setForm] = useState(CONTENIDO_DEFAULTS);           // lo que se está editando
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let vivo = true;
    fetchContenidoFrontend().then(filas => {
      if (!vivo) return;
      const m = mezclarContenido(filas);
      setGuardado(m); setForm(m); setCargando(false);
    });
    return () => { vivo = false; };
  }, []);

  if (profile.rolDb !== 'super_admin') {
    return <div className="empty" style={{ padding: '60px 20px' }}><span className="ti ti-lock" style={{ fontSize: 32 }} /><h3>Solo el Super Admin puede editar el contenido del sitio</h3></div>;
  }

  const cambios = cambiosContenido(guardado, form);
  const set = (clave, valor) => { setForm(f => ({ ...f, [clave]: valor })); setMsg(''); };

  async function guardar() {
    setGuardando(true); setMsg('');
    try {
      await guardarContenidoFrontend(cambios, profile.id);
      const m = mezclarContenido(await fetchContenidoFrontend());
      setGuardado(m); setForm(m);
      setMsg('Cambios guardados. La pantalla de inicio de sesión ya muestra los textos nuevos.');
    } catch (e) {
      setMsg('No se pudo guardar: ' + (e.message || 'error desconocido'));
    }
    setGuardando(false);
  }

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}><span className="ti ti-edit" /> Contenido del sitio</h2>
        <p style={{ color: 'var(--slate)', margin: '4px 0 0', fontSize: 13 }}>
          Cambia los textos de la pantalla de inicio de sesión. Lo que dejes vacío no se muestra; los demás cambios se ven al guardar.
        </p>
      </div>

      {cargando ? <div className="card cb">Cargando…</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 420px) 1fr', gap: 16, alignItems: 'start' }}>
          <div className="card">
            <div className="ch"><h3>Portada del inicio de sesión</h3></div>
            <div className="cb">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 14 }}>
                <input type="checkbox" checked={portadaActiva(form)} onChange={e => set('login.hero.activo', e.target.checked ? 'true' : 'false')} />
                Mostrar esta portada (si la apagas se usa la portada anterior)
              </label>
              {CONTENIDO_CAMPOS.map(c => (
                <div key={c.clave} style={{ marginBottom: 10 }}>
                  <label className="fl">{c.etiqueta}</label>
                  {c.largo
                    ? <textarea className="fc" rows={3} maxLength={400} value={form[c.clave]} onChange={e => set(c.clave, e.target.value)} />
                    : <input className="fc" maxLength={400} value={form[c.clave]} onChange={e => set(c.clave, e.target.value)} />}
                </div>
              ))}
              {msg && <div className="card" style={{ padding: '10px 12px', fontSize: 12.5, margin: '10px 0' }}>{msg}</div>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" disabled={!cambios.length || guardando} onClick={guardar}>
                  {guardando ? 'Guardando…' : cambios.length ? `Guardar ${cambios.length} cambio${cambios.length === 1 ? '' : 's'}` : 'Sin cambios'}
                </button>
                <button className="btn btn-secondary" onClick={() => { setForm(CONTENIDO_DEFAULTS); setMsg('Textos originales cargados; presiona Guardar para aplicarlos.'); }}>Restaurar textos originales</button>
                <button className="btn btn-ghost" disabled={!cambios.length} onClick={() => setForm(guardado)}>Descartar</button>
              </div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate)', textTransform: 'uppercase', marginBottom: 8 }}>Vista previa</div>
            <PortadaLogin c={form} vistaPrevia />
          </div>
        </div>
      )}
    </div>
  );
}
