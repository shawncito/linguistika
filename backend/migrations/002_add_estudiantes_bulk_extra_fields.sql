-- Agrega a estudiantes_bulk los campos que pide el formulario manual de Estudiantes
-- (para que la importación por Excel pueda guardar la misma información)

ALTER TABLE public.estudiantes_bulk
  ADD COLUMN IF NOT EXISTS email_encargado text,
  ADD COLUMN IF NOT EXISTS telefono_encargado text,
  ADD COLUMN IF NOT EXISTS grado text,
  ADD COLUMN IF NOT EXISTS dias text,
  ADD COLUMN IF NOT EXISTS dias_turno text;

CREATE INDEX IF NOT EXISTS idx_estudiantes_bulk_grado ON public.estudiantes_bulk(grado);
