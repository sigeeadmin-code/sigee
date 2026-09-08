import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://pvwsdohhydeqmruopkfc.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2d3Nkb2hoeWRlcW1ydW9wa2ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1ODIzNzIsImV4cCI6MjEwMDE1ODM3Mn0.TnW21vrL73WfdEz2TwHnTs7gD-HQUsaJwagp9a_G850';
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const ROLE_GROUP = {
  super_admin: 'super_admin',
  admin_plantel: 'admin_plantel',
  secretario: 'secretario',
  supervisor_general: 'admin_plantel',
  contador_general: 'admin_plantel',
  supervisor_plantel: 'admin_plantel',
  contador_plantel: 'secretario',
  administrativo: 'secretario',
  inspector_general: 'inspector',
  docente: 'docente',
  estudiante: 'alumno',
  padre: 'padre'
};
export const ROLE_LABELS = {
  super_admin: 'Super Admin Global',
  admin_plantel: 'Administrador de Plantel',
  secretario: 'Secretario/a',
  inspector: 'Inspector General',
  docente: 'Docente',
  alumno: 'Estudiante',
  padre: 'Padre / Madre'
};
