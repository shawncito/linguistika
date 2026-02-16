-- Agrega color de perfil a tutores (para UI)
ALTER TABLE public.tutores
ADD COLUMN IF NOT EXISTS color TEXT;

-- Validación básica: aceptar HEX #RRGGBB o NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tutores_color_hex_check'
  ) THEN
    ALTER TABLE public.tutores
    ADD CONSTRAINT tutores_color_hex_check
    CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$');
  END IF;
END $$;
