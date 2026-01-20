-- ============================================
-- MIGRACIÓN: Agregar columnas faltantes a tabla 'cursos'
-- ============================================

-- 1. Agregar columna dias_turno (horarios por día)
ALTER TABLE cursos
ADD COLUMN IF NOT EXISTS dias_turno TEXT DEFAULT NULL;

-- 2. Agregar costo del curso (precio para estudiantes)
ALTER TABLE cursos
ADD COLUMN IF NOT EXISTS costo_curso NUMERIC(10,2) DEFAULT 0;

-- 3. Agregar pago a tutores (cuánto se paga al tutor por este curso)
ALTER TABLE cursos
ADD COLUMN IF NOT EXISTS pago_tutor NUMERIC(10,2) DEFAULT 0;

-- Verificación:
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'cursos' AND column_name IN ('dias_turno', 'costo_curso', 'pago_tutor');
