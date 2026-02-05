-- 008_updated_at_triggers.sql
-- Objetivo: estandarizar updated_at para tablas que lo tienen.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Helper: triggers por tabla (se ignoran si la tabla no existe)
DO $$
BEGIN
  -- cursos
  IF to_regclass('public.cursos') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_set_updated_at_cursos ON public.cursos';
    EXECUTE 'CREATE TRIGGER trg_set_updated_at_cursos BEFORE UPDATE ON public.cursos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
  END IF;

  -- tutores
  IF to_regclass('public.tutores') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_set_updated_at_tutores ON public.tutores';
    EXECUTE 'CREATE TRIGGER trg_set_updated_at_tutores BEFORE UPDATE ON public.tutores FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
  END IF;

  -- estudiantes
  IF to_regclass('public.estudiantes') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_set_updated_at_estudiantes ON public.estudiantes';
    EXECUTE 'CREATE TRIGGER trg_set_updated_at_estudiantes BEFORE UPDATE ON public.estudiantes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
  END IF;

  -- matriculas_grupo
  IF to_regclass('public.matriculas_grupo') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_set_updated_at_matriculas_grupo ON public.matriculas_grupo';
    EXECUTE 'CREATE TRIGGER trg_set_updated_at_matriculas_grupo BEFORE UPDATE ON public.matriculas_grupo FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
  END IF;

  -- movimientos_financieros
  IF to_regclass('public.movimientos_financieros') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_set_updated_at_movimientos_financieros ON public.movimientos_financieros';
    EXECUTE 'CREATE TRIGGER trg_set_updated_at_movimientos_financieros BEFORE UPDATE ON public.movimientos_financieros FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
  END IF;

  -- comprobantes_ingresos
  IF to_regclass('public.comprobantes_ingresos') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_set_updated_at_comprobantes_ingresos ON public.comprobantes_ingresos';
    EXECUTE 'CREATE TRIGGER trg_set_updated_at_comprobantes_ingresos BEFORE UPDATE ON public.comprobantes_ingresos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
  END IF;

  -- estudiantes_bulk
  IF to_regclass('public.estudiantes_bulk') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_set_updated_at_estudiantes_bulk ON public.estudiantes_bulk';
    EXECUTE 'CREATE TRIGGER trg_set_updated_at_estudiantes_bulk BEFORE UPDATE ON public.estudiantes_bulk FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
  END IF;

END $$;
