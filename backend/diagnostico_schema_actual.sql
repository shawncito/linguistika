-- ============================================
-- DIAGNÓSTICO DEL SCHEMA ACTUAL - LINGUISTIKA
-- ============================================
-- Ejecuta cada query abajo EN SUPABASE (SQL Editor)
-- Copia los resultados y pégalos en la respuesta

-- 1. ESTRUCTURA DE TABLA: cursos
-- ¿Qué campos tiene actualmente?
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'cursos'
ORDER BY ordinal_position;

-- 2. ESTRUCTURA DE TABLA: estudiantes
-- ¿Qué campos tiene actualmente?
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'estudiantes'
ORDER BY ordinal_position;

-- 3. ESTRUCTURA DE TABLA: matriculas
-- ¿Qué campos tiene actualmente?
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'matriculas'
ORDER BY ordinal_position;

-- 4. ESTRUCTURA DE TABLA: tutores
-- ¿Qué campos tiene actualmente?
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'tutores'
ORDER BY ordinal_position;

-- 5. ESTRUCTURA DE TABLA: clases
-- ¿Qué campos tiene actualmente?
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'clases'
ORDER BY ordinal_position;

-- 6. VERIFICAR: ¿Existen ya tablas de finanzas?
-- ¿Ya existen movimientos_financieros, comprobantes_ingresos, logs_auditoria?
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('movimientos_financieros', 'comprobantes_ingresos', 'logs_auditoria', 'estudiantes_bulk', 'matriculas_grupo')
ORDER BY table_name;

-- 7. SAMPLE DATA: Algunos registros actuales
-- Primeros 3 cursos
SELECT id, nombre, descripcion FROM cursos LIMIT 3;

-- 8. SAMPLE DATA: Primeros 3 tutores
SELECT id, nombre, email FROM tutores LIMIT 3;

-- 9. SAMPLE DATA: Primeras 3 matrículas
SELECT id, estudiante_id, curso_id, created_at FROM matriculas LIMIT 3;

-- 10. VERIFICAR: ¿Hay datos en clases?
SELECT COUNT(*) as total_clases FROM clases;

-- 11. VERIFICAR: ¿Hay datos en pagos o movimientos?
SELECT COUNT(*) as total_pagos FROM pagos;

-- 12. RELACIONES: Foreign Keys actuales
-- ¿Cuáles son las relaciones definidas?
SELECT
  constraint_name,
  table_name,
  column_name
FROM information_schema.key_column_usage
WHERE table_schema = 'public'
AND constraint_name LIKE 'fk_%'
ORDER BY table_name, constraint_name;
