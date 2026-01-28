-- ============================================
-- DIAGNÓSTICO DE AUTH Y PERMISOS - LINGUISTIKA
-- ============================================
-- Ejecuta cada query abajo EN SUPABASE (SQL Editor)

-- 1. VERIFICAR: ¿Existe tabla de usuarios/roles?
-- ¿Dónde guardas info de usuarios (admin, tutor, estudiante)?
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('usuarios', 'admin', 'roles', 'user_roles', 'trabajadores')
ORDER BY table_name;

-- 2. ESTRUCTURA: Si existe tabla usuarios/admin/trabajadores
-- Primero ejecuta esto para ver qué tabla existe
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'usuarios' OR table_name = 'admin' OR table_name = 'trabajadores'
ORDER BY table_name, ordinal_position;

-- 3. REVISAR: ¿Qué usuarios existen en auth.users?
-- ¿Cuáles están creados en Supabase?
SELECT id, email, created_at FROM auth.users LIMIT 10;

-- 4. REVISAR: ¿Hay RLS policies definidas?
-- Verifica qué tablas tienen RLS habilitado
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 5. REVISAR: ¿Existen policies específicas?
-- Lista todas las policies
SELECT policyname, tablename, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 6. VERIFICAR: ¿Hay triggers o funciones para auth?
-- ¿Hay triggers que sincronizan auth.users con tabla local?
SELECT routinename, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routinename;

-- 7. SAMPLE: Primeros 3 usuarios/trabajadores
-- (Ejecuta si existe tabla usuarios o similar)
SELECT * FROM usuarios LIMIT 3;
-- Si la query anterior falla, intenta:
-- SELECT * FROM admin LIMIT 3;
-- SELECT * FROM trabajadores LIMIT 3;
