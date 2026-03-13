-- ============================================================
-- 026: Notas colaborativas por fecha del calendario + historial
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.calendario_notas (
  id bigserial PRIMARY KEY,
  fecha date NOT NULL,
  mensaje text NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'hecha', 'eliminada')),

  creado_por uuid NULL,
  creado_por_nombre text NULL,
  actualizado_por uuid NULL,
  actualizado_por_nombre text NULL,
  eliminado_por uuid NULL,
  eliminado_por_nombre text NULL,

  hecha_en timestamptz NULL,
  eliminada_en timestamptz NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT calendario_notas_mensaje_not_blank CHECK (length(trim(mensaje)) > 0)
);

CREATE TABLE IF NOT EXISTS public.calendario_notas_historial (
  id bigserial PRIMARY KEY,
  nota_id bigint NOT NULL REFERENCES public.calendario_notas(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  accion text NOT NULL CHECK (accion IN ('crear', 'editar', 'marcar_hecha', 'reabrir', 'eliminar')),
  mensaje text NOT NULL,
  estado text NULL,

  actor_user_id uuid NULL,
  actor_name text NULL,
  actor_role text NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS calendario_notas_fecha_created_idx
  ON public.calendario_notas (fecha, created_at DESC);

CREATE INDEX IF NOT EXISTS calendario_notas_fecha_estado_idx
  ON public.calendario_notas (fecha, estado);

CREATE INDEX IF NOT EXISTS calendario_notas_historial_fecha_created_idx
  ON public.calendario_notas_historial (fecha, created_at DESC);

CREATE INDEX IF NOT EXISTS calendario_notas_historial_nota_created_idx
  ON public.calendario_notas_historial (nota_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.calendario_notas TO anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.calendario_notas_historial TO anon, authenticated, service_role;

GRANT USAGE, SELECT ON SEQUENCE public.calendario_notas_id_seq TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.calendario_notas_historial_id_seq TO anon, authenticated, service_role;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE calendario_notas;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE calendario_notas_historial;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

COMMIT;