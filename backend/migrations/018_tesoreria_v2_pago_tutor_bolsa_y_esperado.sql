-- 018_tesoreria_v2_pago_tutor_bolsa_y_esperado.sql
-- Objetivo: completar Tesorería v2 con:
-- - vista de bolsa real (Debe/Haber y neto)
-- - porcentajes por encargado
-- - resumen esperado por día (obligaciones)
-- - RPC para pagar tutor (salida + aplicación FIFO a obligaciones)

-- =========================
-- 1) VISTA BOLSA REAL (solo completado/verificado)
-- =========================
CREATE OR REPLACE VIEW public.tesoreria_bolsa_v1 AS
SELECT
  COALESCE(SUM(CASE WHEN estado IN ('completado','verificado') AND direccion='entrada' THEN monto ELSE 0 END), 0) AS debe_real,
  COALESCE(SUM(CASE WHEN estado IN ('completado','verificado') AND direccion='salida' THEN monto ELSE 0 END), 0) AS haber_real,
  COALESCE(SUM(CASE WHEN estado IN ('completado','verificado') AND direccion='entrada' THEN monto ELSE -monto END), 0) AS bolsa_real
FROM public.tesoreria_pagos;

-- =========================
-- 2) PORCENTAJE POR ENCARGADO
-- =========================
CREATE OR REPLACE VIEW public.tesoreria_porcentaje_encargados_v1 AS
WITH bolsa AS (
  SELECT bolsa_real FROM public.tesoreria_bolsa_v1
)
SELECT
  s.encargado_id,
  s.cuenta_id,
  s.saldo_a_favor,
  (SELECT bolsa_real FROM bolsa) AS bolsa_real,
  CASE
    WHEN (SELECT bolsa_real FROM bolsa) > 0 THEN (s.saldo_a_favor / (SELECT bolsa_real FROM bolsa))
    ELSE 0
  END AS porcentaje_bolsa
FROM public.tesoreria_saldos_encargados_v1 s;

-- =========================
-- 3) ESPERADO POR DÍA (obligaciones)
-- =========================
CREATE OR REPLACE VIEW public.tesoreria_esperado_diario_v1 AS
SELECT
  o.fecha_devengo AS fecha,
  COALESCE(SUM(CASE WHEN o.tipo='cobro_sesion' AND o.estado <> 'cancelado' THEN o.monto ELSE 0 END), 0) AS debe_esperado,
  COALESCE(SUM(CASE WHEN o.tipo='pago_tutor_sesion' AND o.estado <> 'cancelado' THEN o.monto ELSE 0 END), 0) AS haber_esperado
FROM public.tesoreria_obligaciones o
GROUP BY o.fecha_devengo;

-- =========================
-- 4) RPC: pagar tutor (salida) + aplicar FIFO a obligaciones
-- =========================
CREATE OR REPLACE FUNCTION public.tesoreria_registrar_pago_tutor_v1(
  p_tutor_id bigint,
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
  v_bolsa numeric := 0;
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

  -- FIFO: obligaciones de pago tutor pendientes de esta cuenta
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

  RETURN jsonb_build_object(
    'pago_id', v_pago_id,
    'cuenta_id', v_cuenta_id,
    'monto', p_monto,
    'aplicado_total', v_aplicado_total,
    'pendiente_aplicar', v_restante,
    'aplicaciones', v_aplicaciones,
    'bolsa_real_antes', v_bolsa,
    'bolsa_real_despues', (v_bolsa - p_monto)
  );
END $$;
