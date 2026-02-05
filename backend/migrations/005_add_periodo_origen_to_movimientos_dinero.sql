-- 005_add_periodo_origen_to_movimientos_dinero.sql
-- Soporte para cierres mensuales idempotentes/auditables.

ALTER TABLE IF EXISTS public.movimientos_dinero
  ADD COLUMN IF NOT EXISTS periodo_inicio date,
  ADD COLUMN IF NOT EXISTS periodo_fin date,
  ADD COLUMN IF NOT EXISTS origen text;

CREATE INDEX IF NOT EXISTS idx_movimientos_dinero_origen
  ON public.movimientos_dinero(origen);

CREATE INDEX IF NOT EXISTS idx_movimientos_dinero_periodo_inicio
  ON public.movimientos_dinero(periodo_inicio);

CREATE INDEX IF NOT EXISTS idx_movimientos_dinero_periodo_fin
  ON public.movimientos_dinero(periodo_fin);
