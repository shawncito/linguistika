-- 005_create_configuracion.sql
-- Configuracion simple tipo key/value.

CREATE TABLE IF NOT EXISTS public.configuracion (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamp with time zone DEFAULT now()
);
    
-- Valor por defecto: dia 1 del mes.
INSERT INTO public.configuracion(key, value)
VALUES ('cierre_mensual_dia', '1')
ON CONFLICT (key) DO NOTHING;
