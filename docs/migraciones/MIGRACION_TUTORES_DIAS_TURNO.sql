-- ============================================
-- MIGRACIÓN: Agregar columna 'dias_turno' a tutores
-- Almacena un mapeo JSON: { "Lun": "Tarde", "Mar": "Noche", ... }
-- ============================================

ALTER TABLE tutores
ADD COLUMN IF NOT EXISTS dias_turno TEXT DEFAULT NULL;

-- Verificación rápida:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'tutores';
