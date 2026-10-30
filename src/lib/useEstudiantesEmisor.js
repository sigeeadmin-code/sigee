import { useEffect, useState } from 'react';
import { fetchDocenteIdDePerfil, fetchCursosComoTutor, fetchAsistenciaParalelos } from './data.js';

/**
 * Estudiantes que el usuario puede citar en un documento:
 *  · docente → solo los de los cursos donde es tutor (mismo criterio que Justificaciones);
 *  · resto del personal → todos los del plantel (data.estudiantes de la sesión).
 * Devuelve [{ id, nombre, cedula, curso, paralelo }].
 */
export function useEstudiantesEmisor({ profile, institucionId, estudiantesPlantel }) {
  const [propios, setPropios] = useState(null);

  useEffect(() => {
    let vivo = true;
    if (profile?.rolDb !== 'docente' || !institucionId) { setPropios(null); return undefined; }
    (async () => {
      try {
        const did = await fetchDocenteIdDePerfil(profile.id);
        const cursos = did ? await fetchCursosComoTutor(did) : [];
        const hoy = new Date().toISOString().slice(0, 10);
        const d = cursos.length ? await fetchAsistenciaParalelos(institucionId, cursos.map(c => c.id), hoy, hoy) : { alumnos: [] };
        if (vivo) setPropios((d.alumnos || []).map(a => ({
          id: a.id, nombre: a.nombre || `${a.apellidos || ''} ${a.nombres || ''}`.trim(), cedula: a.cedula || '', curso: a.curso || '', paralelo: ''
        })));
      } catch { if (vivo) setPropios([]); }
    })();
    return () => { vivo = false; };
  }, [profile?.id, profile?.rolDb, institucionId]);

  if (propios) return propios;
  if (profile?.rolDb === 'docente') return [];       // mientras carga, no se muestra a nadie
  return (estudiantesPlantel || []).map(e => ({
    id: e.id, nombre: e.nombre || `${e.apellidos || ''} ${e.nombres || ''}`.trim(), cedula: e.cedula || '',
    curso: e.curso && e.curso !== '—' ? e.curso : '', paralelo: e.paralelo || ''
  }));
}
