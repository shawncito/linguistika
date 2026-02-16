-- 020_tesoreria_v2_pago_tutor_fuente_y_seleccion.sql
-- Objetivo:
-- - Permitir pagar tutor marcando sesiones específicas (obligaciones) en el pago.
-- - Permitir seleccionar "fuente" (encargado) para que se descuente de su saldo_a_favor.
-- - Dejar registro audit-able de la fuente del pago.

-- =========================
-- 1) TABLA: fuente de pago tutor
-- =========================
CREATE TABLE IF NOT EXISTS public.tesoreria_pagos_tutor_fuentes (
  id bigserial PRIMARY KEY,
  pago_id bigint NOT NULL REFERENCES public.tesoreria_pagos(id) ON DELETE CASCADE,
  encargado_id bigint NOT NULL REFERENCES public.encargados(id) ON DELETE RESTRICT,
  monto numeric(12,2) NOT NULL CHECK (monto > 0),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tesoreria_pagos_tutor_fuentes_pago ON public.tesoreria_pagos_tutor_fuentes(pago_id);
CREATE INDEX IF NOT EXISTS idx_tesoreria_pagos_tutor_fuentes_enc ON public.tesoreria_pagos_tutor_fuentes(encargado_id);

-- =========================
-- 2) VISTA: porcentaje por encargado (ajustado por salidas asignadas)
-- =========================
CREATE OR REPLACE VIEW public.tesoreria_porcentaje_encargados_v2 AS
WITH bolsa AS (
  SELECT bolsa_real FROM public.tesoreria_bolsa_v1
),
fuentes AS (
  SELECT encargado_id, COALESCE(SUM(monto), 0) AS total_fondeado
  FROM public.tesoreria_pagos_tutor_fuentes
  GROUP BY encargado_id
)
SELECT
  s.encargado_id,
  s.cuenta_id,
  -- saldo_a_favor neto: lo que ha pagado de más menos lo que ya se usó para pagar tutores
  GREATEST(COALESCE(s.saldo_a_favor, 0) - COALESCE(f.total_fondeado, 0), 0) AS saldo_a_favor,
  (SELECT bolsa_real FROM bolsa) AS bolsa_real,
  CASE
    WHEN (SELECT bolsa_real FROM bolsa) > 0 THEN (GREATEST(COALESCE(s.saldo_a_favor, 0) - COALESCE(f.total_fondeado, 0), 0) / (SELECT bolsa_real FROM bolsa))
    ELSE 0
  END AS porcentaje_bolsa
FROM public.tesoreria_saldos_encargados_v1 s
LEFT JOIN fuentes f ON f.encargado_id = s.encargado_id;

-- =========================
-- 3) RPC: pagar tutor (salida) + aplicar (FIFO o selección) + registrar fuente
-- =========================
CREATE OR REPLACE FUNCTION public.tesoreria_registrar_pago_tutor_v2(
  p_tutor_id bigint,
  p_monto numeric,
  p_fecha_pago date,
  p_source_encargado_id bigint DEFAULT NULL,
  p_obligacion_ids bigint[] DEFAULT NULL,
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
  v_bolsa numeric := 0;
  v_saldo_fuente numeric := 0;
BEGIN
  IF p_tutor_id IS NULL THEN
    RAISE EXCEPTION 'p_tutor_id es requerido';
  END IF;
  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'p_monto debe ser > 0';
  END IF;
  IF p_fecha_pago IS NULL THEN
    RAISE EXCEPTION 'p_fecha_pago es requerido';
  END IF;

  -- No pagar más de la bolsa real disponible
  SELECT bolsa_real INTO v_bolsa
  FROM public.tesoreria_bolsa_v1;

  IF v_bolsa < p_monto THEN
    RAISE EXCEPTION 'No se puede pagar más de la bolsa real. Bolsa=%, intento=%', v_bolsa, p_monto;
  END IF;

  -- Si se indica fuente (encargado), validar que tenga saldo_a_favor suficiente (ajustado)
  IF p_source_encargado_id IS NOT NULL THEN
    SELECT
      GREATEST(COALESCE(s.saldo_a_favor, 0) - COALESCE(f.total_fondeado, 0), 0)
    INTO v_saldo_fuente
    FROM public.tesoreria_saldos_encargados_v1 s
    LEFT JOIN (
      SELECT encargado_id, COALESCE(SUM(monto), 0) AS total_fondeado
      FROM public.tesoreria_pagos_tutor_fuentes
      GROUP BY encargado_id
    ) f ON f.encargado_id = s.encargado_id
    WHERE s.encargado_id = p_source_encargado_id;

    IF COALESCE(v_saldo_fuente, 0) < p_monto THEN
      RAISE EXCEPTION 'La fuente (encargado_id=%) no tiene saldo suficiente. Disponible=%, intento=%', p_source_encargado_id, COALESCE(v_saldo_fuente,0), p_monto;
    END IF;
  END IF;

  v_cuenta_id := public.tesoreria_get_or_create_cuenta_tutor_v1(p_tutor_id);

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
    'salida',
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

  -- Registrar fuente (audit)
  IF p_source_encargado_id IS NOT NULL THEN
    INSERT INTO public.tesoreria_pagos_tutor_fuentes (pago_id, encargado_id, monto)
    VALUES (v_pago_id, p_source_encargado_id, p_monto);
  END IF;

  -- Aplicación: selección explícita (si viene), si no FIFO
  IF p_obligacion_ids IS NOT NULL AND array_length(p_obligacion_ids, 1) IS NOT NULL THEN
    FOR v_ob IN
      WITH sel AS (
        SELECT u.id AS obligacion_id, u.ord
        FROM unnest(p_obligacion_ids) WITH ORDINALITY AS u(id, ord)
      )
      SELECT
        o.id,
        o.monto,
        o.fecha_devengo,
        COALESCE((
          SELECT SUM(a.monto)
          FROM public.tesoreria_aplicaciones a
          WHERE a.obligacion_id = o.id
        ), 0) AS ya_aplicado
      FROM sel
      JOIN public.tesoreria_obligaciones o ON o.id = sel.obligacion_id
      WHERE o.cuenta_id = v_cuenta_id
        AND o.tipo = 'pago_tutor_sesion'
        AND o.estado = 'pendiente'
      ORDER BY sel.ord ASC
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
  ELSE
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
        AND o.tipo = 'pago_tutor_sesion'
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
  END IF;

  RETURN jsonb_build_object(
    'pago_id', v_pago_id,
    'cuenta_id', v_cuenta_id,
    'monto', p_monto,
    'aplicado_total', v_aplicado_total,
    'pendiente_aplicar', v_restante,
    'aplicaciones', v_aplicaciones,
    'source_encargado_id', p_source_encargado_id,
    'bolsa_real_antes', v_bolsa,
    'bolsa_real_despues', (v_bolsa - p_monto)
  );
END $$;
