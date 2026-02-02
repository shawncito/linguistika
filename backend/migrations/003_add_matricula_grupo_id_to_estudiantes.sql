-- Agrega columna para vincular estudiantes (manuales) a matriculas_grupo
-- Esto permite que la UI de Grupos muestre y gestione estudiantes creados manualmente.

ALTER TABLE IF EXISTS public.estudiantes
  ADD COLUMN IF NOT EXISTS matricula_grupo_id bigint;

DO $$
BEGIN
  -- Agregar FK (idempotente)
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'estudiantes_matricula_grupo_id_fkey'
  ) THEN
    ALTER TABLE public.estudiantes
      ADD CONSTRAINT estudiantes_matricula_grupo_id_fkey
      FOREIGN KEY (matricula_grupo_id)
      REFERENCES public.matriculas_grupo(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_estudiantes_matricula_grupo_id
  ON public.estudiantes(matricula_grupo_id);
