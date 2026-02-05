-- 004_add_periodo_to_pagos.sql
-- Agrega rango de periodo a pagos para liquidaciones por fecha.

ALTER TABLE IF EXISTS public.pagos
  ADD COLUMN IF NOT EXISTS periodo_inicio date,
  ADD COLUMN IF NOT EXISTS periodo_fin date;

CREATE INDEX IF NOT EXISTS idx_pagos_tutor_id
  ON public.pagos(tutor_id);

CREATE INDEX IF NOT EXISTS idx_pagos_periodo_inicio
  ON public.pagos(periodo_inicio);

CREATE INDEX IF NOT EXISTS idx_pagos_periodo_fin
  ON public.pagos(periodo_fin);
