-- ============================================
-- SOLUCIÓN: Crear políticas RLS para operaciones CRUD
-- El error 42501 indica que RLS está bloqueando inserts
-- ============================================

-- Políticas para ESTUDIANTES
DROP POLICY IF EXISTS "Permitir lectura de estudiantes" ON estudiantes;
DROP POLICY IF EXISTS "Permitir inserción de estudiantes" ON estudiantes;
DROP POLICY IF EXISTS "Permitir actualización de estudiantes" ON estudiantes;
DROP POLICY IF EXISTS "Permitir eliminación de estudiantes" ON estudiantes;

CREATE POLICY "Permitir lectura de estudiantes" ON estudiantes
  FOR SELECT USING (true);

CREATE POLICY "Permitir inserción de estudiantes" ON estudiantes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir actualización de estudiantes" ON estudiantes
  FOR UPDATE USING (true);

CREATE POLICY "Permitir eliminación de estudiantes" ON estudiantes
  FOR DELETE USING (true);

-- Políticas para TUTORES
DROP POLICY IF EXISTS "Permitir lectura de tutores" ON tutores;
DROP POLICY IF EXISTS "Permitir inserción de tutores" ON tutores;
DROP POLICY IF EXISTS "Permitir actualización de tutores" ON tutores;
DROP POLICY IF EXISTS "Permitir eliminación de tutores" ON tutores;

CREATE POLICY "Permitir lectura de tutores" ON tutores
  FOR SELECT USING (true);

CREATE POLICY "Permitir inserción de tutores" ON tutores
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir actualización de tutores" ON tutores
  FOR UPDATE USING (true);

CREATE POLICY "Permitir eliminación de tutores" ON tutores
  FOR DELETE USING (true);

-- Políticas para CURSOS
DROP POLICY IF EXISTS "Permitir lectura de cursos" ON cursos;
DROP POLICY IF EXISTS "Permitir inserción de cursos" ON cursos;
DROP POLICY IF EXISTS "Permitir actualización de cursos" ON cursos;
DROP POLICY IF EXISTS "Permitir eliminación de cursos" ON cursos;

CREATE POLICY "Permitir lectura de cursos" ON cursos
  FOR SELECT USING (true);

CREATE POLICY "Permitir inserción de cursos" ON cursos
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir actualización de cursos" ON cursos
  FOR UPDATE USING (true);

CREATE POLICY "Permitir eliminación de cursos" ON cursos
  FOR DELETE USING (true);

-- Políticas para MATRÍCULAS
DROP POLICY IF EXISTS "Permitir lectura de matriculas" ON matriculas;
DROP POLICY IF EXISTS "Permitir inserción de matriculas" ON matriculas;
DROP POLICY IF EXISTS "Permitir actualización de matriculas" ON matriculas;
DROP POLICY IF EXISTS "Permitir eliminación de matriculas" ON matriculas;

CREATE POLICY "Permitir lectura de matriculas" ON matriculas
  FOR SELECT USING (true);

CREATE POLICY "Permitir inserción de matriculas" ON matriculas
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir actualización de matriculas" ON matriculas
  FOR UPDATE USING (true);

CREATE POLICY "Permitir eliminación de matriculas" ON matriculas
  FOR DELETE USING (true);

-- Políticas para CLASES
DROP POLICY IF EXISTS "Permitir lectura de clases" ON clases;
DROP POLICY IF EXISTS "Permitir inserción de clases" ON clases;
DROP POLICY IF EXISTS "Permitir actualización de clases" ON clases;
DROP POLICY IF EXISTS "Permitir eliminación de clases" ON clases;

CREATE POLICY "Permitir lectura de clases" ON clases
  FOR SELECT USING (true);

CREATE POLICY "Permitir inserción de clases" ON clases
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir actualización de clases" ON clases
  FOR UPDATE USING (true);

CREATE POLICY "Permitir eliminación de clases" ON clases
  FOR DELETE USING (true);

-- Políticas para PAGOS
DROP POLICY IF EXISTS "Permitir lectura de pagos" ON pagos;
DROP POLICY IF EXISTS "Permitir inserción de pagos" ON pagos;
DROP POLICY IF EXISTS "Permitir actualización de pagos" ON pagos;
DROP POLICY IF EXISTS "Permitir eliminación de pagos" ON pagos;

CREATE POLICY "Permitir lectura de pagos" ON pagos
  FOR SELECT USING (true);

CREATE POLICY "Permitir inserción de pagos" ON pagos
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir actualización de pagos" ON pagos
  FOR UPDATE USING (true);

CREATE POLICY "Permitir eliminación de pagos" ON pagos
  FOR DELETE USING (true);

-- Políticas para HORAS_TRABAJO
DROP POLICY IF EXISTS "Permitir lectura de horas_trabajo" ON horas_trabajo;
DROP POLICY IF EXISTS "Permitir inserción de horas_trabajo" ON horas_trabajo;
DROP POLICY IF EXISTS "Permitir actualización de horas_trabajo" ON horas_trabajo;
DROP POLICY IF EXISTS "Permitir eliminación de horas_trabajo" ON horas_trabajo;

CREATE POLICY "Permitir lectura de horas_trabajo" ON horas_trabajo
  FOR SELECT USING (true);

CREATE POLICY "Permitir inserción de horas_trabajo" ON horas_trabajo
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir actualización de horas_trabajo" ON horas_trabajo
  FOR UPDATE USING (true);

CREATE POLICY "Permitir eliminación de horas_trabajo" ON horas_trabajo
  FOR DELETE USING (true);

-- ============================================
-- VERIFICACIÓN
-- ============================================
-- Para ver las políticas activas:
-- SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public';

-- ============================================
-- NOTA IMPORTANTE
-- ============================================
-- Estas políticas permiten acceso total (USING true / WITH CHECK true)
-- En producción, deberías restringir basado en:
-- - auth.uid() para verificar usuario autenticado
-- - created_by = auth.uid() para limitar a propios registros
-- Ejemplo más seguro:
--   FOR INSERT WITH CHECK (auth.uid() IS NOT NULL)
--   FOR UPDATE USING (created_by = auth.uid())
