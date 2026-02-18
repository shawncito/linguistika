-- ============================================================================
-- COMPENSACIÓN AUTOMÁTICA DE DEUDAS Y SALDOS A FAVOR
-- ============================================================================
-- 
-- Este script actualiza la vista de saldos para calcular el BALANCE NETO
-- y compensar automáticamente deudas con saldos a favor.
--
-- ANTES: Deuda ₡7,500 + Saldo ₡7,500 (confuso)
-- DESPUÉS: Balance ₡0 (correcto contablemente)
--
-- IMPORTANTE: Ejecuta este SQL en Supabase SQL Editor
-- 1. Ve a https://app.supabase.com
-- 2. Selecciona tu proyecto  
-- 3. Ve a "SQL Editor" en el menú lateral
-- 4. Crea una nueva query
-- 5. Pega el código de abajo y ejecuta (Run)
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
-- Verificación: Ver cómo se compensan automáticamente
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
ORDER BY e.nombre;

-- ============================================================================
-- Casos de prueba esperados:
-- ============================================================================
-- 
-- Caso 1: Vanessa (deuda ₡7,500 - saldo ₡7,500)
-- Antes: deuda=7500, saldo=7500 ❌ Confuso
-- Después: deuda=0, saldo=0, balance=0, estado='al_dia' ✅
--
-- Caso 2: Usuario con deuda ₡10,000 y abonó ₡3,000
-- Después: deuda=7000, saldo=0, balance=7000, estado='deuda' ✅
--
-- Caso 3: Usuario con deuda ₡3,000 y abonó ₡10,000
-- Después: deuda=0, saldo=7000, balance=-7000, estado='saldo_favor' ✅
-- ============================================================================
