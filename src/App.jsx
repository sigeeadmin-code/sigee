import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SessionProvider, useSession } from './lib/SessionContext.jsx';
import Login from './pages/Login.jsx';
import Shell from './pages/Shell.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Planteles from './pages/Planteles.jsx';
import Academico from './pages/Academico.jsx';
import RolesPermisos from './pages/RolesPermisos.jsx';
import Diagnostico from './pages/Diagnostico.jsx';
import Docentes from './pages/Docentes.jsx';
import Estudiantes from './pages/Estudiantes.jsx';
import Usuarios from './pages/Usuarios.jsx';
import Tareas from './pages/Tareas.jsx';
import Asistencia from './pages/Asistencia.jsx';
import Calificaciones from './pages/Calificaciones.jsx';
import Aulas from './pages/Aulas.jsx';
import Horario from './pages/Horario.jsx';
import Notificaciones from './pages/Notificaciones.jsx';
import MiPlantel from './pages/MiPlantel.jsx';
import Configuracion from './pages/Configuracion.jsx';
import Calendario from './pages/Calendario.jsx';
import Justificaciones from './pages/Justificaciones.jsx';
import Inasistencias from './pages/Inasistencias.jsx';
import Placeholder from './pages/Placeholder.jsx';
function Gate() {
  const { loading, profile } = useSession();
  if (loading) return <div className="splash">Cargando SIGEE…</div>;
  if (!profile) return <Login />;
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/instituciones" element={<Planteles />} />
        <Route path="/roles-permisos" element={<RolesPermisos />} />
        <Route path="/diagnostico" element={<Diagnostico />} />
        <Route path="/docentes" element={<Docentes />} />
        <Route path="/academico" element={<Academico />} />
        <Route path="/estudiantes" element={<Estudiantes />} />
        <Route path="/usuarios" element={<Usuarios />} />
        <Route path="/financiero" element={<Placeholder title="Financiero" />} />
        <Route path="/configuracion" element={<Configuracion />} />
        <Route path="/mi-plantel" element={<MiPlantel />} />
        <Route path="/tareas" element={<Tareas />} />
        <Route path="/asistencia" element={<Asistencia />} />
        <Route path="/inasistencias" element={<Inasistencias />} />
        <Route path="/justificaciones" element={<Justificaciones />} />
        <Route path="/calendario" element={<Calendario />} />
        <Route path="/aulas" element={<Aulas />} />
        <Route path="/horario" element={<Horario />} />
        <Route path="/calificaciones" element={<Calificaciones />} />
        <Route path="/notificaciones" element={<Notificaciones title="Notificaciones" />} />
        <Route path="/anuncios" element={<Notificaciones title="Anuncios" />} />
        <Route path="/comunicados" element={<Notificaciones title="Comunicados" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
export default function App() {
  return (
    <SessionProvider>
      <Gate />
    </SessionProvider>
  );
}
