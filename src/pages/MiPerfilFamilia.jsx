import React, { useEffect, useState } from 'react';
import { useSession } from '../lib/SessionContext.jsx';
import { fetchHijosDeRepresentante, fetchEstudianteIdPorProfile, fetchEstudiantePerfil } from '../lib/data.js';
import { supabase } from '../lib/supabase.js';

const ROL_REP = { padre: 'Padre', madre: 'Madre', tutor: 'Representante', representante: 'Representante' };
const fmtFecha = f => (f ? new Date(f + 'T00:00:00').toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' }) : '');
const edad = f => {
  if (!f) return null;
  const n = new Date(f + 'T00:00:00'), h = new Date();
  let a = h.getFullYear() - n.getFullYear();
  if (h < new Date(h.getFullYear(), n.getMonth(), n.getDate())) a -= 1;
  return a >= 0 && a < 100 ? a : null;
};
const soloDigitos = t => String(t || '').replace(/[^\d+]/g, '');

function Dato({ etiqueta, valor }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="muted" style={{ fontSize: 12 }}>{etiqueta}</div>
      <div style={{ fontWeight: 600, wordBreak: 'break-word' }}>{valor || <span className="muted" style={{ fontWeight: 400 }}>No registrado</span>}</div>
    </div>
  );
}

// "Mi perfil" de ESTUDIANTE y REPRESENTANTE: solo lectura. El estudiante ve su ficha; el representante, la de cada hijo.
// La RLS de Supabase garantiza que solo se lean datos propios; aquí no se edita nada.
export default function MiPerfilFamilia() {
  const { profile, institucion } = useSession();
  const esPadre = profile.rolDb === 'padre';
  const [hijos, setHijos] = useState([]);
  const [estudianteId, setEstudianteId] = useState(null);
  const [ficha, setFicha] = useState(null);
  const [curso, setCurso] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        if (esPadre) {
          const h = await fetchHijosDeRepresentante(profile.id);
          if (!vivo) return;
          setHijos(h); setEstudianteId(h[0]?.id || null);
          if (!h.length) setCargando(false);
        } else {
          const id = await fetchEstudianteIdPorProfile(profile.id);
          if (!vivo) return;
          setEstudianteId(id);
          if (!id) setCargando(false);
        }
      } catch (e) { if (vivo) { setError(e.message || 'No se pudo cargar'); setCargando(false); } }
    })();
    return () => { vivo = false; };
  }, [esPadre, profile.id]);

  useEffect(() => {
    if (!estudianteId) return;
    let vivo = true;
    setCargando(true); setFicha(null); setCurso('');
    (async () => {
      try {
        const f = await fetchEstudiantePerfil(estudianteId);
        if (!vivo) return;
        setFicha(f);
        const m = f?.matricula;
        if (m?.paralelo_id) {
          const [{ data: p }, { data: g }] = await Promise.all([
            supabase.from('paralelos').select('nombre, especialidad').eq('id', m.paralelo_id).maybeSingle(),
            m.grado_id ? supabase.from('grados').select('nombre').eq('id', m.grado_id).maybeSingle() : Promise.resolve({ data: null })
          ]);
          if (vivo) setCurso([g?.nombre, p?.nombre && `Paralelo ${p.nombre}`, p?.especialidad].filter(Boolean).join(' · '));
        }
      } catch (e) { if (vivo) setError(e.message || 'No se pudo cargar'); }
      if (vivo) setCargando(false);
    })();
    return () => { vivo = false; };
  }, [estudianteId]);

  const nombreCompleto = ficha ? `${ficha.nombres || ''} ${ficha.apellidos || ''}`.trim() : '';
  const anios = ficha ? edad(ficha.fecha_nacimiento) : null;
  const reps = ficha?.representantes || [];
  const conTelefono = reps.filter(r => soloDigitos(r.telefono));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Mi perfil</h2>
          <p className="muted" style={{ margin: '2px 0 0' }}>
            {esPadre ? 'Ficha de tu representado' : 'Tus datos registrados'} · solo lectura. Si algo está incorrecto, avisa al tutor o a secretaría.
          </p>
        </div>
        {esPadre && hijos.length > 1 && (
          <select className="fc" value={estudianteId || ''} onChange={e => setEstudianteId(e.target.value)}>
            {hijos.map(h => <option key={h.id} value={h.id}>{h.nombre}</option>)}
          </select>
        )}
      </div>

      {error && <div className="card"><div className="cb" style={{ color: 'var(--red, #b91c1c)' }}>{error}</div></div>}
      {cargando && !error && <div className="card"><div className="cb muted">Cargando…</div></div>}
      {!cargando && !error && !ficha && (
        <div className="card"><div className="cb muted">{esPadre ? 'Aún no tienes estudiantes vinculados a tu cuenta.' : 'Tu cuenta todavía no está enlazada a una ficha de estudiante. Pide a secretaría que la vincule.'}</div></div>
      )}

      {ficha && (
        <>
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="cb" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              {ficha.foto_url
                ? <img src={ficha.foto_url} alt="" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover' }} />
                : <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--bg, #eef2f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 700 }}>{(ficha.nombres || '?')[0]}{(ficha.apellidos || '')[0]}</div>}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{nombreCompleto}</div>
                <div className="muted">{institucion?.nombre}</div>
                <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {curso && <span className="badge">{curso}</span>}
                  <span className="badge">{ficha.activo === false ? 'Inactivo' : 'Activo'}</span>
                  {ficha.matricula?.estado && <span className="badge">Matrícula: {ficha.matricula.estado}</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <div className="ch"><h3 style={{ margin: 0 }}>Datos personales</h3></div>
            <div className="cb" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
              <Dato etiqueta="Cédula / documento" valor={ficha.cedula} />
              <Dato etiqueta="Fecha de nacimiento" valor={ficha.fecha_nacimiento && `${fmtFecha(ficha.fecha_nacimiento)}${anios != null ? ` (${anios} años)` : ''}`} />
              <Dato etiqueta="Género" valor={ficha.genero} />
              <Dato etiqueta="Teléfono" valor={ficha.telefono} />
              <Dato etiqueta="Correo" valor={ficha.email} />
              <Dato etiqueta="Provincia / cantón" valor={[ficha.provincia, ficha.canton].filter(Boolean).join(' / ')} />
              <Dato etiqueta="Dirección" valor={ficha.direccion} />
              {ficha.etnia && <Dato etiqueta="Autoidentificación étnica" valor={ficha.etnia} />}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <div className="ch"><h3 style={{ margin: 0 }}>Padres de familia y representantes</h3></div>
            <div className="cb">
              {!reps.length && <div className="muted">No hay representantes registrados.</div>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                {reps.map(r => (
                  <div key={r.id} style={{ border: '1px solid var(--border, #e2e8f0)', borderRadius: 10, padding: 12 }}>
                    <span className="badge">{ROL_REP[r.rol_representante] || 'Representante'}</span>
                    <div style={{ fontWeight: 700, marginTop: 6 }}>{`${r.nombres || ''} ${r.apellidos || ''}`.trim()}</div>
                    <div className="muted" style={{ fontSize: 13 }}>Cédula: {r.cedula || 'No registrada'}</div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>{r.telefono || <span className="muted">Sin teléfono</span>}</div>
                    <div style={{ fontSize: 13, wordBreak: 'break-word' }}>{r.email || <span className="muted">Sin correo</span>}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="ch"><h3 style={{ margin: 0 }}>Contactos de emergencia</h3></div>
            <div className="cb">
              <p className="muted" style={{ marginTop: 0 }}>Teléfonos de los representantes registrados. Desde un celular, el botón abre la llamada.</p>
              {!conTelefono.length && <div className="muted">Ningún representante tiene teléfono registrado.</div>}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {conTelefono.map(r => (
                  <a key={r.id} className="btn btn-secondary" href={`tel:${soloDigitos(r.telefono)}`}>
                    📞 Llamar a {ROL_REP[r.rol_representante] || 'representante'} · {r.nombres} ({r.telefono})
                  </a>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
