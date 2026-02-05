-- 006_fix_cursos_tutor_id_bigint.sql
-- Objetivo: asegurar consistencia de tipo entre cursos.tutor_id y tutores.id (bigint)

DO $$
DECLARE
  col_type text;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'cursos'
    AND column_name = 'tutor_id';

  IF col_type = 'integer' THEN
    ALTER TABLE public.cursos
      ALTER COLUMN tutor_id TYPE bigint
      USING tutor_id::bigint;
  END IF;
END $$;
