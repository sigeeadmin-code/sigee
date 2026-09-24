import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SessionProvider, useSession } from './lib/SessionContext.jsx';
import { rolesConAcceso } from './lib/nav.js';
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
import ReportesAsistencia from './pages/ReportesAsistencia.jsx';
import Calificaciones from './pages/Calificaciones.jsx';
import Aulas from './pages/Aulas.jsx';
import Horario from './pages/Horario.jsx';
import Notificaciones from './pages/Notificaciones.jsx';
import MiPlantel from './pages/MiPlantel.jsx';
import Configuracion from './pages/Configuracion.jsx';
import Calendario from './pages/Calendario.jsx';
import Justificaciones from './pages/Justificaciones.jsx';
import Inasistencias from './pages/Inasistencias.jsx';
import PromocionMatriculas from './pages/PromocionMatriculas.jsx';
import ReportesMatriculas from './pages/ReportesMatriculas.jsx';
import Egresados from './pages/Egresados.jsx';
import Placeholder from './pages/Placeholder.jsx';
function AccesoDenegado() {
  return (
    <div className="empty" style={{ padding: '60px 20px' }}>
      <span className="ti ti-lock" style={{ fontSize: 32 }} />
      <h3 style={{ margin: '12px 0 6px' }}>No tienes acceso a esta sección</h3>
      <p style={{ color: 'var(--slate)', marginBottom: 16 }}>Tu rol actual no está autorizado para ver esta página.</p>
      <a href="/" className="btn btn-primary">Volver al Dashboard</a>
    </div>
  );
}

/**
 * Guardián de rutas: valida el rol real del usuario contra el mismo NAV_BY_ROL
 * que arma el menú lateral, para que ocultar un link en el sidebar y bloquear
 * la URL directa sean siempre la misma regla (nunca se desincronizan).
 */
function Protegida({ path, children }) {
  const { profile } = useSession();
  // profile.rol es el rol AGRUPADO (mismo que usa Shell.jsx para armar el menú);
  // profile.rolDb es el crudo de la BD. Deben compararse contra el mismo tipo
  // que las claves de NAV_BY_ROL (agrupado), o el guardián bloquea a roles
  // que sí deberían entrar (pasó con inspector_general, estudiante, etc).
  const permitido = rolesConAcceso(path).includes(profile.rol);
  return permitido ? children : <AccesoDenegado />;
}

function Gate() {
  const { loading, profile } = useSession();
  if (loading) return <div className="splash">Cargando SIGEE…</div>;
  if (!profile) return <Login />;
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/instituciones" element={<Protegida path="/instituciones"><Planteles /></Protegida>} />
        <Route path="/roles-permisos" element={<Protegida path="/roles-permisos"><RolesPermisos /></Protegida>} />
        <Route path="/diagnostico" element={<Protegida path="/diagnostico"><Diagnostico /></Protegida>} />
        <Route path="/docentes" element={<Protegida path="/docentes"><Docentes /></Protegida>} />
        <Route path="/academico" element={<Protegida path="/academico"><Academico /></Protegida>} />
        <Route path="/estudiantes" element={<Protegida path="/estudiantes"><Estudiantes /></Protegida>} />
        <Route path="/matriculas" element={<Protegida path="/matriculas"><PromocionMatriculas /></Protegida>} />
        <Route path="/reportes-matriculas" element={<Protegida path="/reportes-matriculas"><ReportesMatriculas /></Protegida>} />
        <Route path="/egresados" element={<Protegida path="/egresados"><Egresados /></Protegida>} />
        <Route path="/usuarios" element={<Protegida path="/usuarios"><Usuarios /></Protegida>} />
        <Route path="/financiero" element={<Protegida path="/financiero"><Placeholder title="Financiero" /></Protegida>} />
        <Route path="/configuracion" element={<Configuracion />} />
        <Route path="/mi-plantel" element={<Protegida path="/mi-plantel"><MiPlantel /></Protegida>} />
        <Route path="/tareas" element={<Protegida path="/tareas"><Tareas /></Protegida>} />
        <Route path="/asistencia" element={<Protegida path="/asistencia"><Asistencia /></Protegida>} />
        <Route path="/reportes-asistencia" element={<Protegida path="/reportes-asistencia"><ReportesAsistencia /></Protegida>} />
        <Route path="/inasistencias" element={<Protegida path="/inasistencias"><Inasistencias /></Protegida>} />
        <Route path="/justificaciones" element={<Protegida path="/justificaciones"><Justificaciones /></Protegida>} />
        <Route path="/calendario" element={<Protegida path="/calendario"><Calendario /></Protegida>} />
        <Route path="/aulas" element={<Protegida path="/aulas"><Aulas /></Protegida>} />
        <Route path="/horario" element={<Protegida path="/horario"><Horario /></Protegida>} />
        <Route path="/calificaciones" element={<Protegida path="/calificaciones"><Calificaciones /></Protegida>} />
        <Route path="/notificaciones" element={<Protegida path="/notificaciones"><Notificaciones title="Notificaciones" /></Protegida>} />
        <Route path="/anuncios" element={<Protegida path="/anuncios"><Notificaciones title="Anuncios" /></Protegida>} />
        <Route path="/comunicados" element={<Protegida path="/comunicados"><Notificaciones title="Comunicados" /></Protegida>} />
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
