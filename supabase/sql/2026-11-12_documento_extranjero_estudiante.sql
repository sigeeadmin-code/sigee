-- Documento / nacionalidad para estudiantes extranjeros
-- Ejecutar en Supabase si aún no existen las columnas.

ALTER TABLE public.estudiantes
  ADD COLUMN IF NOT EXISTS nacionalidad text;

ALTER TABLE public.estudiantes
  ADD COLUMN IF NOT EXISTS tipo_documento text DEFAULT 'cedula';

COMMENT ON COLUMN public.estudiantes.nacionalidad IS
  'Nacionalidad del estudiante. Si no es ecuatoriana y es extranjero, puede usarse código SIGEE.';

COMMENT ON COLUMN public.estudiantes.tipo_documento IS
  'cedula | pasaporte | codigo_sigee. codigo_sigee = identificador generado para extranjero sin cédula EC.';

-- Asegura que cedula acepte códigos alfanuméricos (EXT-...)
-- Si la columna era solo numérica en algún entorno, ampliar a text:
DO $$ BEGIN
  ALTER TABLE public.estudiantes ALTER COLUMN cedula TYPE text;
EXCEPTION WHEN others THEN NULL;
END $$;
