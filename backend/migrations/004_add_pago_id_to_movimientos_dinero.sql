-- 004_add_pago_id_to_movimientos_dinero.sql
-- Vincula movimientos_dinero (pago_tutor_pendiente) con un registro en pagos.
-- Permite liquidaciones idempotentes y auditoria (evitar doble pago).

ALTER TABLE IF EXISTS public.movimientos_dinero
  ADD COLUMN IF NOT EXISTS pago_id bigint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'movimientos_dinero_pago_id_fkey'
  ) THEN
    ALTER TABLE public.movimientos_dinero
      ADD CONSTRAINT movimientos_dinero_pago_id_fkey
      FOREIGN KEY (pago_id)
      REFERENCES public.pagos(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_movimientos_dinero_pago_id
  ON public.movimientos_dinero(pago_id);
