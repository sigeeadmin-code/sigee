import React, { useEffect, useState, useCallback } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { supabase } from '../lib/supabase.js';
import { fetchPlanteles, actualizarPlantel } from '../lib/data.js';

const SOST_LABEL = { Fiscal: 'Fiscal', Particular: 'Particular', Fiscomisional: 'Fiscomisional', Municipal: 'Municipal' };
const JORNADAS_OPTS = ['Matutina', 'Vespertina', 'Nocturna'];
const MODALIDADES_OPTS = ['Presencial', 'Semipresencial', 'Virtual'];

export default function MiPlantel() {
  const { institucion, refrescarDatos } = useSession();
  const [plantel, setPlantel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [toast, setToast] = useState(null);

  // fetchPlanteles() ya está acotado por RLS: admin_plantel solo puede ver
  // (y por lo tanto solo recibe) la fila de su propia institución.
  const cargar = useCallback(async () => {
    setLoading(true);
    const filas = await fetchPlanteles();
    setPlantel(filas.find(p => p.id === institucion?.id) || filas[0] || null);
    setLoading(false);
  }, [institucion?.id]);
  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  function abrirEditar() {
    if (!plantel) return;
    setForm({
      ...plantel,
      jornadas: Array.isArray(plantel.jornadas) && plantel.jornadas.length ? plantel.jornadas : (plantel.jornada ? [plantel.jornada] : ['Matutina']),
      modalidades: Array.isArray(plantel.modalidades) && plantel.modalidades.length ? plantel.modalidades : ['Presencial'],
      num_estudiantes_ref: plantel.num_estudiantes_ref ?? '',
      num_docentes_ref: plantel.num_docentes_ref ?? ''
    });
    setLogoFile(null);
    setLogoPreview(plantel.logo || null);
    setFormErr('');
    setModalOpen(true);
  }
  function campo(k, v) { setForm(f => ({ ...f, [k]: v })); }
  function toggleMulti(campoNombre, valor) {
    setForm(f => {
      const actual = f[campoNombre] || [];
      return { ...f, [campoNombre]: actual.includes(valor) ? actual.filter(v => v !== valor) : [...actual, valor] };
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
  async function subirLogo() {
    if (!logoFile) return form.logo || null;
    const ext = logoFile.name.split('.').pop();
    const path = `${plantel.id}/logo.${ext}`;
    const { error: upErr } = await supabase.storage.from('planteles-logos').upload(path, logoFile, { upsert: true });
    if (upErr) throw new Error('No se pudo subir el logo: ' + upErr.message);
    const { data: pub } = supabase.storage.from('planteles-logos').getPublicUrl(path);
    return pub.publicUrl;
  }

  async function guardar(e) {
    e.preventDefault();
    setFormErr('');
    if (!form.nombre.trim()) { setFormErr('El nombre del plantel es obligatorio.'); return; }
    if (!form.jornadas.length) { setFormErr('Seleccione al menos una jornada.'); return; }
    setSaving(true);
    try {
      const logoUrl = await subirLogo();
      // Solo las características propias del plantel; amie, sostenimiento,
      // activo y finanzas_habilitado son administrados por Zona 7 (super_admin).
      const cambios = {
        nombre: form.nombre, slogan: form.slogan || null,
        provincia: form.provincia || null, canton: form.canton || null, parroquia: form.parroquia || null,
        direccion: form.direccion || null, distrito_nombre: form.distrito_nombre || null,
        circuito: form.circuito || null, zona: form.zona || null, nivel_educativo: form.nivel_educativo || null,
        regimen: form.regimen || null, jornadas: form.jornadas, jornada: form.jornadas[0] || 'Matutina',
        modalidades: form.modalidades,
        telefono: form.telefono || null, telefono2: form.telefono2 || null, sitio_web: form.sitio_web || null,
        rector: form.rector || null,
        num_estudiantes_ref: form.num_estudiantes_ref === '' ? null : Number(form.num_estudiantes_ref),
        num_docentes_ref: form.num_docentes_ref === '' ? null : Number(form.num_docentes_ref),
        logo: logoUrl
      };
      await actualizarPlantel(plantel.id, cambios);
      setToast({ tipo: 'ok', msg: 'Perfil del plantel actualizado.' });
      setModalOpen(false);
      await cargar();
      refrescarDatos();
    } catch (err) {
      setFormErr(err.message || 'No se pudo guardar.');
    }
    setSaving(false);
  }

  if (loading) return <p style={{ fontSize: 13, color: 'var(--slate)' }}>Cargando…</p>;
  if (!plantel) return <div className="card"><div className="cb"><p>No se encontró información del plantel.</p></div></div>;

  const Dato = ({ label, value }) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 14 }}>{value || <span className="muted">—</span>}</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: '0 0 4px' }}>Mi Plantel</h2>
          <div style={{ fontSize: 13, color: 'var(--slate)' }}>Perfil institucional y características de {plantel.nombre}</div>
        </div>
        <button className="btn btn-primary" onClick={abrirEditar}><span className="ti ti-pencil" /> Editar perfil</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, alignItems: 'start' }}>
        <div className="card">
          <div className="cb" style={{ textAlign: 'center' }}>
            <div style={{
              width: 140, height: 140, margin: '0 auto 12px', fontSize: 56,
              border: '2px dashed var(--line)', borderRadius: 12, overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--page)'
            }}>
              {plantel.logo ? <img src={plantel.logo} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="Logo" /> : '🏫'}
            </div>
            <strong style={{ fontSize: 14 }}>{plantel.nombre}</strong>
            {plantel.slogan && <div style={{ fontSize: 12, color: 'var(--slate)', fontStyle: 'italic', marginTop: 4 }}>{plantel.slogan}</div>}
            <div style={{ marginTop: 10 }}>
              <span className={'badge ' + (plantel.activo !== false ? 'b-ok' : 'b-muted')}>{plantel.activo !== false ? 'Activo' : 'Inactivo'}</span>
              {plantel.finanzas_habilitado && <span className="badge b-info" style={{ marginLeft: 6 }}>Financiero</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--slate)', marginTop: 8 }}>AMIE: {plantel.amie || '—'}</div>
            <p style={{ fontSize: 11, color: 'var(--slate)', marginTop: 10 }}>AMIE, sostenimiento y estado son administrados por Zona 7.</p>
          </div>
        </div>

        <div>
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch"><h3>Identificación</h3></div>
            <div className="cb form-grid">
              <Dato label="Sostenimiento" value={SOST_LABEL[plantel.sostenimiento] || plantel.sostenimiento} />
              <Dato label="Nivel educativo" value={plantel.nivel_educativo} />
              <Dato label="Régimen" value={plantel.regimen} />
              <Dato label="Jornadas" value={(plantel.jornadas?.length ? plantel.jornadas : [plantel.jornada]).filter(Boolean).join(', ')} />
              <Dato label="Modalidad" value={plantel.modalidades?.join(', ')} />
              <Dato label="Rector/a" value={plantel.rector} />
            </div>
          </div>

          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch"><h3>Ubicación</h3></div>
            <div className="cb form-grid">
              <Dato label="Provincia" value={plantel.provincia} />
              <Dato label="Cantón" value={plantel.canton} />
              <Dato label="Parroquia" value={plantel.parroquia} />
              <Dato label="Zona" value={plantel.zona} />
              <Dato label="Distrito" value={plantel.distrito_nombre} />
              <Dato label="Circuito" value={plantel.circuito} />
              <div className="full"><Dato label="Dirección" value={plantel.direccion} /></div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch"><h3>Contacto</h3></div>
            <div className="cb form-grid">
              <Dato label="Teléfono principal" value={plantel.telefono} />
              <Dato label="Teléfono secundario" value={plantel.telefono2} />
              <Dato label="Sitio web" value={plantel.sitio_web} />
            </div>
          </div>

          <div className="card">
            <div className="ch"><h3>Datos referenciales</h3></div>
            <div className="cb form-grid">
              <Dato label="Estudiantes (referencial)" value={plantel.num_estudiantes_ref} />
              <Dato label="Docentes (referencial)" value={plantel.num_docentes_ref} />
            </div>
          </div>
        </div>
      </div>

      {modalOpen && form && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <form className="modal wide" onSubmit={guardar} style={{ maxWidth: 860 }}>
            <div className="modal-h">
              <h3>Editar perfil del plantel</h3>
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
                      <input type="checkbox" checked={form.jornadas.includes(j)} onChange={() => toggleMulti('jornadas', j)} />{j}
                    </label>
                  ))}
                  <div style={{ marginTop: 12, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Modalidad de estudio</div>
                  {MODALIDADES_OPTS.map(m => (
                    <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', cursor: 'pointer', fontSize: 13 }}>
                      <input type="checkbox" checked={form.modalidades.includes(m)} onChange={() => toggleMulti('modalidades', m)} />{m}
                    </label>
                  ))}
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)', marginBottom: 10 }}>General</div>
                  <div className="form-grid">
                    <div className="full">
                      <label className="fl">Nombre del plantel</label>
                      <input className="fc" value={form.nombre} onChange={e => campo('nombre', e.target.value)} required />
                    </div>
                    <div className="full">
                      <label className="fl">Eslogan</label>
                      <input className="fc" value={form.slogan || ''} onChange={e => campo('slogan', e.target.value)} />
                    </div>
                    <div>
                      <label className="fl">Nivel educativo</label>
                      <input className="fc" value={form.nivel_educativo || ''} onChange={e => campo('nivel_educativo', e.target.value)} placeholder="EGB / Bachillerato" />
                    </div>
                    <div>
                      <label className="fl">Régimen</label>
                      <select className="fc" value={form.regimen || ''} onChange={e => campo('regimen', e.target.value)}>
                        <option value="Sierra">Sierra</option><option value="Costa">Costa</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)', margin: '16px 0 10px' }}>Ubicación</div>
                  <div className="form-grid">
                    <div><label className="fl">Provincia</label><input className="fc" value={form.provincia || ''} onChange={e => campo('provincia', e.target.value)} /></div>
                    <div><label className="fl">Cantón</label><input className="fc" value={form.canton || ''} onChange={e => campo('canton', e.target.value)} /></div>
                    <div><label className="fl">Parroquia</label><input className="fc" value={form.parroquia || ''} onChange={e => campo('parroquia', e.target.value)} /></div>
                    <div className="full"><label className="fl">Dirección</label><input className="fc" value={form.direccion || ''} onChange={e => campo('direccion', e.target.value)} /></div>
                    <div><label className="fl">Distrito</label><input className="fc" value={form.distrito_nombre || ''} onChange={e => campo('distrito_nombre', e.target.value)} /></div>
                    <div><label className="fl">Circuito</label><input className="fc" value={form.circuito || ''} onChange={e => campo('circuito', e.target.value)} /></div>
                    <div><label className="fl">Zona</label><input className="fc" value={form.zona || ''} onChange={e => campo('zona', e.target.value)} /></div>
                  </div>

                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)', margin: '16px 0 10px' }}>Contacto</div>
                  <div className="form-grid">
                    <div><label className="fl">Teléfono principal</label><input className="fc" value={form.telefono || ''} onChange={e => campo('telefono', e.target.value)} placeholder="07-XXXXXXX" /></div>
                    <div><label className="fl">Teléfono secundario</label><input className="fc" value={form.telefono2 || ''} onChange={e => campo('telefono2', e.target.value)} placeholder="09XXXXXXXX" /></div>
                    <div><label className="fl">Sitio web</label><input className="fc" value={form.sitio_web || ''} onChange={e => campo('sitio_web', e.target.value)} /></div>
                  </div>

                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)', margin: '16px 0 10px' }}>Autoridad del plantel</div>
                  <div className="form-grid">
                    <div className="full"><label className="fl">Rector / Director</label><input className="fc" value={form.rector || ''} onChange={e => campo('rector', e.target.value)} placeholder="Nombre completo con título" /></div>
                  </div>

                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)', margin: '16px 0 10px' }}>Datos referenciales</div>
                  <div className="form-grid">
                    <div><label className="fl">Estudiantes (referencial)</label><input className="fc" type="number" min="0" value={form.num_estudiantes_ref} onChange={e => campo('num_estudiantes_ref', e.target.value)} /></div>
                    <div><label className="fl">Docentes (referencial)</label><input className="fc" type="number" min="0" value={form.num_docentes_ref} onChange={e => campo('num_docentes_ref', e.target.value)} /></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-f">
              <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
            </div>
          </form>
        </div>
      )}

      {toast && <div className={'toast ' + (toast.tipo === 'ok' ? 'ok' : 'err')}>{toast.msg}</div>}
    </div>
  );
}
