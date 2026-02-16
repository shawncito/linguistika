-- 021_tesoreria_v2_pago_tutor_fuente_auto_y_pct_participacion.sql
-- Objetivo:
-- - Permitir pagar tutor con fuente "unificada" por sesión (auto: deduce de varios encargados según las sesiones seleccionadas).
-- - Ajustar el porcentaje de "participación" para que sea entendible (distribución del saldo a favor neto entre encargados).

-- =========================
-- 1) VISTA: participación por encargado (suma 100% si hay saldo)
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
  FROM public.tesoreria_saldos_encargados_v1 s
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
-- 2) RPC: pagar tutor (v3) con funding_mode
-- funding_mode:
-- - 'sistema': no registra fuentes
-- - 'auto_encargados': registra múltiples fuentes, asignando el monto aplicado por obligación al encargado del estudiante
-- - NULL: comportamiento equivalente a v2 (si p_source_encargado_id != NULL => una fuente)
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

  -- mapa {encargado_id: monto}
  v_fuentes_map jsonb := '{}'::jsonb;
  v_key text;
  v_amt numeric;
  v_saldo_fuente numeric;
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

  -- No pagar más de la bolsa real disponible
  SELECT bolsa_real INTO v_bolsa
  FROM public.tesoreria_bolsa_v1;

  IF v_bolsa < p_monto THEN
    RAISE EXCEPTION 'No se puede pagar más de la bolsa real. Bolsa=%, intento=%', v_bolsa, p_monto;
  END IF;

  v_cuenta_id := public.tesoreria_get_or_create_cuenta_tutor_v1(p_tutor_id);

  -- Construir plan de aplicaciones + mapa de fuentes (si aplica)
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

      -- Si auto_encargados: acumular por encargado del estudiante
      IF v_mode = 'auto_encargados' THEN
        IF v_ob.estudiante_id IS NULL THEN
          RAISE EXCEPTION 'Obligación % no tiene estudiante_id; no se puede auto-asignar fuente', v_ob.id;
        END IF;

        SELECT e.encargado_id INTO v_key
        FROM public.estudiantes e
        WHERE e.id = v_ob.estudiante_id;

        IF v_key IS NULL THEN
          RAISE EXCEPTION 'Estudiante % no tiene encargado_id; no se puede auto-asignar fuente', v_ob.estudiante_id;
        END IF;

        v_key := v_key::text;
        v_amt := COALESCE((v_fuentes_map ->> v_key)::numeric, 0) + v_aplicar;
        v_fuentes_map := jsonb_set(v_fuentes_map, ARRAY[v_key], to_jsonb(v_amt), true);
      END IF;

      -- Guardar plan de aplicaciones
      v_aplicaciones := v_aplicaciones || jsonb_build_array(
        jsonb_build_object(
          'obligacion_id', v_ob.id,
          'monto', v_aplicar,
          'fecha_devengo', v_ob.fecha_devengo
        )
      );
    END LOOP;
  END IF;

  -- Validar fuentes antes de insertar cualquier cosa (si aplica)
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
      FROM public.tesoreria_saldos_encargados_v1 s
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
    -- Validación fuente única (equivalente a v2)
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

  -- Registrar fuentes
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
  END IF;

  -- Ejecutar aplicaciones planificadas (si hay)
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
