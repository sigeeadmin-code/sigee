# SIGEE — Sistema de Gestión Educativa Ecuatoriana

Sistema web completo para gestión educativa institucional. Construido con React + Vite + Supabase.

## 🚀 Despliegue en Vercel (paso a paso)

### 1. Subir a GitHub

```bash
# En tu computadora, crea una carpeta y sube el proyecto
git init
git add .
git commit -m "SIGEE v1.0 — Sistema de Gestión Educativa"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/sigee.git
git push -u origin main
```

### 2. Desplegar en Vercel

1. Ve a **https://vercel.com** → Sign in with GitHub
2. Clic en **"New Project"**
3. Importa el repositorio **sigee**
4. En **"Environment Variables"** agrega:
   - `VITE_SUPABASE_URL` = `https://ipmszlkhtrqlmyctygin.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwbXN6bGtodHJxbG15Y3R5Z2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NzQyNjIsImV4cCI6MjA5NjU1MDI2Mn0.bO7BcdriCbGEn0BUCpETdQo8daMvW2GeXLkUR02oELA`
5. Clic en **"Deploy"** — listo en ~2 minutos

### 3. Configurar Supabase Auth (IMPORTANTE)

1. Ve a tu proyecto Supabase → **Authentication → URL Configuration**
2. **Site URL**: `https://sigee-sistema.vercel.app`
3. **Redirect URLs**: agrega `https://sigee-sistema.vercel.app/**`
4. Guarda los cambios

### 4. Iniciar sesión

- **URL**: https://sigee-sistema.vercel.app
- **Email**: sigee.admin@gmail.com
- **Contraseña**: la que definiste al crear el usuario

Si no recuerdas la contraseña:
1. Supabase Dashboard → Authentication → Users
2. Busca `sigee.admin@gmail.com`
3. Clic en los 3 puntos → **Send password reset email**

## 🏗️ Desarrollo local

```bash
# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env
# Edita .env con tus credenciales si es necesario

# Iniciar servidor local
npm run dev
# Abre http://localhost:3000
```

## 📁 Estructura del proyecto

```
sigee/
├── src/
│   ├── lib/supabase.js        # Cliente Supabase centralizado
│   ├── hooks/useAuth.jsx      # Autenticación y roles
│   ├── components/
│   │   ├── Layout.jsx         # Layout con sidebar + topbar
│   │   ├── Sidebar.jsx        # Navegación por rol
│   │   ├── Topbar.jsx         # Barra superior
│   │   └── ProtectedRoute.jsx # Guard de rutas
│   ├── pages/
│   │   ├── Login.jsx          # Pantalla de acceso
│   │   ├── Dashboard.jsx      # Métricas en vivo
│   │   └── Modulos.jsx        # Planteles, Docentes + stubs
│   └── App.jsx                # Router completo
├── .env                       # Variables locales (no subir a git)
├── .env.example               # Plantilla de variables
└── vite.config.js
```

## 🔐 Roles del sistema

| Rol | Acceso |
|-----|--------|
| `super_admin` | Todo el sistema |
| `admin_plantel` | Su plantel + académico |
| `docente` | Sus cursos, calificaciones, asistencia |
| `alumno` | Sus notas y horarios |
| `padre` | Información de su representado |

## 🗄️ Base de datos

- **Proyecto**: ipmszlkhtrqlmyctygin
- **Región**: us-east-1
- **PostgreSQL**: 17.6
- **RLS**: habilitado en todas las tablas
- **Tablas**: 20 tablas con datos

## 🇪🇨 Sistema ecuatoriano

- Escala de calificaciones: 0–10
- Nota mínima de aprobación: 7.00
- Fórmula: (Parcial 1 + Parcial 2 + Examen) ÷ 3
- Períodos: 1er Quimestre, 2do Quimestre, Supletorio, Remedial, Gracia, Anual
- Referencia: Acuerdo Ministerial MINEDUC-ME-2021-00095-A
