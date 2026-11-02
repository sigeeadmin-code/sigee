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
  const padre = reps.find(r => r.rol_representante === 'padre');
  const madre = reps.find(r => r.rol_representante === 'madre');
  const otros = reps.filter(r => r !== padre && r !== madre);
  const listaReps = [padre, madre, ...otros].filter(Boolean);
  // Contacto de emergencia: aún no se designa uno en la base; se toma el primero con teléfono (madre, padre u otro representante).
  const emergencia = [madre, padre, ...otros].find(r => r && soloDigitos(r.telefono)) || null;
  const iniciales = `${(ficha?.nombres || '?')[0]}${(ficha?.apellidos || '')[0] || ''}`;
  const actualizado = ficha?.updated_at ? new Date(ficha.updated_at).toLocaleString('es-EC', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Guayaquil' }) : '';
  const usuario = !esPadre && profile.email ? profile.email : '';

  const Fila = ({ icono, etiqueta, valor }) => (
    <div className="fam-fila">
      <span className="ico"><span className={`ti ${icono}`} /></span>
      <span className="et">{etiqueta}</span>
      <span className={'va' + (valor ? '' : ' vacio')}>{valor || 'No registrado'}</span>
    </div>
  );

  return (
    <div>
      {esPadre && hijos.length > 1 && (
        <div style={{ marginBottom: 12 }}>
          <select className="fc" style={{ maxWidth: 320 }} value={estudianteId || ''} onChange={e => setEstudianteId(e.target.value)}>
            {hijos.map(h => <option key={h.id} value={h.id}>{h.nombre}</option>)}
          </select>
        </div>
      )}

      {error && <div className="card"><div className="cb" style={{ color: 'var(--redD)' }}>{error}</div></div>}
      {cargando && !error && <div className="card"><div className="cb muted">Cargando…</div></div>}
      {!cargando && !error && !ficha && (
        <div className="card"><div className="cb muted">{esPadre ? 'Aún no tienes estudiantes vinculados a tu cuenta.' : 'Tu cuenta todavía no está enlazada a una ficha de estudiante. Pide a secretaría que la vincule.'}</div></div>
      )}

      {ficha && (
        <>
          <div className="fam-cab">
            {ficha.foto_url ? <img className="fam-foto" src={ficha.foto_url} alt="" /> : <div className="fam-foto">{iniciales}</div>}
            <div style={{ minWidth: 0 }}>
              <h2 className="fam-nombre">{nombreCompleto}</h2>
              <div className="fam-chips">
                {usuario && <span className="fam-chip"><span className="ti ti-user" />{usuario}</span>}
                {ficha.cedula && <span className="fam-chip"><span className="ti ti-id" />Cédula <strong>{ficha.cedula}</strong></span>}
                {curso && <span className="fam-chip"><span className="ti ti-school" />{curso}</span>}
                {ficha.activo === false && <span className="fam-chip">Inactivo</span>}
              </div>
            </div>
            <span className="fam-lectura"><span className="ti ti-lock" /> Solo lectura</span>
          </div>

          <div className="fam-grid">
            <div className="fam-tarj">
              <h3><span className="ti ti-user" /> Datos personales</h3>
              <Fila icono="ti-id" etiqueta="Número de documento" valor={ficha.cedula} />
              <Fila icono="ti-file-description" etiqueta="Tipo de documento" valor={ficha.tipo_documento} />
              <Fila icono="ti-map-pin" etiqueta="Provincia / cantón" valor={[ficha.provincia, ficha.canton].filter(Boolean).join(' / ')} />
              <Fila icono="ti-calendar" etiqueta="Fecha de nacimiento" valor={ficha.fecha_nacimiento && fmtFecha(ficha.fecha_nacimiento)} />
              <Fila icono="ti-cake" etiqueta="Edad" valor={anios != null ? `${anios} años` : ''} />
              <Fila icono="ti-gender-bigender" etiqueta="Género" valor={ficha.genero} />
              <Fila icono="ti-users" etiqueta="Etnia" valor={ficha.etnia} />
              <Fila icono="ti-phone" etiqueta="Teléfono" valor={ficha.telefono} />
              <Fila icono="ti-mail" etiqueta="Correo" valor={ficha.email} />
            </div>

            <div className="fam-tarj">
              <h3><span className="ti ti-users-group" /> Datos familiares</h3>
              {!listaReps.length && <div className="muted">No hay representantes registrados.</div>}
              {listaReps.map(r => (
                <div className="fam-rep" key={r.id}>
                  <span className={'ava ' + (r.rol_representante === 'madre' ? 'madre' : '')}>
                    <span className={'ti ' + (r.rol_representante === 'madre' ? 'ti-gender-female' : 'ti-gender-male')} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div className="rol">{ROL_REP[r.rol_representante] || 'Representante'}</div>
                    <div className="nom">{`${r.nombres || ''} ${r.apellidos || ''}`.trim()}</div>
                    <div className="dat"><span className="ti ti-phone" />{r.telefono || 'Sin teléfono'}</div>
                    <div className="dat"><span className="ti ti-mail" />{r.email || 'Sin correo'}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="fam-tarj fam-emerg">
              <h3><span className="ti ti-user-exclamation" /> Representante de emergencia</h3>
              {!emergencia ? <div className="muted">Ningún representante tiene teléfono registrado.</div> : (
                <>
                  <div className="et2">Nombre</div>
                  <div className="v2">{`${emergencia.nombres || ''} ${emergencia.apellidos || ''}`.trim()}</div>
                  <div className="et2">Relación</div>
                  <div className="v2">{ROL_REP[emergencia.rol_representante] || 'Representante'}</div>
                  <div className="et2">Teléfono</div>
                  <div className="tel">{emergencia.telefono}</div>
                  <a className="fam-llamar" href={`tel:${soloDigitos(emergencia.telefono)}`}><span className="ti ti-phone" /> Llamar</a>
                  {ficha.direccion && (<><div className="et2" style={{ borderTop: '1px solid var(--redXL)', paddingTop: 10 }}>Dirección</div><div>{ficha.direccion}</div></>)}
                </>
              )}
            </div>
          </div>

          <div className="fam-pie">
            <span><span className="ti ti-calendar" />Última actualización: {actualizado || '—'}</span>
            <span><span className="ti ti-info-circle" />Solo lectura: esta información no puede ser modificada aquí. Si algo está incorrecto, avisa al tutor o a secretaría.</span>
          </div>
        </>
      )}
    </div>
  );
}
