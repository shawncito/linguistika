-- ============================================================================
-- COMPENSACIÓN AUTOMÁTICA - INSTRUCCIONES DE EJECUCIÓN
-- ============================================================================
-- 
-- IMPORTANTE: Ejecuta este SQL en Supabase AHORA para activar compensación
-- 
-- 1. Ve a: https://app.supabase.com
-- 2. Selecciona tu proyecto
-- 3. SQL Editor (menú lateral izquierdo)
-- 4. "New query"
-- 5. Pega TODO el código de abajo
-- 6. Click "Run" (o Ctrl+Enter)
-- 7. Verifica: debe decir "Success. No rows returned"
-- ============================================================================

-- Vista actualizada con BALANCE NETO y compensación automática
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
),
balances AS (
  SELECT
    cc.cuenta_id,
    cc.encargado_id,
    COALESCE(ob.obligado_pendiente, 0) AS deuda_pendiente_bruta,
    COALESCE(pagos.total_pagado, 0) - COALESCE(app.total_aplicado, 0) AS saldo_a_favor_bruto,
    -- BALANCE NETO: deuda - saldo
    COALESCE(ob.obligado_pendiente, 0) - (COALESCE(pagos.total_pagado, 0) - COALESCE(app.total_aplicado, 0)) AS balance_neto
  FROM cc
  LEFT JOIN ob ON ob.cuenta_id = cc.cuenta_id
  LEFT JOIN app ON app.cuenta_id = cc.cuenta_id
  LEFT JOIN pagos ON pagos.cuenta_id = cc.cuenta_id
)
SELECT
  encargado_id,
  cuenta_id,
  -- COMPENSACIÓN AUTOMÁTICA:
  -- Si balance_neto > 0 → deuda, saldo = 0
  -- Si balance_neto < 0 → saldo a favor, deuda = 0
  -- Si balance_neto = 0 → ambos = 0
  CASE 
    WHEN balance_neto > 0 THEN balance_neto
    ELSE 0
  END AS deuda_pendiente,
  
  CASE 
    WHEN balance_neto < 0 THEN ABS(balance_neto)
    ELSE 0
  END AS saldo_a_favor,
  
  balance_neto,
  
  -- Estado contable
  CASE
    WHEN balance_neto > 0 THEN 'deuda'
    WHEN balance_neto < 0 THEN 'saldo_favor'
    ELSE 'al_dia'
  END AS estado
FROM balances;

-- ============================================================================
-- VERIFICACIÓN: Debe mostrar a Vanessa con balance=0 y estado='al_dia'
-- ============================================================================

SELECT 
  e.nombre AS encargado,
  s.deuda_pendiente,
  s.saldo_a_favor,
  s.balance_neto,
  s.estado,
  CASE 
    WHEN s.estado = 'deuda' THEN '🔴 Debe pagar'
    WHEN s.estado = 'saldo_favor' THEN '🟢 Tiene saldo a favor'
    WHEN s.estado = 'al_dia' THEN '✅ Al día'
  END AS descripcion
FROM public.tesoreria_saldos_encargados_v1 s
JOIN public.encargados e ON e.id = s.encargado_id
WHERE e.nombre ILIKE '%vanessa%'
ORDER BY e.nombre;

-- Esperado para Vanessa (si pagó ₡7,500 y debe ₡7,500):
-- deuda_pendiente = 0
-- saldo_a_favor = 0
-- balance_neto = 0
-- estado = 'al_dia'
-- ✅ Al día

-- ============================================================================
-- FIN - Si ves "Success", recarga la aplicación y verifica a Vanessa
-- ============================================================================
