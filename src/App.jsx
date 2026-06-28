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
import Calificaciones from './pages/Calificaciones'
import Asistencia from './pages/Asistencia'
import Horarios from './pages/Horarios'
import Reportes from './pages/Reportes'
import ModuloEnConstruccion from './pages/ModuloEnConstruccion'

const T=['super_admin','admin_plantel','docente','alumno','padre']
const A=['super_admin','admin_plantel']
const D=['super_admin','admin_plantel','docente']
const S=['super_admin']
const M=({roles,titulo,icono,desc})=><ProtectedRoute roles={roles}><ModuloEnConstruccion titulo={titulo} icono={icono} descripcion={desc}/></ProtectedRoute>

export default function App(){
  return(
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login/>}/>
          <Route path="/sin-acceso" element={<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:14}}><i className="ti ti-lock" style={{fontSize:48,color:'#DC2626'}}/><div style={{fontSize:18,fontWeight:600}}>Sin acceso</div></div>}/>
          <Route path="/" element={<ProtectedRoute><Layout/></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace/>}/>
            <Route path="dashboard"      element={<ProtectedRoute roles={T}><Dashboard/></ProtectedRoute>}/>
            <Route path="planteles"      element={<ProtectedRoute roles={A}><Planteles/></ProtectedRoute>}/>
            <Route path="docentes"       element={<ProtectedRoute roles={A}><Docentes/></ProtectedRoute>}/>
            <Route path="periodos"       element={<ProtectedRoute roles={A}><Periodos/></ProtectedRoute>}/>
            <Route path="cursos"         element={<ProtectedRoute roles={D}><Cursos/></ProtectedRoute>}/>
            <Route path="materias"       element={<ProtectedRoute roles={D}><Materias/></ProtectedRoute>}/>
            <Route path="estudiantes"    element={<ProtectedRoute roles={D}><Estudiantes/></ProtectedRoute>}/>
            <Route path="matriculas"     element={<ProtectedRoute roles={A}><Matriculas/></ProtectedRoute>}/>
            <Route path="calificaciones" element={<ProtectedRoute roles={D}><Calificaciones/></ProtectedRoute>}/>
            <Route path="asistencia"     element={<ProtectedRoute roles={D}><Asistencia/></ProtectedRoute>}/>
            <Route path="horarios"       element={<ProtectedRoute roles={T}><Horarios/></ProtectedRoute>}/>
            <Route path="reportes"       element={<ProtectedRoute roles={A}><Reportes/></ProtectedRoute>}/>
            <Route path="usuarios"       element={<ProtectedRoute roles={S}><Usuarios/></ProtectedRoute>}/>
            <Route path="perfil-docente" element={<M roles={D} titulo="Perfil Docente" icono="ti-id-badge" desc="Títulos, especialidades y méritos."/>}/>
            <Route path="configuracion"  element={<M roles={S} titulo="Configuración"  icono="ti-settings"  desc="Año lectivo, nota mínima, planteles."/>}/>
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace/>}/>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
