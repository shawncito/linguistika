-- 005_add_tipo_pago_to_cursos.sql
-- Permite definir si un curso se cobra/paga mensual o por sesion.

ALTER TABLE IF EXISTS public.cursos
  ADD COLUMN IF NOT EXISTS tipo_pago text NOT NULL DEFAULT 'sesion';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cursos_tipo_pago_check'
  ) THEN
    ALTER TABLE public.cursos
      ADD CONSTRAINT cursos_tipo_pago_check
      CHECK (tipo_pago IN ('sesion', 'mensual'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cursos_tipo_pago
  ON public.cursos(tipo_pago);
