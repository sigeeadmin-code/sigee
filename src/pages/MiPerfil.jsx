import React, { useEffect, useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { fetchMiFichaDocente, actualizarMiPerfilDocente } from '../lib/data.js';

const EDITABLES = [
  ['telefono', 'Teléfono'], ['direccion', 'Dirección'], ['residencia', 'Residencia'], ['fecha_nacimiento', 'Fecha de nacimiento', 'date'],
  ['genero', 'Género'], ['tipo_sangre', 'Tipo de sangre'], ['etnia', 'Etnia'], ['discapacidad', 'Discapacidad'],
  ['provincia', 'Provincia'], ['canton', 'Cantón'], ['titulo', 'Título principal']
];
const SOLO_LECTURA = [['cedula', 'Cédula'], ['nombres', 'Nombres'], ['apellidos', 'Apellidos'], ['email', 'Correo'], ['cargo', 'Función'], ['situacion', 'Situación laboral'], ['especialidad', 'Especialidad'], ['area', 'Área']];

// Perfil del docente. Lo ve todo docente; solo puede EDITARLO si el administrador del plantel lo habilitó.
export default function MiPerfil() {
  const { profile, institucion, permisos, recargarPermisos } = useSession();
  const [ficha, setFicha] = useState(null);
  const [form, setForm] = useState({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState({ tipo: '', texto: '' });
  const puedeEditar = !!permisos?.docentesEditanPerfil;

  useEffect(() => { recargarPermisos?.(); /* el admin pudo cambiar el permiso después de iniciar sesión */ }, []); // eslint-disable-line
  useEffect(() => {
    let vivo = true;
    fetchMiFichaDocente(profile.id)
      .then(f => { if (!vivo) return; setFicha(f); setForm(Object.fromEntries(EDITABLES.map(([k]) => [k, f?.[k] ?? '']))); })
      .catch(e => vivo && setMsg({ tipo: 'err', texto: e.message }))
      .finally(() => vivo && setCargando(false));
    return () => { vivo = false; };
  }, [profile.id]);

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true); setMsg({ tipo: '', texto: '' });
    try {
      await actualizarMiPerfilDocente(form);
      setFicha(f => ({ ...f, ...form }));
      setMsg({ tipo: 'ok', texto: 'Perfil actualizado.' });
    } catch (err) { setMsg({ tipo: 'err', texto: err.message || 'No se pudo guardar.' }); }
    setGuardando(false);
  }

  if (cargando) return <p style={{ fontSize: 13, color: 'var(--slate)' }}>Cargando…</p>;
  if (!ficha) return <div className="empty"><span className="ti ti-user-off" /><p>No se encontró tu ficha de docente. Contacta a la secretaría del plantel.</p></div>;

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Mi perfil</h2>
      <p className="muted" style={{ margin: '0 0 12px' }}>{institucion?.nombre}</p>
      {!puedeEditar && <div className="card" style={{ marginBottom: 14 }}><div className="cb" style={{ fontSize: 13 }}>🔒 La edición de tu perfil no está habilitada. Si necesitas corregir un dato, pídeselo al administrador de tu plantel.</div></div>}
      {msg.texto && <div className={msg.tipo === 'err' ? 'lerr' : 'card'} style={{ display: 'flex', marginBottom: 10, padding: msg.tipo === 'err' ? undefined : '8px 12px' }}>{msg.texto}</div>}

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="ch"><h3>Datos institucionales</h3></div>
        <div className="cb form-grid">
          {SOLO_LECTURA.map(([k, t]) => <div key={k}><label className="fl">{t}</label><input className="fc" disabled value={ficha[k] || '—'} /></div>)}
        </div>
        <p className="muted" style={{ fontSize: 12, padding: '0 16px 12px', margin: 0 }}>Estos datos los administra el plantel y no se editan desde aquí.</p>
      </div>

      <form className="card" onSubmit={guardar}>
        <div className="ch"><h3>Datos personales</h3></div>
        <div className="cb form-grid">
          {EDITABLES.map(([k, t, tipo]) => (
            <div key={k}><label className="fl">{t}</label>
              <input className="fc" type={tipo || 'text'} disabled={!puedeEditar || guardando} value={form[k] ?? ''} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} /></div>
          ))}
        </div>
        {puedeEditar && <div className="modal-f"><button className="btn btn-primary" type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar cambios'}</button></div>}
      </form>
    </div>
  );
}
