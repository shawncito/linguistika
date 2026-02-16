-- 013_add_curso_metodo_and_encargado_nombre.sql

-- 1) Cursos: método (Virtual/Presencial)
ALTER TABLE IF EXISTS public.cursos
  ADD COLUMN IF NOT EXISTS metodo TEXT;

-- Solo permitir valores conocidos (o NULL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cursos_metodo_check'
  ) THEN
    ALTER TABLE public.cursos
      ADD CONSTRAINT cursos_metodo_check
      CHECK (metodo IS NULL OR metodo IN ('Virtual', 'Presencial'));
  END IF;
END $$;

-- 2) Estudiantes: nombre del encargado
ALTER TABLE IF EXISTS public.estudiantes
  ADD COLUMN IF NOT EXISTS nombre_encargado TEXT;

-- 3) Estudiantes bulk: nombre del encargado
ALTER TABLE IF EXISTS public.estudiantes_bulk
  ADD COLUMN IF NOT EXISTS nombre_encargado TEXT;
