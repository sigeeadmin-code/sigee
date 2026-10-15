import React from 'react';

// Formularios del editor ORIGINAL de estudiantes y docentes, compartidos entre la administración del plantel
// (Estudiantes / Docentes) y las pantallas del docente tutor y del perfil del docente: así los tres usan exactamente
// los mismos campos y el mismo diseño. `bloqueados` deja de solo lectura lo que administra el plantel
// (nombres, apellidos, cédula y correo).
export const GENEROS = ['Masculino', 'Femenino'];
export const ETNIAS = ['Mestizo', 'Indígena', 'Afroecuatoriano', 'Montubio', 'Blanco', 'Mulato', 'Negro', 'Otro'];
export const DISCAPACIDADES = ['Ninguna', 'Física', 'Visual', 'Auditiva', 'Intelectual', 'Psicosocial', 'Múltiple'];
export const SANGRE = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

export function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const nac = new Date(fechaNacimiento + 'T00:00:00');
  if (Number.isNaN(nac.getTime())) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad >= 0 ? edad : null;
}

export function FormAlumno({ modal, upd, subirFoto, bloqueados = false }) {
  return (
          <div className="form-grid">
            <div className="full" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div className="avatar-lg">{modal.foto_url ? <img src={modal.foto_url} alt="" /> : '👤'}</div>
              <label className="btn btn-ghost btn-sm">
                📷 Subir foto
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => e.target.files[0] && subirFoto(e.target.files[0])} />
              </label>
            </div>
            <div className="full"><label className="fl">Apellidos *</label>
              <input className="fc" value={modal.apellidos} disabled={bloqueados} onChange={e => upd('apellidos', e.target.value)} /></div>
            <div className="full"><label className="fl">Nombres *</label>
              <input className="fc" value={modal.nombres} disabled={bloqueados} onChange={e => upd('nombres', e.target.value)} /></div>
            <div><label className="fl">Cédula de identidad</label>
              <input className="fc mono" value={modal.cedula || ''} disabled={bloqueados} onChange={e => upd('cedula', e.target.value)} /></div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}><label className="fl">Fecha de nacimiento</label>
                <input className="fc" type="date" value={modal.fecha_nacimiento || ''} onChange={e => upd('fecha_nacimiento', e.target.value)} /></div>
              <div style={{ width: 90 }}><label className="fl">Edad</label>
                <input className="fc" value={calcularEdad(modal.fecha_nacimiento) ?? '—'} disabled /></div>
            </div>
            <div><label className="fl">Género</label>
              <select className="fc" value={modal.genero || ''} onChange={e => upd('genero', e.target.value)}>
                <option value="">Seleccione…</option>
                {GENEROS.map(g => <option key={g} value={g}>{g}</option>)}
              </select></div>
            <div><label className="fl">Etnia / Nacionalidad</label>
              <select className="fc" value={modal.etnia || ''} onChange={e => upd('etnia', e.target.value)}>
                <option value="">—</option>
                {ETNIAS.map(x => <option key={x} value={x}>{x}</option>)}
              </select></div>
            <div><label className="fl">Discapacidad</label>
              <select className="fc" value={modal.discapacidad || ''} onChange={e => upd('discapacidad', e.target.value)}>
                {DISCAPACIDADES.map(x => <option key={x} value={x}>{x}</option>)}
              </select></div>
            <div><label className="fl">Teléfono / Celular</label>
              <input className="fc" value={modal.telefono || ''} onChange={e => upd('telefono', e.target.value)} /></div>
            <div className="full"><label className="fl">Correo electrónico</label>
              <input className="fc" type="email" value={modal.email || ''} onChange={e => upd('email', e.target.value)} /></div>
            <div className="full"><label className="fl">Dirección de domicilio</label>
              <input className="fc" placeholder="Calle, número, sector, cantón" value={modal.direccion || ''} onChange={e => upd('direccion', e.target.value)} /></div>
            <div><label className="fl">Provincia</label>
              <input className="fc" value={modal.provincia || ''} onChange={e => upd('provincia', e.target.value)} /></div>
            <div><label className="fl">Cantón</label>
              <input className="fc" value={modal.canton || ''} onChange={e => upd('canton', e.target.value)} /></div>
            <div className="full"><label className="fl">Observaciones</label>
              <textarea className="fc" rows={3} value={modal.observaciones || ''} onChange={e => upd('observaciones', e.target.value)} /></div>
          </div>
  );
}

export function FormDocentePersonales({ modal, upd, subirFoto, bloqueados = false }) {
  return (
          <div className="form-grid">
            <div className="full" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div className="avatar-lg">{modal.foto_url ? <img src={modal.foto_url} alt="" /> : '👤'}</div>
              <label className="btn btn-ghost btn-sm">
                📷 Subir foto
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => e.target.files[0] && subirFoto(e.target.files[0])} />
              </label>
            </div>
            <div className="full"><label className="fl">Apellidos *</label>
              <input className="fc" value={modal.apellidos} disabled={bloqueados} onChange={e => upd('apellidos', e.target.value)} /></div>
            <div className="full"><label className="fl">Nombres *</label>
              <input className="fc" value={modal.nombres} disabled={bloqueados} onChange={e => upd('nombres', e.target.value)} /></div>
            <div><label className="fl">Cédula *</label>
              <input className="fc mono" value={modal.cedula} disabled={bloqueados} onChange={e => upd('cedula', e.target.value)} /></div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}><label className="fl">Fecha de nacimiento</label>
                <input className="fc" type="date" value={modal.fecha_nacimiento || ''} onChange={e => upd('fecha_nacimiento', e.target.value)} /></div>
              <div style={{ width: 90 }}><label className="fl">Edad</label>
                <input className="fc" value={calcularEdad(modal.fecha_nacimiento) ?? '—'} disabled /></div>
            </div>
            <div><label className="fl">Género</label>
              <select className="fc" value={modal.genero || ''} onChange={e => upd('genero', e.target.value)}>
                <option value="">Seleccione…</option>
                {GENEROS.map(g => <option key={g} value={g}>{g}</option>)}
              </select></div>
            <div><label className="fl">Tipo de sangre</label>
              <select className="fc" value={modal.tipo_sangre || ''} onChange={e => upd('tipo_sangre', e.target.value)}>
                <option value="">Seleccione…</option>
                {SANGRE.map(s => <option key={s} value={s}>{s}</option>)}
              </select></div>
            <div><label className="fl">Etnia / Nacionalidad</label>
              <select className="fc" value={modal.etnia || ''} onChange={e => upd('etnia', e.target.value)}>
                <option value="">—</option>
                {ETNIAS.map(x => <option key={x} value={x}>{x}</option>)}
              </select></div>
            <div><label className="fl">Discapacidad</label>
              <select className="fc" value={modal.discapacidad || ''} onChange={e => upd('discapacidad', e.target.value)}>
                {DISCAPACIDADES.map(x => <option key={x} value={x}>{x}</option>)}
              </select></div>
            <div><label className="fl">Correo electrónico</label>
              <input className="fc" type="email" value={modal.email || ''} disabled={bloqueados} onChange={e => upd('email', e.target.value)} /></div>
            <div><label className="fl">Teléfono / celular</label>
              <input className="fc" value={modal.telefono || ''} onChange={e => upd('telefono', e.target.value)} /></div>
            <div className="full"><label className="fl">Dirección de domicilio</label>
              <input className="fc" value={modal.direccion || ''} onChange={e => upd('direccion', e.target.value)} /></div>
            <div className="full"><label className="fl">Lugar de residencia</label>
              <input className="fc" value={modal.residencia || ''} onChange={e => upd('residencia', e.target.value)} /></div>
            <div><label className="fl">Provincia</label>
              <input className="fc" value={modal.provincia || ''} onChange={e => upd('provincia', e.target.value)} /></div>
            <div><label className="fl">Cantón</label>
              <input className="fc" value={modal.canton || ''} onChange={e => upd('canton', e.target.value)} /></div>
            <div className="full"><label className="fl">Observaciones</label>
              <textarea className="fc" rows={3} value={modal.observaciones || ''} disabled={bloqueados} onChange={e => upd('observaciones', e.target.value)} /></div>
          </div>
  );
}

export function FormDocenteTitulos({ modal, upd }) {
  return (
          <div>
            {modal.titulos.map((ti, i) => (
              <div key={i} className="card" style={{ marginBottom: 12 }}>
                <div className="form-grid">
                  <div className="full"><label className="fl">Título</label>
                    <input className="fc" value={ti.titulo || ''} placeholder="LIC. EN CIENCIAS DE LA EDUCACIÓN"
                      onChange={e => { const arr = [...modal.titulos]; arr[i] = { ...ti, titulo: e.target.value }; upd('titulos', arr); }} /></div>
                  <div><label className="fl">Institución de educación superior</label>
                    <input className="fc" value={ti.institucion || ''}
                      onChange={e => { const arr = [...modal.titulos]; arr[i] = { ...ti, institucion: e.target.value }; upd('titulos', arr); }} /></div>
                  <div><label className="fl">Número de registro (SENESCYT)</label>
                    <input className="fc mono" value={ti.nro_registro || ''}
                      onChange={e => { const arr = [...modal.titulos]; arr[i] = { ...ti, nro_registro: e.target.value }; upd('titulos', arr); }} /></div>
                  <div><label className="fl">Año de obtención</label>
                    <input className="fc" value={ti.anio || ''}
                      onChange={e => { const arr = [...modal.titulos]; arr[i] = { ...ti, anio: e.target.value }; upd('titulos', arr); }} /></div>
                </div>
                <button type="button" className="btn btn-danger btn-sm" style={{ marginTop: 8 }}
                  onClick={() => upd('titulos', modal.titulos.filter((_, j) => j !== i))}>🗑 Eliminar título</button>
              </div>
            ))}
            <button type="button" className="btn btn-secondary"
              onClick={() => upd('titulos', [...modal.titulos, { titulo: '', institucion: '', nro_registro: '', anio: '' }])}>+ Agregar título</button>
          </div>
  );
}
