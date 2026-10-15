import React, { useEffect, useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { fetchMiFichaDocente, actualizarMiPerfilDocente, subirArchivo } from '../lib/data.js';
import { FormDocentePersonales, FormDocenteTitulos } from '../components/FormulariosPersona.jsx';

const CAMPOS_EDITABLES = ['telefono', 'direccion', 'residencia', 'fecha_nacimiento', 'genero', 'tipo_sangre', 'etnia', 'discapacidad', 'provincia', 'canton', 'foto_url'];

// Perfil del docente. Lo ve todo docente y lo edita con el MISMO editor de docentes del plantel (pestañas Personales y Títulos),
// solo si el administrador del plantel lo habilitó. Apellidos, nombres, cédula y correo quedan en solo lectura.
export default function MiPerfil() {
  const { profile, institucion, permisos, recargarPermisos } = useSession();
  const [ficha, setFicha] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(null);
  const [tab, setTab] = useState('personales');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const puedeEditar = !!permisos?.docentesEditanPerfil;

  useEffect(() => { recargarPermisos?.(); }, []); // eslint-disable-line
  useEffect(() => {
    let vivo = true;
    fetchMiFichaDocente(profile.id)
      .then(f => vivo && setFicha(f))
      .catch(e => vivo && setError(e.message))
      .finally(() => vivo && setCargando(false));
    return () => { vivo = false; };
  }, [profile.id]);

  const abrir = () => { setError(''); setOk(''); setTab('personales'); setModal({ ...ficha, titulos: Array.isArray(ficha.titulos) ? ficha.titulos : [] }); };
  const cerrar = () => { if (!guardando) { setModal(null); setError(''); } };
  const upd = (campo, valor) => setModal(m => ({ ...m, [campo]: valor }));

  async function subirFoto(file) {
    try {
      const ext = file.name.split('.').pop();
      upd('foto_url', await subirArchivo('docentes-fotos', `${modal.id}/foto.${ext}`, file));
    } catch (e) { setError('No se pudo subir la foto: ' + e.message); }
  }

  async function guardar() {
    setGuardando(true); setError('');
    try {
      const campos = { ...Object.fromEntries(CAMPOS_EDITABLES.map(k => [k, modal[k] || ''])), titulos: modal.titulos };
      await actualizarMiPerfilDocente(campos);
      setFicha(f => ({ ...f, ...campos }));
      setModal(null); setOk('Perfil actualizado.');
    } catch (e) { setError('No se pudo guardar: ' + (e.message || e)); }
    setGuardando(false);
  }

  if (cargando) return <p style={{ fontSize: 13, color: 'var(--slate)' }}>Cargando…</p>;
  if (!ficha) return <div className="empty"><span className="ti ti-user-off" /><p>No se encontró tu ficha de docente. Contacta a la secretaría del plantel.</p></div>;

  const dato = (t, v) => <div><div className="fl">{t}</div><div style={{ fontSize: 14 }}>{v || '—'}</div></div>;
  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Mi perfil</h2>
      <p className="muted" style={{ margin: '0 0 12px' }}>{institucion?.nombre}</p>
      {!puedeEditar && <div className="card" style={{ marginBottom: 14 }}><div className="cb" style={{ fontSize: 13 }}>🔒 La edición de tu perfil no está habilitada. Si necesitas corregir un dato, pídeselo al administrador de tu plantel.</div></div>}
      {ok && <div className="card" style={{ marginBottom: 14 }}><div className="cb" style={{ fontSize: 13 }}>✅ {ok}</div></div>}
      {error && !modal && <div className="lerr" style={{ display: 'flex', marginBottom: 10 }}>{error}</div>}

      <div className="card">
        <div className="cb" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="avatar-lg">{ficha.foto_url ? <img src={ficha.foto_url} alt="" /> : '👤'}</div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{ficha.apellidos} {ficha.nombres}</div>
            <div className="muted" style={{ fontSize: 13 }}>{ficha.cargo || 'Docente'}{ficha.especialidad ? ` · ${ficha.especialidad}` : ''}</div>
          </div>
          <button className="btn btn-primary" onClick={abrir}>{puedeEditar ? '✏️ Editar perfil' : '👁️ Ver perfil'}</button>
        </div>
        <div className="cb form-grid">
          {dato('Cédula', ficha.cedula)}{dato('Correo electrónico', ficha.email)}{dato('Teléfono / celular', ficha.telefono)}
          {dato('Situación laboral', ficha.situacion)}{dato('Área', ficha.area)}{dato('Dirección', ficha.direccion)}
        </div>
      </div>

      {modal && (
        <div className="modal-bg" onClick={cerrar}>
          <div className="modal wide" onClick={e => e.stopPropagation()}>
            <div className="modal-h">
              <h3>{puedeEditar ? '✏️ Editar docente' : '👁️ Docente'} — {modal.nombres} {modal.apellidos}</h3>
              <button className="btn btn-ghost btn-sm" onClick={cerrar}><span className="ti ti-x" /></button>
            </div>
            {error && <div className="lerr">{error}</div>}
            <div className="tabs">
              {[['personales', 'Personales'], ['titulos', 'Títulos']].map(([k, t]) => <button key={k} className={'tab' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{t}</button>)}
            </div>
            <div className="modal-b">
              <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>Apellidos, nombres, cédula, correo y observaciones los administra el plantel.</p>
              <fieldset disabled={!puedeEditar || guardando} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
                {tab === 'personales' && <FormDocentePersonales modal={modal} upd={upd} subirFoto={subirFoto} bloqueados />}
                {tab === 'titulos' && <FormDocenteTitulos modal={modal} upd={upd} />}
              </fieldset>
            </div>
            <div className="modal-f">
              <button className="btn btn-secondary" onClick={cerrar} disabled={guardando}>{puedeEditar ? 'Cancelar' : 'Cerrar'}</button>
              {puedeEditar && <button className="btn btn-primary" disabled={guardando} onClick={guardar}>{guardando ? 'Guardando…' : '💾 Guardar'}</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
