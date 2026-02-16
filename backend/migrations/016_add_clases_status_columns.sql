-- 010_add_clases_status_columns.sql
-- Agrega columnas necesarias para el flujo de "avisado/confirmado" y duración.
-- Ejecutar en Supabase SQL Editor (si tu BD aún no las tiene).

ALTER TABLE public.clases
  ADD COLUMN IF NOT EXISTS duracion_horas numeric,
  ADD COLUMN IF NOT EXISTS avisado boolean,
  ADD COLUMN IF NOT EXISTS confirmado boolean,
  ADD COLUMN IF NOT EXISTS motivo_cancelacion text;
