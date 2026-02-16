-- CRÍTICO: Actualiza la vista para incluir deudas de movimientos_dinero (cierre mensual)
-- Ejecuta esto en Supabase SQL Editor AHORA para que los cursos de pago mensual muestren deuda

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
