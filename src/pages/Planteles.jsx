import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { supabase } from '../lib/supabase.js';
import { fetchPlanteles, crearPlantel, actualizarPlantel, eliminarPlantel } from '../lib/data.js';

const SOSTENIMIENTOS = ['Fiscal', 'Particular', 'Fiscomisional', 'Municipal'];
const SOST_CLASS = { Fiscal: 'sb-fiscal', Particular: 'sb-particular', Fiscomisional: 'sb-fiscomisional', Municipal: 'sb-municipal' };
const SOST_LABEL = { Fiscal: 'Fiscal', Particular: 'Particular', Fiscomisional: 'Fiscomisional', Municipal: 'Municipal' };
const JORNADAS_OPTS = ['Matutina', 'Vespertina', 'Nocturna'];
const MODALIDADES_OPTS = ['Presencial', 'Semipresencial', 'Virtual'];

const emptyForm = {
  nombre: '', amie: '', sostenimiento: 'Fiscal', provincia: 'El Oro', canton: '', parroquia: '',
  zona: 'Zona 7', distrito_nombre: '', circuito: '', regimen: 'Sierra',
  jornadas: ['Matutina'], modalidades: ['Presencial'],
  nivel_educativo: '', telefono: '', telefono2: '', direccion: '', sitio_web: '', slogan: '',
  rector: '', logo: null,
  num_estudiantes_ref: '', num_docentes_ref: '', finanzas_habilitado: false, activo: true
};

const emptyAdmin = { nombres: '', apellidos: '', email: '', cedula: '', telefono: '', password: '' };

function generarPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  return Array.from(arr, n => chars[n % chars.length]).join('');
}

export default function Planteles() {
  const { profile } = useSession();
  const esSuperAdmin = profile.rolDb === 'super_admin';

  const [planteles, setPlanteles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [sostFiltro, setSostFiltro] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [admin, setAdmin] = useState(emptyAdmin);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [toast, setToast] = useState(null);
  const [credencialesCreadas, setCredencialesCreadas] = useState(null); // { email, password } tras crear el admin

  const cargar = useCallback(async () => {
    setLoading(true);
    setPlanteles(await fetchPlanteles());
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const filtrados = useMemo(() => planteles.filter(p => {
    if (sostFiltro && p.sostenimiento !== sostFiltro) return false;
    if (q && !`${p.nombre || ''} ${p.amie || ''} ${p.canton || ''}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [planteles, q, sostFiltro]);

  function abrirCrear() {
    setEditId(null);
    setForm(emptyForm);
    setAdmin({ ...emptyAdmin, password: generarPassword() });
    setLogoFile(null);
    setLogoPreview(null);
    setFormErr('');
    setCredencialesCreadas(null);
    setModalOpen(true);
  }
  function abrirEditar(p) {
    setEditId(p.id);
    setForm({
      ...emptyForm,
      ...p,
      jornadas: Array.isArray(p.jornadas) && p.jornadas.length ? p.jornadas : (p.jornada ? [p.jornada] : ['Matutina']),
      modalidades: Array.isArray(p.modalidades) && p.modalidades.length ? p.modalidades : ['Presencial'],
      num_estudiantes_ref: p.num_estudiantes_ref ?? '',
      num_docentes_ref: p.num_docentes_ref ?? ''
    });
    setAdmin(emptyAdmin);
    setLogoFile(null);
    setLogoPreview(p.logo || null);
    setFormErr('');
    setCredencialesCreadas(null);
    setModalOpen(true);
  }
  function campo(k, v) { setForm(f => ({ ...f, [k]: v })); }
  function campoAdmin(k, v) { setAdmin(a => ({ ...a, [k]: v })); }

  function toggleMulti(campoNombre, valor) {
    setForm(f => {
      const actual = f[campoNombre] || [];
      const nuevo = actual.includes(valor) ? actual.filter(v => v !== valor) : [...actual, valor];
      return { ...f, [campoNombre]: nuevo };
    });
  }

  function onLogoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result);
    reader.readAsDataURL(file);
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  async function subirLogo(plantelId) {
    if (!logoFile) return form.logo || null;
    const ext = logoFile.name.split('.').pop();
    const path = `${plantelId}/logo.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('planteles-logos')
      .upload(path, logoFile, { upsert: true });
    if (upErr) throw new Error('No se pudo subir el logo: ' + upErr.message);
    const { data: pub } = supabase.storage.from('planteles-logos').getPublicUrl(path);
    return pub.publicUrl;
  }

  async function guardar(e) {
    e.preventDefault();
    setFormErr('');
    if (!form.nombre.trim()) { setFormErr('El nombre del plantel es obligatorio.'); return; }
    if (!form.jornadas.length) { setFormErr('Seleccione al menos una jornada.'); return; }
    if (!editId) {
      if (!admin.nombres.trim() || !admin.apellidos.trim() || !admin.email.trim()) {
        setFormErr('Nombres, apellidos y correo del administrador del plantel son obligatorios.');
        return;
      }
      if (!admin.password || admin.password.length < 8) {
        setFormErr('La contraseña del administrador debe tener al menos 8 caracteres.');
        return;
      }
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        jornada: form.jornadas[0] || 'Matutina', // compatibilidad con la columna legacy
        num_estudiantes_ref: form.num_estudiantes_ref === '' ? null : Number(form.num_estudiantes_ref),
        num_docentes_ref: form.num_docentes_ref === '' ? null : Number(form.num_docentes_ref)
      };
      delete payload.id; delete payload.created_at; delete payload.updated_at; delete payload.slug;

      if (editId) {
        if (logoFile) payload.logo = await subirLogo(editId);
        await actualizarPlantel(editId, payload);
        setToast({ tipo: 'ok', msg: `Plantel "${form.nombre}" actualizado.` });
      } else {
        // 1) Crear el plantel primero para obtener su id
        const nuevoPlantel = await crearPlantel(payload);
        const nuevoId = nuevoPlantel?.id;

        // 2) Subir el logo ya con el id real del plantel (si se seleccionó uno)
        if (logoFile && nuevoId) {
          const logoUrl = await subirLogo(nuevoId);
          await actualizarPlantel(nuevoId, { logo: logoUrl });
        }

        // 3) Crear la cuenta admin_plantel vinculada (Edge Function real, verificada
        //    contra su código fuente en Supabase: espera email/password/nombres/
        //    apellidos/rol/institucion_id/cedula/telefono y devuelve { profile }
        //    o { error }).
        const { error: adminErr } = await supabase.functions.invoke('admin-create-user', {
          body: {
            email: admin.email.trim().toLowerCase(),
            password: admin.password,
            nombres: admin.nombres.trim(),
            apellidos: admin.apellidos.trim(),
            rol: 'admin_plantel',
            institucion_id: nuevoId,
            cedula: admin.cedula.trim() || undefined,
            telefono: admin.telefono.trim() || undefined
          }
        });
        if (adminErr) {
          // El plantel ya se creó; se avisa pero no se revierte automáticamente
          setToast({ tipo: 'err', msg: `Plantel creado, pero falló la cuenta admin: ${adminErr.message}` });
          setModalOpen(false);
          await cargar();
        } else {
          // No cerramos el modal todavía: hay que mostrar la contraseña generada
          // una sola vez, porque la Edge Function no reenvía correo de verificación.
          setCredencialesCreadas({ email: admin.email.trim().toLowerCase(), password: admin.password });
          await cargar();
        }
        setSaving(false);
        return;
      }
      setModalOpen(false);
      await cargar();
    } catch (err) {
      setFormErr(err.message || 'No se pudo guardar el plantel.');
    }
    setSaving(false);
  }

  async function eliminar(p) {
    if (!window.confirm(`¿Eliminar el plantel "${p.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await eliminarPlantel(p.id);
      setToast({ tipo: 'ok', msg: `Plantel "${p.nombre}" eliminado.` });
      await cargar();
    } catch (err) {
      setToast({ tipo: 'err', msg: err.message || 'No se pudo eliminar (puede tener datos asociados).' });
    }
  }

  if (!esSuperAdmin) {
    return (
      <div className="card"><div className="cb">
        <p style={{ fontSize: 13 }}>Solo el Super Admin puede administrar los planteles de la Zona 7.</p>
      </div></div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: '0 0 4px' }}>Planteles</h2>
          <div style={{ fontSize: 13, color: 'var(--slate)' }}>Instituciones de la Zona 7 · El Oro (multi-tenant)</div>
        </div>
        <button className="btn btn-primary" onClick={abrirCrear}>
          <span className="ti ti-building-plus" /> Nuevo plantel
        </button>
      </div>

      <div className="search-bar">
        <input className="fc" placeholder="Buscar por nombre, AMIE o cantón…" value={q} onChange={e => setQ(e.target.value)} />
        <select className="fc" value={sostFiltro} onChange={e => setSostFiltro(e.target.value)}>
          <option value="">Todos los sostenimientos</option>
          {SOSTENIMIENTOS.map(s => <option key={s} value={s}>{SOST_LABEL[s]}</option>)}
        </select>
      </div>

      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--slate)' }}>Cargando…</p>
      ) : filtrados.length === 0 ? (
        <div className="empty"><span className="ti ti-building" /><p>No hay planteles que coincidan.</p></div>
      ) : (
        <div className="card">
          <div className="cb" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="data" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Plantel</th>
                  <th>AMIE</th>
                  <th>Sostenimiento</th>
                  <th>Cantón</th>
                  <th>Estudiantes ref.</th>
                  <th>Docentes ref.</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtrados.map(p => (
                  <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => abrirEditar(p)}>
                    <td><strong>{p.nombre}</strong></td>
                    <td>{p.amie || '—'}</td>
                    <td>{p.sostenimiento && <span className={'sost-badge ' + (SOST_CLASS[p.sostenimiento] || '')}>{SOST_LABEL[p.sostenimiento] || p.sostenimiento}</span>}</td>
                    <td>{p.canton || '—'}</td>
                    <td>{p.num_estudiantes_ref ?? '—'}</td>
                    <td>{p.num_docentes_ref ?? '—'}</td>
                    <td>
                      <span className={'badge ' + (p.activo !== false ? 'b-ok' : 'b-muted')}>{p.activo !== false ? 'Activo' : 'Inactivo'}</span>
                      {p.finanzas_habilitado && <span className="badge b-info" style={{ marginLeft: 6 }}>Finanzas</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)', borderColor: '#fca5a5' }} onClick={e => { e.stopPropagation(); eliminar(p); }}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalOpen && credencialesCreadas && (
        <div className="modal-bg open">
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-h">
              <h3>Plantel y cuenta admin creados</h3>
            </div>
            <div className="modal-b">
              <p style={{ fontSize: 13, marginBottom: 12 }}>
                Copia esta contraseña ahora y compártela por un canal seguro con el nuevo administrador —
                no se puede volver a consultar desde aquí.
              </p>
              <div className="form-grid">
                <div className="full">
                  <label className="fl">Correo</label>
                  <input className="fc" readOnly value={credencialesCreadas.email} onFocus={e => e.target.select()} />
                </div>
                <div className="full">
                  <label className="fl">Contraseña</label>
                  <input className="fc" readOnly style={{ fontFamily: 'monospace' }} value={credencialesCreadas.password} onFocus={e => e.target.select()} />
                </div>
              </div>
            </div>
            <div className="modal-f">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  navigator.clipboard?.writeText(`Correo: ${credencialesCreadas.email}\nContraseña: ${credencialesCreadas.password}`);
                  setCredencialesCreadas(null);
                  setModalOpen(false);
                }}
              >
                Copiar y cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && !credencialesCreadas && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <form className="modal wide" onSubmit={guardar} style={{ maxWidth: 860 }}>
            <div className="modal-h">
              <h3>{editId ? 'Editar plantel — Perfil institucional' : 'Nuevo plantel educativo'}</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModalOpen(false)}><span className="ti ti-x" /></button>
            </div>
            <div className="modal-b">
              {formErr && <div className="lerr" style={{ display: 'flex', background: 'var(--redXL)', color: 'var(--redD)', border: '1px solid #fca5a5' }}>{formErr}</div>}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 16, alignItems: 'start' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Logotipo del plantel</div>
                  <div style={{
                    width: 120, height: 120, margin: '0 auto 10px', fontSize: 48,
                    border: '2px dashed var(--line)', borderRadius: 12, overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--page)'
                  }}>
                    {logoPreview ? <img src={logoPreview} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="Logo" /> : '🏫'}
                  </div>
                  <input type="file" accept="image/*" onChange={onLogoChange} style={{ fontSize: 12, width: '100%' }} />
                  <p style={{ fontSize: 11, color: 'var(--slate)', marginTop: 8, textAlign: 'center' }}>JPG, PNG o SVG · reportes e impresos</p>

                  <div style={{ marginTop: 16, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Jornadas</div>
                  {JORNADAS_OPTS.map(j => (
                    <label key={j} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', cursor: 'pointer', fontSize: 13 }}>
                      <input type="checkbox" checked={form.jornadas.includes(j)} onChange={() => toggleMulti('jornadas', j)} />
                      {j}
                    </label>
                  ))}

                  <div style={{ marginTop: 12, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Modalidad de estudio</div>
                  {MODALIDADES_OPTS.map(m => (
                    <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', cursor: 'pointer', fontSize: 13 }}>
                      <input type="checkbox" checked={form.modalidades.includes(m)} onChange={() => toggleMulti('modalidades', m)} />
                      {m}
                    </label>
                  ))}
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)', marginBottom: 10 }}>Identificación institucional</div>
                  <div className="form-grid">
                    <div>
                      <label className="fl">AMIE</label>
                      <input className="fc" value={form.amie || ''} onChange={e => campo('amie', e.target.value)} placeholder="07H00123" />
                    </div>
                    <div>
                      <label className="fl">Sostenimiento</label>
                      <select className="fc" value={form.sostenimiento || ''} onChange={e => campo('sostenimiento', e.target.value)}>
                        {SOSTENIMIENTOS.map(s => <option key={s} value={s}>{SOST_LABEL[s]}</option>)}
                      </select>
                    </div>
                    <div className="full">
                      <label className="fl">Nombre del plantel</label>
                      <input className="fc" value={form.nombre} onChange={e => campo('nombre', e.target.value)} required />
                    </div>
                    <div className="full">
                      <label className="fl">Eslogan</label>
                      <input className="fc" value={form.slogan || ''} onChange={e => campo('slogan', e.target.value)} />
                    </div>
                  </div>

                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)', margin: '16px 0 10px' }}>Ubicación</div>
                  <div className="form-grid">
                    <div>
                      <label className="fl">Provincia</label>
                      <input className="fc" value={form.provincia || ''} onChange={e => campo('provincia', e.target.value)} />
                    </div>
                    <div>
                      <label className="fl">Cantón</label>
                      <input className="fc" value={form.canton || ''} onChange={e => campo('canton', e.target.value)} />
                    </div>
                    <div>
                      <label className="fl">Parroquia</label>
                      <input className="fc" value={form.parroquia || ''} onChange={e => campo('parroquia', e.target.value)} />
                    </div>
                    <div className="full">
                      <label className="fl">Dirección</label>
                      <input className="fc" value={form.direccion || ''} onChange={e => campo('direccion', e.target.value)} />
                    </div>
                    <div>
                      <label className="fl">Distrito</label>
                      <input className="fc" value={form.distrito_nombre || ''} onChange={e => campo('distrito_nombre', e.target.value)} />
                    </div>
                    <div>
                      <label className="fl">Circuito</label>
                      <input className="fc" value={form.circuito || ''} onChange={e => campo('circuito', e.target.value)} />
                    </div>
                    <div>
                      <label className="fl">Zona</label>
                      <input className="fc" value={form.zona || ''} onChange={e => campo('zona', e.target.value)} />
                    </div>
                    <div>
                      <label className="fl">Nivel educativo</label>
                      <input className="fc" value={form.nivel_educativo || ''} onChange={e => campo('nivel_educativo', e.target.value)} placeholder="EGB / Bachillerato" />
                    </div>
                    <div>
                      <label className="fl">Régimen</label>
                      <select className="fc" value={form.regimen || ''} onChange={e => campo('regimen', e.target.value)}>
                        <option value="Sierra">Sierra</option>
                        <option value="Costa">Costa</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)', margin: '16px 0 10px' }}>Contacto</div>
                  <div className="form-grid">
                    <div>
                      <label className="fl">Teléfono principal</label>
                      <input className="fc" value={form.telefono || ''} onChange={e => campo('telefono', e.target.value)} placeholder="07-XXXXXXX" />
                    </div>
                    <div>
                      <label className="fl">Teléfono secundario</label>
                      <input className="fc" value={form.telefono2 || ''} onChange={e => campo('telefono2', e.target.value)} placeholder="09XXXXXXXX" />
                    </div>
                    <div>
                      <label className="fl">Sitio web</label>
                      <input className="fc" value={form.sitio_web || ''} onChange={e => campo('sitio_web', e.target.value)} />
                    </div>
                  </div>

                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)', margin: '16px 0 10px' }}>Autoridad del plantel</div>
                  <div className="form-grid">
                    <div className="full">
                      <label className="fl">Rector / Director</label>
                      <input className="fc" value={form.rector || ''} onChange={e => campo('rector', e.target.value)} placeholder="Nombre completo con título" />
                    </div>
                  </div>

                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)', margin: '16px 0 10px' }}>Datos referenciales</div>
                  <div className="form-grid">
                    <div>
                      <label className="fl">Estudiantes (referencial)</label>
                      <input className="fc" type="number" min="0" value={form.num_estudiantes_ref} onChange={e => campo('num_estudiantes_ref', e.target.value)} />
                    </div>
                    <div>
                      <label className="fl">Docentes (referencial)</label>
                      <input className="fc" type="number" min="0" value={form.num_docentes_ref} onChange={e => campo('num_docentes_ref', e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 22 }}>
                      <input type="checkbox" id="finhab" checked={!!form.finanzas_habilitado} onChange={e => campo('finanzas_habilitado', e.target.checked)} />
                      <label htmlFor="finhab" className="fl" style={{ marginBottom: 0 }}>Habilitar módulo Financiero (solo particulares)</label>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 22 }}>
                      <input type="checkbox" id="activoplantel" checked={form.activo !== false} onChange={e => campo('activo', e.target.checked)} />
                      <label htmlFor="activoplantel" className="fl" style={{ marginBottom: 0 }}>Plantel activo</label>
                    </div>
                  </div>

                  {!editId && (
                    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)', marginBottom: 8 }}>Cuenta Admin del plantel</div>
                      <p style={{ fontSize: 12, color: 'var(--slate)', marginBottom: 10 }}>
                        Se crea rol <strong>admin_plantel</strong> al guardar.
                      </p>
                      <div className="form-grid">
                        <div>
                          <label className="fl">Nombres</label>
                          <input className="fc" value={admin.nombres} onChange={e => campoAdmin('nombres', e.target.value)} placeholder="Ej: María" />
                        </div>
                        <div>
                          <label className="fl">Apellidos</label>
                          <input className="fc" value={admin.apellidos} onChange={e => campoAdmin('apellidos', e.target.value)} placeholder="Ej: López" />
                        </div>
                        <div className="full">
                          <label className="fl">Correo</label>
                          <input className="fc" type="email" value={admin.email} onChange={e => campoAdmin('email', e.target.value)} placeholder="admin@plantel.edu.ec" />
                        </div>
                        <div>
                          <label className="fl">Cédula</label>
                          <input className="fc" value={admin.cedula} onChange={e => campoAdmin('cedula', e.target.value)} placeholder="0700000000" />
                        </div>
                        <div>
                          <label className="fl">Teléfono</label>
                          <input className="fc" value={admin.telefono} onChange={e => campoAdmin('telefono', e.target.value)} placeholder="0990000000" />
                        </div>
                        <div className="full">
                          <label className="fl">Contraseña temporal</label>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <input className="fc" value={admin.password} onChange={e => campoAdmin('password', e.target.value)} style={{ fontFamily: 'monospace' }} />
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => campoAdmin('password', generarPassword())}>
                              Generar
                            </button>
                          </div>
                          <p style={{ fontSize: 11, color: 'var(--slate)', marginTop: 4 }}>
                            Se le asigna directamente (la cuenta queda confirmada); cópiala antes de cerrar, no se puede volver a ver.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-f">
              <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Guardando…' : (editId ? 'Guardar cambios' : 'Crear plantel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {toast && <div className={'toast ' + (toast.tipo === 'ok' ? 'ok' : 'err')}>{toast.msg}</div>}
    </div>
  );
}
