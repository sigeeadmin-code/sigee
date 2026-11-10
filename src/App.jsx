import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { SessionProvider, useSession } from './lib/SessionContext.jsx';
import { rolesConAcceso, rutaPermitidaParaRolDb } from './lib/nav.js';
import AvisoVersionNueva from './components/AvisoVersionNueva.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import Login from './pages/Login.jsx';
import RestablecerClave from './pages/RestablecerClave.jsx';
import Shell from './pages/Shell.jsx';
import Dashboard from './pages/Dashboard.jsx';
function cargar(importar) {
  return React.lazy(() =>
    importar().catch((err) => {
      const clave = 'sigee:recarga-chunk';
      try {
        if (!sessionStorage.getItem(clave)) {
          sessionStorage.setItem(clave, '1');
          window.location.reload();
          return new Promise(() => {});
        }
        sessionStorage.removeItem(clave);
      } catch { /* sin sessionStorage */ }
      throw err;
    })
  );
}
const Planteles = cargar(() => import('./pages/Planteles.jsx'));
const Academico = cargar(() => import('./pages/Academico.jsx'));
const RolesPermisos = cargar(() => import('./pages/RolesPermisos.jsx'));
const Diagnostico = cargar(() => import('./pages/Diagnostico.jsx'));
const SoporteTIC = cargar(() => import('./pages/SoporteTIC.jsx'));
const Docentes = cargar(() => import('./pages/Docentes.jsx'));
const Estudiantes = cargar(() => import('./pages/Estudiantes.jsx'));
const Usuarios = cargar(() => import('./pages/Usuarios.jsx'));
const Tareas = cargar(() => import('./pages/Tareas.jsx'));
const Asistencia = cargar(() => import('./pages/Asistencia.jsx'));
const ReportesAsistencia = cargar(() => import('./pages/ReportesAsistencia.jsx'));
const Calificaciones = cargar(() => import('./pages/Calificaciones.jsx'));
const Aulas = cargar(() => import('./pages/Aulas.jsx'));
const Horario = cargar(() => import('./pages/Horario.jsx'));
const Notificaciones = cargar(() => import('./pages/Notificaciones.jsx'));
const MiPlantel = cargar(() => import('./pages/MiPlantel.jsx'));
const Configuracion = cargar(() => import('./pages/Configuracion.jsx'));
const Calendario = cargar(() => import('./pages/Calendario.jsx'));
const Justificaciones = cargar(() => import('./pages/Justificaciones.jsx'));
const MiAsistencia = cargar(() => import('./pages/MiAsistencia.jsx'));
const Boletas = cargar(() => import('./pages/Boletas.jsx'));
const ModulosPlantel = cargar(() => import('./pages/ModulosPlantel.jsx'));
const BaseDocentesPlantel = cargar(() => import('./pages/BaseDocentesPlantel.jsx'));
const MiPerfil = cargar(() => import('./pages/MiPerfil.jsx'));
const MiPerfilFamilia = cargar(() => import('./pages/MiPerfilFamilia.jsx'));
const MisEstudiantes = cargar(() => import('./pages/MisEstudiantes.jsx'));
const Encadenamiento = cargar(() => import('./pages/Encadenamiento.jsx'));
const Licencias = cargar(() => import('./pages/Licencias.jsx'));
const Inasistencias = cargar(() => import('./pages/Inasistencias.jsx'));
const PromocionMatriculas = cargar(() => import('./pages/PromocionMatriculas.jsx'));
const ReportesMatriculas = cargar(() => import('./pages/ReportesMatriculas.jsx'));
const Egresados = cargar(() => import('./pages/Egresados.jsx'));
const BasesCentrales = cargar(() => import('./pages/BasesCentrales.jsx'));
const ContenidoSitio = cargar(() => import('./pages/ContenidoSitio.jsx'));
const Financiero = cargar(() => import('./pages/Financiero.jsx'));
const AnalisisAsistencia = cargar(() => import('./pages/AnalisisAsistencia.jsx'));
const AnalisisCalificaciones = cargar(() => import('./pages/AnalisisCalificaciones.jsx'));
const CursoTutor = cargar(() => import('./pages/CursoTutor.jsx'));
const EstadisticasAMIE = cargar(() => import('./pages/EstadisticasAMIE.jsx'));
const OficiosDocumental = cargar(() => import('./pages/OficiosDocumental.jsx'));
const InformesDece = cargar(() => import('./pages/InformesDece.jsx'));
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

function Protegida({ path, children }) {
  const { profile } = useSession();
  const permitido = rolesConAcceso(path).includes(profile.rol) && rutaPermitidaParaRolDb(path, profile.rol, profile.rolDb);
  return permitido ? children : <AccesoDenegado />;
}

function BaseDocentesRuta() {
  const { profile } = useSession();
  return profile.rolDb === 'super_admin' ? <BasesCentrales clave="base-docentes" /> : <BaseDocentesPlantel />;
}

function Gate() {
  const { loading, profile, recuperando } = useSession();
  const { pathname } = useLocation();
  if (recuperando) return <RestablecerClave />;
  if (loading) return <div className="splash">Cargando SIGEE…</div>;
  if (!profile) return <Login />;
  return (
    <ErrorBoundary reinicio={pathname}>
    <Routes>
      <Route element={<Shell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/instituciones" element={<Protegida path="/instituciones"><Planteles /></Protegida>} />
        <Route path="/roles-permisos" element={<Protegida path="/roles-permisos"><RolesPermisos /></Protegida>} />
        <Route path="/diagnostico" element={<Protegida path="/diagnostico"><Diagnostico /></Protegida>} />
        <Route path="/soporte-tic" element={<Protegida path="/soporte-tic"><SoporteTIC /></Protegida>} />
        <Route path="/docentes" element={<Protegida path="/docentes"><Docentes /></Protegida>} />
        <Route path="/academico" element={<Protegida path="/academico"><Academico /></Protegida>} />
        <Route path="/estudiantes" element={<Protegida path="/estudiantes"><Estudiantes /></Protegida>} />
        <Route path="/encadenamiento" element={<Protegida path="/encadenamiento"><Encadenamiento /></Protegida>} />
        <Route path="/licencias" element={<Protegida path="/licencias"><Licencias /></Protegida>} />
        <Route path="/matriculas" element={<Protegida path="/matriculas"><PromocionMatriculas /></Protegida>} />
        <Route path="/reportes-matriculas" element={<Protegida path="/reportes-matriculas"><ReportesMatriculas /></Protegida>} />
        <Route path="/egresados" element={<Protegida path="/egresados"><Egresados /></Protegida>} />
        <Route path="/docentes-desvinculados" element={<BasesCentrales clave="docentes-desvinculados" />} />
        <Route path="/base-docentes" element={<BaseDocentesRuta />} />
        <Route path="/estudiantes-desvinculados" element={<BasesCentrales clave="estudiantes-desvinculados" />} />
        <Route path="/base-estudiantes" element={<BasesCentrales clave="base-estudiantes" />} />
        <Route path="/contenido-sitio" element={<ContenidoSitio />} />
        <Route path="/usuarios" element={<Protegida path="/usuarios"><Usuarios /></Protegida>} />
        <Route path="/financiero" element={<Protegida path="/financiero"><FinancieroRuta /></Protegida>} />
        <Route path="/configuracion" element={<Configuracion />} />
        <Route path="/mi-plantel" element={<Protegida path="/mi-plantel"><MiPlantel /></Protegida>} />
        <Route path="/tareas" element={<Protegida path="/tareas"><Tareas /></Protegida>} />
        <Route path="/asistencia" element={<Protegida path="/asistencia"><Asistencia /></Protegida>} />
        <Route path="/analisis-asistencia" element={<Protegida path="/analisis-asistencia"><AnalisisAsistencia /></Protegida>} />
        <Route path="/analisis-calificaciones" element={<Protegida path="/analisis-calificaciones"><AnalisisCalificaciones /></Protegida>} />
        <Route path="/curso-tutor" element={<Protegida path="/curso-tutor"><CursoTutor /></Protegida>} />
        <Route path="/reportes-asistencia" element={<Protegida path="/reportes-asistencia"><ReportesAsistencia /></Protegida>} />
        <Route path="/inasistencias" element={<Protegida path="/inasistencias"><Inasistencias /></Protegida>} />
        <Route path="/oficios" element={<Protegida path="/oficios"><OficiosDocumental /></Protegida>} />
        <Route path="/informes-dece" element={<Protegida path="/informes-dece"><InformesDece /></Protegida>} />
        <Route path="/modulos-plantel" element={<Protegida path="/modulos-plantel"><ModulosPlantel /></Protegida>} />
        <Route path="/mi-perfil" element={<Protegida path="/mi-perfil"><MiPerfil /></Protegida>} />
        <Route path="/mi-ficha" element={<Protegida path="/mi-ficha"><MiPerfilFamilia /></Protegida>} />
        <Route path="/mis-estudiantes" element={<Protegida path="/mis-estudiantes"><MisEstudiantes /></Protegida>} />
        <Route path="/boletas" element={<Protegida path="/boletas"><Boletas /></Protegida>} />
        <Route path="/mi-asistencia" element={<Protegida path="/mi-asistencia"><MiAsistencia /></Protegida>} />
        <Route path="/justificaciones" element={<Protegida path="/justificaciones"><Justificaciones /></Protegida>} />
        <Route path="/calendario" element={<Protegida path="/calendario"><Calendario /></Protegida>} />
        <Route path="/aulas" element={<Protegida path="/aulas"><Aulas /></Protegida>} />
        <Route path="/horario" element={<Protegida path="/horario"><Horario /></Protegida>} />
        <Route path="/estadisticas-amie" element={<Protegida path="/estadisticas-amie"><EstadisticasAMIE /></Protegida>} />
        <Route path="/calificaciones" element={<Protegida path="/calificaciones"><Calificaciones /></Protegida>} />
        <Route path="/notificaciones" element={<Protegida path="/notificaciones"><Notificaciones title="Notificaciones" /></Protegida>} />
        <Route path="/anuncios" element={<Protegida path="/anuncios"><Notificaciones title="Anuncios" /></Protegida>} />
        <Route path="/comunicados" element={<Protegida path="/comunicados"><Notificaciones title="Comunicados" /></Protegida>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </ErrorBoundary>
  );
}
export default function App() {
  return (
    <SessionProvider>
      <AvisoVersionNueva />
      <Gate />
    </SessionProvider>
  );
}

function FinancieroRuta() {
  const { profile } = useSession();
  return profile.rolDb === 'super_admin' ? <Financiero /> : <Placeholder title="Financiero" />;
}
