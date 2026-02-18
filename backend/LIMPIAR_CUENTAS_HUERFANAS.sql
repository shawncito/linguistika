    -- ============================================================================
-- LIMPIEZA DE CUENTAS HUÉRFANAS DE ENCARGADOS
-- ============================================================================
-- 
-- Este script elimina cuentas de tesorería de encargados que ya no tienen
-- estudiantes asociados (cuentas huérfanas). INCLUYE eliminación de obligaciones,
-- aplicaciones y pagos relacionados.
--
-- IMPORTANTE: Ejecuta este SQL en Supabase SQL Editor
-- 1. Ve a https://app.supabase.com
-- 2. Selecciona tu proyecto  
-- 3. Ve a "SQL Editor" en el menú lateral
-- 4. Crea una nueva query
-- 5. Pega el código de abajo y ejecuta (Run)
-- ============================================================================

-- PASO 1: Ver cuentas huérfanas antes de eliminar (SOLO LECTURA)
SELECT 
  cc.id AS cuenta_id,
  cc.encargado_id,
  e.nombre AS encargado_nombre,
  e.email,
  COUNT(DISTINCT est.id) AS estudiantes_activos,
  COUNT(DISTINCT o.id) AS obligaciones_total,
  COUNT(DISTINCT p.id) AS pagos_total
FROM tesoreria_cuentas_corrientes cc
JOIN encargados e ON e.id = cc.encargado_id
LEFT JOIN estudiantes est ON est.encargado_id = cc.encargado_id
LEFT JOIN tesoreria_obligaciones o ON o.cuenta_id = cc.id
LEFT JOIN tesoreria_pagos p ON p.cuenta_id = cc.id
WHERE cc.tipo = 'encargado'
GROUP BY cc.id, cc.encargado_id, e.nombre, e.email
HAVING COUNT(DISTINCT est.id) = 0
ORDER BY e.nombre;

-- ============================================================================
-- PASO 2: Si la consulta anterior muestra cuentas huérfanas, ejecuta esto:
-- ============================================================================

-- Obtener IDs de cuentas huérfanas
WITH cuentas_huerfanas AS (
  SELECT cc.id AS cuenta_id
  FROM tesoreria_cuentas_corrientes cc
  LEFT JOIN estudiantes est ON est.encargado_id = cc.encargado_id
  WHERE cc.tipo = 'encargado'
  GROUP BY cc.id
  HAVING COUNT(est.id) = 0
)
-- Eliminar aplicaciones relacionadas
DELETE FROM tesoreria_aplicaciones
WHERE obligacion_id IN (
  SELECT o.id 
  FROM tesoreria_obligaciones o
  WHERE o.cuenta_id IN (SELECT cuenta_id FROM cuentas_huerfanas)
);

-- Eliminar obligaciones de las cuentas huérfanas
WITH cuentas_huerfanas AS (
  SELECT cc.id AS cuenta_id
  FROM tesoreria_cuentas_corrientes cc
  LEFT JOIN estudiantes est ON est.encargado_id = cc.encargado_id
  WHERE cc.tipo = 'encargado'
  GROUP BY cc.id
  HAVING COUNT(est.id) = 0
)
DELETE FROM tesoreria_obligaciones
WHERE cuenta_id IN (SELECT cuenta_id FROM cuentas_huerfanas);

-- Eliminar pagos de las cuentas huérfanas
WITH cuentas_huerfanas AS (
  SELECT cc.id AS cuenta_id
  FROM tesoreria_cuentas_corrientes cc
  LEFT JOIN estudiantes est ON est.encargado_id = cc.encargado_id
  WHERE cc.tipo = 'encargado'
  GROUP BY cc.id
  HAVING COUNT(est.id) = 0
)
DELETE FROM tesoreria_pagos
WHERE cuenta_id IN (SELECT cuenta_id FROM cuentas_huerfanas);

-- Finalmente, eliminar las cuentas huérfanas
DELETE FROM tesoreria_cuentas_corrientes
WHERE tipo = 'encargado'
  AND encargado_id IN (
    SELECT e.id
    FROM encargados e
    LEFT JOIN estudiantes est ON est.encargado_id = e.id
    GROUP BY e.id
    HAVING COUNT(est.id) = 0
  );

-- ============================================================================
-- PASO 3: Verificación final
-- ============================================================================

-- Ver resultado: cuentas que quedaron
SELECT 
  COUNT(*) AS cuentas_encargado_restantes,
  COUNT(DISTINCT cc.encargado_id) AS encargados_con_cuenta
FROM tesoreria_cuentas_corrientes cc
WHERE cc.tipo = 'encargado';

-- Detalle de cuentas restantes
SELECT 
  cc.id AS cuenta_id,
  e.nombre AS encargado,
  COUNT(DISTINCT est.id) AS estudiantes_activos,
  COALESCE(s.deuda_pendiente, 0) AS deuda,
  COALESCE(s.saldo_a_favor, 0) AS saldo
FROM tesoreria_cuentas_corrientes cc
JOIN encargados e ON e.id = cc.encargado_id
LEFT JOIN estudiantes est ON est.encargado_id = cc.encargado_id
LEFT JOIN tesoreria_saldos_encargados_v1 s ON s.encargado_id = cc.encargado_id
WHERE cc.tipo = 'encargado'
GROUP BY cc.id, e.nombre, s.deuda_pendiente, s.saldo_a_favor
ORDER BY e.nombre;
