-- 017_tesoreria_v2_cuentas_obligaciones_pagos.sql
-- Objetivo: Base de Tesorería v2 (cuentas corrientes por encargado/tutor,
-- obligaciones (esperado), pagos (real), aplicaciones FIFO y libro diario).
--
-- Nota: Diseñado para convivir temporalmente con el sistema actual basado en movimientos_dinero.

-- =========================
-- 1) ENUMS
-- =========================
DO $$
BEGIN
  CREATE TYPE public.tesoreria_cuenta_tipo_enum AS ENUM ('encargado', 'tutor');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.tesoreria_obligacion_tipo_enum AS ENUM ('cobro_sesion', 'pago_tutor_sesion', 'ajuste');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.tesoreria_direccion_enum AS ENUM ('entrada', 'salida');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Reutilizamos el mismo lenguaje de estado que pagos/movimientos_dinero para consistencia
DO $$
BEGIN
  CREATE TYPE public.tesoreria_estado_enum AS ENUM ('pendiente', 'completado', 'verificado', 'cancelado');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =========================
-- 2) ENCARGADOS (entidad de contacto/cliente)
-- =========================
CREATE TABLE IF NOT EXISTS public.encargados (
  id bigserial PRIMARY KEY,
  nombre text,
  email text,
  telefono text,
  -- Normalizados para deduplicación (múltiples NULL son permitidos por UNIQUE)
  email_norm text GENERATED ALWAYS AS (lower(nullif(trim(email), ''))) STORED,
  telefono_norm text GENERATED ALWAYS AS (nullif(trim(telefono), '')) STORED,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Evitar duplicados cuando hay email/teléfono
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'encargados_email_norm_key'
  ) THEN
    ALTER TABLE public.encargados ADD CONSTRAINT encargados_email_norm_key UNIQUE (email_norm);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'encargados_telefono_norm_key'
  ) THEN
    ALTER TABLE public.encargados ADD CONSTRAINT encargados_telefono_norm_key UNIQUE (telefono_norm);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_encargados_nombre ON public.encargados (nombre);

-- Relacionar estudiantes -> encargado
ALTER TABLE IF EXISTS public.estudiantes
  ADD COLUMN IF NOT EXISTS encargado_id bigint REFERENCES public.encargados(id);

CREATE INDEX IF NOT EXISTS idx_estudiantes_encargado_id ON public.estudiantes (encargado_id);

-- Backfill encargado_id desde email/telefono del encargado si existen columnas
DO $$
DECLARE
  has_nombre boolean;
  has_email boolean;
  has_tel boolean;
  rec record;
  new_encargado_id bigint;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='estudiantes' AND column_name='nombre_encargado'
  ) INTO has_nombre;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='estudiantes' AND column_name='email_encargado'
  ) INTO has_email;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='estudiantes' AND column_name='telefono_encargado'
  ) INTO has_tel;

  IF (has_email OR has_tel) THEN
    -- Insertar encargados con email/telefono cuando existan (deduplicación por email_norm/telefono_norm)
    EXECUTE '
      INSERT INTO public.encargados (nombre, email, telefono)
      SELECT DISTINCT
        ' || CASE WHEN has_nombre THEN 'nullif(trim(nombre_encargado), '''')' ELSE 'NULL' END || ' AS nombre,
        ' || CASE WHEN has_email THEN 'nullif(trim(email_encargado), '''')' ELSE 'NULL' END || ' AS email,
        ' || CASE WHEN has_tel THEN 'nullif(trim(telefono_encargado), '''')' ELSE 'NULL' END || ' AS telefono
      FROM public.estudiantes
      WHERE encargado_id IS NULL
        AND (
          ' || CASE WHEN has_email THEN 'nullif(trim(email_encargado), '''') IS NOT NULL' ELSE 'FALSE' END || '
          OR ' || CASE WHEN has_tel THEN 'nullif(trim(telefono_encargado), '''') IS NOT NULL' ELSE 'FALSE' END || '
        )
      ON CONFLICT DO NOTHING
    ';

    -- Mapear por email_norm primero
    IF has_email THEN
      EXECUTE '
        UPDATE public.estudiantes e
        SET encargado_id = c.id
        FROM public.encargados c
        WHERE e.encargado_id IS NULL
          AND c.email_norm IS NOT NULL
          AND lower(nullif(trim(e.email_encargado), '''')) = c.email_norm
      ';
    END IF;

    -- Luego mapear por telefono_norm
    IF has_tel THEN
      EXECUTE '
        UPDATE public.estudiantes e
        SET encargado_id = c.id
        FROM public.encargados c
        WHERE e.encargado_id IS NULL
          AND c.telefono_norm IS NOT NULL
          AND nullif(trim(e.telefono_encargado), '''') = c.telefono_norm
      ';
    END IF;
  END IF;

  -- Para los estudiantes restantes (sin email/teléfono o no pudieron mapear), crear un encargado por estudiante.
  FOR rec IN
    SELECT id
    FROM public.estudiantes
    WHERE encargado_id IS NULL
  LOOP
    INSERT INTO public.encargados (
      nombre,
      email,
      telefono,
      updated_at
    ) VALUES (
      CASE WHEN has_nombre THEN (SELECT nullif(trim(nombre_encargado), '') FROM public.estudiantes WHERE id = rec.id) ELSE NULL END,
      CASE WHEN has_email THEN (SELECT nullif(trim(email_encargado), '') FROM public.estudiantes WHERE id = rec.id) ELSE NULL END,
      CASE WHEN has_tel THEN (SELECT nullif(trim(telefono_encargado), '') FROM public.estudiantes WHERE id = rec.id) ELSE NULL END,
      now()
    )
    RETURNING id INTO new_encargado_id;

    UPDATE public.estudiantes
    SET encargado_id = new_encargado_id
    WHERE id = rec.id;
  END LOOP;

END $$;

-- =========================
-- 3) CUENTAS CORRIENTES
-- =========================
CREATE TABLE IF NOT EXISTS public.tesoreria_cuentas_corrientes (
  id bigserial PRIMARY KEY,
  tipo public.tesoreria_cuenta_tipo_enum NOT NULL,
  encargado_id bigint REFERENCES public.encargados(id) ON DELETE RESTRICT,
  tutor_id bigint REFERENCES public.tutores(id) ON DELETE RESTRICT,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT tesoreria_cuentas_corrientes_ref_check CHECK (
    (tipo = 'encargado' AND encargado_id IS NOT NULL AND tutor_id IS NULL)
    OR
    (tipo = 'tutor' AND tutor_id IS NOT NULL AND encargado_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_tesoreria_cc_encargado ON public.tesoreria_cuentas_corrientes (encargado_id)
  WHERE tipo = 'encargado';
CREATE UNIQUE INDEX IF NOT EXISTS ux_tesoreria_cc_tutor ON public.tesoreria_cuentas_corrientes (tutor_id)
  WHERE tipo = 'tutor';

-- Backfill: crear cuenta por cada encargado y tutor
INSERT INTO public.tesoreria_cuentas_corrientes (tipo, encargado_id)
SELECT 'encargado', e.id
FROM public.encargados e
LEFT JOIN public.tesoreria_cuentas_corrientes cc
  ON cc.tipo='encargado' AND cc.encargado_id = e.id
WHERE cc.id IS NULL;

INSERT INTO public.tesoreria_cuentas_corrientes (tipo, tutor_id)
SELECT 'tutor', t.id
FROM public.tutores t
LEFT JOIN public.tesoreria_cuentas_corrientes cc
  ON cc.tipo='tutor' AND cc.tutor_id = t.id
WHERE cc.id IS NULL;

-- =========================
-- 4) OBLIGACIONES (ESPERADO)
-- =========================
CREATE TABLE IF NOT EXISTS public.tesoreria_obligaciones (
  id bigserial PRIMARY KEY,
  tipo public.tesoreria_obligacion_tipo_enum NOT NULL,
  cuenta_id bigint NOT NULL REFERENCES public.tesoreria_cuentas_corrientes(id) ON DELETE RESTRICT,
  monto numeric(12,2) NOT NULL CHECK (monto >= 0),
  fecha_devengo date NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aplicado', 'cancelado')),

  estudiante_id bigint REFERENCES public.estudiantes(id) ON DELETE SET NULL,
  tutor_id bigint REFERENCES public.tutores(id) ON DELETE SET NULL,
  curso_id bigint REFERENCES public.cursos(id) ON DELETE SET NULL,
  matricula_id bigint REFERENCES public.matriculas(id) ON DELETE SET NULL,
  sesion_id bigint REFERENCES public.sesiones_clases(id) ON DELETE SET NULL,

  detalle text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Evitar duplicados por sesión (idempotencia)
CREATE UNIQUE INDEX IF NOT EXISTS ux_tesoreria_obligacion_cobro_sesion ON public.tesoreria_obligaciones (sesion_id)
  WHERE tipo='cobro_sesion' AND sesion_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_tesoreria_obligacion_pago_tutor_sesion ON public.tesoreria_obligaciones (sesion_id)
  WHERE tipo='pago_tutor_sesion' AND sesion_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tesoreria_obligaciones_cuenta_fecha ON public.tesoreria_obligaciones (cuenta_id, fecha_devengo);
CREATE INDEX IF NOT EXISTS idx_tesoreria_obligaciones_estado ON public.tesoreria_obligaciones (estado);

-- =========================
-- 5) PAGOS (REAL) + EVIDENCIA
-- =========================
CREATE TABLE IF NOT EXISTS public.tesoreria_pagos (
  id bigserial PRIMARY KEY,
  cuenta_id bigint NOT NULL REFERENCES public.tesoreria_cuentas_corrientes(id) ON DELETE RESTRICT,
  direccion public.tesoreria_direccion_enum NOT NULL,
  monto numeric(12,2) NOT NULL CHECK (monto > 0),
  fecha_pago date NOT NULL,
  metodo text,
  referencia text,
  detalle text,

  numero_comprobante text,
  fecha_comprobante date,
  comprobante_url text,

  estado public.tesoreria_estado_enum NOT NULL DEFAULT 'pendiente',

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Regla de evidencia: si no es efectivo, al menos al estar completado/verificado debe haber evidencia completa
  CONSTRAINT tesoreria_pagos_evidencia_check CHECK (
    metodo IS NULL
    OR lower(metodo) = 'efectivo'
    OR estado IN ('pendiente', 'cancelado')
    OR (
      numero_comprobante IS NOT NULL
      AND fecha_comprobante IS NOT NULL
      AND comprobante_url IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_tesoreria_pagos_fecha ON public.tesoreria_pagos (fecha_pago);
CREATE INDEX IF NOT EXISTS idx_tesoreria_pagos_cuenta_fecha ON public.tesoreria_pagos (cuenta_id, fecha_pago);
CREATE INDEX IF NOT EXISTS idx_tesoreria_pagos_estado ON public.tesoreria_pagos (estado);

-- =========================
-- 6) APLICACIONES (pago -> obligaciones)
-- =========================
CREATE TABLE IF NOT EXISTS public.tesoreria_aplicaciones (
  id bigserial PRIMARY KEY,
  pago_id bigint NOT NULL REFERENCES public.tesoreria_pagos(id) ON DELETE CASCADE,
  obligacion_id bigint NOT NULL REFERENCES public.tesoreria_obligaciones(id) ON DELETE RESTRICT,
  monto numeric(12,2) NOT NULL CHECK (monto > 0),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tesoreria_aplicaciones_pago ON public.tesoreria_aplicaciones (pago_id);
CREATE INDEX IF NOT EXISTS idx_tesoreria_aplicaciones_obligacion ON public.tesoreria_aplicaciones (obligacion_id);

-- =========================
-- 7) VISTAS (saldo/deuda/libro diario)
-- =========================
CREATE OR REPLACE VIEW public.tesoreria_libro_diario_v1 AS
SELECT
  p.id,
  p.fecha_pago,
  p.cuenta_id,
  cc.tipo AS cuenta_tipo,
  cc.encargado_id,
  cc.tutor_id,
  p.metodo,
  p.referencia,
  p.detalle,
  p.numero_comprobante,
  p.fecha_comprobante,
  p.comprobante_url,
  p.estado,
  CASE WHEN p.direccion = 'entrada' THEN p.monto ELSE 0 END AS debe,
  CASE WHEN p.direccion = 'salida' THEN p.monto ELSE 0 END AS haber,
  (CASE WHEN p.direccion = 'entrada' THEN p.monto ELSE -p.monto END) AS neto_mov,
  SUM(CASE WHEN p.direccion = 'entrada' THEN p.monto ELSE -p.monto END)
    OVER (ORDER BY p.fecha_pago, p.id) AS saldo_acumulado
FROM public.tesoreria_pagos p
JOIN public.tesoreria_cuentas_corrientes cc ON cc.id = p.cuenta_id;

-- Saldos por encargado: deuda pendiente + saldo a favor
CREATE OR REPLACE VIEW public.tesoreria_saldos_encargados_v1 AS
WITH cc AS (
  SELECT id AS cuenta_id, encargado_id
  FROM public.tesoreria_cuentas_corrientes
  WHERE tipo='encargado'
),
ob AS (
  SELECT
    o.cuenta_id,
    SUM(CASE WHEN o.estado <> 'cancelado' THEN o.monto ELSE 0 END) AS total_obligado,
    SUM(CASE WHEN o.estado = 'pendiente' THEN o.monto ELSE 0 END) AS obligado_pendiente
  FROM public.tesoreria_obligaciones o
  WHERE o.tipo='cobro_sesion'
  GROUP BY o.cuenta_id
),
-- Deudas de movimientos_dinero (cierre mensual de cursos pagados mensualmente)
mov_deudas AS (
  SELECT
    e.encargado_id,
    SUM(CASE WHEN md.estado = 'pendiente' AND md.tipo = 'ingreso_estudiante' THEN md.monto ELSE 0 END) AS movimiento_pendiente
  FROM public.movimientos_dinero md
  JOIN public.matriculas m ON m.id = md.matricula_id
  JOIN public.estudiantes e ON e.id = m.estudiante_id
  WHERE md.estado = 'pendiente' AND md.tipo = 'ingreso_estudiante'
  GROUP BY e.encargado_id
),
app AS (
  SELECT
    o.cuenta_id,
    SUM(a.monto) AS total_aplicado
  FROM public.tesoreria_aplicaciones a
  JOIN public.tesoreria_obligaciones o ON o.id = a.obligacion_id
  WHERE o.tipo='cobro_sesion' AND o.estado <> 'cancelado'
  GROUP BY o.cuenta_id
),
pagos AS (
  SELECT
    p.cuenta_id,
    SUM(CASE WHEN p.estado IN ('completado','verificado') AND p.direccion='entrada' THEN p.monto ELSE 0 END) AS total_pagado
  FROM public.tesoreria_pagos p
  GROUP BY p.cuenta_id
)
SELECT
  cc.encargado_id,
  cc.cuenta_id,
  COALESCE(ob.obligado_pendiente, 0) + COALESCE(mov_deudas.movimiento_pendiente, 0) AS deuda_pendiente,
  GREATEST(COALESCE(pagos.total_pagado, 0) - COALESCE(app.total_aplicado, 0), 0) AS saldo_a_favor
FROM cc
LEFT JOIN ob ON ob.cuenta_id = cc.cuenta_id
LEFT JOIN mov_deudas ON mov_deudas.encargado_id = cc.encargado_id
LEFT JOIN app ON app.cuenta_id = cc.cuenta_id
LEFT JOIN pagos ON pagos.cuenta_id = cc.cuenta_id;

-- Saldos por tutor: total pendiente por pagar (obligaciones) - pagos realizados
CREATE OR REPLACE VIEW public.tesoreria_saldos_tutores_v1 AS
WITH cc AS (
  SELECT id AS cuenta_id, tutor_id
  FROM public.tesoreria_cuentas_corrientes
  WHERE tipo='tutor'
),
ob AS (
  SELECT
    o.cuenta_id,
    SUM(CASE WHEN o.estado = 'pendiente' THEN o.monto ELSE 0 END) AS por_pagar
  FROM public.tesoreria_obligaciones o
  WHERE o.tipo='pago_tutor_sesion'
  GROUP BY o.cuenta_id
),
pagos AS (
  SELECT
    p.cuenta_id,
    SUM(CASE WHEN p.estado IN ('completado','verificado') AND p.direccion='salida' THEN p.monto ELSE 0 END) AS pagado
  FROM public.tesoreria_pagos p
  GROUP BY p.cuenta_id
)
SELECT
  cc.tutor_id,
  cc.cuenta_id,
  COALESCE(ob.por_pagar, 0) AS por_pagar,
  COALESCE(pagos.pagado, 0) AS pagado
FROM cc
LEFT JOIN ob ON ob.cuenta_id = cc.cuenta_id
LEFT JOIN pagos ON pagos.cuenta_id = cc.cuenta_id;

-- =========================
-- 8) FUNCIONES (RPC) - cuentas y pago FIFO
-- =========================
CREATE OR REPLACE FUNCTION public.tesoreria_get_or_create_cuenta_encargado_v1(p_encargado_id bigint)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  v_id bigint;
BEGIN
  SELECT id INTO v_id
  FROM public.tesoreria_cuentas_corrientes
  WHERE tipo='encargado' AND encargado_id = p_encargado_id;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.tesoreria_cuentas_corrientes (tipo, encargado_id)
  VALUES ('encargado', p_encargado_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.tesoreria_get_or_create_cuenta_tutor_v1(p_tutor_id bigint)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  v_id bigint;
BEGIN
  SELECT id INTO v_id
  FROM public.tesoreria_cuentas_corrientes
  WHERE tipo='tutor' AND tutor_id = p_tutor_id;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.tesoreria_cuentas_corrientes (tipo, tutor_id)
  VALUES ('tutor', p_tutor_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

-- Registrar pago de encargado y aplicar FIFO a obligaciones pendientes (cobro_sesion)
CREATE OR REPLACE FUNCTION public.tesoreria_registrar_pago_encargado_v1(
  p_encargado_id bigint,
  p_monto numeric,
  p_fecha_pago date,
  p_metodo text DEFAULT NULL,
  p_numero_comprobante text DEFAULT NULL,
  p_fecha_comprobante date DEFAULT NULL,
  p_comprobante_url text DEFAULT NULL,
  p_referencia text DEFAULT NULL,
  p_detalle text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_cuenta_id bigint;
  v_pago_id bigint;
  v_estado public.tesoreria_estado_enum;
  v_restante numeric := COALESCE(p_monto, 0);
  v_ob record;
  v_aplicar numeric;
  v_aplicaciones jsonb := '[]'::jsonb;
  v_aplicado_total numeric := 0;
BEGIN
  IF p_encargado_id IS NULL THEN
    RAISE EXCEPTION 'p_encargado_id es requerido';
  END IF;
  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'p_monto debe ser > 0';
  END IF;
  IF p_fecha_pago IS NULL THEN
    RAISE EXCEPTION 'p_fecha_pago es requerido';
  END IF;

  v_cuenta_id := public.tesoreria_get_or_create_cuenta_encargado_v1(p_encargado_id);

  v_estado := CASE
    WHEN p_metodo IS NULL OR lower(trim(p_metodo)) = 'efectivo' THEN 'completado'
    WHEN p_numero_comprobante IS NOT NULL AND p_fecha_comprobante IS NOT NULL AND p_comprobante_url IS NOT NULL THEN 'completado'
    ELSE 'pendiente'
  END;

  INSERT INTO public.tesoreria_pagos (
    cuenta_id,
    direccion,
    monto,
    fecha_pago,
    metodo,
    referencia,
    detalle,
    numero_comprobante,
    fecha_comprobante,
    comprobante_url,
    estado
  ) VALUES (
    v_cuenta_id,
    'entrada',
    p_monto,
    p_fecha_pago,
    p_metodo,
    p_referencia,
    p_detalle,
    p_numero_comprobante,
    p_fecha_comprobante,
    p_comprobante_url,
    v_estado
  ) RETURNING id INTO v_pago_id;

  -- FIFO: obligaciones de cobro pendientes de esta cuenta
  FOR v_ob IN
    SELECT
      o.id,
      o.monto,
      o.fecha_devengo,
      COALESCE((
        SELECT SUM(a.monto)
        FROM public.tesoreria_aplicaciones a
        WHERE a.obligacion_id = o.id
      ), 0) AS ya_aplicado
    FROM public.tesoreria_obligaciones o
    WHERE o.cuenta_id = v_cuenta_id
      AND o.tipo = 'cobro_sesion'
      AND o.estado = 'pendiente'
    ORDER BY o.fecha_devengo ASC, o.id ASC
  LOOP
    EXIT WHEN v_restante <= 0;

    v_aplicar := LEAST(v_restante, GREATEST(v_ob.monto - v_ob.ya_aplicado, 0));
    IF v_aplicar <= 0 THEN
      CONTINUE;
    END IF;

    INSERT INTO public.tesoreria_aplicaciones (pago_id, obligacion_id, monto)
    VALUES (v_pago_id, v_ob.id, v_aplicar);

    v_restante := v_restante - v_aplicar;
    v_aplicado_total := v_aplicado_total + v_aplicar;

    -- Si se cubrió completamente, marcar obligación como aplicada
    IF (v_ob.ya_aplicado + v_aplicar) >= v_ob.monto THEN
      UPDATE public.tesoreria_obligaciones
      SET estado='aplicado', updated_at=now()
      WHERE id = v_ob.id;
    END IF;

    v_aplicaciones := v_aplicaciones || jsonb_build_array(
      jsonb_build_object(
        'obligacion_id', v_ob.id,
        'monto', v_aplicar,
        'fecha_devengo', v_ob.fecha_devengo
      )
    );
  END LOOP;

  RETURN jsonb_build_object(
    'pago_id', v_pago_id,
    'cuenta_id', v_cuenta_id,
    'monto', p_monto,
    'aplicado_total', v_aplicado_total,
    'saldo_a_favor_generado', v_restante,
    'aplicaciones', v_aplicaciones
  );
END $$;
