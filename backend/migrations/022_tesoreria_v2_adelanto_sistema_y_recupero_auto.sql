-- 022_tesoreria_v2_adelanto_sistema_y_recupero_auto.sql
-- Objetivo:
-- - Cuando se paga un tutor con "Bolsa del sistema", generar un adeudo por encargado (tipo='ajuste').
-- - Al registrar un pago de encargado, aplicar automáticamente el excedente FIFO a esos ajustes (recupero).
-- - Exponer saldos por encargado considerando cobros + ajustes.

-- Convención: los ajustes creados por adelanto del sistema llevan el prefijo en detalle:
--   'adelanto_sistema'

-- =========================
-- 1) VISTA: saldos por encargado (v2)
-- saldo_a_favor = total_pagado - total_aplicado(cobro_sesion + ajuste)
-- deuda_pendiente = solo cobro_sesion pendiente
-- adelanto_sistema_pendiente = solo ajuste pendiente (adelantos por recuperar)
-- =========================
CREATE OR REPLACE VIEW public.tesoreria_saldos_encargados_v2 AS
WITH cc AS (
  SELECT id AS cuenta_id, encargado_id
  FROM public.tesoreria_cuentas_corrientes
  WHERE tipo='encargado'
),
ob AS (
  SELECT
    o.cuenta_id,
    SUM(CASE WHEN o.tipo='cobro_sesion' AND o.estado = 'pendiente' THEN o.monto ELSE 0 END) AS deuda_pendiente,
    SUM(CASE WHEN o.tipo='ajuste' AND o.estado = 'pendiente' THEN o.monto ELSE 0 END) AS adelanto_sistema_pendiente
  FROM public.tesoreria_obligaciones o
  WHERE o.tipo IN ('cobro_sesion', 'ajuste')
  GROUP BY o.cuenta_id
),
app AS (
  SELECT
    o.cuenta_id,
    SUM(a.monto) AS total_aplicado
  FROM public.tesoreria_aplicaciones a
  JOIN public.tesoreria_obligaciones o ON o.id = a.obligacion_id
  WHERE o.tipo IN ('cobro_sesion', 'ajuste') AND o.estado <> 'cancelado'
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
  COALESCE(ob.deuda_pendiente, 0) AS deuda_pendiente,
  GREATEST(COALESCE(pagos.total_pagado, 0) - COALESCE(app.total_aplicado, 0), 0) AS saldo_a_favor,
  COALESCE(ob.adelanto_sistema_pendiente, 0) AS adelanto_sistema_pendiente
FROM cc
LEFT JOIN ob ON ob.cuenta_id = cc.cuenta_id
LEFT JOIN app ON app.cuenta_id = cc.cuenta_id
LEFT JOIN pagos ON pagos.cuenta_id = cc.cuenta_id;

-- =========================
-- 2) Actualizar vista de porcentaje v2 para basarse en saldos v2
-- (y seguir descontando fuentes explícitas de pagos de tutor)
-- =========================
CREATE OR REPLACE VIEW public.tesoreria_porcentaje_encargados_v2 AS
WITH fuentes AS (
  SELECT encargado_id, COALESCE(SUM(monto), 0) AS total_fondeado
  FROM public.tesoreria_pagos_tutor_fuentes
  GROUP BY encargado_id
),
netos AS (
  SELECT
    s.encargado_id,
    s.cuenta_id,
    GREATEST(COALESCE(s.saldo_a_favor, 0) - COALESCE(f.total_fondeado, 0), 0) AS saldo_a_favor
  FROM public.tesoreria_saldos_encargados_v2 s
  LEFT JOIN fuentes f ON f.encargado_id = s.encargado_id
),
agg AS (
  SELECT COALESCE(SUM(saldo_a_favor), 0) AS total_saldo
  FROM netos
),
bolsa AS (
  SELECT bolsa_real FROM public.tesoreria_bolsa_v1
)
SELECT
  n.encargado_id,
  n.cuenta_id,
  n.saldo_a_favor,
  (SELECT bolsa_real FROM bolsa) AS bolsa_real,
  CASE
    WHEN (SELECT total_saldo FROM agg) > 0 THEN (n.saldo_a_favor / (SELECT total_saldo FROM agg))
    ELSE 0
  END AS porcentaje_bolsa
FROM netos n;

-- =========================
-- 3) RPC: registrar pago de encargado (v2) = v1 + recuperar ajustes FIFO
-- Orden:
--   1) aplicar a cobro_sesion
--   2) aplicar excedente a ajuste (adelanto_sistema)
-- =========================
CREATE OR REPLACE FUNCTION public.tesoreria_registrar_pago_encargado_v2(
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

  -- 1) FIFO: cobro_sesion
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

  -- 2) Recupero FIFO: ajustes (adelanto_sistema)
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
      AND o.tipo = 'ajuste'
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
    'saldo_a_favor_generado', v_restante,
    'aplicaciones', v_aplicaciones
  );
END $$;

-- =========================
-- 4) RPC: pagar tutor (v3) - extender modo 'sistema' para crear ajustes por encargado
-- Requiere p_obligacion_ids (selección explícita) para poder atribuir por sesión.
-- =========================
CREATE OR REPLACE FUNCTION public.tesoreria_registrar_pago_tutor_v3(
  p_tutor_id bigint,
  p_monto numeric,
  p_fecha_pago date,
  p_source_encargado_id bigint DEFAULT NULL,
  p_obligacion_ids bigint[] DEFAULT NULL,
  p_funding_mode text DEFAULT NULL,
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
  v_bolsa numeric := 0;
  v_ob record;
  v_aplicar numeric;
  v_aplicaciones jsonb := '[]'::jsonb;
  v_aplicado_total numeric := 0;
  v_mode text := NULL;

  v_fuentes_map jsonb := '{}'::jsonb;
  v_key text;
  v_amt numeric;
  v_saldo_fuente numeric;

  v_adelantos jsonb := '[]'::jsonb;
  v_encargado_id bigint;
  v_enc_cuenta_id bigint;
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

  v_mode := NULLIF(lower(trim(COALESCE(p_funding_mode, ''))), '');

  SELECT bolsa_real INTO v_bolsa
  FROM public.tesoreria_bolsa_v1;

  IF v_bolsa < p_monto THEN
    RAISE EXCEPTION 'No se puede pagar más de la bolsa real. Bolsa=%, intento=%', v_bolsa, p_monto;
  END IF;

  v_cuenta_id := public.tesoreria_get_or_create_cuenta_tutor_v1(p_tutor_id);

  -- Construir plan de aplicaciones (requiere selección)
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
        o.estudiante_id,
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

      v_restante := v_restante - v_aplicar;
      v_aplicado_total := v_aplicado_total + v_aplicar;

      IF v_mode = 'auto_encargados' THEN
        IF v_ob.estudiante_id IS NULL THEN
          RAISE EXCEPTION 'Obligación % no tiene estudiante_id; no se puede auto-asignar fuente', v_ob.id;
        END IF;

        SELECT e.encargado_id INTO v_encargado_id
        FROM public.estudiantes e
        WHERE e.id = v_ob.estudiante_id;

        IF v_encargado_id IS NULL THEN
          RAISE EXCEPTION 'Estudiante % no tiene encargado_id; no se puede auto-asignar fuente', v_ob.estudiante_id;
        END IF;

        v_key := v_encargado_id::text;
        v_amt := COALESCE((v_fuentes_map ->> v_key)::numeric, 0) + v_aplicar;
        v_fuentes_map := jsonb_set(v_fuentes_map, ARRAY[v_key], to_jsonb(v_amt), true);
      ELSIF v_mode = 'sistema' THEN
        -- guardar adelanto por sesión para crear ajuste luego
        IF v_ob.estudiante_id IS NULL THEN
          RAISE EXCEPTION 'Obligación % no tiene estudiante_id; no se puede atribuir adelanto', v_ob.id;
        END IF;

        SELECT e.encargado_id INTO v_encargado_id
        FROM public.estudiantes e
        WHERE e.id = v_ob.estudiante_id;

        IF v_encargado_id IS NULL THEN
          RAISE EXCEPTION 'Estudiante % no tiene encargado_id; no se puede atribuir adelanto', v_ob.estudiante_id;
        END IF;

        v_adelantos := v_adelantos || jsonb_build_array(
          jsonb_build_object(
            'obligacion_id', v_ob.id,
            'estudiante_id', v_ob.estudiante_id,
            'encargado_id', v_encargado_id,
            'monto', v_aplicar,
            'fecha_devengo', v_ob.fecha_devengo
          )
        );
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
    RAISE EXCEPTION 'Se requiere selección de obligaciones (p_obligacion_ids)';
  END IF;

  -- Validar fuentes antes de insertar (auto_encargados)
  IF v_mode = 'auto_encargados' THEN
    IF jsonb_typeof(v_fuentes_map) <> 'object' OR jsonb_object_length(v_fuentes_map) = 0 THEN
      RAISE EXCEPTION 'Modo auto_encargados requiere obligaciones seleccionadas (p_obligacion_ids)';
    END IF;

    FOR v_key IN SELECT jsonb_object_keys(v_fuentes_map)
    LOOP
      v_amt := COALESCE((v_fuentes_map ->> v_key)::numeric, 0);
      IF v_amt <= 0 THEN
        CONTINUE;
      END IF;

      SELECT
        GREATEST(COALESCE(s.saldo_a_favor, 0) - COALESCE(f.total_fondeado, 0), 0)
      INTO v_saldo_fuente
      FROM public.tesoreria_saldos_encargados_v2 s
      LEFT JOIN (
        SELECT encargado_id, COALESCE(SUM(monto), 0) AS total_fondeado
        FROM public.tesoreria_pagos_tutor_fuentes
        GROUP BY encargado_id
      ) f ON f.encargado_id = s.encargado_id
      WHERE s.encargado_id = (v_key::bigint);

      IF COALESCE(v_saldo_fuente, 0) < v_amt THEN
        RAISE EXCEPTION 'Fuente (encargado_id=%) sin saldo suficiente. Disponible=%, requerido=%', v_key::bigint, COALESCE(v_saldo_fuente,0), v_amt;
      END IF;
    END LOOP;
  ELSIF p_source_encargado_id IS NOT NULL AND v_mode IS DISTINCT FROM 'sistema' THEN
    -- fuente única
    SELECT
      GREATEST(COALESCE(s.saldo_a_favor, 0) - COALESCE(f.total_fondeado, 0), 0)
    INTO v_saldo_fuente
    FROM public.tesoreria_saldos_encargados_v2 s
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

  -- Registrar fuentes / adelantos
  IF v_mode = 'auto_encargados' THEN
    FOR v_key IN SELECT jsonb_object_keys(v_fuentes_map)
    LOOP
      v_amt := COALESCE((v_fuentes_map ->> v_key)::numeric, 0);
      IF v_amt <= 0 THEN
        CONTINUE;
      END IF;
      INSERT INTO public.tesoreria_pagos_tutor_fuentes (pago_id, encargado_id, monto)
      VALUES (v_pago_id, (v_key::bigint), v_amt);
    END LOOP;
  ELSIF p_source_encargado_id IS NOT NULL AND v_mode IS DISTINCT FROM 'sistema' THEN
    INSERT INTO public.tesoreria_pagos_tutor_fuentes (pago_id, encargado_id, monto)
    VALUES (v_pago_id, p_source_encargado_id, p_monto);
  ELSIF v_mode = 'sistema' THEN
    -- crear ajustes por encargado (adelanto) basados en el plan
    FOR v_ob IN
      SELECT
        (x->>'obligacion_id')::bigint AS obligacion_id,
        (x->>'encargado_id')::bigint AS encargado_id,
        (x->>'monto')::numeric AS monto,
        (x->>'fecha_devengo')::date AS fecha_devengo
      FROM jsonb_array_elements(v_adelantos) x
    LOOP
      v_enc_cuenta_id := public.tesoreria_get_or_create_cuenta_encargado_v1(v_ob.encargado_id);
      INSERT INTO public.tesoreria_obligaciones (
        tipo,
        cuenta_id,
        monto,
        fecha_devengo,
        estado,
        tutor_id,
        sesion_id,
        detalle
      )
      SELECT
        'ajuste',
        v_enc_cuenta_id,
        v_ob.monto,
        v_ob.fecha_devengo,
        'pendiente',
        p_tutor_id,
        o.sesion_id,
        'adelanto_sistema; pago_tutor_id=' || v_pago_id || '; obligacion_tutor_id=' || v_ob.obligacion_id
      FROM public.tesoreria_obligaciones o
      WHERE o.id = v_ob.obligacion_id;
    END LOOP;
  END IF;

  -- Ejecutar aplicaciones
  IF jsonb_typeof(v_aplicaciones) = 'array' AND jsonb_array_length(v_aplicaciones) > 0 THEN
    FOR v_ob IN
      SELECT
        (x->>'obligacion_id')::bigint AS obligacion_id,
        (x->>'monto')::numeric AS monto
      FROM jsonb_array_elements(v_aplicaciones) x
    LOOP
      INSERT INTO public.tesoreria_aplicaciones (pago_id, obligacion_id, monto)
      VALUES (v_pago_id, v_ob.obligacion_id, v_ob.monto);

      UPDATE public.tesoreria_obligaciones o
      SET estado = CASE
        WHEN COALESCE((
          SELECT SUM(a.monto)
          FROM public.tesoreria_aplicaciones a
          WHERE a.obligacion_id = o.id
        ), 0) >= o.monto THEN 'aplicado'
        ELSE o.estado
      END,
      updated_at = now()
      WHERE o.id = v_ob.obligacion_id;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'pago_id', v_pago_id,
    'cuenta_id', v_cuenta_id,
    'monto', p_monto,
    'aplicado_total', v_aplicado_total,
    'pendiente_aplicar', (p_monto - v_aplicado_total),
    'aplicaciones', v_aplicaciones,
    'funding_mode', v_mode,
    'source_encargado_id', p_source_encargado_id,
    'bolsa_real_antes', v_bolsa,
    'bolsa_real_despues', (v_bolsa - p_monto)
  );
END $$;
