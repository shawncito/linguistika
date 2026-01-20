-- ============================================
-- MIGRACIÓN: Agregar columna 'dias_turno' a estudiantes
-- Almacena un mapeo JSON: { "Lun": "Tarde", "Mar": "Noche", ... }
-- ============================================

ALTER TABLE estudiantes
ADD COLUMN IF NOT EXISTS dias_turno TEXT DEFAULT NULL;

-- Verificación rápida:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'estudiantes';
