-- 005_add_matricula_id_to_sesiones_clases.sql
-- Para poder calcular cobros/pagos mensuales por estudiante/curso.

ALTER TABLE IF EXISTS public.sesiones_clases
  ADD COLUMN IF NOT EXISTS matricula_id bigint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sesiones_clases_matricula_id_fkey'
  ) THEN
    ALTER TABLE public.sesiones_clases
      ADD CONSTRAINT sesiones_clases_matricula_id_fkey
      FOREIGN KEY (matricula_id)
      REFERENCES public.matriculas(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sesiones_clases_matricula_id
  ON public.sesiones_clases(matricula_id);
