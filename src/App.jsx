import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Planteles from './pages/Planteles'
import Docentes from './pages/Docentes'
import Usuarios from './pages/Usuarios'
import Periodos from './pages/Periodos'
import Cursos from './pages/Cursos'
import Materias from './pages/Materias'
import Estudiantes from './pages/Estudiantes'
import Matriculas from './pages/Matriculas'
import ModuloEnConstruccion from './pages/ModuloEnConstruccion'

const TODOS  = ['super_admin','admin_plantel','docente','alumno','padre']
const ADMIN  = ['super_admin','admin_plantel']
const DOC_UP = ['super_admin','admin_plantel','docente']
const SUPER  = ['super_admin']

const Modulo = ({roles,titulo,icono,desc}) =>
  <ProtectedRoute roles={roles}><ModuloEnConstruccion titulo={titulo} icono={icono} descripcion={desc}/></ProtectedRoute>

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login/>}/>
          <Route path="/sin-acceso" element={
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:14}}>
              <i className="ti ti-lock" style={{fontSize:48,color:'#DC2626'}}/>
              <div style={{fontSize:18,fontWeight:600}}>Sin acceso</div>
              <div style={{fontSize:13,color:'#9CA3AF'}}>No tienes permisos para esta sección</div>
            </div>
          }/>
          <Route path="/" element={<ProtectedRoute><Layout/></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace/>}/>
            <Route path="dashboard"      element={<ProtectedRoute roles={TODOS}  ><Dashboard/></ProtectedRoute>}/>
            <Route path="planteles"      element={<ProtectedRoute roles={ADMIN}  ><Planteles/></ProtectedRoute>}/>
            <Route path="docentes"       element={<ProtectedRoute roles={ADMIN}  ><Docentes/></ProtectedRoute>}/>
            <Route path="periodos"       element={<ProtectedRoute roles={ADMIN}  ><Periodos/></ProtectedRoute>}/>
            <Route path="cursos"         element={<ProtectedRoute roles={DOC_UP} ><Cursos/></ProtectedRoute>}/>
            <Route path="materias"       element={<ProtectedRoute roles={DOC_UP} ><Materias/></ProtectedRoute>}/>
            <Route path="estudiantes"    element={<ProtectedRoute roles={DOC_UP} ><Estudiantes/></ProtectedRoute>}/>
            <Route path="matriculas"     element={<ProtectedRoute roles={ADMIN}  ><Matriculas/></ProtectedRoute>}/>
            <Route path="usuarios"       element={<ProtectedRoute roles={SUPER}  ><Usuarios/></ProtectedRoute>}/>
            <Route path="perfil-docente" element={<Modulo roles={DOC_UP} titulo="Perfil del Docente"  icono="ti-id-badge"        desc="Títulos, especialidades y méritos. Tablas: docente_titulos, docente_especialidades, docente_meritos."/>}/>
            <Route path="calificaciones" element={<Modulo roles={DOC_UP} titulo="Calificaciones"      icono="ti-chart-line"      desc="Escala 0-10. Aprobado ≥ 7. Fórmula: (P1+P2+Examen)÷3."/>}/>
            <Route path="horarios"       element={<Modulo roles={TODOS}  titulo="Horarios"            icono="ti-calendar-time"   desc="Grilla semanal por curso. Tabla: horarios."/>}/>
            <Route path="asistencia"     element={<Modulo roles={DOC_UP} titulo="Asistencia"          icono="ti-checklist"       desc="Control diario con notificación WhatsApp."/>}/>
            <Route path="reportes"       element={<Modulo roles={ADMIN}  titulo="Reportes"            icono="ti-report"          desc="Planteles, docentes, calificaciones y asistencia en tiempo real."/>}/>
            <Route path="configuracion"  element={<Modulo roles={SUPER}  titulo="Configuración"       icono="ti-settings"        desc="Año lectivo, nota mínima, planteles activos."/>}/>
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace/>}/>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
