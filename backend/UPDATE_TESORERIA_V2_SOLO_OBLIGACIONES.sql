-- ============================================================================
-- ACTUALIZACIÓN TESORERÍA V2: ELIMINAR SISTEMA ANTIGUO (movimientos_dinero)
-- ============================================================================
-- 
-- Este script actualiza la vista tesoreria_saldos_encargados_v1 para que
-- SOLO use el sistema de obligaciones (tesorería v2) y elimine la suma
-- duplicada del sistema antiguo de movimientos_dinero.
--
-- IMPORTANTE: Ejecuta este SQL en Supabase SQL Editor
-- 1. Ve a https://app.supabase.com
-- 2. Selecciona tu proyecto
-- 3. Ve a "SQL Editor" en el menú lateral
-- 4. Crea una nueva query
-- 5. Pega el código de abajo y ejecuta (Run)
-- ============================================================================

-- Actualizar vista para eliminar duplicación de deudas
-- Ahora SOLO suma obligaciones, NO movimientos_dinero
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
  COALESCE(ob.obligado_pendiente, 0) AS deuda_pendiente,
  GREATEST(COALESCE(pagos.total_pagado, 0) - COALESCE(app.total_aplicado, 0), 0) AS saldo_a_favor
FROM cc
LEFT JOIN ob ON ob.cuenta_id = cc.cuenta_id
LEFT JOIN app ON app.cuenta_id = cc.cuenta_id
LEFT JOIN pagos ON pagos.cuenta_id = cc.cuenta_id;

-- Verificar que la vista se actualizó correctamente
SELECT 
  e.nombre AS encargado,
  s.deuda_pendiente,
  s.saldo_a_favor
FROM public.tesoreria_saldos_encargados_v1 s
JOIN public.encargados e ON e.id = s.encargado_id
ORDER BY e.nombre
LIMIT 10;
