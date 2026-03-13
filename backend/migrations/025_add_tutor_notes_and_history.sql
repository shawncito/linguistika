-- ============================================================
-- 025: Notas colaborativas por tutor + historial de acciones
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.tutor_notas (
  id bigserial PRIMARY KEY,
  tutor_id bigint NOT NULL REFERENCES public.tutores(id) ON DELETE CASCADE,
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

  CONSTRAINT tutor_notas_mensaje_not_blank CHECK (length(trim(mensaje)) > 0)
);

CREATE TABLE IF NOT EXISTS public.tutor_notas_historial (
  id bigserial PRIMARY KEY,
  nota_id bigint NOT NULL REFERENCES public.tutor_notas(id) ON DELETE CASCADE,
  tutor_id bigint NOT NULL REFERENCES public.tutores(id) ON DELETE CASCADE,
  accion text NOT NULL CHECK (accion IN ('crear', 'editar', 'marcar_hecha', 'reabrir', 'eliminar')),
  mensaje text NOT NULL,
  estado text NULL,

  actor_user_id uuid NULL,
  actor_name text NULL,
  actor_role text NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS tutor_notas_tutor_created_idx
  ON public.tutor_notas (tutor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS tutor_notas_tutor_estado_idx
  ON public.tutor_notas (tutor_id, estado);

CREATE INDEX IF NOT EXISTS tutor_notas_historial_tutor_created_idx
  ON public.tutor_notas_historial (tutor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS tutor_notas_historial_nota_created_idx
  ON public.tutor_notas_historial (nota_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tutor_notas TO anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.tutor_notas_historial TO anon, authenticated, service_role;

GRANT USAGE, SELECT ON SEQUENCE public.tutor_notas_id_seq TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.tutor_notas_historial_id_seq TO anon, authenticated, service_role;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE tutor_notas;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE tutor_notas_historial;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

COMMIT;
