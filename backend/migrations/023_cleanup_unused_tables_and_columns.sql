-- ============================================================================
-- MIGRACIÓN 023: Limpieza de tablas y columnas sin uso
-- ============================================================================
-- DESCRIPCIÓN: Elimina objetos de la base de datos que no son referenciados
--              por ningún código del backend ni del frontend.
--
-- ANÁLISIS PREVIO (verificado con grep en todo el codebase):
--   - configuracion           → 0 referencias en código
--   - logs_auditoria          → 0 referencias, reemplazada por activity_logs
--   - tesoreria_cierres_mensuales   → 0 referencias en código
--   - tesoreria_pagos_tutor_fuentes → 0 referencias en código
--   - cursos.tipo_cobro             → 0 referencias (reemplazado por tipo_pago)
--   - tutores.horario_tipo          → 0 referencias
--
-- NOTA: Algunas columnas legacy (email_encargado, telefono_encargado en
--       estudiantes; costo_curso, pago_tutor, grado_*, max_estudiantes en
--       cursos; dias, turno, dias_turno en varias tablas) AÚN son leídas
--       por el código y NO se eliminan aquí. Se deben migrar primero en el
--       código antes de poder eliminarlas.
--
-- PRECAUCIÓN: Ejecutar en un entorno de pruebas primero.
--             Las operaciones DROP son irreversibles.
-- ============================================================================

BEGIN;

-- ─── 1. TABLAS COMPLETAMENTE SIN USO ────────────────────────────────────────

-- configuracion: creada en migración 005 pero nunca implementada
DROP TABLE IF EXISTS public.configuracion CASCADE;

-- logs_auditoria: reemplazada por activity_logs (migración 011)
DROP TABLE IF EXISTS public.logs_auditoria CASCADE;

-- ─── 2. TABLAS DE TESORERÍA SIN REFERENCIAS EN CÓDIGO ───────────────────────

-- tesoreria_cierres_mensuales: creada en migración 019, nunca usada
DROP TABLE IF EXISTS public.tesoreria_cierres_mensuales CASCADE;

-- tesoreria_pagos_tutor_fuentes: creada en migración 020, nunca usada
DROP TABLE IF EXISTS public.tesoreria_pagos_tutor_fuentes CASCADE;

-- ─── 3. COLUMNAS LEGACY SIN REFERENCIAS ─────────────────────────────────────

-- cursos.tipo_cobro: reemplazado por tipo_pago ('sesion'|'mensual')
ALTER TABLE public.cursos DROP COLUMN IF EXISTS tipo_cobro;

-- tutores.horario_tipo: 0 referencias en todo el código
ALTER TABLE public.tutores DROP COLUMN IF EXISTS horario_tipo;

-- ─── 4. ENUM TYPES HUÉRFANOS (si aplica) ────────────────────────────────────

-- Eliminar tipo_cuenta_corriente solo si ya no lo usa tesoreria_cuentas_corrientes
-- (NO ejecutar, se mantiene porque tesoreria_cuentas_corrientes.tipo lo usa)
-- DROP TYPE IF EXISTS public.tipo_cuenta_corriente;

COMMIT;

-- ============================================================================
-- RESUMEN DE CAMBIOS:
--   TABLAS ELIMINADAS:
--     - configuracion
--     - logs_auditoria
--     - tesoreria_cierres_mensuales
--     - tesoreria_pagos_tutor_fuentes
--
--   COLUMNAS ELIMINADAS:
--     - cursos.tipo_cobro
--     - tutores.horario_tipo
--
-- COLUMNAS LEGACY QUE AÚN REQUIEREN CÓDIGO ANTES DE ELIMINAR:
--   cursos: dias, turno, dias_turno, dias_schedule, costo_curso, pago_tutor,
--           max_estudiantes, grado_activo, grado_nombre, grado_color,
--           requiere_perfil_completo
--   estudiantes: email_encargado, telefono_encargado, grado, dias, turno,
--                dias_turno
--   tutores: dias, turno, dias_turno
--   estudiantes_bulk: email_encargado, telefono_encargado (aún se leen/escriben)
--
-- TABLA movimientos_financieros: SIGUE EN USO (3 refs en bulk, finanzas, pagos)
--   Evaluar si se puede consolidar con movimientos_dinero en el futuro.
-- ============================================================================
