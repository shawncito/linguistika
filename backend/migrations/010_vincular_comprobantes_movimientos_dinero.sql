-- 010_vincular_comprobantes_movimientos_dinero.sql
-- Objetivo: permitir que comprobantes_ingresos se vinculen tanto a movimientos_financieros como a movimientos_dinero
-- (mantener compatibilidad con el sistema actual que usa movimientos_dinero)

-- Agregar columna opcional para vincular a movimientos_dinero
ALTER TABLE public.comprobantes_ingresos
ADD COLUMN IF NOT EXISTS movimiento_dinero_id bigint REFERENCES public.movimientos_dinero(id);

-- Índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_comprobantes_movimiento_dinero ON public.comprobantes_ingresos (movimiento_dinero_id)
  WHERE movimiento_dinero_id IS NOT NULL;

-- Comentario para documentación
COMMENT ON COLUMN public.comprobantes_ingresos.movimiento_dinero_id IS 
  'Vínculo opcional a movimientos_dinero (sistema actual). Usar este campo O movimiento_financiero_id, no ambos.';
