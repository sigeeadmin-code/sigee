-- Nacionalidad del estudiante (para reportes estadísticos tipo AMIE / plantel)
-- Ejecutar en Supabase SQL editor si la columna aún no existe.

ALTER TABLE public.estudiantes
  ADD COLUMN IF NOT EXISTS nacionalidad text;

COMMENT ON COLUMN public.estudiantes.nacionalidad IS
  'Nacionalidad del estudiante (ej. Ecuatoriana, Colombiana, Peruana). Usada en reportes estadísticos del plantel y Zona 7.';

CREATE INDEX IF NOT EXISTS idx_estudiantes_nacionalidad
  ON public.estudiantes (institucion_id, nacionalidad)
  WHERE nacionalidad IS NOT NULL;
