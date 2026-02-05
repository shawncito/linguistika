-- 007_time_format_constraints.sql
-- Objetivo: profesionalizar validación de horas sin romper datos existentes.
-- Mantiene columnas como TEXT por compatibilidad, pero:
-- 1) Normaliza HH:M -> HH:MM (solo casos simples)
-- 2) Agrega CHECK constraints NOT VALID para aplicar a datos nuevos

-- Normalizar horarios_tutores (HH:M -> HH:0M, H:MM -> 0H:MM, H:M -> 0H:0M)
UPDATE public.horarios_tutores
SET hora_inicio =
  LPAD(split_part(hora_inicio, ':', 1), 2, '0') || ':' || LPAD(split_part(hora_inicio, ':', 2), 2, '0')
WHERE hora_inicio ~ '^\d{1,2}:\d{1,2}$';

UPDATE public.horarios_tutores
SET hora_fin =
  LPAD(split_part(hora_fin, ':', 1), 2, '0') || ':' || LPAD(split_part(hora_fin, ':', 2), 2, '0')
WHERE hora_fin ~ '^\d{1,2}:\d{1,2}$';

-- Normalizar clases (mismo criterio)
UPDATE public.clases
SET hora_inicio =
  LPAD(split_part(hora_inicio, ':', 1), 2, '0') || ':' || LPAD(split_part(hora_inicio, ':', 2), 2, '0')
WHERE hora_inicio ~ '^\d{1,2}:\d{1,2}$';

UPDATE public.clases
SET hora_fin =
  LPAD(split_part(hora_fin, ':', 1), 2, '0') || ':' || LPAD(split_part(hora_fin, ':', 2), 2, '0')
WHERE hora_fin ~ '^\d{1,2}:\d{1,2}$';

-- Constraints: formato HH:MM o HH:MM:SS y orden hora_inicio < hora_fin
ALTER TABLE public.horarios_tutores
  ADD CONSTRAINT horarios_tutores_hora_formato_chk
  CHECK (
    hora_inicio ~ '^\d{2}:\d{2}(:\d{2})?$' AND
    hora_fin ~ '^\d{2}:\d{2}(:\d{2})?$'
  ) NOT VALID;

ALTER TABLE public.horarios_tutores
  ADD CONSTRAINT horarios_tutores_hora_orden_chk
  CHECK (
    CASE
      WHEN (hora_inicio ~ '^\d{2}:\d{2}(:\d{2})?$' AND hora_fin ~ '^\d{2}:\d{2}(:\d{2})?$')
        THEN (hora_inicio::time < hora_fin::time)
      ELSE false
    END
  ) NOT VALID;

ALTER TABLE public.clases
  ADD CONSTRAINT clases_hora_formato_chk
  CHECK (
    hora_inicio ~ '^\d{2}:\d{2}(:\d{2})?$' AND
    hora_fin ~ '^\d{2}:\d{2}(:\d{2})?$'
  ) NOT VALID;

ALTER TABLE public.clases
  ADD CONSTRAINT clases_hora_orden_chk
  CHECK (
    CASE
      WHEN (hora_inicio ~ '^\d{2}:\d{2}(:\d{2})?$' AND hora_fin ~ '^\d{2}:\d{2}(:\d{2})?$')
        THEN (hora_inicio::time < hora_fin::time)
      ELSE false
    END
  ) NOT VALID;
