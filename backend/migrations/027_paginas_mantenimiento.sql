-- ============================================================
-- 027: Control de páginas en mantenimiento (admin toggle)
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.paginas_mantenimiento (
  slug                   text         PRIMARY KEY,
  nombre                 text         NOT NULL,
  activa                 boolean      NOT NULL DEFAULT true,
  desactivada_por        uuid         NULL,
  desactivada_por_nombre text         NULL,
  mensaje                text         NULL,
  updated_at             timestamptz  NOT NULL DEFAULT now()
);

-- Seed todas las páginas de la app
INSERT INTO public.paginas_mantenimiento (slug, nombre) VALUES
  ('dashboard',    'Dashboard'),
  ('tutores',      'Tutores'),
  ('cursos',       'Cursos'),
  ('estudiantes',  'Estudiantes'),
  ('matriculas',   'Matrículas'),
  ('pagos',        'Tesorería'),
  ('empleados',    'Empleados')
ON CONFLICT (slug) DO NOTHING;

-- RLS: todos los usuarios autenticados pueden leer
ALTER TABLE public.paginas_mantenimiento ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE public.paginas_mantenimiento TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'paginas_mantenimiento'
      AND policyname = 'authenticated_select_paginas'
  ) THEN
    CREATE POLICY "authenticated_select_paginas"
      ON public.paginas_mantenimiento
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

COMMIT;
