-- ============================================================================
-- Migración: Agregar columna tutor_id a tabla cursos
-- Fecha: 2026-01-22
-- Descripción: Permite asignar un tutor a un curso al momento de creación
-- ============================================================================

-- Agregar columna tutor_id a cursos (referencia a tutores)
ALTER TABLE cursos 
ADD COLUMN tutor_id INTEGER REFERENCES tutores(id) ON DELETE SET NULL;

-- Crear índice para búsquedas rápidas
CREATE INDEX idx_cursos_tutor_id ON cursos(tutor_id);

-- Comentario en la columna
COMMENT ON COLUMN cursos.tutor_id IS 'Tutor asignado al curso';

-- ============================================================================
-- Verificación: Las siguientes consultas confirman que la migración fue exitosa
-- ============================================================================

-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'cursos' AND column_name = 'tutor_id';

-- SELECT * FROM information_schema.table_constraints 
-- WHERE table_name = 'cursos' AND constraint_type = 'FOREIGN KEY';
