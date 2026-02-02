-- 003_add_turno_to_matriculas_grupo.sql
-- Agrega columna turno para soportar carga masiva de grupos (Plantilla_Carga_Masiva_Estudiantes_y_Grupos)

ALTER TABLE IF EXISTS public.matriculas_grupo
ADD COLUMN IF NOT EXISTS turno text;
